// 홈 — 점수가 아니라 '완성도'가 주인공 (Completion 동기, 10대 여성 최빈 게임 동기).
// 캐릭터가 저장을 기억해서 말을 건다 — 리더보드 없는 게임의 관계성은 캐릭터가 채운다.
import { getSave, getEquipped } from '../store.js';
import { hunterSVG, resolveEquip } from '../hunter.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

// 저장 상태에 따라 달라지는 인사 — 성장 마인드셋 문구 (능력 칭찬 금지, 과정·사실 언급)
function talkLine(save) {
  if (save.rounds === 0) return '문장 속에 동사들이 숨어 있어. 같이 잡으러 갈래?';
  if (save.owned >= save.total) return '도감을 다 채웠네. 이 사냥터는 이제 네 거야.';
  if (save.owned >= 12) return `벌써 ${save.owned}마리째야. 절반을 넘었어 — 계속 가보자.`;
  if (save.rounds >= 3) return `또 왔네! 이렇게 다시 오는 게 제일 어려운 건데.`;
  return `지난번에 ${save.owned}마리 잡았지. 오늘은 어디로 갈까?`;
}

export function createHomeView({ onPlay, onDex, onDress }) {
  const root = el('div', 'home');

  function render() {
    const save = getSave();
    const pct = Math.round((save.owned / save.total) * 100);
    root.innerHTML = '';

    const prog = el('div', 'home__progress');
    prog.innerHTML = `도감 <b>${save.owned} / ${save.total}</b> · 완성도 <b>${pct}%</b>`;
    const bar = el('div', 'home__bar');
    const fill = document.createElement('i');
    fill.style.width = pct + '%';
    bar.append(fill);

    const hunter = el('div', 'home__hunter');
    hunter.innerHTML = hunterSVG(resolveEquip(getEquipped(), save.owned));

    const talk = el('div', 'home__talk', talkLine(save));
    const world = el('div', 'home__world', '— 문장 속에 동사들이 숨어 산다 —');

    const menu = el('div', 'home__menu');
    const subjBtn = el('button', 'mode-btn primary');
    subjBtn.innerHTML = '<b>🕵️ 주어 사냥터</b><span>1단계 — "누가"를 덩어리째 잡기</span>';
    subjBtn.onclick = () => onPlay('subj');
    const verbBtn = el('button', 'mode-btn');
    verbBtn.innerHTML = '<b>🎯 동사 사냥터</b><span>2단계 — 숨은 동사를 잡아 도감에!</span>';
    verbBtn.onclick = () => onPlay('verb');
    const sub = el('div', 'home__sub');
    const dexBtn = el('button', 'mode-btn');
    dexBtn.innerHTML = '<b>📖 도감</b>';
    dexBtn.onclick = onDex;
    const dressBtn = el('button', 'mode-btn');
    dressBtn.innerHTML = '<b>🎀 꾸미기</b>';
    dressBtn.onclick = onDress;
    sub.append(dexBtn, dressBtn);
    menu.append(subjBtn, verbBtn, sub);

    root.append(prog, bar, hunter, talk, world, menu);
  }

  render();
  return { el: root, refresh: render };
}
