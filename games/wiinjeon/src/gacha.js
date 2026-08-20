import { CHARACTERS } from './data/characters.js';
import { createStore } from './storage.js';

// 등급별 확률. 합은 1. 초반 보정과 무관하게 항상 이 값을 쓴다.
export const RATES = {
  SSR: 0.03,
  SR: 0.12,
  R: 0.65,
  N: 0.20,
};

// 초반 보정 설정
export const EARLY = {
  firstDrawTier: 'SSR', // 1뽑은 이 등급 확정
  window: 20,           // 20뽑까지 보정 구간, 21뽑부터 정상
  excludeFameInR: 'C',  // 보정 구간에서 R 추첨 시 제외할 인지도
};

// 등급별 풀. 같은 등급 안에서는 균등 추첨.
export const POOLS = CHARACTERS.reduce((acc, c) => {
  (acc[c.tier] ||= []).push(c);
  return acc;
}, {});

// 보정 구간에서만 쓰는 R 풀. 원본 POOLS.R은 건드리지 않는다.
const EARLY_R_POOL = POOLS.R.filter((c) => c.fame !== EARLY.excludeFameInR);

/**
 * 이 뽑기에서 그 등급을 어느 풀에서 고르는가.
 *
 * 확률표(rates.js)가 이 함수를 같이 쓴다. 표가 풀을 따로 계산하면
 * 확률을 고쳤을 때 표만 옛날 값을 말하게 된다 — 그건 없느니만 못하다.
 */
export function poolFor(tier, early = false) {
  return early && tier === 'R' ? EARLY_R_POOL : POOLS[tier];
}

// 이름을 남기지 못한 사람들. 인지도(fame) 자체가 없는 등급이라
// fame 유무가 아니라 tier로 판단한다.
export function isAnonymous(character) {
  return character.tier === 'N';
}

// 데이터와 설정이 어긋나면 뽑기 전에 터뜨린다.
{
  const sum = Object.values(RATES).reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 1) > 1e-9) {
    throw new Error(`RATES 합이 1이 아님: ${sum}`);
  }
  for (const tier of Object.keys(RATES)) {
    if (!POOLS[tier]?.length) {
      throw new Error(`${tier} 등급 풀이 비어 있음`);
    }
  }
  if (!POOLS[EARLY.firstDrawTier]?.length) {
    throw new Error(`1뽑 확정 등급 ${EARLY.firstDrawTier} 풀이 비어 있음`);
  }
  if (!EARLY_R_POOL.length) {
    throw new Error('보정용 R 풀이 비어 있음');
  }
}

// ── 뽑기 횟수 저장 ────────────────────────────────────────────
// 브라우저면 localStorage, 아니면(노드·시뮬레이션) 메모리로 떨어진다.

const STORAGE_KEY = 'historyGacha.drawCount';

const raw = createStore(STORAGE_KEY);
const store = {
  get: () => Number(raw.get()) || 0,
  set: (n) => raw.set(String(n)),
};

export function getDrawCount() {
  return store.get();
}

export function setDrawCount(n) {
  store.set(n);
}

export function resetDrawCount() {
  store.set(0);
}

// n번째 뽑기가 보정 구간에 드는지
export function isEarly(drawNumber) {
  return drawNumber <= EARLY.window;
}

// ── 추첨 ─────────────────────────────────────────────────────

// 누적 확률로 등급을 고른다. rng는 [0,1) 반환 함수.
export function pickTier(rng = Math.random) {
  const r = rng();
  let acc = 0;
  for (const [tier, rate] of Object.entries(RATES)) {
    acc += rate;
    if (r < acc) return tier;
  }
  // 부동소수점 오차로 마지막 구간을 넘긴 경우
  return Object.keys(RATES).at(-1);
}

// 몇 번째 뽑기인지 명시해서 뽑는다. 저장소를 건드리지 않는 순수 함수.
export function drawAt(drawNumber, rng = Math.random) {
  const early = isEarly(drawNumber);

  // 1뽑은 등급 확정. 등급 추첨 자체를 건너뛴다.
  const tier = drawNumber === 1 ? EARLY.firstDrawTier : pickTier(rng);

  // 보정 구간의 R만 인지도 C를 뺀 풀에서 고른다. 등급 확률은 그대로.
  const pool = poolFor(tier, early);

  return pool[Math.floor(rng() * pool.length)];
}

// 한 번 뽑기. 저장된 횟수를 읽어 보정을 적용하고 1 올린다.
export function draw(rng = Math.random) {
  const drawNumber = getDrawCount() + 1;
  const character = drawAt(drawNumber, rng);
  setDrawCount(drawNumber);
  return character;
}

// n번 뽑기. 중복 허용. 저장된 횟수가 이어서 올라간다.
export function drawMany(n, rng = Math.random) {
  return Array.from({ length: n }, () => draw(rng));
}
