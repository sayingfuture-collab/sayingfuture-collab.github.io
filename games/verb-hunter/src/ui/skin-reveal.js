// 스킨 해금 컷씬 — 도감을 채우다 보니 열린 것. 예고 없이, 판이 끝난 뒤에만 뜬다.
// 리서치 반영: 보상은 '예고된 상품'이 아니라 '사후 발견되는 수행 정보' (과잉정당화 회피).
// 그래서 홈에 "다음 스킨까지 3마리!" 같은 재촉은 두지 않고, 열렸을 때만 이렇게 한 번 보여준다.
import { setSkin } from '../store.js';
import { confetti } from '../juice.js';
import { fanfare } from '../audio.js';
import { hunterFigure } from './hunter-figure.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/**
 * @param {object} skin SKINS 항목
 * @param {() => void} onClose 닫은 뒤 화면 갱신
 */
export function showSkinReveal(skin, onClose) {
  const gate = el('div', 'gate reveal');
  const card = el('div', 'gate__card reveal__card');

  card.append(el('div', 'reveal__tag', '새 스킨 해금!'));
  const stage = el('div', 'reveal__stage');
  stage.append(hunterFigure(skin.id));
  card.append(stage);
  card.append(el('h2', 'reveal__name', skin.name));
  card.append(el('p', 'reveal__line', skin.line));

  const btns = el('div', 'btns');
  const wear = el('button', 'btn', '지금 입기');
  wear.onclick = () => { setSkin(skin.id); close(); };
  const later = el('button', 'btn ghost', '나중에');
  later.onclick = close;
  btns.append(wear, later);
  card.append(btns);

  gate.append(card);
  document.body.append(gate);
  confetti();
  fanfare();

  function close() {
    gate.remove();
    if (onClose) onClose();
  }
}
