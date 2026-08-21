// 칭호 검사를 부르는 자리. 저장과 순수 함수 사이를 잇는 유일한 곳이다.
//
// ⚠️ **부르는 자리를 세지 않는다.** app.js 가 onSaveChange 에 걸어두면
// 저장이 바뀔 때마다 무조건 돈다. 골드 갱신에서 부르는 자리를 세다가
// 강화와 전투 보상에서 빠뜨린 적이 있다.
//
// 무한 고리가 안 나는 이유: grantTitles 가 저장을 바꾸면 검사가 한 번 더 도는데,
// earn 이 이미 딴 것을 다시 안 주므로(tests/titles.test.js 가 잠근다) 두 번째는
// 빈 목록이고 저장을 안 건드린다. 거기서 멈춘다.

import { earn } from './earn.js';
import { getTotals, getSave, getTitles, grantTitles } from '../storage.js';

/**
 * 아직 안 보여준 새 칭호.
 * **저장하지 않는다** — 새로고침하면 알림만 놓치고 칭호는 그대로 남는다.
 * 여기 대기줄을 두는 이유는 검사가 저장 신호로 돌아서, 화면이 「내가 부른 검사」의
 * 결과를 받는다는 보장이 없기 때문이다. 누가 땄든 대기줄에 모인다.
 */
let queue = [];

/**
 * 지금 저장으로 칭호를 검사하고 기록한다.
 * @returns {string[]} 이번에 새로 딴 id
 */
export function checkTitles() {
  const got = earn(getTotals(), getSave(), getTitles());
  if (got.length) {
    grantTitles(got);
    queue.push(...got);
  }
  return got;
}

/** 아직 안 보여준 새 칭호를 가져간다(대기줄을 비운다) */
export function takeTitleNews() {
  const out = queue;
  queue = [];
  return out;
}
