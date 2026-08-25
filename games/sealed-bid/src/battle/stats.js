// 인물 + 레벨 → 전투 수치.
// 인물 데이터에는 수치 필드가 없다. tier와 role에서 만들어낸다.

export const BASE_HP = 100;
export const BASE_ATK = 20;
export const LEVEL_STEP = 0.08; // 레벨 1당 붙는 비율

// 레벨 상한. **적에게는 안 걸린다** — 적 레벨은 층수가 끌고 가는 난이도 곡선이라
// 여기서 막으면 게임이 어느 층부터 안 끝난다.
//
// 왜 필요했나: 레벨은 뽑은 장수라서 낮은 등급일수록 빨리 오른다.
// 상한이 없을 때 4,000뽑 지점에서 상위 4자리를 R과 N이 다 차지했다(SSR 0명).
// 등급 한 칸이 레벨 15칸이라, 등급이 낮을수록 뽑기당 능률이 좋았던 탓이다.
// 20에서 막으면 R 20렙(3.28)이 SSR 20렙(5.54) 아래로 제자리를 찾는다.
export const LEVEL_CAP = 20;

// [봉인입찰 재조정] SSR 2.2 → 1.9. 원작은 가챠 수집 게임이라 SSR이 압도적이어야 했지만,
// 이 게임은 슬롯 4칸 경매라 "비싼 1명 > 싼 여럿"이 구조적으로 유리하다 —
// 균일 2.2에서 SSR 몰빵 AI가 승률 52.6%로 지배했다(500판 실측).
// SSR의 특별함은 스탯이 아니라 고유기(skills.js)가 담당한다.
export const TIER_MULT = { N: 1.0, R: 1.3, SR: 1.7, SSR: 1.9 };

// front는 이제 "이 역할을 처음 넣으면 어느 줄에 서는가"라는 제안일 뿐이다.
// 밸런스 훑기용 손잡이. 브라우저에는 process가 없어서 항상 기본값이 쓰인다.
// scripts/formation-sweep.js가 이 값을 바꿔가며 돌린다.
const tune = (key, fallback) => Number(globalThis.process?.env?.[key] ?? fallback);

/**
 * 역할의 뼈대 수치. 실제 앞뒤는 플레이어가 정한다(적은 front 값으로 정한다).
 *
 * ⚠️ **적도 같은 표를 쓴다.** 한쪽만 고치면 그게 곧 밸런스 변경이다.
 *
 * ── 공격 배수를 손잡이로 열어둔 이유 (2026-08-22) ──
 *
 * 통제된 바꿔치기(`tools/balance/role-swap.mjs`)에서 **포격이 든 편성만 20층 앞섰다.**
 * 포격 95~116층 · 포격 없으면 79~91층. 나머지 넷은 서로 12층 안에 촘촘히 모여 있으니
 * 문제는 역할 넷이 아니라 **포격 하나**였다.
 * 수치는 손으로 고르지 않고 `tools/balance/role-tune.mjs` 가 찾는다.
 */
// ⚠️ 손잡이 이름은 **영문만.** 셸이 한글 환경변수 이름을 못 받는다(실제로 걸렸다).
export const ROLE_MULT = {
  전사: { hp: tune('HP_WAR', 2.2), atk: tune('ATK_WAR', 1.0), front: true },
  포격: { hp: tune('HP_ART', 0.6), atk: tune('ATK_ART', 1.8), front: false },
  지휘: { hp: tune('HP_CMD', 0.8), atk: tune('ATK_CMD', 0.8), front: false },
  치유: { hp: tune('HP_HEAL', 0.8), atk: tune('ATK_HEAL', 0.6), front: false },
  장인: { hp: tune('HP_SMITH', 0.9), atk: tune('ATK_SMITH', 0.9), front: false },
};

// 진형. 뒷줄이 기본이고, 앞줄은 방패 노릇을 하는 대신 화력을 내놓는다.
//
// 처음에는 뒷줄에도 공격 보너스(+20%)를 줬는데, 그러면 뒷줄이 전 구간에서 유리해서
// "가능한 한 뒤로"가 정답이 됐다. 보너스를 걷어내니 다섯 진형이 0.2층 안으로 모였다.
// 뒷줄이 받는 값은 "안 맞는다"는 것 하나로 충분하다.
export const ROW_MULT = {
  front: { taken: tune('FRONT_TAKEN', 0.75), atk: tune('FRONT_ATK', 0.8) },
  back:  { taken: 1.0,                       atk: tune('BACK_ATK', 1.0) },
};

/** 줄에 따른 배율 */
export function rowMult(front) {
  return front ? ROW_MULT.front : ROW_MULT.back;
}

/** 이 역할을 처음 편성할 때 기본으로 서는 줄 */
export function defaultFront(character) {
  return ROLE_MULT[character.role]?.front ?? false;
}

/**
 * @param {object} character characters.js의 인물
 * @param {number} level 보유 장수가 곧 레벨
 * @returns {{hp: number, atk: number, front: boolean}}
 */
export function statsOf(character, level = 1) {
  const t = TIER_MULT[character.tier];
  const r = ROLE_MULT[character.role];
  if (t === undefined || r === undefined) {
    throw new Error(`수치를 못 만듦: ${character.id} (${character.tier}/${character.role})`);
  }
  const g = 1 + LEVEL_STEP * (level - 1);
  return {
    hp: Math.round(BASE_HP * t * r.hp * g),
    atk: Math.round(BASE_ATK * t * r.atk * g),
    front: r.front,
  };
}

/**
 * 역할이 실제로 무엇을 하는가. 화면에서 그대로 읽어 쓴다.
 * 규칙을 고치면 여기 문장도 같이 고쳐야 한다 — 설명이 틀리면 진형을 짤 수가 없다.
 */
export const ROLE_SKILL = {
  전사: { name: '도발', text: '앞줄에 서면 앞줄로 오는 공격을 대신 받는다' },
  포격: { name: '관통', text: '적 앞줄을 넘어 뒷줄을 먼저 노린다. 적이 전원 앞줄이면 더 크게 때린다' },
  지휘: { name: '호령', text: '아군 전체 공격력을 조금씩 계속 올린다' },
  치유: { name: '소생', text: '아군을 회복시키고, 한 판에 한 번 쓰러진 아군을 절반 체력으로 되살린다' },
  장인: { name: '축성', text: '아군 전체에 방어막을 친다' },
};
