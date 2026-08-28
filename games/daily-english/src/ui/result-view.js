// 결과 화면 — 격자 + 공유 복사 + 스트릭 + 가상 백분위.
// 오늘 이미 푼 사람이 다시 들어와도 이 화면을 보여준다 (하루 한 판).
import { ROUNDS, CELL, score, MAX_SCORE, shareText, percentile } from '../game.js';
import { streak } from '../store.js';
import { confetti } from '../juice.js';
import { fanfare } from '../audio.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export function createResult({ number, stamp, cells, fresh }) {
  const root = el('div', 'play');
  const card = el('div', 'play__card end');
  root.append(card);

  const sc = score(cells);
  const st = streak(stamp);
  const pct = percentile(sc, stamp);
  const top = Math.max(1, 100 - pct);

  if (fresh) { confetti(); fanfare(); }

  const title = el('h2', 'end__title',
    sc === MAX_SCORE ? '완벽한 하루! 🏆' : sc >= 12 ? '오늘의 영어 완주! 🎉' : '오늘의 영어 완주!');
  card.append(el('div', 'end__emoji', sc === MAX_SCORE ? '🏆' : '📬'), title);

  // 격자
  const grid = el('div', 'grid');
  let i = 0;
  for (const r of ROUNDS) {
    const row = el('div', 'grid__row');
    row.append(el('span', 'grid__label', `${r.emoji} ${r.name}`));
    const cellsEl = el('span', 'grid__cells',
      cells.slice(i, i + r.count).map((c) => CELL[c]).join(''));
    row.append(cellsEl);
    grid.append(row);
    i += r.count;
  }
  card.append(grid);

  const keep = el('div', 'end__keep');
  keep.innerHTML =
    `점수: <b>${sc} / ${MAX_SCORE}</b> · 오늘 푼 사람 중 <b>상위 ${top}%</b><br>` +
    (st >= 2 ? `🔥 <b>${st}일 연속</b> 플레이 중!` : `내일도 오면 🔥 연속 기록이 시작돼요`);
  card.append(keep);

  const btns = el('div', 'btns');
  const copyBtn = el('button', 'btn', '📋 결과 복사 (카톡 자랑)');
  copyBtn.onclick = async () => {
    const text = shareText(number, cells, st);
    try {
      await navigator.clipboard.writeText(text);
      copyBtn.textContent = '✅ 복사됐어요!';
    } catch {
      // 클립보드 미지원 폴백
      const ta = document.createElement('textarea');
      ta.value = text; document.body.append(ta); ta.select();
      try { document.execCommand('copy'); copyBtn.textContent = '✅ 복사됐어요!'; }
      catch { copyBtn.textContent = '길게 눌러 복사해 주세요'; }
      ta.remove();
    }
    setTimeout(() => { copyBtn.textContent = '📋 결과 복사 (카톡 자랑)'; }, 2200);
  };
  btns.append(copyBtn);
  const hunter = el('a', 'btn ghost', '🏹 동사 사냥꾼 하러 가기');
  hunter.href = '../verb-hunter/index.html';
  btns.append(hunter);
  card.append(btns);

  card.append(el('p', 'end__next', '새 문제는 내일 자정(한국 시간)에 나와요 🌙'));

  return { el: root };
}
