// 전장. 엔진이 뱉은 이벤트 목록을 한 대씩 재생한다.
//
// 엔진은 한 턴을 통째로 계산해놓고 끝난다. 그래서 화면은 항상 엔진보다 뒤처져서 따라간다 —
// 이벤트에 실려온 체력·방어막을 그대로 쓰기 때문에 다시 계산할 일이 없다.
// 나중에 그래픽을 얹으면 고칠 곳은 unit-view.js이고 이 파일은 그대로다.

import { createUnitView } from './unit-view.js';
import { describeEvent } from './battle-log.js';
import { createStage, spotOf, skyOf } from './stage.js';
import { sideTotals, RAGE_AFTER } from '../battle/engine.js';
import { grammarOf, gradeOf, planAttack } from './choreo.js';

// 이벤트 하나가 차지하는 시간(ms). 배속은 여기에 나눠서 걸린다.
// 4대4면 한 턴에 최대 8번 행동이라, 여기를 100ms 올리면 한 턴이 0.8초 길어진다.
const BEAT = {
  attack: 340,
  heal: 320,
  shield: 280,
  buff: 260,
  revive: 620,  // 판을 뒤집는 순간이라 좀 길게 둔다
  rage: 650,
  die: 0,       // 공격에 딸린 결과라 따로 시간을 안 준다

  // ⚠️ **여기 없는 종류는 시간을 아예 안 잡는다.**
  // `beat()` 가 `undefined / speed` = NaN 을 돌려주고 `wait > 0` 이 거짓이 되기 때문이다.
  // 아래 넷이 실제로 빠져 있었다 — 그래서 세종의 훈민정음이 터져도 로그 한 줄이
  // 깜빡 지나가고 끝났다. 이 게임에서 「뽑은 보람」이 나와야 할 자리가 통째로 비었던 것.
  // tests/beat-coverage.test.js 가 battle-log.js 와 대조해 다시 빠지는 걸 막는다.
  skill: 700,   // 기술 이름을 읽을 시간
  aoeHit: 620,
  aoeHeal: 560,
  weaken: 520,
};

/** 범위기가 여럿을 때릴 때 한 명씩 어긋내는 간격(ms). 동시에 맞으면 한 대로 보인다 */
const STAGGER = 40;

// 때린 뒤 맞는 쪽이 반응하기까지. 달려드는 동작이 닿는 순간에 맞춰야 한 대로 보인다.
const IMPACT = 130;

/**
 * 고를 수 있는 배속.
 *
 * ×8을 더한 이유: 한 판이 ×1로 **16분 36초**나 된다(116층 기준, 실측).
 * 그런데 그 시간의 **84%가 이미 여러 번 깬 층을 다시 지나가는 것**이다 —
 * 새로운 건 마지막 10층(16%)뿐이라 앉아서 볼 이유가 없다.
 * ×8이면 2분 4초가 된다.
 *
 * ⚠️ **여기를 늘리면 fight-view.css 의 시간도 전부 `/ var(--speed)` 여야 한다.**
 * 유닛 그림과 체력 막대가 고정값이라 ×8에서 몇 대씩 밀렸다(2026-08-21에 고침).
 * tests/screen-wiring.test.js 가 고정 시간이 남아 있는지 검사한다.
 *
 * ×16은 안 넣는다 — 한 대가 21ms라 화면 한 장(16.7ms)보다 짧아서 연출이 아니라 깜빡임이 된다.
 */
export const SPEEDS = [1, 2, 4, 8];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 화면이 다시 보일 때까지 기다린다.
 *
 * 브라우저는 숨은 탭의 setTimeout을 초당 1회로 묶어버린다(실측: 어떤 배속이든 간격이 1000ms).
 * 그대로 두면 잠깐 다른 앱을 보고 온 사이에 싸움이 굼벵이처럼 몇 턴만 지나가 있고,
 * 그동안 배터리만 먹는다. 보는 게 전부인 화면이니 안 보일 때는 그냥 멈춰 세운다.
 */
function whenVisible() {
  if (typeof document === 'undefined' || document.visibilityState === 'visible') return null;
  return new Promise((resolve) => {
    const on = () => {
      if (document.visibilityState !== 'visible') return;
      document.removeEventListener('visibilitychange', on);
      resolve();
    };
    document.addEventListener('visibilitychange', on);
  });
}

export function createFightView() {
  const root = el('div', 'fight');

  const floorLabel = el('div', 'fight__floor');
  /**
   * 우리와 적이 지금 얼마나 남았는가.
   *
   * ⚠️ **없어서 실제로 신고가 들어왔다** — 「내가 SR·SR·SSR·SR인데 SSR·SR·R·R한테
   * 왜 지는지 모르겠다」. 등급은 세기의 1.78배만 설명하고 역할이 2.54배를 설명한다.
   * 즉 **등급만 보면 절대 못 맞힌다.** 숫자를 보여주면 그 자리에서 풀린다.
   */
  const scale = el('div', 'fight__scale');
  // 아군은 왼쪽, 적은 오른쪽. 자리는 stage.js가 좌표로 정한다.
  const stage = createStage();
  // 고유기 이름. 늘 붙어 있고 data-cast 가 켜질 때만 보인다 —
  // 그때그때 만들어 붙이면 배속이 빠를 때 지우기 전에 다음 게 겹친다.
  const banner = el('div', 'fight__banner');
  const log = el('div', 'fight__log');

  root.append(floorLabel, scale, stage.el, banner, log);

  let views = new Map();
  let names = new Map();
  let tint = null;        // 탑 색. 등반에서는 비어 있다
  let spots = new Map();  // uid → 무대 위 자리(%). 어디로 달려갈지 여기서 나온다
  let chars = new Map();  // uid → 인물. 역할을 봐야 어떻게 싸울지 정해진다
  let speed = 1;
  let generation = 0; // 판이 바뀌면 올린다. 재생 중이던 이벤트를 버리는 표식

  /** 한 층을 새로 세운다 */
  function setup(run) {
    generation += 1;
    views = new Map();
    names = new Map();
    spots = new Map();
    chars = new Map();
    stage.clear();
    stage.clearFx();

    // **줄별로 먼저 모은다.** 자리가 그 줄의 인원수에 따라 벌어지므로,
    // 한 명씩 세우면서는 어디에 둘지 알 수가 없다.
    const rows = { partyBack: [], partyFront: [], enemyFront: [], enemyBack: [] };
    const put = (unit, side) => rows[`${side}${unit.front ? 'Front' : 'Back'}`].push({ unit, side });
    for (const u of run.party) put(u, 'party');
    for (const u of run.enemies) put(u, 'enemy');

    // 빈 줄은 그냥 비어 있으면 된다 — 좌표라서 칸이 접힐 일이 없다.
    // (예전 flex 칸에서는 빈 줄에 자리지기를 넣어야 마주 보는 줄이 안 어긋났다.)
    for (const list of Object.values(rows)) {
      list.forEach(({ unit, side }, i) => {
        const view = createUnitView(unit, side);
        const spot = spotOf(side, unit.front, i, list.length);
        views.set(unit.uid, view);
        names.set(unit.uid, unit.character.name);
        spots.set(unit.uid, spot);
        chars.set(unit.uid, unit.character);
        stage.place(view.el, spot);
      });
    }

    showHead(run);
    // 탑에서는 그 탑 색, 등반에서는 층에 따라 무지개 순서로 바뀐다
    stage.setSky(tint ?? skyOf(run.floor));
  }

  const num = (v) => Math.round(v).toLocaleString();

  /**
   * 층·턴·양쪽 수치를 다시 그린다.
   *
   * 턴을 보여주는 이유: 광폭화가 **12턴에 터지는데 턴 수가 어디에도 없었다.**
   * 붉은 섬광이 한 번 스치고 마니, 그 뒤로 피해가 왜 계속 커지는지 알 수가 없다.
   */
  function showHead(run) {
    const delay = run.rageDelay ?? 0;
    const turn = run.turn ?? 0;
    const raging = turn > RAGE_AFTER + delay;
    floorLabel.textContent = `${run.floor}층`;
    floorLabel.dataset.rage = String(raging);
    if (turn > 0) {
      floorLabel.append(el('span', 'fight__turn',
        raging ? `${turn}턴 ⚡광폭화` : `${turn}턴`));
    }

    const us = sideTotals(run.party, run.aura ?? 0);
    const them = sideTotals(run.enemies, run.enemyAura ?? 0);
    scale.replaceChildren();
    for (const [label, t] of [['아군', us], ['적', them]]) {
      const row = el('div', 'fight__scaleRow');
      row.append(
        el('span', 'fight__scaleWho', label),
        el('span', 'fight__scaleHp', `체력 ${num(t.hp)}`),
        el('span', 'fight__scaleAtk', `공격 ${num(t.atk)}`)
      );
      scale.append(row);
    }
  }

  /** 탑 색을 지정한다. 비우면 층에서 뽑아 쓴다 */
  function setTint(color) { tint = color ?? null; }

  // 연출 길이도 배속을 따라가야 한다. 안 그러면 ×4에서 다음 이벤트가
  // 이전 동작이 끝나기 전에 들어와 동작이 서로 잘린다.
  function setSpeed(v) {
    speed = v;
    root.style.setProperty('--speed', String(v));
  }

  const beat = (t) => BEAT[t] / speed;

  /**
   * 이 이벤트의 **마지막 타격이 닿는 시각**(ms).
   *
   * 쓰러짐(`die`)은 공격 뒤에 따로 오는 이벤트라, 때리는 동작이 닿기 전에 처리하면
   * 맞는 장면 없이 먼저 쓰러진다. 범위기는 여럿을 어긋내 때리므로 그만큼 더 늦다 —
   * 고정값(IMPACT)으로 두면 **마지막에 맞은 사람이 쓰러진 뒤에 맞는다.**
   */
  let impactEnd = IMPACT;

  /**
   * 역할대로 때린다. **여기가 「전사는 달려가고 포격은 쏜다」가 갈리는 자리다.**
   *
   * 계획은 choreo.js 가 순수 함수로 세우고(그래야 노드에서 검사할 수 있다)
   * 여기서는 그 계획을 화면에 옮기기만 한다.
   *
   * @returns {number} 이 공격이 실제로 닿는 시각(ms). 쓰러짐이 이 값을 쓴다
   */
  function strike(fromUid, toUid) {
    const actor = views.get(fromUid);
    const a = spots.get(fromUid);
    const b = spots.get(toUid);
    actor?.lunge();
    if (!a || !b) return IMPACT;

    const plan = planAttack({
      grammar: grammarOf(chars.get(fromUid)),
      grade: gradeOf(speed),
      from: a, to: b, beat: BEAT.attack,
    });

    if (plan.move) {
      const { w, h } = stage.size();
      actor?.moveBy((plan.move.x / 100) * w, (plan.move.y / 100) * h, plan.travelMs / speed);
      // 닿자마자 바로 돌아서면 때린 게 안 보인다. 한 박자 머물렀다 돌아온다
      setTimeout(() => actor?.home(plan.backMs / speed), (plan.impactMs + 90) / speed);
    }

    if (plan.fx === 'slash') {
      setTimeout(() => stage.burst('slash', b, 240 / speed), plan.impactMs / speed);
    } else if (plan.fx === 'shell') {
      // 포탄만 포물선이다. 나머지는 곧게 간다
      stage.fly('shell', a, b, plan.impactMs / speed, 20);
    } else if (plan.fx === 'beam') {
      stage.burst('beam', b, 320 / speed);
    } else if (plan.fx) {
      stage.fly(plan.fx, a, b, plan.impactMs / speed, 0);
    }

    // 히트스톱 — 명중 순간 화면을 세운다. 「때렸다」를 만드는 건 이것 하나다
    if (plan.hitstop) {
      setTimeout(() => mark('stop', plan.hitstop), plan.impactMs / speed);
    }
    // 흔들리는 방향이 때린 방향과 맞아야 힘이 읽힌다
    if (plan.shake) {
      root.style.setProperty('--tapdir', b.x >= a.x ? '1' : '-1');
      setTimeout(() => mark('tap', 180), plan.impactMs / speed);
    }
    return plan.impactMs || IMPACT;
  }

  /** 한 번짜리 표식을 붙였다 뗀다. 연출이 겹쳐도 마지막 것만 남는다 */
  const mark = (attr, ms) => {
    root.dataset[attr] = 'on';
    setTimeout(() => { if (root.dataset[attr] === 'on') delete root.dataset[attr]; }, ms / speed);
  };

  /** 이벤트 하나를 화면에 반영한다. 시간은 안 쓴다 */
  function apply(e) {
    const from = views.get(e.from);
    impactEnd = IMPACT;
    switch (e.t) {
      case 'attack': {
        impactEnd = strike(e.from, e.to);
        setTimeout(() => {
          if (views.get(e.to) === undefined) return;
          views.get(e.to).hit(e);
        }, impactEnd / speed);
        break;
      }
      // 고유기가 터지는 순간. 화면을 어둡게 깔고 이름을 띄운다 —
      // **이 배너가 「뽑은 보람」을 눈으로 보여주는 유일한 자리다.**
      case 'skill': {
        from?.cast();
        banner.textContent = `《${e.name}》`;
        mark('cast', BEAT.skill);
        break;
      }
      case 'aoeHit': {
        const hits = e.hits ?? [];
        from?.cast();
        hits.forEach((h, i) => setTimeout(() => {
          views.get(h.to)?.hit(h);
        }, (IMPACT + i * STAGGER) / speed));
        impactEnd = IMPACT + Math.max(0, hits.length - 1) * STAGGER;
        mark('shake', 420);
        break;
      }
      case 'aoeHeal': {
        from?.cast();
        (e.heals ?? []).forEach((h, i) => setTimeout(() => {
          views.get(h.to)?.heal(h);
        }, (i * STAGGER) / speed));
        break;
      }
      case 'weaken': {
        from?.cast();
        for (const uid of e.targets ?? []) views.get(uid)?.weaken(e.pct);
        break;
      }
      case 'heal': views.get(e.to)?.heal(e); break;
      case 'revive': from?.lunge(); views.get(e.to)?.revive(e); break;
      case 'shield': for (const uid of e.targets ?? []) views.get(uid)?.shield(e.amount); break;
      case 'buff': from?.buff(e.pct); break;
      // 앞 이벤트가 정한 시각을 쓴다. 범위기 뒤에 오면 그만큼 늦게 쓰러진다
      case 'die': {
        const at = impactEnd;
        setTimeout(() => views.get(e.who)?.die(), at / speed);
        break;
      }
      case 'rage':
        root.dataset.rage = 'on';
        setTimeout(() => root.removeAttribute('data-rage'), 700 / speed);
        break;
      default: break;
    }
  }

  const describe = (e) => describeEvent(e, (uid) => names.get(uid));

  /**
   * 한 턴 치를 재생한다. 재생 도중 판이 바뀌면 도중에 그만둔다.
   * @returns {Promise<boolean>} 끝까지 재생했으면 true
   */
  async function play(events) {
    const mine = generation;
    for (const e of events) {
      const hidden = whenVisible();
      if (hidden) {
        await hidden;
        if (mine !== generation) return false;
      }
      apply(e);
      const text = describe(e);
      if (text) log.textContent = text;
      const wait = beat(e.t);
      if (wait > 0) await sleep(wait);
      if (mine !== generation) return false;
    }
    return true;
  }

  /** 재생이 놓친 게 있어도 턴 끝에는 엔진과 맞춘다 */
  function sync(run) {
    for (const u of [...run.party, ...run.enemies]) views.get(u.uid)?.sync(u);
    showHead(run);
  }

  /** 재생 중인 것을 버린다 */
  function abort() { generation += 1; stage.clearFx(); }

  function setLog(text) { log.textContent = text; }

  return { el: root, setup, play, sync, setSpeed, abort, setLog, setTint };
}
