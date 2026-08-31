// 인물 그림. 그림이 있으면 그림을, 없으면 이모지를 그린다.
//
// 이모지가 나오는 자리가 여섯 군데(카드·도감 격자·도감 상세·편성 칩·고르기 칸·전장)라
// 자리마다 img 만들고 onerror 붙이는 걸 반복하면 한 군데씩 빠뜨린다. 여기 하나로 모은다.
//
// 2026-08-22부터 **134명 전원에게 그림이 있다.** 그래도 이모지 갈래는 남겨둔다 —
// id를 여기 안 적었거나 파일이 깨졌을 때 화면이 비는 것보다 낫다.

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

  // R 76 — 사람이 아니라 사물을 그린다 (docs/카드-일러-지침_2-R사물.md)
  'copernicus',
  'kepler',
  'gutenberg',
  'leeuwenhoek',
  'pascal',
  'descartes',
  'eratosthenes',
  'euclid',
  'pythagoras',
  'hypatia',
  'aristotle',
  'diogenes',
  'herodotus',
  'spartacus',
  'leonidas',
  'augustus',
  'aurelius',
  'boudica',
  'vercingetorix',
  'cyrus',
  'hammurabi',
  'tutankhamun',
  'ramses',
  'hatshepsut',
  'saladin',
  'charlemagne',
  'alfred',
  'elcid',
  'leiferikson',
  'dante',
  'cervantes',
  'bach',
  'magellan',
  'dagama',
  'peter',
  'suleiman',
  'ibnbattuta',
  'alkhwarizmi',
  'ibnsina',
  'ashoka',
  'mencius',
  'sunzi',
  'simaqian',
  'zhenghe',
  'cailun',
  'zhangqian',
  'xuanzang',
  'wangxizhi',
  'libai',
  'dufu',
  'murasaki',
  'hyecho',
  'choichiwon',
  'ureuk',
  'seohui',
  'yungwan',
  'ilyeon',
  'choimuseon',
  'munikjeom',
  'hwanghui',
  'yiyi',
  'yuseongnyong',
  'kimsimin',
  'gwakjaeu',
  'samyeong',
  'heonanseolheon',
  'kimmandeok',
  'anyongbok',
  'jeongseon',
  'sinyunbok',
  'bakjiwon',
  'kimjeongho',
  'eliz',
  'hanni',
  'polo',
  'wu',

  // N 16 — 직업의 연장. 색은 한 벌로 묶여 있다 (한 덩어리로 읽혀야 한다)
  'watercarrier',
  'roofer',
  'courier',
  'cook',
  'wetnurse',
  'gravedigger',
  'drummer',
  'lamplighter',
  'stablehand',
  'seamstress',
  'interpreter',
  'porter',
  'mason',
  'scribe',
  'spear',
  'ferry',
]);

export const hasArt = (id) => UNIT_ASSETS.has(id);

/**
 * 사람을 그린 인물인가.
 *
 * SSR·SR 42명만 사람이고 R·N 92명은 사물이다(항아리·눈송이·국자).
 * 왜 사물인지는 docs/카드-일러-지침_2-R사물.md 에 있다 — 요약하면
 * **32칸에서는 얼굴이 안 보이고, 이 게임은 이름 맞히기라 그림이 힌트 몫을 해야 한다.**
 *
 * 전장에서 둘은 **움직이는 법이 다르다.** 사람은 걷고 내지르고, 사물은 떠서
 * 회전하고 튕긴다. 사물에 다리를 달 수는 없으니 문법을 따로 준 것이다.
 */
export const isPersonArt = (character) =>
  character?.tier === 'SSR' || character?.tier === 'SR';

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

/**
 * 전장용 그림. 초상과 **다른 파일**을 쓴다.
 *
 * `assets/battle/<id>.png` 는 32 × 144 짜리 띠다 — 자세 셋(idle·wind·strike)을
 * 세로로 붙여 놨다. img 를 셋 두고 src 를 갈아 끼우면 처음 한 번은 캐시가 없어
 * 빈 채로 지나가므로, **한 장을 배경으로 깔고 위치만 민다.**
 * 어느 자세를 보일지는 CSS 가 `--frame` 으로 정한다(fight-view.css).
 *
 * 초상(artNode)과 갈라 둔 이유는 카드·도감·편성칩 여섯 자리가 초상을 쓰기 때문이다.
 * 한 함수로 합치면 전장을 고칠 때마다 카드가 같이 흔들린다.
 */
export function battleArtNode(character, className) {
  const box = document.createElement('div');
  if (className) box.className = className;
  box.dataset.kind = isPersonArt(character) ? 'person' : 'thing';

  if (!UNIT_ASSETS.has(character.id)) {
    box.textContent = character.e;
    box.dataset.kind = 'emoji';
    return box;
  }

  const battle = `./assets/battle/${character.id}.png`;
  box.style.backgroundImage = `url("${battle}")`;
  box.setAttribute('role', 'img');
  box.setAttribute('aria-label', character.name);

  // ⚠️ **background-image 는 실패해도 아무 말이 없다.** 파일이 없으면 그 인물만
  // 투명한 상자가 되어 조용히 사라진다 — 초상(artNode)은 onerror 로 이모지에
  // 떨어지는데 여기는 떨어질 자리가 아예 없었다.
  // 그래서 따로 재본다. 전투 그림이 없으면 **초상**으로, 그것도 없으면 이모지로.
  // 전신은 아니지만 빈 자리보다 낫고, 무엇보다 **빠진 걸 눈으로 알 수 있다.**
  const probe = new Image();
  probe.onerror = () => {
    const portrait = `./assets/units/${character.id}.png`;
    const back = new Image();
    back.onload = () => {
      box.style.backgroundImage = `url("${portrait}")`;
      box.dataset.kind = 'portrait';
    };
    back.onerror = () => {
      box.style.backgroundImage = '';
      box.dataset.kind = 'emoji';
      box.textContent = character.e;
    };
    back.src = portrait;
  };
  probe.src = battle;
  return box;
}
