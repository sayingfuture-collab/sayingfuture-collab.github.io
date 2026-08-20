// 인물 그림. 그림이 있으면 그림을, 없으면 이모지를 그린다.
//
// 이모지가 나오는 자리가 여섯 군데(카드·도감 격자·도감 상세·편성 칩·고르기 칸·전장)라
// 자리마다 img 만들고 onerror 붙이는 걸 반복하면 한 군데씩 빠뜨린다. 여기 하나로 모은다.
//
// 그림은 134명 중 일부만 있다. **섞여 있어도 안 깨지는 게 요점** —
// 없는 인물은 이모지로 그대로 남는다.

/**
 * 그림이 있는 인물 id.
 *
 * `assets/units/<id>.png` 를 넣고 여기에 id를 적으면 그림으로 바뀐다.
 * 파일만 넣고 여기 안 적으면 이모지가 그대로 나온다 — 반대도 마찬가지지만,
 * 그쪽은 onerror가 받아서 이모지로 떨어진다.
 */
export const UNIT_ASSETS = new Set([
  // SSR 14
  'sejong',
  'yisun',
  'wonhyo',
  'jangyeongsil',
  'gwanggaeto',
  'ganggamchan',
  'davinci',
  'newton',
  'napo',
  'alex',
  'khan',
  'guanyu',
  'zhugeliang',
  'hippocrates',

  // SR 28
  'michelangelo',
  'galileo',
  'archimedes',
  'plato',
  'shakespeare',
  'mozart',
  'beethoven',
  'confucius',
  'xiangyu',
  'musashi',
  'euljimundeok',
  'gyebaek',
  'kimyusin',
  'munmuwang',
  'seondeok',
  'daejoyeong',
  'sinsaimdang',
  'yihwang',
  'heojun',
  'kwonyul',
  'hwangjini',
  'kimhongdo',
  'jeongyagyong',
  'kimsatgat',
  'cleo',
  'caesar',
  'joan',
  'socr',
]);

export const hasArt = (id) => UNIT_ASSETS.has(id);

/**
 * 인물 그림을 담은 요소를 만든다.
 *
 * @param {object} character characters.js의 인물
 * @param {string} className 겉을 감싸는 요소의 class
 * @returns {HTMLElement}
 */
export function artNode(character, className) {
  const box = document.createElement('div');
  if (className) box.className = className;

  if (!UNIT_ASSETS.has(character.id)) {
    box.textContent = character.e;
    return box;
  }

  const img = document.createElement('img');
  // 도트 그림은 흐리게 늘리면 죽는다. 크기는 자리마다 다르니 class 하나로 묶어
  // 한 군데서 켠다 — img 태그가 아홉 자리에 흩어져 있어 자리마다 적으면 빠뜨린다.
  img.className = 'dot';
  img.src = `./assets/units/${character.id}.png`;
  img.alt = character.name;
  // 파일이 없거나 깨졌으면 이모지로 떨어진다. 화면이 비는 것보다 낫다.
  img.onerror = () => { box.replaceChildren(character.e); };
  box.append(img);
  return box;
}
