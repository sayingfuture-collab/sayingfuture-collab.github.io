// 편성 화면 — 로스터에서 출전 4인을 고르고 칩을 눌러 앞/뒷줄을 바꾼다.
// (영웅뽑기 screen-battle.js의 칩 탭 토글 패턴)
//
// 기본값은 fieldTeam(AI와 같은 자동 편성)을 미리 채워준다 — 누르기 귀찮으면 그대로 출전.
// 확정 시 front 선택을 roster 항목의 front 필드에 저장한다(다음 라운드 기본값이 된다).

import { levelOf, ECON } from '../game/economy.js';
import { fieldTeam } from '../game/rival-team.js';
import { statsOf, rowMult, ROLE_SKILL } from '../battle/stats.js';
import { playerOf } from '../game/state.js';
import { PERSONALITIES } from '../game/rivals.js';
import { artNode } from './art.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const PARTY_MAX = 4;

export function createFormationScreen(root) {
  /**
   * @param {object} game
   * @param {string|null} opponentId 이번 라운드 상대 (부전승이면 null)
   * @returns {Promise<Array<{character, level, front}>>} createRun 엔트리
   */
  async function run(game, opponentId) {
    const player = playerOf(game);
    const roster = player.roster;

    // 선택 상태: 로스터 **인덱스**로 든다 — 유산 매물 재유입으로 같은 id가 둘일 수 있다.
    /** @type {Array<{idx: number, front: boolean}>} */
    let sel = [];
    {
      // 기본값 = fieldTeam. 엔트리를 인덱스로 되찾는다(merc 객체는 POOL 공유라 identity 매칭).
      const used = new Set();
      for (const e of fieldTeam(roster, game.round)) {
        const i = roster.findIndex((r, idx) => !used.has(idx) && r.merc === e.character);
        if (i >= 0) { used.add(i); sel.push({ idx: i, front: !!e.front }); }
      }
    }

    root.replaceChildren();
    root.scrollTop = 0;

    const foe = opponentId
      ? game.participants.find((p) => p.id === opponentId)
      : null;
    const foeName = foe ? `${PERSONALITIES[foe.personality].emoji} ${PERSONALITIES[foe.personality].name}` : null;

    const title = el('div', 'title', `제${game.round}라운드 — 편성`);
    title.append(el('small', null, foeName
      ? `이번 상대: ${foeName} · 인물을 누르면 줄이 바뀝니다`
      : '이번 라운드는 부전승 — 편성만 정리해 둡니다'));

    const rowBack = el('div', 'form__row');
    rowBack.dataset.row = 'back';
    const rowFront = el('div', 'form__row');
    rowFront.dataset.row = 'front';
    const backSlots = el('div', 'form__slots');
    const frontSlots = el('div', 'form__slots');

    const rowHead = (t, note) => {
      const head = el('div', 'form__head');
      head.append(el('b', null, t), el('span', null, note));
      return head;
    };
    const pct = (v) => `${Math.round(Math.abs(1 - v) * 100)}%`;
    rowBack.append(
      rowHead('뒷줄', '앞줄이 두꺼울수록 덜 맞음 · 적 포격은 뒷줄부터 노림'),
      backSlots,
    );
    rowFront.append(
      rowHead('앞줄', `받는 피해 −${pct(rowMult(true).taken)} · 공격력 −${pct(rowMult(true).atk)} · 먼저 맞음`),
      frontSlots,
    );

    const warn = el('div', 'form__warn');
    const synLine = el('div', 'form__syn');

    // 출전 중 짝(같은 역할 2명 이상)이 된 역할들 — 그 역할 전원 전투 레벨 +1 (setupFight가 적용)
    const selRoles = () => {
      const count = {};
      for (const m of sel) {
        const role = roster[m.idx].merc.role;
        count[role] = (count[role] ?? 0) + 1;
      }
      return new Set(Object.keys(count).filter((k) => count[k] >= 2));
    };
    const bench = el('div', 'form__bench');
    const benchHead = el('div', 'form__benchHead');
    const benchGrid = el('div', 'form__benchGrid');
    bench.append(benchHead, benchGrid);

    // 역할 설명 — 접어두되 한 번에 펼쳐진다
    const roles = el('details', 'form__roles');
    const rolesHead = document.createElement('summary');
    rolesHead.textContent = '역할이 하는 일';
    roles.append(rolesHead);
    for (const [role, skill] of Object.entries(ROLE_SKILL)) {
      const line = el('div', 'form__role');
      line.append(el('b', null, role), el('span', null, `${skill.name} — ${skill.text}`));
      roles.append(line);
    }

    const go = el('button', 'btn', foeName ? '⚔ 편성 완료 — 전투 개시' : '편성 확정');
    go.type = 'button';

    root.append(title, rowBack, rowFront, warn, synLine, bench, roles, go);

    function chip(member) {
      const r = roster[member.idx];
      const syn = selRoles().has(r.merc.role);
      // 시너지가 켜지면 화면 숫자도 전투 레벨(+1)로 보여준다 — setupFight가 실제로 쓰는 값
      const level = levelOf(r.acquiredRound, game.round, r.merc.tier)
        + (syn ? ECON.SYNERGY_LEVEL_BONUS : 0);
      const s = statsOf(r.merc, level);
      const m = rowMult(member.front);

      const node = el('div', 'form__chip');
      node.dataset.tier = r.merc.tier;
      if (syn) node.dataset.syn = 'true';
      node.append(
        artNode(r.merc, 'form__chipArt'),
        el('div', 'form__chipName', r.merc.name),
        el('div', 'form__chipStat', `${r.merc.role} · ${level}렙${syn ? '⚡' : ''}`),
        // 줄을 옮기면 실제로 달라지는 숫자가 보여야 토글이 결정이 된다
        el('div', 'form__chipNum', `체력 ${s.hp} · 공격 ${Math.round(s.atk * m.atk)}`),
      );

      const off = el('button', 'form__off', '✕');
      off.type = 'button';
      off.onclick = (ev) => {
        ev.stopPropagation();
        sel = sel.filter((p) => p.idx !== member.idx);
        render();
      };
      node.append(off);

      node.onclick = () => {
        const target = sel.find((p) => p.idx === member.idx);
        if (target) target.front = !target.front;
        render();
      };
      return node;
    }

    function benchCell(idx) {
      const r = roster[idx];
      const level = levelOf(r.acquiredRound, game.round, r.merc.tier);
      const node = el('button', 'form__benchCell');
      node.type = 'button';
      node.dataset.tier = r.merc.tier;
      node.append(
        artNode(r.merc, 'form__chipArt'),
        el('div', 'form__chipName', r.merc.name),
        el('div', 'form__chipStat', `${r.merc.role} · ${level}렙`),
      );
      node.disabled = sel.length >= PARTY_MAX;
      node.onclick = () => {
        if (sel.length >= PARTY_MAX) return;
        // 처음 들어가는 줄은 역할 기본값 — statsOf의 front 제안을 쓴다
        sel.push({ idx, front: statsOf(r.merc, level).front });
        render();
      };
      return node;
    }

    function render() {
      frontSlots.replaceChildren();
      backSlots.replaceChildren();
      for (const m of sel.filter((p) => p.front)) frontSlots.append(chip(m));
      for (const m of sel.filter((p) => !p.front)) backSlots.append(chip(m));
      if (!frontSlots.children.length) frontSlots.append(el('div', 'form__empty', '앞줄 없음'));
      if (!backSlots.children.length) backSlots.append(el('div', 'form__empty', '뒷줄 없음'));

      const naked = sel.length > 0 && !sel.some((p) => p.front);
      warn.textContent = naked
        ? '⚠ 앞줄이 비었습니다 — 적 포격이 뒷줄을 그대로 때립니다'
        : '';

      const on = selRoles();
      synLine.textContent = on.size
        ? `⚡ 짝 시너지: ${[...on].join(' · ')} — 같은 역할 2명 이상, 전투 레벨 +1`
        : '';

      const inSel = new Set(sel.map((p) => p.idx));
      const rest = roster.map((_, i) => i).filter((i) => !inSel.has(i));
      benchHead.textContent = `대기 로스터 (출전 ${sel.length}/${Math.min(PARTY_MAX, roster.length)}) · 급료 총 ${payrollOf(roster)}골드/라운드`;
      benchGrid.replaceChildren();
      for (const i of rest) benchGrid.append(benchCell(i));
      bench.hidden = rest.length === 0;

      go.disabled = sel.length === 0;
    }

    const payrollOf = (list) =>
      list.reduce((sum, r) => sum + (ECON.SALARY[r.merc.tier] ?? 0), 0);

    render();

    await new Promise((resolve) => { go.onclick = resolve; });

    // front 선택을 로스터에 저장 — 다음 라운드의 fieldTeam 기본값이 된다
    for (const m of sel) roster[m.idx].front = m.front;

    return sel.map((m) => {
      const r = roster[m.idx];
      return {
        character: r.merc,
        level: levelOf(r.acquiredRound, game.round, r.merc.tier),
        front: m.front,
      };
    });
  }

  return { run };
}
