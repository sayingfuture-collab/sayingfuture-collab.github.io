// 순수 게임 로직 — DOM 없음. node --test 로 검사한다.
import { GENERAL, BE, lemmaOfWord } from './data.js';

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

export const BE_FORMS = ['am', 'is', 'are', 'was', 'were'];

/**
 * 빈칸 고르기(산출 1단계): be동사 자리를 비우고 3택.
 * 탭(재인)에서 고르기(선택 산출)로 — 전이 사다리의 다음 칸.
 */
export function makeFillDeck(rng = Math.random) {
  return shuffle([...BE], rng).slice(0, 10).map((s) => {
    const answer = s.w[s.v].replace(/[.!?]$/, '');
    const others = shuffle(BE_FORMS.filter((f) => f !== answer), rng).slice(0, 2);
    return { ...s, answer, choices: shuffle([answer, ...others], rng) };
  });
}

/** 조각 배열(산출 2단계): 단어 조각을 순서대로 눌러 문장을 만든다. 짧은 문장만 */
export function makeOrderDeck(rng = Math.random) {
  const pool = [...GENERAL, ...BE].filter((s) => s.w.length <= 4);
  return shuffle(pool, rng).slice(0, 10).map((s) => ({ ...s, chips: shuffle([...s.w], rng) }));
}

/**
 * 오늘의 사냥터: 복습 기한이 찬 동사들의 문장만. 모자라면 아무 문장으로 채워 10장.
 */
export function makeReviewDeck(due, rng = Math.random) {
  const dueSet = new Set(due);
  const all = [...GENERAL, ...BE];
  const hit = shuffle(all.filter((s) => dueSet.has(verbLemma(s))), rng).slice(0, 10);
  const rest = shuffle(all.filter((s) => !dueSet.has(verbLemma(s))), rng).slice(0, 10 - hit.length);
  return shuffle([...hit, ...rest], rng);
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
  return sentence.be
    ? `정답은 "${word}" — 한국어 "~이다"는 붙어서 숨지만, 영어 be동사는 따로 서 있는 진짜 동사예요.`
    : `정답은 "${word}" — 동사는 주어(누가) 바로 다음 자리에 서요.`;
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
