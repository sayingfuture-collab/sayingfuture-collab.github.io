// 사운드 — 파일 없이 WebAudio 합성.
// 콤보 반음계: 정답음의 주파수를 반음(2^(1/12))씩 올린다. 8콤보면 한 옥타브 —
// 귀가 "쌓이고 있다"를 즉시 안다 (juice 리서치의 최저비용·최고효과 기법).
let ac = null;

function ctx() {
  ac = ac || new (window.AudioContext || window.webkitAudioContext)();
  return ac;
}

const SEMITONE = Math.pow(2, 1 / 12);

function tone(freq, dur, type = 'sine', vol = 0.12, when = 0) {
  try {
    const a = ctx();
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, a.currentTime + when);
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + when + dur);
    o.connect(g); g.connect(a.destination);
    o.start(a.currentTime + when);
    o.stop(a.currentTime + when + dur);
  } catch { /* 소리 실패는 게임을 막지 않는다 */ }
}

/** 정답. combo가 오를수록 반음씩 올라간다 */
export function popSound(combo = 1) {
  tone(392 * Math.pow(SEMITONE, Math.min(combo, 12)), 0.11);
}

/** 오답 — 벌 소리가 아니라 "휙" 도망가는 소리. 낮은 경고음 금지 (실패 톤 전환 원칙) */
export function dodgeSound() {
  try {
    const a = ctx();
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(700, a.currentTime);
    o.frequency.exponentialRampToValueAtTime(250, a.currentTime + 0.16); // 미끄러지듯 하강 = 도망
    g.gain.setValueAtTime(0.06, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.16);
    o.connect(g); g.connect(a.destination);
    o.start(); o.stop(a.currentTime + 0.18);
  } catch { /* */ }
}

/** 포획(도감 등록) — 짧은 두 음 상승 */
export function catchSound() {
  tone(660, 0.1); tone(990, 0.14, 'sine', 0.12, 0.09);
}

/** 완주 팡파레 */
export function fanfare() {
  [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'sine', 0.12, i * 0.11));
}
