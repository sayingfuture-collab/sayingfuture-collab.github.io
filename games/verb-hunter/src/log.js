// 원격 기록 — 판이 끝날 때마다 구글 시트에 한 줄.
// 원칙: fire-and-forget. 전송이 실패하든 느리든 게임은 절대 모른다.
// 목적: 선생님이 시트만 열면 "학생이 스스로 몇 판 했는지"가 보인다 — 이 게임의 진짜 성공 지표.
import { LOG_URL, PLAYER } from './log-config.js';
import { getGrade } from './store.js';

export function logRound(rec, save) {
  if (!LOG_URL) return;
  try {
    const body = JSON.stringify({
      player: getGrade() || PLAYER, // 등록 화면에서 고른 학년 — 시트의 '이름' 칸
      at: new Date().toISOString(),
      mode: rec.mode,
      firstTryHits: rec.firstTryHits,
      bestCombo: rec.bestCombo,
      catches: save.catches,
      owned: save.owned,
      rounds: save.rounds,
    });
    // sendBeacon: 화면을 닫아도 전송이 살아남는다. 안 되면 no-cors fetch로.
    // (no-cors: 응답은 못 읽지만 전송은 된다 — 앱스 스크립트 웹앱의 CORS 제약 우회)
    if (!(navigator.sendBeacon && navigator.sendBeacon(LOG_URL, body))) {
      fetch(LOG_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' }, body });
    }
  } catch { /* 기록 실패는 게임 일이 아니다 */ }
}
