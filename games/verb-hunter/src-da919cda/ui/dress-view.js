// 꾸미기 — 두 축이 서로 다른 재화를 쓴다.
//  · 🧩 커스텀 조합: 도감 진행도로 자동 해금. 자기표현이라 값을 안 매긴다 (CHI 2016).
//  · ✨ 스킨 상점:   🐾 발자국으로 산다. 원래 '상품' 성격이라 팔아도 자연스럽다.
// 스킨은 조합을 잠그지 않고, 언제든 커스텀으로 되돌아올 수 있다.
import { HUNTER_PARTS, SLOTS, SLOT_NAME, isUnlocked, resolveEquip } from '../hunter.js';
import { SKINS, skinImage, skinPrice, gradeOf } from '../skins.js';
import { equipPart, ownedCount, getSkin, setSkin, getEquipped, paws, hasSkin, buySkin } from '../store.js';
import { hunterFigure } from './hunter-figure.js';
import { showSkinReveal } from './skin-reveal.js';

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

    const tabs = el('div', 'dress__tabs');
    for (const [key, label] of [['custom', '🧩 커스텀 조합'], ['skin', '✨ 스킨 상점']]) {
      const b = el('button', 'tabbtn' + (tab === key ? ' on' : ''), label);
      b.onclick = () => { tab = key; render(); };
      tabs.append(b);
    }
    root.append(tabs);

    if (tab === 'custom') renderCustom(owned, skinId);
    else renderShop(skinId);

    const back = el('div', 'backrow');
    const btn = el('button', 'btn ghost', '홈으로');
    btn.onclick = onBack;
    back.append(btn);
    root.append(back);
  }

  // ── 커스텀 조합: 도감 진행도로 열린다. 공짜다 ──────────────
  function renderCustom(owned, skinId) {
    root.append(el('div', 'dress__hint', `도감을 채우면 파츠가 열려요 · 지금 도감 ${owned}마리`));
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

  // ── 스킨 상점: 🐾 발자국으로 산다 ──────────────────────────
  function renderShop(skinId) {
    const bal = paws();
    const wallet = el('div', 'wallet');
    wallet.innerHTML = `<b>🐾 ${bal}</b><span>동사를 한 마리 잡을 때마다 발자국 1개</span>`;
    root.append(wallet);

    const grid = el('div', 'skin__grid');
    for (const s of SKINS) {
      const have = hasSkin(s.id);
      const price = skinPrice(s.id);
      const g = gradeOf(s.id);
      const afford = bal >= price;
      const cardEl = el('button', 'skincard'
        + (skinId === s.id ? ' on' : '')
        + (have ? '' : (afford ? ' buyable' : ' poor')));

      cardEl.style.setProperty('--grade', g.color);
      const thumb = el('div', 'skincard__thumb');
      thumb.append(el('span', 'gradetag', g.name));
      const img = document.createElement('img');
      img.alt = s.name;
      img.addEventListener('error', () => { thumb.classList.add('noimg'); thumb.textContent = '🐾'; });
      img.src = skinImage(s.id);
      thumb.append(img);
      // 아직 안 산 스킨은 실루엣으로 — 뭘 사는지는 보이되 '가진 느낌'은 안 나게
      if (!have) thumb.classList.add('locked');
      cardEl.append(thumb);

      cardEl.append(el('div', 'skincard__name', s.name));
      const foot = el('div', 'skincard__need');
      if (have) foot.textContent = skinId === s.id ? '입는 중' : '입기';
      else if (s.free) foot.textContent = '기본 지급';
      else if (afford) foot.textContent = `🐾 ${price} 사기`;
      else foot.textContent = `🐾 ${price} (${price - bal} 부족)`;
      cardEl.append(foot);

      cardEl.onclick = () => {
        if (have) { setSkin(s.id); render(); return; }
        if (!afford) return;
        if (buySkin(s.id)) showSkinReveal(s, render);
      };
      grid.append(cardEl);
    }
    root.append(grid);
  }

  render();
  return { el: root, refresh: render };
}
