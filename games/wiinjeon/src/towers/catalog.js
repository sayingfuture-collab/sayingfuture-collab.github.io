// 무지개 탑. **15층 완주형 여덟 개.**
//
// ── 왜 등반과 따로 두나 (2026-08-22) ──
//
// 진형이 결정이 아니었다. 등반은 한 번 정하고 116층을 쭉 가는데 적은 층마다 무작위라,
// 반응할 정보가 없어서 **전역 정답 하나**만 나온다. 위험 층을 끼워 넣어봤지만
// 값을 안 했다(같은 씨앗 200판에 −1층). 빠르게 가는 판에 판단을 억지로 넣은 탓이다.
//
// 그래서 **목적을 갈랐다.**
//   등반 — 「내 팀이 얼마나 센가」. 안 멈추고 ×8배속으로 쭉. 최고 기록.
//   탑   — 「판단으로 이긴다」. 층마다 적을 보고 진형을 고친다. 15층. 골드.
//
// **골드가 탑에서 나오는 이유:** 골드를 반복 수입에 얹으면 「같은 층을 계속 도는 게
// 최적」이 되어 자동사냥 문제가 되살아난다. 탑은 층마다 사람이 붙어야 해서 자동화가
// 안 된다. 그래서 여기서는 팍팍 줘도 노가다가 안 된다.
//
// ── 탑마다 답이 다르다 ──
//
// 색만 다르고 난이도만 오르면 같은 판을 일곱 번 하는 것이다. 그래서 **적 역할을 몰아준다.**
// 실측(40층 언저리, 20렙 4명, 400번씩):
//
//   적 구성      전원 뒷줄  한 명 앞
//   포격 넷        100%      65%    → 줄을 만들면 그 뒤가 관통당한다
//   전사 넷          0%      16%    → 소모전이라 받아줄 사람이 필요하다
//   치유 낀 넷      37%      79%
//
// **전사 탑과 포격 탑의 답이 정반대다.** 여섯 색을 지나며 역할을 하나씩 배우고
// 보라 탑에서 그걸 다 쓴다. 다시 잴 때는 `tools/balance/split-check.mjs`.

import { CHARACTERS } from '../data/characters.js';
import { enterFloor, toEnemy } from '../battle/engine.js';

/** 모든 탑이 15층이다. **끝이 보여야 층마다 멈추는 걸 견딘다** */
export const TOWER_FLOORS = 15;

/** 골드 탑을 하루에 몇 번 도는가. 오래 붙잡지 않으려고 막는다 */
export const GOLD_TOWER_PER_DAY = 1;

/**
 * @typedef {object} Tower
 * @property {string} id     저장에 남는 영구 열쇠. **바꾸지 않는다**
 * @property {string} name
 * @property {string} color  화면에 쓸 색
 * @property {string} mark   목록에 붙는 표시
 * @property {string|null} role 적을 이 역할로 채운다. null 이면 안 몰아준다
 * @property {string} hint   무슨 일이 일어나는지. **정답은 안 적는다**
 * @property {number} base   1층 적 레벨
 * @property {number} step   층마다 오르는 레벨
 * @property {string[]} [tiers] 적을 이 등급에서만 뽑는다
 * @property {number} first  첫 완주 골드
 * @property {number} again  다시 깼을 때 골드
 */

/** @type {Tower[]} */
export const TOWERS = [
  { id: 'red', name: '빨강 탑', color: '#e5534b', mark: '🔴', role: '전사',
    hint: '단단해서 싸움이 길어집니다', base: 6.7, step: 1.52, first: 3000, again: 200 },
  { id: 'orange', name: '주황 탑', color: '#e08b3c', mark: '🟠', role: '포격',
    hint: '포탄이 앞줄을 넘어 뒷줄에 꽂힙니다', base: 4.8, step: 0.97, first: 3500, again: 250 },
  { id: 'yellow', name: '노랑 탑', color: '#d6c035', mark: '🟡', role: '치유',
    hint: '쓰러져도 다시 일어납니다', base: 21, step: 3.3, first: 4000, again: 300 },
  { id: 'green', name: '초록 탑', color: '#3fb950', mark: '🟢', role: '장인',
    hint: '방어막을 두르고 버팁니다', base: 17, step: 2.54, first: 4500, again: 350 },
  { id: 'blue', name: '파랑 탑', color: '#58a6ff', mark: '🔵', role: '지휘',
    hint: '시간이 갈수록 강해집니다', base: 16.6, step: 2.39, first: 5000, again: 400 },
  { id: 'indigo', name: '남색 탑', color: '#7c72e8', mark: '🟣', role: null,
    hint: '무엇이 나올지 모릅니다', base: 17.8, step: 2.49, first: 5500, again: 450 },
  { id: 'violet', name: '보라 탑', color: '#bc8cff', mark: '🟪', role: null, tiers: ['SSR'],
    hint: '이름난 자들만 올라옵니다', base: 11.2, step: 1.53, first: 6500, again: 500 },
  // ⚠️ 일곱 색을 다 깨야 열린다. **여기만 반복해서 도는 자리다.**
  { id: 'gold', name: '황금 탑', color: '#ffd75e', mark: '🏆', role: null, tiers: ['SR', 'SSR'],
    hint: '무지개를 넘은 자에게만 열립니다', base: 18.6, step: 2.44, first: 8000, again: 5000 },
];

export const TOWER_BY_ID = new Map(TOWERS.map((t) => [t.id, t]));
/** 일곱 색. 황금 탑은 여기 안 든다 — 이걸 다 깨야 황금이 열린다 */
export const RAINBOW = TOWERS.filter((t) => t.id !== 'gold');
export const GOLD_TOWER = TOWER_BY_ID.get('gold');

/** 일곱 색을 다 깼는가 */
export function rainbowDone(clears) {
  const has = new Set(clears ?? []);
  return RAINBOW.every((t) => has.has(t.id));
}

/** 지금 들어갈 수 있는 탑인가. 황금 탑만 잠겨 있다 */
export function isOpen(tower, clears) {
  return tower.id !== 'gold' || rainbowDone(clears);
}

/**
 * 그 탑 그 층의 적 레벨. 소수를 그대로 쓴다 — 정수로 끊으면 계단이 생긴다.
 *
 * ⚠️ **base·step 은 손으로 고른 값이 아니다.** 역할마다 세기가 몇 배씩 벌어져서
 * (치유 넷은 사람을 거의 못 죽이고 포격 넷은 종잇장이다) 같은 레벨을 줘도 탑마다
 * 난이도가 딴판이다. `tools/balance/tower-tune.mjs` 가 **목표 완주율에 맞춰 찾아준다.**
 * 수치를 고치고 싶으면 그 파일의 GOAL 표를 고치고 다시 돌릴 것.
 */
export function levelAt(tower, floor) {
  return tower.base + (floor - 1) * tower.step;
}

/** 그 층에 몇 명 나오는가. 등반과 같은 모양이되 15층에 맞춰 빨리 찬다 */
export function countAt(floor) {
  return Math.min(4, 1 + Math.floor(floor / 4));
}

/**
 * 탑의 한 층에 설 적을 만든다.
 *
 * ⚠️ **역할이 모자라면 차는 만큼만 채운다.** 억지로 채우려 들면 인원이 안 차서
 * 층이 헐거워진다 — 치유는 134명 중 몇 안 된다.
 */
export function enemiesForTower(tower, floor, rng = Math.random) {
  const count = countAt(floor);
  const level = levelAt(tower, floor);
  const pool = CHARACTERS.filter((c) => !tower.tiers || tower.tiers.includes(c.tier));
  const picked = [];

  const take = (from) => {
    const i = Math.floor(rng() * from.length);
    const chosen = from.splice(i, 1)[0];
    const at = pool.indexOf(chosen);
    if (at >= 0) pool.splice(at, 1);
    return chosen;
  };

  if (tower.role) {
    // ⚠️ **전부를 그 역할로 채우면 안 된다.** 치유 넷은 사람을 못 죽여서(공격 0.6)
    // 난이도를 레벨로 만들 수가 없다 — 자동 조율이 15층 적 레벨 172를 부르고,
    // 그러면 아무도 안 죽는 무승부 판이 된다. 한 자리를 비워 두면 그 한 명이 위협이 되고,
    // 나머지 셋이 그 탑의 성격을 그대로 만든다.
    const mine = pool.filter((c) => c.role === tower.role);
    const wanted = Math.max(1, count - 1);
    while (picked.length < wanted && mine.length) picked.push(take(mine));
  }
  while (picked.length < count && pool.length) picked.push(take(pool));

  return picked.map((character, i) => ({ uid: `e${i}`, character, level }));
}

/**
 * 탑용 층 세우기. engine.js 의 startFloor 자리에 끼운다.
 *
 * ⚠️ **engine.js 를 안 고친다.** 등반과 탑이 같은 전투 규칙을 쓰되 적을 세우는 곳만
 * 다르다. 엔진에 모드 분기를 넣기 시작하면 어느 규칙이 어디에 걸리는지 못 따라간다.
 *
 * ⚠️ **층 시작 처리는 enterFloor 에 맡긴다.** 여기서 베껴 쓰면 조용히 어긋난다 —
 * 처음에 손으로 적었더니 알렉산더의 원정(층마다 공격력)과 철벽 보상이 통째로 빠졌다.
 */
export function makeTowerFloor(tower) {
  return (state, rng = Math.random) => {
    state.floor += 1;
    enterFloor(state, enemiesForTower(tower, state.floor, rng).map(toEnemy));
  };
}
