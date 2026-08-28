// 저장 — localStorage. 동사사냥꾼과 같은 방어적 sanitize 패턴.
import { kstStamp } from './seed.js';

const KEY = 'daily-en-save-v1';

export const GRADES = ['초4', '초5', '초6', '중1', '중2', '중3', '고등', '선생님'];

function int0(x) { return Number.isFinite(x) ? Math.max(0, Math.floor(x)) : 0; }

function sanitize(raw) {
  return {
    grade: GRADES.includes(raw?.grade) ? raw.grade : null,
    // history[stamp] = { cells: ['g','y',...], score }
    history: (raw?.history && typeof raw.history === 'object' && !Array.isArray(raw.history)) ? raw.history : {},
    // 놓친 낱말 — v0.2 복습 라운드의 재료로 지금부터 쌓아둔다
    missedWords: Array.isArray(raw?.missedWords) ? raw.missedWords.filter((w) => typeof w === 'string').slice(-60) : [],
  };
}

let state = load();

function load() {
  try { return sanitize(JSON.parse(localStorage.getItem(KEY) || 'null')); }
  catch { return sanitize(null); }
}

function write() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* 사파리 시크릿 등 */ }
}

export function getGrade() { return state.grade; }
export function setGrade(g) { if (GRADES.includes(g)) { state.grade = g; write(); } }

export function todayResult(stamp = kstStamp()) { return state.history[stamp] || null; }

export function saveResult(stamp, cells, sc) {
  state.history[stamp] = { cells, score: int0(sc) };
  write();
}

export function noteMissedWord(en) {
  if (!state.missedWords.includes(en)) { state.missedWords.push(en); write(); }
}

export function totalPlays() { return Object.keys(state.history).length; }

// 스트릭 — 관대하게: "오늘 포함 며칠 연속 플레이했나"만 센다. 끊겨도 애도 연출 없음.
export function streak(stamp = kstStamp()) {
  let n = 0;
  let t = Date.parse(stamp + 'T00:00:00Z');
  while (true) {
    const d = new Date(t);
    const s = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    if (!state.history[s]) break;
    n += 1;
    t -= 86400000;
  }
  return n;
}

// 테스트용
export function _resetForTest() { state = sanitize(null); }
export function _stateForTest() { return state; }
