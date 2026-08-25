// 라운드 페어링·전투 실행·생명/탈락 판정. 엔진은 여기서만 호출한다.
//
// 전투는 engine의 1층짜리 판이다: createRun(내 편) → floor=1 → enterFloor(적).
// 무승부(200턴)는 엔진이 모른다 — 여기서 잔여 HP 비율 합으로 가린다.

import { createRun, enterFloor, toEnemy, runTurn, setRow } from '../battle/engine.js';
import { MAX_TURNS_PER_FLOOR } from '../battle/runner.js';
import { ECON, lifeLoss } from './economy.js';
import { applySynergy } from './synergy.js';

/**
 * 4인 → 2쌍 로테이션. 라운드마다 상대가 돌아가고, 3인이면 최저 생명이 부전승.
 * 순서 기반이라 결정적이다(같은 라운드 = 같은 페어링).
 *
 * @param {Array<{id: string}>} alive 탈락 제외 참가자 (원래 순서)
 * @param {number} round
 * @returns {{pairs: Array<[string, string]>, bye: string|null}}
 */
export function pairings(alive, round) {
  const ids = alive.map((p) => p.id);
  if (ids.length <= 1) return { pairs: [], bye: ids[0] ?? null };

  if (ids.length === 2) return { pairs: [[ids[0], ids[1]]], bye: null };

  if (ids.length === 3) {
    // 최저 생명 부전승 (동률이면 순서 앞), 남은 둘이 싸운다
    const byLives = [...alive].sort((a, b) => a.lives - b.lives);
    const bye = byLives[0].id;
    const rest = ids.filter((id) => id !== bye);
    return { pairs: [[rest[0], rest[1]]], bye };
  }

  // 4인: 라운드로 로테이션 — (0-1,2-3) → (0-2,1-3) → (0-3,1-2) 반복
  const r = (round - 1) % 3;
  const P = [
    [[0, 1], [2, 3]],
    [[0, 2], [1, 3]],
    [[0, 3], [1, 2]],
  ][r];
  return { pairs: P.map(([a, b]) => [ids[a], ids[b]]), bye: null };
}

/**
 * 전투 상태를 세운다. UI는 이 상태를 fight-view로 재생하고,
 * 헤드리스는 fightOut()으로 즉시 결판낸다 — 같은 상태, 같은 규칙.
 * @param {Array} entriesA 내 편 (createRun 엔트리)
 * @param {Array} entriesB 상대 편
 */
export function setupFight(entriesA, entriesB) {
  // 짝 시너지는 여기서 양쪽에 한 번씩 — 모든 전투 경로(시뮬·재생·결전)가 이 함수를 지난다
  entriesA = applySynergy(entriesA);
  entriesB = applySynergy(entriesB);
  const state = createRun(entriesA);
  state.floor = 1;
  const enemies = entriesB.map((e, i) =>
    toEnemy({ uid: `e${i}`, character: e.character, level: e.level })
  );
  // toEnemy는 역할 기본 줄로 세운다 — 상대가 정한 진형으로 덮어쓴다 (setRow가 줄 배수까지 처리)
  enemies.forEach((u, i) => setRow(u, entriesB[i].front));
  enterFloor(state, enemies);
  return state;
}

const hpRatio = (units) =>
  units.reduce((a, u) => a + Math.max(0, u.hp), 0) /
  Math.max(1, units.reduce((a, u) => a + u.maxHp, 0));

/**
 * 결판까지 돌린다(헤드리스).
 * @returns {{winner: 'A'|'B', turns: number, draw: boolean, hpA: number, hpB: number}}
 */
export function fightOut(state, rng) {
  let turns = 0;
  while (state.result === 'ongoing' && turns < MAX_TURNS_PER_FLOOR) {
    runTurn(state, rng);
    turns += 1;
  }
  return judge(state, turns);
}

/** 전투가 멈춘 상태에서 승자를 가린다. UI 재생 경로도 이 판정을 그대로 쓴다. */
export function judge(state, turns) {
  const hpA = hpRatio(state.party);
  const hpB = hpRatio(state.enemies);
  if (state.result === 'floorCleared') return { winner: 'A', turns, draw: false, hpA, hpB };
  if (state.result === 'wiped') return { winner: 'B', turns, draw: false, hpA, hpB };
  // 무승부 — 잔여 HP 비율 합이 높은 쪽. 동률이면 A(도전자 이점 없음, 순서일 뿐).
  return { winner: hpA >= hpB ? 'A' : 'B', turns, draw: true, hpA, hpB };
}

/**
 * 패배 반영. 생명이 다하면 탈락 처리하고 유산 매물(전투력 상위 3명)을 반환한다.
 * @returns {Array<object>} 경매로 돌아갈 merc 목록 (없으면 빈 배열)
 */
export function applyLoss(loser, round) {
  loser.lives -= lifeLoss(round);
  loser.streak = 0;
  loser.wonLastRound = false;
  if (loser.lives > 0) return [];
  loser.eliminated = true;
  loser.eliminatedRound = round; // 순위는 "얼마나 버텼는가" — 늦게 죽을수록 위 (standings가 읽는다)
  const legacy = [...loser.roster]
    .sort((a, b) => ECON.TIER_VALUE[b.merc.tier] - ECON.TIER_VALUE[a.merc.tier])
    .slice(0, 3)
    .map((r) => r.merc);
  loser.roster = [];
  return legacy;
}

export function applyWin(winner) {
  winner.streak += 1;
  winner.wonLastRound = true;
}
