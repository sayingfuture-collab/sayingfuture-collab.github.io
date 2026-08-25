// 오케스트레이션 — 화면을 잇고 라운드를 돈다.
//
// 게임 규칙은 전부 src/game/*에 있다. 여기는 driver의 함수를 순서대로 부르고
// 그 결과를 화면에 넘길 뿐, 골드·생명을 직접 계산하지 않는다.
//
// 라운드 흐름: 경매(봉인→공개) → 편성 → 전투(재생) → 결과(수입) → 다음 라운드.
// 12라운드 뒤 1위 동률이면 결전(finale), 그리고 최종 순위.

import { mulberry32, seedFrom } from './rng.js';
import { createGame, playerOf, aliveOf, serialize, deserialize } from './game/state.js';
import {
  openAuction, runAuction, prepareBattles, settleRound, isOver, standings, finale,
  decideRivalBids, payScout, isBlackMarket,
} from './game/driver.js';
import { ECON, income } from './game/economy.js';
import { fieldTeam } from './game/rival-team.js';
import { pairings, judge } from './game/match.js';
import { MAX_TURNS_PER_FLOOR } from './battle/runner.js';
import { runTurn } from './battle/engine.js';
import { PERSONALITIES } from './game/rivals.js';
import { createFightView, SPEEDS } from './ui/fight-view.js';
import { createRivalBar } from './ui/rival-bar.js';
import { createAuctionScreen } from './ui/screen-auction.js';
import { createFormationScreen } from './ui/screen-formation.js';
import { createResultScreen } from './ui/screen-result.js';

const $ = (id) => document.getElementById(id);
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SAVE_KEY = 'sealed-bid-save-v1';

// ── 시드 ──
const params = new URLSearchParams(location.search);
const seedParam = params.get('seed');
const seed = seedParam !== null ? seedParam : Date.now();
let rng = mulberry32(seedFrom(seed));

// ── 상태 ──
let game = null;

const nameOf = (p) => {
  if (p.id === 'player') return '나';
  const P = PERSONALITIES[p.personality];
  return `${P.emoji} ${P.name}`;
};
const byId = (pid) => game.participants.find((p) => p.id === pid);

// ── 세이브 ──
function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ seed: String(seed), game: serialize(game) }));
  } catch { /* 저장 불가 환경(시크릿 등)이어도 게임은 돈다 */ }
}
function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return { seed: data.seed, game: deserialize(data.game) };
  } catch { return null; }
}
function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* 무시 */ }
}

// ── HUD ──
const hud = $('hud');
function updateHud() {
  const me = playerOf(game);
  hud.replaceChildren();
  const round = el('div', 'hud__round', `제${Math.min(game.round, ECON.ROUNDS)}라운드`);
  round.append(el('span', null, ` / ${ECON.ROUNDS}`));
  const mine = el('div', 'hud__me');
  mine.append(el('span', 'hud__gold', `💰 ${me.gold}`));
  mine.append(el('span', 'hud__lives', me.eliminated ? '☠ 탈락' : '♥'.repeat(Math.max(0, me.lives))));
  if (me.streak >= 2) mine.append(el('span', 'hud__streak', `${me.streak}연승`));
  hud.append(round, mine);
  rivalBar.update(game);
}

// ── 화면 ──
const SCREENS = ['auction', 'formation', 'battle', 'result', 'final'];
function show(name) {
  for (const s of SCREENS) $(`screen-${s}`).hidden = s !== name;
}

const rivalBar = createRivalBar();
$('rivalbar-mount').append(rivalBar.el);

const auctionScreen = createAuctionScreen($('screen-auction'), {
  rivalBar,
  onGoldChange: () => updateHud(),
});
const formationScreen = createFormationScreen($('screen-formation'));
const resultScreen = createResultScreen($('screen-result'));

// ── 전투 화면 (fight-view 재생 + 배속 + 스킵) ──
const battleRoot = $('screen-battle');
const fight = createFightView();
let curSpeed = 1;
let skipped = false;

const battleWrap = el('div', 'battle');
const battleHead = el('div', 'battle__head');
const foeLabel = el('div', 'battle__foe');
const speedBox = el('div', 'battle__speeds');
const speedBtns = new Map();
for (const s of SPEEDS) {
  const b = el('button', 'battle__speed', `×${s}`);
  b.type = 'button';
  b.onclick = () => setSpeed(s);
  speedBtns.set(s, b);
  speedBox.append(b);
}
const skipBtn = el('button', 'battle__skip', '결과 보기 ⏭');
skipBtn.type = 'button';
skipBtn.onclick = () => { skipped = true; fight.abort(); };
battleHead.append(foeLabel, speedBox, skipBtn);
const stage = el('div', 'battle__stage');
stage.append(fight.el);
battleWrap.append(battleHead, stage);
battleRoot.append(battleWrap);

function setSpeed(s) {
  curSpeed = s;
  fight.setSpeed(s);
  for (const [v, b] of speedBtns) b.dataset.on = String(v === s);
}
setSpeed(1);

/** 플레이어 판 하나를 재생하고 판정한다. 판정은 judge() — 재생과 헤드리스가 같은 규칙. */
async function runPlayerBattle(playerFight) {
  const foe = byId(playerFight.opponentId);
  foeLabel.replaceChildren('⚔ vs ');
  foeLabel.append(el('b', null, nameOf(foe)));
  show('battle');

  const state = playerFight.state;
  skipped = false;
  fight.setup(state);
  fight.setSpeed(curSpeed);
  fight.setLog('전투 개시!');

  let turns = 0;
  while (state.result === 'ongoing' && turns < MAX_TURNS_PER_FLOOR) {
    const events = runTurn(state, rng);
    turns += 1;
    if (!skipped) {
      const done = await fight.play(events);
      if (done) fight.sync(state);
    }
  }
  fight.sync(state);

  const out = judge(state, turns);

  const banner = el('div', 'battle__banner');
  banner.dataset.kind = out.winner === 'A' ? 'win' : 'lose';
  banner.append(el('b', null, out.winner === 'A' ? '승리!' : '패배…'));
  if (out.draw) banner.append(el('span', null, '200턴 무승부 — 잔여 체력 우세로 판정'));
  stage.append(banner);
  await Promise.race([
    sleep(1300),
    new Promise((r) => banner.addEventListener('click', r, { once: true })),
  ]);
  banner.remove();
  return out;
}

// ── 한 라운드 ──
async function playRound() {
  updateHud();
  save();

  // ① 경매 — 유산 매물 표식은 openAuction이 legacy를 소모하기 전에 떠 둔다
  const legacyIds = new Set(game.legacy.map((m) => m.id));
  const lots = openAuction(game, rng);
  // 라이벌 시트를 봉인 전에 확정한다 — 정찰이 보여주는 값과 실제 제출이 같아야 하니까
  const pre = decideRivalBids(game, lots, rng);
  show('auction');
  await auctionScreen.run(
    game, lots,
    (playerBids) => runAuction(game, lots, playerBids, rng, pre),
    {
      legacyIds,
      blackMarket: isBlackMarket(game),
      scout: {
        cost: ECON.SCOUT_COST,
        pay: () => { payScout(game); updateHud(); },
        sheetOf: (rid) => pre.rivalBids[rid] ?? {},
      },
    },
  );
  updateHud();

  // ② 편성 — 상대는 페어링 규칙으로 미리 안다 (prepareBattles와 같은 순서 함수)
  const { pairs, bye } = pairings(aliveOf(game), game.round);
  const myPair = pairs.find(([a, b]) => a === 'player' || b === 'player');
  const opponentId = myPair ? (myPair[0] === 'player' ? myPair[1] : myPair[0]) : null;
  show('formation');
  const myEntries = await formationScreen.run(game, opponentId);

  // ③ 전투 — 플레이어 판은 재생, AI 판은 헤드리스
  const teamOf = (p) => (p.id === 'player' ? myEntries : fieldTeam(p.roster, game.round));
  const { playerFight, aiResults } = prepareBattles(game, teamOf, rng);

  let playerOutcome = null;
  let myOut = null;
  if (playerFight) {
    myOut = await runPlayerBattle(playerFight);
    playerOutcome = myOut.winner === 'A'
      ? { winnerId: 'player', loserId: playerFight.opponentId }
      : { winnerId: playerFight.opponentId, loserId: 'player' };
  }

  // ④ 정산 — 전후 스냅샷으로 실제 적용값만 보여준다
  const before = new Map(game.participants.map((p) => (
    [p.id, { gold: p.gold, lives: p.lives, eliminated: p.eliminated }]
  )));
  const roundPlayed = game.round;
  settleRound(game, playerOutcome, aiResults);
  updateHud();
  save();

  const me = playerOf(game);
  const meBefore = before.get('player');

  // 내 전투 요약
  let player;
  if (!playerFight) {
    player = { type: 'bye', livesDelta: 0, lives: me.lives };
  } else {
    const won = playerOutcome.winnerId === 'player';
    player = {
      type: won ? 'win' : 'lose',
      foeName: nameOf(byId(playerFight.opponentId)),
      draw: myOut.draw,
      livesDelta: me.lives - meBefore.lives,
      lives: Math.max(0, me.lives),
      eliminatedNow: me.eliminated && !meBefore.eliminated,
    };
  }

  // AI끼리 결과 한 줄씩
  const aiLines = aiResults.map(({ aId, bId, out }) => {
    const winner = out.winner === 'A' ? byId(aId) : byId(bId);
    const loser = out.winner === 'A' ? byId(bId) : byId(aId);
    const delta = before.get(loser.id).lives - loser.lives;
    return `${nameOf(winner)} 승 — ${nameOf(loser)} 패 (생명 −${delta})`;
  });
  if (bye && bye !== 'player') aiLines.push(`${nameOf(byId(bye))} 부전승`);

  // 수입 내역 — settleRound가 실제 적용한 값(스냅샷 차)과 economy 함수로 분해
  let incomeView = null;
  if (!me.eliminated) {
    const inc = income(meBefore.gold, me.wonLastRound, me.streak);
    const win = me.wonLastRound ? ECON.WIN_BONUS : 0;
    const streakBonus = Math.min(Math.max(me.streak - 1, 0), ECON.STREAK_MAX);
    const net = me.gold - meBefore.gold;
    incomeView = {
      base: ECON.INCOME_BASE,
      interest: inc - ECON.INCOME_BASE - win - streakBonus,
      win,
      streakBonus,
      pay: inc - net,
      net,
    };
  }

  const eliminated = game.participants
    .filter((p) => p.id !== 'player' && p.eliminated && !before.get(p.id).eliminated)
    .map(nameOf);

  const over = isOver(game, ECON.ROUNDS) || me.eliminated;
  show('result');
  await resultScreen.run({
    round: roundPlayed,
    player,
    aiLines,
    income: incomeView,
    eliminated,
    nextLabel: over ? '최종 결과 보기' : `제${game.round}라운드로 →`,
  });
}

// ── 탈락 후 빨리 감기 — 남은 라운드를 헤드리스로 끝까지 ──
function fastForward() {
  while (!isOver(game, ECON.ROUNDS)) {
    const lots = openAuction(game, rng);
    runAuction(game, lots, {}, rng);
    const teamOf = (p) => fieldTeam(p.roster, game.round);
    const { aiResults } = prepareBattles(game, teamOf, rng);
    settleRound(game, null, aiResults);
  }
}

// ── 최종 화면 ──
function showFinal(fin) {
  const root = $('screen-final');
  root.replaceChildren();
  show('final');

  const wrap = el('div', 'final');
  const title = el('div', 'title', '최종 순위');
  title.append(el('small', null, `${ECON.ROUNDS}라운드의 봉인이 모두 풀렸습니다`));
  wrap.append(title);

  const order = standings(game);

  if (fin) {
    const [winId, loseId] = fin.finalists;
    const duel = el('div', 'final__duel');
    duel.append(
      el('div', null, '⚔ 1위 동률 — 결전!'),
      el('b', null, `${nameOf(byId(winId))} 승리`),
      el('div', null, `${nameOf(byId(loseId))}를 꺾고 정상에 섰습니다`),
    );
    wrap.append(duel);
  }

  if (order[0]?.id === 'player') wrap.append(el('div', 'final__crown', '👑'));

  const list = el('div', 'final__list');
  order.forEach((p, i) => {
    const row = el('div', 'final__row');
    row.dataset.rank = String(i + 1);
    row.dataset.me = String(p.id === 'player');
    const medal = ['🥇', '🥈', '🥉', '4'][i] ?? `${i + 1}`;
    row.append(el('div', 'final__rank', medal));
    const name = el('div', 'final__name', nameOf(p));
    if (p.id === 'player' && i === 0) name.append(el('small', null, '봉인 경매장의 새 주인'));
    row.append(name);
    const stat = el('div', 'final__stat');
    stat.append(
      el('div', null, p.eliminated
        ? (p.eliminatedRound ? `☠ ${p.eliminatedRound}R 탈락` : '☠ 탈락')
        : `♥ ${p.lives}`),
      el('b', null, `💰 ${p.gold}`),
    );
    row.append(stat);
    list.append(row);
  });
  wrap.append(list);

  const again = el('button', 'btn', '다시 하기');
  again.type = 'button';
  again.onclick = () => { clearSave(); location.reload(); };
  wrap.append(again);

  root.append(wrap);
  updateHud();
}

// ── 메인 루프 ──
async function main() {
  rivalBar.build(game);
  updateHud();

  while (!isOver(game, ECON.ROUNDS)) {
    if (playerOf(game).eliminated) break;
    await playRound();
  }

  if (playerOf(game).eliminated) fastForward();

  // 1위 생명 동률이면 결전 — 성립 조건은 finale 스스로 가린다(아니면 null)
  const fin = finale(game, (p) => fieldTeam(p.roster, game.round), rng);

  clearSave(); // 끝난 판은 이어하기 대상이 아니다
  showFinal(fin);
}

// ── 시작 — ?seed=가 있으면 무조건 새 판(재현용), 아니면 세이브가 있으면 물어본다 ──
function boot() {
  const saved = seedParam === null ? loadSave() : null;

  if (saved && !isOver(saved.game, ECON.ROUNDS) && !playerOf(saved.game).eliminated) {
    const overlay = el('div', 'start');
    overlay.append(
      el('h1', null, '🔏 봉인 입찰'),
      el('p', null, `제${saved.game.round}라운드에서 멈춘 판이 있습니다.`),
    );
    const cont = el('button', 'btn', `이어하기 — 제${saved.game.round}라운드`);
    cont.type = 'button';
    const fresh = el('button', 'btn btn--ghost', '새 게임');
    fresh.type = 'button';
    overlay.append(cont, fresh);
    document.body.append(overlay);

    cont.onclick = () => {
      overlay.remove();
      game = saved.game;
      // rng 흐름은 복원할 수 없으니 새 줄기를 딴다 — 판정 규칙은 시드와 무관하게 같다
      rng = mulberry32(seedFrom(`${saved.seed}:resume:${saved.game.round}:${Date.now()}`));
      main();
    };
    fresh.onclick = () => {
      overlay.remove();
      clearSave();
      game = createGame(rng);
      main();
    };
    return;
  }

  game = createGame(rng);
  main();
}

boot();
