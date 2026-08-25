// 라운드 결과 화면 — 내 전투 결과, AI끼리 결과, 수입 내역, 탈락 소식.
//
// 골드·생명은 여기서 계산하지 않는다. app.js가 settleRound 전후 스냅샷으로
// 실제 적용값을 넘기고, 이 화면은 그대로 보여주기만 한다.

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function createResultScreen(root) {
  /**
   * @param {{
   *   round: number,
   *   player: {type: 'win'|'lose'|'bye'|'out', foeName?: string, livesDelta: number,
   *            lives: number, draw?: boolean, eliminatedNow?: boolean},
   *   aiLines: Array<string>,
   *   income: {base, interest, win, streakBonus, pay, net}|null,
   *   eliminated: Array<string>,
   *   nextLabel: string,
   * }} data
   */
  async function run(data) {
    root.replaceChildren();
    root.scrollTop = 0;

    const title = el('div', 'title', `제${data.round}라운드 — 결과`);
    root.append(title);

    // ── 내 전투 ──
    const mine = el('div', 'result__mine');
    const p = data.player;
    if (p.type === 'bye') {
      mine.dataset.kind = 'bye';
      mine.append(el('b', null, '부전승'), el('span', null, '이번 라운드는 상대가 없습니다.'));
    } else if (p.type === 'out') {
      mine.dataset.kind = 'lose';
      mine.append(el('b', null, '관전'), el('span', null, '탈락한 뒤의 라운드입니다.'));
    } else {
      mine.dataset.kind = p.type;
      mine.append(el('b', null, p.type === 'win' ? '⚔ 승리!' : '⚔ 패배…'));
      const detail = [];
      if (p.draw) detail.push('무승부 판정 — 잔여 체력 우세로 갈림');
      if (p.foeName) detail.push(`상대: ${p.foeName}`);
      if (p.livesDelta < 0) detail.push(`생명 ${p.livesDelta} → 남은 생명 ${p.lives}`);
      mine.append(el('span', null, detail.join(' · ')));
      if (p.eliminatedNow) {
        mine.append(el('div', 'result__doom', '💀 생명이 다했습니다 — 용병단 해산, 로스터는 유산 매물로 경매에 나옵니다'));
      }
    }
    root.append(mine);

    // ── AI끼리 ──
    if (data.aiLines.length) {
      const ai = el('div', 'result__ai');
      ai.append(el('div', 'result__aiHead', '다른 판'));
      for (const line of data.aiLines) ai.append(el('div', 'result__aiLine', line));
      root.append(ai);
    }

    // ── 수입 내역 ──
    if (data.income) {
      const inc = data.income;
      const box = el('div', 'result__income');
      box.append(el('div', 'result__incomeHead', '이번 라운드 수입'));
      const rows = [
        ['기본 수입', inc.base],
        ['이자', inc.interest],
        ['승리 보너스', inc.win],
        ['연승 보너스', inc.streakBonus],
        ['급료', -inc.pay],
      ];
      for (const [label, v] of rows) {
        if (v === 0 && label !== '기본 수입') continue;
        const row = el('div', 'result__row');
        row.append(el('span', null, label), el('b', null, `${v > 0 ? '+' : ''}${v}`));
        row.dataset.minus = String(v < 0);
        box.append(row);
      }
      const net = el('div', 'result__row result__row--net');
      net.append(el('span', null, '합계'), el('b', null, `${inc.net >= 0 ? '+' : ''}${inc.net} 골드`));
      box.append(net);
      root.append(box);
    }

    // ── 탈락 소식 ──
    for (const name of data.eliminated) {
      root.append(el('div', 'result__elim', `☠ ${name} 탈락 — 로스터가 유산 매물로 경매에 돌아옵니다`));
    }

    const next = el('button', 'btn result__next', data.nextLabel);
    next.type = 'button';
    root.append(next);
    await new Promise((resolve) => { next.onclick = resolve; });
  }

  return { run };
}
