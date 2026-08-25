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
 * 한 판 10문장.
 * verb 모드: be 5 + 일반 5 — 진단에서 틀린 유형(be동사)이 반은 나와야 훈련이 된다.
 * subj 모드: 1단어 주어 5 먼저 → 2단어 주어 5 — 쉬운 성공부터, 그 다음 덩어리.
 */
export function makeDeck(mode, rng = Math.random) {
  if (mode === 'subj') {
    const all = [...GENERAL, ...BE];
    const one = shuffle(all.filter((s) => s.v === 1), rng).slice(0, 5);
    const two = shuffle(all.filter((s) => s.v >= 2), rng).slice(0, 5);
    return [...shuffle(one, rng), ...shuffle(two, rng)];
  }
  return shuffle([
    ...shuffle([...GENERAL], rng).slice(0, 5),
    ...shuffle([...BE], rng).slice(0, 5),
  ], rng);
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
