// 한 라운드의 진행 순서. 시뮬(tools/sim.mjs)과 실게임(app.js)이 **같은 함수**를 쓴다 —
// 따로 짜면 시뮬로 맞춘 밸런스가 실게임과 조용히 어긋난다.
//
// 순서: 매물 공개 → 전원 봉인 입찰 → 해소 → 편성 → 페어링 전투 → 생명/탈락 → 수입.
// 플레이어의 입찰·편성만 콜백으로 받는다. 라이벌은 여기서 결정한다.

import { drawLots, mercOf } from './pool.js';
import { resolve } from './auction.js';
import { decideBids, react, valueOf } from './rivals.js';
import { fieldTeam } from './rival-team.js';
import { pairings, setupFight, fightOut, applyLoss, applyWin } from './match.js';
import { applyAwards, aliveOf, playerOf } from './state.js';
import { ECON, income, payroll } from './economy.js';

/** 이번 라운드가 암시장인가 — 매물의 이름·티어가 가려진다 */
export const isBlackMarket = (game) => game.blackMarketRound === game.round;

/** 이번 라운드 매물을 세운다 */
export function openAuction(game, rng) {
  // 암시장에는 유산 매물을 안 태운다(정체가 이미 알려진 용병) — legacy는 다음 라운드로 이월
  const black = isBlackMarket(game);
  const mercs = drawLots(game.remaining, game.round, rng, black ? [] : game.legacy, { blackMarket: black });
  return mercs.map((merc, i) => ({ lotId: `R${game.round}L${i}`, merc }));
}

/**
 * 라이벌들의 이번 라운드 시트를 확정한다. 정찰(플레이어가 봉인 전에 엿보기)을 위해
 * runAuction과 분리했다 — 확정을 미리 해둬야 엿본 값과 실제 제출이 같다.
 * 라운드당 정확히 한 번만 불러야 한다(memory를 소모한다).
 */
export function decideRivalBids(game, lots, rng) {
  const alive = aliveOf(game);
  const rivalBids = {};
  const decideTags = {};
  for (const r of alive) {
    if (r.id === 'player') continue;
    const ctx = {
      lots, round: game.round, playerLastWins: game.playerLastWins,
      blackMarket: isBlackMarket(game),
      participants: game.participants, // 저격형이 표적의 로스터(공개 정보)를 읽는다
    };
    const { bids: sheet, tags } = decideBids(r, ctx, rng);
    rivalBids[r.id] = sheet;
    decideTags[r.id] = tags;
  }
  return { rivalBids, decideTags };
}

/** 정찰 비용을 치른다. 시트 자체는 decideRivalBids의 결과를 보여주면 된다. */
export function payScout(game) {
  const p = playerOf(game);
  if (p.gold < ECON.SCOUT_COST) throw new Error('정찰 비용 부족');
  p.gold -= ECON.SCOUT_COST;
}

/**
 * 입찰을 모아 해소하고 반영한다.
 * @param {Record<string, number>} playerBids 플레이어의 시트 {lotId: 골드}
 * @param {{rivalBids, decideTags}|null} pre decideRivalBids를 미리 불렀다면 그 결과 (정찰 경로)
 * @returns {{result, reactions: Record<string, Array>}} reactions[rivalId] = 리액션 태그
 */
export function runAuction(game, lots, playerBids, rng, pre = null) {
  const alive = aliveOf(game);
  const { rivalBids, decideTags } = pre ?? decideRivalBids(game, lots, rng);
  const bids = { ...rivalBids };
  // 탈락한 플레이어는 시트를 안 낸다 — resolve는 모르는 참가자를 거부한다
  if (alive.some((p) => p.id === 'player')) bids.player = playerBids;

  const result = resolve(lots, bids, alive, rng);
  applyAwards(game, result);

  const reactions = {};
  for (const r of alive) {
    if (r.id === 'player') continue;
    reactions[r.id] = [
      ...(decideTags[r.id] ?? []),
      ...react(r, { ...result, myBids: bids[r.id] }, { round: game.round }),
    ];
  }
  return { result, reactions, allBids: bids };
}

/**
 * 페어링을 만들고 전투를 준비한다. 플레이어 판만 재생용 상태를 돌려주고
 * AI끼리는 즉시 결판낸다.
 * @param {(participant) => Array} teamOf 출전 엔트리를 얻는 방법 (플레이어는 UI 편성)
 * @returns {{playerFight: {state, opponentId}|null, aiResults: Array, bye: string|null}}
 */
export function prepareBattles(game, teamOf, rng) {
  const alive = aliveOf(game);
  const { pairs, bye } = pairings(alive, game.round);
  const byId = new Map(game.participants.map((p) => [p.id, p]));

  let playerFight = null;
  const aiResults = [];
  for (const [aId, bId] of pairs) {
    const a = byId.get(aId); const b = byId.get(bId);
    if (aId === 'player' || bId === 'player') {
      // 플레이어를 항상 A(내 편) 자리에 둔다 — 화면이 왼쪽=나 로 그린다
      const me = aId === 'player' ? a : b;
      const foe = aId === 'player' ? b : a;
      playerFight = { state: setupFight(teamOf(me), teamOf(foe)), opponentId: foe.id };
    } else {
      const out = fightOut(setupFight(teamOf(a), teamOf(b)), rng);
      aiResults.push({ aId, bId, out });
    }
  }
  return { playerFight, aiResults, bye };
}

/**
 * 전투 결과를 반영한다(생명·탈락·유산·수입). 라운드의 마지막 단계.
 * @param {{winnerId, loserId}|null} playerOutcome 플레이어 판 결과 (부전승이면 null)
 */
export function settleRound(game, playerOutcome, aiResults) {
  const byId = new Map(game.participants.map((p) => [p.id, p]));
  const outcomes = [...aiResults.map(({ aId, bId, out }) => ({
    winnerId: out.winner === 'A' ? aId : bId,
    loserId: out.winner === 'A' ? bId : aId,
  }))];
  if (playerOutcome) outcomes.push(playerOutcome);

  for (const { winnerId, loserId } of outcomes) {
    applyWin(byId.get(winnerId));
    const legacy = applyLoss(byId.get(loserId), game.round);
    game.legacy.push(...legacy);
  }

  for (const p of aliveOf(game)) {
    // 수입에서 급료를 뗀다. 단 급료가 수입을 다 잡아먹지는 못한다 —
    // 최소 순수입을 보장해야 다음 경매에 낼 돈이 남는다(급료 도입 직후 파산율 7.5% 실측).
    const inc = income(p.gold, p.wonLastRound, p.streak);
    const pay = Math.min(payroll(p.roster), Math.max(0, inc - ECON.MIN_NET_INCOME));
    p.gold += inc - pay;
  }
  game.round += 1;
}

/** 게임이 끝났는가 — 12라운드 소진 또는 생존자 1명 */
export function isOver(game, maxRounds) {
  return game.round > maxRounds || aliveOf(game).length <= 1;
}

/**
 * 순위 — 생존자(생명→골드 순) 먼저, 탈락자는 **늦게 죽은 순**.
 * 탈락자를 골드로 세우면 3라운드에 부자로 죽은 쪽이 11라운드까지 버틴 쪽을 이긴다 —
 * 서바이벌의 상식(버틴 만큼 순위)과 어긋난다(예준님 실플레이 지적, 2026-08-25).
 * 1위 동률은 finale()로 가린다.
 */
export function standings(game) {
  return [...game.participants].sort((a, b) =>
    (a.eliminated - b.eliminated)
    || (b.eliminatedRound ?? 0) - (a.eliminatedRound ?? 0) // 생존자끼리는 0-0이라 통과
    || (b.lives - a.lives)
    || (b.gold - a.gold));
}

/**
 * 12라운드 종료 시 1위가 생명 동률이면 결전 1판. 골드로 가리면 "아끼는 성격"이
 * 전투 없이 공짜 우승한다(시뮬에서 저격형 승률이 12%로 눌린 원인이었다).
 * @returns {{finalists: [a, b], out}|null} 결전이 없었으면 null
 */
export function finale(game, teamOf, rng) {
  const s = standings(game);
  if (s.length < 2 || s[0].eliminated || s[1].eliminated) return null;
  if (s[0].lives !== s[1].lives) return null;
  const state = setupFight(teamOf(s[0]), teamOf(s[1]));
  const out = fightOut(state, rng);
  const winner = out.winner === 'A' ? s[0] : s[1];
  const loser = out.winner === 'A' ? s[1] : s[0];
  // 결전 결과를 순위에 반영 — 승자를 생명 우위로 만들어 standings가 그대로 읽히게 한다
  winner.lives += 1;
  return { finalists: [winner.id, loser.id], out };
}

/**
 * 시뮬용 그리디 플레이어 대행. AI와 같은 가치평가를 쓰되 배수 1.05, 예비금 10% —
 * "합리적이지만 성격 없는" 기준선이다. 실플레이어 대신 밸런스의 영점을 잡는다.
 */
export function greedyBids(player, lots, round, rng, blackMarket = false) {
  const bids = {};
  let budget = Math.max(0, player.gold - Math.floor(player.gold * 0.1));
  // 암시장에선 프록시도 기대가치로만 본다 — 실제 플레이어가 가진 정보와 같게
  const ctx = { myRoster: player.roster, myLives: player.lives, round, blackMarket };
  const mySsr = player.roster.filter((r) => r.merc.tier === 'SSR').length;
  const ranked = [...lots]
    .map((lot) => ({ lot, v: valueOf(lot.merc, ctx) }))
    .sort((a, b) => b.v - a.v);
  for (const { lot, v } of ranked) {
    if (lot.merc.tier === 'SSR' && mySsr >= ECON.SSR_ROSTER_CAP) continue; // 보유 상한 준수
    const amt = Math.min(Math.max(0, Math.round(v * 1.05 + (rng() * 2 - 1))), budget);
    if (amt >= 1) { bids[lot.lotId] = amt; budget -= amt; }
  }
  return bids;
}
