// 문장 조립(조각 배열) — 산출 사다리 2칸: 어순을 직접 만든다.
// 흩어진 단어 조각을 순서대로 눌러 문장을 완성한다. 한국어 어순 전이를 정면으로 교정하는 곳.
import { makeOrderDeck, emptyRound, noteSentenceClear, verbLemma, explainLine } from '../game.js';
import { registerCatch, registerSeen, recordRound, getSave, noteRecent } from '../store.js';
import { judgeBadges, BADGES, BADGE_BY_ID } from '../badges.js';
import { popSound, dodgeSound, catchSound, fanfare } from '../audio.js';
import { logRound } from '../log.js';
import { hitStop, shake, burst, floatText, confetti, buzz } from '../juice.js';
import { VERB_BY_LEMMA } from '../data.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export function createOrderView({ onHome }) {
  const root = el('div', 'play');
  const top = el('div', 'play__top');
  const roundLabel = el('span', 'play__round');
  const comboLabel = el('span', 'play__combo');
  top.append(roundLabel, comboLabel);
  const card = el('div', 'play__card');
  root.append(top, card);

  let deck = makeOrderDeck();
  let idx = 0, combo = 0, missCount = 0, busy = false;
  let placed = 0; // 지금까지 맞게 놓은 조각 수
  let rec = emptyRound('order');
  let roundCatches = [];

  function showSentence() {
    missCount = 0; placed = 0; busy = false;
    const s = deck[idx];
    roundLabel.textContent = `${idx + 1} / ${deck.length}`;
    card.innerHTML = '';
    const quest = el('p', 'play__quest');
    quest.innerHTML = '조각을 <b>순서대로</b> 눌러 문장을 조립하라! 🧩';
    // 조립되는 자리
    const slots = el('div', 'words slots');
    s.w.forEach(() => slots.append(el('div', 'word slot', '·')));
    // 흩어진 조각들
    const chips = el('div', 'words chips');
    s.chips.forEach((word) => {
      const c = el('div', 'word chip', word);
      c.onclick = () => { if (!busy && !c.classList.contains('used')) tapChip(c, word); };
      chips.append(c);
    });
    const kzone = el('div', 'kzone');
    const kbtn = el('button', 'kbtn', '💬 무슨 뜻이지?');
    kbtn.onclick = () => { kzone.innerHTML = ''; kzone.append(el('div', 'ktext', `“${s.k}”`)); };
    kzone.append(kbtn);
    const hint = el('div', 'hintline');
    card.append(quest, slots, chips, kzone, hint);
  }

  function hintLine() { return card.querySelector('.hintline'); }

  async function tapChip(chipEl, word) {
    const s = deck[idx];
    if (word !== s.w[placed]) {
      // 어긋난 조각 — 자리를 알려주는 힌트로
      missCount += 1;
      combo = 0; comboLabel.textContent = '';
      dodgeSound();
      chipEl.classList.remove('dodge'); void chipEl.offsetWidth;
      chipEl.classList.add('dodge');
      const h = hintLine();
      if (missCount >= 2) { revealOrder(); return; }
      h.textContent = placed === 0
        ? '문장의 첫 조각은 주어(누가)! 대문자로 시작해요.'
        : `다음 자리는 "${s.w.slice(0, placed).join(' ')}" 다음에 올 말이에요.`;
      h.className = 'hintline';
      return;
    }
    // 맞는 조각 — 슬롯에 착!
    chipEl.classList.add('used');
    const slot = card.querySelectorAll('.slot')[placed];
    slot.textContent = word;
    slot.classList.add('hit');
    popSound(placed + 1);
    placed += 1;
    if (placed < s.w.length) return;

    // 문장 완성!
    busy = true;
    const firstTry = missCount === 0;
    combo = firstTry ? combo + 1 : 1;
    noteSentenceClear(rec, s, firstTry, combo);
    noteRecent(firstTry);
    await hitStop(document.body, 70);
    const r = slot.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2);
    shake(card, combo >= 5 ? 6 : 3); buzz(15);
    comboLabel.textContent = combo >= 3 ? `🔥 ${combo} 연속!` : combo >= 2 ? `${combo} 연속!` : '';
    card.classList.toggle('glow', combo >= 3);

    const lemma = verbLemma(s);
    if (lemma) {
      if (firstTry) {
        const got = registerCatch(lemma);
        roundCatches.push({ lemma, ...got });
        const v = VERB_BY_LEMMA.get(lemma);
        floatText(r.left + r.width / 2 - 30, r.top - 40,
          got.isNew ? `${v.emoji} ${lemma} 포획!` : got.starUp ? `${v.emoji} ${lemma} ★${got.stars}` : `${v.emoji} +1`, 'catch big');
        if (got.isNew || got.starUp) catchSound();
      } else registerSeen(lemma);
    }
    const h = hintLine();
    if (h) { h.textContent = '조립 완성! 이게 영어 어순이에요.'; h.className = 'hintline good'; }
    setTimeout(next, 820);
  }

  function revealOrder() {
    busy = true;
    const s = deck[idx];
    noteRecent(false);
    const slots = card.querySelectorAll('.slot');
    s.w.forEach((word, i) => { slots[i].textContent = word; slots[i].classList.add('reveal'); });
    card.querySelectorAll('.chip').forEach((c) => c.classList.add('used'));
    const lemma = verbLemma(s);
    if (lemma) registerSeen(lemma);
    const h = hintLine();
    if (h) { h.textContent = `순서는 이렇게! ${explainLine(s, 'verb')}`; h.className = 'hintline explain'; }
    setTimeout(next, 2600);
  }

  function next() {
    idx += 1;
    if (idx < deck.length) { showSentence(); return; }
    finish();
  }

  function finish() {
    const earned = recordRound(rec, judgeBadges);
    const save = getSave();
    logRound(rec, save);
    const perfect = rec.firstTryHits >= deck.length;
    confetti(); fanfare();
    card.innerHTML = '';
    const end = el('div', 'end');
    end.append(el('div', 'big', perfect ? '🌟' : '🎉'));
    end.append(el('h2', null, '문장 조립 완주!'));
    const keep = el('div', 'keep');
    keep.innerHTML =
      `조립하며 잡은 동사: <b>${roundCatches.length}마리</b><br>` +
      `도감: <b>${save.owned} / ${save.total}</b> — 전부 그대로 남아요<br>` +
      `한 번에 조립한 문장: <b>${rec.firstTryHits}개</b> · 최고 연속: ${rec.bestCombo}`;
    end.append(keep);
    end.append(el('p', 'msg', perfect
      ? '어순을 직접 만들었어요 — 이제 읽는 사람이 아니라 쓰는 사람이에요.'
      : '헷갈린 문장은 힌트가 알려준 대로 — 주어 먼저, 동사는 바로 다음.'));
    if (earned.length) {
      end.append(el('div', 'badge-title', '🏅 칭호 획득!'));
      earned.forEach((id, i) => {
        const b = BADGE_BY_ID.get(id);
        const bc = el('div', `badge-card r${b.r}`);
        bc.style.animationDelay = `${i * 0.25}s`;
        bc.append(el('div', 'stars', '★'.repeat(b.r)));
        bc.append(el('div', 'bname', b.n));
        bc.append(el('div', 'bdesc', b.d || b.cond));
        end.append(bc);
      });
    }
    const nextGoal = BADGES.find((b) => !b.hidden && !save.badges.includes(b.id));
    if (nextGoal) end.append(el('div', 'next-goal', `🔒 ${nextGoal.n} — ${nextGoal.cond}`));
    const btns = el('div', 'btns');
    const again = el('button', 'btn', '한 판 더');
    again.onclick = restart;
    const home = el('button', 'btn ghost', '홈으로');
    home.onclick = onHome;
    btns.append(again, home);
    end.append(btns);
    card.append(end);
    roundLabel.textContent = ''; comboLabel.textContent = '';
    card.classList.remove('glow');
  }

  function restart() {
    deck = makeOrderDeck();
    idx = 0; combo = 0;
    rec = emptyRound('order');
    roundCatches = [];
    showSentence();
  }

  showSentence();
  return { el: root };
}
