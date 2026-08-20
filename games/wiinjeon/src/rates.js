// 확률표. 화면에 보여줄 숫자를 만든다.
//
// 여기서 확률을 다시 정의하지 않는다. gacha.js의 RATES와 poolFor()를 그대로 읽어서 계산한다.
// 표가 자기 나름대로 계산하면 확률을 고쳤을 때 표만 옛날 값을 말하게 되는데,
// 그건 없느니만 못하다. 확률표가 틀리는 건 게임에서 제일 하면 안 되는 거짓말이다.

import { RATES, EARLY, POOLS, poolFor, isEarly } from './gacha.js';
import { CHARACTERS } from './data/characters.js';

export const TIER_ORDER = ['SSR', 'SR', 'R', 'N'];

/**
 * 지금 몇 번째 뽑기인지에 따라 어떤 표가 적용되는가.
 * @param {number} nextDraw 다음에 뽑을 번호 (getDrawCount() + 1)
 */
export function phaseOf(nextDraw) {
  if (nextDraw === 1) return 'first';   // 1뽑 확정
  if (isEarly(nextDraw)) return 'early'; // 보정 구간
  return 'normal';
}

/**
 * 등급별 확률과 인원.
 * @param {boolean} early 보정 구간 기준으로 볼 것인가
 * @returns {Array<{tier: string, rate: number, count: number, each: number}>}
 */
export function tierTable(early = false) {
  return TIER_ORDER.map((tier) => {
    const pool = poolFor(tier, early);
    return {
      tier,
      rate: RATES[tier],
      count: pool.length,
      each: RATES[tier] / pool.length, // 같은 등급 안에서는 균등
    };
  });
}

/**
 * 인물 한 명이 한 번 뽑기에서 나올 확률.
 * 보정 구간에서 풀에 없는 인물은 0이 된다 — 0이라고 정직하게 적는다.
 */
export function rateOf(character, early = false) {
  const pool = poolFor(character.tier, early);
  if (!pool.includes(character)) return 0;
  return RATES[character.tier] / pool.length;
}

/** 인물 전원의 확률. 등급 순 → 이름 순 */
export function characterTable(early = false) {
  return [...CHARACTERS]
    .sort((a, b) => {
      const t = TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier);
      return t !== 0 ? t : a.name.localeCompare(b.name, 'ko');
    })
    .map((c) => ({ character: c, rate: rateOf(c, early) }));
}

/** 보정 구간에 R에서 빠지는 인물 수 */
export function excludedInEarly() {
  return POOLS.R.length - poolFor('R', true).length;
}

/** 보정 설정을 사람이 읽는 문장으로. 설정을 고치면 문장도 같이 바뀐다. */
export function earlyNotes() {
  return [
    `첫 뽑기는 ${EARLY.firstDrawTier} 확정입니다.`,
    `2~${EARLY.window}뽑은 R이 나올 때 덜 알려진 인물 ${excludedInEarly()}명이 후보에서 빠집니다.`
      + ' 등급 확률 자체는 달라지지 않습니다.',
    `${EARLY.window + 1}뽑부터는 위 표 그대로입니다.`,
  ];
}

/** 0.214% 처럼. 아주 작은 값도 0%로 뭉개지 않는다 */
export function pct(v, digits = 3) {
  if (v === 0) return '0%';
  return `${(v * 100).toFixed(digits)}%`;
}
