// 알약 버튼 한 줄. 도감 필터와 편성 고르기가 같이 쓴다.
//
// 처음엔 도감 안에만 있었고, 고르기는 정렬 알약을 따로 만들어 썼다. 거기에 필터를
// 붙이려니 같은 코드를 세 번째로 쓰게 생겨서 여기로 뺐다.
// **생김새가 다르면 다른 기능처럼 보인다** — 그래서 모양은 한 군데서만 정한다.
//
// 클래스 이름은 화면마다 달라서(book__chip / picker__chip) 접두사로 받는다.

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * 하나만 켜지는 알약 줄. 고른 값이 바뀌면 onChange를 부른다.
 *
 * @param {string} prefix 클래스 접두사 — 'book'이면 book__filter / book__chip
 * @param {string} label 왼쪽에 붙는 이름
 * @param {Array<{value: string, name: string}>} opts 첫 항목이 처음 켜져 있는 것
 * @param {(value: string) => void} onChange
 */
export function chipRow(prefix, label, opts, onChange) {
  const row = el('div', `${prefix}__filter`);
  row.append(el('span', `${prefix}__filterLabel`, label));
  const buttons = opts.map((o, i) => {
    const b = el('button', `${prefix}__chip`, o.name);
    b.type = 'button';
    b.dataset.value = o.value;
    b.dataset.on = String(i === 0);
    b.onclick = () => {
      buttons.forEach((x) => { x.dataset.on = String(x === b); });
      onChange(o.value);
    };
    row.append(b);
    return b;
  });
  return row;
}

/** 필터용 — 맨 앞에 '전체'(빈 값)를 붙인다 */
export function filterRow(prefix, label, values, onChange) {
  return chipRow(
    prefix,
    label,
    [{ value: '', name: '전체' }, ...values.map((v) => ({ value: v, name: v }))],
    onChange
  );
}

/** 두 화면이 같은 목록을 써야 필터 결과가 어긋나지 않는다 */
export const TIERS = ['SSR', 'SR', 'R', 'N'];
export const ROLES = ['지휘', '장인', '전사', '치유', '포격'];
