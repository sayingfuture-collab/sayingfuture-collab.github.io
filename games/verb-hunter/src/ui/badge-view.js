// 칭호 방 — 얻은 칭호를 다시 보는 곳.
// 보이는 칭호는 조건까지 공개(진행형이라 목표로 안전), 숨은 칭호는 얻기 전엔 ??? —
// 조건을 예고하면 보상이 목적이 된다 (과잉정당화). 얻고 나면 전부 공개.
import { BADGES } from '../badges.js';
import { getSave } from '../store.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export function createBadgeView({ onBack }) {
  const root = el('div', 'bdgview');

  function render() {
    const owned = new Set(getSave().badges);
    root.innerHTML = '';
    root.append(el('h2', null, '🏅 칭호'));
    root.append(el('div', 'dex__count', `${[...owned].length} / ${BADGES.length} 개`));

    const list = el('div', 'bdg__list');
    for (const b of BADGES) {
      const has = owned.has(b.id);
      const card = el('div', `badge-card r${b.r}` + (has ? '' : ' locked'));
      card.append(el('div', 'stars', '★'.repeat(b.r)));
      if (has) {
        card.append(el('div', 'bname', b.n));
        card.append(el('div', 'bdesc', b.d || b.cond));
      } else if (!b.hidden) {
        card.append(el('div', 'bname', `🔒 ${b.n}`));
        card.append(el('div', 'bdesc', b.cond));
      } else {
        card.append(el('div', 'bname', '???'));
        card.append(el('div', 'bdesc', '사냥하다 보면 뜻밖에 만난다'));
      }
      list.append(card);
    }
    root.append(list);

    const back = el('div', 'backrow');
    const btn = el('button', 'btn ghost', '홈으로');
    btn.onclick = onBack;
    back.append(btn);
    root.append(back);
  }

  render();
  return { el: root, refresh: render };
}
