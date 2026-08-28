// 홈 — 점수가 아니라 '완성도'가 주인공 (Completion 동기, 10대 여성 최빈 게임 동기).
// 캐릭터가 저장을 기억해서 말을 건다 — 리더보드 없는 게임의 관계성은 캐릭터가 채운다.
import { getSave, getEquipped, dueLemmas, basicsDone } from '../store.js';
import { hunterSVG, resolveEquip } from '../hunter.js';
import { VERB_BY_LEMMA } from '../data.js';

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

export function createHomeView({ onPlay, onDex, onDress, onBadges }) {
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

    // 오늘의 사냥터 — 복습 기한이 찬 동사가 있을 때만 뜬다 (간격 반복의 얼굴)
    const due = dueLemmas();
    if (due.length > 0) {
      const emojis = due.slice(0, 4).map((l) => VERB_BY_LEMMA.get(l)?.emoji ?? '').join('');
      const reviewBtn = el('button', 'mode-btn review');
      reviewBtn.innerHTML = `<b>🌅 오늘의 사냥터</b><span>${emojis} 잡았던 동사 ${due.length}마리가 다시 나타났다!</span>`;
      reviewBtn.onclick = () => onPlay('review');
      menu.append(reviewBtn);
    }

    // 기초 캠프 — 성분 자체를 모르는 학생의 입구. 수료 전이면 여기가 주인공.
    const done = basicsDone();
    const basicBtn = el('button', 'mode-btn basic' + (done ? '' : ' primary'));
    basicBtn.innerHTML = done
      ? '<b>🚂 기초 캠프 ✅</b><span>0단계 — 다시 보기</span>'
      : '<b>🚂 기초 캠프</b><span>0단계 — 주어·동사·목적어가 뭔지부터</span>';
    basicBtn.onclick = () => onPlay('basic');
    menu.append(basicBtn);

    const subjBtn = el('button', 'mode-btn' + (done ? ' primary' : ''));
    subjBtn.innerHTML = '<b>🕵️ 주어 사냥터</b><span>1단계 — "누가"를 덩어리째 잡기</span>';
    subjBtn.onclick = () => onPlay('subj');
    const verbBtn = el('button', 'mode-btn');
    verbBtn.innerHTML = '<b>🎯 동사 사냥터</b><span>2단계 — 숨은 동사를 잡아 도감에!</span>';
    verbBtn.onclick = () => onPlay('verb');

    // 진급 사냥터 — 앞 단계 8/10 이면 열린다. 조건이 보이는 자물쇠 (진행형이라 안전)
    const fillOpen = (save.modeBest?.verb ?? 0) >= 8;
    const fillBtn = el('button', 'mode-btn' + (fillOpen ? '' : ' locked'));
    fillBtn.innerHTML = fillOpen
      ? '<b>👻 유령 소환</b><span>3단계 — 빈칸에 알맞은 be동사 고르기</span>'
      : '<b>🔒 유령 소환</b><span>동사 사냥터에서 한 번에 8마리 잡으면 열림</span>';
    if (fillOpen) fillBtn.onclick = () => onPlay('fill');
    const orderOpen = (save.modeBest?.fill ?? 0) >= 8;
    const orderBtn = el('button', 'mode-btn' + (orderOpen ? '' : ' locked'));
    orderBtn.innerHTML = orderOpen
      ? '<b>🧩 문장 조립</b><span>4단계 — 조각을 순서대로 눌러 문장 만들기</span>'
      : '<b>🔒 문장 조립</b><span>유령 소환에서 한 번에 8칸 맞히면 열림</span>';
    if (orderOpen) orderBtn.onclick = () => onPlay('order');

    // 자매 게임으로 가는 다리 — 매일 한 판짜리 «오늘의 영어»
    const dailyBtn = el('a', 'mode-btn daily');
    dailyBtn.href = '../daily-english/index.html';
    dailyBtn.innerHTML = '<b>📮 오늘의 영어</b><span>매일 한 판 — 낱말·듣기·문장, 5분이면 끝!</span>';

    const sub = el('div', 'home__sub');
    const dexBtn = el('button', 'mode-btn');
    dexBtn.innerHTML = '<b>📖 도감</b>';
    dexBtn.onclick = onDex;
    const dressBtn = el('button', 'mode-btn');
    dressBtn.innerHTML = '<b>🎀 꾸미기</b>';
    dressBtn.onclick = onDress;
    const badgeBtn = el('button', 'mode-btn');
    badgeBtn.innerHTML = '<b>🏅 칭호</b>';
    badgeBtn.onclick = onBadges;
    sub.append(dexBtn, dressBtn, badgeBtn);
    menu.append(subjBtn, verbBtn, fillBtn, orderBtn, dailyBtn, sub);

    root.append(prog, bar, hunter, talk, world, menu);
  }

  render();
  return { el: root, refresh: render };
}
