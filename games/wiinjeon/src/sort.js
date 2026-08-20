// 보유 인물 정렬. 화면에서 쓰지만 DOM을 모른다 — 그래야 노드에서 검증할 수 있다.
//
// 기준을 하나만 쓰면 같은 값끼리 원본 순서(르네상스·조선…)로 남아 뒤죽박죽으로 보인다.
// 그래서 어느 기준을 골라도 나머지 둘이 순서대로 따라붙는다.

const TIER_ORDER = { SSR: 0, SR: 1, R: 2, N: 3 };

// 도감 필터와 같은 차례로 둔다. 두 화면에서 역할 순서가 다르면 찾는 데 시간이 걸린다.
const ROLE_ORDER = { 지휘: 0, 장인: 1, 전사: 2, 치유: 3, 포격: 4 };

const byTier = (a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier];
const byRole = (a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role];
const byName = (a, b) => a.name.localeCompare(b.name, 'ko');

/** 레벨은 인물 데이터에 없다(보유 장수가 곧 레벨). 읽는 함수를 받아 쓴다. */
const byLevel = (levelOf) => (a, b) => levelOf(b.id) - levelOf(a.id);

// 가진 것부터. 도감에는 아직 못 뽑은 인물이 섞여 있는데, 등급순으로 세우면
// 화면 첫 줄이 물음표로 덮인다 — 정렬을 누른 사람은 가진 걸 보려는 것이다.
// 고르기 창은 애초에 가진 인물만 넘겨주므로 여기서 아무 일도 안 일어난다.
const byOwned = (levelOf) => (a, b) => (levelOf(b.id) > 0) - (levelOf(a.id) > 0);

/**
 * id  — 화면 상태로 들고 다니는 값
 * name — 버튼에 뜨는 글자
 * keys — 앞에서부터 차례로 비교한다. 앞이 같을 때만 뒤를 본다.
 */
export const SORTS = [
  { id: 'tier',  name: '등급', keys: (lv) => [byOwned(lv), byTier, byLevel(lv), byName] },
  { id: 'level', name: '레벨', keys: (lv) => [byLevel(lv), byTier, byName] },
  { id: 'role',  name: '역할', keys: (lv) => [byOwned(lv), byRole, byTier, byLevel(lv)] },
];

export const DEFAULT_SORT = 'tier';

// 도감은 원래 순서가 시대·지역별로 묶여 있다. 그게 도감다운 차례라서 기본으로 남기고,
// 정렬은 얹기만 한다. keys가 없으면 받은 순서를 그대로 돌려준다.
export const ORIGINAL_SORT = 'original';
export const BOOK_SORTS = [{ id: ORIGINAL_SORT, name: '기본', keys: null }, ...SORTS];

const BY_ID = new Map(BOOK_SORTS.map((s) => [s.id, s]));

/**
 * 원본은 건드리지 않고 정렬한 새 배열을 준다.
 * 모르는 기준이면 기본값으로 떨어진다 — 화면이 빈손이 되면 안 된다.
 *
 * @param {Array<object>} list 인물 목록
 * @param {string} mode SORTS의 id
 * @param {(id: string) => number} levelOf 그 인물의 레벨
 */
export function sortCharacters(list, mode, levelOf) {
  const sort = BY_ID.get(mode) ?? BY_ID.get(DEFAULT_SORT);
  if (!sort.keys) return [...list];
  const keys = sort.keys(levelOf);
  return [...list].sort((a, b) => {
    for (const key of keys) {
      const d = key(a, b);
      if (d !== 0) return d;
    }
    return 0;
  });
}
