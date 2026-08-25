// 경매 화면 — 이 게임의 심장.
//
// 두 국면을 한 화면에서 잇는다:
//  ① 봉인: 매물 카드마다 스테퍼로 입찰액을 적는다 (0 = 불참, 합계 > 소지금 금지)
//  ② 공개: 라이벌 고민 연출 → 매물별로 전원 입찰액을 낮은 순으로 한 명씩 드러낸다.
//     긴장의 핵심이 이 순차 공개다 — 마지막 줄이 뒤집히는 순간을 위해 산다.
//
// 게임 로직은 안 만진다. 입찰 합계 검증만 UI에서 하고(초과 제출은 resolve가 throw),
// 해소는 app.js가 넘긴 resolveFn(= driver.runAuction)이 한다.

import { ECON, levelOf } from '../game/economy.js';
import { PERSONALITIES } from '../game/rivals.js';
import { playerOf, aliveOf } from '../game/state.js';
import { artNode } from './art.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 리액션 태그 → 대사. won/soClose는 성격별로 다르다 — 성격이 읽혀야 사람처럼 보인다. */
const LINES = {
  won: {
    miser: '그 값에 가져가지.',
    allin: '전부 걸었고 전부 얻었다!',
    sniper: '…계획대로.',
  },
  soClose: {
    miser: '1골드 차이라고?!',
    allin: '그걸 놓친다고?!',
    sniper: '…간발의 차인가.',
  },
  snipeVow: '다음엔 네 걸 뺏겠다.',
  allin: '전부 건다!',
  rest: '오늘은 쉰다.',
  snipe: '말했지. 뺏는다고.',
};

const nameOf = (game, pid) => {
  if (pid === 'player') return '나';
  const p = game.participants.find((x) => x.id === pid);
  const P = PERSONALITIES[p?.personality];
  return P ? `${P.emoji} ${P.name}` : pid;
};

export function createAuctionScreen(root, { rivalBar, onGoldChange }) {
  /**
   * 한 라운드의 경매를 진행한다.
   * @param {object} game
   * @param {Array<{lotId, merc}>} lots
   * @param {(playerBids: Record<string, number>) => {result, reactions, allBids}} resolveFn
   * @param {{legacyIds?: Set<string>}} opts
   * @returns {Promise<{result, reactions, allBids}>}
   */
  async function run(game, lots, resolveFn, opts = {}) {
    const player = playerOf(game);
    const legacyIds = opts.legacyIds ?? new Set();
    const blackMarket = !!opts.blackMarket;
    const scout = opts.scout ?? null;
    const bids = {}; // lotId -> 골드 (0은 키를 안 만든다)
    const mySsr = player.roster.filter((r) => r.merc.tier === 'SSR').length;
    const ssrLocked = mySsr >= ECON.SSR_ROSTER_CAP;
    // 내 로스터의 역할별 인원 — 매물의 짝 시너지 예고에 쓴다
    const roleCount = {};
    for (const r of player.roster) roleCount[r.merc.role] = (roleCount[r.merc.role] ?? 0) + 1;

    let fast = false; // 공개 연출 건너뛰기 (화면 탭)

    root.replaceChildren();
    root.scrollTop = 0;

    const title = el('div', 'title', blackMarket
      ? `제${game.round}라운드 — 🕯 암시장`
      : `제${game.round}라운드 — 봉인 경매`);
    const isSsrRound = !blackMarket && ECON.SSR_ROUNDS.includes(game.round);
    if (isSsrRound) title.classList.add('title--ssr');
    if (blackMarket) title.classList.add('title--black');
    title.append(el('small', null, blackMarket
      ? '얼굴 없는 경매 — 역할만 보인다. 정체는 낙찰 후에'
      : isSsrRound
        ? '⭐ 거물이 나오는 라운드 — 전원이 노린다'
        : '전 매물 동시 봉인 · 쓴 만큼 낸다 · 동점은 절박한 자가 이긴다'));

    // ── 내 용병단 스트립 — 시트를 쓰는 동안 내 패를 계속 본다 ──
    const band = el('div', 'band');
    {
      const head = el('div', 'band__head');
      head.append(el('b', null, `내 용병단 ${player.roster.length}명`));
      const syn = Object.entries(roleCount).filter(([, n]) => n >= 2).map(([role, n]) => `⚡${role}×${n}`);
      head.append(el('span', null,
        `급료 ${player.roster.reduce((s, r) => s + (ECON.SALARY[r.merc.tier] ?? 0), 0)}골드/라운드`
        + (syn.length ? ` · ${syn.join(' ')}` : '')));
      const strip = el('div', 'band__strip');
      for (const r of player.roster) {
        const cell = el('div', 'band__cell');
        cell.dataset.tier = r.merc.tier;
        const lv = levelOf(r.acquiredRound, game.round, r.merc.tier);
        cell.append(
          artNode(r.merc, 'band__art'),
          el('div', 'band__name', r.merc.name),
          el('div', 'band__meta', `${r.merc.role} · ${lv}렙`),
        );
        strip.append(cell);
      }
      band.append(head, strip);
    }

    const list = el('div', 'auction__lots');
    const foot = el('div', 'auction__foot');
    const budget = el('div', 'auction__budget');
    const submit = el('button', 'btn auction__submit', '🔏 봉인 제출');
    submit.type = 'button';
    foot.append(budget, submit);

    // ── 정찰 — 봉인 전에 라이벌 1명의 시트를 몰래 본다 (라운드 1회) ──
    const scoutBox = el('div', 'scout');
    const scoutBtns = new Map(); // rid -> button
    let scoutUsed = false;
    const rivals0 = aliveOf(game).filter((p) => p.id !== 'player');
    if (scout && rivals0.length) {
      scoutBox.append(el('div', 'scout__label', `🔍 정찰 — ${scout.cost}골드로 한 명의 시트를 몰래 본다`));
      const row = el('div', 'scout__row');
      for (const r of rivals0) {
        const P = PERSONALITIES[r.personality];
        const b = el('button', 'scout__btn', `${P.emoji} ${P.name}`);
        b.type = 'button';
        b.onclick = () => doScout(r.id);
        scoutBtns.set(r.id, b);
        row.append(b);
      }
      scoutBox.append(row);
    }

    function doScout(rid) {
      if (scoutUsed) return;
      try { scout.pay(); } catch { return; } // 돈이 모자라면 버튼이 이미 죽어 있어야 정상
      scoutUsed = true;
      const P = PERSONALITIES[game.participants.find((p) => p.id === rid).personality];
      const sheet = scout.sheetOf(rid);
      const entries = Object.entries(sheet);
      // 매물 카드마다 그 라이벌의 입찰액을 태그로 붙인다
      for (const [lotId, c] of cards) {
        const amt = sheet[lotId] ?? 0;
        const tag = el('div', 'lot__scout',
          amt > 0 ? `🔍 ${P.emoji} ${P.name} — ${amt}골드` : `🔍 ${P.emoji} ${P.name} — 불참`);
        tag.dataset.hot = String(amt > 0);
        c.cardEl.insertBefore(tag, c.stepperEl ?? null);
      }
      scoutBox.replaceChildren(el('div', 'scout__done', entries.length
        ? `🔍 ${P.emoji} ${P.name}의 봉인을 훔쳐봤다 — 들키기 전에 시트를 쓰자`
        : `🔍 ${P.emoji} ${P.name}은(는) 이번 라운드를 통째로 쉰다`));
      refresh();
    }

    root.append(title, band, scoutBox, list, foot);

    const total = () => Object.values(bids).reduce((a, b) => a + b, 0);

    const cards = new Map(); // lotId -> {amount, minus, plus, cardEl}

    function refresh() {
      const left = player.gold - total();
      budget.replaceChildren(
        el('span', null, '남은 골드 '),
        el('b', null, `💰 ${left}`),
        el('i', null, ` / ${player.gold}`),
      );
      for (const [lotId, c] of cards) {
        const amt = bids[lotId] ?? 0;
        c.amount.textContent = amt > 0 ? `${amt}` : '불참';
        c.amount.dataset.on = String(amt > 0);
        c.minus.disabled = amt <= 0 || c.locked;
        c.plus.disabled = left <= 0 || c.locked;
        c.cardEl.dataset.bidding = String(amt > 0);
      }
      // 정찰 버튼 — 이미 썼거나 입찰 배분 후 남는 돈이 비용보다 적으면 잠근다
      for (const b of scoutBtns.values()) {
        b.disabled = scoutUsed || left < (scout?.cost ?? Infinity);
      }
    }

    for (const lot of lots) {
      const { merc } = lot;
      const card = el('div', 'lot');
      if (blackMarket) card.classList.add('lot--mystery');
      else card.dataset.tier = merc.tier;

      const top = el('div', 'lot__top');
      const artWrap = artNode(merc, 'lot__art');
      top.append(artWrap);
      const info = el('div', 'lot__info');
      const nameRow = el('div', 'lot__name', blackMarket ? '???' : merc.name);
      if (!blackMarket && legacyIds.has(merc.id)) nameRow.append(el('span', 'lot__legacy', '☠ 유산'));
      const salary = ECON.SALARY[merc.tier] ?? 0;
      const metaEl = el('div', 'lot__meta', blackMarket ? `? · ${merc.role}` : `${merc.tier} · ${merc.role}`);
      const salEl = el('div', 'lot__salary', blackMarket
        ? '급료 ? — 정체를 알아야 안다'
        : salary > 0 ? `급료 ${salary}골드/라운드` : '급료 없음');
      info.append(nameRow, metaEl, salEl);
      // 짝 시너지 예고 — 이 매물을 사면 같은 역할 짝(전투 레벨 +1)이 완성될 때
      if ((roleCount[merc.role] ?? 0) === 1) {
        info.append(el('div', 'lot__syn', `⚡ 짝 시너지 — 내 ${merc.role}과 짝이 되면 전투 레벨 +1`));
      }
      top.append(info);

      const stepper = el('div', 'lot__stepper');
      const minus = el('button', 'lot__step', '−');
      minus.type = 'button';
      const amount = el('div', 'lot__amount');
      const plus = el('button', 'lot__step', '＋');
      plus.type = 'button';
      stepper.append(minus, amount, plus);

      const locked = !blackMarket && ssrLocked && merc.tier === 'SSR';
      let stepperEl = stepper;
      if (locked) {
        stepperEl = el('div', 'lot__lock', '거물은 2명까지 — 입찰 불가');
        card.append(top, stepperEl);
      } else {
        card.append(top, stepper);
      }

      minus.onclick = () => {
        const cur = bids[lot.lotId] ?? 0;
        if (cur <= 1) delete bids[lot.lotId];
        else bids[lot.lotId] = cur - 1;
        refresh();
      };
      plus.onclick = () => {
        if (player.gold - total() <= 0) return;
        bids[lot.lotId] = (bids[lot.lotId] ?? 0) + 1;
        refresh();
      };

      cards.set(lot.lotId, {
        amount, minus, plus, cardEl: card, locked,
        stepperEl, nameRow, metaEl, salEl, artWrap, merc,
      });
      list.append(card);
    }

    refresh();

    // ── ① 봉인 제출을 기다린다 ──
    await new Promise((resolve) => { submit.onclick = resolve; });
    submit.disabled = true;
    submit.textContent = '⏳ 개봉을 기다리는 중…';
    for (const c of cards.values()) { c.minus.disabled = true; c.plus.disabled = true; }

    // ── 라이벌 고민 연출 (0.8~1.5초) ──
    const alive = aliveOf(game);
    const rivals = alive.filter((p) => p.id !== 'player');
    for (const r of rivals) rivalBar.say(r.id, '…', { hold: 1600 });
    await sleep(800 + Math.random() * 700);

    // ── 해소 — 여기서 게임 상태가 실제로 바뀐다 ──
    const out = resolveFn(bids);
    const { result, reactions, allBids } = out;

    // 선언형 태그(allin/rest/snipe)는 개봉 직전의 외침이다
    let declared = false;
    for (const [rid, tags] of Object.entries(reactions)) {
      for (const t of tags) {
        if (t.type === 'allin' || t.type === 'rest' || t.type === 'snipe') {
          rivalBar.say(rid, LINES[t.type], { hold: 2000 });
          declared = true;
        }
      }
    }
    if (declared) await sleep(fast ? 0 : 1100);

    // ── ② 공개 연출 — 매물별, 낮은 입찰부터 ──
    const fastOn = () => { fast = true; };
    root.addEventListener('click', fastOn);
    submit.textContent = '⚡ 개봉 중 — 탭하면 빨리 감기';

    const wait = (ms) => (fast ? sleep(0) : sleep(ms));
    const awardByLot = new Map(result.awards.map((a) => [a.lotId, a]));

    for (const lot of lots) {
      const c = cards.get(lot.lotId);
      const award = awardByLot.get(lot.lotId);

      // 암시장 — 입찰액을 까기 전에 정체부터 밝힌다. "누구에게 얼마를 썼는가"가 완성되는 순간.
      if (blackMarket) {
        const { merc } = lot;
        const salary = ECON.SALARY[merc.tier] ?? 0;
        c.nameRow.textContent = merc.name;
        c.metaEl.textContent = `${merc.tier} · ${merc.role}`;
        c.salEl.textContent = salary > 0 ? `급료 ${salary}골드/라운드` : '급료 없음';
        c.cardEl.dataset.tier = merc.tier;
        c.cardEl.classList.remove('lot--mystery');
        c.cardEl.classList.add('lot--unmasked');
        await wait(650);
      }

      const reveal = el('div', 'lot__reveal');
      c.cardEl.append(reveal);
      c.cardEl.dataset.open = 'true';

      // 입찰액 오름차순, 불참은 맨 앞. 동액이면 낙찰자가 맨 뒤 — 마지막 줄이 뒤집는 그림.
      const rows = alive
        .map((p) => ({ pid: p.id, amt: allBids[p.id]?.[lot.lotId] ?? 0 }))
        .sort((a, b) => (a.amt - b.amt)
          || (a.pid === award?.winnerId ? 1 : 0) - (b.pid === award?.winnerId ? 1 : 0));

      for (const row of rows) {
        const line = el('div', 'lot__bidrow');
        line.dataset.me = String(row.pid === 'player');
        const who = el('span', 'lot__bidname', nameOf(game, row.pid));
        const amt = el('b', 'lot__bidamt', row.amt > 0 ? `${row.amt}` : '불참');
        amt.dataset.pass = String(row.amt <= 0);
        line.append(who, amt);
        if (award && row.pid === award.winnerId) {
          line.dataset.winner = 'true';
          line.append(el('span', 'lot__bidwin', '낙찰'));
        }
        reveal.append(line);
        await wait(row.amt > 0 ? 480 : 200);
        line.dataset.shown = 'true';
        await wait(row.amt > 0 ? 120 : 0);
      }

      if (!award) {
        const un = el('div', 'lot__unsold', '전원 불참 — 유찰');
        reveal.append(un);
      } else {
        c.cardEl.dataset.won = String(award.winnerId === 'player');
      }
      await wait(420);
    }

    onGoldChange?.();

    // ── 결과 리액션 (won / soClose / snipeVow) ──
    for (const [rid, tags] of Object.entries(reactions)) {
      const r = game.participants.find((p) => p.id === rid);
      for (const t of tags) {
        if (t.type === 'won') {
          rivalBar.say(rid, LINES.won[r.personality] ?? '내 것이다.', { hold: 2600 });
          await wait(500);
        } else if (t.type === 'soClose') {
          rivalBar.say(rid, LINES.soClose[r.personality] ?? '아깝다…!', { hold: 2600 });
          await wait(500);
        }
      }
    }
    // 저격 예고는 마지막에 — 표적이 나면 화면이 흠칫한다
    for (const [rid, tags] of Object.entries(reactions)) {
      for (const t of tags) {
        if (t.type !== 'snipeVow') continue;
        rivalBar.say(rid, `🎯 ${LINES.snipeVow}`, { hold: 3000 });
        if (t.targetId === 'player') {
          document.getElementById('hud')?.classList.remove('hud--aimed');
          void document.getElementById('hud')?.offsetWidth;
          document.getElementById('hud')?.classList.add('hud--aimed');
        }
        await wait(600);
      }
    }

    root.removeEventListener('click', fastOn);
    submit.hidden = true;
    const next = el('button', 'btn', '용병 편성으로 →');
    next.type = 'button';
    foot.append(next);
    await new Promise((resolve) => { next.onclick = resolve; });
    rivalBar.clearBubbles();

    return out;
  }

  return { run };
}
