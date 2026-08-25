// 짝 시너지 — 출전 엔트리 중 같은 역할이 2명 이상이면 그 역할 전원 전투 레벨 +1.
//
// 적용 지점은 match.setupFight 한 곳이다. 시뮬(fieldTeam)·실게임(편성 화면)·결전(finale)이
// 전부 setupFight를 지나가므로 여기 한 번이면 어긋날 길이 없다.
// 레벨 캡(LEVEL_CAPS) **위로** +1을 허용한다 — "전투에서만 붙는 보너스"라는 규칙이 제일 읽기 쉽다.

import { ECON } from './economy.js';

/** 시너지가 켜진 역할 집합 (같은 역할 2명 이상) */
export function synergyRoles(entries) {
  const count = {};
  for (const e of entries) count[e.character.role] = (count[e.character.role] ?? 0) + 1;
  return new Set(Object.keys(count).filter((role) => count[role] >= 2));
}

/**
 * 엔트리에 시너지 레벨을 얹은 사본을 돌려준다. 원본은 건드리지 않는다.
 * @param {Array<{character, level, front}>} entries
 */
export function applySynergy(entries) {
  const on = synergyRoles(entries);
  if (!on.size) return entries;
  return entries.map((e) =>
    on.has(e.character.role) ? { ...e, level: e.level + ECON.SYNERGY_LEVEL_BONUS } : e
  );
}
