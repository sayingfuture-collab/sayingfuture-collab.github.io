// 게임 상태 하나. 라운드·참가자 4명(플레이어+라이벌 3)의 골드·생명·로스터.
// 직렬화 가능해야 한다(세이브 + 시뮬 재현).

import { ECON } from './economy.js';
import { POOL, mercOf } from './pool.js';

/** 로스터 항목: {merc, acquiredRound, price, front} — front는 편성 화면이 정한다 */
const rosterEntry = (merc, round, price) => ({
  mercId: merc.id, merc, acquiredRound: round, price, front: null,
});

/**
 * @param {() => number} rng 시작 로스터 지급에 쓴다
 */
export function createGame(rng) {
  // 시작 지급: N급에서 역할이 다른 2명씩. 4인이 서로 다른 유닛을 받도록 순서대로 소모한다.
  const ns = POOL.filter((c) => c.tier === 'N');
  const remaining = new Set(POOL.map((c) => c.id));

  const participants = [
    { id: 'player', personality: null },
    { id: 'r1', personality: 'miser' },
    { id: 'r2', personality: 'allin' },
    { id: 'r3', personality: 'sniper' },
  ].map((p) => ({
    ...p,
    gold: ECON.START_GOLD,
    lives: ECON.LIVES,
    roster: [],
    streak: 0,
    wonLastRound: false,
    eliminated: false,
    memory: {},
  }));

  // N급 4종 × 4인 → 각자 2명. N을 시장 풀에서 빼고 지급한다(시장에 다시 안 나옴).
  // N이 4종뿐이라 겹치는 건 감수한다 — 지급 목적은 "전투 가능"이지 다양성이 아니다.
  for (const p of participants) {
    const picks = [];
    const shuffled = [...ns].sort(() => rng() - 0.5);
    for (const c of shuffled) {
      if (picks.length >= ECON.START_ROSTER) break;
      if (picks.some((x) => x.role === c.role)) continue;
      picks.push(c);
    }
    for (const c of picks) p.roster.push(rosterEntry(c, 0, 0));
  }
  for (const c of ns) remaining.delete(c.id);

  return {
    round: 1,
    participants,
    remaining,          // 아직 시장에 안 나온 용병 id
    legacy: [],         // 탈락자 유산 매물 (merc 배열)
    playerLastWins: [], // 저격형이 추적하는 플레이어 최근 낙찰 3건
    // 암시장 라운드 — 후보(5~7) 중 시드로 하나. 판마다 위치가 달라야 외워지지 않는다.
    blackMarketRound: ECON.BLACK_MARKET_ROUNDS[
      Math.floor(rng() * ECON.BLACK_MARKET_ROUNDS.length)
    ],
    log: [],
  };
}

export const playerOf = (g) => g.participants[0];
export const rivalsOf = (g) => g.participants.slice(1);
export const aliveOf = (g) => g.participants.filter((p) => !p.eliminated);

/** 낙찰 반영 — 골드 차감 + 로스터 추가 + 저격 추적 갱신 */
export function applyAwards(game, result) {
  const byId = new Map(game.participants.map((p) => [p.id, p]));
  for (const award of result.awards) {
    const p = byId.get(award.winnerId);
    p.gold -= award.price;
    p.roster.push(rosterEntry(award.merc, game.round, award.price));
    if (p.id === 'player') {
      game.playerLastWins.push({ role: award.merc.role, tier: award.merc.tier, price: award.price });
      if (game.playerLastWins.length > 3) game.playerLastWins.shift();
    }
  }
}

/** 세이브 — merc 객체는 id로 접어서 저장한다 */
export function serialize(game) {
  return JSON.stringify({
    ...game,
    remaining: [...game.remaining],
    legacy: game.legacy.map((m) => m.id),
    participants: game.participants.map((p) => ({
      ...p,
      roster: p.roster.map(({ merc, ...rest }) => rest),
    })),
  });
}

export function deserialize(json) {
  const raw = JSON.parse(json);
  return {
    ...raw,
    remaining: new Set(raw.remaining),
    legacy: raw.legacy.map((id) => mercOf(id)),
    participants: raw.participants.map((p) => ({
      ...p,
      roster: p.roster.map((r) => ({ ...r, merc: mercOf(r.mercId) })),
    })),
  };
}
