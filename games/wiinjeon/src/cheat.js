// 개발자용 치트. **골드를 준다. 그리고 그 흔적을 남기고 되돌릴 수 있게 한다.**
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
// 되돌리면 그 칭호도 같이 사라진다 — 저장을 통째로 되돌리기 때문이다.
//
// ── 기록과 되돌리기 (2026-08-21) ──
//
// **항목별로 되돌리는 방식은 안 된다.** 골드만 100,000 빼면 그 골드로 딴 칭호,
// 올린 레벨, 늘어난 누적 획득이 그대로 남아서 저장이 조용히 어긋난다.
// 그래서 **주기 직전에 저장 전체를 떠 두고, 되돌릴 때 통째로 갈아 끼운다.**
//
// 기록은 **게임 저장과 다른 열쇠에 둔다.** 같은 데 두면 되돌리는 순간 기록 자신이
// 같이 지워져서 「몇 번 썼는지」가 남지 않는다. 그러면 잡을 수가 없다.

import { addGold, getGold, snapshot, restoreSnapshot, createStore } from './storage.js';

/** 발동어. 아무 데나 타자로 치면 된다 — 이 게임에는 글자 입력칸이 없어서 안 부딪힌다 */
const WORD = 'nyang';
/** 되돌리기(무르기). WORD 와 **길이가 같고 서로 앞머리가 아니어야** 한 버퍼로 볼 수 있다 */
const BACK = 'mulli';

/** 폰에는 키보드가 없다. 지갑을 이만큼 빠르게 두드려도 터진다 */
const TAPS = 7;
const TAP_WINDOW = 2500;

const AMOUNT = 100000;

/** 되돌릴 수 있는 최대 횟수. 이보다 오래된 것은 흔적만 남고 되돌리기는 못 한다 */
const KEEP = 20;

const log = createStore('historyGacha.cheat.v1');

/**
 * @typedef {object} CheatLog
 * @property {number} total  **쓴 횟수 누적. 되돌려도 안 줄어든다** — 이게 잡는 근거다
 * @property {Array<{at: number, amount: number, before: string}>} uses 되돌릴 수 있는 것만
 */

/** @returns {CheatLog} */
function readLog() {
  try {
    const raw = JSON.parse(log.get() ?? 'null');
    return {
      total: Number.isInteger(raw?.total) && raw.total >= 0 ? raw.total : 0,
      uses: Array.isArray(raw?.uses) ? raw.uses.filter((u) => typeof u?.before === 'string') : [],
    };
  } catch {
    return { total: 0, uses: [] };
  }
}

function writeLog(next) {
  try { log.set(JSON.stringify(next)); } catch { /* 저장이 막혀도 게임은 굴러가야 한다 */ }
}

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

/**
 * 골드를 준다. **주기 전에 저장을 떠 둔다** — 순서가 뒤집히면 치트가 낀 저장을 뜨게 되어
 * 되돌려도 골드가 그대로 남는다.
 * @returns {number} 몇 번째 치트인지
 */
export function grant() {
  const before = snapshot();
  const state = readLog();
  addGold(AMOUNT);
  state.total += 1;
  state.uses.push({ at: Date.now(), amount: AMOUNT, before });
  // 오래된 것부터 버린다. 흔적(total)은 안 줄어드니 잡는 데는 지장이 없다.
  if (state.uses.length > KEEP) state.uses = state.uses.slice(-KEEP);
  writeLog(state);
  return state.total;
}

/**
 * 마지막 치트부터 n 번 되돌린다.
 *
 * ⚠️ **그 사이에 정상으로 논 것도 같이 사라진다.** 저장을 통째로 갈아 끼우기 때문이다.
 * 「치트를 안 쓴 것으로 되돌린다」는 원래 그런 뜻이라 그대로 뒀다.
 *
 * @returns {{undone: number, left: number}} 실제로 되돌린 횟수와 남은 되돌리기 횟수
 */
export function undo(n = 1) {
  const state = readLog();
  const count = Math.min(Math.max(0, Math.floor(n)), state.uses.length);
  if (!count) return { undone: 0, left: state.uses.length };
  // 여러 번이면 **제일 오래된 것의 직전**으로 한 번에 간다. 중간 상태를 거칠 이유가 없다.
  const target = state.uses[state.uses.length - count];
  if (!restoreSnapshot(target.before)) return { undone: 0, left: state.uses.length };
  state.uses = state.uses.slice(0, state.uses.length - count);
  writeLog(state);   // total 은 그대로 둔다 — 되돌려도 「쓴 적 있다」는 남는다
  return { undone: count, left: state.uses.length };
}

/** 화면에 붙일 흔적. 한 번도 안 썼으면 null 이라 아무것도 안 그린다 */
export function cheatMark() {
  const { total, uses } = readLog();
  if (!total) return null;
  return { total, undoable: uses.length, gold: uses.length * AMOUNT };
}

/** 콘솔에서 볼 수 있게 표로 뿌린다 */
function printLog() {
  const { total, uses } = readLog();
  console.log(`치트 쓴 횟수 ${total}번 (되돌릴 수 있는 것 ${uses.length}번)`);
  console.table(uses.map((u, i) => ({
    번째: total - uses.length + i + 1,
    시각: new Date(u.at).toLocaleString('ko-KR'),
    금액: u.amount.toLocaleString(),
  })));
  return `현재 골드 ${getGold().toLocaleString()}`;
}

/**
 * 치트를 건다. 두 가지로 터진다 — 발동어 타자, 지갑 연타.
 * @param {HTMLElement} [tapTarget] 두드릴 자리. 없으면 타자만 받는다
 */
export function installCheat(tapTarget) {
  // ── 타자 ──
  // 발동어 둘의 길이가 같아서 버퍼 하나로 둘 다 본다.
  const len = Math.max(WORD.length, BACK.length);
  let buf = '';
  window.addEventListener('keydown', (e) => {
    // 글자 한 자짜리 키만 모은다(Shift·Enter 같은 건 버린다)
    if (e.key.length !== 1) return;
    buf = (buf + e.key.toLowerCase()).slice(-len);
    if (buf === WORD) {
      buf = '';   // 한 번 터지면 비운다 — 안 그러면 이어 치는 대로 계속 터진다
      toast(`+${AMOUNT.toLocaleString()} 골드 (치트 ${grant()}번째)`);
    } else if (buf === BACK) {
      buf = '';
      const { undone, left } = undo(1);
      toast(undone
        ? `치트 1번 되돌림 (더 되돌릴 수 있는 것 ${left}번)`
        : '되돌릴 치트가 없습니다');
    }
  });

  // 콘솔 창구. 폰에는 키보드가 없어서 되돌리기는 여기서만 되는 경우가 있다.
  globalThis.치트 = {
    기록: printLog,
    무르기: (n = 1) => { const r = undo(n); return `${r.undone}번 되돌림 · 남은 것 ${r.left}번`; },
    전부무르기: () => { const r = undo(Infinity); return `${r.undone}번 되돌림 · 치트 안 쓴 상태로 돌아감`; },
  };

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
    toast(`+${AMOUNT.toLocaleString()} 골드 (치트 ${grant()}번째)`);
  });
}
