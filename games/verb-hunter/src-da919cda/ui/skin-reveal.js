// 스킨 구매 컷씬 — 산 순간에만 뜬다. 판을 방해하지 않게 상점 안에서만 불린다.
// 리서치 반영: 홈에 "스킨까지 12발자국!" 같은 재촉은 두지 않는다 (예고된 보상 회피).
// 사는 건 플레이어가 고른 것이라 자율성이 살아 있고, 연출은 그 선택을 축하하는 자리다.
//
// 연출: 숲 안쪽에서 고양이가 **걸어 나온다**. 그림 한 장으로 걷기를 만드는 건 다리가 아니라
// 리듬 — 한 걸음마다 몸이 튀고 기울고, 뒤에 발자국이 찍힌다 (CSS 쪽 .reveal__scene 주석 참고).
// 고양이가 도착한 다음에야 이름·문구가 올라온다. 걸어오는 동안은 고양이만 보여야 한다.
import { setSkin } from '../store.js';
import { gradeOf, skinVideo } from '../skins.js';
import { confetti } from '../juice.js';
import { fanfare } from '../audio.js';
import { hunterFigure } from './hunter-figure.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/** 걸어 들어오는 시간(ms). CSS 의 walkIn/stepBob 과 같은 값이어야 한다 */
export const WALK_MS = 1750;

/** 발자국 자리 — 뒤(작고 흐리게)에서 앞(크게)으로, 한 걸음에 하나씩 */
const PAW_TRAIL = [
  { left: 30, bottom: 46, size: 11, at: 0.10 },
  { left: 39, bottom: 38, size: 14, at: 0.42 },
  { left: 32, bottom: 29, size: 17, at: 0.74 },
  { left: 45, bottom: 20, size: 20, at: 1.06 },
  { left: 37, bottom: 11, size: 22, at: 1.38 },
];

function buildScene(skinId) {
  const scene = el('div', 'reveal__scene');
  for (const p of PAW_TRAIL) {
    const paw = el('span', 'reveal__paw', '🐾');
    paw.style.left = `${p.left}%`;
    paw.style.bottom = `${p.bottom}%`;
    paw.style.fontSize = `${p.size}px`;
    paw.style.animationDelay = `${p.at}s`;
    scene.append(paw);
  }
  scene.append(el('div', 'reveal__dust'));

  const walker = el('div', 'reveal__walker');
  const step = el('div', 'reveal__step');
  step.append(hunterFigure(skinId));
  walker.append(step);
  scene.append(walker);
  scene.append(el('div', 'reveal__skip', '아무 데나 누르면 바로 보기'));
  return scene;
}

function prefersStill() {
  return typeof matchMedia === 'function'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * @param {object} skin SKINS 항목
 * @param {() => void} onClose 닫은 뒤 화면 갱신
 */
export function showSkinReveal(skin, onClose) {
  const gate = el('div', 'gate reveal');
  const card = el('div', 'gate__card reveal__card');

  const g = gradeOf(skin.id);
  const tag = el('div', 'reveal__tag', `${g.name} 스킨 획득!`);
  tag.style.setProperty('--grade', g.color);
  card.append(tag);

  const stage = el('div', 'reveal__stage');
  card.append(stage);
  const name = el('h2', 'reveal__name', skin.name);
  const line = el('p', 'reveal__line', skin.line);
  card.append(name, line);

  const btns = el('div', 'btns');
  const wear = el('button', 'btn', '지금 입기');
  wear.onclick = () => { setSkin(skin.id); close(); };
  const later = el('button', 'btn ghost', '나중에');
  later.onclick = close;
  btns.append(wear, later);
  card.append(btns);

  let walking = false;
  let timer = null;
  let cheered = false;

  /** 이름·문구가 올라오는 시점을 옮긴다. CSS 기본값은 걸어오는 연출(1.8s) 기준이라
   *  영상은 길이가 제각각이니 여기서 다시 잡아준다. */
  function scheduleText(atSec) {
    const parts = [[tag, 0], [name, 0.08], [line, 0.16], [btns, 0.24]];
    for (const [node, off] of parts) node.style.animationDelay = `${atSec + off}s`;
  }

  function cheer() {
    if (cheered) return;
    cheered = true;
    confetti();
    fanfare();
  }

  /** 걸어오는 중이면 끝까지 감아버린다 (건너뛰기·모션 최소화) */
  function finish() {
    walking = false;
    clearTimeout(timer);
    gate.classList.add('done');
    cheer();
  }

  function walk() {
    stage.replaceChildren(buildScene(skin.id));
    if (prefersStill()) { finish(); return; }
    gate.classList.remove('done');
    walking = true;
    clearTimeout(timer);
    // 도착하는 순간이 축하 지점 — 콘페티가 걸음보다 먼저 터지면 걸어온 게 안 보인다
    timer = setTimeout(() => { walking = false; cheer(); }, WALK_MS);
  }

  const vsrc = skinVideo(skin.id);
  if (vsrc) {
    // 영상이 있으면 그게 곧 컷씬이다. 없거나 자동재생이 막히면 걸어오는 연출로 되돌아간다.
    // 영상도 걸어오는 장면이라 축하는 끝날 무렵에 터뜨린다 — 첫 프레임에 콘페티를 뿌리면
    // 애써 만든 걸음을 우리가 가려버린다.
    const v = document.createElement('video');
    v.className = 'reveal__video';
    v.muted = true; v.autoplay = true; v.playsInline = true; v.preload = 'auto';
    v.addEventListener('error', walk);
    // 파일이 아예 안 열리는 경우(오래된 캐시·잘린 파일)에도 화면이 비지 않게
    const loadGuard = setTimeout(walk, 2500);
    v.addEventListener('loadedmetadata', () => {
      clearTimeout(loadGuard);
      const at = Math.max(1.2, (v.duration || 3) - 0.6);
      scheduleText(at);
      clearTimeout(timer);
      timer = setTimeout(() => { walking = false; cheer(); }, at * 1000);
    });
    v.src = vsrc;
    stage.append(v);
    walking = true;
    // 재생 거부는 두 가지다. 자동재생 차단(NotAllowedError)이면 영상은 영영 안 도니
    // 걸어오는 연출로 갈아탄다. 화면을 내려서 절전으로 멈춘 것(AbortError)이면
    // 영상은 멀쩡하니 버리지 말고 돌아왔을 때 다시 튼다 — 아이는 판 중에 앱을 자주 내린다.
    const tryPlay = () => v.play().catch((e) => {
      if (document.hidden) {
        document.addEventListener('visibilitychange', function again() {
          if (document.hidden) return;
          document.removeEventListener('visibilitychange', again);
          tryPlay();
        });
        return;
      }
      if (e && e.name === 'AbortError') return;   // 잠깐 끊긴 것 — 영상은 그대로 둔다
      walk();
    });
    tryPlay();
  } else {
    walk();
  }

  // 첫 탭은 건너뛰기로만 쓴다 — 캡처 단계라 버튼보다 먼저 잡힌다.
  // (6개를 연달아 사는 아이가 매번 2초를 기다리게 두면 연출이 벌이 된다)
  gate.addEventListener('click', (e) => {
    if (!walking) return;
    e.stopPropagation();
    e.preventDefault();
    finish();
  }, true);

  gate.append(card);
  document.body.append(gate);

  function close() {
    clearTimeout(timer);
    gate.remove();
    if (onClose) onClose();
  }
}
