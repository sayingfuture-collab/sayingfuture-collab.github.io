// 화면 전환만 담당. 뷰는 만들 때마다 새로 만든다 — 저장이 유일한 진실이라 상태 동기화 걱정이 없다.
import { createHomeView } from './ui/home-view.js';
import { createPlayView } from './ui/play-view.js';
import { createDexView } from './ui/dex-view.js';
import { createDressView } from './ui/dress-view.js';
import { getSave, onSaveChange } from './store.js';

const app = document.getElementById('app');
const foot = document.getElementById('foot');

function show(view) {
  app.innerHTML = '';
  app.append(view.el);
  updateFoot();
}

function updateFoot() {
  const s = getSave();
  foot.textContent = s.rounds > 0 ? `${s.rounds}판 완주 · 잡은 동사 ${s.catches}마리` : '';
}

function goHome() { show(createHomeView({ onPlay: goPlay, onDex: goDex, onDress: goDress })); }
function goPlay(mode) { show(createPlayView({ mode, onHome: goHome })); }
function goDex() { show(createDexView({ onBack: goHome })); }
function goDress() { show(createDressView({ onBack: goHome })); }

// 저장이 바뀔 때마다 하단 줄 갱신 — 판이 끝나도, 포획해도 최신으로.
onSaveChange(updateFoot);

goHome();
