// 날짜 시드 — 서버 없이 전 세계가 같은 문제를 푼다 (풍선빵에서 검증된 방식).
// KST 자정에 문제가 바뀐다. 같은 날짜 = 같은 시드 = 같은 문제.

export function hashStr(s) {
  let h = 1779033703;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// KST 기준 날짜 문자열 'YYYY-MM-DD' — 폰 시간대가 어디든 한국 자정에 리셋.
export function kstStamp(now = new Date()) {
  const kst = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + 9 * 3600000);
  const y = kst.getFullYear();
  const m = String(kst.getMonth() + 1).padStart(2, '0');
  const d = String(kst.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const EPOCH = '2026-08-28'; // 1회차 날짜

export function puzzleNumber(stamp = kstStamp()) {
  const ms = Date.parse(stamp + 'T00:00:00Z') - Date.parse(EPOCH + 'T00:00:00Z');
  return Math.round(ms / 86400000) + 1;
}

export function rngFor(tag, stamp) {
  return mulberry32(hashStr(`daily-en-${tag}-${stamp}`));
}

// 시드 셔플에서 앞 n개 — 같은 날 같은 결과, 중복 없음
export function pickN(arr, n, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, Math.min(n, a.length));
}

export function shuffled(arr, rng) {
  return pickN(arr, arr.length, rng);
}
