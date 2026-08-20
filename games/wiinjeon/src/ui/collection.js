// 도감. 134명 전체를 늘어놓고, 미획득은 실루엣으로 가린다.
// 스타일은 collection.css에 있다 — 쓰는 쪽에서 link 해야 한다.

import { CHARACTERS } from '../data/characters.js';
import { skillInfo } from '../battle/skills.js';
import { artNode, hasArt } from './art.js';
import { countOf, levelOf, isMaxLevel, upgradeCheck, upgrade, getStock, getStats } from '../storage.js';
import { BOOK_SORTS, ORIGINAL_SORT, sortCharacters } from '../sort.js';

const TIERS = ['SSR', 'SR', 'R', 'N'];
const ROLES = ['지휘', '장인', '전사', '치유', '포격'];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * 알약 버튼 한 줄. 하나만 켜진다. 고른 값이 바뀌면 onChange를 부른다.
 * 필터와 정렬이 같은 모양을 쓴다 — 생김새가 다르면 다른 기능처럼 보인다.
 *
 * @param {Array<{value: string, name: string}>} opts 첫 항목이 처음 켜져 있는 것
 */
function chipRow(label, opts, onChange) {
  const row = el('div', 'book__filter');
  row.append(el('span', 'book__filterLabel', label));
  const buttons = opts.map((o, i) => {
    const b = el('button', 'book__chip', o.name);
    b.type = 'button';
    b.dataset.value = o.value;
    b.dataset.on = String(i === 0);
    b.onclick = () => {
      buttons.forEach((x) => { x.dataset.on = String(x === b); });
      onChange(o.value);
    };
    row.append(b);
    return b;
  });
  return row;
}

/** 필터용 — 맨 앞에 '전체'(빈 값)를 붙인다 */
const filterRow = (label, values, onChange) =>
  chipRow(label, [{ value: '', name: '전체' }, ...values.map((v) => ({ value: v, name: v }))], onChange);

/**
 * @returns {{el: HTMLElement, refresh: () => void}}
 */
export function createCollection() {
  const root = el('section', 'book');

  // ── 진행도 ──
  const head = el('header', 'book__head');
  const progress = el('div', 'book__progress');
  const bar = el('div', 'book__bar');
  const barFill = el('i');
  bar.append(barFill);
  const sub = el('div', 'book__sub');
  head.append(progress, bar, sub);

  // ── 필터 ──
  const filters = el('div', 'book__filters');
  let tierFilter = '';
  let roleFilter = '';
  let sortMode = ORIGINAL_SORT;
  filters.append(
    filterRow('등급', TIERS, (v) => { tierFilter = v; apply(); }),
    filterRow('역할', ROLES, (v) => { roleFilter = v; apply(); }),
    chipRow('정렬', BOOK_SORTS.map((s) => ({ value: s.id, name: s.name })),
      (v) => { sortMode = v; apply(); })
  );

  // ── 격자 ──
  const grid = el('ol', 'book__grid');
  const cells = CHARACTERS.map((c) => {
    const li = el('li', 'book__cell');
    li.dataset.id = c.id;
    li.dataset.role = c.role;

    const art = artNode(c, 'book__art');
    const name = el('div', 'book__name');
    const dup = el('div', 'book__dup');
    li.append(art, name, dup);

    li.onclick = () => { if (countOf(c.id) > 0) openDetail(c); };
    grid.append(li);
    return { li, art, name, dup, character: c };
  });

  const empty = el('p', 'book__empty', '조건에 맞는 인물이 없습니다.');
  empty.hidden = true;

  // ── 상세 ──
  const detail = el('div', 'book__detail');
  detail.hidden = true;
  detail.onclick = (e) => { if (e.target === detail) closeDetail(); };

  /** SSR만 가진 고유기. 없으면 아무것도 안 붙인다 */
  function skillBlock(c) {
    const info = skillInfo(c);
    if (!info) return document.createComment('');
    const box = el('div', 'book__skill');
    box.append(el('div', 'book__skillName', info.name), el('div', 'book__skillText', info.text));
    return box;
  }

  /**
   * 강화 줄. 안 가진 인물에게는 안 붙인다.
   *
   * 누르면 상세를 통째로 다시 그린다 — 버튼 글자만 고치면 위의 '보유 N장 · N렙'이
   * 옛 값인 채로 남아서 화면이 서로 어긋난다.
   */
  function upgradeRow(c) {
    if (!countOf(c.id)) return document.createComment('');

    const row = el('div', 'book__upgrade');
    if (isMaxLevel(c.id)) {
      row.append(el('div', 'book__upgradeMax', '최대 레벨입니다'));
      return row;
    }

    const check = upgradeCheck(c.id);
    const btn = el('button', 'book__upgradeBtn',
      `강화 · ${c.tier} 카드 ${check.need}장 + ${check.cost.toLocaleString()}골드`);
    btn.type = 'button';
    btn.disabled = !check.ok;
    btn.onclick = () => {
      if (!upgrade(c.id)) return;
      refresh();      // 격자의 장수·정렬을 맞춘다
      openDetail(c);  // 상세를 새로 그려 레벨과 다음 값을 갱신한다
    };
    row.append(btn);

    // 재고는 늘 보여준다. 얼마 남았는지 모르면 뭘 아껴야 할지 판단이 안 선다.
    row.append(el('div', 'book__upgradeStock', `${c.tier} 카드 ${getStock(c.tier).toLocaleString()}장 보유`));

    // 못 하는 이유를 나눠서 말한다 — 카드가 없는 것과 골드가 없는 것은
    // 하러 가야 할 곳이 다르다(뽑기 vs 도전).
    const why = {
      material: `${c.tier} 카드가 모자랍니다. 뽑기로 모으세요.`,
      gold: '골드가 모자랍니다. 도전 탭에서 층을 오르면 법니다.',
    }[check.reason];
    if (why) row.append(el('div', 'book__upgradeNo', why));
    return row;
  }

  function openDetail(c) {
    const panel = el('div', 'book__panel');
    panel.dataset.tier = c.tier;

    const close = el('button', 'book__close', '닫기');
    close.type = 'button';
    close.onclick = closeDetail;

    const hints = el('ol', 'book__hints');
    c.hints.forEach((h) => hints.append(el('li', null, h)));

    panel.append(
      el('div', 'book__panelTier', `${c.tier} · ${c.role}`),
      artNode(c, 'book__panelArt'),
      el('h3', 'book__panelName', c.name),
      hints,
      el('p', 'book__panelDesc', c.desc),
      skillBlock(c),
      // 보유 장수와 전투 레벨은 다른 값이다. 상한 위로 모은 사람이 왜 안 세지는지
      // 여기서 알 수 있어야 한다.
      el('div', 'book__panelCount',
        `보유 ${countOf(c.id)}장 · ${levelOf(c.id)}렙${isMaxLevel(c.id) ? ' (최대)' : ''}`),
      upgradeRow(c),
      close
    );
    detail.replaceChildren(panel);
    detail.hidden = false;
  }

  function closeDetail() {
    detail.hidden = true;
    detail.replaceChildren();
  }

  const cellById = new Map(cells.map((c) => [c.character.id, c]));

  // 필터와 정렬만 다시 적용한다. 획득 여부는 건드리지 않는다.
  function apply() {
    // 칸을 새로 만들지 않고 있던 것을 옮긴다 — 다시 만들면 클릭 처리도 같이 새로 붙는다.
    // 레벨은 보유 장수라, 뽑고 돌아오면 순서가 저절로 맞는다.
    const ordered = sortCharacters(CHARACTERS, sortMode, countOf);
    grid.replaceChildren(...ordered.map((c) => cellById.get(c.id).li));

    let shown = 0;
    for (const { li, character } of cells) {
      const hit = (!tierFilter || character.tier === tierFilter) &&
                  (!roleFilter || character.role === roleFilter);
      li.hidden = !hit;
      if (hit) shown++;
    }
    empty.hidden = shown > 0;
  }

  /** 저장 상태를 다시 읽어 화면을 맞춘다 */
  function refresh() {
    for (const { li, art, name, dup, character } of cells) {
      const n = countOf(character.id);
      const owned = n > 0;
      li.dataset.owned = String(owned);
      // 미획득이면 등급도 이름도 노출하지 않는다
      if (owned) li.dataset.tier = character.tier;
      else delete li.dataset.tier;
      // 그림이 있으면 건드리지 않는다. textContent를 넣으면 img가 날아간다.
      if (!hasArt(character.id)) art.textContent = character.e;
      name.textContent = owned ? character.name : '?';
      dup.textContent = n > 1 ? `×${n}` : '';
    }
    const s = getStats();
    progress.innerHTML = '';
    progress.append(`${s.total}명 중 `, el('b', null, String(s.owned)), '명');
    barFill.style.width = `${(s.owned / s.total) * 100}%`;
    sub.textContent = `총 ${s.pulls}뽑 · 중복 ${s.duplicates}장`;
    apply();
  }

  root.append(head, filters, grid, empty, detail);
  refresh();

  return { el: root, refresh };
}
