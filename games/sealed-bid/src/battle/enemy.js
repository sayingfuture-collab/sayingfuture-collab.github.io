// 층 → 적 편성. 새로 만드는 데이터는 없다. 같은 134명에서 뽑는다.
import { CHARACTERS } from '../data/characters.js';

// 곡선 손잡이. 브라우저에는 process가 없어서 항상 기본값이 쓰인다.
// scripts/curve-sweep.js가 이 값을 바꿔가며 돌린다.
const tune = (key, fallback) => Number(globalThis.process?.env?.[key] ?? fallback);

// 수치는 scripts/curve-sweep.js와 scripts/accel-sweep.js로 골랐다.
// 기준은 초보(1렙 균형 파티) 10층 하나로 잡고, 나머지는 곡선이 정하게 둔다.
//
// 지금 층수: 초보 10 · 숙련 24 · 정리직후 32 · 20렙 언저리 69 · 만렙 57
// (만렙이 더 낮은 건 앞줄에 센 전사를 세우면 전투가 길어져 광폭화를 맞기 때문이다)
//
// SSR 고유기(2.75→1.75)와 층 보상(1.75→1.25)이 들어올 때마다 조였고,
// 골드로 20렙까지 올릴 수 있게 되면서 직선만으로는 안 죽어서 가속 항을 붙였다.
const COUNT_EVERY = tune('COUNT_EVERY', 4);     // 몇 층마다 적이 한 명 늘어나는가
const LEVEL_EVERY = tune('LEVEL_EVERY', 1.25);  // 몇 층마다 적 레벨이 1 오르는가
const MAX_ENEMIES = 4;

// 가속. 직선만으로는 센 파티가 안 죽는다.
//
// 파티가 세지면 층수가 그보다 더 빨리 늘어난다 — 층이 늘면 보상을 더 받고,
// 그 보상이 다시 층을 늘리기 때문이다. 실측으로 20렙 언저리 파티가 179층까지 갔다
// (91%가 100층 넘김, 한 판에 20분). 곡선 기울기만 올리면 초보 구간이 같이 죽는다.
//
// 그래서 층수의 제곱으로 붙인다. 10층에서는 +1도 안 되고 100층에서는 +100이 된다.
//
// 100은 훑어서 골랐다. 초보 10층을 지키는 값 중 제일 조인 쪽이다.
// 앞쪽 기울기(LEVEL_EVERY)를 같이 풀어봤지만 이 구간은 가속 항이 이미 먹고 있어서
// 숙련이 24에서 25로밖에 안 움직였다 — 공짜 점심은 없었다.
const ACCEL = tune('ACCEL', 100);

/**
 * 층에서 뽑을 등급을 정한다.
 *
 * 예전에는 15층부터 N이 다시 들어왔다. 그래서 30층에서 N을 만날 수도 SSR을 만날 수도 있어
 * 같은 층인데 적 세기가 2.2배까지 벌어졌다 — 운이 편성보다 커진다. 이제 N은 5층에서 빠진다.
 *
 * 깊은 층에서 R까지 빼봤더니 등급 풀이 바뀌는 층에서 난이도가 1.5배씩 튀었다.
 * 후반 난이도는 등급이 아니라 레벨이 매끄럽게 끌고 간다.
 */
function tiersFor(floor) {
  if (floor <= 4) return ['N', 'R'];
  if (floor <= 15) return ['R', 'SR'];
  return ['R', 'SR', 'SSR'];
}

/**
 * @param {number} floor 1부터
 * @param {() => number} rng
 * @returns {Array<{uid: string, character: object, level: number}>}
 */
export function enemiesFor(floor, rng = Math.random) {
  const count = Math.min(MAX_ENEMIES, 1 + Math.floor(floor / COUNT_EVERY));
  // 머릿수는 4에서 막힌다. 그 뒤로 난이도를 끌고 가는 건 레벨뿐이라
  // 여기가 느리면 후반 곡선이 통째로 평평해진다.
  //
  // 소수를 그대로 쓴다. 정수로 끊으면 레벨이 오르는 층에서만 계단이 생기고
  // 그 사이 층들은 난이도가 똑같아서, 한 층 더 올라가는 맛이 사라진다.
  // 적 레벨은 화면에 안 나오므로 소수라도 문제없다.
  const level = 1 + floor / LEVEL_EVERY + (ACCEL ? (floor * floor) / ACCEL : 0);
  const tiers = tiersFor(floor);

  // 같은 층에 같은 인물이 두 번 서지 않는다.
  // 뽑은 것을 후보에서 빼는 방식이라, rng가 늘 같은 값을 줘도 반드시 끝난다.
  // (다시 뽑는 방식으로 짜면 고정 rng에서 무한 루프에 빠진다)
  const pool = CHARACTERS.filter((c) => tiers.includes(c.tier));
  const picked = [];

  /**
   * 적에 전사를 **반드시 한 명** 섞을지. 0 이면 안 섞는다(옛 동작).
   *
   * ── 왜 재보나 (2026-08-22) ──
   *
   * 적의 45%가 전원 뒷줄이었다. 134명 중 지휘 43·장인 40인데 전사는 23명뿐이라
   * 앞줄이 자주 비기 때문이다. 그래서 **관통이 알맹이를 그대로 쓸어담고**,
   * 포격이 든 편성만 20층 앞섰다.
   *
   * 포격 자체를 약하게 해봤지만 둘 다 실패했다(공격 배수·관통 대가) —
   * **적도 같은 표를 쓰기 때문이다.** 적 포격이 같이 약해지면 물렁한 포격 파티가
   * 반사이익을 본다. 그래서 지렛대를 적 **구성** 쪽으로 옮긴다.
   */
  const NEED_FRONT = Number(globalThis.process?.env?.ENEMY_FRONT ?? 0);

  /** 후보에서 하나 빼서 세운다. **뽑은 것을 빼는 방식이라 고정 rng 에서도 반드시 끝난다** */
  const take = (from) => {
    const i = Math.floor(rng() * from.length);
    const chosen = from.splice(i, 1)[0];
    pool.splice(pool.indexOf(chosen), 1);
    return chosen;
  };

  // 전사를 먼저 한 명. 머릿수가 둘 이상일 때만 — 1명짜리 층까지 전사면 초반이 통째로 단단해진다.
  if (NEED_FRONT && count >= 2) {
    const wall = pool.filter((c) => c.role === '전사');
    if (wall.length) picked.push(take(wall));
  }
  while (picked.length < count && pool.length) picked.push(take(pool));

  return picked.map((character, i) => ({ uid: `e${i}`, character, level }));
}
