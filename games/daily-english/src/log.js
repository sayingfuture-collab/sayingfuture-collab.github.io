// 원격 기록 — 판이 끝나면 구글 시트에 한 줄. fire-and-forget (동사사냥꾼과 동일 원칙).
import { LOG_URL, PLAYER } from './log-config.js?v=1';
import { getGrade, totalPlays } from './store.js';

export function logRound(rec) {
  if (!LOG_URL) return;
  try {
    const body = JSON.stringify({
      player: getGrade() || PLAYER,
      at: new Date().toISOString(),
      mode: rec.mode,
      modeName: '데일리',
      firstTryHits: rec.firstTryHits,
      bestCombo: rec.bestCombo,
      catches: 0,
      owned: 0,
      rounds: totalPlays(),
    });
    if (!(navigator.sendBeacon && navigator.sendBeacon(LOG_URL, body))) {
      fetch(LOG_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' }, body });
    }
  } catch { /* 기록 실패는 게임 일이 아니다 */ }
}
