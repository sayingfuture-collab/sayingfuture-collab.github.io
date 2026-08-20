// 로컬 저장. 브라우저면 localStorage, 아니면(노드·시뮬레이션) 메모리로 떨어진다.
import { CHARACTERS } from './data/characters.js';
import { defaultFront, LEVEL_CAP } from './battle/stats.js';
import {
  STARTER_GOLD, STARTER_TICKETS, RECORD_GOLD, MATERIAL_PER_LEVEL,
  cardGold, upgradeCost, pullCost,
} from './economy.js';

/** key 하나에 대한 읽기/쓰기 창구를 만든다. */
export function createStore(key) {
  try {
    if (typeof localStorage !== 'undefined') {
      const probe = `${key}.probe`;
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
      return {
        get: () => localStorage.getItem(key),
        set: (v) => localStorage.setItem(key, v),
      };
    }
  } catch {
    // 사생활 보호 모드 등으로 막힌 경우 메모리로 폴백
  }
  let mem = null;
  return { get: () => mem, set: (v) => { mem = v; } };
}

// ── 도감·통계 저장 ────────────────────────────────────────────
// 초반 보정 카운트(gacha.js)와는 다른 키를 쓴다. 보정 카운트를 초기화해도
// 도감과 누적 통계는 남아야 한다.

const KEY = 'historyGacha.collection.v1';
const store = createStore(KEY);
const KNOWN = new Set(CHARACTERS.map((c) => c.id));
const BY_ID = new Map(CHARACTERS.map((c) => [c.id, c]));

const int0 = (v) => (Number.isInteger(v) && v >= 0 ? v : 0);

/**
 * 지금 형식 번호. 올리면 그 단계부터 다시 돈다.
 * **단계는 하나씩 따로 둔다** — 통째로 다시 돌리면 카드가 골드로 두 번 바뀐다.
 */
const ECONOMY_VERSION = 4;

const TIERS = ['SSR', 'SR', 'R', 'N'];
const emptyStock = () => ({ SSR: 0, SR: 0, R: 0, N: 0 });

/**
 * 레벨이 더 이상 장수로 안 오르니 한 번 갈아엎는다.
 *
 * **지키는 선: 정리한 뒤에도 자기 최고 기록만큼은 다시 갈 수 있어야 한다.**
 * 여기가 무너지면 기록을 못 깨서 갱신 보상이 안 나오고, 벌이가 통째로 막힌다.
 * 벌이가 막히면 다시 올라갈 만큼 키우는 데 수백 판이 걸린다.
 *
 * 이미 정리된 저장을 넣으면 그대로 돌려준다 — 두 번 돌면 골드가 두 배가 된다.
 */
export function migrateEconomy(raw) {
  const from = int0(raw?.economyVersion);
  if (from >= ECONOMY_VERSION) return raw;

  let out = raw ?? {};
  if (from < 1) out = toEconomy(out);
  if (from < 2) out = resetOldRecord(out);
  if (from < 4) out = rebuildStock(out);
  return { ...out, economyVersion: ECONOMY_VERSION };
}

/**
 * v4 — 재료 재고를 다시 계산한다.
 *
 * 재고는 사실 저장할 필요가 없는 값이다. 정의가 이렇기 때문이다:
 *
 *     재고(등급) = 그 등급으로 뽑은 카드 수 − 그 등급에 쓴 레벨 수
 *
 * 뽑으면 보유와 재고가 같이 1 늘고, 강화하면 재고가 1 줄고 레벨이 1 는다.
 * 그러니 보유 장수와 레벨만 있으면 재고는 언제든 되살릴 수 있다.
 *
 * 두 번 틀렸다. 처음엔 재고 만드는 코드를 v1 안에 끼워 넣어서, 이미 v1을 지난 저장이
 * 건너뛰었다. 그 다음엔 "칸이 없을 때만 메꾼다"로 고쳤는데, sanitize가 그 사이에
 * 이미 0을 만들어 저장한 뒤라 "있다"고 판단해 또 건너뛰었다.
 *
 * **있냐 없냐를 보지 않고 그냥 다시 센다.** 위 식이 참인 한 이 계산은 늘 옳고,
 * 몇 번을 돌려도 같은 값이 나온다.
 */
function rebuildStock(raw) {
  const stock = emptyStock();
  for (const [id, n] of Object.entries(raw?.owned ?? {})) {
    const c = BY_ID.get(id);
    if (!c || !Number.isFinite(n) || n <= 0) continue;
    stock[c.tier] += Math.floor(n);
  }
  for (const [id, level] of Object.entries(raw?.levels ?? {})) {
    const c = BY_ID.get(id);
    if (!c || !Number.isInteger(level) || level <= 1) continue;
    stock[c.tier] = Math.max(0, stock[c.tier] - (level - 1) * MATERIAL_PER_LEVEL);
  }
  return { ...raw, stock };
}

/**
 * v2 — 최고 기록을 지운다.
 *
 * 적 곡선에 가속 항이 붙으면서 같은 편성이 196층에서 68층으로 바뀌었다.
 * 옛 기록은 다른 자로 잰 숫자라 그대로 두면 영영 못 깨고, 그러면 갱신 보상이
 * 안 나와서 벌이가 막힌다.
 *
 * **v1에서 기록으로 받은 골드는 안 뺏는다.** 판을 안 한 게 아니라 자가 바뀐 것뿐이다.
 */
function resetOldRecord(raw) {
  return { ...raw, bestFloor: 0 };
}

/** v1 — 레벨을 장수에서 떼어내고 골드·재료·뽑기권을 만든다 */
function toEconomy(raw) {
  const owned = raw?.owned && typeof raw.owned === 'object' ? raw.owned : {};
  let gold = 0;
  const levels = {};
  const stock = emptyStock();
  for (const [id, n] of Object.entries(owned)) {
    const c = BY_ID.get(id);
    if (!c || !Number.isFinite(n) || n <= 0) continue;
    gold += cardGold(c.tier) * n;
    stock[c.tier] += Math.floor(n);
    levels[id] = 1;
  }
  // 새 규칙이 처음부터 있었다면 받았을 갱신 보상
  gold += int0(raw?.bestFloor) * RECORD_GOLD;

  return {
    ...(raw ?? {}),
    owned,
    levels,
    stock,
    gold: Math.max(Math.round(gold), STARTER_GOLD),
    tickets: Math.max(0, STARTER_TICKETS - int0(raw?.pulls)),
  };
}

/**
 * 편성 정규화. 앞뒤 배치가 생기기 전 저장은 id 문자열 배열이었다.
 * 그걸 만나면 역할 기본값으로 줄을 채워 새 형식으로 옮긴다 —
 * 이미 편성해둔 사람의 파티가 날아가면 안 된다.
 */
export function sanitizeParty(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const item of raw) {
    const id = typeof item === 'string' ? item : item?.id;
    if (typeof id !== 'string' || !KNOWN.has(id) || seen.has(id)) continue;
    seen.add(id);
    const character = BY_ID.get(id);
    // 옛 형식(문자열)이거나 front가 없으면 역할이 정하던 자리로 세운다
    const front = typeof item === 'object' && typeof item.front === 'boolean'
      ? item.front
      : defaultFront(character);
    out.push({ id, front });
    if (out.length === 4) break;
  }
  return out;
}

// 저장은 사용자가 직접 고칠 수 있다. 아는 id와 말이 되는 숫자만 남긴다.
function sanitize(raw) {
  const owned = {};
  if (raw && typeof raw.owned === 'object' && raw.owned !== null) {
    for (const [id, n] of Object.entries(raw.owned)) {
      if (KNOWN.has(id) && Number.isInteger(n) && n > 0) owned[id] = n;
    }
  }
  // 가진 카드 장수보다 뽑기 횟수가 적을 수는 없다. 저장이 손으로 고쳐졌거나
  // 깨졌을 때 통계가 음수가 되는 걸 여기서 막는다.
  const cards = Object.values(owned).reduce((a, b) => a + b, 0);
  const pulls = Math.max(int0(raw?.pulls), cards);

  // 최고 층과 편성. 편성은 아는 id만, 최대 4명.
  const bestFloor = int0(raw?.bestFloor);
  const party = sanitizeParty(raw?.party);

  // 레벨은 아는 인물의, 1 이상인 정수만 남긴다. 상한은 여기서 안 자른다 —
  // 자르는 자리는 levelOf 하나여야 나중에 상한을 바꿔도 저장이 안 깎인다.
  const levels = {};
  if (raw?.levels && typeof raw.levels === 'object') {
    for (const [id, n] of Object.entries(raw.levels)) {
      if (KNOWN.has(id) && Number.isInteger(n) && n >= 1) levels[id] = n;
    }
  }

  // 재료 재고. 도감의 '보유 N장'과 다른 값이다 — 그쪽은 모은 기록이라 안 줄고,
  // 이쪽은 강화에 쓰면 준다.
  const stock = emptyStock();
  if (raw?.stock && typeof raw.stock === 'object') {
    for (const t of TIERS) stock[t] = int0(raw.stock[t]);
  }

  return {
    owned, pulls, bestFloor, party, levels, stock,
    gold: int0(raw?.gold),
    tickets: int0(raw?.tickets),
    economyVersion: int0(raw?.economyVersion),
  };
}

function read() {
  try {
    const raw = store.get();
    return sanitize(migrateEconomy(raw ? JSON.parse(raw) : null));
  } catch {
    // 깨진 저장은 빈 상태로. 필드를 직접 나열하면 새 필드가 늘 때마다 빠뜨린다.
    return sanitize(migrateEconomy(null));
  }
}

let state = read();

// 저장이 바뀌면 알려준다.
//
// 처음에는 골드가 바뀌는 자리마다 화면 갱신을 손으로 불렀는데, 강화와 전투 보상에서
// 빠뜨려서 지갑이 옛 숫자를 그대로 들고 있었다. 쓴 사람은 얼마 남았는지 모른 채로
// 계속 눌렀다. 부르는 자리를 세는 방식은 새 기능이 늘 때마다 또 빠진다.
const listeners = new Set();

/** 저장이 바뀔 때마다 부른다. @returns {() => void} 끊는 함수 */
export function onSaveChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function write() {
  try { store.set(JSON.stringify(state)); } catch { /* 저장 실패해도 진행은 시킨다 */ }
  for (const fn of listeners) fn();
}

// 정리 결과를 바로 남긴다. 안 그러면 새로고침마다 다시 계산한다.
write();

/** 뽑은 인물을 기록한다. @returns {{isNew: boolean, count: number, pulls: number}} */
export function recordPull(character) {
  const id = character.id;
  const before = state.owned[id] || 0;
  state.owned[id] = before + 1;
  if (before === 0) state.levels[id] = 1; // 첫 장은 1렙으로 들어온다
  state.pulls += 1;
  state.gold += cardGold(character.tier);
  state.stock[character.tier] = (state.stock[character.tier] ?? 0) + 1;
  write();
  return { isNew: before === 0, count: state.owned[id], pulls: state.pulls };
}

/** 그 인물을 몇 장 가졌는지. 없으면 0 */
export function countOf(id) {
  return state.owned[id] || 0;
}

export function isOwned(id) {
  return countOf(id) > 0;
}

/**
 * 전투에 들어가는 레벨. 안 가진 인물은 0.
 * 도감의 '보유 N장'과는 다른 값이다 — 그쪽은 모은 기록이고, 이제 힘이 아니다.
 *
 * **상한을 자르는 자리는 여기 하나뿐이다** — statsOf에서 자르면 적 레벨까지 막혀
 * 어느 층부터 판이 안 끝난다.
 */
export function levelOf(id) {
  if (!countOf(id)) return 0;
  return Math.min(state.levels[id] ?? 1, LEVEL_CAP);
}

/** 더 올릴 수 없는 상태인가 */
export function isMaxLevel(id) {
  return levelOf(id) >= LEVEL_CAP;
}

// ── 골드와 뽑기권 ─────────────────────────────────────────────

export function getGold() { return state.gold; }
export function getTickets() { return state.tickets; }

export function addGold(n) {
  state.gold += Math.max(0, Math.round(n));
  write();
}

/**
 * 뽑기 값을 낸다. 뽑기권이 있으면 권이 먼저 나간다.
 * 못 내면 아무것도 안 건드리고 false — 반쯤 낸 상태가 남으면 안 된다.
 */
export function spendPull(n) {
  if (state.tickets >= n) {
    state.tickets -= n;
    write();
    return true;
  }
  const cost = pullCost(n);
  if (state.gold < cost) return false;
  state.gold -= cost;
  write();
  return true;
}

/** 그 등급 재료가 몇 장 남았는가 */
export function getStock(tier) {
  return state.stock[tier] ?? 0;
}

/**
 * 지금 강화할 수 있는지, 못 하면 왜 못 하는지.
 * 이유를 나눠 주는 이유는 화면이 "골드가 모자랍니다"와 "SSR 카드가 모자랍니다"를
 * 구분해서 말해야 하기 때문이다 — 뭘 하러 가야 하는지가 다르다.
 *
 * @returns {{ok: boolean, reason: 'none'|'max'|'gold'|'material', cost: number, need: number}}
 */
export function upgradeCheck(id) {
  const level = levelOf(id);
  const cost = level > 0 ? upgradeCost(level) : 0;
  const need = MATERIAL_PER_LEVEL;
  if (level === 0) return { ok: false, reason: 'none', cost, need };
  if (level >= LEVEL_CAP) return { ok: false, reason: 'max', cost, need };
  if (getStock(BY_ID.get(id).tier) < need) return { ok: false, reason: 'material', cost, need };
  if (state.gold < cost) return { ok: false, reason: 'gold', cost, need };
  return { ok: true, reason: 'none', cost, need };
}

/** 지금 그 인물을 강화할 수 있는가 */
export function canUpgrade(id) {
  return upgradeCheck(id).ok;
}

/** 같은 등급 카드 1장과 골드를 내고 레벨을 1 올린다. 못 하면 false */
export function upgrade(id) {
  const check = upgradeCheck(id);
  if (!check.ok) return false;
  const level = levelOf(id);
  state.gold -= check.cost;
  state.stock[BY_ID.get(id).tier] -= check.need;
  state.levels[id] = level + 1;
  write();
  return true;
}

/** 도감 진행도와 누적 통계 */
export function getStats() {
  const owned = Object.keys(state.owned).length;
  return {
    owned,                       // 획득한 종류 수
    total: CHARACTERS.length,    // 전체 인물 수
    pulls: state.pulls,          // 총 뽑기 횟수 (통계용)
    duplicates: state.pulls - owned,
  };
}

// ── 도전 기록과 편성 ──────────────────────────────────────────

export function getBestFloor() {
  return state.bestFloor;
}

/** 기록을 갱신했으면 true */
export function setBestFloor(n) {
  if (!Number.isInteger(n) || n <= state.bestFloor) return false;
  state.bestFloor = n;
  write();
  return true;
}

/** 편성. `[{ id, front }]` 최대 4명. front가 true면 앞줄. */
export function getParty() {
  return state.party.map((m) => ({ ...m }));
}

/** @param {Array<{id: string, front: boolean}|string>} members */
export function setParty(members) {
  state.party = sanitizeParty(members);
  write();
}

/** 저장 내용 사본. 읽기 전용으로 쓸 것 */
export function getSave() {
  return {
    owned: { ...state.owned }, levels: { ...state.levels }, stock: { ...state.stock },
    pulls: state.pulls, gold: state.gold, tickets: state.tickets,
    bestFloor: state.bestFloor, party: state.party.map((m) => ({ ...m })),
    economyVersion: state.economyVersion,
  };
}

export function resetCollection() {
  state = sanitize(migrateEconomy(null));
  write();
}
