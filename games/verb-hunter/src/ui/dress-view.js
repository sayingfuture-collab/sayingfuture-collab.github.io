// 꾸미기 — 두 축을 나란히 둔다.
//  · 커스텀 조합: 직접 만든 캐릭터여야 동일시→플레이 지속이 생긴다 (CHI 2016).
//  · 완성 스킨:   도감을 채우다 보면 통째로 열리는 옷. 조합을 잠그지 않고, 언제든 커스텀으로 돌아온다.
// 둘 다 재화는 하나 — 도감 소유 수. 수집이 꾸미기의 값이다.
import { HUNTER_PARTS, SLOTS, SLOT_NAME, isUnlocked, resolveEquip } from '../hunter.js';
import { SKINS, skinUnlocked, skinImage } from '../skins.js';
import { equipPart, ownedCount, getSkin, setSkin, getEquipped } from '../store.js';
import { hunterFigure } from './hunter-figure.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export function createDressView({ onBack }) {
  const root = el('div', 'dress');
  let tab = getSkin() ? 'skin' : 'custom';

  function render() {
    const owned = ownedCount();
    const skinId = getSkin();
    root.innerHTML = '';
    root.append(el('h2', null, '🎀 사냥꾼 꾸미기'));

    const preview = el('div', 'dress__preview');
    preview.append(hunterFigure());
    root.append(preview);
    root.append(el('div', 'dress__wearing',
      skinId ? `입은 스킨: ${SKINS.find((s) => s.id === skinId)?.name ?? ''}` : '내가 조합한 사냥꾼'));

    // 탭
    const tabs = el('div', 'dress__tabs');
    for (const [key, label] of [['custom', '🧩 커스텀 조합'], ['skin', '✨ 완성 스킨']]) {
      const b = el('button', 'tabbtn' + (tab === key ? ' on' : ''), label);
      b.onclick = () => { tab = key; render(); };
      tabs.append(b);
    }
    root.append(tabs);

    if (tab === 'custom') renderCustom(owned, skinId);
    else renderSkins(owned, skinId);

    const back = el('div', 'backrow');
    const btn = el('button', 'btn ghost', '홈으로');
    btn.onclick = onBack;
    back.append(btn);
    root.append(back);
  }

  function renderCustom(owned, skinId) {
    // 스킨을 입은 채로 조합을 만지면 미리보기가 안 바뀐다 — 벗는 버튼을 먼저 준다.
    if (skinId) {
      const note = el('div', 'dress__note');
      note.append(el('span', null, '스킨을 입고 있어요. 조합을 보려면 벗어야 해요.'));
      const off = el('button', 'btn ghost', '스킨 벗기');
      off.onclick = () => { setSkin(null); render(); };
      note.append(off);
      root.append(note);
    }
    for (const slot of SLOTS) {
      root.append(el('h3', null, SLOT_NAME[slot]));
      const row = el('div', 'dress__row');
      for (const p of HUNTER_PARTS.filter((x) => x.slot === slot)) {
        const open = isUnlocked(p.id, owned);
        const on = !skinId && equippedNow()[slot] === p.id;
        const btn = el('button', 'partbtn' + (on ? ' on' : '') + (open ? '' : ' locked'));
        btn.textContent = open ? p.name : '🔒 ' + p.name;
        if (!open) btn.append(el('span', 'need', `도감 ${p.need}마리`));
        btn.onclick = () => { if (open) { setSkin(null); equipPart(slot, p.id); render(); } };
        row.append(btn);
      }
      root.append(row);
    }
  }

  /** '지금 켜진 버튼' 표시용 — 잠긴 파츠가 장착돼 있으면 기본값으로 정리해서 준다 */
  function equippedNow() {
    return resolveEquip(getEquipped(), ownedCount());
  }

  function renderSkins(owned, skinId) {
    const grid = el('div', 'skin__grid');
    for (const s of SKINS) {
      const open = skinUnlocked(s.id, owned);
      const cardEl = el('button', 'skincard' + (skinId === s.id ? ' on' : '') + (open ? '' : ' locked'));
      const thumb = el('div', 'skincard__thumb');
      if (open) {
        const img = document.createElement('img');
        img.alt = s.name;
        img.addEventListener('error', () => { thumb.classList.add('noimg'); thumb.textContent = '🏹'; });
        img.src = skinImage(s.id);
        thumb.append(img);
      } else {
        thumb.classList.add('noimg');
        thumb.textContent = '🔒';
      }
      cardEl.append(thumb);
      cardEl.append(el('div', 'skincard__name', open ? s.name : '???'));
      cardEl.append(el('div', 'skincard__need', open ? (skinId === s.id ? '입는 중' : '입기') : `도감 ${s.need}마리`));
      if (open) cardEl.onclick = () => { setSkin(s.id); render(); };
      grid.append(cardEl);
    }
    root.append(grid);
  }

  render();
  return { el: root, refresh: render };
}
