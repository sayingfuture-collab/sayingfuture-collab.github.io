// 전장 무대. 칸 대신 **좌표**로 세운다.
//
// 예전에는 flex 칸 넷(뒷줄|앞줄 VS 앞줄|뒷줄)에 유닛을 밀어 넣었다. 보기에는 멀쩡했지만
// **칸 밖으로 나갈 수가 없어서** 「적진으로 달려가 벤다」가 원천적으로 불가능했다.
// 여기서는 자리를 백분율 좌표로 정한다 — 달려가는 건 그 좌표를 옮기는 일이 된다.
//
// 좌표 계산은 DOM을 안 쓰는 순수 함수라 노드에서 검증한다(tests/stage.test.js).
// 화면을 눈으로 보는 것 말고 확인할 방법이 없으면, 자리가 어긋나도 아무도 모른다.

import { TOWERS } from '../towers/catalog.js';

/**
 * 전열의 가로 자리(%).
 *
 * 유닛 칸이 폭 76px이고 화면이 405px이라 한 칸이 18.8%다. 자리 간격 21%는
 * 그보다 넓어서 **가로로는 안 겹친다.** 양 끝(13-9.4=3.6%, 87+9.4=96.4%)도 안 넘친다.
 */
export const ROW_X = {
  partyBack: 13,
  partyFront: 34,
  enemyFront: 66,
  enemyBack: 87,
};

/** 한 줄 안에서 세로로 벌리는 간격(%)과 한가운데 자리(%) */
export const GAP = 22;
/**
 * 한가운데 자리(%).
 *
 * 63이었는데 짧은 화면(전장 464px)에서 **맨 위 유닛이 천장 밖으로 3px 나갔다.**
 * 자리는 백분율인데 유닛 키는 픽셀이라, 화면이 짧아질수록 위쪽이 먼저 넘친다.
 * 66으로 내리면 제일 위 발끝이 33%(뒷줄은 25%)라 유닛 키 105px를 빼도 안쪽에 남는다.
 */
export const CENTER = 66;

/** 뒷줄은 위로 물러나고 작아진다 — 이 둘이 원근의 전부다 */
export const BACK_LIFT = 8;
export const BACK_SCALE = 0.88;

/** 지평선 높이(%). 바닥과 하늘을 가른다 */
export const HORIZON = 20;

/**
 * 한 줄에 n명이 설 때 각자의 세로 자리(%).
 *
 * 가운데를 잡고 좌우로 벌린다 — 위에서부터 채우면 한 명일 때 천장에 붙는다.
 * 한 줄에 최대 넷이다(적 수는 min(4, 1+층/4), 편성도 넷).
 * 넷일 때 30·52·74·96 이 되어 발끝 간격이 88px(전장 400px 기준)이고,
 * 유닛 칸 높이가 90px이라 **거의 딱 맞게 안 겹친다.**
 */
export function spread(count) {
  const out = [];
  for (let i = 0; i < count; i++) out.push(CENTER + (i - (count - 1) / 2) * GAP);
  return out;
}

/**
 * 유닛 하나의 자리.
 *
 * @param {'party'|'enemy'} side
 * @param {boolean} front 앞줄인가
 * @param {number} index 그 줄에서 몇 번째
 * @param {number} count 그 줄에 몇 명
 * @returns {{x:number, y:number, scale:number, z:number}} 발끝 기준 좌표
 */
export function spotOf(side, front, index, count) {
  const key = `${side}${front ? 'Front' : 'Back'}`;
  const x = ROW_X[key];
  if (x === undefined) throw new Error(`모르는 자리: ${key}`);
  const y = spread(count)[index] - (front ? 0 : BACK_LIFT);
  return {
    x,
    y,
    scale: front ? 1 : BACK_SCALE,
    // 아래에 선 사람이 앞이다. 겹칠 때 누가 위인지를 이걸로 정한다
    z: Math.round(y),
  };
}

/**
 * 층에 따라 바뀌는 하늘색.
 *
 * **탑 색을 그대로 쓴다**(src/towers/catalog.js). 새로 정할 게 없고, 무지개 순서라
 * 이미 「나아가는 순서」라는 뜻이 붙어 있다 — 올라갈수록 하늘이 바뀌는 게 진행감이 된다.
 * 색을 짙게 섞는 건 CSS 가 한다(color-mix). 여기서는 어느 색인지만 고른다.
 */
export function skyOf(floor) {
  const n = TOWERS.length;
  const i = Math.floor(Math.max(0, (floor ?? 1) - 1) / 12) % n;
  return TOWERS[i].color;
}

function el(tag, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

/**
 * 무대를 만든다.
 *
 * 층 셋으로 나눈다 — 바닥(하늘·지평선) / 유닛 / 이펙트.
 * 이펙트를 유닛 위 별도 층에 두는 이유는, 참격이나 폭발이 **누구 뒤에 가려지면 안 되기**
 * 때문이다. 유닛끼리는 z로 겹치지만 이펙트는 항상 맨 위다.
 */
export function createStage() {
  const root = el('div', 'stage');
  const ground = el('div', 'stage__ground');
  const units = el('div', 'stage__units');
  const fx = el('div', 'stage__fx');
  root.append(ground, units, fx);

  /** 유닛을 전부 치운다 */
  function clear() { units.replaceChildren(); }

  /**
   * 유닛 하나를 자리에 세운다.
   * @param {HTMLElement} node 유닛 요소
   * @param {{x:number,y:number,scale:number,z:number}} spot
   */
  function place(node, spot) {
    node.style.left = `${spot.x}%`;
    node.style.top = `${spot.y}%`;
    node.style.setProperty('--scale', String(spot.scale));
    // ⚠️ **z-index 를 인라인으로 박으면 안 된다.** 인라인은 어떤 규칙보다 세서,
    // 「시전자를 암전 위로 올린다」 같은 CSS 가 통째로 안 먹는다(실제로 안 먹었다).
    // 변수로 넘기고 z-index 자체는 CSS 에 둔다 — 그래야 더 구체적인 규칙이 이긴다.
    node.style.setProperty('--z', String(spot.z));
    if (!node.isConnected) units.append(node);
  }

  /** 하늘색을 갈아 끼운다 */
  const setSky = (color) => root.style.setProperty('--sky', color);

  /** 전장의 실제 크기(px). 백분율 자리를 픽셀로 옮길 때 쓴다 */
  const size = () => ({ w: root.clientWidth, h: root.clientHeight });

  /**
   * 날아가는 것 하나를 띄운다. 끝나면 스스로 사라진다.
   *
   * CSS 애니메이션이 아니라 **Web Animations 로 그린다.** 날아가는 거리가
   * 매번 다른데(누가 누구를 때리느냐에 따라) CSS keyframe 은 그걸 못 받는다.
   * 시간은 부르는 쪽에서 이미 배속으로 나눠서 넘긴다.
   *
   * @param {string} kind slash | shell | bolt | wave | beam
   * @param {{x:number,y:number}} from 출발 자리(%)
   * @param {{x:number,y:number}} to 도착 자리(%)
   * @param {number} ms
   * @param {number} lift 포물선 높이(%). 0이면 직선
   */
  function fly(kind, from, to, ms, lift = 0) {
    if (ms <= 0) return;
    const node = el('div', `fx fx--${kind}`);
    // 발끝 좌표라 그대로 쓰면 바닥으로 날아간다. 가슴 높이로 올려 쏜다
    const a = { x: from.x, y: from.y - 14 };
    const b = { x: to.x, y: to.y - 14 };
    // 나아가는 쪽을 보게 눕힌다. 참격·화살이 뒤집혀 날면 바로 어색하다
    const deg = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    node.style.setProperty('--deg', `${deg}deg`);
    fx.append(node);
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - lift };
    const run = node.animate([
      { left: `${a.x}%`, top: `${a.y}%`, opacity: 1 },
      { left: `${mid.x}%`, top: `${mid.y}%`, opacity: 1 },
      { left: `${b.x}%`, top: `${b.y}%`, opacity: 1 },
    ], { duration: ms, easing: lift ? 'linear' : 'ease-in' });
    run.onfinish = () => node.remove();
    run.oncancel = () => node.remove();
  }

  /** 그 자리에서 한 번 터지는 것 */
  function burst(kind, at, ms) {
    if (ms <= 0) return;
    const node = el('div', `fx fx--${kind}`);
    node.style.left = `${at.x}%`;
    node.style.top = `${at.y - 14}%`;
    fx.append(node);
    const run = node.animate([{ opacity: 1 }, { opacity: 1 }], { duration: ms });
    run.onfinish = () => node.remove();
    run.oncancel = () => node.remove();
  }

  /** 재생 중인 이펙트를 전부 버린다. 판이 바뀔 때 쓴다 */
  function clearFx() { fx.replaceChildren(); }

  return { el: root, fx, clear, place, size, fly, burst, clearFx, setSky };
}
