// 손맛(juice) 도구들 — 게임 규칙을 하나도 안 바꾸고 재미만 올리는 층.
// 인지부하 가드: 이 파일의 어떤 효과도 "문제를 읽는 동안"에는 불리면 안 된다.
// 전부 판정 직후에만 쓴다 (seductive details 메타분석 — 학습 중 장식은 해롭다).

/**
 * 히트스톱: 정답 순간 모든 움직임을 잠깐 멈췄다가 터뜨린다.
 * 액션게임 타격감의 핵심 — 문법 게임에 이걸 넣는 게임은 없다.
 * @param {number} ms 60~80 권장
 */
export function hitStop(root, ms = 70) {
  root.classList.add('freeze');
  return new Promise((r) => setTimeout(() => { root.classList.remove('freeze'); r(); }, ms));
}

/** 화면 흔들림. 정답 전용 — 오답에 흔들면 벌로 느껴진다 */
export function shake(el, px = 3) {
  el.style.setProperty('--shake-px', px + 'px');
  el.classList.remove('shaking'); void el.offsetWidth;
  el.classList.add('shaking');
}

/** 단어 파괴 파티클 — 잡힌 동사가 파편으로 흩어진다 (20~30개, 0.5~1s) */
export function burst(x, y, opts = {}) {
  const n = opts.count ?? 24;
  const glyphs = opts.glyphs ?? ['✦', '✧', '●', '▲', '■'];
  const colors = opts.colors ?? ['#e8630a', '#f4b942', '#4caf50', '#42a5f5'];
  for (let i = 0; i < n; i++) {
    const p = document.createElement('div');
    p.className = 'jc-particle';
    p.textContent = glyphs[i % glyphs.length];
    p.style.color = colors[i % colors.length];
    p.style.left = x + 'px';
    p.style.top = y + 'px';
    const ang = Math.random() * Math.PI * 2;
    const dist = 40 + Math.random() * 70;
    p.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
    p.style.setProperty('--dy', Math.sin(ang) * dist - 30 + 'px');
    p.style.animationDuration = (0.5 + Math.random() * 0.4) + 's';
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 1000);
  }
}

/** 떠오르는 텍스트 ("+포획!", "COMBO x5") */
export function floatText(x, y, text, cls = '') {
  const f = document.createElement('div');
  f.className = 'jc-float ' + cls;
  f.textContent = text;
  f.style.left = x + 'px';
  f.style.top = y + 'px';
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 1000);
}

/** 완주 콘페티 */
export function confetti() {
  const EMO = ['🎉', '✨', '⭐', '💛', '💙'];
  for (let i = 0; i < 36; i++) {
    const c = document.createElement('div');
    c.className = 'jc-confetti';
    c.textContent = EMO[Math.floor(Math.random() * EMO.length)];
    c.style.left = Math.random() * 100 + 'vw';
    c.style.animationDuration = (1.4 + Math.random() * 1.4) + 's';
    c.style.animationDelay = (Math.random() * 0.5) + 's';
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 3500);
  }
}

/** 폰 진동 — 지원 안 하면 조용히 무시 */
export function buzz(pattern = 15) {
  try { navigator.vibrate && navigator.vibrate(pattern); } catch { /* */ }
}
