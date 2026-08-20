// 10연차 결과 격자. 5×2로 한 번에 공개한다. 힌트는 보여주지 않는다.
// 표시만 한다 — 뽑기도 저장도 모른다.

import { artNode } from './art.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * @param {Array<{character: object, isNew: boolean, count: number}>} entries
 * @returns {{el: HTMLElement}}
 */
export function createResultGrid(entries) {
  const root = el('ol', 'result');

  for (const { character, isNew, count } of entries) {
    const li = el('li', 'result__cell');
    li.dataset.tier = character.tier;
    li.append(artNode(character, 'result__art'));
    li.append(el('div', 'result__name', character.name));

    if (isNew) {
      const b = el('div', 'result__badge', 'NEW');
      b.dataset.kind = 'new';
      li.append(b);
    } else if (count > 1) {
      const b = el('div', 'result__badge', `×${count}`);
      b.dataset.kind = 'dup';
      li.append(b);
    }
    root.append(li);
  }

  return { el: root };
}
