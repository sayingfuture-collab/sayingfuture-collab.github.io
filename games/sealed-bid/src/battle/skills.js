// SSR 14명의 고유기.
//
// 지금까지는 세종이든 이순신이든 둘 다 "지휘"라 하는 일이 같았다.
// SSR을 새로 뽑아도 숫자가 좀 큰 애가 하나 느는 것뿐이었다. 여기가 "뽑은 보람"이 나올 자리다.
//
// 두 가지뿐이다 — 몇 턴마다 터지는 것(active)과 늘 걸려 있는 것(passive).
// 인물마다 손으로 규칙을 짜면 검증할 수가 없어서, 효과는 정해진 종류에서 고른다.

/**
 * active: { every, name, effects: [...] }
 *   every  — 이 턱수의 배수 턴에 평소 행동 대신 터진다
 *   effects — aoeDamage | nuke | aoeHeal | aoeShield | aoeBuff | weaken
 *
 * passive: 늘 걸려 있는 규칙. 종류마다 엔진에서 읽는 자리가 다르다.
 *   auraAtk        — 아군 전원 공격력 배수 (편성 시점)
 *   atkPerAllyDown — 아군이 쓰러질 때마다 자기 공격력 증가
 *   healOnKill     — 적을 쓰러뜨리면 최대체력의 이 비율만큼 회복
 *   atkPerFloor    — 층이 오를 때마다 공격력 증가
 *   reviveMax      — 소생 횟수 (기본 1)
 *   revivePct      — 소생 시 돌아오는 체력 비율 (기본 0.5)
 *   pierceBonus    — 관통·밀집 직격 피해 배수
 */
export const SSR_SKILLS = {
  // ── 몇 턴마다 터지는 것 ──
  newton: {
    active: { every: 4, name: '만유인력', effects: [{ kind: 'aoeDamage', pct: 0.85 }] },
  },
  hippocrates: {
    active: { every: 3, name: '해를 끼치지 말 것', effects: [{ kind: 'aoeHeal', pct: 0.18 }] },
  },
  sejong: {
    active: { every: 4, name: '훈민정음', effects: [{ kind: 'aoeBuff', pct: 0.25 }] },
  },
  ganggamchan: {
    active: { every: 4, name: '낙성', effects: [{ kind: 'nuke', pct: 2.4 }] },
  },
  yisun: {
    active: {
      every: 4, name: '학익진',
      effects: [{ kind: 'aoeDamage', pct: 0.6 }, { kind: 'aoeShield', mult: 1.0 }],
    },
  },
  davinci: {
    active: {
      every: 3, name: '만물의 공책',
      // 방어막 배수는 장인 평타(engine.js SHIELD_MULT = 1.5)보다 커야 한다.
      // 1.2로 뒀더니 이미 걸린 평타 방어막을 못 넘어서 고유기의 절반이 죽은 채로 돌았다.
      effects: [{ kind: 'aoeShield', mult: 1.8 }, { kind: 'aoeBuff', pct: 0.1 }],
    },
  },
  jangyeongsil: {
    active: { every: 3, name: '자격루', effects: [{ kind: 'aoeShield', mult: 2.2 }] },
  },
  zhugeliang: {
    active: { every: 4, name: '팔진도', effects: [{ kind: 'weaken', pct: 0.18 }] },
  },

  // ── 늘 걸려 있는 것 ──
  guanyu: {
    passive: { atkPerAllyDown: 0.3 },
    name: '의리',
    text: '아군이 쓰러질 때마다 공격력이 30% 오른다',
  },
  gwanggaeto: {
    passive: { healOnKill: 0.12 },
    name: '정복',
    text: '적을 쓰러뜨릴 때마다 최대 체력의 12%를 회복한다',
  },
  alex: {
    passive: { atkPerFloor: 0.04 },
    name: '원정',
    text: '한 층 오를 때마다 공격력이 4% 오른다',
  },
  khan: {
    passive: { auraAtk: 0.15 },
    name: '대칸',
    text: '아군 전원의 공격력을 15% 올린다',
  },
  wonhyo: {
    passive: { reviveMax: 2, revivePct: 1.0 },
    name: '일체유심조',
    text: '소생을 두 번 쓰고, 되살아난 아군은 체력이 가득 찬다',
  },
  napo: {
    passive: { pierceBonus: 1.5 },
    name: '포병',
    text: '관통과 밀집 직격 피해가 50% 늘어난다',
  },
};

/** 이 인물의 고유기. 없으면 undefined */
export const skillOf = (character) => SSR_SKILLS[character?.id];

/** 상시 능력 값 하나 읽기 */
export function passiveOf(character, key, fallback) {
  return skillOf(character)?.passive?.[key] ?? fallback;
}

/** 화면에 보여줄 고유기 이름과 설명. 없으면 null */
export function skillInfo(character) {
  const s = skillOf(character);
  if (!s) return null;
  if (s.active) {
    return { name: s.active.name, text: describeActive(s.active) };
  }
  return { name: s.name, text: s.text };
}

const EFFECT_TEXT = {
  aoeDamage: (e) => `적 전체에 공격력의 ${Math.round(e.pct * 100)}% 피해`,
  nuke: (e) => `적 하나에 공격력의 ${Math.round(e.pct * 100)}% 피해`,
  aoeHeal: (e) => `아군 전체를 최대 체력의 ${Math.round(e.pct * 100)}%만큼 회복`,
  aoeShield: (e) => `아군 전체에 공격력 ${e.mult}배의 방어막`,
  aoeBuff: (e) => `아군 전체 공격력 +${Math.round(e.pct * 100)}%`,
  weaken: (e) => `적 전체 공격력 -${Math.round(e.pct * 100)}%`,
};

/** 설명을 효과 데이터에서 만든다 — 수치를 고치면 문구도 따라온다 */
function describeActive(active) {
  const parts = active.effects.map((e) => EFFECT_TEXT[e.kind](e));
  return `${active.every}턴마다 ${parts.join(', ')}`;
}
