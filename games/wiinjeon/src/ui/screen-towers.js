// 탑 목록. 여덟 개를 늘어놓고 어디까지 깼는지 보여준다.
// 스타일은 screen-towers.css 에 있다 — 쓰는 쪽에서 link 해야 한다.
//
// **탑을 고르면 전투 화면으로 넘긴다.** 편성을 여기서 또 짜게 하지 않는다 —
// 같은 편성 화면이 두 군데 있으면 어느 쪽이 진짜인지 헷갈리고, 둘 다 고쳐야 한다.

import { TOWERS, TOWER_FLOORS, RAINBOW, GOLD_TOWER, rainbowDone, isOpen } from '../towers/catalog.js';
import { getTowerClears, goldTowerReadyToday } from '../storage.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * @param {{onPick: (tower: object) => void}} deps
 * @returns {{el: HTMLElement, refresh: () => void}}
 */
export function createTowersScreen({ onPick }) {
  const root = el('section', 'towers');

  const head = el('header', 'towers__head');
  const count = el('div', 'towers__count');
  const note = el('div', 'towers__note',
    `탑은 ${TOWER_FLOORS}층에서 끝납니다. 완주하면 골드를 받습니다.`);
  head.append(count, note);

  const list = el('ol', 'towers__list');

  // 칸은 한 번만 만들고 다시 그릴 때 내용만 갈아 끼운다.
  const cells = TOWERS.map((t) => {
    const li = el('li', 'towers__cell');
    li.dataset.id = t.id;
    li.style.setProperty('--tower', t.color);

    const mark = el('div', 'towers__mark', t.mark);
    const main = el('div', 'towers__main');
    const name = el('div', 'towers__name', t.name);
    const hint = el('div', 'towers__hint', t.hint);
    const state = el('div', 'towers__state');
    main.append(name, hint, state);

    const go = el('button', 'towers__go', '도전');
    go.type = 'button';
    go.onclick = () => onPick(t);

    li.append(mark, main, go);
    list.append(li);
    return { li, state, go, tower: t };
  });

  function refresh() {
    const clears = getTowerClears();
    const has = new Set(clears);
    const rainbow = rainbowDone(clears);

    count.replaceChildren(
      '깬 탑 ', el('b', null, String(clears.length)), ` / ${TOWERS.length}`
    );
    // 무지개를 넘었는지가 이 화면의 큰 줄거리다. 넘기 전에는 남은 개수를 보여준다.
    const left = RAINBOW.filter((t) => !has.has(t.id)).length;
    note.textContent = rainbow
      ? `무지개를 넘었습니다 — ${GOLD_TOWER.mark} ${GOLD_TOWER.name}이 열려 있습니다`
      : `일곱 색을 다 깨면 ${GOLD_TOWER.mark} ${GOLD_TOWER.name}이 열립니다 (${left}개 남음)`;

    for (const cell of cells) {
      const { li, state, go, tower } = cell;
      const done = has.has(tower.id);
      const open = isOpen(tower, clears);
      li.dataset.done = String(done);
      li.dataset.open = String(open);
      go.disabled = !open;

      if (!open) {
        state.textContent = '일곱 색을 다 깨야 열립니다';
        go.textContent = '잠김';
        continue;
      }
      go.textContent = done ? '다시' : '도전';
      // ⚠️ 첫 완주와 재완주의 몫이 다르다. **안 밝히면 「왜 이것밖에 안 주지」가 된다.**
      if (tower.id === GOLD_TOWER.id) {
        state.textContent = goldTowerReadyToday()
          ? `오늘 몫 ${tower.again.toLocaleString()} 골드`
          : '오늘 몫은 이미 받았습니다';
      } else if (done) {
        state.textContent = `다시 깨면 ${tower.again.toLocaleString()} 골드`;
      } else {
        state.textContent = `첫 완주 ${tower.first.toLocaleString()} 골드`;
      }
    }
  }

  root.append(head, list);
  refresh();

  return { el: root, refresh };
}
