// 층 보상 고르기. 판 중에 생기는 유일한 결정이라 화면을 크게 쓴다.
//
// 고른 것은 판이 끝나면 사라진다 — 다음 판은 다시 맨손이다.
// 그래서 "이번 판을 어떻게 끌고 갈까"가 매번 새로 생긴다.

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function createRewardView() {
  const root = el('div', 'reward');
  root.hidden = true;

  const head = el('div', 'reward__head');
  const title = el('div', 'reward__title');
  const sub = el('div', 'reward__sub', '하나를 고르세요');
  head.append(title, sub);

  const list = el('div', 'reward__list');
  const owned = el('div', 'reward__owned');

  root.append(head, list, owned);

  /**
   * @param {number} floor 방금 깬 층
   * @param {Array<{id,name,text}>} offer
   * @param {Array<{name}>} already 지금까지 고른 것
   * @returns {Promise<string>} 고른 보상 id
   */
  function ask(floor, offer, already) {
    title.textContent = `${floor}층 돌파`;
    list.replaceChildren();
    owned.replaceChildren();

    if (already.length) {
      owned.append(el('span', 'reward__ownedLabel', '지금까지'));
      for (const r of already) owned.append(el('span', 'reward__chip', r.name));
    }

    return new Promise((resolve) => {
      for (const o of offer) {
        const card = el('button', 'reward__card');
        card.type = 'button';
        card.append(el('div', 'reward__name', o.name), el('div', 'reward__text', o.text));
        card.onclick = () => { root.hidden = true; resolve(o.id); };
        list.append(card);
      }
      root.hidden = false;
    });
  }

  /** 판이 갈아엎히면 기다리던 약속을 끊는다 */
  function close() { root.hidden = true; }

  return { el: root, ask, close };
}
