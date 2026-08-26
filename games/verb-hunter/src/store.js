// 저장. 위인전(영웅뽑기)의 createStore 패턴 재사용 — localStorage, 막히면 메모리 폴백.
// 저장이 바뀌면 listeners 로 알린다 (화면 갱신을 손으로 부르다 빠뜨리는 사고 방지 — 위인전에서 배운 것).
import { VERB_BY_LEMMA, VERBS } from './data.js';
import { HUNTER_PARTS } from './hunter.js';

export function createStore(key) {
  try {
    if (typeof localStorage !== 'undefined') {
      const probe = `${key}.probe`;
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
      return {
        get: () => localStorage.getItem(key),
        set: (v) => localStorage.setItem(key, v),
      };
    }
  } catch { /* 사생활 보호 모드 → 메모리 */ }
  let mem = null;
  return { get: () => mem, set: (v) => { mem = v; } };
}

const KEY = 'verbHunter.v1';
const store = createStore(KEY);
const int0 = (v) => (Number.isInteger(v) && v >= 0 ? v : 0);

// 등록 화면에서 고를 수 있는 학년 — 시트의 '이름' 칸에 그대로 찍힌다.
export const GRADES = ['초4', '초5', '초6', '중1', '중2', '중3', '고등', '선생님'];

// 시작 선물 3마리 — endowed progress: "0/25"가 아니라 "3/25"로 시작해야 완주 확률이 오른다.
// 진단에서 이미 아는 것으로 확인된 쉬운 동사들로 준다 — 거짓 진행이 아니라 사실의 반영.
const STARTER_LEMMAS = ['run', 'eat', 'go'];

function emptyDex() {
  const dex = {};
  for (const l of STARTER_LEMMAS) dex[l] = { stars: 1, seen: true };
  return dex;
}

// 복습 간격(일): 잡은 지 이만큼 지나면 "오늘의 사냥터"에 다시 나온다. 1→3→7→14 (간격 반복).
export const REVIEW_GAPS = [1, 3, 7, 14];

/** 'YYYY-MM-DD' — 복습은 시각이 아니라 날짜 단위로만 계산한다 */
export function dayStamp(now = new Date()) {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysBetween(fromStamp, toStamp) {
  return Math.round((new Date(toStamp) - new Date(fromStamp)) / 86400000);
}

// 저장은 사용자가 고칠 수 있다. 아는 lemma·말이 되는 값만 남긴다 (위인전 sanitize 패턴).
function sanitize(raw) {
  const dex = emptyDex();
  if (raw?.dex && typeof raw.dex === 'object') {
    for (const [lemma, d] of Object.entries(raw.dex)) {
      if (!VERB_BY_LEMMA.has(lemma)) continue;
      const stars = Math.min(3, int0(d?.stars));
      const seen = d?.seen === true || stars > 0;
      if (!seen) continue;
      dex[lemma] = { stars, seen: true };
      if (typeof d?.caughtAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.caughtAt)) {
        dex[lemma].caughtAt = d.caughtAt;
        dex[lemma].stage = Math.min(REVIEW_GAPS.length - 1, int0(d?.stage));
      }
    }
  }
  const partIds = new Set(HUNTER_PARTS.map((p) => p.id));
  const equipped = {};
  if (raw?.equipped && typeof raw.equipped === 'object') {
    for (const [slot, id] of Object.entries(raw.equipped)) {
      if (partIds.has(id)) equipped[slot] = id;
    }
  }
  return {
    dex,
    equipped,
    grade: GRADES.includes(raw?.grade) ? raw.grade : null,
    badges: Array.isArray(raw?.badges) ? raw.badges.filter((b) => typeof b === 'string') : [],
    rounds: int0(raw?.rounds),
    perfects: int0(raw?.perfects),
    catches: int0(raw?.catches),          // 누적 포획 수 — "잡은 동사 N마리"의 N
    lastFirstTry: Number.isInteger(raw?.lastFirstTry) ? raw.lastFirstTry : null,
    // 최근 문장별 첫시도 성공 여부 (0/1, 최대 20) — 은닉 난이도 조절의 재료. 화면엔 안 보인다.
    recent: Array.isArray(raw?.recent) ? raw.recent.filter((x) => x === 0 || x === 1).slice(-20) : [],
    // 규칙 카드를 본 모드들 — 모드마다 딱 한 번만 보여준다.
    seenRules: Array.isArray(raw?.seenRules) ? raw.seenRules.filter((m) => typeof m === 'string') : [],
    // 모드별 최고 기록 — 새 사냥터 자물쇠(진급)의 근거.
    modeBest: (raw?.modeBest && typeof raw.modeBest === 'object')
      ? Object.fromEntries(Object.entries(raw.modeBest).map(([m, v]) => [m, int0(v)]))
      : {},
  };
}

function read() {
  try {
    const raw = store.get();
    return sanitize(raw ? JSON.parse(raw) : null);
  } catch {
    return sanitize(null);
  }
}

let state = read();
const listeners = new Set();

export function onSaveChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function write() {
  try { store.set(JSON.stringify(state)); } catch { /* 저장 실패해도 진행 */ }
  for (const fn of listeners) fn();
}

write(); // 정리 결과를 바로 남긴다

// ── 도감 ─────────────────────────────────────────────────────

/**
 * 포획: 첫 시도 정답. 카드 등록(★1) 또는 별 강화(최대 ★3).
 * 재획득=강화 — 반복 학습이 곧 강화가 되는 구조 (간격 반복의 재미 위장).
 * @returns {{isNew: boolean, stars: number, starUp: boolean}}
 */
export function registerCatch(lemma, now = new Date()) {
  if (!VERB_BY_LEMMA.has(lemma)) return { isNew: false, stars: 0, starUp: false };
  const cur = state.dex[lemma];
  const today = dayStamp(now);
  let out;
  if (!cur || cur.stars === 0) {
    state.dex[lemma] = { stars: 1, seen: true, caughtAt: today, stage: 0 };
    out = { isNew: true, stars: 1, starUp: false };
  } else {
    const starUp = cur.stars < 3;
    cur.stars = Math.min(3, cur.stars + 1);
    // 복습 시점(간격이 찬 뒤)에 다시 잡으면 다음 단계로 — 1→3→7→14일. 간격 반복이 몰래 굴러간다.
    const gap = REVIEW_GAPS[cur.stage ?? 0];
    if (cur.caughtAt && daysBetween(cur.caughtAt, today) >= gap) {
      cur.stage = Math.min(REVIEW_GAPS.length - 1, (cur.stage ?? 0) + 1);
    }
    cur.caughtAt = today;
    if (cur.stage == null) cur.stage = 0;
    out = { isNew: false, stars: cur.stars, starUp };
  }
  state.catches += 1;
  write();
  return out;
}

/** 복습 기한이 찬 lemma 들 — "오늘의 사냥터" 재료. 잡은 지 간격 이상 지난 카드만 */
export function dueLemmas(now = new Date()) {
  const today = dayStamp(now);
  const due = [];
  for (const [lemma, d] of Object.entries(state.dex)) {
    if (!(d.stars > 0) || !d.caughtAt) continue;
    if (daysBetween(d.caughtAt, today) >= REVIEW_GAPS[d.stage ?? 0]) due.push(lemma);
  }
  return due;
}

// ── 은닉 난이도 조절 재료 ────────────────────────────────────

/** 문장 하나 끝날 때마다: 첫 시도 성공이면 1, 아니면 0 */
export function noteRecent(ok) {
  state.recent.push(ok ? 1 : 0);
  if (state.recent.length > 20) state.recent = state.recent.slice(-20);
  write();
}

/** 최근 10문장 첫시도 정답률 (0~1). 기록이 5개 미만이면 null — 조절하지 않는다 */
export function recentAccuracy() {
  const r = state.recent.slice(-10);
  if (r.length < 5) return null;
  return r.reduce((a, b) => a + b, 0) / r.length;
}

// ── 규칙 카드 ────────────────────────────────────────────────

export function ruleSeen(mode) { return state.seenRules.includes(mode); }

export function markRuleSeen(mode) {
  if (state.seenRules.includes(mode)) return;
  state.seenRules.push(mode);
  write();
}

/**
 * 목격: 틀렸다가 재시도로 잡음. 실루엣이 걷히고 이름이 공개되지만 소유는 아니다.
 * "봤는데 도망갔다" — 미완료 상태를 도감에 남겨 다음 판의 이유를 만든다 (Zeigarnik).
 */
export function registerSeen(lemma) {
  if (!VERB_BY_LEMMA.has(lemma)) return;
  if (!state.dex[lemma]) {
    state.dex[lemma] = { stars: 0, seen: true };
    write();
  }
}

/** 도감 상태 사본: lemma → {stars, seen} */
export function getDex() {
  const out = {};
  for (const [l, d] of Object.entries(state.dex)) out[l] = { ...d };
  return out;
}

/** 소유(★1 이상)한 카드 수 */
export function ownedCount() {
  return Object.values(state.dex).filter((d) => d.stars > 0).length;
}

export function dexTotal() { return VERBS.length; }

// ── 사냥꾼 등록(학년) ────────────────────────────────────────
// 처음 한 번만 묻는다. 원격 기록의 '이름' 칸이 되어 누가 했는지 구분해 준다.

export function getGrade() { return state.grade; }

export function setGrade(g) {
  if (!GRADES.includes(g)) return;
  state.grade = g;
  write();
}

// ── 캐릭터 ───────────────────────────────────────────────────

export function getEquipped() { return { ...state.equipped }; }

export function equipPart(slot, id) {
  state.equipped[slot] = id;
  write();
}

// ── 판 기록과 칭호 ───────────────────────────────────────────

export function getSave() {
  return {
    rounds: state.rounds, perfects: state.perfects, catches: state.catches,
    lastFirstTry: state.lastFirstTry, badges: [...state.badges],
    owned: ownedCount(), total: VERBS.length,
    modeBest: { ...state.modeBest },
  };
}

/**
 * 판 하나를 누적한다. 칭호 판정은 badges.js 가 하고 여기는 기록만.
 * @param {{mode: string, firstTryHits: number, bestCombo: number,
 *          trapTaps: number, beFirstTry: number, chunkFirstTry: number}} rec
 * @param {(rec: object, save: object) => string[]} judgeBadges
 * @returns {string[]} 새로 얻은 칭호 id
 */
export function recordRound(rec, judgeBadges) {
  state.rounds += 1;
  if (rec.firstTryHits >= 10) state.perfects += 1;
  state.modeBest[rec.mode] = Math.max(state.modeBest[rec.mode] ?? 0, rec.firstTryHits);
  const earned = judgeBadges ? judgeBadges(rec, getSave()).filter((id) => !state.badges.includes(id)) : [];
  state.badges.push(...earned);
  state.lastFirstTry = rec.firstTryHits; // growth 판정이 끝난 뒤에 갱신해야 한다
  write();
  return earned;
}

export function resetAll() {
  state = sanitize(null);
  write();
}
