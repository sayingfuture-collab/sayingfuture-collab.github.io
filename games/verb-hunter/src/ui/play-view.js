// 사냥터(플레이) 화면.
// juice 순서(리서치 수치): 터치다운 즉시 반응 → 판정 → 히트스톱 70ms → 파편+음+흔들림.
// 오답은 벌이 아니라 개그 — 말풍선 + 도망 + 힌트 한 줄. 빨간색·경고음 없음.
import { DODGE, dodgeFor, DODGE_SUBJ, CHEERS, CHUNK_CHEERS, VERB_BY_LEMMA } from '../data.js';
import { makeDeck, verbLemma, emptyRound, noteSentenceClear, explainLine } from '../game.js';
import {
  registerCatch, registerSeen, recordRound, getSave,
  noteRecent, recentAccuracy, ruleSeen, markRuleSeen,
} from '../store.js';
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
  review: '도망갔던 동사들이 돌아왔다! <b>주어 바로 다음!</b>',
};

// 첫 입장 때 딱 한 번 보여주는 규칙 카드 — 10초짜리, 스킵 가능.
const RULES = {
  subj: { emoji: '🕵️', title: '주어 사냥법', lines: ['주어 = "누가/무엇이" — 문장 <b>맨 앞 덩어리</b>', '"My brother"처럼 <b>두 단어일 수도</b> 있어요 (전부 탭!)'], ex: '<b>My brother</b> likes games.' },
  verb: { emoji: '🎯', title: '동사 사냥법', lines: ['동사 = "~하다/~이다" — <b>주어 바로 다음</b> 자리', 'is·am·are·was·were도 동사! 유령 👻 처럼 안 보여도 꼭 있어요'], ex: 'The cat <b>is</b> small.' },
};

export function createPlayView({ mode, onHome, deck: fixedDeck }) {
  const root = el('div', 'play');
  const top = el('div', 'play__top');
  const roundLabel = el('span', 'play__round');
  const comboLabel = el('span', 'play__combo');
  top.append(roundLabel, comboLabel);
  const card = el('div', 'play__card');
  root.append(top, card);

  const playMode = mode === 'review' ? 'verb' : mode; // 복습은 동사 사냥 규칙으로 논다
  let deck = fixedDeck || makeDeck(playMode, Math.random, recentAccuracy(playMode));
  let idx = 0, combo = 0, missCount = 0;
  let rec = emptyRound(mode);
  let roundCatches = [];   // 이번 판 포획 [{lemma, isNew, stars}]
  let subjRemain = null;
  let busy = false;        // 연출 중 중복 탭 방지
  let triedWrong = new Set(); // 이번 문장에서 이미 틀린 자리 — 같은 걸 또 눌러도 새 실수로 안 센다

  function showSentence() {
    missCount = 0;
    busy = false;
    triedWrong = new Set();
    const s = deck[idx];
    subjRemain = playMode === 'subj' ? new Set(Array.from({ length: s.v }, (_, i) => i)) : null;
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
    if (playMode === 'subj') tapSubj(wordEl, i);
    else if (i === s.v) correct(wordEl);
    else wrong(wordEl, word, null, i);
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
      wrong(wordEl, null, d, i);
    }
  }

  async function correct(wordEl, alreadyMarked = false) {
    busy = true;
    const s = deck[idx];
    const firstTry = missCount === 0;
    combo = firstTry ? combo + 1 : 1;
    noteSentenceClear(rec, s, firstTry, combo);
    noteRecent(firstTry, playMode); // 은닉 난이도 조절의 재료 — 그 모드의 다음 덱이 이걸 본다
    if (!alreadyMarked) wordEl.classList.add('hit');
    card.querySelectorAll('.word').forEach((w) => w.classList.add('done'));

    // ① 히트스톱 — 온 세상이 70ms 멈춘다
    await hitStop(document.body, 70);

    // ② 터진다: 파편 + 음(콤보 반음계) + 흔들림(정답 전용) + 진동
    const r = wordEl.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2);
    if (playMode === 'verb' || s.v >= 2) wordEl.classList.add('caught');
    popSound(combo);
    shake(card, combo >= 5 ? 6 : 3);
    buzz(15);
    comboLabel.textContent = combo >= 3 ? `🔥 ${combo} 연속!` : combo >= 2 ? `${combo} 연속!` : '';
    comboLabel.className = 'play__combo' + (combo >= 3 ? ' hot' : '');
    card.classList.toggle('glow', combo >= 3);
    if (combo >= 2) floatText(r.left + r.width / 2 - 10, r.top - 14, combo >= 3 ? '🔥' : '○');

    // ③ 포획 — 첫 시도 정답이면 그 문장의 동사가 도감에 잡힌다.
    //    재시도 정답은 '목격'만 — 실루엣이 걷히고 "도망갔다"로 남는다 (다음 판의 이유).
    //    주어 사냥에서는 동사를 판별한 적이 없으니 포획도 안 된다 (목격까지만) —
    //    안 그러면 앞 단어만 눌러도 동사 도감이 차서, 도감이 동사 실력의 지표가 아니게 된다.
    const lemma = verbLemma(s);
    if (lemma && playMode === 'subj') {
      registerSeen(lemma);
    } else if (lemma) {
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

    const cheers = (playMode === 'subj' && s.v >= 2) ? CHUNK_CHEERS : CHEERS;
    const h = hintLine();
    if (h) { h.textContent = cheers[Math.floor(Math.random() * cheers.length)]; h.className = 'hintline good'; }

    setTimeout(next, 720);
  }

  function wrong(wordEl, word, forced, i) {
    // 같은 자리를 또 누른 건 새 실수가 아니다 — 연타로 힌트를 건너뛰고 정답이 공개되는 걸 막는다
    const repeat = i != null && triedWrong.has(i);
    if (i != null) triedWrong.add(i);

    const key = word ? word.toLowerCase() : null;
    const trap = key ? DODGE[key] : null; // 함정(상태·꾸미는 말) 집계는 DODGE 사전에 있는 단어만
    // 집계는 공개 분기보다 먼저 — 두 번째 오답이 함정이어도 기록돼야 '유혹 면역'이 잘못 안 나간다
    if (trap && playMode === 'verb' && !repeat) rec.trapTaps += 1;

    if (!repeat) missCount += 1;
    combo = 0;
    comboLabel.textContent = '';
    card.classList.remove('glow');

    // 피드백 3단 (Li 2010/2014, 저숙련자엔 명시적 피드백):
    // ① 첫 오답 → 개그 + 힌트  ② 재시도 기회 1번  ③ 또 틀리면 정답 공개 + 이유 한 줄.
    if (missCount >= 2) { reveal(); return; }

    const d = forced || trap || dodgeFor(word || '');

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

  // 두 번 틀림 → 정답을 보여주고 이유 한 줄. 벌이 아니라 "다음 판의 재료" 톤.
  function reveal() {
    busy = true;
    const s = deck[idx];
    noteRecent(false, playMode);
    const words = [...card.querySelectorAll('.word')];
    const targets = playMode === 'subj' ? words.slice(0, s.v) : [words[s.v]];
    targets.forEach((w) => w && w.classList.add('reveal'));
    words.forEach((w) => w.classList.add('done'));

    const lemma = verbLemma(s);
    if (lemma && playMode !== 'subj') registerSeen(lemma); // 목격으로 남는다 — 다음 판의 이유

    const h = hintLine();
    if (h) { h.textContent = explainLine(s, playMode); h.className = 'hintline explain'; }
    setTimeout(next, 2600); // 이유를 읽을 시간
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

    const modeName = mode === 'subj' ? '주어 사냥' : mode === 'review' ? '오늘의 사냥터' : '동사 사냥';
    const newCards = roundCatches.filter((c) => c.isNew).length;
    const starUps = roundCatches.filter((c) => !c.isNew && c.starUp).length;

    card.innerHTML = '';
    const end = el('div', 'end');
    end.append(el('div', 'big', perfect ? '🌟' : '🎉'));
    end.append(el('h2', null, `${modeName} 완주!`));

    // "실패해도 남는 것" 3줄 — 한 판도 헛되지 않게 (Hades 원칙)
    const keep = el('div', 'keep');
    keep.innerHTML = mode === 'subj'
      // 주어 사냥은 동사를 잡지 않는다 — 성과도 주어의 말로 적어야 정직하다
      ? `덩어리째 잡은 주어: <b>${rec.chunkFirstTry}개</b><br>` +
        `도감: <b>${save.owned} / ${save.total}</b> — 전부 그대로 남아요<br>` +
        `한 번에 잡은 문장: <b>${rec.firstTryHits}개</b> · 최고 연속: ${rec.bestCombo}`
      : `이번 사냥에서 잡은 동사: <b>${roundCatches.length}마리</b>` +
        (newCards ? ` (새 카드 ${newCards})` : '') + (starUps ? ` (★강화 ${starUps})` : '') + '<br>' +
        `도감: <b>${save.owned} / ${save.total}</b> — 전부 그대로 남아요<br>` +
        `한 번에 잡은 문장: <b>${rec.firstTryHits}개</b> · 최고 연속: ${rec.bestCombo}`;
    end.append(keep);

    end.append(el('p', 'msg', perfect
      ? '망설임 없이 전부 정확했어요. 이제 안 배운 게 아니라 배운 사람이에요.'
      : mode === 'subj'
        ? '주어가 한 단어가 아닐 때가 있다는 것 — 그걸 알아가는 중이에요.'
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
    deck = fixedDeck ? [...fixedDeck].sort(() => Math.random() - 0.5) : makeDeck(playMode, Math.random, recentAccuracy(playMode));
    idx = 0; combo = 0;
    rec = emptyRound(mode);
    roundCatches = [];
    showSentence();
  }

  // 규칙 카드 — 이 모드에 처음 들어왔을 때만. 읽으면(또는 스킵하면) 다신 안 나온다.
  function showRuleCard() {
    const r = RULES[playMode];
    const gate = el('div', 'gate');
    gate.innerHTML = `
      <div class="gate__card rule">
        <div class="gate__emoji">${r.emoji}</div>
        <h2>${r.title}</h2>
        ${r.lines.map((l) => `<p class="rule__line">${l}</p>`).join('')}
        <div class="rule__ex">${r.ex}</div>
      </div>`;
    const go = el('button', 'btn', '알겠어, 사냥 시작!');
    go.onclick = () => { markRuleSeen(playMode); gate.remove(); };
    gate.querySelector('.gate__card').append(go);
    root.append(gate);
  }

  showSentence();
  if (RULES[playMode] && !ruleSeen(playMode)) showRuleCard();
  return { el: root };
}
