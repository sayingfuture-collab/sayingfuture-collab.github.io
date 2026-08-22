// 선물. **모든 사람에게 한 번씩 주는 골드다.**
//
// 치트(cheat.js)와는 다른 물건이다 — 치트는 나만 쓰는 뒷문이고, 이건 공지에 가깝다.
// 그래서 기록도 게임 저장 **안에** 둔다. 치트 기록은 밖에 있다(되돌려도 남아야 하니까).
//
// ⚠️ **한 번 낸 선물의 id 는 절대 안 바꾼다.** 받았는지를 id 로 기억하기 때문에,
// 이름을 고치는 순간 이미 받은 사람에게 다시 뜬다. 문구를 고치고 싶으면 문구만 고친다.
//
// ⚠️ **저장 형식 번호(ECONOMY_VERSION)는 안 올렸다.** 새 항목 giftsTaken 은 없으면
// 빈 배열로 떨어지는 게 정확히 맞는 동작이라(옛 저장 = 아직 못 받음) 단계를 더할 게 없다.
// 단계는 「옛 값을 새 값으로 바꿔야 할 때」만 는다.

/**
 * @typedef {object} Gift
 * @property {string} id    저장에 남는 영구 열쇠. **바꾸지 않는다**
 * @property {number} gold
 * @property {string} title
 * @property {string[]} body 줄 단위. 두루마리 폭이 좁아서 문단을 손으로 끊는다
 */

/** @type {Gift[]} */
export const GIFTS = [
  {
    id: 'welcome-100k',
    gold: 100000,
    title: '플레이해주셔서 감사합니다',
    body: [
      '십만 골드를 드립니다.',
      '앞으로도 재밌게 플레이해주세요.',
    ],
  },
  // ⚠️ **이건 공지 노릇도 한다.** 진형 규칙이 바뀌어서 전원 뒷줄로 놀던 사람은
  // 갑자기 층수가 내려간다(실측 78층 → 62층). 편성 화면에 경고를 달아뒀지만
  // 그건 편성을 열어봐야 보인다 — 접속하자마자 알려줄 자리가 여기뿐이다.
  {
    id: 'tower-open',
    gold: 3000,
    title: '탑이 열렸습니다',
    body: [
      '무지개 탑 일곱 개와',
      '황금 탑이 생겼습니다.',
      '',
      '앞줄이 비면 적 포격에',
      '크게 맞도록 바뀌었습니다.',
      '한 명은 앞에 세우세요.',
    ],
  },
];

export const GIFT_BY_ID = new Map(GIFTS.map((g) => [g.id, g]));

/**
 * 아직 안 받은 선물 중 **제일 앞의 것 하나**.
 *
 * 여러 개를 한꺼번에 안 띄우는 이유: 두루마리가 연달아 내려오면 「받기」를 연타하게 되고,
 * 그러면 무엇을 받았는지 아무도 안 읽는다. 하나씩, 다음 접속에 그 다음 것.
 *
 * @param {string[]} taken 받은 id 목록
 * @returns {Gift|null}
 */
export function pendingGift(taken) {
  const has = new Set(Array.isArray(taken) ? taken : []);
  return GIFTS.find((g) => !has.has(g.id)) ?? null;
}
