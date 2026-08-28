// R2 듣기 — 음원을 듣고 단어 칩을 순서대로 눌러 문장을 재조립한다.
// 다시 듣기는 무제한 (듣기 실력은 반복 청취에서 나온다). 두 번 틀리면 정답 공개.
import { AUDIO_BASE } from '../data-listen.js';
import { cellOf } from '../game.js';
import { rngFor, shuffled } from '../seed.js';
import { popSound, dodgeSound, catchSound } from '../audio.js';
import { hitStop, shake, burst, floatText, buzz } from '../juice.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

const CHIP_TALK = ['다시 들어봐~', '내 차례는 아직!', '귀를 믿어요 👂', '순서가 달라~'];

export function createListenRound({ items, stamp, onDone }) {
  const root = el('div', 'play');
  const top = el('div', 'play__top');
  const roundLabel = el('span', 'play__round');
  const comboLabel = el('span', 'play__combo', '👂 듣기');
  top.append(roundLabel, comboLabel);
  const card = el('div', 'play__card');
  root.append(top, card);

  let idx = 0, missCount = 0, placed = 0, busy = false;
  const cells = [];
  let triedWrong = new Set();
  let audio = null;

  function play() {
    try {
      if (!audio) return;
      audio.currentTime = 0;
      audio.play();
    } catch { /* 자동재생 차단 등 */ }
  }

  function show() {
    missCount = 0; placed = 0; busy = false;
    triedWrong = new Set();
    const s = items[idx];
    const wordsArr = s.t.replace(/[.!?]$/, '').split(' ');
    s._w = wordsArr;
    audio = new Audio(AUDIO_BASE + s.id + '.mp3');
    roundLabel.textContent = `듣기 ${idx + 1} / ${items.length}`;
    card.innerHTML = '';
    const quest = el('p', 'play__quest');
    quest.innerHTML = '들리는 문장을 <b>순서대로</b> 조립하세요 (몇 번이든 다시 들어도 돼요)';
    const pbtn = el('button', 'playbtn', '🔊 듣기');
    pbtn.onclick = play;
    const slots = el('div', 'words slots');
    wordsArr.forEach(() => slots.append(el('div', 'word slot', '·')));
    const chips = el('div', 'words chips');
    const rng = rngFor(`listen-chips-${idx}`, stamp);
    let order = shuffled(wordsArr, rng);
    // 셔플이 원래 순서와 같으면 한 번 더 (조립할 게 없어진다)
    if (order.join(' ') === wordsArr.join(' ') && wordsArr.length > 1) order = [...order].reverse();
    order.forEach((word) => {
      const c = el('div', 'word chip', word);
      c.onclick = () => { if (!busy && !c.classList.contains('used')) tap(c, word); };
      chips.append(c);
    });
    const hint = el('div', 'hintline');
    card.append(quest, pbtn, slots, chips, hint);
    play();
  }

  function hintLine() { return card.querySelector('.hintline'); }

  async function tap(chipEl, word) {
    const s = items[idx];
    if (word !== s._w[placed]) {
      const key = `${placed}:${word}`;
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
      if (missCount >= 2) { reveal(); return; }
      const h = hintLine();
      h.textContent = '한 번 더 들어봐요 — 첫 단어부터 천천히.';
      h.className = 'hintline';
      play();
      return;
    }
    chipEl.classList.add('used');
    const slot = card.querySelectorAll('.slot')[placed];
    slot.textContent = word;
    slot.classList.add('hit');
    popSound(placed + 1);
    placed += 1;
    if (placed < s._w.length) return;

    busy = true;
    cells.push(cellOf(missCount, false));
    await hitStop(document.body, 70);
    const r = slot.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2);
    shake(card, 3); buzz(15);
    catchSound();
    floatText(r.left + r.width / 2 - 30, r.top - 40, '👂 완벽!', 'catch big');
    const h = hintLine();
    h.textContent = '조립 완성! 귀가 좋네요.';
    h.className = 'hintline good';
    setTimeout(next, 1000);
  }

  function reveal() {
    busy = true;
    const s = items[idx];
    cells.push('r');
    const slots = card.querySelectorAll('.slot');
    s._w.forEach((word, i) => { slots[i].textContent = word; slots[i].classList.add('reveal'); });
    card.querySelectorAll('.chip').forEach((c) => c.classList.add('used'));
    const h = hintLine();
    h.innerHTML = `문장은 <b>${s.t}</b> — 한 번 더 들으면서 눈으로 따라가 봐요.`;
    h.className = 'hintline explain';
    play();
    setTimeout(next, 2800);
  }

  function next() {
    try { audio && audio.pause(); } catch { /* */ }
    idx += 1;
    if (idx < items.length) { show(); return; }
    onDone(cells);
  }

  show();
  return { el: root };
}
