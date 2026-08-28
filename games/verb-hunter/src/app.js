// 화면 전환만 담당. 뷰는 만들 때마다 새로 만든다 — 저장이 유일한 진실이라 상태 동기화 걱정이 없다.
import { createHomeView } from './ui/home-view.js';
import { createPlayView } from './ui/play-view.js';
import { createDexView } from './ui/dex-view.js';
import { createDressView } from './ui/dress-view.js';
import { createBadgeView } from './ui/badge-view.js';
import { createFillView } from './ui/fill-view.js';
import { createOrderView } from './ui/order-view.js';
import { createBasicView } from './ui/basic-view.js';
import { createTrainView } from './ui/train-view.js';
import { makeReviewDeck } from './game.js';
import { getSave, onSaveChange, getGrade, setGrade, GRADES, dueLemmas } from './store.js';

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

function goHome() { show(createHomeView({ onPlay: goPlay, onDex: goDex, onDress: goDress, onBadges: goBadges })); }
function goPlay(mode) {
  if (mode === 'basic') { show(createBasicView({ onHome: goHome })); return; }
  if (mode === 'train') { show(createTrainView({ onHome: goHome })); return; }
  if (mode === 'fill') { show(createFillView({ onHome: goHome })); return; }
  if (mode === 'order') { show(createOrderView({ onHome: goHome })); return; }
  if (mode === 'review') {
    show(createPlayView({ mode, onHome: goHome, deck: makeReviewDeck(dueLemmas()) }));
    return;
  }
  show(createPlayView({ mode, onHome: goHome }));
}
function goDex() { show(createDexView({ onBack: goHome })); }
function goDress() { show(createDressView({ onBack: goHome })); }
function goBadges() { show(createBadgeView({ onBack: goHome })); }

// 사냥꾼 등록 — 처음 한 번만 학년을 묻는다. 기록에 '누가'가 남아야 하니까.
// 게임을 막는 문이 아니라 세계관의 일부(면허 발급)로 보이게 한다.
function showGradeGate() {
  const gate = document.createElement('div');
  gate.className = 'gate';
  gate.innerHTML = `
    <div class="gate__card">
      <div class="gate__emoji">🏹</div>
      <h2>사냥꾼 면허 발급</h2>
      <p>몇 학년 사냥꾼인가요?</p>
      <div class="gate__grid"></div>
    </div>`;
  const grid = gate.querySelector('.gate__grid');
  for (const g of GRADES) {
    const b = document.createElement('button');
    b.className = 'gate__btn';
    b.textContent = g;
    b.onclick = () => { setGrade(g); gate.remove(); };
    grid.appendChild(b);
  }
  document.body.append(gate);
}

// 저장이 바뀔 때마다 하단 줄 갱신 — 판이 끝나도, 포획해도 최신으로.
onSaveChange(updateFoot);

goHome();
if (!getGrade()) showGradeGate();
