// 개발자용 치트. **골드를 준다.**
//
// 이 파일 하나에 다 들어 있다 — 지우고 싶으면 app.js 의 import 한 줄만 지우면 된다.
// 스타일도 밖에 안 내보낸다(그래야 CSS 파일을 뒤질 일이 없다).
//
// ⚠️ **라이브에도 올라간다.** 정적 호스팅이라 소스를 보면 발동어가 그대로 보인다.
// 그래도 되는 이유: 혼자 하는 게임이고 순위표가 없어서 남에게 영향이 없다.
// 속이면 자기 손해일 뿐이다.
//
// ⚠️ **칭호가 딸려 온다.** 골드는 addGold 로 들어가므로 누적 획득에 잡히고,
// 「거상」(5만 골드 획득) 같은 골드 칭호가 자동으로 붙는다. 치트니까 그러라고 뒀다.

import { addGold } from './storage.js';

/** 발동어. 아무 데나 타자로 치면 된다 — 이 게임에는 글자 입력칸이 없어서 안 부딪힌다 */
const WORD = 'nyang';

/** 폰에는 키보드가 없다. 지갑을 이만큼 빠르게 두드려도 터진다 */
const TAPS = 7;
const TAP_WINDOW = 2500;

const AMOUNT = 100000;

/** 잠깐 떴다 사라지는 알림. CSS 파일을 안 만들려고 여기서 직접 꾸민다 */
function toast(text) {
  const box = document.createElement('div');
  box.textContent = text;
  Object.assign(box.style, {
    position: 'fixed', left: '50%', bottom: '84px', transform: 'translateX(-50%)',
    padding: '10px 16px', borderRadius: '999px',
    border: '1px solid #9e6a03', background: '#2a2314', color: '#ffd75e',
    font: '700 13px/1 Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif',
    zIndex: '9999', pointerEvents: 'none',
    opacity: '0', transition: 'opacity .18s ease',
  });
  document.body.append(box);
  requestAnimationFrame(() => { box.style.opacity = '1'; });
  setTimeout(() => {
    box.style.opacity = '0';
    setTimeout(() => box.remove(), 250);
  }, 1600);
}

function grant() {
  addGold(AMOUNT);
  toast(`+${AMOUNT.toLocaleString()} 골드`);
}

/**
 * 치트를 건다. 두 가지로 터진다 — 발동어 타자, 지갑 연타.
 * @param {HTMLElement} [tapTarget] 두드릴 자리. 없으면 타자만 받는다
 */
export function installCheat(tapTarget) {
  // ── 타자 ──
  let buf = '';
  window.addEventListener('keydown', (e) => {
    // 글자 한 자짜리 키만 모은다(Shift·Enter 같은 건 버린다)
    if (e.key.length !== 1) return;
    buf = (buf + e.key.toLowerCase()).slice(-WORD.length);
    if (buf !== WORD) return;
    buf = '';   // 한 번 터지면 비운다 — 안 그러면 이어 치는 대로 계속 터진다
    grant();
  });

  // ── 연타 (폰) ──
  if (!tapTarget) return;
  let taps = 0;
  let first = 0;
  tapTarget.addEventListener('click', () => {
    // ⚠️ 시각을 기준으로 창을 재야 한다. 횟수만 세면 하루 종일 눌러도 언젠가 터진다.
    const now = performance.now();
    if (now - first > TAP_WINDOW) { first = now; taps = 0; }
    taps += 1;
    if (taps < TAPS) return;
    taps = 0;
    grant();
  });
}
