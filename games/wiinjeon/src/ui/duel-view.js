// 둘이 뽑기 화면. 1번 차례 → 1번 격자 → 2번 차례 → 2번 격자 → 결과.
// 뽑기는 직접 하지 않는다 — 받은 pull(10)만 부른다. 판정은 duel.js. 격자는 result-grid 그대로.
//
// **각자 자기 버튼을 누른다.** 긴장이 "누르는 순간"에 있다 — 동생이랑 우오오오가 났던 그 순간이
// 뽑기 버튼을 누르던 순간이었다. 1번이 2번 몫까지 눌러주면 그게 없어진다.
//
// 공개는 기존 격자(10장 한 번에). 한 장씩 뒤집기는 일부러 안 했다 —
// 두 번째 판이 일어나는지부터 보고, 안 일어나면 그때 연출 탓인지 가르는 용도로 붙인다.

import { createResultGrid } from './result-grid.js';
import { countTiers, judge, notePlayed, noteRematch } from '../duel.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// 1P/2P 가 아니라 1번/2번 — 저디지털에게도 읽혀야 한다(페르소나 4차 73세).
const LABEL = { 1: '1번', 2: '2번' };

function tierLine(c) {
  return `SSR ${c.SSR} · SR ${c.SR} · R ${c.R}`;
}

function button(text, sub = false) {
  const b = el('button', sub ? 'duel__btn duel__btn--sub' : 'duel__btn', text);
  b.type = 'button';
  return b;
}

/**
 * @param {{
 *   pull: (n: number) => Array<{character: object, isNew: boolean, count: number}> | null,
 *   canRematch: () => boolean,
 *   onPulled: () => void,
 *   onExit: () => void,
 * }} deps
 * @returns {{ el: HTMLElement, start: () => void }}
 */
export function createDuelView({ pull, canRematch, onPulled, onExit }) {
  const root = el('div', 'duel');
  const results = { 1: null, 2: null };

  // 언제든 그만둘 수 있다. 이미 뽑은 건 도감에 남는다(pull 이 이미 기록했다).
  function quit() {
    root.replaceChildren(el('div', 'duel__done', '둘이 뽑기를 그만뒀어요'));
    onExit();
  }

  function showTurn(who) {
    const box = el('div', 'duel__turn');
    box.append(el('div', 'duel__who', `${LABEL[who]} 차례`));
    const go = button('뽑기');
    go.onclick = () => {
      go.disabled = true;  // 연타 방지. 한 번 누르면 결과가 뜨거나 끝난다
      const entries = pull(10);
      if (!entries) { showShort(who); return; }
      results[who] = entries;
      showGrid(who, entries);
      onPulled();  // 격자를 올린 **뒤에** — 화면이 칭호 줄을 root 끝에 붙이므로 순서가 바뀌면 덮인다
    };
    box.append(go);
    if (who === 1) box.append(el('div', 'duel__hint', '각자 자기 차례에 누르세요'));
    const q = el('button', 'duel__quit', '그만');
    q.type = 'button';
    q.onclick = quit;
    box.append(q);
    root.replaceChildren(box);
  }

  function showGrid(who, entries) {
    const box = el('div', 'duel__grid');
    box.append(el('div', 'duel__who', LABEL[who]));
    box.append(createResultGrid(entries).el);
    box.append(el('div', 'duel__count', tierLine(countTiers(entries))));
    const next = button(who === 1 ? '폰 넘기기 → 2번 차례' : '결과 보기');
    next.onclick = () => (who === 1 ? showTurn(2) : showResult());
    box.append(next);
    root.replaceChildren(box);
  }

  // 시작할 땐 20장이 있었는데 그 사이 다른 탭에서 썼을 수 있다. 그러면 2번 차례에 막힌다.
  // 막힌 이유가 보여야 한다 — 버튼만 죽어 있으면 고장으로 보인다.
  function showShort(who) {
    const box = el('div', 'duel__turn');
    box.append(el('div', 'duel__who', `${LABEL[who]} 차례`));
    box.append(el('div', 'duel__short', '권이 모자라서 여기서 끝납니다. 뽑은 건 도감에 있어요.'));
    const done = button('끝', true);
    done.onclick = quit;
    box.append(done);
    root.replaceChildren(box);
  }

  function showResult() {
    const a = countTiers(results[1]);
    const b = countTiers(results[2]);
    const w = judge(a, b);
    notePlayed();

    const box = el('div', 'duel__result');
    box.append(el('div', 'duel__verdict', w === 0 ? '무승부!' : `${LABEL[w]} 승!`));

    const lines = el('div', 'duel__lines');
    const l1 = el('div', 'duel__line', `1번  ${tierLine(a)}`);
    const l2 = el('div', 'duel__line', `2번  ${tierLine(b)}`);
    if (w === 1) l1.classList.add('duel__line--win');
    if (w === 2) l2.classList.add('duel__line--win');
    lines.append(l1, l2);
    box.append(lines);

    // 20장은 전부 폰 주인 도감에 들어간다. "넘어간다"는 화면 문구로만 — 손님 저장소는 다음 칸.
    // 문구를 「칩시다」로 쓴 건 거짓말이 되지 않게 하려는 것이다(스펙 ㄱ).
    box.append(el('div', 'duel__stake',
      w === 0 ? '한 판 더?' : `이번 판 20장은 ${LABEL[w]} 거로 칩시다`));

    const row = el('div', 'duel__row');
    const again = button('한 판 더');
    again.disabled = !canRematch();
    again.onclick = () => {
      noteRematch();  // 두 번째 판이 일어나는지 — 이 기능의 유일한 계기판
      results[1] = results[2] = null;
      showTurn(1);
    };
    const done = button('끝', true);
    done.onclick = () => {
      again.disabled = done.disabled = true;  // 결과는 남겨둔다 — 보면서 얘기할 수 있게
      onExit();
    };
    row.append(again, done);
    box.append(row);
    root.replaceChildren(box);
  }

  return { el: root, start: () => showTurn(1) };
}
