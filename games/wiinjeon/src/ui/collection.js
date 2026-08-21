// 도감. 134명 전체를 늘어놓고, 미획득은 물음표 한 칸으로 남긴다.
// 스타일은 collection.css에 있다 — 쓰는 쪽에서 link 해야 한다.

import { CHARACTERS } from '../data/characters.js';
import { skillInfo } from '../battle/skills.js';
import { artNode, hasArt } from './art.js';
import { countOf, levelOf, isMaxLevel, upgradeCheck, upgrade, getStock, getStats } from '../storage.js';
import { BOOK_SORTS, ORIGINAL_SORT, sortCharacters } from '../sort.js';
import { chipRow as makeChipRow, filterRow as makeFilterRow, TIERS, ROLES } from './chips.js';

// 알약 줄은 편성 고르기와 같은 부품을 쓴다(chips.js). 접두사만 이 화면 것으로 준다.
const chipRow = (label, opts, onChange) => makeChipRow('book', label, opts, onChange);
const filterRow = (label, values, onChange) => makeFilterRow('book', label, values, onChange);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

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

  /**
   * 미획득 칸의 그림 자리. **아직 못 만난 사람은 그림을 아예 안 붙인다.**
   *
   * 예전엔 그림을 붙여두고 `filter: brightness(0) invert(28%)`로 가렸다.
   * 이모지 시절에는 그게 진짜 실루엣이 됐다 — 글자는 배경이 투명해서 모양만 남는다.
   * **도트로 갈아타면서 깨졌다.** 도트는 배경이 통째로 칠해져 있어서(SSR은 인물마다
   * 배경색을 구워 넣는다) 32×32 전체가 불투명이고, 거기에 brightness(0)을 먹이면
   * 네모 전체가 한 색이 된다 — 실루엣이 아니라 **단색 회색 덩어리**다.
   * 픽셀로 재보니 서로 다른 색이 13개 → 1개(#474747)였다.
   *
   * 정답이 새진 않았지만 보기 흉했다. 실루엣 PNG를 따로 굽는 길도 있었는데,
   * **그건 오히려 답을 흘린다** — 실루엣이 서로 확실히 다르게 만들어 뒀기 때문에
   * (50칸 이상) 삿갓만 보고 김병연인 걸 맞힐 수 있다.
   */
  function paintArt(cell) {
    const { art, character } = cell;
    if (!countOf(character.id)) {
      art.replaceChildren('?');
      return;
    }
    if (hasArt(character.id)) {
      // 그림을 도로 붙인다. artNode가 img·onerror까지 챙기므로 통째로 갈아 끼운다.
      const fresh = artNode(character, 'book__art');
      art.replaceChildren(...fresh.childNodes);
    } else {
      art.replaceChildren(character.e);
    }
  }

  /** 저장 상태를 다시 읽어 화면을 맞춘다 */
  function refresh() {
    for (const cell of cells) {
      const { li, name, dup, character } = cell;
      const n = countOf(character.id);
      const owned = n > 0;
      li.dataset.owned = String(owned);
      // 미획득이면 등급도 이름도 노출하지 않는다
      if (owned) li.dataset.tier = character.tier;
      else delete li.dataset.tier;
      paintArt(cell);
      // 그림 자리가 이미 '?'라 이름까지 물음표면 두 번 말하는 셈이다
      name.textContent = owned ? character.name : '';
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
