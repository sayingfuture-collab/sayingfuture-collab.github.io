// 도전 화면. 진형을 짜고 층을 오른다.
// 인물 고르기는 도감을 재사용하지 않는다 — 도감은 누르면 상세가 열리게 박혀 있어서,
// 고르기용으로 쓰려면 검증 끝난 파일에 모드를 붙여야 한다. 여기 따로 두는 편이 단순하다.

import { CHARACTERS } from '../data/characters.js';
import {
  getParty, setParty, getBestFloor, setBestFloor,
  countOf, levelOf, isMaxLevel, addGold, recordRun, getTitles,
  finishTower, goldTowerReadyToday,
} from '../storage.js';
import { createRunSummary } from '../titles/summary.js';
import { applyTitleBoost, goldBonus } from '../titles/effects.js';
import { takeTitleNews } from '../titles/check.js';
import { titleName } from '../titles/catalog.js';
import { runReward } from '../economy.js';
import { statsOf, rowMult, ROLE_SKILL, LEVEL_CAP } from '../battle/stats.js';
import { skillInfo } from '../battle/skills.js';
import { createRun, startFloor } from '../battle/engine.js';
import { TOWER_FLOORS, makeTowerFloor, GOLD_TOWER } from '../towers/catalog.js';
import { climb } from '../battle/runner.js';
import { isRewardFloor, offerRewards, applyReward } from '../battle/rewards.js';
import { createRewardView } from './reward-view.js';
import { chipRow, filterRow, TIERS, ROLES } from './chips.js';
import { createFightView, SPEEDS } from './fight-view.js';
import { SORTS, DEFAULT_SORT, sortCharacters } from '../sort.js';
import { artNode } from './art.js';

const byId = new Map(CHARACTERS.map((c) => [c.id, c]));

const PARTY_MAX = 4;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function createBattleScreen() {
  const root = el('div', 'battle');

  const best = el('div', 'battle__best');
  // 지금 도전 중인 탑. null 이면 등반(끝없이 오르는 판)이다.
  /** @type {import('../towers/catalog.js').Tower|null} */
  let tower = null;
  const banner = el('div', 'battle__tower');
  const body = el('div', 'battle__body');
  const buttons = el('div', 'battle__buttons');
  root.append(best, banner, body, buttons);

  /** @type {Array<{id: string, front: boolean}>} */
  let party = [];

  // ── 편성 ──────────────────────────────────────────────
  const form = el('div', 'form');
  const rowBack = el('div', 'form__row');
  const rowFront = el('div', 'form__row');
  rowBack.dataset.row = 'back';
  rowFront.dataset.row = 'front';
  const backSlots = el('div', 'form__slots');
  const frontSlots = el('div', 'form__slots');

  const rowHead = (title, note) => {
    const head = el('div', 'form__head');
    head.append(el('b', null, title), el('span', null, note));
    return head;
  };
  const pct = (v) => `${Math.round(Math.abs(1 - v) * 100)}%`;
  rowBack.append(
    // ⚠️ **「안 맞음」이라고 쓰면 안 된다.** 앞줄 빈자리 하나당 15%씩 새서, 한 명만
    // 세우면 절반 가까이가 그대로 뒤로 온다. 제보로 들어온 오해가 정확히 이 문구였다.
    rowHead('뒷줄', '앞줄이 두꺼울수록 덜 맞음 · 적 포격은 뒷줄부터 노림'),
    backSlots
  );
  rowFront.append(
    rowHead('앞줄', `받는 피해 −${pct(rowMult(true).taken)} · 공격력 −${pct(rowMult(true).atk)} · 먼저 맞음`),
    frontSlots
  );

  const formHint = el('div', 'form__hint',
    `인물을 누르면 줄이 바뀝니다 · 레벨은 ${LEVEL_CAP}에서 멈춥니다`);

  // 앞줄이 비었을 때만 뜬다. **이걸 안 알려주면 고장으로 보인다** —
  // 전원 뒷줄은 적 포격에게 무방비라 크게 맞는데, 화면에는 그 이유가 안 나온다.
  const formWarn = el('div', 'form__warn');

  // 역할이 무엇을 하는지 모르면 진형을 짤 수가 없다. 접어두되 한 번에 펼쳐진다.
  const roles = el('details', 'form__roles');
  const rolesHead = document.createElement('summary');
  rolesHead.textContent = '역할이 하는 일';
  roles.append(rolesHead);
  for (const [role, skill] of Object.entries(ROLE_SKILL)) {
    const line = el('div', 'form__role');
    line.append(
      el('b', null, role),
      el('span', 'form__roleName', skill.name),
      el('span', 'form__roleText', skill.text)
    );
    roles.append(line);
  }

  form.append(rowBack, rowFront, formWarn, formHint, roles);

  const go = el('button', 'battle__go', '도전 시작');
  go.type = 'button';
  go.onclick = startRun;

  function chip(member) {
    const c = byId.get(member.id);
    const level = levelOf(member.id);
    const s = statsOf(c, level);
    const m = rowMult(member.front);

    const node = el('div', 'form__chip');
    node.dataset.tier = c.tier;
    node.append(
      artNode(c, 'form__chipArt'),
      el('div', 'form__chipName', c.name),
      el('div', 'form__chipStat', `${c.role} · ${level}렙${isMaxLevel(member.id) ? ' 최대' : ''}`),
      // 줄에 따라 실제로 달라지는 값을 보여준다. 옮기면 숫자가 바뀌는 게 보여야 한다.
      el('div', 'form__chipNum', `체력 ${s.hp} · 공격 ${Math.round(s.atk * m.atk)}`)
    );
    const info = skillInfo(c);
    if (info) node.append(el('div', 'form__chipSkill', info.name));

    const off = el('button', 'form__off', '✕');
    off.type = 'button';
    off.onclick = (ev) => {
      ev.stopPropagation();
      party = party.filter((p) => p.id !== member.id);
      commit();
    };
    node.append(off);

    node.onclick = () => {
      const target = party.find((p) => p.id === member.id);
      if (target) target.front = !target.front;
      commit();
    };
    return node;
  }

  function addButton(front) {
    const node = el('button', 'form__add', '＋');
    node.type = 'button';
    node.onclick = () => openPicker(front);
    node.disabled = party.length >= PARTY_MAX;
    return node;
  }

  function renderForm() {
    for (const [slots, front] of [[frontSlots, true], [backSlots, false]]) {
      slots.replaceChildren();
      for (const m of party.filter((p) => p.front === front)) slots.append(chip(m));
      slots.append(addButton(front));
    }
    go.disabled = party.length === 0;
    // 아무도 앞에 없으면 막아설 사람이 없다. 한 명이라도 세우면 사라진다.
    const naked = party.length > 0 && !party.some((p) => p.front);
    formWarn.textContent = naked ? '⚠ 앞줄이 비었습니다 — 적 포격이 뒷줄을 그대로 때립니다' : '';
  }

  function commit() {
    setParty(party);
    party = getParty();
    renderForm();
  }

  // ── 인물 고르기 ────────────────────────────────────────
  const picker = el('div', 'picker');
  picker.hidden = true;
  const pickerHead = el('div', 'picker__head');
  const pickerGrid = el('div', 'picker__grid');
  const pickerClose = el('button', 'battle__auto', '닫기');
  pickerClose.type = 'button';
  pickerClose.onclick = () => { picker.hidden = true; };

  // 필터와 정렬. **보유 126명이면 정렬만으로는 못 찾는다** — 폰에서 한 줄에 3명이라
  // 42줄을 훑어야 한다. 도감에 이미 있던 등급·역할 필터가 여기만 빠져 있었다.
  // 고른 기준은 다시 열어도 유지된다 — 매번 다시 누르게 하면 있으나 마나다.
  let sortMode = DEFAULT_SORT;
  let tierFilter = '';
  let roleFilter = '';
  let openFront = false;
  const reopen = () => openPicker(openFront);
  const pickerFilters = el('div', 'picker__filters');
  pickerFilters.append(
    filterRow('picker', '등급', TIERS, (v) => { tierFilter = v; reopen(); }),
    filterRow('picker', '역할', ROLES, (v) => { roleFilter = v; reopen(); }),
    chipRow('picker', '정렬', SORTS.map((s) => ({ value: s.id, name: s.name })),
      (v) => { sortMode = v; reopen(); })
  );

  // 필터를 좁히면 아무도 안 남을 수 있다. 빈 격자만 보여주면 고장으로 읽힌다.
  const pickerEmpty = el('div', 'picker__empty', '이 조건에 맞는 인물이 없습니다.');
  pickerEmpty.hidden = true;

  picker.append(pickerHead, pickerFilters, pickerGrid, pickerEmpty, pickerClose);
  root.append(picker);

  function openPicker(front) {
    openFront = front;
    const taken = new Set(party.map((p) => p.id));
    const mine = CHARACTERS.filter((c) => countOf(c.id) > 0 && !taken.has(c.id));
    const shown = sortCharacters(
      mine.filter((c) => (!tierFilter || c.tier === tierFilter)
        && (!roleFilter || c.role === roleFilter)),
      sortMode,
      levelOf
    );

    // 걸러낸 뒤의 수와 전체 보유 수를 같이 보여준다 — 필터가 켜진 걸 잊고
    // "왜 몇 명 없지"가 되는 자리다.
    const narrowed = shown.length !== mine.length;
    pickerHead.textContent = mine.length
      ? `${front ? '앞줄' : '뒷줄'}에 세울 인물 (${narrowed ? `${shown.length}명 / 보유 ` : '보유 '}${mine.length}명)`
      : '아직 뽑은 인물이 없습니다. 먼저 뽑기를 해주세요.';
    pickerEmpty.hidden = shown.length > 0 || mine.length === 0;

    pickerGrid.replaceChildren();
    for (const c of shown) {
      const cell = el('div', 'picker__cell');
      cell.dataset.tier = c.tier;
      cell.append(
        artNode(c, 'picker__art'),
        el('div', 'picker__name', c.name),
        el('div', 'picker__sub', `${c.role} · ${levelOf(c.id)}렙${isMaxLevel(c.id) ? ' 최대' : ''}`)
      );
      const info = skillInfo(c);
      if (info) cell.append(el('div', 'picker__skill', info.name));
      cell.onclick = () => {
        if (party.length >= PARTY_MAX) return;
        party.push({ id: c.id, front });
        commit();
        picker.hidden = true;
      };
      pickerGrid.append(cell);
    }
    picker.hidden = false;
  }

  // ── 전투 ──────────────────────────────────────────────
  const fight = createFightView();
  const reward = createRewardView();
  root.append(reward.el);

  let run = null;
  /** 이 판의 요약을 모으는 그릇. 판마다 새로 만든다 */
  let runLog = null;
  let playing = false;
  let stopped = false;
  /** 이 판에서 층을 세우는 방법. 판이 시작될 때 정해진다 */
  let makeFloor = startFloor;
  let speedIndex = 0;

  const speedBtn = el('button', 'battle__auto', '×1');
  speedBtn.type = 'button';
  speedBtn.onclick = () => {
    speedIndex = (speedIndex + 1) % SPEEDS.length;
    fight.setSpeed(SPEEDS[speedIndex]);
    speedBtn.textContent = `×${SPEEDS[speedIndex]}`;
  };

  const quitBtn = el('button', 'battle__go', '그만두기');
  quitBtn.type = 'button';
  quitBtn.onclick = () => { stopped = true; fight.abort(); showForm(); };

  function showForm() {
    stopped = true;
    playing = false;
    reward.close();
    fight.abort();
    run = null;
    body.replaceChildren(form);
    buttons.replaceChildren(go);
    refresh();
  }

  function showFight() {
    body.replaceChildren(fight.el);
    buttons.replaceChildren(quitBtn, speedBtn);
  }

  function startRun() {
    if (!party.length) return;
    const entries = party.map((p) => ({
      character: byId.get(p.id),
      level: levelOf(p.id),
      front: p.front,
    }));
    stopped = false;
    speedIndex = 0;
    speedBtn.textContent = '×1';
    fight.setSpeed(1);

    run = createRun(entries);
    // 칭호 효과는 **여기 한 번만** 얹는다. 엔진은 칭호를 모르고, 두 번 부르면 두 번 곱해진다.
    applyTitleBoost(run, getTitles());
    runLog = createRunSummary(entries);
    // 탑은 자기 적 표로 층을 세운다. 전투 규칙은 등반과 똑같다.
    makeFloor = tower ? makeTowerFloor(tower) : startFloor;
    makeFloor(run);
    showFight();
    fight.setup(run);
    fight.setLog('1층 시작');
    loop();
  }

  // 층을 오르는 순서는 battle/runner.js에 있다. 여기서는 화면 노릇만 넘겨준다.
  async function loop() {
    if (playing) return;
    playing = true;
    const reached = await climb(run, {
      // ⚠️ runTurn 직후가 run.turn·run.result 가 이 턴을 가리키는 유일한 시점이다.
      // climb 은 runTurn 을 부른 뒤 바로 play 를 부르므로 여기가 그 자리다.
      play: (events) => { runLog.turn(events, run); return fight.play(events); },
      sync: (r) => fight.sync(r),
      setup: (r) => { fight.setup(r); fight.setLog(`${r.floor}층 시작`); },
      betweenFloors: askReward,
    }, () => stopped, undefined, {
      makeFloor,
      // 탑은 끝이 있다. 등반은 전멸할 때까지다.
      maxFloors: tower ? TOWER_FLOORS : Infinity,
    });
    playing = false;
    // null이면 화면이 갈아엎힌 것 — 기록도 결과 화면도 내지 않는다
    if (reached !== null) endRun(reached);
  }

  // 층 사이. 보상 층이 아니면 그냥 지나간다.
  async function askReward(r) {
    const cleared = r.floor - 1;
    if (stopped || !isRewardFloor(cleared)) return !stopped;
    const offer = offerRewards(r);
    if (!offer.length) return true;
    const picked = await reward.ask(cleared, offer, r.rewards);
    if (stopped) return false;
    applyReward(r, picked);
    return true;
  }

  function endRun(reached) {
    // **누적을 먼저 더한다.** 여기서 딴 칭호가 이번 판 보상에도 걸리게 하려는 것도 있지만,
    // 무엇보다 최고 기록보다 먼저 해야 「제약 걸고 오르기」가 이 판을 놓치지 않는다.
    recordRun(runLog.result(reached));

    const inTower = tower;          // 결과 화면을 그리는 동안 바뀌지 않게 잡아둔다
    const done = inTower && reached >= TOWER_FLOORS;
    const prevBest = getBestFloor();
    // **setBestFloor보다 먼저 계산한다.** 뒤에 하면 기록이 이미 갱신되어
    // 갱신분이 늘 0이 되고, 아무리 기록을 깨도 골드가 안 붙는다.
    const base = runReward(reached, inTower ? Infinity : prevBest);
    const bonus = goldBonus(base.total, getTitles());
    addGold(base.total + bonus);
    // 탑을 완주하면 그 몫이 따로 나온다. 골드를 주는 곳은 저장 한 군데다.
    const prize = done ? finishTower(inTower.id) : null;
    // ⚠️ **탑은 최고 기록을 안 건드린다.** 15층이 끝이라 등반 기록과 뜻이 다르다 —
    // 처음 하는 사람의 「최고 15층」이 탑에서 나오면 등반 갱신 보상이 통째로 막힌다.
    const isBest = inTower ? false : setBestFloor(reached);
    // 저장이 세 번 바뀌었고(누적·골드·기록) 그때마다 칭호 검사가 돌았다.
    // 누가 땄든 대기줄에 모여 있으므로 여기서 한꺼번에 가져간다.
    const news = takeTitleNews();
    const members = party.map((p) => ({ c: byId.get(p.id), front: p.front }));

    const panel = el('div', 'result-panel');
    panel.append(el('div', 'result-panel__title', done ? '완주' : '전멸'));

    const floor = el('div', 'result-panel__floor');
    floor.append(el('b', null, String(reached)), inTower ? ` / ${TOWER_FLOORS}층` : '층');
    panel.append(floor);

    if (inTower) {
      panel.append(el('div', done ? 'result-panel__best' : 'result-panel__prev',
        done ? `${inTower.mark} ${inTower.name} 완주!` : `${inTower.mark} ${inTower.name}`));
      if (prize?.first) panel.append(el('div', 'result-panel__prev', '첫 완주 보상'));
      // 오늘 몫을 이미 썼으면 반드시 밝힌다. 안 밝히면 「왜 이것밖에 안 주지」가 된다.
      if (prize?.spent) panel.append(el('div', 'result-panel__prev', '오늘 몫은 이미 받았습니다'));
    } else if (isBest) {
      panel.append(el('div', 'result-panel__best', '최고 기록!'));
      if (prevBest > 0) panel.append(el('div', 'result-panel__prev', `이전 기록 ${prevBest}층`));
    } else {
      panel.append(el('div', 'result-panel__prev', `최고 기록 ${prevBest}층`));
    }

    // 어떤 진형으로 갔는지 같이 보여준다. 다음 판에 뭘 바꿀지가 여기서 정해진다.
    const rows = el('div', 'result-panel__rows');
    for (const [label, front] of [['앞줄', true], ['뒷줄', false]]) {
      const line = el('div', 'result-panel__row');
      line.append(el('span', 'result-panel__rowLabel', label));
      const list = el('div', 'result-panel__party');
      for (const m of members.filter((x) => x.front === front)) {
        const cell = el('div', 'result-panel__member');
        cell.dataset.tier = m.c.tier;
        cell.append(artNode(m.c, 'result-panel__memberArt'), el('div', null, m.c.name));
        list.append(cell);
      }
      if (!list.children.length) list.append(el('div', 'result-panel__none', '없음'));
      line.append(list);
      rows.append(line);
    }
    panel.append(rows);

    // 이번 판에 얼마를 벌었는지. 기록 갱신분을 따로 보여줘야
    // "기록을 깨야 번다"는 규칙이 한 판 만에 전달된다.
    const purse = el('div', 'result-panel__gold');
    const got = base.total + bonus + (prize?.gold ?? 0);
    purse.append(el('b', null, `+${got.toLocaleString()} 골드`));
    if (prize?.gold) purse.append(el('span', null, `완주 +${prize.gold.toLocaleString()}`));
    if (base.record > 0) {
      purse.append(el('span', null, `기록 갱신 +${base.record.toLocaleString()}`));
    }
    // 칭호로 더 받은 몫은 반드시 밝힌다. 안 밝히면 "왜 늘었지"를 매번 설명해야 한다.
    if (bonus > 0) purse.append(el('span', null, `칭호 +${bonus.toLocaleString()}`));
    panel.append(purse);

    // 새로 딴 칭호. **모달로 막지 않는다** — 판 끝나고 또 누르게 만들 이유가 없다.
    if (news.length) {
      const box = el('div', 'result-panel__earned');
      for (const id of news) box.append(el('div', 'result-panel__earnedLine', `🏅 새 칭호 · ${titleName(id)}`));
      panel.append(box);
    }

    // 이번 판에 무엇을 골랐는지. 다음 판에 뭘 노릴지가 여기서 정해진다.
    if (run?.rewards?.length) {
      const got = el('div', 'result-panel__rewards');
      got.append(el('span', 'result-panel__rowLabel', '보상'));
      const box = el('div', 'result-panel__rewardList');
      for (const r of run.rewards) box.append(el('span', 'reward__chip', r.name));
      got.append(box);
      panel.append(got);
    }

    body.replaceChildren(panel);
    refreshBest();

    const again = el('button', 'battle__go', '다시 도전');
    again.type = 'button';
    again.onclick = startRun;
    const edit = el('button', 'battle__auto', '편성 바꾸기');
    edit.type = 'button';
    edit.onclick = showForm;
    buttons.replaceChildren(again, edit);
  }

  function refreshBest() {
    best.replaceChildren('최고 ', el('b', null, String(getBestFloor())), '층');
  }

  /**
   * 어느 탑에 도전할지 정한다. null 이면 등반(끝없이 오르는 판)으로 돌아간다.
   *
   * ⚠️ **전투 중에는 안 바꾼다.** 판이 도는 중에 바꾸면 층 세우는 방법과 끝나는 조건이
   * 판 중간에 갈리고, 결과 화면이 엉뚱한 탑 이름을 단다.
   */
  function setTower(next) {
    if (run) return false;
    tower = next ?? null;
    showForm();
    return true;
  }

  function renderBanner() {
    banner.replaceChildren();
    if (!tower) return;
    banner.style.setProperty('--tower', tower.color);
    const name = el('div', 'battle__towerName', `${tower.mark} ${tower.name} · ${TOWER_FLOORS}층`);
    const hint = el('div', 'battle__towerHint', tower.hint);
    const off = el('button', 'battle__towerOff', '등반으로');
    off.type = 'button';
    off.onclick = () => setTower(null);
    banner.append(name, hint, off);
    // 황금 탑은 하루 한 번만 값을 한다. **들어가기 전에 알려준다** —
    // 다 깨고 나서 알면 그 15층이 통째로 헛수고가 된다.
    if (tower.id === GOLD_TOWER.id && !goldTowerReadyToday()) {
      banner.append(el('div', 'battle__towerWarn', '오늘 몫은 이미 받았습니다 — 연습은 됩니다'));
    }
  }

  function refresh() {
    refreshBest();
    renderBanner();
    if (run) return; // 전투 중에는 편성을 다시 그리지 않는다
    party = getParty();
    // 뽑기로 새로 얻은 인물이 있어도 편성은 그대로 둔다. 줄 정보는 저장이 들고 있다.
    renderForm();
  }

  showForm();
  return { el: root, refresh, setTower };
}
