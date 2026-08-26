// 기초 캠프(0단계) — 설명 → 연습을 세 번 반복하고, 마지막에 세 칸을 한 문장에서 이어 잡는다.
// 같은 문장 6개가 세 스테이지를 관통한다 (문장 우려먹기 — 인지 부담을 판단 하나로 몰아준다).
import {
  BASIC_SENTENCES, LESSONS, PART_NAME, PART_ASK, BASIC_DODGE, BASIC_HINT,
} from '../basics.js';
import { emptyRound } from '../game.js';
import { recordRound, getSave, noteRecent, markBasicsDone } from '../store.js';
import { judgeBadges } from '../badges.js';
import { popSound, dodgeSound } from '../audio.js';
import { logRound } from '../log.js';
import { hitStop, shake, burst, floatText, confetti, buzz } from '../juice.js';
import { createEndScreen } from './end-screen.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

// 코스 순서 — 설명과 연습이 번갈아 나온다. 마지막 한 칸이 세 개를 잇는 종합.
const STEPS = [
  { type: 'lesson', part: 's' }, { type: 'drill', part: 's' },
  { type: 'lesson', part: 'v' }, { type: 'drill', part: 'v' },
  { type: 'lesson', part: 'o' }, { type: 'drill', part: 'o' },
  { type: 'final' },
];

export function createBasicView({ onHome }) {
  const root = el('div', 'play basic');
  const top = el('div', 'play__top');
  const roundLabel = el('span', 'play__round');
  const comboLabel = el('span', 'play__combo');
  top.append(roundLabel, comboLabel);
  const bar = el('div', 'basic__bar');
  const fill = document.createElement('i');
  bar.append(fill);
  const card = el('div', 'play__card');
  root.append(top, bar, card);

  let step = 0;          // STEPS 안에서의 위치
  let idx = 0;           // 이번 연습에서 몇 번째 문장인지
  let combo = 0, missCount = 0, busy = false;
  let finalPart = 0;     // 종합 단계에서 몇 번째 질문인지
  let finalOrder = [];   // 종합 단계의 질문 순서 (문장마다 섞는다)
  let triedWrong = new Set();
  let rec = emptyRound('basic'); // '한 번 더 보기'가 이전 기록에 얹히지 않도록 let

  // 종합 단계는 묻는 순서를 섞는다 — 늘 주어→동사→목적어면 문장을 안 읽고
  // 왼쪽부터 차례로 눌러도 통과된다 (위치 암기로 빠져나가는 구멍).
  function shuffledParts() {
    const p = ['s', 'v', 'o'];
    for (let i = p.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    return p;
  }

  function progress() {
    fill.style.width = `${Math.round((step / STEPS.length) * 100)}%`;
  }

  function render() {
    progress();
    const s = STEPS[step];
    if (!s) { finish(); return; }
    if (s.type === 'lesson') renderLesson(s.part);
    else if (s.type === 'drill') { idx = 0; renderDrill(s.part); }
    else { idx = 0; finalPart = 0; finalOrder = shuffledParts(); renderFinal(); }
  }

  // ── 설명 화면 ──────────────────────────────────────────────
  function renderLesson(part) {
    const L = LESSONS[part];
    roundLabel.textContent = `설명 · ${PART_NAME[part]}`;
    comboLabel.textContent = '';
    card.innerHTML = '';
    const box = el('div', 'lesson');
    box.innerHTML = `
      <div class="lesson__emoji">${L.emoji}</div>
      <h2 class="lesson__title">${L.title}</h2>
      <div class="lesson__row">
        <span class="lesson__flag">한국어</span>
        <div class="lesson__sent">${L.ko.replace(L.koMark, `<b class="p-${part}">${L.koMark}</b>`)}</div>
      </div>
      <p class="lesson__note">${L.koNote}</p>
      <div class="lesson__row">
        <span class="lesson__flag en">영어</span>
        <div class="lesson__sent">${L.en.replace(L.enMark, `<b class="p-${part}">${L.enMark}</b>`)}</div>
      </div>
      <p class="lesson__note">${L.enNote}</p>
      <div class="lesson__rule">📌 ${L.rule}</div>`;
    const go = el('button', 'btn', '해보러 가기 →');
    go.onclick = () => { step += 1; render(); };
    box.append(go);
    card.append(box);
  }

  // ── 연습 화면 ──────────────────────────────────────────────
  function renderDrill(part) {
    missCount = 0; busy = false;
    triedWrong = new Set();
    const s = BASIC_SENTENCES[idx];
    roundLabel.textContent = `${PART_NAME[part]} 찾기 · ${idx + 1} / ${BASIC_SENTENCES.length}`;
    card.innerHTML = '';
    const quest = el('p', 'play__quest');
    quest.innerHTML = `<b>${PART_ASK[part]}</b> — ${PART_NAME[part]}를 찾아 누르세요`;
    const words = el('div', 'words');
    s.w.forEach((word, i) => {
      const w = el('div', 'word', word);
      w.addEventListener('pointerdown', () => w.classList.add('pressed'));
      w.addEventListener('pointerup', () => w.classList.remove('pressed'));
      w.onclick = () => { if (!busy) tap(w, i, part); };
      words.append(w);
    });
    const kzone = el('div', 'kzone');
    const kbtn = el('button', 'kbtn', '💬 무슨 뜻이지?');
    kbtn.onclick = () => { kzone.innerHTML = ''; kzone.append(el('div', 'ktext', `“${s.k}”`)); };
    kzone.append(kbtn);
    const hint = el('div', 'hintline');
    card.append(quest, words, kzone, hint);
  }

  // ── 종합 화면: 한 문장에서 주어 → 동사 → 목적어를 순서대로 ──
  function renderFinal() {
    missCount = 0; busy = false;
    triedWrong = new Set();
    const s = BASIC_SENTENCES[idx];
    const part = finalOrder[finalPart];
    const solved = finalOrder.slice(0, finalPart); // 이미 맞힌 성분들
    roundLabel.textContent = `세 칸 완성 · ${idx + 1} / 4`;
    card.innerHTML = '';
    const quest = el('p', 'play__quest');
    quest.innerHTML = `🚂 <b>${PART_ASK[part]}</b> — 이번엔 ${PART_NAME[part]}!`;
    const words = el('div', 'words');
    s.w.forEach((word, i) => {
      const w = el('div', 'word', word);
      // 앞서 맞힌 칸은 색을 입은 채로 남는다 — 기차가 채워지는 게 보이게.
      // 단, 잠그지는 않는다. 남은 칸이 하나뿐이면 마지막 판단이 공짜가 되니까.
      const done = solved.find((p) => s[p] === i);
      if (done) w.classList.add('hit', `p-bg-${done}`);
      w.onclick = () => { if (!busy) tap(w, i, part, true); };
      words.append(w);
    });
    const kzone = el('div', 'kzone');
    const kbtn = el('button', 'kbtn', '💬 무슨 뜻이지?');
    kbtn.onclick = () => { kzone.innerHTML = ''; kzone.append(el('div', 'ktext', `“${s.k}”`)); };
    kzone.append(kbtn);
    const hint = el('div', 'hintline');
    card.append(quest, words, kzone, hint);
  }

  function hintLine() { return card.querySelector('.hintline'); }

  function tap(wordEl, i, part, isFinal = false) {
    const s = BASIC_SENTENCES[idx];
    if (i === s[part]) correct(wordEl, part, isFinal);
    else wrong(wordEl, i, part, isFinal);
  }

  async function correct(wordEl, part, isFinal) {
    busy = true;
    const s = BASIC_SENTENCES[idx];
    const firstTry = missCount === 0;
    if (firstTry) rec.firstTryHits += 1;
    combo = firstTry ? combo + 1 : 1;
    rec.bestCombo = Math.max(rec.bestCombo, combo);
    noteRecent(firstTry, 'basic'); // 0단계는 store 가 기록하지 않는다 (숙달의 증거가 아니라서)

    wordEl.classList.add('hit', `p-bg-${part}`);
    await hitStop(document.body, 70);
    const r = wordEl.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2);
    popSound(combo); shake(card, 3); buzz(15);
    floatText(r.left + r.width / 2 - 24, r.top - 34, `${PART_NAME[part]} ✓`, 'catch');
    comboLabel.textContent = combo >= 3 ? `🔥 ${combo} 연속!` : '';

    const h = hintLine();
    if (h) {
      h.innerHTML = isFinal
        ? `${PART_NAME[part]} = <b>${s.w[s[part]].replace(/[.!?]$/, '')}</b> · 한국어로는 "${s.ks[part]}"`
        : `맞아요! ${PART_NAME[part]}는 "${s.ks[part]}" — <b>${s.w[s[part]].replace(/[.!?]$/, '')}</b>`;
      h.className = 'hintline good';
    }

    if (isFinal) {
      finalPart += 1;
      if (finalPart < 3) { setTimeout(renderFinal, 700); return; }
      setTimeout(() => {
        confetti();
        finalPart = 0; idx += 1; finalOrder = shuffledParts();
        if (idx < 4) renderFinal(); else { step += 1; render(); }
      }, 900);
      return;
    }
    setTimeout(() => {
      idx += 1;
      if (idx < BASIC_SENTENCES.length) renderDrill(part);
      else { step += 1; render(); }
    }, 780);
  }

  function wrong(wordEl, i, part, isFinal) {
    const repeat = triedWrong.has(i);
    triedWrong.add(i);
    if (!repeat) missCount += 1; // 같은 자리 연타로 힌트를 건너뛰지 못하게
    combo = 0; comboLabel.textContent = '';
    const s = BASIC_SENTENCES[idx];

    // 두 번 틀리면 정답 공개 (v0.6과 같은 3단 피드백 — 막 누르기도 함께 막힌다)
    if (missCount >= 2) { reveal(part, isFinal); return; }

    // 잘못 잡은 단어가 자기 역할을 말한다 — 오답이 곧 성분 설명이 된다
    const role = i === s.s ? 's' : i === s.v ? 'v' : 'o';
    dodgeSound();
    wordEl.classList.remove('dodge'); void wordEl.offsetWidth;
    wordEl.classList.add('dodge');
    wordEl.querySelector('.bubble')?.remove();
    const b = el('div', 'bubble', BASIC_DODGE[part][role] || '나 아닌데?');
    wordEl.append(b);
    setTimeout(() => b.remove(), 1600);

    const h = hintLine();
    if (h) { h.innerHTML = BASIC_HINT[part]; h.className = 'hintline'; }
  }

  function reveal(part, isFinal) {
    busy = true;
    const s = BASIC_SENTENCES[idx];
    noteRecent(false, 'basic');
    const words = [...card.querySelectorAll('.word')];
    words[s[part]].classList.add('reveal');
    const h = hintLine();
    if (h) {
      h.innerHTML = `${PART_NAME[part]}는 <b>${s.w[s[part]].replace(/[.!?]$/, '')}</b> — 한국어로 "${s.ks[part]}"예요. ${BASIC_HINT[part]}`;
      h.className = 'hintline explain';
    }
    setTimeout(() => {
      if (isFinal) {
        finalPart += 1;
        if (finalPart < 3) { renderFinal(); return; }
        finalPart = 0; idx += 1; finalOrder = shuffledParts();
        if (idx < 4) renderFinal(); else { step += 1; render(); }
        return;
      }
      idx += 1;
      if (idx < BASIC_SENTENCES.length) renderDrill(part);
      else { step += 1; render(); }
    }, 2600);
  }

  // ── 수료 ───────────────────────────────────────────────────
  function finish() {
    markBasicsDone();
    const earned = recordRound(rec, judgeBadges);
    const save = getSave();
    logRound(rec, save);
    fill.style.width = '100%';
    roundLabel.textContent = ''; comboLabel.textContent = '';
    card.innerHTML = '';
    card.append(createEndScreen({
      bigEmoji: '🚂',
      title: '기초 캠프 수료!',
      keepHtml:
        '이제 세 칸을 알아요:<br>' +
        '<b class="p-s">누가</b> → <b class="p-v">뭐 한다</b> → <b class="p-o">무엇을</b><br>' +
        `한 번에 맞힌 문제: <b>${rec.firstTryHits}개</b> · 최고 연속: ${rec.bestCombo}`,
      message: '영어는 "뭐 한다"가 주어 바로 다음에 온다는 것 — 이것만 알아도 절반은 온 거예요.',
      earned,
      save,
      nextLine: '➡️ 다음은 주어 사냥터 — 두 단어짜리 주어도 나와요!',
      buttons: [
        { label: '사냥터로 가기', onClick: onHome },
        // 기록을 새로 시작한다 — 안 그러면 두 번째 완주가 첫 판 성적에 얹혀 60개처럼 찍힌다
        { label: '한 번 더 보기', ghost: true,
          onClick: () => { step = 0; idx = 0; combo = 0; rec = emptyRound('basic'); render(); } },
      ],
    }));
  }

  render();
  return { el: root };
}
