// 저장. 위인전(영웅뽑기)의 createStore 패턴 재사용 — localStorage, 막히면 메모리 폴백.
// 저장이 바뀌면 listeners 로 알린다 (화면 갱신을 손으로 부르다 빠뜨리는 사고 방지 — 위인전에서 배운 것).
import { VERB_BY_LEMMA, VERBS } from './data.js';
import { HUNTER_PARTS } from './hunter.js';
import { SKIN_BY_ID, FREE_SKINS, skinPrice } from './skins.js';

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
export const STARTER_LEMMAS = ['run', 'eat', 'go'];

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
export function sanitize(raw) {
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
    // 최근 첫시도 성공 여부를 **모드별로** 따로 쌓는다 (0/1, 모드당 최대 20).
    // 한 통에 담으면 안내형 0단계(고정 위치·손잡고 가기) 성적이 진짜 사냥터의 숙달로 오인돼서,
    // 주어 사냥을 한 번도 안 한 학생이 첫 판부터 최고 난이도+혼합을 맞는다. 0단계는 아예 안 쌓는다.
    recent: (raw?.recent && typeof raw.recent === 'object' && !Array.isArray(raw.recent))
      ? Object.fromEntries(Object.entries(raw.recent).map(([m, list]) =>
        [m, Array.isArray(list) ? list.filter((x) => x === 0 || x === 1).slice(-20) : []]))
      : {},
    // 규칙 카드를 본 모드들 — 모드마다 딱 한 번만 보여준다.
    seenRules: Array.isArray(raw?.seenRules) ? raw.seenRules.filter((m) => typeof m === 'string') : [],
    // 모드별 최고 기록 — 새 사냥터 자물쇠(진급)의 근거.
    modeBest: (raw?.modeBest && typeof raw.modeBest === 'object')
      ? Object.fromEntries(Object.entries(raw.modeBest).map(([m, v]) => [m, int0(v)]))
      : {},
    basicsDone: raw?.basicsDone === true,   // 기초 캠프 수료 여부
    // 특훈(철자 각인)을 마친 동사들 — 도감 카드에 🧠 훈장이 붙는다
    trained: Array.isArray(raw?.trained) ? raw.trained.filter((l) => typeof l === 'string') : [],
    // 완성형 스킨: 입고 있는 것(null = 커스텀 조합) + 산 것들 + 쓴 발자국
    // 잔액을 따로 저장하지 않는다 — 잔액 = 누적 포획 - 쓴 발자국. 저장이 어긋날 여지를 없앤다.
    skin: SKIN_BY_ID.has(raw?.skin) ? raw.skin : null,
    // 입고 있는 스킨은 가진 것으로 친다. 예전 규칙(도감 진행도로 자동 해금)에서 얻어 입고
    // 있던 아이한테서 도로 뺏으면 벌처럼 느껴진다 — 이미 준 것은 그대로 둔다.
    ownedSkins: [...new Set([
      ...FREE_SKINS,
      ...(SKIN_BY_ID.has(raw?.skin) ? [raw.skin] : []),
      ...(Array.isArray(raw?.ownedSkins) ? raw.ownedSkins.filter((x) => SKIN_BY_ID.has(x)) : []),
    ])],
    pawsSpent: int0(raw?.pawsSpent),
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

/**
 * 문장 하나 끝날 때마다: 첫 시도 성공이면 1, 아니면 0.
 * 기초 캠프(basic)는 기록하지 않는다 — 안내형 단계의 성적은 숙달의 증거가 아니다.
 */
export function noteRecent(ok, mode) {
  if (!mode || mode === 'basic') return;
  const list = state.recent[mode] || (state.recent[mode] = []);
  list.push(ok ? 1 : 0);
  if (list.length > 20) state.recent[mode] = list.slice(-20);
  write();
}

/** 그 모드의 최근 10문장 첫시도 정답률 (0~1). 5개 미만이면 null — 조절하지 않는다 */
export function recentAccuracy(mode) {
  const r = (state.recent[mode] || []).slice(-10);
  if (r.length < 5) return null;
  return r.reduce((a, b) => a + b, 0) / r.length;
}

// ── 규칙 카드 ────────────────────────────────────────────────

/** 기초 캠프 수료 — 한 번 수료하면 홈 버튼에 ✅ 가 붙는다 (다시 볼 수는 있다) */
export function basicsDone() { return state.basicsDone; }

export function markBasicsDone() {
  if (state.basicsDone) return;
  state.basicsDone = true;
  write();
}

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
    trained: state.trained.length, // 특훈(철자 각인) 마친 동사 수
    paws: paws(),                  // 🐾 쓸 수 있는 발자국
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
  // 기초 캠프(0단계)는 문항 수가 달라서 실력 기록에 섞으면 기준이 망가진다.
  // 판 수와 칭호 판정에는 들어가되, 최고 기록·성장 비교에는 안 들어간다.
  const isBasic = rec.mode === 'basic' || rec.mode === 'train';
  if (!isBasic && rec.firstTryHits >= 10) state.perfects += 1;
  if (!isBasic) state.modeBest[rec.mode] = Math.max(state.modeBest[rec.mode] ?? 0, rec.firstTryHits);
  const earned = judgeBadges ? judgeBadges(rec, getSave()).filter((id) => !state.badges.includes(id)) : [];
  state.badges.push(...earned);
  if (!isBasic) state.lastFirstTry = rec.firstTryHits; // growth 판정이 끝난 뒤에 갱신해야 한다
  write();
  return earned;
}

// ── 동사 특훈(철자 각인) ─────────────────────────────────────
export function isTrained(lemma) { return state.trained.includes(lemma); }

export function markTrained(lemma) {
  if (!state.trained.includes(lemma)) { state.trained.push(lemma); write(); }
}

export function trainedCount() { return state.trained.length; }

/** 잡은(★1+) 동사 lemma 목록 — 특훈 덱의 재료 */
export function caughtLemmas() {
  return Object.entries(state.dex).filter(([, d]) => d.stars > 0).map(([l]) => l);
}

// ── 완성형 스킨 · 🐾 발자국 ────────────────────────────────
// 발자국은 동사를 잡을 때마다 1개씩 쌓인다 (= 누적 포획 수). 스킨을 사면 줄어든다.
// 커스텀 파츠는 여기서 안 쓴다 — 그건 도감 진행도로 열리는 무료 축이다.

/** 지금 쓸 수 있는 발자국 */
export function paws() {
  return Math.max(0, state.catches - state.pawsSpent);
}

/** 입고 있는 스킨 id. null 이면 커스텀 조합을 쓴다 */
export function getSkin() { return state.skin; }

/** null 을 넣으면 커스텀 조합으로 되돌아간다. 안 산 스킨은 못 입는다 */
export function setSkin(id) {
  if (id !== null && !state.ownedSkins.includes(id)) return;
  state.skin = id;
  write();
}

export function getOwnedSkins() { return [...state.ownedSkins]; }

export function hasSkin(id) { return state.ownedSkins.includes(id); }

/**
 * 스킨 구매. 잔액이 모자라거나 이미 있으면 아무 일도 안 일어난다.
 * @returns {boolean} 실제로 샀는가 (구매 연출을 띄울지 판단하는 값)
 */
export function buySkin(id) {
  if (!SKIN_BY_ID.has(id) || state.ownedSkins.includes(id)) return false;
  const cost = skinPrice(id);
  if (paws() < cost) return false;
  state.pawsSpent += cost;
  state.ownedSkins.push(id);
  write();
  return true;
}

export function resetAll() {
  state = sanitize(null);
  write();
}
