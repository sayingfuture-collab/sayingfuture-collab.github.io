// R3 문장 완성 — 동사 자리가 빈칸, 같은 동사의 다른 모습 중에서 고른다.
// 주어와 시간(지난 일인지)을 보고 판단 — 동사사냥꾼 유령 소환과 같은 3단 피드백.
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

const TALK = ['난 지금 모습이 아냐~', '주어를 다시 봐요!', '나 말고 내 형제!', '시간을 봐요 ⏰'];

export function createVerbRound({ items, stamp, onDone }) {
  const root = el('div', 'play');
  const top = el('div', 'play__top');
  const roundLabel = el('span', 'play__round');
  const comboLabel = el('span', 'play__combo', '🧩 문장');
  top.append(roundLabel, comboLabel);
  const card = el('div', 'play__card');
  root.append(top, card);

  let idx = 0, missCount = 0, busy = false;
  const cells = [];
  let triedWrong = new Set();

  function show() {
    missCount = 0; busy = false;
    triedWrong = new Set();
    const s = items[idx];
    roundLabel.textContent = `문장 ${idx + 1} / ${items.length}`;
    card.innerHTML = '';
    const quest = el('p', 'play__quest');
    quest.innerHTML = '빈칸에 들어갈 <b>알맞은 모습</b>을 고르세요';
    const ko = el('div', 'wordko', `“${s.k}”`);
    const words = el('div', 'words');
    s.w.forEach((word, i) => {
      words.append(el('div', 'word' + (i === s.v ? ' blank' : ''), i === s.v ? '?' : word));
    });
    const choices = el('div', 'choices');
    const rng = rngFor(`verb-choices-${idx}`, stamp);
    shuffled(s.forms, rng).forEach((c) => {
      const b = el('button', 'choice', c);
      b.onclick = () => { if (!busy) pick(b, c); };
      choices.append(b);
    });
    const hint = el('div', 'hintline');
    card.append(quest, ko, words, choices, hint);
  }

  function hintLine() { return card.querySelector('.hintline'); }

  async function pick(btn, c) {
    const s = items[idx];
    if (c !== s.w[s.v]) {
      const repeat = triedWrong.has(c);
      triedWrong.add(c);
      if (!repeat) missCount += 1;
      dodgeSound();
      btn.classList.add('dim');
      btn.querySelector('.bubble')?.remove();
      const b = el('div', 'bubble', TALK[Math.floor(Math.random() * TALK.length)]);
      btn.append(b);
      setTimeout(() => b.remove(), 1500);
      btn.classList.remove('dodge'); void btn.offsetWidth; btn.classList.add('dodge');
      if (missCount >= 2) { reveal(); return; }
      const h = hintLine();
      h.textContent = '주어가 몇 명인지, 지난 일인지 지금 일인지 봐요.';
      h.className = 'hintline';
      return;
    }
    busy = true;
    cells.push(cellOf(missCount, false));
    const blank = card.querySelector('.blank');
    blank.textContent = s.w[s.v];
    blank.classList.add('hit');
    await hitStop(document.body, 70);
    const r = blank.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2);
    popSound(idx + 1); shake(card, 3); buzz(15);
    catchSound();
    floatText(r.left + r.width / 2 - 24, r.top - 40, '🧩 딱!', 'catch big');
    const h = hintLine();
    h.textContent = s.why;
    h.className = 'hintline good';
    setTimeout(next, 1300);
  }

  function reveal() {
    busy = true;
    const s = items[idx];
    cells.push('r');
    const blank = card.querySelector('.blank');
    blank.textContent = s.w[s.v];
    blank.classList.add('reveal');
    const h = hintLine();
    h.innerHTML = `정답은 <b>${s.w[s.v]}</b> — ${s.why}`;
    h.className = 'hintline explain';
    setTimeout(next, 2600);
  }

  function next() {
    idx += 1;
    if (idx < items.length) { show(); return; }
    onDone(cells);
  }

  show();
  return { el: root };
}
