// 칭호 — 랜덤 뽑기 아님, 조건 달성형.
// 리서치 반영 2가지:
//  ① 절반은 숨김(hidden) — 예고된 보상은 과잉정당화를 부르고, 뜻밖의 보상은 수행 정보가 된다.
//  ② 문구는 Dweck 규칙 — 능력 칭찬("천재!") 금지, 전략·수행을 결과와 연결해 서술.
// check(r, s): r = 이번 판 기록, s = 누적 저장(getSave() 모양)

export const BADGES = [
  // 보이는 칭호 — 진행형. 이건 목표로 보여도 안전하다 (수행의 질이 아니라 계속함 자체라서)
  { id: 'first',    n: '첫 사냥',      r: 1, hidden: false, cond: '한 판 끝까지',
    d: '끝까지 갔다는 것, 그게 사냥의 전부다',
    check: (r, s) => s.rounds >= 1 },
  { id: 'subj1',    n: '주어 헌터',    r: 1, hidden: false, cond: '주어 사냥터 한 판 완주',
    d: '"누가"부터 잡는 사냥법을 익혔다',
    check: (r) => r.mode === 'subj' },
  { id: 'again3',   n: '다시 온 사냥꾼', r: 2, hidden: false, cond: '3판 완주',
    d: '한 번 온 게 아니라 다시 왔다 — 그게 실력의 시작',
    check: (r, s) => s.rounds >= 3 },
  { id: 'regular',  n: '사냥터 단골',  r: 3, hidden: false, cond: '10판 완주',
    d: '이 사냥터의 길을 다 외웠을 무렵',
    check: (r, s) => s.rounds >= 10 },
  { id: 'dex12',    n: '도감 절반',    r: 3, hidden: false, cond: '도감 12마리',
    d: '절반을 모았다 — 나머지 절반이 기다린다',
    check: (r, s) => s.owned >= 12 },
  { id: 'dex25',    n: '도감 완성',    r: 4, hidden: false, cond: '도감 25마리 전부',
    d: '이 사냥터의 모든 동사가 네 이름을 안다',
    check: (r, s) => s.owned >= s.total },

  // 숨은 칭호 — 수행형. 따려고 하는 게 아니라, 해냈더니 뜨는 것.
  { id: 'ghost',    n: '유령 저격수',  r: 3, hidden: true, cond: 'be동사 5문장 전부 한 번에',
    d: '남들 눈에 안 보이는 유령(be동사)만 골라 잡았다 — 그 눈이 생겼다는 뜻',
    check: (r) => r.mode === 'verb' && r.beFirstTry >= 5 },
  { id: 'nofool',   n: '유혹 면역',    r: 2, hidden: true, cond: '함정을 안 밟고 5개 이상 한 번에',
    d: '꾸미는 말들이 전부 손을 흔들었지만 한 번도 안 속았다',
    check: (r) => r.mode === 'verb' && r.trapTaps === 0 && r.firstTryHits >= 5 },
  // 실력 칭호는 '진짜 사냥터'에서만 — 손잡고 가는 0단계(기초 캠프)에서 나오면 값이 떨어진다.
  { id: 'perfect',  n: '무결점 사냥',  r: 3, hidden: true, cond: '10문장 전부 한 번에',
    d: '망설임 없이 열 번, 전부 정확했다',
    check: (r) => r.mode !== 'basic' && r.firstTryHits >= 10 },
  { id: 'combo10',  n: '연쇄 사냥꾼',  r: 4, hidden: true, cond: '10연속 콤보로 완주',
    d: '한 번도 끊기지 않은 사냥 — 흐름을 탔다는 증거',
    check: (r) => r.mode !== 'basic' && r.bestCombo >= 10 },
  { id: 'growth',   n: '어제의 나 초월', r: 2, hidden: true, cond: '지난 판보다 한 번에 더 많이 (만점 유지 포함)',
    // 첫 판 만점이면 '더 많이'가 불가능 — 천장에서는 유지가 곧 성장 (v0.3에서 잡은 버그)
    check: (r, s) => r.mode !== 'basic' && s.lastFirstTry != null
      && (r.firstTryHits > s.lastFirstTry || (r.firstTryHits >= 10 && s.lastFirstTry >= 10)) },
  { id: 'chunk',    n: '덩어리 사냥꾼', r: 3, hidden: true, cond: '두 단어 주어를 헤매지 않고 3번',
    d: '주어를 한 단어가 아니라 덩어리로 보기 시작했다',
    check: (r) => r.mode === 'subj' && r.chunkFirstTry >= 3 },
];

export const BADGE_BY_ID = new Map(BADGES.map((b) => [b.id, b]));

/** 이번 판으로 조건이 선 칭호 id 들 (이미 가진 것 거르는 건 store 몫) */
export function judgeBadges(rec, save) {
  return BADGES.filter((b) => b.check(rec, save)).map((b) => b.id);
}
