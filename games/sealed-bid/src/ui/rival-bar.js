// 라이벌 3명 상시 표시줄. 이모지·이름·생명 하트·금고 3단계·말풍선.
//
// 금고는 정확값을 숨긴다 — "얼마나 남았을까"가 봉인 입찰의 수 싸움이다.
// 말풍선은 리액션 태그를 대사로 바꿔 띄운다. 대사 매핑은 app.js가 넘긴다.

import { PERSONALITIES } from '../game/rivals.js';
import { rivalsOf } from '../game/state.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** 금고 3단계 — 정확값 대신 분위기만 */
function purseTier(gold) {
  if (gold >= 20) return { icon: '💰💰', label: '두둑' };
  if (gold >= 8) return { icon: '💰', label: '보통' };
  return { icon: '🪙', label: '바닥' };
}

export function createRivalBar() {
  const root = el('div', 'rivalbar');
  const cells = new Map(); // rivalId -> {root, hearts, purse, bubble, timer}

  /** 처음 한 번 — 라이벌 칸을 세운다 */
  function build(game) {
    root.replaceChildren();
    cells.clear();
    for (const r of rivalsOf(game)) {
      const P = PERSONALITIES[r.personality];
      const cell = el('div', 'rivalbar__cell');
      cell.dataset.rival = r.id;
      const face = el('div', 'rivalbar__face', P.emoji);
      const name = el('div', 'rivalbar__name', P.name);
      const hearts = el('div', 'rivalbar__hearts');
      const purse = el('div', 'rivalbar__purse');
      const bubble = el('div', 'rivalbar__bubble');
      bubble.dataset.on = 'false';
      cell.append(face, name, hearts, purse, bubble);
      root.append(cell);
      cells.set(r.id, { root: cell, hearts, purse, bubble, timer: null });
    }
    update(game);
  }

  /** 생명·금고를 현재 상태로 */
  function update(game) {
    for (const r of rivalsOf(game)) {
      const c = cells.get(r.id);
      if (!c) continue;
      if (r.eliminated) {
        c.root.dataset.dead = 'true';
        c.hearts.textContent = '☠ 탈락';
        c.purse.textContent = '';
        continue;
      }
      c.root.dataset.dead = 'false';
      c.hearts.textContent = '♥'.repeat(Math.max(0, r.lives));
      const t = purseTier(r.gold);
      c.purse.textContent = `${t.icon} ${t.label}`;
    }
  }

  /**
   * 말풍선 하나. 이미 떠 있으면 갈아끼운다.
   * @param {{hold?: number}} opts hold(ms) 뒤에 사라진다
   */
  function say(rivalId, text, opts = {}) {
    const c = cells.get(rivalId);
    if (!c) return;
    const hold = opts.hold ?? 2600;
    clearTimeout(c.timer);
    c.bubble.textContent = text;
    c.bubble.dataset.on = 'true';
    c.timer = setTimeout(() => { c.bubble.dataset.on = 'false'; }, hold);
  }

  function clearBubbles() {
    for (const c of cells.values()) {
      clearTimeout(c.timer);
      c.bubble.dataset.on = 'false';
    }
  }

  return { el: root, build, update, say, clearBubbles };
}
