// 앱 — 학년 등록(첫 1회) → 오늘 화면 → R1 낱말 → R2 듣기 → R3 문장 → 결과.
// 하루 한 판: 오늘 기록이 있으면 바로 결과 화면.
import { dailyPuzzle, roundRecord, score } from './game.js';
import { kstStamp } from './seed.js';
import { GRADES, getGrade, setGrade, todayResult, saveResult, streak } from './store.js';
import { logRound } from './log.js';
import { createWordRound } from './ui/word-view.js';
import { createListenRound } from './ui/listen-view.js';
import { createVerbRound } from './ui/verb-view.js';
import { createResult } from './ui/result-view.js';

const app = document.getElementById('app');

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function swap(view) {
  app.innerHTML = '';
  app.append(view.el);
}

const stamp = kstStamp();
const puzzle = dailyPuzzle(stamp);
let allCells = [];

function showGradeGate() {
  const gate = el('div', 'gate');
  const cardEl = el('div', 'gate__card');
  cardEl.innerHTML = `
    <div class="gate__emoji">📬</div>
    <h2>처음 왔네요!</h2>
    <p>기록에 이름을 남기려면 학년을 골라 주세요 (딱 한 번만 물어요)</p>`;
  const grid = el('div', 'gate__grid');
  GRADES.forEach((g) => {
    const b = el('button', 'gate__btn', g);
    b.onclick = () => { setGrade(g); gate.remove(); start(); };
    grid.append(b);
  });
  cardEl.append(grid);
  gate.append(cardEl);
  document.body.append(gate);
}

function showIntro() {
  const root = el('div', 'play');
  const card = el('div', 'play__card end');
  const st = streak(stamp);
  card.innerHTML = `
    <div class="end__emoji">📮</div>
    <h2 class="end__title">오늘의 영어 #${puzzle.number}</h2>
    <div class="end__keep">
      매일 딱 한 판 — 모두가 같은 문제를 풀어요<br>
      🔤 낱말 3개 · 👂 듣기 2개 · 🧩 문장 3개<br>
      ${st >= 1 ? `🔥 지금 <b>${st}일 연속</b>!` : '5분이면 끝나요'}
    </div>`;
  const btns = el('div', 'btns');
  const go = el('button', 'btn', '오늘의 한 판 시작 →');
  go.onclick = playWord;
  btns.append(go);
  card.append(btns);
  root.append(card);
  swap({ el: root });
}

function playWord() {
  swap(createWordRound({
    words: puzzle.words, stamp,
    onDone: (cells) => { allCells = [...cells]; playListen(); },
  }));
}

function playListen() {
  swap(createListenRound({
    items: puzzle.listens, stamp,
    onDone: (cells) => { allCells = [...allCells, ...cells]; playVerb(); },
  }));
}

function playVerb() {
  swap(createVerbRound({
    items: puzzle.verbs, stamp,
    onDone: (cells) => { allCells = [...allCells, ...cells]; finish(); },
  }));
}

function finish() {
  saveResult(stamp, allCells, score(allCells));
  logRound(roundRecord(allCells));
  swap(createResult({ number: puzzle.number, stamp, cells: allCells, fresh: true }));
}

function start() {
  const done = todayResult(stamp);
  if (done) {
    swap(createResult({ number: puzzle.number, stamp, cells: done.cells, fresh: false }));
    return;
  }
  showIntro();
}

if (!getGrade()) showGradeGate(); else start();
