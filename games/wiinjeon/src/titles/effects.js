// 딴 칭호들의 효과를 합친다. 저장도 화면도 모른다 — 그래야 노드에서 검증할 수 있다.
//
// **단위는 %(정수)다.** 쓰는 쪽에서 100으로 나눈다.

import { TITLE_BY_ID, EFFECT_KEYS } from './catalog.js';

/**
 * 딴 칭호 전부의 효과 합. 모르는 id 는 그냥 무시한다 —
 * 저장이 깨졌다고 파티가 사라지면 안 된다.
 *
 * @param {string[]} ids
 * @returns {{atk: number, hp: number, gold: number, mat: number}} 단위 %
 */
export function sumEffects(ids) {
  const out = { atk: 0, hp: 0, gold: 0, mat: 0 };
  for (const id of ids ?? []) {
    const t = TITLE_BY_ID.get(id);
    if (!t) continue;
    for (const k of EFFECT_KEYS) out[k] += t.effect[k] ?? 0;
  }
  return out;
}

/**
 * 파티에 칭호 효과를 얹는다. **엔진 밖에서** 한 번만 부른다 —
 * `createRun` 직후, `startFloor` 앞.
 *
 * ⚠️ **atk 와 baseAtk 를 같이 올려야 한다.** 줄을 바꾸면 엔진이 baseAtk 에서 atk 를
 * 다시 계산하므로(setRow), 한쪽만 올리면 앞뒤를 한 번 바꾸는 순간 효과가 날아간다.
 * 체력도 같은 이유로 `baseMaxHp` 까지 올린다 — 판 중 보상이 그 값을 기준으로 붙는다.
 *
 * ⚠️ **두 번 부르면 두 번 곱해진다.** 부르는 자리는 screen-battle 의 startRun 하나다.
 *
 * @param {object} run createRun 결과
 * @param {string[]} ids 딴 칭호 id
 */
export function applyTitleBoost(run, ids) {
  const e = sumEffects(ids);
  if (!e.atk && !e.hp) return run;
  const atkMult = 1 + e.atk / 100;
  const hpMult = 1 + e.hp / 100;
  for (const u of run.party) {
    u.atk = Math.round(u.atk * atkMult);
    u.baseAtk = Math.round(u.baseAtk * atkMult);
    const hp = Math.round(u.maxHp * hpMult);
    u.maxHp = hp;
    u.baseMaxHp = hp;
    u.hp = hp;
  }
  return run;
}

/**
 * 전투 보상에 얹는 추가 골드.
 * **난이도 곡선을 안 건드리는 효과라 큰 값을 여기에 몰았다**(총 80%).
 *
 * @param {number} total runReward 의 total
 * @param {string[]} ids 딴 칭호 id
 */
export function goldBonus(total, ids) {
  return Math.round(Math.max(0, total) * sumEffects(ids).gold / 100);
}
