// 꾸미기 — 직접 조합한 캐릭터여야 동일시→플레이 지속이 생긴다 (CHI 2016).
// 파츠 언락 = 도감 소유 수. 수집이 꾸미기의 재화다.
import { HUNTER_PARTS, SLOTS, SLOT_NAME, hunterSVG, resolveEquip, isUnlocked } from '../hunter.js';
import { getEquipped, equipPart, ownedCount } from '../store.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export function createDressView({ onBack }) {
  const root = el('div', 'dress');

  function render() {
    const owned = ownedCount();
    const equipped = resolveEquip(getEquipped(), owned);
    root.innerHTML = '';
    root.append(el('h2', null, '🎀 사냥꾼 꾸미기'));

    const preview = el('div', 'dress__preview');
    preview.innerHTML = hunterSVG(equipped);
    root.append(preview);

    for (const slot of SLOTS) {
      root.append(el('h3', null, SLOT_NAME[slot]));
      const row = el('div', 'dress__row');
      for (const p of HUNTER_PARTS.filter((x) => x.slot === slot)) {
        const open = isUnlocked(p.id, owned);
        const btn = el('button', 'partbtn' + (equipped[slot] === p.id ? ' on' : '') + (open ? '' : ' locked'));
        btn.textContent = open ? p.name : '🔒 ' + p.name;
        if (!open) {
          const need = el('span', 'need', `도감 ${p.need}마리`);
          btn.append(need);
        }
        btn.onclick = () => { if (open) { equipPart(slot, p.id); render(); } };
        row.append(btn);
      }
      root.append(row);
    }

    const back = el('div', 'backrow');
    const btn = el('button', 'btn ghost', '홈으로');
    btn.onclick = onBack;
    back.append(btn);
    root.append(back);
  }

  render();
  return { el: root, refresh: render };
}
