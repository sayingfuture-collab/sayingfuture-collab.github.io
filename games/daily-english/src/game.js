// 오늘의 퍼즐 구성 + 채점 + 공유 격자.
// 한 판 = 낱말 3 + 듣기 2 + 문장 3 = 8문제, 5분.
import { WORDS } from './data-words.js';
import { LISTEN_EASY, LISTEN_HARD } from './data-listen.js';
import { VERB_Q } from './data-verbs.js';
import { rngFor, pickN, shuffled, puzzleNumber, kstStamp } from './seed.js';

export const ROUNDS = [
  { key: 'word', emoji: '🔤', name: '낱말', count: 3 },
  { key: 'listen', emoji: '👂', name: '듣기', count: 2 },
  { key: 'verb', emoji: '🧩', name: '문장', count: 3 },
];

// 칩에 섞을 미끼 철자 — 정답에 없는 글자에서 뽑는다
const ALPHA = 'abcdefghijklmnopqrstuvwxyz';

export function decoyLetters(word, n, rng) {
  const pool = [...ALPHA].filter((c) => !word.includes(c));
  return pickN(pool, n, rng);
}

// 낱말 문제: 정답 철자 + 미끼 2~3개를 섞은 칩 배열
export function wordChips(word, rng) {
  const decoys = decoyLetters(word.en, word.en.length >= 6 ? 3 : 2, rng);
  return shuffled([...word.en, ...decoys], rng);
}

export function dailyPuzzle(stamp = kstStamp()) {
  const words = pickN(WORDS, 3, rngFor('word', stamp));
  const listens = [
    ...pickN(LISTEN_EASY, 1, rngFor('listen-e', stamp)),
    ...pickN(LISTEN_HARD, 1, rngFor('listen-h', stamp)),
  ];
  const verbs = pickN(VERB_Q, 3, rngFor('verb', stamp));
  return { stamp, number: puzzleNumber(stamp), words, listens, verbs };
}

// 문제 하나의 결과: 'g'(한 번에) · 'y'(틀렸지만 스스로 해결) · 'r'(정답 공개)
export const CELL = { g: '🟩', y: '🟨', r: '🟥' };

export function cellOf(missCount, revealed) {
  if (revealed) return 'r';
  return missCount === 0 ? 'g' : 'y';
}

export function score(cells) {
  return cells.reduce((s, c) => s + (c === 'g' ? 2 : c === 'y' ? 1 : 0), 0);
}

export const MAX_SCORE = 16; // 8문제 × 2점

// 카톡 공유 텍스트 — 라운드별 한 줄 격자
export function shareText(number, cells, streak) {
  const rows = [];
  let i = 0;
  for (const r of ROUNDS) {
    const row = cells.slice(i, i + r.count).map((c) => CELL[c]).join('');
    rows.push(`${r.emoji}${row}`);
    i += r.count;
  }
  const fire = streak >= 2 ? ` 🔥${streak}일째` : '';
  return `오늘의 영어 #${number} ${score(cells)}/${MAX_SCORE}${fire}\n${rows.join('\n')}\nnyejun.com/games/daily-english/`;
}

// 가상 랭킹 — 풍선빵 방식: 날짜 시드로 가상 분포를 만들어 백분위를 낸다 (서버 0)
export function percentile(myScore, stamp = kstStamp()) {
  const rng = rngFor('rank', stamp);
  let below = 0;
  const N = 3000;
  for (let i = 0; i < N; i++) {
    // 대략 종 모양: 주사위 4개 합 (0~16)
    const s = Math.floor(rng() * 5) + Math.floor(rng() * 5) + Math.floor(rng() * 5) + Math.floor(rng() * 5);
    if (s < myScore) below += 1;
  }
  return Math.round((below / N) * 100);
}

// 한 판 기록 (원격 시트용) — 동사사냥꾼 log.js 형식에 맞춘다
export function roundRecord(cells) {
  return {
    mode: 'daily',
    firstTryHits: cells.filter((c) => c === 'g').length,
    bestCombo: longestRun(cells, 'g'),
    total: cells.length,
  };
}

function longestRun(cells, v) {
  let best = 0, cur = 0;
  for (const c of cells) { cur = c === v ? cur + 1 : 0; best = Math.max(best, cur); }
  return best;
}
