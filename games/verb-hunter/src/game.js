// 순수 게임 로직 — DOM 없음. node --test 로 검사한다.
import { GENERAL, BE, lemmaOfWord, VERB_BY_LEMMA } from './data.js';

export function shuffle(a, rng = Math.random) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 은닉 난이도: 최근 정답률로 bias 를 정한다. 화면엔 절대 안 보인다 (85% 규칙).
 * +1 = 잘하고 있으니 몰래 어렵게, -1 = 힘들어하니 몰래 쉽게, 0 = 그대로.
 */
export function difficultyBias(accuracy) {
  if (accuracy == null) return 0;
  if (accuracy >= 0.85) return 1;
  if (accuracy < 0.6) return -1;
  return 0;
}

// 난이도 대리 지표 = 문장 길이. 티 안 나는 조절 손잡이 (미끼 단어 수와 같다).
function pickN(pool, n, bias, rng) {
  const sorted = shuffle([...pool], rng).sort((a, b) => (a.w.length - b.w.length) * bias * -1);
  return bias === 0 ? shuffle([...pool], rng).slice(0, n) : sorted.slice(0, n);
}

/**
 * 한 판 10문장.
 * verb 모드: 일반 5 먼저 → be 5 (블로킹: 쉬운 족부터 묶어서).
 * subj 모드: 1단어 주어 5 먼저 → 2단어 주어 5.
 * 최근 정답률이 85% 이상이면 전체를 섞는다 — 블로킹 졸업, 혼합 연습(인터리빙)으로.
 */
export function makeDeck(mode, rng = Math.random, accuracy = null) {
  const bias = difficultyBias(accuracy);
  let deck;
  if (mode === 'subj') {
    const all = [...GENERAL, ...BE];
    const one = pickN(all.filter((s) => s.v === 1), 5, bias, rng);
    const two = pickN(all.filter((s) => s.v >= 2), 5, bias, rng);
    deck = [...shuffle(one, rng), ...shuffle(two, rng)];
  } else {
    deck = [
      ...shuffle(pickN(GENERAL, 5, bias, rng), rng),
      ...shuffle(pickN(BE, 5, bias, rng), rng),
    ];
  }
  return accuracy != null && accuracy >= 0.85 ? shuffle(deck, rng) : deck;
}

// ── 새 사냥터 덱 ─────────────────────────────────────────────

export const BE_PRESENT = ['am', 'is', 'are'];
export const BE_PAST = ['was', 'were'];
export const BE_FORMS = [...BE_PRESENT, ...BE_PAST];

/**
 * 빈칸 고르기(산출 1단계): be동사 자리를 비우고 고른다.
 * 탭(재인)에서 고르기(선택 산출)로 — 전이 사다리의 다음 칸.
 *
 * 선택지는 반드시 정답과 '같은 시제'끼리만 모은다.
 * 영어 문장만 봐서는 과거인지 현재인지 알 길이 없어서(뜻을 봐야만 알 수 있어서),
 * 시제를 섞으면 풀 수 없는 문제가 된다. 시제를 고정하면 묻는 것이
 * "주어가 몇 명이고 누구냐" 하나로 좁혀진다 — 그게 진짜 배울 것.
 */
export function makeFillDeck(rng = Math.random) {
  const beForm = (s) => s.w[s.v].replace(/[.!?]$/, '');
  // 형태별로 최소 한 문장씩 먼저 확보한다. 무작위로만 뽑으면 문장이 적은 am·were 가
  // 한 판에 아예 안 나올 수 있어서, 핵심 형태를 한 번도 연습 안 하고 진급하게 된다.
  const byForm = new Map();
  for (const s of BE) {
    const f = beForm(s);
    if (!byForm.has(f)) byForm.set(f, []);
    byForm.get(f).push(s);
  }
  const picked = [];
  for (const f of BE_FORMS) {
    const pool = byForm.get(f);
    if (pool?.length) picked.push(shuffle([...pool], rng)[0]);
  }
  const rest = shuffle(BE.filter((s) => !picked.includes(s)), rng).slice(0, Math.max(0, 10 - picked.length));
  return shuffle([...picked, ...rest], rng).slice(0, 10).map((s) => {
    const answer = beForm(s);
    const family = BE_PAST.includes(answer) ? BE_PAST : BE_PRESENT;
    return { ...s, answer, choices: shuffle([...family], rng) };
  });
}

/** 조각 배열(산출 2단계): 단어 조각을 순서대로 눌러 문장을 만든다. 짧은 문장만 */
export function makeOrderDeck(rng = Math.random) {
  const pool = [...GENERAL, ...BE].filter((s) => s.w.length <= 4);
  return shuffle(pool, rng).slice(0, 10).map((s) => {
    // 섞은 결과가 원문과 같으면 다시 섞는다 — 그대로면 왼쪽부터 누르기만 해도 통과된다.
    let chips = shuffle([...s.w], rng);
    for (let i = 0; i < 12 && chips.every((w, j) => w === s.w[j]); i++) chips = shuffle([...s.w], rng);
    return { ...s, chips };
  });
}

/**
 * 오늘의 사냥터: 복습 기한이 찬 동사마다 최소 한 문장을 보장하고, 남는 자리를 채워 10장.
 * 그냥 합쳐서 자르면 문장이 많은 동사(is 등)가 적은 동사를 밀어내 복습에서 통째로 빠진다.
 */
export function makeReviewDeck(due, rng = Math.random) {
  const all = [...GENERAL, ...BE];
  const picked = [];
  // 대상이 10마리를 넘으면 매번 앞쪽만 복습되지 않도록 섞어서 10마리를 고른다.
  // (나머지는 내일 다시 기한이 차 있으므로 다음 판에 나온다)
  const todays = shuffle([...due], rng).slice(0, 10);
  for (const lemma of todays) {
    const pool = shuffle(all.filter((s) => verbLemma(s) === lemma && !picked.includes(s)), rng);
    if (pool.length) picked.push(pool[0]);
  }
  const dueSet = new Set(todays);
  const more = shuffle(all.filter((s) => dueSet.has(verbLemma(s)) && !picked.includes(s)), rng);
  const rest = shuffle(all.filter((s) => !dueSet.has(verbLemma(s))), rng);
  return shuffle([...picked, ...more, ...rest].slice(0, 10), rng);
}

/**
 * 두 번 틀렸을 때의 정답 공개 한 줄 — 대조언어학: 한국어와 다른 지점을 딱 하나만 짚는다.
 */
export function explainLine(sentence, mode) {
  if (mode === 'subj') {
    const chunk = sentence.w.slice(0, sentence.v).join(' ');
    return sentence.v >= 2
      ? `주어는 "${chunk}" — 한 단어가 아니라 맨 앞 덩어리 전체예요.`
      : `주어는 "${chunk}" — 문장 맨 앞, "누가"에 해당하는 말이에요.`;
  }
  const word = sentence.w[sentence.v].replace(/[.!?]$/, '');
  if (!sentence.be) return `정답은 "${word}" — 동사는 주어(누가) 바로 다음 자리에 서요.`;
  // 과거형까지 "~이다"로 뭉뚱그리면 틀린 설명이 된다 (was/were는 "~였다")
  const past = BE_PAST.includes(word);
  return past
    ? `정답은 "${word}" — 한국어 "~였다"는 붙어서 숨지만, 영어 be동사는 따로 서 있는 진짜 동사예요.`
    : `정답은 "${word}" — 한국어 "~이다"는 붙어서 숨지만, 영어 be동사는 따로 서 있는 진짜 동사예요.`;
}

/** 문장의 동사 lemma (도감 키). 없으면 null — 데이터 오류를 테스트가 잡는다 */
export function verbLemma(sentence) {
  return lemmaOfWord(sentence.w[sentence.v]);
}

/** 빈 판 기록 */
export function emptyRound(mode) {
  return { mode, firstTryHits: 0, bestCombo: 0, trapTaps: 0, beFirstTry: 0, chunkFirstTry: 0 };
}

/**
 * 문장 하나가 끝났을 때 기록을 갱신한다.
 * @param {object} rec emptyRound() 산출물 (제자리 수정)
 * @param {object} sentence
 * @param {boolean} firstTry 틀린 적 없이 잡았는가
 * @param {number} combo 이 문장까지의 연속 성공 수
 */
export function noteSentenceClear(rec, sentence, firstTry, combo) {
  if (firstTry) {
    rec.firstTryHits += 1;
    if (rec.mode === 'verb' && sentence.be) rec.beFirstTry += 1;
    if (rec.mode === 'subj' && sentence.v >= 2) rec.chunkFirstTry += 1;
  }
  rec.bestCombo = Math.max(rec.bestCombo, combo);
}

/**
 * 포획 판정: 첫 시도 정답 = 포획(catch), 재시도 정답 = 목격(seen).
 * 실패해도 남는 것 원칙 — 어느 쪽이든 도감은 앞으로 간다.
 */
export function captureKind(firstTry) {
  return firstTry ? 'catch' : 'seen';
}

// ── 동사 특훈(철자 각인) ─────────────────────────────────────
// "재인 → 산출" 사다리의 마지막 칸. 잡은 동사를 뜻만 보고 철자로 다시 만든다.
// 도감에 있는 동사만 나온다 — 안 잡은 동사를 외우라고 하면 그건 그냥 단어장이다.
const ALPHA = 'abcdefghijklmnopqrstuvwxyz';

/** 정답에 없는 글자에서 미끼 n개 */
export function decoyLetters(word, n, rng = Math.random) {
  const pool = [...ALPHA].filter((c) => !word.includes(c));
  const a = [...pool];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

/** 정답 철자 + 미끼를 섞은 칩 배열 */
export function trainChips(lemma, rng = Math.random) {
  const decoys = decoyLetters(lemma, lemma.length >= 5 ? 3 : 2, rng);
  const all = [...lemma, ...decoys];
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all;
}

/**
 * 특훈 덱 — 아직 각인 안 한 동사를 먼저, 부족하면 이미 각인한 것으로 채운다.
 * be동사(am/is/are/was/were)는 철자가 아니라 짝 고르기가 핵심이라 제외한다.
 * @param {string[]} caught 잡은 동사 lemma 들
 * @param {string[]} trained 이미 각인한 lemma 들
 */
export function makeTrainDeck(caught, trained, rng = Math.random, size = 5) {
  const pool = caught.filter((l) => {
    const v = VERB_BY_LEMMA.get(l);
    return v && v.family === 'act';
  });
  const fresh = pool.filter((l) => !trained.includes(l));
  const old = pool.filter((l) => trained.includes(l));
  const shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  return [...shuffle(fresh), ...shuffle(old)].slice(0, size);
}
