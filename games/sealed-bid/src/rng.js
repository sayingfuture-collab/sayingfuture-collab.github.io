// 시드 RNG (mulberry32). 시뮬 재현과 테스트 결정성이 목적이다.
// Math.random을 직접 쓰면 1000게임 시뮬에서 이상 케이스를 다시 볼 방법이 없다.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 문자열 시드도 받는다 — URL ?seed=abc 로 같은 판을 재현할 수 있게 */
export function seedFrom(value) {
  if (typeof value === 'number') return value >>> 0;
  let h = 2166136261;
  for (const ch of String(value)) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
