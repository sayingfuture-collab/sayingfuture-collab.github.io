// 사냥터(플레이) 화면.
// juice 순서(리서치 수치): 터치다운 즉시 반응 → 판정 → 히트스톱 70ms → 파편+음+흔들림.
// 오답은 벌이 아니라 개그 — 말풍선 + 도망 + 힌트 한 줄. 빨간색·경고음 없음.
import { DODGE, DODGE_DEFAULT, DODGE_SUBJ, CHEERS, CHUNK_CHEERS, VERB_BY_LEMMA } from '../data.js';
import { makeDeck, verbLemma, emptyRound, noteSentenceClear } from '../game.js';
import { registerCatch, registerSeen, recordRound, getSave } from '../store.js';
import { judgeBadges, BADGES, BADGE_BY_ID } from '../badges.js';
import { popSound, dodgeSound, catchSound, fanfare } from '../audio.js';
import { logRound } from '../log.js';
import { hitStop, shake, burst, floatText, confetti, buzz } from '../juice.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

const QUEST = {
  verb: '동사는 어디에? <b>주어(누가) 바로 다음!</b>',
  subj: '주어는 어디에? <b>문장 맨 앞 덩어리!</b>',
};

export function createPlayView({ mode, onHome }) {
  const root = el('div', 'play');
  const top = el('div', 'play__top');
  const roundLabel = el('span', 'play__round');
  const comboLabel = el('span', 'play__combo');
  top.append(roundLabel, comboLabel);
  const card = el('div', 'play__card');
  root.append(top, card);

  let deck = makeDeck(mode);
  let idx = 0, combo = 0, missedThis = false;
  let rec = emptyRound(mode);
  let roundCatches = [];   // 이번 판 포획 [{lemma, isNew, stars}]
  let subjRemain = null;
  let busy = false;        // 연출 중 중복 탭 방지

  function showSentence() {
    missedThis = false;
    busy = false;
    const s = deck[idx];
    subjRemain = mode === 'subj' ? new Set(Array.from({ length: s.v }, (_, i) => i)) : null;
    roundLabel.textContent = `${idx + 1} / ${deck.length}`;
    card.innerHTML = '';
    const quest = el('p', 'play__quest');
    quest.innerHTML = QUEST[mode];
    const words = el('div', 'words');
    s.w.forEach((word, i) => {
      const w = el('div', 'word', word);
      // 터치다운 즉시 반응 — 판정보다 먼저 눌린 느낌을 준다
      w.addEventListener('pointerdown', () => w.classList.add('pressed'));
      w.addEventListener('pointerup', () => w.classList.remove('pressed'));
      w.addEventListener('pointerleave', () => w.classList.remove('pressed'));
      w.onclick = () => { if (!busy) tap(w, i, word); };
      words.appendChild(w);
    });
    // 뜻 보기 — 단어가 약한 학생의 사다리. 감점 없음, 문장마다 접힘.
    const kzone = el('div', 'kzone');
    const kbtn = el('button', 'kbtn', '💬 무슨 뜻이지?');
    kbtn.onclick = () => { kzone.innerHTML = ''; kzone.append(el('div', 'ktext', `“${s.k}”`)); };
    kzone.append(kbtn);
    const hint = el('div', 'hintline');
    card.append(quest, words, kzone, hint);
  }

  function hintLine() { return card.querySelector('.hintline'); }

  function tap(wordEl, i, word) {
    const s = deck[idx];
    if (mode === 'subj') tapSubj(wordEl, i);
    else if (i === s.v) correct(wordEl);
    else wrong(wordEl, word);
  }

  function tapSubj(wordEl, i) {
    const s = deck[idx];
    if (i < s.v) {
      if (!subjRemain.has(i)) return;
      subjRemain.delete(i);
      wordEl.classList.add('hit', 'done');
      popSound(1);
      if (subjRemain.size === 0) { correct(wordEl, true); return; }
      const h = hintLine();
      h.textContent = '하나 잡았다! 주어 덩어리가 아직 남았어요 — 몇 단어일까요?';
      h.className = 'hintline part';
    } else {
      const d = i === s.v ? DODGE_SUBJ.verb : DODGE_SUBJ.after;
      wrong(wordEl, null, d);
    }
  }

  async function correct(wordEl, alreadyMarked = false) {
    busy = true;
    const s = deck[idx];
    const firstTry = !missedThis;
    combo = firstTry ? combo + 1 : 1;
    noteSentenceClear(rec, s, firstTry, combo);
    if (!alreadyMarked) wordEl.classList.add('hit');
    card.querySelectorAll('.word').forEach((w) => w.classList.add('done'));

    // ① 히트스톱 — 온 세상이 70ms 멈춘다
    await hitStop(document.body, 70);

    // ② 터진다: 파편 + 음(콤보 반음계) + 흔들림(정답 전용) + 진동
    const r = wordEl.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2);
    if (mode === 'verb' || s.v >= 2) wordEl.classList.add('caught');
    popSound(combo);
    shake(card, combo >= 5 ? 6 : 3);
    buzz(15);
    comboLabel.textContent = combo >= 3 ? `🔥 ${combo} 연속!` : combo >= 2 ? `${combo} 연속!` : '';
    comboLabel.className = 'play__combo' + (combo >= 3 ? ' hot' : '');
    card.classList.toggle('glow', combo >= 3);
    if (combo >= 2) floatText(r.left + r.width / 2 - 10, r.top - 14, combo >= 3 ? '🔥' : '○');

    // ③ 포획 — 첫 시도 정답이면 그 문장의 동사가 도감에 잡힌다.
    //    재시도 정답은 '목격'만 — 실루엣이 걷히고 "도망갔다"로 남는다 (다음 판의 이유).
    const lemma = verbLemma(s);
    if (lemma) {
      if (firstTry) {
        const got = registerCatch(lemma);
        roundCatches.push({ lemma, ...got });
        const v = VERB_BY_LEMMA.get(lemma);
        const label = got.isNew ? `${v.emoji} ${lemma} 포획!` : got.starUp ? `${v.emoji} ${lemma} ★${got.stars}` : `${v.emoji} +1`;
        floatText(r.left + r.width / 2 - 30, r.top - 40, label, 'catch big');
        if (got.isNew || got.starUp) catchSound();
      } else {
        registerSeen(lemma);
      }
    }

    const cheers = (mode === 'subj' && s.v >= 2) ? CHUNK_CHEERS : CHEERS;
    const h = hintLine();
    if (h) { h.textContent = cheers[Math.floor(Math.random() * cheers.length)]; h.className = 'hintline good'; }

    setTimeout(next, 720);
  }

  function wrong(wordEl, word, forced) {
    missedThis = true;
    combo = 0;
    comboLabel.textContent = '';
    card.classList.remove('glow');
    const key = word ? word.toLowerCase() : null;
    const trap = key ? DODGE[key] : null; // 함정(꾸미는 말) 집계는 DODGE 사전에 있는 단어만
    if (trap && mode === 'verb') rec.trapTaps += 1;
    const d = forced || trap || DODGE_DEFAULT[Math.floor(Math.random() * DODGE_DEFAULT.length)];

    // 개그 연출: 말풍선 + 폴짝 도망 + "휙" 소리. 흔들림·빨간색·경고음 없음.
    dodgeSound();
    wordEl.classList.remove('dodge'); void wordEl.offsetWidth;
    wordEl.classList.add('dodge');
    wordEl.querySelector('.bubble')?.remove();
    const b = el('div', 'bubble', d.bubble);
    wordEl.appendChild(b);
    setTimeout(() => b.remove(), 1600);

    const h = hintLine();
    if (h) { h.textContent = d.hint; h.className = 'hintline'; }
  }

  function next() {
    idx += 1;
    if (idx < deck.length) { showSentence(); return; }
    finish();
  }

  function finish() {
    const earned = recordRound(rec, judgeBadges);
    const save = getSave();
    logRound(rec, save); // 원격 기록 — 실패해도 게임은 모른다
    const perfect = rec.firstTryHits >= deck.length;
    confetti();
    fanfare();

    const modeName = mode === 'subj' ? '주어 사냥' : '동사 사냥';
    const newCards = roundCatches.filter((c) => c.isNew).length;
    const starUps = roundCatches.filter((c) => !c.isNew && c.starUp).length;

    card.innerHTML = '';
    const end = el('div', 'end');
    end.append(el('div', 'big', perfect ? '🌟' : '🎉'));
    end.append(el('h2', null, `${modeName} 완주!`));

    // "실패해도 남는 것" 3줄 — 한 판도 헛되지 않게 (Hades 원칙)
    const keep = el('div', 'keep');
    keep.innerHTML =
      `이번 사냥에서 잡은 동사: <b>${roundCatches.length}마리</b>` +
      (newCards ? ` (새 카드 ${newCards})` : '') + (starUps ? ` (★강화 ${starUps})` : '') + '<br>' +
      `도감: <b>${save.owned} / ${save.total}</b> — 전부 그대로 남아요<br>` +
      `한 번에 잡은 문장: <b>${rec.firstTryHits}개</b> · 최고 연속: ${rec.bestCombo}`;
    end.append(keep);

    end.append(el('p', 'msg', perfect
      ? '망설임 없이 전부 정확했어요. 이제 안 배운 게 아니라 배운 사람이에요.'
      : '틀린 동사는 "목격"으로 도감에 남았어요 — 다음 판에 잡으러 가면 돼요.'));

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
      if (earned.some((id) => BADGE_BY_ID.get(id).r === 4)) setTimeout(confetti, 500);
    }

    // 다음 목표: '보이는(진행형)' 칭호만 하나. 숨은 칭호는 예고하지 않는다 —
    // 예고된 보상은 내재동기를 갉아먹는다 (과잉정당화).
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
    roundLabel.textContent = '';
    comboLabel.textContent = '';
    comboLabel.className = 'play__combo';
    card.classList.remove('glow');
  }

  function restart() {
    deck = makeDeck(mode);
    idx = 0; combo = 0;
    rec = emptyRound(mode);
    roundCatches = [];
    showSentence();
  }

  showSentence();
  return { el: root };
}
