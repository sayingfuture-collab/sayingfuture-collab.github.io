// 전장. 엔진이 뱉은 이벤트 목록을 한 대씩 재생한다.
//
// 엔진은 한 턴을 통째로 계산해놓고 끝난다. 그래서 화면은 항상 엔진보다 뒤처져서 따라간다 —
// 이벤트에 실려온 체력·방어막을 그대로 쓰기 때문에 다시 계산할 일이 없다.
// 나중에 그래픽을 얹으면 고칠 곳은 unit-view.js이고 이 파일은 그대로다.

import { createUnitView } from './unit-view.js';
import { describeEvent } from './battle-log.js';

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
};

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
  const field = el('div', 'fight__field');
  const log = el('div', 'fight__log');

  // 아군은 왼쪽, 적은 오른쪽. 앞줄끼리 가운데에서 마주 본다.
  const cols = {
    partyBack: el('div', 'fight__col'),
    partyFront: el('div', 'fight__col'),
    enemyFront: el('div', 'fight__col'),
    enemyBack: el('div', 'fight__col'),
  };
  const partyTeam = el('div', 'fight__team');
  partyTeam.dataset.side = 'party';
  partyTeam.append(cols.partyBack, cols.partyFront);
  const enemyTeam = el('div', 'fight__team');
  enemyTeam.dataset.side = 'enemy';
  enemyTeam.append(cols.enemyFront, cols.enemyBack);
  field.append(partyTeam, el('div', 'fight__vs', 'VS'), enemyTeam);

  root.append(floorLabel, field, log);

  let views = new Map();
  let names = new Map();
  let speed = 1;
  let generation = 0; // 판이 바뀌면 올린다. 재생 중이던 이벤트를 버리는 표식

  /** 한 층을 새로 세운다 */
  function setup(run) {
    generation += 1;
    views = new Map();
    names = new Map();
    for (const c of Object.values(cols)) c.replaceChildren();

    const place = (unit, side) => {
      const view = createUnitView(unit, side);
      views.set(unit.uid, view);
      names.set(unit.uid, unit.character.name);
      cols[`${side}${unit.front ? 'Front' : 'Back'}`].append(view.el);
    };
    for (const u of run.party) place(u, 'party');
    for (const u of run.enemies) place(u, 'enemy');

    // 진형이 비면 칸이 접혀서 마주 보는 줄이 어긋난다. 빈 칸도 자리를 지킨다.
    for (const [key, node] of Object.entries(cols)) {
      node.dataset.empty = String(node.children.length === 0);
      node.dataset.role = key;
    }

    floorLabel.textContent = `${run.floor}층`;
  }

  // 연출 길이도 배속을 따라가야 한다. 안 그러면 ×4에서 다음 이벤트가
  // 이전 동작이 끝나기 전에 들어와 동작이 서로 잘린다.
  function setSpeed(v) {
    speed = v;
    root.style.setProperty('--speed', String(v));
  }

  const beat = (t) => BEAT[t] / speed;

  /** 이벤트 하나를 화면에 반영한다. 시간은 안 쓴다 */
  function apply(e) {
    const from = views.get(e.from);
    switch (e.t) {
      case 'attack': {
        from?.lunge();
        setTimeout(() => {
          if (views.get(e.to) === undefined) return;
          views.get(e.to).hit(e);
        }, IMPACT / speed);
        break;
      }
      case 'heal': views.get(e.to)?.heal(e); break;
      case 'revive': from?.lunge(); views.get(e.to)?.revive(e); break;
      case 'shield': for (const uid of e.targets ?? []) views.get(uid)?.shield(e.amount); break;
      case 'buff': from?.buff(e.pct); break;
      case 'die': setTimeout(() => views.get(e.who)?.die(), IMPACT / speed); break;
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
  }

  /** 재생 중인 것을 버린다 */
  function abort() { generation += 1; }

  function setLog(text) { log.textContent = text; }

  return { el: root, setup, play, sync, setSpeed, abort, setLog };
}
