// 둘이 뽑기 — 판정과 기록. 화면도 뽑기도 모른다. 그래야 노드에서 검증할 수 있다.
//
// 왜 있나: GTM 코어가 「폰 보던 사람한테 "내기하자" 할 거리를 판다」로 섰다.
// 4차 페르소나에서 내기가 성립하는 세 조건(같은 방에 사람·걸 것·둘 다 아는 이름) 중
// 게임이 주는 건 하나뿐이었다. 이 모듈은 「둘이 한 폰으로 뽑고 승자를 가른다」는
// 형태를 게임 안에 넣기 위한 판정부다. 스펙: docs/superpowers/specs/2026-08-23-duel-design.md

import { createStore } from './storage.js';

/** 승패에 쓰는 순서. N(이름 없는 사람들)은 안 센다 — 열 장 중 두 장은 N이라 변별이 안 된다 */
const ORDER = ['SSR', 'SR', 'R'];

/** 10연차 결과를 등급별로 센다 */
export function countTiers(entries) {
  const c = { SSR: 0, SR: 0, R: 0, N: 0 };
  for (const { character } of entries) {
    if (character.tier in c) c[character.tier]++;
  }
  return c;
}

/**
 * SSR → SR → R 순서로 비교. 먼저 갈리는 칸에서 끝.
 * @returns {1|2|0} 1번 승 / 2번 승 / 무승부
 */
export function judge(a, b) {
  for (const t of ORDER) {
    if (a[t] !== b[t]) return a[t] > b[t] ? 1 : 2;
  }
  return 0;
}

// ── 기록 ──────────────────────────────────────────────────
// 판 수와 「한 판 더」 수. **두 번째 판이 일어나는지** 보려고 센다 —
// 이 기능이 코어(내기 걸 거리)를 진짜로 건드리는지 확인하는 유일한 계기판이다.
// 도감 저장(v5)과 키를 나눈다 — 거기 마이그레이션을 건드리지 않기 위해.

const KEY = 'historyGacha.duel.v1';
const store = createStore(KEY);

function read() {
  try {
    const v = JSON.parse(store.get() || '{}');
    return { played: Number(v.played) || 0, rematch: Number(v.rematch) || 0 };
  } catch {
    return { played: 0, rematch: 0 };  // 깨진 저장에 NaN이 돌면 안 된다
  }
}
function write(s) { store.set(JSON.stringify(s)); }

export function getDuelStats() { return read(); }
/** 결과 화면이 뜰 때 한 번 */
export function notePlayed() { const s = read(); s.played++; write(s); return s; }
/** 「한 판 더」를 누를 때 한 번 */
export function noteRematch() { const s = read(); s.rematch++; write(s); return s; }
export function resetDuelStats() { write({ played: 0, rematch: 0 }); }
