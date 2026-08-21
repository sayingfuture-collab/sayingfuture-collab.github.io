// 선물 두루마리. 위에서 봉이 내려오고 종이가 아래로 펼쳐진다.
// 스타일은 gift-scroll.css 에 있다 — 쓰는 쪽에서 link 해야 한다.
//
// ⚠️ **종이 높이는 CSS 로 못 편다.** height: auto 는 애니메이션이 안 걸리고,
// scaleY 는 글자까지 늘어나서 찌그러진다. 그래서 **재서 px 로 편다.**
// grid-template-rows: 0fr→1fr 이라는 방법도 있는데, 이 게임은 폰에서 주로 도는데
// 그쪽 지원이 최근이라 재는 쪽을 골랐다. 재는 건 어디서나 된다.
//
// ⚠️ **붙이자마자 재면 안 된다.** 스타일과 글꼴이 아직 안 왔을 때 재게 되어 엉뚱한 값이
// 나온다 — 라이브에서 270px 짜리를 **1020px 로 쟀다**(2026-08-21). 로컬은 다 빨라서
// 안 걸렸고, 실제 망에서만 났다. 그래서 **펼치기 직전에, 글꼴을 기다렸다가** 잰다.
// 다 펴진 뒤에는 auto 로 풀어둔다. 그래야 화면을 돌리거나 글꼴이 늦게 바뀌어도 안 잘린다.

import { takeGift } from '../storage.js';

/** 연출 시각표(ms). 한 군데 모아둬야 순서를 눈으로 확인할 수 있다 */
const T = {
  rod: 60,        // 위 봉이 내려오기 시작
  unroll: 320,    // 종이가 펼쳐지기 시작
  text: 820,      // 글자가 떠오름
  button: 1060,   // 받기 버튼
  rollUp: 460,    // 말려 올라가는 시간
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const reduced = () =>
  globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;

/**
 * 선물 두루마리를 띄운다. 「받기」를 누르면 골드가 들어가고 말려 올라간다.
 *
 * **받기 말고 닫는 길은 안 둔다.** 실수로 닫으면 다음 접속까지 못 받는데,
 * 그건 선물이 아니라 함정이다. 누를 데가 하나면 헷갈릴 일도 없다.
 *
 * @param {import('../gifts.js').Gift} gift
 * @param {() => void} [onDone] 두루마리가 사라진 뒤에 부른다
 */
export function showGiftScroll(gift, onDone) {
  const overlay = el('div', 'gift');
  const scroll = el('div', 'gift__scroll');
  const rodTop = el('div', 'gift__rod gift__rod--top');
  const rodBottom = el('div', 'gift__rod gift__rod--bottom');
  const paper = el('div', 'gift__paper');
  const inner = el('div', 'gift__inner');

  inner.append(el('div', 'gift__seal', '✉'));
  inner.append(el('h2', 'gift__title', gift.title));
  const body = el('p', 'gift__body');
  gift.body.forEach((line, i) => {
    if (i) body.append(document.createElement('br'));
    body.append(line);
  });
  inner.append(body);

  const amount = el('div', 'gift__amount');
  amount.append(el('b', null, gift.gold.toLocaleString()), el('span', null, '골드'));
  inner.append(amount);

  const take = el('button', 'gift__take', '받기');
  take.type = 'button';
  inner.append(take);

  paper.append(inner);
  scroll.append(rodTop, paper, rodBottom);
  overlay.append(scroll);
  document.body.append(overlay);

  /** 지금 이 순간의 펼친 높이. **부를 때마다 다시 잰다** */
  function measure() {
    const was = paper.style.height;
    paper.style.transition = 'none';
    paper.style.height = 'auto';
    const full = paper.scrollHeight;
    paper.style.height = was;
    void paper.offsetHeight;       // 시작 상태를 각인시킨다
    paper.style.transition = '';
    return full;
  }

  /** 펼친다. 글꼴을 기다렸다가 재야 값이 맞는다 */
  async function unroll() {
    try { await document.fonts?.ready; } catch { /* 글꼴 API 가 없어도 진행한다 */ }
    if (closed) return;
    paper.style.height = `${measure()}px`;
  }

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    inner.classList.remove('is-in');
    // auto 에서 0 으로는 애니메이션이 안 걸린다. 지금 높이를 px 로 못박고 접는다.
    paper.style.height = `${paper.getBoundingClientRect().height}px`;
    void paper.offsetHeight;
    paper.style.height = '0px';
    scroll.classList.add('is-out');
    setTimeout(() => {
      overlay.remove();
      onDone?.();
    }, T.rollUp);
  }

  // 다 펴지면 auto 로 풀어둔다 — 못박아 두면 나중에 글이 한 줄 늘 때 잘린다.
  paper.addEventListener('transitionend', (e) => {
    if (e.propertyName === 'height' && !closed && paper.style.height !== '0px') {
      paper.style.height = 'auto';
    }
  });

  take.addEventListener('click', () => {
    if (closed) return;
    // ⚠️ 저장이 먼저다. 연출 끝에 주면 그 사이에 창을 닫은 사람은 못 받는다.
    takeGift(gift.id);
    take.disabled = true;
    take.textContent = '받았습니다';
    setTimeout(close, 520);
  });

  if (reduced()) {
    // 움직임을 줄이라고 한 사람에게는 그냥 펴서 보여준다. 잴 것도 없다.
    overlay.classList.add('is-on');
    paper.style.transition = 'none';
    paper.style.height = 'auto';
    inner.classList.add('is-in');
    take.classList.add('is-in');
    return { close };
  }

  // ⚠️ **requestAnimationFrame 으로 시작하면 안 된다.** 숨은 탭에서는 아예 안 불린다 —
  // 배경 탭으로 열어두면 두루마리가 영영 안 펴진 채로 화면만 덮는다(실측).
  // 시작 상태를 브라우저에 각인시키는 데는 리플로우 한 번이면 충분하고, 이건 늘 돈다.
  void paper.offsetHeight;
  overlay.classList.add('is-on');
  setTimeout(() => scroll.classList.add('is-down'), T.rod);
  setTimeout(unroll, T.unroll);
  setTimeout(() => inner.classList.add('is-in'), T.text);
  setTimeout(() => take.classList.add('is-in'), T.button);

  return { close };
}
