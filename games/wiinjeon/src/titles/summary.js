// 한 판을 요약한다. 엔진을 **읽기만 한다.**
//
// ⚠️ 함수가 아니라 그릇인 이유: runTurn 이 돌려주는 이벤트는 **한 턴치**다.
// 여러 턴을 이어 붙이면 턴·층 경계가 사라지는데, 「광폭화를 넘기고 이긴 층」은
// 그 경계가 있어야 셀 수 있다. 그래서 턴마다 받아 접는다.
//
// 상태는 이 그릇 안에만 있다. 전역도 저장도 안 건드린다.

import { RAGE_AFTER } from '../battle/engine.js';

/**
 * @param {Array<{character: object, front: boolean}>} members 이 판의 편성
 * @returns {{turn: (events: Array<object>, run: object) => void,
 *            result: (floor: number) => object}}
 */
export function createRunSummary(members) {
  // 편성은 판 중에 안 바뀌므로 한 번만 접는다.
  const party = {
    size: members.length,
    tiers: members.map((m) => m.character.tier),
    roles: members.map((m) => m.character.role),
    // SSR 14명을 전부 써보게 만드는 조건에 쓴다.
    ssrIds: members.filter((m) => m.character.tier === 'SSR').map((m) => m.character.id),
    allFront: members.length > 0 && members.every((m) => m.front),
  };

  let kills = 0;
  let rageWins = 0;

  return {
    /**
     * 한 턴이 끝날 때마다 부른다. **runTurn 직후에 부를 것** —
     * 그때가 run.turn 과 run.result 가 이 턴을 가리키는 유일한 시점이다.
     */
    turn(events, run) {
      // ⚠️ 이벤트 이름은 'die' 다. 'death' 로 세다가 처치가 0으로 나온 적이 있다.
      // 아군은 p0~p3, 적은 e0~ 라 접두사로 가른다.
      for (const e of events) {
        if (e.t === 'die' && typeof e.who === 'string' && e.who.startsWith('e')) kills += 1;
      }
      // 광폭화를 넘기고 그 층을 이겼는가. 지구전 보상이 걸려 있으면 그만큼 늦게 온다.
      if (run.result === 'floorCleared' && run.turn > RAGE_AFTER + (run.rageDelay ?? 0)) {
        rageWins += 1;
      }
    },

    /** 판이 끝나면 부른다. @param {number} floor 도달 층 (= run.floor - 1) */
    result(floor) {
      return { floor, kills, rageWins, party };
    },
  };
}
