// 턴제 전투 엔진. 화면을 모른다.
// 무슨 일이 있었는지를 이벤트 목록으로 돌려주고, 그리는 건 화면이 알아서 한다.
// 나중에 그래픽을 넣을 때 이 파일은 안 바뀐다.
//
// 이벤트에는 "무슨 일이 있었나"와 함께 "그래서 어떻게 됐나"(남은 체력·방어막)를 같이 싣는다.
// 렌더러가 한 대씩 재생하려면 각 시점의 상태가 필요한데, 피해량만으로는 역산이 안 된다 —
// 방어막이 얼마나 먹었는지 모르기 때문이다. 렌더러는 계산하지 않고 실린 값을 쓰기만 한다.

import { statsOf, rowMult, defaultFront } from './stats.js';
import { skillOf, passiveOf } from './skills.js';
import { enemiesFor } from './enemy.js';

const BUFF_STEP = 0.15;   // 지휘 1회당 아군 공격력 증가
const BUFF_MAX = 0.9;     // 호령은 여기까지만 쌓는다. 그 뒤로 지휘는 공격한다
/**
 * 아군 버프 총량 상한. 어떤 경우에도 여기를 못 넘는다.
 *
 * ⚠️ **버프는 층이 바뀌어도 안 풀린다.** 적 버프는 startFloor 에서 0으로 되돌리는데
 * 아군 것만 그대로 넘어간다. 의도한 동작은 아니었지만(2026-08-20 확인), 층마다 풀면
 * 판이 너무 어려워져서 상한으로 막는 쪽을 골랐다.
 */
const BUFF_TOTAL_MAX = 2.0;

/**
 * 그 층에서 버프가 오를 수 있는 한계. **깊이 갈수록 천장이 열린다.**
 *
 * 호령 상한(90%)까지는 언제나 열려 있고, **그 위를 층이 연다.**
 * 1층 93% · 10층 120% · 20층 150% · 30층 180% · 37층부터 200%.
 *
 * ── 왜 이 모양인가 ──
 *
 * 처음엔 상한 하나(200%)로만 막았는데 실측에서 **16층이면 이미 만렙**이었다(200판 전부).
 * 그 뒤 30층은 아무것도 안 차오른다. 고쳐보려고 두 가지를 재봤고 둘 다 실패했다:
 *
 *   · 버프 수치를 늦춘다 → 8분의 1로 줄여도 만렙이 16층 → 30층까지밖에 안 밀렸다.
 *     판 하나가 몇 턴이라 40층이면 턴이 수백 번이어서, **턴마다 오르는 버프는 어떤
 *     수치를 써도 초반에 만렙이 된다.** 게다가 적도 같은 수치를 써서 난이도는 그대로였다.
 *   · 상한을 낮춘다 → 천장에 더 빨리 부딪힐 뿐이었다(150%면 13층, 90%면 5층).
 *
 * 그래서 시간(턴)이 아니라 **깊이(층)**에 묶는다. 알렉산더의 원정(층당 +4%)이 이미
 * 그렇게 생겼고, 그쪽은 판이 길수록 세지는 게 구조로 보장된다.
 *
 * ⚠️ **바닥을 호령 상한에 맞추는 게 중요하다.** 한때 바닥을 26%로 뒀더니 1층 천장이 30%라
 * 세종의 훈민정음이 초반에 아예 안 나갔다(이미 천장이라 헛턴 판정에 걸린다).
 * SSR을 뽑고도 고유기를 못 보는 건 이 게임에서 제일 나쁜 쪽이다.
 *
 * 적도 같은 자를 쓴다 — 한쪽만 묶으면 그게 곧 밸런스 변경이 된다.
 */
const BUFF_FLOOR_STEP = 0.03;
export function buffCapAt(floor) {
  return Math.min(BUFF_TOTAL_MAX, BUFF_MAX + Math.max(0, floor) * BUFF_FLOOR_STEP);
}
const HEAL_PCT = 0.25;    // 치유량 = 대상 최대 체력의 이 비율
export const SHIELD_MULT = 1.5;  // 방어막 = 시전자 공격력 × 이 값
const WEAKEN_MAX = 0.6;   // 팔진도가 깎을 수 있는 한계. 적을 0으로 만들면 싸움이 안 끝난다
const REVIVE_PCT = 0.5;   // 소생 시 돌아오는 체력 비율. 치유 한 명당 판당 1회
// 적이 전원 앞줄이면 포격이 관통할 데가 없다. 대신 몰려 있는 만큼 크게 맞는다.
const PIERCE_MASSED = Number(globalThis.process?.env?.PIERCE_MASSED ?? 1.6);
/**
 * 관통의 대가 — **앞줄을 뚫고 가느라 위력이 준다.** 1 이면 대가가 없다(옛 동작).
 *
 * ── 왜 넣었나 (2026-08-22) ──
 *
 * 통제된 바꿔치기에서 **포격이 든 편성만 20층 앞섰다**(95~116층 대 79~91층).
 * 공격 배수를 내려봤지만 **오히려 올랐다** — 적도 같은 표를 써서 적 포격이 같이 약해지고,
 * 물렁한 우리 뒷줄이 덜 죽기 때문이다. 즉 **공격력은 지렛대가 아니다.**
 *
 * 포격의 진짜 이점은 **표적 선택**이다. 다른 역할은 reachable() 을 거쳐 단단한 앞줄을
 * 때리는데 포격만 그걸 건너뛰고 물렁한 뒷줄을 지목한다. 적의 83%가 지휘·장인·치유라
 * 그 뒷줄이 곧 알맹이다. 그래서 **이점은 그대로 두고 대가를 붙인다** —
 * 표적을 고르는 값으로 위력을 내놓는다.
 */
const PIERCE_COST = Number(globalThis.process?.env?.PIERCE_COST ?? 1);   // 훑어보니 1 이 제일 나았다

/**
 * 앞줄 한 명당 관통이 **막힐** 확률. 0 이면 안 막힌다(옛 동작).
 *
 * ── 왜 이것만 통하나 (2026-08-22) ──
 *
 * 포격을 약하게 하는 손질은 **전부 실패했다** — 공격 배수도, 관통 대가도, 적 진형도.
 * 이유는 하나다: **적도 같은 표를 쓴다.** 포격을 깎으면 적 포격도 깎여서,
 * 체력이 물렁한 포격 파티가 되레 오래 산다. 대칭인 손질은 전부 이 함정에 빠진다.
 *
 * 이건 다르다. 관통을 막는 건 **앞줄**인데, 포격만 넣은 파티는 앞줄이 없다.
 * 즉 이 규칙은 **자기를 지킬 수 있는 편성에만 값을 준다** — 대칭인 규칙인데
 * 효과는 비대칭이다. 전사에게 「적 포격을 막는다」는 할 일이 생기는 건 덤이다.
 */
const PIERCE_BLOCK = Number(globalThis.process?.env?.PIERCE_BLOCK ?? 0.25);

/**
 * 앞줄이 하나도 없는 쪽이 **모든 공격에서** 더 맞는 배수. 1 이면 안 걸린다.
 *
 * ⚠️ **포격만 이득 보게 두면 안 된다.** 예전에는 이 벌이 포격의 표적 선택에만 붙어서,
 * 적의 45%가 전원 뒷줄인 이 게임에서 **포격 전용 보너스**가 되어 있었다.
 * 방어하는 쪽 문제이므로 때리는 사람이 누구든 똑같이 걸려야 한다.
 */
const EXPOSED_TAKEN = Number(globalThis.process?.env?.EXPOSED_TAKEN ?? 1.3);


// 광폭화 — 이 턴을 넘기면 매 턴 피해가 불어난다.
// 치유가 양쪽에 있으면 회복이 피해를 앞질러 아무도 안 죽는다.
// 턴 상한으로 끊으면 결과가 늦고 답답하니, 싸움 자체를 끝나게 만든다.
//
// **밖에서도 읽는다.** 칭호 「버티기」가 이 값을 넘긴 층을 세는데,
// 숫자를 베껴 두면 여기를 고칠 때 조용히 어긋난다.
export const RAGE_AFTER = 12;
const RAGE_STEP = 0.25;

/** 이번 턴의 피해 배율 */
function rageMult(turn) {
  return 1 + Math.max(0, turn - RAGE_AFTER) * RAGE_STEP;
}

// 지휘·치유·장인도 할 일이 없으면 때린다.
// 안 그러면 134명 중 27%만 공격할 수 있어서, 무작위 4명의 29%가
// 적을 아예 못 죽이고 1층에서 멈춘다.

/** @param {boolean} front 앞줄이면 true. 역할이 아니라 편성이 정한다 */
function toUnit(uid, character, level, front) {
  const s = statsOf(character, level);
  return {
    uid,
    character,
    level,
    front,
    hp: s.hp,
    maxHp: s.hp,
    baseMaxHp: s.hp, // 보상이 얹히기 전 값. 복리를 막으려고 여기 기준으로 더한다
    // 줄에 따른 공격력은 baseAtk에서 그때그때 계산한다.
    // 층 사이에 줄을 바꿀 수 있으므로 한 번 계산하고 끝내면 안 된다.
    baseAtk: s.atk,
    atk: Math.round(s.atk * rowMult(front).atk),
    shield: 0,
    // 고유기가 쌓아 올리는 값들. baseAtk와 따로 둬서 줄을 바꿔도 안 날아간다.
    bonusAtk: 0,     // 관우 의리, 알렉산더 원정처럼 판 중에 붙는 배수
    revivesUsed: 0,
    weaken: 0,       // 제갈량 팔진도에 깎인 만큼
  };
}

/**
 * 상시·누적 효과를 다 반영한 실제 공격력.
 * 필드가 없는 유닛(테스트에서 손으로 세운 적)도 그냥 기본 공격력으로 떨어지게 둔다.
 */
function effAtk(unit, auraAtk = 0) {
  const m = (1 + (unit.bonusAtk ?? 0)) * (1 + auraAtk) * (1 - (unit.weaken ?? 0));
  return Math.max(1, Math.round(unit.atk * m));
}

/**
 * 유닛의 줄을 바꾼다. 층 사이에 편성을 고칠 때 쓴다.
 * 공격력이 줄에 걸려 있으므로 같이 다시 계산한다 — 안 그러면 앞줄 페널티를 달고 뒤로 가거나
 * 그 반대가 되어 화면에 적힌 숫자와 실제가 어긋난다.
 */
export function setRow(unit, front) {
  unit.front = front;
  // 고유기로 쌓인 bonusAtk·weaken은 따로 들고 있으므로 여기서 안 날아간다
  unit.atk = Math.round(unit.baseAtk * rowMult(front).atk);
  return unit;
}

/** 관통 배수 — 고유기(나폴레옹)와 판 중에 고른 보상(조준)이 겹쳐 붙는다 */
function pierceMult(actor) {
  return passiveOf(actor.character, 'pierceBonus', 1) * (1 + (actor.pierceBonus ?? 0));
}

const alive = (list) => list.filter((u) => u.hp > 0);

/** 이 편에 살아 있는 앞줄이 하나도 없는가. **막아설 사람이 없다는 뜻이다** */
const isExposed = (list) => !list.some((u) => u.hp > 0 && u.front);

/**
 * @param {Array<{character: object, level: number, front?: boolean}>} partyEntries 최대 4명
 *   front를 안 주면 역할 기본값으로 세운다 — 옛 저장과 시뮬레이션용.
 */
export function createRun(partyEntries) {
  const party = partyEntries.map((e, i) =>
    toUnit(`p${i}`, e.character, e.level, e.front ?? defaultFront(e.character))
  );
  return {
    floor: 0,
    party,
    enemies: [],
    buff: 0,
    enemyBuff: 0,
    // 대칸(칭기즈 칸) 같은 아우라는 편성이 정해지면 안 바뀌므로 한 번만 센다.
    aura: auraOf(party),
    enemyAura: 0,
    turn: 0,
    // 판 중에 고른 보상이 쌓이는 자리. 판이 끝나면 같이 사라진다.
    rewards: [],
    rageDelay: 0,
    startShield: 0,
    result: 'ongoing',
  };
}

/** 아군 전원에게 걸리는 공격력 아우라의 합 */
function auraOf(units) {
  return units.reduce((sum, u) => sum + passiveOf(u.character, 'auraAtk', 0), 0);
}

/**
 * 층을 넘을 때 파티가 되찾는 체력. **최대 체력 기준이고 쓰러진 아군은 안 일어난다** —
 * 되살리는 건 치유의 소생 몫으로 남긴다.
 *
 * ── 왜 넣었나 (2026-08-21) ──
 *
 * 원래는 층 사이에 아무것도 안 돌려줬다. 그랬더니 같은 SSR·같은 20렙인데
 * **치유가 있으면 71층, 없으면 28층**으로 2.5배가 벌어졌다. 역할이 다섯인데
 * 하나가 사실상 필수면 그건 선택이 아니다.
 *
 * 20%인 이유: 실측에서 **20%가 100%와 거의 같았다**(치유 없음 41층 vs 43층).
 * 그리고 **치유 있는 편성은 71 → 72로 안 움직인다** — 억울한 쪽만 오르고
 * 천장은 그대로다. `tools/balance/heal-between-floors.mjs` 로 다시 잴 수 있다.
 *
 * ⚠️ 적에게는 안 걸린다. 적은 층마다 새로 세워져서 어차피 만피로 나온다.
 */
export const FLOOR_HEAL = 0.2;

/**
 * 적을 세운 **뒤에** 층을 시작하는 일들. 회복·원정·철벽·초기화가 여기 다 있다.
 *
 * ⚠️ **탑도 이 함수를 쓴다.** 적을 만드는 곳만 다르고 나머지 규칙은 같아야 한다 —
 * 따로 베껴 쓰면 조용히 어긋난다(실제로 탑에서 알렉산더의 원정과 철벽 보상이 빠져 있었다).
 * @param {object} state
 * @param {Array<object>} enemies 이미 만들어진 적 유닛들
 */
export function enterFloor(state, enemies) {
  state.enemies = enemies;
  state.enemyAura = auraOf(state.enemies);
  state.enemyBuff = 0;
  state.turn = 0; // 광폭화는 층마다 다시 센다
  state.result = 'ongoing';

  for (const u of state.party) {
    // 층을 넘으면 조금 되찾는다. **쓰러진 아군은 그대로 둔다** — 소생은 치유 몫이다.
    if (u.hp > 0) u.hp = Math.min(u.maxHp, u.hp + Math.round(u.maxHp * FLOOR_HEAL));
    // 원정(알렉산더) — 층이 오를수록 강해진다. 층마다 한 번만 붙인다.
    const per = passiveOf(u.character, 'atkPerFloor', 0);
    if (per) u.bonusAtk = per * (state.floor - 1);
    // 철벽(보상) — 층을 시작할 때 방어막을 두르고 들어간다
    if (state.startShield && u.hp > 0) {
      u.shield = Math.max(u.shield, Math.round(u.maxHp * state.startShield));
    }
  }
}

/** 적 하나를 유닛으로. 탑이 자기 적 표로 세울 때도 쓴다 */
export function toEnemy(e) {
  return toUnit(e.uid, e.character, e.level, defaultFront(e.character));
}

/** 다음 층으로. 다 회복하지는 않는다 — FLOOR_HEAL 만큼만 되찾는다. */
export function startFloor(state, rng = Math.random) {
  state.floor += 1;
  // 적 진형은 역할로 정한다 — 전사는 앞줄, 나머지는 뒷줄.
  // 전사가 없으면 앞줄이 비고, 그러면 처음부터 다 노출된다.
  enterFloor(state, enemiesFor(state.floor, rng).map(toEnemy));
}

/**
 * 이번 공격이 닿는 범위. 앞줄이 살아 있으면 앞줄이지만, **앞줄이 얇으면 뒤로 샌다.**
 *
 * 이 규칙이 없으면 앞줄 1명이 정답이 된다 — 몸으로 막는 건 한 명이면 충분하고,
 * 두 명째부터는 공격력만 버리는 셈이기 때문이다(시뮬레이션에서 1/3이 4/0을 5층 앞섰다).
 * 한 명이 네 명을 다 막을 수는 없어야 진형이 선택지가 된다.
 */
const FRONT_SLOTS = 4;
// 앞줄 빈자리 하나당 뒤로 새는 확률. stats.js와 같은 이유로 훑기용 손잡이를 둔다.
const LEAK_PER_MISSING = Number(globalThis.process?.env?.LEAK_PER_MISSING ?? 0.15);

function reachable(list, rng) {
  const living = alive(list);
  const front = living.filter((u) => u.front);
  if (!front.length) return living; // 앞줄이 없거나 다 쓰러졌다 — 뒷줄이 그대로 노출된다
  const back = living.filter((u) => !u.front);
  if (!back.length) return front;   // 뒷줄이 없다
  return rng() < (FRONT_SLOTS - front.length) * LEAK_PER_MISSING ? back : front;
}

/**
 * 방어막부터 깎고 남은 만큼 체력을 줄인다.
 * 앞줄은 피해를 덜 받는다 — 대신 맞기가 피해를 옮기기만 하면
 * 전사를 넣으나 마나가 되어서, 실제로 줄여야 값을 한다.
 * 뒷줄은 앞줄이 무너진 뒤에도 감소가 없다. 버티라고 세운 게 아니다.
 */
/**
 * @param {boolean} [exposed] 맞는 쪽에 살아 있는 앞줄이 하나도 없는가.
 *   **때리는 사람이 누구든 똑같이 걸린다** — 방어하는 쪽 문제이기 때문이다.
 */
function applyDamage(target, dmg, exposed = false) {
  // guard는 판 중에 고른 보상이 얹어주는 추가 감소. 없으면 0.
  const taken = rowMult(target.front).taken * (exposed ? EXPOSED_TAKEN : 1) * (1 - (target.guard ?? 0));
  const actual = Math.round(dmg * taken);
  let rest = actual;
  if (target.shield > 0) {
    const absorbed = Math.min(target.shield, rest);
    target.shield -= absorbed;
    rest -= absorbed;
  }
  target.hp = Math.max(0, target.hp - rest);
  return { actual, died: target.hp === 0 };
}

/**
 * 누구를 때릴지 고른다. 역할마다 다르다 — 이게 진형을 결정으로 만든다.
 *
 *  포격 관통 — 앞줄을 넘어 뒷줄을 먼저 노린다. "뒷줄은 안전하다"가 적 포격 앞에서는 거짓이 된다
 *  전사 도발 — 앞줄에 전사가 있으면 앞줄로 오는 공격을 전사가 다 받는다
 */
function chooseTarget(actor, foes, rng) {
  const living = alive(foes);
  if (!living.length) return null;

  if (actor.character.role === '포격') {
    const back = living.filter((u) => !u.front);
    if (back.length) {
      // 관통은 뒤를 노렸는데 앞줄이 실제로 있었을 때만 관통이라 부른다
      const front = living.filter((u) => u.front);
      // 앞줄이 두꺼우면 관통이 막힌다. 막히면 앞줄을 때린다 — 평타와 같아진다.
      if (front.length && rng() < front.length * PIERCE_BLOCK) {
        return { target: front[Math.floor(rng() * front.length)], via: 'blocked', mult: 1 };
      }
      // 뚫을 앞줄이 있을 때만 「관통」이고, 그때만 대가를 낸다.
      // 앞줄이 없으면 그냥 때리는 것이라 대가도 없다 — 대신 무방비 배수가 걸린다.
      return {
        target: back.reduce((a, b) => (b.hp > a.hp ? b : a)),
        via: front.length ? 'pierce' : null,
        mult: (front.length ? PIERCE_COST : 1) * pierceMult(actor),
      };
    }
    // 뒷줄이 아예 없다 = 전원이 앞줄에 몰려 있다. 포탄이 그 안에 꽂힌다.
    // 이게 없으면 전원 앞줄(4/0)이 관통을 통째로 무효화해서 유일한 정답이 된다.
    return {
      target: living.reduce((a, b) => (b.hp > a.hp ? b : a)),
      via: 'massed',
      mult: PIERCE_MASSED * pierceMult(actor),
    };
  }

  let pool = reachable(foes, rng);
  if (!pool.length) return null;

  // 도발 — 앞줄이 표적일 때만 걸린다. 뒤로 샌 공격은 전사가 못 막는다.
  const guards = pool.filter((u) => u.front && u.character.role === '전사');
  if (guards.length) {
    return { target: guards[Math.floor(rng() * guards.length)], via: 'guard', mult: 1 };
  }
  return { target: pool[Math.floor(rng() * pool.length)], via: null, mult: 1 };
}

/** 때린다 */
function attack(actor, allies, foes, power, rng, events) {
  const chosen = chooseTarget(actor, foes, rng);
  if (!chosen) return;
  const { target, via, mult } = chosen;

  // 때린 사건을 먼저, 그 결과인 쓰러짐을 뒤에 넣는다.
  // 순서가 뒤집히면 로그가 어색하고, 나중에 그래픽을 얹었을 때
  // 죽는 연출이 공격 연출보다 먼저 재생된다.
  const { actual, died } = applyDamage(target, Math.round(power * mult), isExposed(foes));
  const e = {
    t: 'attack', from: actor.uid, to: target.uid,
    dmg: actual, hp: target.hp, shield: target.shield,
  };
  if (via) e.via = via;
  events.push(e);
  if (died) {
    events.push({ t: 'die', who: target.uid });
    onKill(actor, events);
    // 의리는 **쓰러진 쪽 편**에서 발동한다. 때린 쪽 아군(allies)이 아니라 foes다.
    onAllyDown(target, foes, events);
  }
}

/** 정복(광개토대왕) — 적을 쓰러뜨리면 회복한다 */
function onKill(actor, events) {
  const pct = passiveOf(actor.character, 'healOnKill', 0);
  if (!pct || actor.hp === 0 || actor.hp >= actor.maxHp) return;
  const amount = Math.min(Math.round(actor.maxHp * pct), actor.maxHp - actor.hp);
  if (amount <= 0) return;
  actor.hp += amount;
  events.push({ t: 'heal', from: actor.uid, to: actor.uid, amount, hp: actor.hp, skill: '정복' });
}

/** 의리(관우) — 같은 편이 쓰러지면 남은 사람이 세진다 */
function onAllyDown(fallen, allies, events) {
  for (const u of allies) {
    if (u.hp === 0 || u === fallen) continue;
    const step = passiveOf(u.character, 'atkPerAllyDown', 0);
    if (!step) continue;
    u.bonusAtk = (u.bonusAtk ?? 0) + step;
    events.push({
      t: 'buff', from: u.uid, stat: 'atk',
      pct: Math.round(step * 100), targets: [u.uid], skill: '의리',
    });
  }
}

/**
 * 고유기를 쓴다. 효과는 정해진 종류에서 고른 것만 있다 —
 * 인물마다 손으로 규칙을 짜면 14개를 다 검증할 수가 없다.
 * @returns {number} 이번 행동으로 더해진 버프
 */
function castActive(actor, active, allies, foes, power, ctx, events) {
  events.push({ t: 'skill', from: actor.uid, name: active.name });
  let buffAdded = 0;

  for (const eff of active.effects) {
    switch (eff.kind) {
      case 'aoeDamage': {
        const hits = [];
        const deaths = [];
        const bare = isExposed(foes);
        for (const target of alive(foes)) {
          const { actual, died } = applyDamage(target, Math.round(power * eff.pct), bare);
          hits.push({ to: target.uid, dmg: actual, hp: target.hp, shield: target.shield });
          if (died) deaths.push(target.uid);
        }
        if (hits.length) events.push({ t: 'aoeHit', from: actor.uid, name: active.name, hits });
        for (const uid of deaths) {
          events.push({ t: 'die', who: uid });
          onKill(actor, events);
          onAllyDown(foes.find((u) => u.uid === uid), foes, events);
        }
        break;
      }
      case 'nuke': {
        const chosen = chooseTarget(actor, foes, () => 0.99);
        if (!chosen) break;
        const { actual, died } = applyDamage(chosen.target, Math.round(power * eff.pct), isExposed(foes));
        events.push({
          t: 'attack', from: actor.uid, to: chosen.target.uid,
          dmg: actual, hp: chosen.target.hp, shield: chosen.target.shield, skill: active.name,
        });
        if (died) {
          events.push({ t: 'die', who: chosen.target.uid });
          onKill(actor, events);
          onAllyDown(chosen.target, foes, events);
        }
        break;
      }
      case 'aoeHeal': {
        const heals = [];
        for (const u of alive(allies)) {
          const amount = Math.min(Math.round(u.maxHp * eff.pct), u.maxHp - u.hp);
          if (amount <= 0) continue;
          u.hp += amount;
          heals.push({ to: u.uid, amount, hp: u.hp });
        }
        if (heals.length) events.push({ t: 'aoeHeal', from: actor.uid, name: active.name, heals });
        break;
      }
      case 'aoeShield': {
        const amount = Math.round(power * eff.mult);
        const targets = alive(allies).filter((u) => u.shield < amount);
        for (const u of targets) u.shield = amount;
        if (targets.length) {
          events.push({
            t: 'shield', from: actor.uid, amount,
            targets: targets.map((u) => u.uid), skill: active.name,
          });
        }
        break;
      }
      case 'aoeBuff': {
        buffAdded += eff.pct;
        events.push({
          t: 'buff', from: actor.uid, stat: 'atk',
          pct: Math.round(eff.pct * 100),
          targets: alive(allies).map((u) => u.uid), skill: active.name,
        });
        break;
      }
      case 'weaken': {
        const targets = alive(foes);
        for (const u of targets) u.weaken = Math.min(WEAKEN_MAX, (u.weaken ?? 0) + eff.pct);
        if (targets.length) {
          events.push({
            t: 'weaken', from: actor.uid, pct: Math.round(eff.pct * 100),
            targets: targets.map((u) => u.uid), skill: active.name,
          });
        }
        break;
      }
      default: break;
    }
  }
  return buffAdded;
}

/**
 * 지금 상태에서 이 고유기가 아무 일도 못 하는가.
 *
 * **버프만 주는 고유기**(세종의 훈민정음)가 이미 총량 상한이면 그렇다. 고유기는 평소 행동
 * *대신* 도는 구조라, 그 턴은 버프도 안 오르고 때리지도 않는 순수 손해가 된다.
 * 실측에서 훈민정음 발동의 **83%**가 이 헛턴이었다(2,882번 중 2,382번).
 *
 * 방어막·피해가 섞인 고유기(다빈치의 만물의 공책)는 버프가 막혀도 할 일이 남으므로
 * 그대로 쓴다 — 그래서 "효과가 전부 aoeBuff 인가"를 본다.
 */
function isNoOp(active, buff, floor) {
  return buff >= buffCapAt(floor) && active.effects.every((e) => e.kind === 'aoeBuff');
}

/**
 * 한 명이 자기 역할대로 행동한다. 할 일이 없으면 때린다.
 *
 * 지휘·장인은 줄을 안 가리고 파티 전체를 돌본다.
 * 한때 "같은 줄만" 으로 만들어봤는데, 그러면 갈라놓을수록 지원 값이 반토막나서
 * 전원 한 줄로 뭉치는 게 정답이 됐다(4/0이 다른 진형을 3.5층 앞섰다).
 * 줄을 노리는 것은 포격 관통과 전사 도발에 맡긴다 — 그쪽은 적 구성에 따라 답이 달라진다.
 *
 * @returns {number} 이번 행동으로 더해진 버프
 */
function act(actor, allies, foes, buff, rage, rng, events, ctx) {
  const role = actor.character.role;
  const power = Math.round(effAtk(actor, ctx.aura) * (1 + buff) * rage);

  // 고유기 — 주기가 돌아오면 평소 행동 대신 이걸 쓴다.
  // **단, 아무 일도 못 할 때는 쓰지 않는다.** 바로 아래 호령이 예전부터 그렇게 하고
  // 있었는데(상한에 닿으면 때린다) 고유기만 그 규칙에서 빠져 있었다.
  const active = skillOf(actor.character)?.active;
  if (active && ctx.turn % active.every === 0 && !isNoOp(active, buff, ctx.floor)) {
    return castActive(actor, active, allies, foes, power, ctx, events);
  }

  // 지휘 호령 — 같은 줄만. 상한에 닿기 전까지만 걸고, 그 뒤로는 때린다.
  if (role === '지휘' && buff < BUFF_MAX) {
    events.push({
      t: 'buff', from: actor.uid, stat: 'atk',
      pct: Math.round(BUFF_STEP * 100),
      targets: alive(allies).map((u) => u.uid),
    });
    return BUFF_STEP;
  }

  // 치유 소생 — 판당 한 번, 쓰러진 아군을 절반 체력으로 되살린다.
  // 회복보다 먼저 본다. 죽은 사람을 두고 상처를 꿰맬 수는 없다.
  const reviveMax = passiveOf(actor.character, 'reviveMax', 1) + (actor.bonusRevives ?? 0);
  if (role === '치유' && actor.revivesUsed < reviveMax) {
    const fallen = allies.filter((u) => u.hp === 0);
    if (fallen.length) {
      const target = fallen.reduce((a, b) => (b.maxHp > a.maxHp ? b : a));
      actor.revivesUsed += 1;
      const pct = passiveOf(actor.character, 'revivePct', REVIVE_PCT);
      target.hp = Math.max(1, Math.round(target.maxHp * pct));
      events.push({ t: 'revive', from: actor.uid, to: target.uid, hp: target.hp });
      return 0;
    }
  }

  // 치유 — 다친 아군이 있을 때만. 없으면 때린다. 회복은 줄을 안 가린다.
  if (role === '치유') {
    const hurt = alive(allies).filter((u) => u.hp < u.maxHp);
    if (hurt.length) {
      // 가장 많이 다친 아군
      hurt.sort((a, b) => (b.maxHp - b.hp) - (a.maxHp - a.hp));
      const target = hurt[0];
      const amount = Math.min(Math.round(target.maxHp * HEAL_PCT), target.maxHp - target.hp);
      target.hp += amount;
      events.push({ t: 'heal', from: actor.uid, to: target.uid, amount, hp: target.hp });
      return 0;
    }
  }

  // 장인 축성 — 같은 줄만. 다 채워져 있으면 때린다.
  if (role === '장인') {
    const amount = Math.round(effAtk(actor, ctx.aura) * SHIELD_MULT);
    const need = alive(allies).filter((u) => u.shield < amount);
    if (need.length) {
      for (const u of need) u.shield = amount;
      events.push({
        t: 'shield', from: actor.uid, amount,
        targets: need.map((u) => u.uid),
      });
      return 0;
    }
  }

  attack(actor, allies, foes, power, rng, events);
  return 0;
}

/** 한 턴 — 아군 전원 → 적 전원. 한쪽이 전멸하면 즉시 멈춘다. */
export function runTurn(state, rng = Math.random) {
  const events = [];
  if (state.result !== 'ongoing') return events;

  state.turn += 1;
  // 지구전(보상)을 골랐으면 그만큼 늦게 온다. 배수와 알림이 같은 턴을 봐야 한다.
  const delay = state.rageDelay ?? 0;
  const rage = rageMult(state.turn - delay);
  // 광폭화가 막 시작된 턴에 한 번 알린다
  if (state.turn === RAGE_AFTER + delay + 1) events.push({ t: 'rage', turn: state.turn });

  const mine = { turn: state.turn, aura: state.aura, floor: state.floor };
  const theirs = { turn: state.turn, aura: state.enemyAura, floor: state.floor };
  const cap = (v) => Math.min(buffCapAt(state.floor), v);

  for (const u of state.party) {
    if (u.hp === 0) continue;
    state.buff = cap(state.buff + act(u, state.party, state.enemies, state.buff, rage, rng, events, mine));
    if (!alive(state.enemies).length) { state.result = 'floorCleared'; return events; }
  }

  for (const u of state.enemies) {
    if (u.hp === 0) continue;
    state.enemyBuff = cap(state.enemyBuff + act(u, state.enemies, state.party, state.enemyBuff, rage, rng, events, theirs));
    if (!alive(state.party).length) { state.result = 'wiped'; return events; }
  }

  return events;
}
