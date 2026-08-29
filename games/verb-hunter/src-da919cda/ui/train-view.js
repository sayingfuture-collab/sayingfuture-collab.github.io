// 동사 특훈(철자 각인) — 사다리의 마지막 칸: 탭(재인) → 고르기 → 조립 → **철자 산출**.
// 도감에서 잡은 동사만 나온다. "수집한 것을 진짜 내 것으로 만드는" 자리라
// 새 동사를 외우게 하는 단어장이 아니라, 이미 잡은 것의 마무리다.
// 3단 피드백: 1회 틀림 = 첫 글자 공개 → 2회 = 남은 절반 공개 → 3회 = 정답 공개.
import { makeTrainDeck, trainChips, emptyRound } from '../game.js';
import { caughtLemmas, isTrained, markTrained, recordRound, getSave, noteRecent } from '../store.js';
import { judgeBadges } from '../badges.js';
import { popSound, dodgeSound, catchSound } from '../audio.js';
import { logRound } from '../log.js';
import { hitStop, shake, burst, floatText, buzz } from '../juice.js';
import { createEndScreen } from './end-screen.js';
import { VERB_BY_LEMMA } from '../data.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

const CHIP_TALK = ['난 이 동사에 없는데?ㅋ', '나 말고!', '내 차례 아냐~', '헛다리~'];

function speak(en) {
  try {
    const u = new SpeechSynthesisUtterance(en);
    u.lang = 'en-US'; u.rate = 0.85;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  } catch { /* 미지원 브라우저는 조용히 넘어간다 */ }
}

export function createTrainView({ onHome }) {
  const root = el('div', 'play');
  const top = el('div', 'play__top');
  const roundLabel = el('span', 'play__round');
  const comboLabel = el('span', 'play__combo');
  top.append(roundLabel, comboLabel);
  const card = el('div', 'play__card');
  root.append(top, card);

  const trainedBefore = caughtLemmas().filter((l) => isTrained(l));
  let deck = makeTrainDeck(caughtLemmas(), trainedBefore);
  let idx = 0, combo = 0, missCount = 0, filled = 0, busy = false;
  let rec = emptyRound('train');
  let newlyTrained = [];
  let triedWrong = new Set();

  function show() {
    missCount = 0; filled = 0; busy = false;
    triedWrong = new Set();
    const lemma = deck[idx];
    const v = VERB_BY_LEMMA.get(lemma);
    roundLabel.textContent = `${idx + 1} / ${deck.length}`;
    card.innerHTML = '';
    const quest = el('p', 'play__quest');
    quest.innerHTML = '잡은 동사를 <b>철자로 다시 만들어</b> 각인하라! 🧠';
    const face = el('div', 'trainface');
    face.innerHTML = `<div class="trainface__emo">${v.emoji}</div><div class="trainface__ko">“${v.ko}”</div>`;
    const slots = el('div', 'words slots');
    [...lemma].forEach(() => slots.append(el('div', 'word slot letter', '·')));
    const chips = el('div', 'words chips');
    trainChips(lemma).forEach((ch) => {
      const c = el('div', 'word chip letter', ch);
      c.onclick = () => { if (!busy && !c.classList.contains('used')) tap(c, ch); };
      chips.append(c);
    });
    const sound = el('button', 'kbtn', '🔊 소리 듣기');
    sound.onclick = () => speak(lemma);
    const hint = el('div', 'hintline');
    card.append(quest, face, slots, chips, sound, hint);
  }

  function hintLine() { return card.querySelector('.hintline'); }
  function slotEls() { return card.querySelectorAll('.slot'); }

  function useChip(ch) {
    const chip = [...card.querySelectorAll('.chip')]
      .find((c) => !c.classList.contains('used') && (c.firstChild ? c.firstChild.textContent : c.textContent) === ch);
    if (chip) chip.classList.add('used');
  }

  function openLetters(n) {
    const lemma = deck[idx];
    const slots = slotEls();
    for (let k = 0; k < n && filled < lemma.length; k++) {
      slots[filled].textContent = lemma[filled];
      slots[filled].classList.add('reveal');
      useChip(lemma[filled]);
      filled += 1;
    }
  }

  async function tap(chipEl, ch) {
    const lemma = deck[idx];
    if (ch !== lemma[filled]) { wrong(chipEl, ch); return; }
    chipEl.classList.add('used');
    const slot = slotEls()[filled];
    slot.textContent = ch;
    slot.classList.add('hit');
    popSound(filled + 1);
    filled += 1;
    if (filled < lemma.length) return;
    await complete();
  }

  function wrong(chipEl, ch) {
    const key = `${filled}:${ch}`;
    const repeat = triedWrong.has(key);
    triedWrong.add(key);
    if (!repeat) missCount += 1; // 같은 칩 연타로 힌트를 건너뛰지 못하게
    combo = 0; comboLabel.textContent = '';
    dodgeSound();
    chipEl.classList.remove('dodge'); void chipEl.offsetWidth;
    chipEl.classList.add('dodge');
    chipEl.querySelector('.bubble')?.remove();
    const b = el('div', 'bubble', CHIP_TALK[Math.floor(Math.random() * CHIP_TALK.length)]);
    chipEl.append(b);
    setTimeout(() => b.remove(), 1500);

    const lemma = deck[idx];
    const h = hintLine();
    if (missCount >= 3) { reveal(); return; }
    if (missCount === 1) {
      openLetters(1);
      h.textContent = '한 글자 열어줬어요. 이어서 만들어 봐요!';
    } else {
      const rest = Math.ceil((lemma.length - filled) / 2);
      openLetters(rest);
      speak(lemma);
      h.textContent = '절반 더 열고 소리도 들려줄게요 👂';
    }
    h.className = 'hintline';
    if (filled >= lemma.length) { complete(); return; }
  }

  async function complete() {
    busy = true;
    const lemma = deck[idx];
    const v = VERB_BY_LEMMA.get(lemma);
    const firstTry = missCount === 0;
    if (firstTry) rec.firstTryHits += 1;
    combo = firstTry ? combo + 1 : 1;
    rec.bestCombo = Math.max(rec.bestCombo, combo);
    noteRecent(firstTry, 'train');
    // 각인은 "한 번에 만들어냈을 때"만 — 힌트로 채운 건 아직 내 것이 아니다
    if (firstTry && !isTrained(lemma)) { markTrained(lemma); newlyTrained.push(lemma); }

    await hitStop(document.body, 70);
    const slots = slotEls();
    const r = slots[slots.length - 1].getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2);
    shake(card, combo >= 5 ? 6 : 3); buzz(15);
    catchSound();
    floatText(r.left + r.width / 2 - 30, r.top - 40,
      firstTry ? `🧠 ${lemma} 각인!` : `${v.emoji} ${lemma}`, 'catch big');
    comboLabel.textContent = combo >= 3 ? `🔥 ${combo} 연속!` : combo >= 2 ? `${combo} 연속!` : '';
    card.classList.toggle('glow', combo >= 3);
    speak(lemma);

    const h = hintLine();
    h.innerHTML = `<b>${lemma}</b> = "${v.ko}"`;
    h.className = 'hintline good';
    setTimeout(next, 1100);
  }

  function reveal() {
    busy = true;
    const lemma = deck[idx];
    const v = VERB_BY_LEMMA.get(lemma);
    noteRecent(false, 'train');
    const slots = slotEls();
    [...lemma].forEach((ch, i) => { slots[i].textContent = ch; slots[i].classList.add('reveal'); });
    card.querySelectorAll('.chip').forEach((c) => c.classList.add('used'));
    speak(lemma);
    const h = hintLine();
    h.innerHTML = `<b>${lemma}</b> = "${v.ko}" — 다음 특훈 때 또 나와요. 그때 잡아봐요!`;
    h.className = 'hintline explain';
    setTimeout(next, 2400);
  }

  function next() {
    idx += 1;
    if (idx < deck.length) { show(); return; }
    finish();
  }

  function finish() {
    const earned = recordRound(rec, judgeBadges);
    const save = getSave();
    logRound(rec, save);
    card.innerHTML = '';
    const names = newlyTrained.map((l) => `<b>${l}</b>`).join(' · ');
    card.append(createEndScreen({
      bigEmoji: '🧠',
      perfect: rec.firstTryHits >= deck.length,
      title: '특훈 완료!',
      keepHtml:
        (newlyTrained.length
          ? `새로 각인한 동사: ${names}<br>`
          : '이번엔 새 각인은 없었어요 — 대신 손이 기억하고 있어요<br>') +
        `각인한 동사: <b>${save.trained} / ${save.total}</b><br>` +
        `한 번에 만든 동사: <b>${rec.firstTryHits}개</b> · 최고 연속: ${rec.bestCombo}`,
      message: rec.firstTryHits >= deck.length
        ? '뜻만 보고 철자를 다 만들었어요 — 이제 읽는 게 아니라 쓸 수 있는 동사예요.'
        : '힌트로 채운 동사는 다음 특훈에 또 나와요. 그때가 진짜예요.',
      earned,
      save,
      buttons: [
        { label: '한 번 더', onClick: restart },
        { label: '홈으로', onClick: onHome, ghost: true },
      ],
    }));
    roundLabel.textContent = ''; comboLabel.textContent = '';
    card.classList.remove('glow');
  }

  function restart() {
    deck = makeTrainDeck(caughtLemmas(), caughtLemmas().filter((l) => isTrained(l)));
    idx = 0; combo = 0;
    rec = emptyRound('train');
    newlyTrained = [];
    show();
  }

  show();
  return { el: root };
}
