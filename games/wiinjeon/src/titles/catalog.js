// 칭호 39개. **조건은 비공개다** — 딴 뒤에만 need 를 보여준다.
//
// 판정식(met)은 미리 계산된 문맥 하나만 읽는다. 저장 구조를 직접 뒤지게 두면
// 조건을 하나 더할 때마다 저장 형식을 다시 익혀야 하고, 순수 함수도 아니게 된다.
// 문맥을 만드는 곳은 earn.js 하나뿐이다.
//
// **효과 단위는 %(정수)다.**
//   atk  파티 전원 공격력
//   hp   파티 전원 체력
//   gold 전투 보상
//   mat  강화할 때 재료를 안 쓸 확률
//
// 총합은 atk 52 · hp 55 · gold 64 · mat 28 이고 tests/titles.test.js 가 잠근다.
// ⚠️ **수치를 고치면 그 테스트에서 걸린다. 걸렸다는 건 층수를 다시 재라는 뜻이다**
// (tools/balance/title-noise.mjs).
//
// ── 배분을 한 번 갈아엎었다 (2026-08-21) ──
//
// 처음엔 atk 30 · hp 33 · gold 80 · mat 56 이었다. **골드·재료는 난이도 곡선을
// 안 건드리니 큰 값을 그쪽에 몰자**는 판단이었는데, 그 안전함의 대가가 컸다 —
// 예준님이 134명을 전부 모으고도 **공격력 +3%**를 받았다("세진 느낌이 안 나는데?").
// 이 게임에서 제일 큰 성취인 「위인전」(134명 전원)의 효과가 재료 20이었던 것이다.
// **골드와 재료는 아무리 커도 세진 느낌이 안 난다.** 모으는 속도만 빨라진다.
//
// 그래서 **합계(199)는 그대로 두고 축만 옮겼다.** 전투력을 제약 편성에서 빼오지 않고
// (그건 설계 의도다) 골드·재료에서 가져와 **모으기·키우기**에 얹었다.
// 보통으로 노는 사람이 딸 수 있는 칭호가 곧 전투력이 된다.
//
// 실측(제갈량·다빈치·뉴턴·히포크라테스 20렙 200판): 전부 모으면 73층 → 108층.

export const EFFECT_KEYS = ['atk', 'hp', 'gold', 'mat'];

/**
 * @typedef {object} Title
 * @property {string} id
 * @property {string} name  화면에 보이는 이름
 * @property {string} need  조건 설명. **딴 뒤에만 보여준다**
 * @property {{atk?: number, hp?: number, gold?: number, mat?: number}} effect 단위 %
 * @property {(ctx: object) => boolean} met 판정식. earn.js 의 문맥을 받는다
 */

/** @type {Title[]} */
export const TITLES = [
  // ── 걷기 · 첫날에 뜬다 ──
  { id: 'first-run', name: '첫걸음', need: '판을 한 번 끝낸다',
    effect: { gold: 3 }, met: (c) => c.floor >= 1 },
  { id: 'collect-10', name: '호명', need: '인물 10명 수집',
    effect: { hp: 2 }, met: (c) => c.owned >= 10 },
  { id: 'climb-15', name: '등정', need: '15층 도달',
    effect: { atk: 2 }, met: (c) => c.floor >= 15 },
  { id: 'level-5', name: '문하생', need: '아무 인물이나 5렙',
    effect: { hp: 2 }, met: (c) => c.maxLevel >= 5 },

  // ── 모으기 ──
  { id: 'collect-50', name: '사관(史官)', need: '인물 50명 수집',
    effect: { hp: 4 }, met: (c) => c.owned >= 50 },
  { id: 'collect-ssr', name: '열넷의 이름', need: 'SSR 14명 전원 수집',
    effect: { atk: 6 }, met: (c) => c.counts.SSR >= 14 },
  { id: 'collect-n', name: '무명의 기록', need: 'N등급 16명 전원 수집',
    effect: { hp: 4 }, met: (c) => c.counts.N >= 16 },
  { id: 'collect-sr', name: '스물여덟', need: 'SR 28명 전원 수집',
    effect: { atk: 5 }, met: (c) => c.counts.SR >= 28 },
  { id: 'collect-all', name: '위인전', need: '134명 전원 수집',
    effect: { atk: 8, hp: 8 }, met: (c) => c.owned >= 134 },
  { id: 'dup-30', name: '분신', need: '같은 인물 30장',
    effect: { mat: 8 }, met: (c) => c.maxDup >= 30 },

  // ── 키우기 ──
  { id: 'level-15', name: '대장장이', need: '아무 인물이나 15렙',
    effect: { hp: 4 }, met: (c) => c.maxLevel >= 15 },
  // ⚠️ 'SSR 하나'와 'N 하나'를 나눈 이유: 「아무나 20렙」 하나로 두면 N등급으로 하면
  // 쉽다(N은 20% 확률로 흔하다). 어려운 척하는 쉬운 칭호가 된다.
  { id: 'level-ssr-20', name: '만인지상', need: 'SSR 하나를 20렙(최대)',
    effect: { atk: 6 }, met: (c) => c.levelByTier.SSR >= 20 },
  { id: 'level-n-20', name: '흔한 것의 힘', need: 'N등급 하나를 20렙',
    effect: { hp: 4 }, met: (c) => c.levelByTier.N >= 20 },
  { id: 'party-all-20', name: '전군 만렙', need: '편성 네 명 전부 20렙',
    effect: { atk: 5, hp: 5 }, met: (c) => c.partyAll20 },
  { id: 'upgrade-100', name: '대장간', need: '누적 100번 강화',
    effect: { mat: 8 }, met: (c) => c.totals.upgrades >= 100 },
  { id: 'spend-1m', name: '탕진', need: '누적 100만 골드 사용',
    effect: { gold: 12 }, met: (c) => c.totals.goldSpent >= 1000000 },

  // ── 오르기 ──
  // 제일 센 넷(제갈량·다빈치·뉴턴·히포크라테스 20렙 전원 뒷줄)이 중앙값 74층 / 최대 105층.
  { id: 'climb-30', name: '고지', need: '30층 도달',
    effect: { atk: 3 }, met: (c) => c.floor >= 30 },
  { id: 'climb-65', name: '정상', need: '65층 도달',
    effect: { atk: 4 }, met: (c) => c.floor >= 65 },
  { id: 'climb-90', name: '불세출', need: '90층 도달',
    effect: { gold: 15 }, met: (c) => c.floor >= 90 },

  // ── 제약 걸고 오르기 ──
  // 층수는 전부 **최고 기록** 기준이라 여러 판에 나눠 도전할 수 있다.
  //
  // ⚠️ **여기 id 에는 숫자를 안 넣는다.** 이 층수들은 실측으로 정한 값이라 엔진을
  // 손대면 같이 움직인다 — 층 사이 회복(FLOOR_HEAL)을 넣자마자 여덟 개가 밀렸다
  // (지휘 18→26, 포격 15→20 …). id 는 저장에 남는 영구 열쇠라 바꾸면 딴 칭호가 날아간다.
  // **id 에 박힌 숫자는 첫 조정에서 곧바로 거짓말이 된다.**
  //
  // 기준: 조건 = 그 제약으로 갈 수 있는 **최선의 약 70%**.
  // 다시 잴 때는 `node tools/balance/title-feasible2.mjs`.
  // ⚠️ 역할마다 층수가 다른 이유: 같은 「한 우물」이라도 난이도가 5배 넘게 벌어진다 —
  // 장인 넷 50층, 치유 넷 9층. 하나로 통일하면 장인은 거저고 치유는 불가능해진다.
  { id: 'solo', name: '홀로', need: '1명으로 5층',
    effect: { atk: 5 }, met: (c) => c.totals.bestSolo >= 5 },
  { id: 'duo', name: '양날', need: '2명으로 17층',
    effect: { atk: 2 }, met: (c) => c.totals.bestDuo >= 17 },
  { id: 'trio', name: '소수정예', need: '3명으로 30층',
    effect: { atk: 2 }, met: (c) => c.totals.bestTrio >= 30 },
  { id: 'n-only', name: '이름 없는 자들', need: 'N등급 4명으로 8층',
    effect: { hp: 4 }, met: (c) => c.totals.bestNOnly >= 8 },
  { id: 'lowtier', name: '무명록', need: 'R·N만으로 15층',
    effect: { atk: 2 }, met: (c) => c.totals.bestLowTier >= 15 },
  { id: 'mono-지휘', name: '한 우물 · 지휘', need: '지휘 4명으로 26층',
    effect: { hp: 2 }, met: (c) => c.totals.bestMono.지휘 >= 26 },
  { id: 'mono-장인', name: '한 우물 · 장인', need: '장인 4명으로 36층',
    effect: { hp: 2 }, met: (c) => c.totals.bestMono.장인 >= 36 },
  { id: 'mono-전사', name: '한 우물 · 전사', need: '전사 4명으로 14층',
    effect: { hp: 2 }, met: (c) => c.totals.bestMono.전사 >= 14 },
  { id: 'mono-치유', name: '한 우물 · 치유', need: '치유 4명으로 6층',
    effect: { hp: 2 }, met: (c) => c.totals.bestMono.치유 >= 6 },
  { id: 'mono-포격', name: '한 우물 · 포격', need: '포격 4명으로 20층',
    effect: { hp: 2 }, met: (c) => c.totals.bestMono.포격 >= 20 },
  { id: 'no-healer', name: '의원 없이', need: '치유 없이 50층',
    effect: { atk: 2 }, met: (c) => c.totals.bestNoHealer >= 50 },
  { id: 'all-front', name: '맨 앞에서', need: '전원 앞줄로 41층',
    effect: { hp: 5 }, met: (c) => c.totals.bestAllFront >= 41 },

  // ── 쌓기 ──
  // 한 판에 45~190마리를 잡는다. 1,000은 대략 10판, 10,000은 대략 60판이다.
  { id: 'runs-50', name: '백전', need: '누적 50판',
    effect: { gold: 5 }, met: (c) => c.totals.runs >= 50 },
  { id: 'kills-1000', name: '천 명의 적', need: '누적 1,000 처치',
    effect: { mat: 5 }, met: (c) => c.totals.kills >= 1000 },
  { id: 'kills-10000', name: '십만대군', need: '누적 10,000 처치',
    effect: { gold: 10 }, met: (c) => c.totals.kills >= 10000 },
  { id: 'earn-50k', name: '거상', need: '누적 5만 골드 획득',
    effect: { gold: 8 }, met: (c) => c.totals.goldEarned >= 50000 },
  // ⚠️ 원래 스펙은 「고유기 14종 발동」이었는데 **영원히 못 딴다** —
  // skill 이벤트를 내는 건 액티브 8종뿐이고 상시 6종은 이벤트가 없다.
  // 의도(SSR 14명을 전부 써보게 만든다)는 그대로 두고 판정만 바꿨다.
  { id: 'skills-14', name: '고유기 감상', need: 'SSR 14명을 전부 편성해 싸운다',
    effect: { mat: 7 }, met: (c) => c.totals.ssrUsed.length >= 14 },

  // ── 순간과 운 ──
  // 광폭화 승리는 120판 중 52판에서 일어난다. 10연차에 SSR 2명 이상은 약 3.5%.
  { id: 'rage-win', name: '버티기', need: '광폭화(12턴)를 넘기고 층 승리',
    effect: { hp: 3 }, met: (c) => c.totals.rageWins >= 1 },
  { id: 'ssr-twice', name: '연달아', need: '2연속 SSR 뽑기',
    effect: { gold: 5 }, met: (c) => c.totals.gotBackToBackSSR },
  { id: 'ten-two-ssr', name: '쓸어담기', need: '열 장 뽑기 한 번에 SSR 2명',
    effect: { gold: 6 }, met: (c) => c.totals.gotTwoSSRInTen },
];

export const TITLE_BY_ID = new Map(TITLES.map((t) => [t.id, t]));
export const TITLE_IDS = new Set(TITLES.map((t) => t.id));

/** 화면에 쓸 이름. 모르는 id 는 그대로 돌려준다 — 저장이 깨져도 화면이 안 죽는다 */
export function titleName(id) {
  return TITLE_BY_ID.get(id)?.name ?? id;
}
