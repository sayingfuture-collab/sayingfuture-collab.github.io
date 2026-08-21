// 칭호 화면. 딴 것은 조건까지 보여주고, 못 딴 것은 물음표 한 칸으로 남긴다.
// 스타일은 screen-titles.css 에 있다 — 쓰는 쪽에서 link 해야 한다.
//
// **조건이 비공개인 것이 이 기능의 요점이다.** 「어떻게 얻었지?」가 힌트 세 개로
// 사람을 맞히는 이 게임의 결과 같다. 그래서 못 딴 칸에는 이름도 효과도 안 붙인다 —
// 도감 미획득 칸과 같은 결이다.

import { TITLES } from '../titles/catalog.js';
import { sumEffects } from '../titles/effects.js';
import { getTitles } from '../storage.js';
import { cheatMark } from '../cheat.js';

const EFFECT_LABEL = { atk: '공격력', hp: '체력', gold: '골드', mat: '재료' };

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** 효과 객체를 「공격력 +2% · 체력 +3%」 같은 한 줄로 */
function effectText(effect) {
  return Object.entries(effect)
    .map(([k, v]) => `${EFFECT_LABEL[k]} +${v}%`)
    .join(' · ');
}

/**
 * @returns {{el: HTMLElement, refresh: () => void}}
 */
export function createTitlesScreen() {
  const root = el('section', 'titles');

  // ── 진행도와 합산 효과 ──
  // 합산을 맨 위에 두는 이유: 지금 내가 얼마나 세진 건지 알 수 있어야
  // 칭호가 장식이 아니라 힘으로 읽힌다.
  const head = el('header', 'titles__head');
  const count = el('div', 'titles__count');
  const totals = el('div', 'titles__totals');
  // 치트 흔적. **한 번도 안 썼으면 아예 안 그린다.**
  // 여기에 두는 이유: 칭호는 치트로 딸 수 있는 유일한 것이라, 「이 칭호를 어떻게 땄나」를
  // 보는 자리에 흔적이 같이 있어야 말이 된다.
  const mark = el('div', 'titles__cheat');
  head.append(count, totals, mark);

  const grid = el('ol', 'titles__grid');

  // 칸은 한 번만 만들고 다시 그릴 때 내용만 갈아 끼운다.
  const cells = TITLES.map((t) => {
    const li = el('li', 'titles__cell');
    li.dataset.id = t.id;
    const name = el('div', 'titles__name');
    const effect = el('div', 'titles__effect');
    const need = el('div', 'titles__need');
    li.append(name, effect, need);
    grid.append(li);
    return { li, name, effect, need, title: t };
  });

  /**
   * 칸 하나를 칠한다.
   *
   * ⚠️ **못 딴 칸에는 아무것도 새면 안 된다.** 이름 한 글자만 봐도 조건이 짐작되는
   * 것들이 있다(「홀로」·「의원 없이」). 물음표 하나로 끝낸다.
   */
  function paintCell(cell, owned) {
    const { li, name, effect, need, title } = cell;
    li.dataset.owned = String(owned);
    if (!owned) {
      name.textContent = '?';
      effect.textContent = '';
      need.textContent = '';
      return;
    }
    name.textContent = title.name;
    effect.textContent = effectText(title.effect);
    // 딴 뒤에는 조건을 보여준다. 안 그러면 뭘 해서 땄는지 몰라서 다음을 노릴 수 없다.
    need.textContent = title.need;
  }

  function refresh() {
    const mine = getTitles();
    const has = new Set(mine);
    for (const cell of cells) paintCell(cell, has.has(cell.title.id));

    count.replaceChildren('딴 칭호 ', el('b', null, String(mine.length)), ` / ${TITLES.length}`);

    // ⚠️ 되돌려도 「쓴 적 있다」는 안 지워진다. 지워지면 잡을 수가 없다.
    const cheat = cheatMark();
    mark.textContent = cheat
      ? `⚑ 치트 ${cheat.total}번 사용${cheat.undoable ? ` · ${cheat.undoable}번 되돌릴 수 있음` : ' · 전부 되돌림'}`
      : '';

    const sum = sumEffects(mine);
    totals.replaceChildren();
    const parts = Object.entries(sum).filter(([, v]) => v > 0);
    if (!parts.length) {
      totals.append(el('span', 'titles__none', '아직 걸린 효과가 없습니다'));
      return;
    }
    for (const [k, v] of parts) {
      const chip = el('span', 'titles__total');
      chip.append(el('span', null, EFFECT_LABEL[k]), el('b', null, `+${v}%`));
      totals.append(chip);
    }
  }

  root.append(head, grid);
  refresh();

  return { el: root, refresh };
}
