// 확률 정보. 숫자는 전부 rates.js에서 온다 — 여기서 계산하지 않는다.

import { tierTable, characterTable, phaseOf, earlyNotes, pct, TIER_ORDER } from '../rates.js';
import { artNode } from './art.js';
import { getDrawCount } from '../gacha.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const PHASE_LABEL = {
  first: '지금은 첫 뽑기 — SSR이 확정으로 나옵니다',
  early: '지금은 초반 보정 구간입니다',
  normal: '지금은 기본 확률이 적용됩니다',
};

export function createRatesView() {
  const root = el('div', 'rates');
  root.hidden = true;

  const head = el('div', 'rates__head');
  head.append(el('b', null, '확률 정보'));
  const close = el('button', 'rates__close', '닫기');
  close.type = 'button';
  close.onclick = () => { root.hidden = true; };
  head.append(close);

  const body = el('div', 'rates__body');
  root.append(head, body);

  // 보정 구간 기준으로 볼지, 기본 확률로 볼지.
  // 열 때마다 "지금 적용되는 쪽"으로 맞춘다 — 보정 구간이라고 알려주면서
  // 정작 다른 표를 펼쳐두면 표가 있으나 마나다.
  let showEarly = false;
  let touched = false; // 사람이 직접 탭을 골랐으면 그 선택을 지킨다

  function render() {
    const nextDraw = getDrawCount() + 1;
    const phase = phaseOf(nextDraw);
    body.replaceChildren();

    const now = el('div', 'rates__now');
    now.append(
      el('div', 'rates__nowMain', PHASE_LABEL[phase]),
      el('div', 'rates__nowSub', `지금까지 ${getDrawCount().toLocaleString()}번 뽑았습니다`)
    );
    body.append(now);

    // ── 보기 전환 ──
    const tabs = el('div', 'rates__tabs');
    for (const [label, early] of [['기본 확률', false], ['초반 보정 (2~20뽑)', true]]) {
      const b = el('button', 'rates__tab', label);
      b.type = 'button';
      b.dataset.on = String(showEarly === early);
      b.onclick = () => { showEarly = early; touched = true; render(); };
      tabs.append(b);
    }
    body.append(tabs);

    // ── 등급별 ──
    body.append(el('h3', 'rates__h', '등급별'));
    const table = el('table', 'rates__table');
    const thead = el('tr');
    for (const t of ['등급', '확률', '인원', '인물 1명당']) thead.append(el('th', null, t));
    table.append(thead);
    for (const row of tierTable(showEarly)) {
      const tr = el('tr');
      tr.dataset.tier = row.tier;
      tr.append(
        el('td', 'rates__tier', row.tier),
        el('td', null, pct(row.rate, 2)),
        el('td', null, `${row.count}명`),
        el('td', 'rates__each', pct(row.each))
      );
      table.append(tr);
    }
    body.append(table);
    body.append(el('p', 'rates__note', '같은 등급 안에서는 모든 인물이 같은 확률입니다.'));

    // ── 초반 보정 ──
    body.append(el('h3', 'rates__h', '초반 보정'));
    const list = el('ul', 'rates__list');
    for (const line of earlyNotes()) list.append(el('li', null, line));
    body.append(list);

    // ── 인물별 ──
    body.append(el('h3', 'rates__h', '인물별'));
    const filter = el('div', 'rates__filter');
    let tierFilter = 'all';
    const rows = el('div', 'rates__rows');

    function drawRows() {
      rows.replaceChildren();
      const list = characterTable(showEarly)
        .filter((r) => tierFilter === 'all' || r.character.tier === tierFilter);
      for (const { character, rate } of list) {
        const line = el('div', 'rates__row');
        line.dataset.tier = character.tier;
        line.dataset.zero = String(rate === 0);
        line.append(
          artNode(character, 'rates__rowArt'),
          el('span', 'rates__rowName', character.name),
          el('span', 'rates__rowTier', character.tier),
          el('span', 'rates__rowRate', pct(rate))
        );
        rows.append(line);
      }
    }

    for (const [label, value] of [['전체', 'all'], ...TIER_ORDER.map((t) => [t, t])]) {
      const b = el('button', 'rates__chip', label);
      b.type = 'button';
      b.dataset.on = String(tierFilter === value);
      b.onclick = () => {
        tierFilter = value;
        for (const other of filter.children) other.dataset.on = String(other === b);
        drawRows();
      };
      filter.append(b);
    }
    body.append(filter, rows);
    drawRows();

    body.append(el('p', 'rates__note', '표시된 값은 한 번 뽑을 때의 확률입니다. 반올림해서 보여주므로 합이 정확히 100%로 보이지 않을 수 있습니다.'));
  }

  return {
    el: root,
    open() {
      if (!touched) showEarly = phaseOf(getDrawCount() + 1) === 'early';
      render();
      root.hidden = false;
      body.scrollTop = 0;
    },
  };
}
