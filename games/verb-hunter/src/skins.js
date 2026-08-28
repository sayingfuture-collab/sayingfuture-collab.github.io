// 완성형 스킨 — 그림 한 장이 통째로 캐릭터(고양이 사냥꾼)인 옷. 커스텀 조합(hunter.js)과 나란히 존재한다.
//  · 커스텀 조합 = "내가 만든 캐릭터" (동일시)
//  · 완성 스킨   = "도감을 채우다 보니 열린 것" (사후 발견되는 보상 — 예고 없이 뜬다)
// 두 축이 서로를 안 죽이도록: 스킨은 조합을 잠그지 않고, 언제든 커스텀으로 되돌아올 수 있다.
//
// 그림 파일은 assets/skins/<id>.png. 아직 없으면 커스텀 SVG로 자동 대체된다
// (파일이 없어도 게임이 절대 안 깨지게 — 그림은 나중에 채워 넣는다).

export const SKINS = [
  { id: 'skin-basic',  name: '새내기 사냥꾼', need: 0,
    line: '첫 장비를 받았다. 아직은 평범하지만, 여기서 시작한다.' },
  { id: 'skin-scout',  name: '숲 정찰대',     need: 3,
    line: '동사 3마리. 숲이 조금씩 눈에 익기 시작했다.' },
  { id: 'skin-ribbon', name: '리본 사냥꾼',   need: 6,
    line: '여섯 마리째. 사냥터에서 알아보는 사람이 생겼다.' },
  { id: 'skin-night',  name: '달빛 사냥꾼',   need: 10,
    line: '열 마리. 이제 어두운 문장 속에서도 동사가 보인다.' },
  { id: 'skin-ghost',  name: '유령 사냥꾼',   need: 14,
    line: '보이지 않는 be동사들이 너를 피해 다니기 시작했다.' },
  { id: 'skin-storm',  name: '폭풍 사냥꾼',   need: 18,
    line: '열여덟 마리. 문장이 통째로 읽히는 순간이 온다.' },
  { id: 'skin-crown',  name: '도감의 주인',   need: 22,
    line: '스물두 마리. 이 사냥터에서 네가 모르는 동사는 세 마리뿐.' },
  { id: 'skin-legend', name: '전설의 사냥꾼', need: 25,
    line: '도감 완성. 문장 속 모든 동사가 네 이름을 안다.' },
];

export const SKIN_BY_ID = new Map(SKINS.map((s) => [s.id, s]));

/** 그림 경로 — 없으면 <img> onerror 로 커스텀 SVG 대체 */
export function skinImage(id) { return `assets/skins/${id}.png`; }

export function skinUnlocked(id, owned) {
  const s = SKIN_BY_ID.get(id);
  return !!s && owned >= s.need;
}

/** 지금 열려 있는 스킨들 */
export function unlockedSkins(owned) {
  return SKINS.filter((s) => owned <= 0 ? s.need === 0 : owned >= s.need);
}

/**
 * 아직 컷씬을 안 본 새 스킨 — 판이 끝나고 홈에 돌아올 때 확인한다.
 * @param {number} owned 도감 소유 수
 * @param {string[]} seen 이미 컷씬을 본 스킨 id 들
 * @returns {object|null} 가장 높은 단계 하나 (여러 개면 제일 센 것만 보여준다)
 */
export function pendingSkinReveal(owned, seen) {
  const fresh = SKINS.filter((s) => owned >= s.need && !seen.includes(s.id));
  if (fresh.length === 0) return null;
  return fresh[fresh.length - 1];
}
