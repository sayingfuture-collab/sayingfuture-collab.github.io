// 인물 카드. 뒷면에서 힌트 3개를 순차 공개하고, 뒤집어서 인물을 연다.
// 스타일은 card.css에 있다 — 쓰는 쪽에서 link 해야 한다.
// 뽑기 로직(gacha.js)은 여기서 건드리지 않는다. 인물 객체를 받기만 한다.
//
// 힌트 단계에서는 등급도 인물도 DOM에 없다. 개발자 도구를 열어도 안 보인다.
// 앞면은 뒤집는 순간에 만들어 붙인다.

import { skillInfo } from '../battle/skills.js';
import { artNode } from './art.js';

export const TIMING = {
  hint: 1500,  // 힌트 간격
  flip: 500,   // 힌트 3 이후 정지
  desc: 300,   // 뒤집힌 뒤 설명까지
};

const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * @param {object} character characters.js의 인물 하나
 * @param {{timing?: Partial<typeof TIMING>, skillText?: boolean}} [options]
 *   skillText:false 면 고유기 **이름만** 보이고 효과 설명은 감춘다.
 *   첫 화면 예시 카드에서 쓴다 — 페르소나 테스트에서 「4턴마다 아군 전체 공격력 +25%」가
 *   최다 이탈 지점이었다(14명 중 4명). 아직 뽑지도 않은 사람에게 읽을 이유가 없는 문장이다.
 * @returns {{el: HTMLElement, reveal: () => Promise<void>, skip: () => void, isDone: () => boolean}}
 */
export function createCard(character, { timing, skillText = true } = {}) {
  const t = { ...TIMING, ...timing };

  const root = el('article', 'card');
  root.dataset.phase = 'hint'; // hint → flipped

  const inner = el('div', 'card__inner');

  // ── 뒷면. 등급과 무관하게 전부 같은 모습이다 ──
  const back = el('div', 'card__back');
  back.append(el('div', 'card__mark', '?'));

  const hintList = el('ol', 'card__hints');
  const hintNodes = character.hints.map((text) => {
    const li = el('li', 'card__hint', text);
    li.dataset.shown = 'false';
    hintList.append(li);
    return li;
  });
  back.append(hintList);

  // ── 앞면. 비워둔다. 뒤집을 때 채운다 ──
  const front = el('div', 'card__front');

  inner.append(back, front);
  root.append(inner);

  let timers = [];
  let done = false;
  let flipped = false;
  let onDone = null;

  const at = (ms, fn) => timers.push(setTimeout(fn, ms));
  const showHint = (i) => { hintNodes[i].dataset.shown = 'true'; };

  // 여기서 처음으로 등급과 인물이 DOM에 들어간다.
  function flip() {
    if (flipped) return;
    flipped = true;
    front.append(
      el('div', 'card__tier', character.tier),
      artNode(character, 'card__art'),
      el('h2', 'card__name', character.name)
    );
    root.dataset.tier = character.tier; // 테두리색·등급 연출이 여기서 켜진다
    root.dataset.phase = 'flipped';
  }

  function showDesc() {
    if (front.querySelector('.card__desc')) return;
    const desc = el('p', 'card__desc', character.desc);
    desc.dataset.shown = 'false';
    front.append(desc);

    // 고유기가 있으면 같이 연다. SSR을 뽑은 보람이 여기서 보여야 한다.
    const info = skillInfo(character);
    if (info) {
      // :has() 대신 표식을 직접 단다. 그림을 줄여 고유기 자리를 만드는 규칙이 여기 걸린다.
      front.dataset.skill = 'true';
      const skill = el('div', 'card__skill');
      skill.append(el('b', null, info.name));
      if (skillText) skill.append(el('span', null, info.text));
      skill.dataset.shown = 'false';
      front.append(skill);
      void skill.offsetWidth;
      skill.dataset.shown = 'true';
    }
    // requestAnimationFrame으로 켜면 탭이 화면에 안 그려지는 동안 rAF가 멈춰서
    // 설명이 투명한 채로 남는다. 레이아웃을 한 번 강제로 확정시켜
    // 전환 효과만 걸리게 하고, 표시는 같은 tick에서 켠다.
    void desc.offsetWidth;
    desc.dataset.shown = 'true';
  }

  function finish() {
    if (done) return;
    done = true;
    timers.forEach(clearTimeout);
    timers = [];
    hintNodes.forEach((_, i) => showHint(i));
    flip();
    showDesc();
    onDone?.();
    onDone = null;
  }

  /** 남은 단계를 전부 건너뛰고 즉시 공개 */
  function skip() {
    finish();
  }

  /** 순차 공개 시작. 설명까지 나오면 resolve */
  function reveal() {
    return new Promise((resolve) => {
      if (done) return resolve();
      onDone = resolve;

      if (prefersReducedMotion()) return finish();

      showHint(0);                       // 0.0s 힌트 1
      at(t.hint, () => showHint(1));      // 1.5s 힌트 2
      at(t.hint * 2, () => showHint(2));  // 3.0s 힌트 3
      at(t.hint * 2 + t.flip, flip);      // 3.5s 뒤집기 — 이름·일러·테두리색 동시
      at(t.hint * 2 + t.flip + t.desc, () => { // 3.8s 설명
        showDesc();
        done = true;
        onDone?.();
        onDone = null;
      });
    });
  }

  return { el: root, reveal, skip, isDone: () => done };
}
