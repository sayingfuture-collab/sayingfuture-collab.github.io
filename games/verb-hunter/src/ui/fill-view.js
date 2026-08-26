// 유령 소환(빈칸 고르기) — 산출 사다리 1칸: 탭(재인)에서 "고르기"로.
// be동사 자리가 비어 있고 셋 중 하나를 고른다. am/is/are/was/were 구분이 몸에 붙는 곳.
import { makeFillDeck, emptyRound, noteSentenceClear } from '../game.js';
import { registerCatch, registerSeen, recordRound, getSave, noteRecent } from '../store.js';
import { judgeBadges } from '../badges.js';
import { popSound, dodgeSound, catchSound } from '../audio.js';
import { logRound } from '../log.js';
import { hitStop, shake, burst, floatText, buzz } from '../juice.js';
import { createEndScreen } from './end-screen.js';
import { VERB_BY_LEMMA } from '../data.js';
import { lemmaOfWord } from '../data.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export function createFillView({ onHome }) {
  const root = el('div', 'play');
  const top = el('div', 'play__top');
  const roundLabel = el('span', 'play__round');
  const comboLabel = el('span', 'play__combo');
  top.append(roundLabel, comboLabel);
  const card = el('div', 'play__card');
  root.append(top, card);

  let deck = makeFillDeck();
  let idx = 0, combo = 0, missCount = 0, busy = false;
  let rec = emptyRound('fill');
  let roundCatches = [];
  let triedWrong = new Set(); // 같은 선택지를 또 눌러도 새 실수로 안 센다 (연타 방지)

  // 잘못 고른 유령이 말대꾸를 한다 — 오답은 벌이 아니라 개그 (다른 모드와 톤을 맞춘다)
  const GHOST_TALK = {
    am: '나는 I 전용인데?ㅋ', is: '난 한 명일 때만~', are: '난 여럿 담당이야!',
    was: '난 옛날 얘기 한 명', were: '난 옛날 얘기 여럿~',
  };

  function showSentence() {
    missCount = 0; busy = false;
    triedWrong = new Set();
    const s = deck[idx];
    roundLabel.textContent = `${idx + 1} / ${deck.length}`;
    card.innerHTML = '';
    const quest = el('p', 'play__quest');
    // 시제는 선택지가 이미 정해줬다 — 주어만 보면 된다고 대놓고 말해준다
    quest.innerHTML = '빈칸의 유령 👻 을 소환하라! <b>주어를 보고 고르세요</b>';
    const words = el('div', 'words');
    s.w.forEach((word, i) => {
      const w = el('div', 'word' + (i === s.v ? ' blank' : ''), i === s.v ? '👻 ?' : word);
      words.appendChild(w);
    });
    const choices = el('div', 'choices');
    s.choices.forEach((c) => {
      const b = el('button', 'choice', c);
      b.onclick = () => { if (!busy) pick(b, c); };
      choices.appendChild(b);
    });
    const kzone = el('div', 'kzone');
    const kbtn = el('button', 'kbtn', '💬 무슨 뜻이지?');
    kbtn.onclick = () => { kzone.innerHTML = ''; kzone.append(el('div', 'ktext', `“${s.k}”`)); };
    kzone.append(kbtn);
    const hint = el('div', 'hintline');
    card.append(quest, words, choices, kzone, hint);
  }

  function hintLine() { return card.querySelector('.hintline'); }

  async function pick(btn, c) {
    const s = deck[idx];
    if (c !== s.answer) {
      const repeat = triedWrong.has(c);
      triedWrong.add(c);
      if (!repeat) missCount += 1;
      combo = 0; comboLabel.textContent = '';
      dodgeSound();
      btn.classList.add('dim');
      // 말풍선으로 자기 역할을 말하고 도망간다
      btn.querySelector('.bubble')?.remove();
      const b = el('div', 'bubble', GHOST_TALK[c] || '난 아닌데?ㅋ');
      btn.append(b);
      setTimeout(() => b.remove(), 1600);
      btn.classList.remove('dodge'); void btn.offsetWidth; btn.classList.add('dodge');
      const h = hintLine();
      if (missCount >= 2) { revealAnswer(); return; }
      h.textContent = fillHint(s.answer);
      h.className = 'hintline';
      return;
    }
    busy = true;
    const firstTry = missCount === 0;
    combo = firstTry ? combo + 1 : 1;
    noteSentenceClear(rec, s, firstTry, combo);
    if (firstTry && s.be) rec.beFirstTry += 1;
    noteRecent(firstTry, 'fill');

    // 빈칸이 채워진다 — 유령 소환 연출
    const blank = card.querySelector('.blank');
    blank.textContent = s.w[s.v];
    blank.classList.add('hit', 'caught');
    await hitStop(document.body, 70);
    const r = blank.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2);
    popSound(combo); shake(card, combo >= 5 ? 6 : 3); buzz(15);
    comboLabel.textContent = combo >= 3 ? `🔥 ${combo} 연속!` : combo >= 2 ? `${combo} 연속!` : '';
    card.classList.toggle('glow', combo >= 3);

    const lemma = lemmaOfWord(s.answer);
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
    if (h) { h.textContent = '소환 성공! 👻'; h.className = 'hintline good'; }
    setTimeout(next, 720);
  }

  // 왜 그 be동사인지 — 선택지가 이미 같은 시제라서, 볼 것은 '주어' 하나뿐이다.
  function fillHint(answer) {
    return {
      am: '주어가 I(나)일 때만 쓰는 짝이에요.',
      is: '주어가 한 명 / 한 개일 때예요.',
      are: '주어가 여럿이거나 You일 때예요.',
      was: '주어가 한 명 / 한 개일 때예요 (지난 일).',
      were: '주어가 여럿이거나 You일 때예요 (지난 일).',
    }[answer] || '주어가 몇 명인지 보세요!';
  }

  function revealAnswer() {
    busy = true;
    const s = deck[idx];
    noteRecent(false, 'fill');
    const blank = card.querySelector('.blank');
    blank.textContent = s.w[s.v];
    blank.classList.add('reveal');
    const lemma = lemmaOfWord(s.answer);
    if (lemma) registerSeen(lemma);
    const h = hintLine();
    if (h) {
      h.textContent = `정답은 "${s.answer}" — ${fillHint(s.answer)}`;
      h.className = 'hintline explain';
    }
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
    card.innerHTML = '';
    card.append(createEndScreen({
      perfect: rec.firstTryHits >= deck.length,
      title: '유령 소환 완주!',
      keepHtml:
        `소환한 유령: <b>${roundCatches.length}마리</b><br>` +
        `도감: <b>${save.owned} / ${save.total}</b> — 전부 그대로 남아요<br>` +
        `한 번에 맞힌 빈칸: <b>${rec.firstTryHits}개</b> · 최고 연속: ${rec.bestCombo}`,
      message: rec.firstTryHits >= deck.length
        ? '빈칸만 보고도 유령을 불러냈어요 — be동사가 손에 붙었다는 뜻이에요.'
        : '헷갈린 유령은 다음 소환 때 다시 나와요. 주어만 보면 돼요.',
      earned,
      save,
      buttons: [
        { label: '한 판 더', onClick: restart },
        { label: '홈으로', onClick: onHome, ghost: true },
      ],
    }));
    roundLabel.textContent = ''; comboLabel.textContent = '';
    card.classList.remove('glow');
  }

  function restart() {
    deck = makeFillDeck();
    idx = 0; combo = 0;
    rec = emptyRound('fill');
    roundCatches = [];
    showSentence();
  }

  showSentence();
  return { el: root };
}
