// R1 낱말 — 한국어 뜻을 보고 섞인 철자 칩으로 영단어를 조립한다.
// 플래시카드(보고 고르기)가 아니라 철자를 산출하는 게 핵심 — 뜻→형태 방향이라야 외워진다.
// 힌트 사다리: 1회 틀림 = 다음 글자 공개 → 2회 = 발음 재생 → 3회 = 정답 공개.
import { wordChips, cellOf } from '../game.js';
import { rngFor } from '../seed.js';
import { noteMissedWord } from '../store.js';
import { popSound, dodgeSound, catchSound } from '../audio.js';
import { hitStop, shake, burst, floatText, buzz } from '../juice.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

const CHIP_TALK = ['난 이 단어에 없는데?ㅋ', '나 아닌데~', '지금 내 차례 아냐!', '헛다리~'];

export function speakWord(en) {
  try {
    const u = new SpeechSynthesisUtterance(en);
    u.lang = 'en-US'; u.rate = 0.85;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  } catch { /* 미지원 브라우저 */ }
}

export function createWordRound({ words, stamp, onDone }) {
  const root = el('div', 'play');
  const top = el('div', 'play__top');
  const roundLabel = el('span', 'play__round');
  const comboLabel = el('span', 'play__combo', '🔤 낱말');
  top.append(roundLabel, comboLabel);
  const card = el('div', 'play__card');
  root.append(top, card);

  let idx = 0, missCount = 0, filled = 0, busy = false;
  const cells = [];
  let triedWrong = new Set();

  function show() {
    missCount = 0; filled = 0; busy = false;
    triedWrong = new Set();
    const w = words[idx];
    roundLabel.textContent = `낱말 ${idx + 1} / ${words.length}`;
    card.innerHTML = '';
    const quest = el('p', 'play__quest');
    quest.innerHTML = `이 뜻의 영어 단어를 <b>철자 순서대로</b> 눌러 조립하세요`;
    const ko = el('div', 'wordko', `“${w.ko}”`);
    const slots = el('div', 'words slots');
    [...w.en].forEach(() => slots.append(el('div', 'word slot letter', '·')));
    const chips = el('div', 'words chips');
    const rng = rngFor(`chips-${idx}`, stamp);
    wordChips(w, rng).forEach((ch) => {
      const c = el('div', 'word chip letter', ch);
      c.onclick = () => { if (!busy && !c.classList.contains('used')) tap(c, ch); };
      chips.append(c);
    });
    const hint = el('div', 'hintline');
    card.append(quest, ko, slots, chips, hint);
  }

  function hintLine() { return card.querySelector('.hintline'); }
  function slotsEls() { return card.querySelectorAll('.slot'); }

  async function tap(chipEl, ch) {
    const w = words[idx];
    if (ch !== w.en[filled]) { wrong(chipEl, ch); return; }
    chipEl.classList.add('used');
    const slot = slotsEls()[filled];
    slot.textContent = ch;
    slot.classList.add('hit');
    popSound(filled + 1);
    filled += 1;
    if (filled < w.en.length) return;
    await complete(false);
  }

  function wrong(chipEl, ch) {
    const key = `${filled}:${ch}`;
    const repeat = triedWrong.has(key);
    triedWrong.add(key);
    if (!repeat) missCount += 1;
    dodgeSound();
    chipEl.classList.remove('dodge'); void chipEl.offsetWidth;
    chipEl.classList.add('dodge');
    chipEl.querySelector('.bubble')?.remove();
    const b = el('div', 'bubble', CHIP_TALK[Math.floor(Math.random() * CHIP_TALK.length)]);
    chipEl.append(b);
    setTimeout(() => b.remove(), 1500);
    const w = words[idx];
    const h = hintLine();
    if (missCount >= 3) { reveal(); return; }
    if (missCount === 1) {
      // 다음 글자를 하나 열어준다
      const slot = slotsEls()[filled];
      slot.textContent = w.en[filled];
      slot.classList.add('reveal');
      // 열린 글자의 칩 하나를 소비 처리
      const chip = [...card.querySelectorAll('.chip')].find((c) => !c.classList.contains('used') && c.textContent === w.en[filled]);
      if (chip) chip.classList.add('used');
      filled += 1;
      h.textContent = `한 글자 열어줬어요! 이어서 조립해 봐요.`;
      h.className = 'hintline';
      if (filled >= w.en.length) { complete(false); return; }
    } else {
      speakWord(w.en);
      h.textContent = '발음을 들려줄게요 👂 소리 나는 대로 떠올려 봐요.';
      h.className = 'hintline';
    }
  }

  function reveal() {
    busy = true;
    const w = words[idx];
    const slots = slotsEls();
    [...w.en].forEach((ch, i) => { slots[i].textContent = ch; slots[i].classList.add('reveal'); });
    card.querySelectorAll('.chip').forEach((c) => c.classList.add('used'));
    speakWord(w.en);
    const h = hintLine();
    h.innerHTML = `정답은 <b>${w.en}</b> — "${w.ko}". 내일 또 만나면 그때는 잡아봐요!`;
    h.className = 'hintline explain';
    cells.push('r');
    noteMissedWord(w.en);
    setTimeout(next, 2400);
  }

  async function complete(revealed) {
    busy = true;
    const w = words[idx];
    const cell = cellOf(missCount, revealed);
    cells.push(cell);
    if (cell !== 'g') noteMissedWord(w.en);
    await hitStop(document.body, 70);
    const slots = slotsEls();
    const last = slots[slots.length - 1];
    const r = last.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2);
    shake(card, 3); buzz(15);
    catchSound();
    floatText(r.left + r.width / 2 - 30, r.top - 40, `✨ ${w.en}!`, 'catch big');
    speakWord(w.en);
    const h = hintLine();
    h.innerHTML = `<b>${w.en}</b> = "${w.ko}" 완성!`;
    h.className = 'hintline good';
    setTimeout(next, 1100);
  }

  function next() {
    idx += 1;
    if (idx < words.length) { show(); return; }
    onDone(cells);
  }

  show();
  return { el: root };
}
