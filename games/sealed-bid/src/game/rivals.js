// 라이벌 AI 3성격. 머신러닝이 아니라 규칙 테이블이다 — 테스트할 수 있어야 한다.
//
// 이 게임의 최대 리스크는 "AI가 멍청해 보이는 순간 죽는다"이다. 대응은 수 싸움의 깊이가
// 아니라 **읽히는 성격**이다: 입찰액이 공개될 때 성격이 보이고, 예고가 다음 라운드에
// 실제로 이행되면 사람처럼 보인다. 그래서 결정 함수가 리액션 태그까지 반환한다.

import { ECON } from './economy.js';

export const PERSONALITIES = {
  // 배수는 시뮬 승률(각 15~30% 목표)로 골랐다: 0.7/1.2/1.0 → 7%/40%/12%로 몰빵이 지배해서 조정.
  miser:  { name: '구두쇠 발틴',  mult: 0.9,  reserve: 0.4, emoji: '🪙' }, // 짠돌이 — 저가 줍기
  allin:  { name: '도박꾼 로소',  mult: 1.1,  reserve: 0,   emoji: '🔥' }, // 올인형 — SSR 몰빵
  sniper: { name: '그림자 베일',  mult: 1.2,  reserve: 0.1, emoji: '🎯' }, // 저격형 — 최고가 낙찰자 추적. 저격(웃돈 지불)이 경제적 손해라 기본 입찰력으로 보정(1.05는 12%, 1.25는 과지출로 오히려 10.7% — 실측)
};

/** 내 로스터 기준 매물 가치. 티어 기본가 × 필요도 × 압박 */
export function valueOf(merc, ctx) {
  // 암시장 — 티어가 안 보인다. 전원이 같은 기대가치로만 판단한다(플레이어와 같은 정보).
  let v = ctx.blackMarket ? ECON.BLACK_MARKET_EV : ECON.TIER_VALUE[merc.tier];
  const sameRole = ctx.myRoster.filter((r) => r.merc.role === merc.role).length;
  if (sameRole === 0) v *= 1.4;       // 빈 역할
  else if (sameRole === 1) v *= 1.25; // 짝 완성 — 시너지(같은 역할 2명 = 전투 레벨 +1)가 걸린다
  else v *= 0.7;                      // 이미 넘침 (시너지는 짝이면 충분)
  if (ctx.myRoster.length < 4) v *= 1.3;
  if (ctx.myLives <= 2) v *= 1.3;
  if (ctx.round >= 10) v *= 1.2;      // 골드의 잔존가치 하락 — 아껴봤자 쓸 라운드가 없다
  return v;
}

/**
 * 이 라운드의 입찰 시트를 정한다.
 * @param {object} rival {id, personality, gold, lives, roster, memory}
 *   memory: {restNext?: boolean, snipe?: {targetId, price}|null}
 * @param {object} ctx {lots: [{lotId, merc}], round, playerLastWins, participants, blackMarket}
 * @param {() => number} rng
 * @returns {{bids: Record<string, number>, tags: Array<{type: string, lotId?: string}>}}
 */
export function decideBids(rival, ctx, rng) {
  const P = PERSONALITIES[rival.personality];
  const bids = {};
  const tags = [];
  const reserve = Math.floor(rival.gold * P.reserve);
  let budget = Math.max(0, rival.gold - reserve);

  // 올인형 — 몰빵이 실패한 다음 라운드는 쉰다 (사람이 하는 짓)
  if (rival.personality === 'allin' && rival.memory.restNext) {
    rival.memory.restNext = false;
    return { bids, tags: [{ type: 'rest' }] };
  }

  const myCtx = {
    myRoster: rival.roster, myLives: rival.lives, round: ctx.round, blackMarket: ctx.blackMarket,
  };

  // 저격형 — 표적이 "이번 매물 중 무엇을 제일 원하는가"를 표적의 로스터로 계산한다.
  // 산 것을 따라가면 헛다리다(치유를 산 표적은 다음엔 치유를 안 산다) — 필요를 앞질러야 저격이다.
  // 로스터는 공개 정보(경매가 전부 공개)라 반칙이 아니다.
  let snipe = null; // { lotId, predicted }
  if (rival.personality === 'sniper' && rival.memory.snipe) {
    const target = ctx.participants?.find(
      (p) => p.id === rival.memory.snipe.targetId && !p.eliminated);
    if (target) {
      const tctx = {
        myRoster: target.roster, myLives: target.lives, round: ctx.round, blackMarket: ctx.blackMarket,
      };
      const best = [...ctx.lots]
        .map((l) => ({ l, tv: valueOf(l.merc, tctx) }))
        .sort((a, b) => b.tv - a.tv)[0];
      // 표적이 충분히 아파할 매물(가치 4 이상)에만 웃돈을 쓴다 — 문턱 2에선 미지근한
      // 저격에도 매번 프리미엄이 나가 승률 11.3%로 밀렸다(실측)
      if (best && best.tv >= 4) snipe = { lotId: best.l.lotId, predicted: best.tv };
    }
  }
  const mySsr = rival.roster.filter((r) => r.merc.tier === 'SSR').length;

  // 저격 이행 — 표적의 예상 가치 +1~2. 예고를 지키는 게 지능처럼 보이는 핵심이라
  // **예산을 저격에 먼저 뗀다** (뒤로 미루면 일반 매물이 예산을 먹어 저격가가 3골드로 쪼그라든다 — 실측).
  // 단 자기 기준 가치의 1.5배가 상한 — 표적이 SSR을 17에 샀다고 4골드짜리 매물에 18을
  // 지르면 복수가 아니라 자멸이다(이 상한이 없을 때 승률 12%로 고정됐다).
  if (snipe) {
    const lot = ctx.lots.find((l) => l.lotId === snipe.lotId);
    const okSsr = !(lot.merc.tier === 'SSR' && mySsr >= ECON.SSR_ROSTER_CAP);
    if (okSsr) {
      const vOwn = valueOf(lot.merc, myCtx);
      // "표적 예상가+1"과 "내 평소 입찰" 중 높은 쪽 — 저격 때문에 평소보다 싸게 지르면
      // 그건 저격이 아니라 자해다(이 max가 없을 때 승률 10.6% 실측)
      let amt = Math.min(
        Math.max(Math.round(snipe.predicted + 1 + rng()), Math.round(vOwn * P.mult + noise(rng))),
        Math.round(vOwn * 1.5),
      );
      amt = Math.max(0, Math.min(amt, budget));
      if (amt >= ECON.MIN_BID) {
        bids[lot.lotId] = amt;
        budget -= amt;
        tags.push({ type: 'snipe', lotId: lot.lotId });
        rival.memory.snipe = null; // 복수는 한 번 — 매 라운드 웃돈을 내면 지갑이 먼저 죽는다(승률 10~11% 실측)
      }
    }
  }

  // 가치 높은 매물부터 예산을 배분한다 — 전 매물에 고루 쓰면 다 놓친다.
  const ranked = [...ctx.lots]
    .map((lot) => ({ lot, v: valueOf(lot.merc, myCtx) }))
    .sort((a, b) => b.v - a.v);

  for (const { lot, v } of ranked) {
    if (budget < ECON.MIN_BID) break;
    if (bids[lot.lotId] !== undefined) continue; // 저격으로 이미 배분한 매물
    let amt = 0;

    // SSR 보유 상한 — "거물은 서로를 견제한다". 우승자가 유산 SSR까지 쓸어담는 집중을 자른다.
    if (lot.merc.tier === 'SSR' && mySsr >= ECON.SSR_ROSTER_CAP) continue;

    if (rival.personality === 'allin' && lot.merc.tier === 'SSR') {
      // SSR 몰빵 — 소지금 70~100%
      amt = Math.floor(rival.gold * (0.7 + rng() * 0.3));
      tags.push({ type: 'allin', lotId: lot.lotId });
      rival.memory.allinLot = lot.lotId;
    } else {
      if (rival.personality === 'miser' && lot.merc.tier === 'SSR') {
        // 짠돌이는 SSR을 안 지른다 — 상한 V×0.9
        amt = Math.min(Math.round(v * P.mult + noise(rng)), Math.round(v * 0.9));
      } else {
        amt = Math.round(v * P.mult + noise(rng));
      }
      // 짠돌이의 저가 줍기 — 관심 밖 매물에도 1~2골드를 얹어 유찰 직전 물건을 줍는다
      if (rival.personality === 'miser' && amt < ECON.MIN_BID && budget >= 2) amt = 1 + Math.floor(rng() * 2);
      // 저격형은 관심 없는 매물에 돈을 안 쓴다 — 단 출전 4인을 채우기 전에는 안 가린다.
      // 문턱을 R 가치(3)로 두면 중복 역할 R(3×0.7=2.1)까지 걸러 로스터가 굶는다(승률 12% 실측).
      if (rival.personality === 'sniper' && v < 2 && rival.roster.length >= 4) amt = 0;
    }

    amt = Math.max(0, Math.min(amt, budget));
    if (amt >= ECON.MIN_BID) { bids[lot.lotId] = amt; budget -= amt; }
  }

  return { bids, tags };
}

/**
 * 경매 결과를 보고 기억을 갱신하고 리액션 태그를 낸다.
 * @returns {Array<{type: string, lotId?: string}>} UI가 대사로 바꿔 말풍선에 띄운다
 */
export function react(rival, result, ctx) {
  const tags = [];
  for (const award of result.awards) {
    const myBid = result.myBids?.[award.lotId] ?? 0;
    if (award.winnerId === rival.id) {
      tags.push({ type: 'won', lotId: award.lotId });
    } else if (myBid > 0 && award.price - myBid <= 2) {
      tags.push({ type: 'soClose', lotId: award.lotId }); // 아깝게 짐 — 분한 대사
    }
    // 저격형: 이 라운드 최고가 낙찰자를 표적으로 기억한다 — 플레이어든 라이벌이든.
    // 독주하는 큰손을 시스템이 견제하는 장치이기도 하다. (처리는 루프 뒤에서 한 번)
    // 올인형: 몰빵이 실패했으면 다음 라운드는 휴식
    if (rival.personality === 'allin' && rival.memory.allinLot === award.lotId
        && award.winnerId !== rival.id) {
      rival.memory.restNext = true;
    }
  }
  if (rival.personality === 'sniper') {
    const biggest = result.awards
      .filter((a) => a.winnerId !== rival.id)
      .sort((a, b) => b.price - a.price)[0];
    // 큰 손질(8골드 이상)에만 이를 간다 — 잔돈 낙찰마다 예고하면 저격이 상시 과지출이 된다.
    // 예고가 드물어야 "크게 지르면 표적이 된다"는 위협도 읽힌다.
    if (biggest && biggest.price >= 8) {
      // 표적만 기억한다 — 뭘 노릴지는 다음 라운드 매물을 보고 표적의 필요로 다시 계산한다
      rival.memory.snipe = { targetId: biggest.winnerId, price: biggest.price };
      tags.push({ type: 'snipeVow', targetId: biggest.winnerId });
    }
  }
  rival.memory.allinLot = null;
  return tags;
}

const noise = (rng) => rng() * 2 - 1;
