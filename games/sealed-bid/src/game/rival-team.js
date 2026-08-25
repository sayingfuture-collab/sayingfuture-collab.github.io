// 라이벌 로스터 → 출전 4인 + 진형. 사람이 안 고르는 쪽의 자동 편성이다.
//
// 규칙은 단순하게: 레벨 반영 전투력(티어×레벨) 높은 순 4명, 진형은 역할 기본값
// (전사 앞줄, 나머지 뒷줄). 단 앞줄이 0이면 가장 단단한 1명을 앞줄로 끌어낸다 —
// 앞줄 전멸 노출 배수(×1.3)를 그대로 맞는 편성은 AI가 멍청해 보이는 지름길이다.

import { TIER_MULT, defaultFront } from '../battle/stats.js';
import { levelOf } from './economy.js';

/**
 * @param {Array<{merc, acquiredRound, front}>} roster
 * @param {number} round
 * @returns {Array<{character, level, front}>} createRun에 그대로 넣는 엔트리
 */
export function fieldTeam(roster, round) {
  const scored = roster.map((r) => {
    const level = levelOf(r.acquiredRound, round, r.merc.tier);
    return { r, level, power: TIER_MULT[r.merc.tier] * (1 + 0.08 * (level - 1)) };
  });
  scored.sort((a, b) => b.power - a.power);
  const picked = scored.slice(0, 4);

  const entries = picked.map(({ r, level }) => ({
    character: r.merc,
    level,
    front: r.front ?? defaultFront(r.merc),
  }));

  if (entries.length && !entries.some((e) => e.front)) {
    // 체력 배수가 가장 높은 역할을 앞줄로. 전사가 없으면 장인(0.9)이 보통 걸린다.
    const hpOrder = { 전사: 5, 장인: 4, 지휘: 3, 치유: 2, 포격: 1 };
    entries.sort((a, b) => hpOrder[b.character.role] - hpOrder[a.character.role]);
    entries[0] = { ...entries[0], front: true };
  }
  return entries;
}
