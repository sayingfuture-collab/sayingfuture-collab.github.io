// 사냥꾼 캐릭터(고양이) — SVG 파츠 조합.
// 근거(CHI 2016, Birk et al.): '직접 만든' 캐릭터여야 동일시→내재동기→플레이 지속이 생긴다.
// 파츠 언락 조건 = 도감 소유 수 — 수집(Completion)과 꾸미기(Design)를 한 루프로 묶는다.

export const SLOTS = ['hat', 'eyes', 'acc'];
export const SLOT_NAME = { hat: '모자', eyes: '눈', acc: '소품' };

// need: 도감에 ★1 이상 카드가 몇 마리면 열리는가. 0 = 처음부터.
export const HUNTER_PARTS = [
  { id: 'hat-none',   slot: 'hat',  name: '맨머리',     need: 0 },
  { id: 'hat-cap',    slot: 'hat',  name: '사냥 모자',  need: 3 },
  { id: 'hat-ribbon', slot: 'hat',  name: '리본',       need: 8 },
  { id: 'hat-crown',  slot: 'hat',  name: '왕관',       need: 18 },
  { id: 'eyes-dot',   slot: 'eyes', name: '또랑또랑',   need: 0 },
  { id: 'eyes-star',  slot: 'eyes', name: '반짝반짝',   need: 5 },
  { id: 'eyes-sleep', slot: 'eyes', name: '나른나른',   need: 10 },
  { id: 'eyes-heart', slot: 'eyes', name: '하트',       need: 15 },
  { id: 'acc-none',   slot: 'acc',  name: '없음',       need: 0 },
  { id: 'acc-net',    slot: 'acc',  name: '잠자리채',   need: 4 },
  { id: 'acc-scarf',  slot: 'acc',  name: '목도리',     need: 12 },
  { id: 'acc-cape',   slot: 'acc',  name: '망토',       need: 20 },
];

export const PART_BY_ID = new Map(HUNTER_PARTS.map((p) => [p.id, p]));

export const DEFAULT_EQUIP = { hat: 'hat-none', eyes: 'eyes-dot', acc: 'acc-none' };

/** 지금 소유 수로 열려 있는 파츠인가 */
export function isUnlocked(id, owned) {
  const p = PART_BY_ID.get(id);
  return !!p && owned >= p.need;
}

/** 장착 상태를 안전하게 정리 — 잠긴 파츠가 장착돼 있으면 기본값으로 */
export function resolveEquip(equipped, owned) {
  const out = { ...DEFAULT_EQUIP };
  for (const slot of SLOTS) {
    const id = equipped?.[slot];
    if (id && PART_BY_ID.get(id)?.slot === slot && isUnlocked(id, owned)) out[slot] = id;
  }
  return out;
}

// ── SVG 렌더 ─────────────────────────────────────────────────
// 조립식: 몸통(공통) + 슬롯별 조각. 문자열이면 어디서든(홈·꾸미기 화면) 그대로 붙일 수 있다.

const HAT_SVG = {
  'hat-none': '',
  // 모자는 귀 사이에 얹힌다 — 고양이 귀를 덮지 않게 폭을 좁게 잡았다
  'hat-cap': '<path d="M22 24 Q45 6 68 24 L68 28 L18 28 L18 25 Z" fill="#4a7c59"/><rect x="18" y="25" width="22" height="5" rx="2" fill="#3a6247"/>',
  'hat-ribbon': '<circle cx="60" cy="20" r="7" fill="#e8638c"/><circle cx="72" cy="18" r="6" fill="#e8638c"/><circle cx="66" cy="20" r="3.5" fill="#c94b73"/>',
  'hat-crown': '<path d="M30 24 L34 11 L45 21 L56 11 L60 24 Z" fill="#f4b942" stroke="#d99a1b" stroke-width="1.5"/>',
};
const EYES_SVG = {
  'eyes-dot': '<ellipse cx="36" cy="46" rx="3.4" ry="4" fill="#222"/><ellipse cx="54" cy="46" rx="3.4" ry="4" fill="#222"/>'
    + '<circle cx="37.2" cy="44.6" r="1.2" fill="#fff"/><circle cx="55.2" cy="44.6" r="1.2" fill="#fff"/>',
  'eyes-star': '<text x="31" y="51" font-size="11">✨</text><text x="49" y="51" font-size="11">✨</text>',
  'eyes-sleep': '<path d="M32 46 Q36 49.5 40 46" stroke="#222" stroke-width="2" fill="none" stroke-linecap="round"/>'
    + '<path d="M50 46 Q54 49.5 58 46" stroke="#222" stroke-width="2" fill="none" stroke-linecap="round"/>',
  'eyes-heart': '<text x="30" y="51" font-size="10">💗</text><text x="48" y="51" font-size="10">💗</text>',
};
const ACC_SVG = {
  'acc-none': '',
  'acc-net': '<line x1="70" y1="52" x2="82" y2="32" stroke="#8a6d3b" stroke-width="3" stroke-linecap="round"/>'
    + '<ellipse cx="85" cy="27" rx="8" ry="9" fill="none" stroke="#8a6d3b" stroke-width="2"/>'
    + '<path d="M79 22 L91 32 M77 27 L93 27 M79 32 L91 22" stroke="#c9b899" stroke-width="1"/>',
  'acc-scarf': '<rect x="31" y="63" width="28" height="7" rx="3.5" fill="#e8630a"/><rect x="49" y="67" width="7" height="12" rx="3" fill="#e8630a"/>',
  'acc-cape': '<path d="M23 66 Q18 88 27 92 L33 70 Z" fill="#7c4ae8"/><path d="M67 66 Q72 88 63 92 L57 70 Z" fill="#7c4ae8"/>',
};

/**
 * 고양이 사냥꾼 SVG 문자열. size는 CSS로 조절하고 여기는 viewBox 고정.
 * 스킨 그림(assets/skins)이 없을 때 나오는 기본 모습이자, 커스텀 조합의 바탕.
 * 파츠가 주인공이 되게 바탕은 심심하게 둔다.
 */
export function hunterSVG(equipped) {
  const e = { ...DEFAULT_EQUIP, ...equipped };
  return (
    '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' +
    // 꼬리 — 몸 뒤에서 살짝 올라온다
    '<path d="M64 80 Q80 78 78 64 Q77 58 71 59" fill="none" stroke="#f2c894" stroke-width="7" stroke-linecap="round"/>' +
    // 몸통 (통통하게)
    '<ellipse cx="45" cy="76" rx="21" ry="16" fill="#f7d9a8"/>' +
    // 귀 (바깥 → 안쪽 분홍)
    '<path d="M28 30 L26 13 L41 23 Z" fill="#f7d9a8" stroke="#e8cfa0" stroke-width="1.5" stroke-linejoin="round"/>' +
    '<path d="M62 30 L64 13 L49 23 Z" fill="#f7d9a8" stroke="#e8cfa0" stroke-width="1.5" stroke-linejoin="round"/>' +
    '<path d="M30 27 L29 18 L37 24 Z" fill="#f7b1a0"/>' +
    '<path d="M60 27 L61 18 L53 24 Z" fill="#f7b1a0"/>' +
    // 얼굴
    '<circle cx="45" cy="44" r="23" fill="#fbe8c8" stroke="#e8cfa0" stroke-width="1.5"/>' +
    // 볼터치
    '<circle cx="30" cy="53" r="4" fill="#f7b1a0" opacity=".7"/><circle cx="60" cy="53" r="4" fill="#f7b1a0" opacity=".7"/>' +
    // 수염
    '<g stroke="#e0c49a" stroke-width="1.2" stroke-linecap="round">' +
    '<line x1="20" y1="50" x2="28" y2="52"/><line x1="20" y1="55" x2="28" y2="55"/>' +
    '<line x1="70" y1="50" x2="62" y2="52"/><line x1="70" y1="55" x2="62" y2="55"/></g>' +
    // 코 + 입 (고양이 ω)
    '<path d="M43 54 L47 54 L45 57 Z" fill="#e88a7d"/>' +
    '<path d="M45 57 Q41.5 60.5 39 57.5 M45 57 Q48.5 60.5 51 57.5" stroke="#b5836b" stroke-width="1.6" fill="none" stroke-linecap="round"/>' +
    (EYES_SVG[e.eyes] || EYES_SVG['eyes-dot']) +
    (HAT_SVG[e.hat] || '') +
    (ACC_SVG[e.acc] || '') +
    '</svg>'
  );
}
