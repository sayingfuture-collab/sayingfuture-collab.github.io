// 전장에 선 인물 하나. 그리는 법과 맞는 연출까지 여기서 맡는다.
// 그래픽을 넣을 때 고치는 파일은 여기 하나뿐이다 — 움직임은 .unit에 걸리므로
// 이모지를 스프라이트로 바꿔도 연출은 그대로 물려받는다.

// 그림을 넣고 빼는 자리는 art.js 하나다. 여기서 다시 정의하지 않는다.
import { artNode } from './art.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** 한 번짜리 CSS 애니메이션을 다시 트리거한다. 값을 지우고 레이아웃을 확정한 뒤 다시 켠다. */
function replay(node, attr, value) {
  node.removeAttribute(attr);
  void node.offsetWidth;
  node.setAttribute(attr, value);
}

/**
 * @param {{uid: string, character: object, maxHp: number, hp: number, shield: number, front: boolean}} unit
 * @param {'party'|'enemy'} side 달려드는 방향을 정한다
 */
export function createUnitView(unit, side) {
  const { character } = unit;
  const root = el('div', 'unit');
  root.dataset.tier = character.tier;
  root.dataset.side = side;
  root.dataset.dead = 'false';

  // 에셋이 없는 인물은 이모지로 떨어진다. 섞여 있어도 안 깨진다.
  const art = artNode(character, 'unit__art');

  const name = el('div', 'unit__name', character.name);
  const bar = el('div', 'unit__bar');
  const fill = el('i');
  const guard = el('u');
  bar.append(fill, guard);
  const floats = el('div', 'unit__floats'); // 떠오르는 숫자가 붙는 자리

  root.append(floats, art, name, bar);

  const maxHp = unit.maxHp;
  // 이벤트마다 두 값이 다 실려오지는 않는다(회복에는 방어막이 없다).
  // 마지막으로 안 값을 들고 있다가 안 온 쪽은 그대로 둔다.
  let curHp = unit.hp;
  let curShield = unit.shield;

  function setBars(hp, shield) {
    if (hp !== undefined) curHp = hp;
    if (shield !== undefined) curShield = shield;
    fill.style.width = `${Math.max(0, (curHp / maxHp) * 100)}%`;
    guard.style.width = `${Math.min(100, (curShield / maxHp) * 100)}%`;
  }
  setBars(unit.hp, unit.shield);

  /** 숫자가 위로 떠올랐다 사라진다 */
  function float(text, kind) {
    const node = el('span', 'unit__float', text);
    node.dataset.kind = kind;
    // 여러 개가 겹치면 읽을 수 없어서 좌우로 조금씩 흩는다
    node.style.setProperty('--drift', `${Math.round((Math.random() - 0.5) * 16)}px`);
    node.addEventListener('animationend', () => node.remove());
    floats.append(node);
  }

  return {
    el: root,
    uid: unit.uid,

    /** 엔진 상태와 강제로 맞춘다. 한 턴이 끝날 때 어긋남을 정리하는 용도 */
    sync(u) {
      setBars(u.hp, u.shield);
      root.dataset.dead = String(u.hp === 0);
    },

    /** 때리러 나갔다 돌아온다 */
    lunge() { replay(root, 'data-anim', 'lunge'); },

    /** 맞았다. 이벤트에 실려온 값을 그대로 쓴다 — 다시 계산하지 않는다 */
    hit({ dmg, hp, shield }) {
      setBars(hp, shield);
      replay(root, 'data-anim', 'hit');
      float(`-${dmg}`, 'dmg');
    },

    heal({ amount, hp }) {
      setBars(hp, undefined); // 방어막은 안 실려오므로 그대로 둔다
      replay(root, 'data-anim', 'heal');
      float(`+${amount}`, 'heal');
    },

    shield(amount) {
      guard.style.width = `${Math.min(100, (amount / maxHp) * 100)}%`;
      replay(root, 'data-anim', 'shield');
    },

    buff(pct) {
      replay(root, 'data-anim', 'buff');
      float(`↑${pct}%`, 'buff');
    },

    die() {
      root.dataset.dead = 'true';
      setBars(0, 0);
    },

    /** 소생 — 쓰러진 데서 돌아온다 */
    revive({ hp }) {
      root.dataset.dead = 'false';
      setBars(hp, 0);
      replay(root, 'data-anim', 'revive');
      float('부활', 'revive');
    },
  };
}
