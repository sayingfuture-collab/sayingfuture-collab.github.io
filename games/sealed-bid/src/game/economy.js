// 경제 상수 전부. 밸런스 조정은 코드가 아니라 이 오브젝트만 만진다 —
// tools/sim.mjs가 이 파일을 그대로 import해서 스윕한다.

export const ECON = {
  START_GOLD: 20,
  START_ROSTER: 2,        // 무료 지급 N급 수 (역할 상이) — 전패해도 전투는 가능해야 한다
  ROUNDS: 12,
  LIVES: 6,   // 5 이하면 라운드 6 전에 탈락이 나온다(시뮬 실측) — 6이면 최소 6라운드는 전원이 산다
  LATE_LIFE_LOSS_FROM: 8, // 이 라운드부터 패배 시 생명 -2
  LATE_LIFE_LOSS: 2,

  INCOME_BASE: 8,         // 파산 방지 바닥 — 항상 지급
  INTEREST_PER: 10,       // 소지금 10골드당 이자 1
  INTEREST_MAX: 4,        // 3에서 올림 — 아끼는 게 정체성인 짠돌이가 승률 10%로 죽어 있었다
  WIN_BONUS: 2,
  STREAK_MAX: 3,          // 연승 보너스 상한

  MIN_BID: 1,             // 0 = 불참
  // 영입 후 라운드당 +1 레벨. 상한은 티어별 — 거물은 이미 완성형이라 성장 여지가 작다.
  // 균일 상한 8일 때 SSR 스노우볼로 올인형 승률 47.7%·SSR 집중도 ×2.01이 나왔다(시뮬 실측).
  LEVEL_CAPS: { N: 8, R: 8, SR: 6, SSR: 4 },

  // 매물 수: 1~2라운드는 팀 구축기라 4명, 이후 3~4명(입찰자 4 > 매물 수 = 경쟁 유발)
  LOTS_EARLY: 4,
  SSR_ROUNDS: [4, 8, 11], // SSR 확정 매물 라운드 — 피크 모먼트

  // AI 가치평가의 티어 기본가. 목표 낙찰가 대역(N1~2 / R3~5 / SR7~10 / SSR12~18)의 닻이다.
  // 실낙찰가는 경쟁 프리미엄이 붙어 이 값의 약 1.4배로 형성된다(200판 실측) — 그래서 대역보다 낮게 잡는다.
  // SSR 앵커 11 → 15: 올인형은 "소지금 비례"로 지르는데 가치파는 앵커대로만 불러서,
  // 앵커가 낮으면 SSR 경매가 경쟁 없이 넘어간다(올인형 승률 47.8% 실측). 경쟁을 만드는 값이다.
  TIER_VALUE: { N: 1.5, R: 3, SR: 6.5, SSR: 15 },

  // 급료 — 용병은 공짜로 안 싸운다. 로스터 1인당 매 라운드 티어별 지출.
  // "골드를 다 써도 불이익이 없으면 전량 지출이 항상 최적"이라는 구조 문제의 해법이다
  // (몰빵 AI 승률 41~52% 실측). 거물일수록 비싸서 몰빵에 지속 비용이 붙는다.
  SALARY: { N: 0, R: 1, SR: 2, SSR: 4 },
  SSR_ROSTER_CAP: 2, // "거물은 서로를 견제한다" — SSR은 로스터에 2명까지. 우승자의 SSR 싹쓸이 방지
  MIN_NET_INCOME: 2, // 급료가 수입을 다 잡아먹지 않는다 — 매 라운드 최소 이만큼은 남는다(파산 방지)

  // 짝 시너지 — 출전 4인 중 같은 역할 2명 이상이면 그 역할 전원 전투 레벨 +1.
  // "같은 매물이 나에게만 더 가치 있는" 상황을 만드는 장치 — 입찰 고민을 한 겹 깊게 한다.
  SYNERGY_LEVEL_BONUS: 1,

  // 정찰 — 봉인 전에 라이벌 1명의 이번 라운드 시트를 몰래 본다. 라운드당 1회.
  SCOUT_COST: 2,

  // 암시장 — 판마다 한 라운드(아래 후보 중 시드로 결정), 역할만 공개하고 이름·티어를 가린다.
  // SSR 라운드(4/8/11)와 안 겹치게 고른 후보다. SSR은 암시장에 안 나온다(보유 상한과 충돌 방지).
  BLACK_MARKET_ROUNDS: [5, 6, 7],
  // 정체 모를 매물의 기대가치 — 시장 잔여 구성(R18/SR8, SSR 제외)의 가중 평균 ≈ 4.1을 내림한 값.
  BLACK_MARKET_EV: 4,
};

/** 라운드 수입. 이자는 "남긴 돈"에 값을 주지만 상한이 있어 사재기가 정답이 되진 않는다. */
export function income(gold, wonLastRound, streak) {
  const interest = Math.min(Math.floor(gold / ECON.INTEREST_PER), ECON.INTEREST_MAX);
  const win = wonLastRound ? ECON.WIN_BONUS : 0;
  const streakBonus = Math.min(Math.max(streak - 1, 0), ECON.STREAK_MAX);
  return ECON.INCOME_BASE + interest + win + streakBonus;
}

/** 이 라운드 패배가 깎는 생명 */
export function lifeLoss(round) {
  return round >= ECON.LATE_LIFE_LOSS_FROM ? ECON.LATE_LIFE_LOSS : 1;
}

/** 영입 라운드 → 현재 레벨. 일찍 산 유닛이 강해진다 — 초반 투자의 정당화 장치 */
export function levelOf(acquiredRound, currentRound, tier = 'R') {
  const cap = ECON.LEVEL_CAPS[tier] ?? 8;
  return Math.min(1 + Math.max(0, currentRound - acquiredRound), cap);
}

/** 라운드 급료 총액 */
export function payroll(roster) {
  return roster.reduce((sum, r) => sum + (ECON.SALARY[r.merc.tier] ?? 0), 0);
}

/** 이번 라운드 매물 수 */
export function lotCount(round, rng) {
  if (round <= 2) return ECON.LOTS_EARLY;
  return 3 + (rng() < 0.5 ? 1 : 0);
}
