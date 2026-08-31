// 탑 목록. 여덟 개를 늘어놓고 어디까지 왔는지 보여준다.
// 스타일은 screen-towers.css 에 있다 — 쓰는 쪽에서 link 해야 한다.
//
// **색 순서대로 하나씩 열린다.** 빨강만 열려 있고, 깨면 주황이 열린다(2026-08-23).
// 잠긴 칸도 지운 자리 없이 그대로 둔다 — 무엇이 남았는지 보여야 다음이 생긴다.
//
// **탑을 고르면 이 탭 안에서 전투로 바뀐다.** 도전 탭으로 넘기지 않는다 —
// 등반과 탑은 목적이 달라서(기록 vs 판단) 한 화면에 섞이면 어느 쪽을 하는 중인지 흐려진다.
// 편성 화면은 createBattleScreen 한 벌을 두 번 만들어 쓴다. 고칠 자리는 여전히 한 곳이다.

import {
  TOWERS, TOWER_FLOORS, GOLD_TOWER, isOpen, needsFor, nextTower,
} from '../towers/catalog.js';
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

    count.replaceChildren(
      '깬 탑 ', el('b', null, String(clears.length)), ` / ${TOWERS.length}`
    );
    // **지금 갈 곳 하나만 말한다.** 색 순서대로 하나씩 열리므로 「다음」이 늘 정해져 있다 —
    // 여덟 개를 늘어놓고 고르게 하는 것보다 이쪽이 할 일이 분명하다.
    const next = nextTower(clears);
    note.textContent = next
      ? `다음은 ${next.mark} ${next.name}입니다 · ${TOWER_FLOORS}층을 완주하면 다음 탑이 열립니다`
      : `여덟 탑을 다 깼습니다 — ${GOLD_TOWER.mark} ${GOLD_TOWER.name}은 하루 한 번 값을 합니다`;

    for (const cell of cells) {
      const { li, state, go, tower } = cell;
      const done = has.has(tower.id);
      const open = isOpen(tower, clears);
      li.dataset.done = String(done);
      li.dataset.open = String(open);
      // 지금 가야 할 탑에 표를 단다. 열린 탑이 여럿일 때(옛 저장) 어디부터인지 보여준다.
      li.dataset.next = String(next?.id === tower.id);
      go.disabled = !open;

      if (!open) {
        // **무엇을 깨야 열리는지 이름으로 말한다.** 「잠김」만 뜨면 뭘 해야 할지 알 수가 없다.
        const needs = needsFor(tower, clears);
        state.textContent = tower.id === GOLD_TOWER.id
          ? '일곱 색을 다 깨야 열립니다'
          : `${needs.mark} ${needs.name}을 깨면 열립니다`;
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
