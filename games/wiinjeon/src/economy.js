// 경제 수치. 상태도 DOM도 모른다 — 그래야 노드에서 검증할 수 있다.
//
// 값이 흩어져 있으면 조일 때 놓친다. 지금까지 밸런스를 다섯 번 조였고
// 그때마다 한 군데만 보면 되게 하려고 여기 모았다.

/** 뽑기 1회 값. 뽑기권이 있으면 권이 먼저 나간다 */
export const PULL_COST = 30;

/** 처음 들어온 사람에게 주는 것 */
export const STARTER_GOLD = 5000;
export const STARTER_TICKETS = 200;

/**
 * **한 번 돌린 저장 정리에서만 쓰는 환산율이다. 뽑기는 골드를 주지 않는다.**
 *
 * 레벨을 장수에서 떼어내는 순간 이미 모은 카드가 전부 무의미해지므로,
 * 그걸 골드로 바꿔주려고 만든 표다. 4,000뽑·69층인 사람이 정리 뒤에도
 * 69층짜리 파티(4명 16렙 = 49,600골드)를 세울 수 있어야 한다는 조건 하나로
 * **역산됐다.** 밸런스를 보고 정한 값이 아니다. 바꾸면 스펙의 정리 표가 틀어진다.
 *
 * ⚠️ 이 표가 한때 `recordPull`에도 붙어 있어서 뽑을 때마다 골드가 들어왔다.
 * 일회성 환산율이 상시 규칙으로 눌러앉은 것이고, 스펙 어디에도 그럴 이유가
 * 적혀 있지 않았다(2026-08-20 확인 후 제거). **이름에 migration을 박아두는 것은
 * 다음에 또 같은 자리에 붙는 걸 막기 위해서다.**
 */
export const MIGRATION_CARD_GOLD = { SSR: 60, SR: 20, R: 7, N: 2 };

/** 깬 층 1층당 */
export const FLOOR_GOLD = 2;
/** 최고 기록을 1층 깰 때마다 */
export const RECORD_GOLD = 200;

/**
 * 1렙 올리는 데 드는 재료 카드. 같은 등급이면 아무 카드나 된다.
 *
 * 등급별로 따로 노는 게 요점이다 — SSR은 SSR 카드로만 올라간다.
 * 아무 카드나 되게 하면 4,000장 중 76장만 쓰여서 재료가 아무 제약도 안 되고,
 * 같은 인물 카드만 되게 하면 SSR이 8렙에 묶여 SR한테 밀린다(3.43 vs 3.88).
 */
export const MATERIAL_PER_LEVEL = 1;

/** level에서 level+1로 올리는 값. **등급을 받지 않는다** */
export function upgradeCost(level) {
  return 10 * level * level;
}

/** 1렙에서 toLevel까지 올리는 데 드는 누적 */
export function totalUpgradeCost(toLevel) {
  let sum = 0;
  for (let L = 1; L < toLevel; L++) sum += upgradeCost(L);
  return sum;
}

/**
 * 저장 정리에서 그 등급 카드 1장을 얼마로 쳐주는가.
 * 모르는 등급은 0 — 저장이 깨져도 NaN이 돌면 안 된다.
 *
 * **뽑기에서 부르면 안 된다.** 위 상수 주석 참고.
 */
export function migrationCardGold(tier) {
  return MIGRATION_CARD_GOLD[tier] ?? 0;
}

export function pullCost(n) {
  return PULL_COST * n;
}

/**
 * 한 판이 끝났을 때 받는 골드.
 * 같은 판을 반복하면 거의 안 준다 — 기록을 깨야 번다.
 *
 * @param {number} cleared 깬 층수 (최고 기록에 올라가는 그 숫자)
 * @param {number} prevBest 이 판 전의 최고 기록
 */
export function runReward(cleared, prevBest) {
  const floor = Math.max(0, cleared) * FLOOR_GOLD;
  const record = Math.max(0, cleared - prevBest) * RECORD_GOLD;
  return { floor, record, total: floor + record };
}
