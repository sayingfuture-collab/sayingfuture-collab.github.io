// 층을 오르는 고리. 화면이 아니라 "보여주는 것"이라는 약속만 안다.
//
// 화면에 박아두면 검증할 방법이 브라우저를 눈으로 보는 것뿐인데,
// 예전에 22층에서 전멸하고 아무것도 안 나온 사고가 정확히 이 순서 문제였다.
// 여기 떼어놓으면 노드에서 가짜 화면으로 순서를 확인할 수 있다.

import { startFloor, runTurn } from './engine.js';

export const MAX_TURNS_PER_FLOOR = 200;

/**
 * 전멸하거나 그만둘 때까지 층을 오른다.
 *
 * @param {object} run createRun + startFloor를 마친 상태
 * @param {{
 *   play: (events: Array<object>) => Promise<boolean>,   // 다 보여줬으면 true
 *   sync: (run: object) => void,
 *   setup: (run: object) => void,                         // 다음 층을 세운다
 *   betweenFloors?: (run: object) => Promise<boolean>,    // 층 사이. 계속하면 true
 * }} view
 * @param {() => boolean} stopped 그만두라는 신호
 * @param {number} [maxTurns] 한 층에서 결판이 안 날 때 끊는 턴 수
 * @returns {Promise<number|null>} 도달한 층. 화면이 갈아엎혀 중단됐으면 null
 */
export async function climb(run, view, stopped, maxTurns = MAX_TURNS_PER_FLOOR) {
  let turnsThisFloor = 0;

  // 지금까지 깬 층. 이미 이룬 기록이라 그만두더라도 남긴다 —
  // 죽을 때까지 버텨야만 기록이 남는 규칙이면 "여기서 멈추기"가 선택지가 못 된다.
  const cleared = () => run.floor - 1;

  while (run.result === 'ongoing') {
    if (stopped()) return cleared();

    const events = runTurn(run);
    turnsThisFloor += 1;

    // 엔진은 이미 한 턴을 다 계산해놓고 끝났다. 화면이 뒤따라가는 동안 기다린다.
    const finished = await view.play(events);
    // 재생이 끊긴 건 사람의 선택이 아니라 화면이 갈아엎힌 것이다. 기록을 남기지 않는다.
    if (!finished) return null;
    if (stopped()) return cleared();

    view.sync(run);

    if (run.result === 'floorCleared') {
      startFloor(run); // 다음 층 적을 세운다. 아직 싸우지는 않는다

      // 층 사이 — 다음 층 적을 보고 앞뒤를 바꿀 수 있다.
      // 적을 미리 못 보고 편성하면 진형이 결정이 아니라 한 번 찍고 마는 설정이 된다.
      if (view.betweenFloors) {
        const go = await view.betweenFloors(run);
        if (go === null) return null;   // 화면이 갈아엎힘
        if (go === false) return cleared(); // 여기서 멈추기
      }

      turnsThisFloor = 0;
      view.setup(run);
      continue;
    }
    // 마지막으로 깬 층이 기록이다. 지금 층은 못 깼다.
    if (run.result === 'wiped') return cleared();
    if (turnsThisFloor >= maxTurns) return cleared();
  }
  return cleared();
}
