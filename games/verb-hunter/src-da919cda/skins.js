// 완성형 스킨 — 그림 한 장이 통째로 캐릭터(고양이 사냥꾼)인 옷.
// 커스텀 조합(hunter.js)과 나란히 가는 두 번째 축. 서로 다른 재화를 쓴다:
//  · 커스텀 조합 = 도감 진행도로 자동 해금. 자기표현이라 값을 매기지 않는다
//    (표현에 값을 붙이면 "직접 만든 캐릭터" 애착이 외적 동기로 바뀐다 — CHI 2016)
//  · 완성 스킨   = 🐾 발자국으로 구매. 원래 '상품' 성격이라 팔아도 자연스럽다
//
// 값은 스킨마다 정하지 않고 **등급 4개로만** 정한다. 값이 제각각이면 비싼 이유를
// 매번 설명해야 하지만, 등급은 색만 봐도 "저건 센 거"가 읽힌다.
// 자물쇠는 따로 없다 — 가격이 곧 진행 속도다. 레전드가 비싸면 알아서 늦게 온다.
//
// 그림 파일은 assets/skins/<id>.png. 아직 없으면 커스텀 SVG로 자동 대체된다
// (파일이 없어도 게임이 절대 안 깨지게 — 그림은 나중에 채워 넣는다).

export const GRADES = {
  normal: { name: '노멀',   price: 20,  color: '#78909c' },
  rare:   { name: '레어',   price: 60,  color: '#42a5f5' },
  epic:   { name: '에픽',   price: 140, color: '#7e57c2' },
  legend: { name: '레전드', price: 300, color: '#e8930a' },
};

export const SKINS = [
  { id: 'skin-basic',  name: '새내기 사냥꾼', grade: 'normal', free: true,
    line: '첫 장비를 받았다. 아직은 평범하지만, 여기서 시작한다.' },
  { id: 'skin-scout',  name: '숲 정찰대',     grade: 'normal',
    line: '숲이 눈에 익었다. 이제 어디에 숨는지 안다.' },
  { id: 'skin-night',  name: '달빛 사냥꾼',   grade: 'rare',
    line: '어두운 문장 속에서도 동사가 보이기 시작했다.' },
  { id: 'skin-storm',  name: '폭풍 사냥꾼',   grade: 'epic',
    line: '문장이 통째로 읽히는 순간이 왔다.' },
  { id: 'skin-crown',  name: '도감의 주인',   grade: 'epic',
    line: '네가 모르는 동사보다 아는 동사가 훨씬 많아졌다.' },
  // 레전드만 영상 컷씬을 쓴다 — 300발자국 모아야 나오는 '평생 한 번' 장면이라
  // 여기서만 영상이 나와야 특별해진다. 나머지에 다 넣으면 두 번째부터 지루해지고
  // 폰 로딩만 무거워진다. 파일이 없으면 그냥 지금 연출로 뜬다.
  { id: 'skin-legend', name: '전설의 사냥꾼', grade: 'legend', video: true,
    line: '문장 속 모든 동사가 네 이름을 안다.' },
];

export const SKIN_BY_ID = new Map(SKINS.map((s) => [s.id, s]));

/** 처음부터 가진 스킨 — 상점을 안 거쳐도 입을 수 있다 */
export const FREE_SKINS = SKINS.filter((s) => s.free).map((s) => s.id);

/** 그림 경로 — 없으면 <img> onerror 로 커스텀 SVG 대체 */
export function skinImage(id) { return `assets/skins/${id}.png`; }

/** 해금 영상 경로. 영상을 쓰는 스킨이 아니면 null */
export function skinVideo(id) {
  return SKIN_BY_ID.get(id)?.video ? `assets/skins/${id}.mp4` : null;
}

export function gradeOf(id) { return GRADES[SKIN_BY_ID.get(id)?.grade] || null; }

export function skinPrice(id) {
  const s = SKIN_BY_ID.get(id);
  if (!s) return Infinity;
  return s.free ? 0 : GRADES[s.grade].price;
}

/** 지금 발자국으로 살 수 있는가 (이미 가진 것은 false) */
export function canAfford(id, paws, ownedIds) {
  if (!SKIN_BY_ID.has(id) || ownedIds.includes(id)) return false;
  return paws >= skinPrice(id);
}

/** 다음에 살 만한 것 — 아직 없는 스킨 중 제일 싼 것 */
export function nextSkin(ownedIds) {
  return [...SKINS]
    .filter((s) => !ownedIds.includes(s.id))
    .sort((a, b) => skinPrice(a.id) - skinPrice(b.id))[0] || null;
}
