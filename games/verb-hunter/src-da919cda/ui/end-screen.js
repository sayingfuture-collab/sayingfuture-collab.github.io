// 완주 화면 — 네 사냥터가 공유한다.
// 전에는 화면마다 따로 만들어 두었는데, 그러다 기초 캠프만 기록 초기화를 빠뜨려
// 두 번째 완주가 60개로 찍히는 사고가 났다. 정책(남는 것 3줄·숨은 칭호 비예고·
// 다음 목표는 보이는 칭호만)이 한 곳에만 있어야 화면마다 어긋나지 않는다.
import { BADGES, BADGE_BY_ID } from '../badges.js';
import { confetti } from '../juice.js';
import { fanfare } from '../audio.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/**
 * @param {object} o
 * @param {boolean} o.perfect      만점 여부 (🌟 / 🎉)
 * @param {string}  o.title        '동사 사냥 완주!'
 * @param {string}  o.keepHtml     '실패해도 남는 것' 블록 (HTML)
 * @param {string}  o.message      한 줄 메시지
 * @param {string[]} o.earned      이번 판에 새로 얻은 칭호 id
 * @param {object}  o.save         getSave() 결과 — 다음 목표 계산용
 * @param {string}  [o.bigEmoji]   기본은 perfect 에 따라 자동
 * @param {string}  [o.nextLine]   다음 목표 줄을 직접 지정 (없으면 보이는 칭호에서 자동)
 * @param {Array<{label: string, onClick: Function, ghost?: boolean}>} o.buttons
 * @returns {HTMLElement} .end 요소
 */
export function createEndScreen({
  perfect, title, keepHtml, message, earned = [], save, bigEmoji, nextLine, buttons = [],
}) {
  confetti();
  fanfare();

  const end = el('div', 'end');
  end.append(el('div', 'big', bigEmoji || (perfect ? '🌟' : '🎉')));
  end.append(el('h2', null, title));

  // 실패해도 남는 것 — 한 판도 헛되지 않게 (Hades 원칙)
  const keep = el('div', 'keep');
  keep.innerHTML = keepHtml;
  end.append(keep);
  end.append(el('p', 'msg', message));

  if (earned.length) {
    end.append(el('div', 'badge-title', '🏅 칭호 획득!'));
    earned.forEach((id, i) => {
      const b = BADGE_BY_ID.get(id);
      if (!b) return;
      const bc = el('div', `badge-card r${b.r}`);
      bc.style.animationDelay = `${i * 0.25}s`;
      bc.append(el('div', 'stars', '★'.repeat(b.r)));
      bc.append(el('div', 'bname', b.n));
      bc.append(el('div', 'bdesc', b.d || b.cond));
      end.append(bc);
    });
    if (earned.some((id) => BADGE_BY_ID.get(id)?.r === 4)) setTimeout(confetti, 500);
  }

  // 다음 목표: '보이는(진행형)' 칭호만 하나. 숨은 칭호는 예고하지 않는다 —
  // 예고된 보상은 내재동기를 갉아먹는다 (과잉정당화).
  if (nextLine) {
    end.append(el('div', 'next-goal', nextLine));
  } else if (save) {
    const goal = BADGES.find((b) => !b.hidden && !save.badges.includes(b.id));
    if (goal) end.append(el('div', 'next-goal', `🔒 ${goal.n} — ${goal.cond}`));
  }

  const btns = el('div', 'btns');
  for (const b of buttons) {
    const node = el('button', 'btn' + (b.ghost ? ' ghost' : ''), b.label);
    node.onclick = b.onClick;
    btns.append(node);
  }
  end.append(btns);
  return end;
}
