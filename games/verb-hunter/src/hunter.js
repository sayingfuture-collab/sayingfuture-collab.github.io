// 사냥꾼 캐릭터 — SVG 파츠 조합.
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
  'hat-cap': '<path d="M20 26 Q40 8 60 26 L60 30 L14 30 L14 27 Z" fill="#4a7c59"/><rect x="14" y="27" width="20" height="5" rx="2" fill="#3a6247"/>',
  'hat-ribbon': '<circle cx="28" cy="20" r="7" fill="#e8638c"/><circle cx="44" cy="20" r="7" fill="#e8638c"/><circle cx="36" cy="22" r="4" fill="#c94b73"/>',
  'hat-crown': '<path d="M22 28 L26 14 L36 24 L46 14 L50 28 Z" fill="#f4b942" stroke="#d99a1b" stroke-width="1.5"/>',
};
const EYES_SVG = {
  'eyes-dot': '<circle cx="29" cy="46" r="3.2" fill="#222"/><circle cx="47" cy="46" r="3.2" fill="#222"/>',
  'eyes-star': '<text x="24" y="51" font-size="11">✨</text><text x="42" y="51" font-size="11">✨</text>',
  'eyes-sleep': '<path d="M25 46 Q29 49 33 46" stroke="#222" stroke-width="2" fill="none"/><path d="M43 46 Q47 49 51 46" stroke="#222" stroke-width="2" fill="none"/>',
  'eyes-heart': '<text x="23" y="51" font-size="10">💗</text><text x="41" y="51" font-size="10">💗</text>',
};
const ACC_SVG = {
  'acc-none': '',
  'acc-net': '<line x1="62" y1="44" x2="76" y2="24" stroke="#8a6d3b" stroke-width="3"/><ellipse cx="79" cy="19" rx="8" ry="9" fill="none" stroke="#8a6d3b" stroke-width="2"/><path d="M73 14 L85 24 M71 19 L87 19 M73 24 L85 14" stroke="#c9b899" stroke-width="1"/>',
  'acc-scarf': '<rect x="24" y="60" width="28" height="7" rx="3.5" fill="#e8630a"/><rect x="42" y="64" width="7" height="12" rx="3" fill="#e8630a"/>',
  'acc-cape': '<path d="M16 62 Q12 84 20 88 L26 66 Z" fill="#7c4ae8"/><path d="M60 62 Q64 84 56 88 L50 66 Z" fill="#7c4ae8"/>',
};

/**
 * 사냥꾼 SVG 문자열. size는 CSS로 조절하고 여기는 viewBox 고정.
 * 몸통은 단순한 콩 모양 — 파츠가 주인공이 되게 바탕은 심심하게 둔다.
 */
export function hunterSVG(equipped) {
  const e = { ...DEFAULT_EQUIP, ...equipped };
  return (
    '<svg viewBox="0 0 90 92" xmlns="http://www.w3.org/2000/svg">' +
    // 몸통
    '<ellipse cx="38" cy="72" rx="20" ry="16" fill="#f7d9a8"/>' +
    // 얼굴
    '<circle cx="38" cy="44" r="22" fill="#fbe8c8" stroke="#e8cfa0" stroke-width="1.5"/>' +
    // 볼터치
    '<circle cx="24" cy="53" r="3.5" fill="#f7b1a0" opacity=".7"/><circle cx="52" cy="53" r="3.5" fill="#f7b1a0" opacity=".7"/>' +
    // 입
    '<path d="M34 56 Q38 59 42 56" stroke="#b5836b" stroke-width="1.8" fill="none" stroke-linecap="round"/>' +
    (EYES_SVG[e.eyes] || EYES_SVG['eyes-dot']) +
    (HAT_SVG[e.hat] || '') +
    (ACC_SVG[e.acc] || '') +
    '</svg>'
  );
}
