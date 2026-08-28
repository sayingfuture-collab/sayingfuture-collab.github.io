// 사냥꾼 그림 한 곳 — 스킨을 입었으면 그림, 아니면 커스텀 조합 SVG.
// 그림 파일이 아직 없거나 깨져도 SVG로 조용히 되돌아간다 (그림은 나중에 채워 넣는 자산이라,
// 파일이 없다고 게임이 깨지면 안 된다).
// DOM 노드를 돌려준다 — 문자열로 만들면 onerror 폴백이 사라진다.
import { hunterSVG, resolveEquip } from '../hunter.js';
import { skinImage, SKIN_BY_ID } from '../skins.js';
import { getEquipped, getSkin, ownedCount } from '../store.js';

/**
 * @param {string|null} [skinId] 생략하면 저장된 값. null 을 명시하면 강제로 커스텀 조합.
 * @param {string} [base] 그림 경로 접두사 (하위 폴더에서 부를 때)
 * @returns {HTMLElement}
 */
export function hunterFigure(skinId = undefined, base = '') {
  const owned = ownedCount();
  const id = skinId === undefined ? getSkin() : skinId;
  const wrap = document.createElement('div');
  wrap.className = 'figure';

  const drawCustom = () => { wrap.innerHTML = hunterSVG(resolveEquip(getEquipped(), owned)); };

  if (!id || !SKIN_BY_ID.has(id)) { drawCustom(); return wrap; }

  const img = document.createElement('img');
  img.className = 'figure__img';
  img.alt = SKIN_BY_ID.get(id).name;
  img.addEventListener('error', drawCustom); // 그림이 아직 없으면 커스텀으로
  img.src = base + skinImage(id);
  wrap.append(img);
  return wrap;
}
