// 칭호 판정. **순수 함수다** — 저장을 읽지도 쓰지도 않고, 받은 값만 본다.
//
// 조건이 비공개라 화면으로는 맞는지 확인할 방법이 없다. 순수하게 두는 것이
// 노드 테스트로 39개를 전수 검증할 수 있는 유일한 길이다.
//
// 조건은 **전부 저장된 값만** 본다. 판 요약은 recordRun 이 이미 누적에 접어 넣었다.
// 그래서 「판이 끝날 때만 판정되는 조건」이라는 게 없고, 저장이 바뀌면 언제 불러도 같다.

import { TITLES } from './catalog.js';
import { CHARACTERS } from '../data/characters.js';
import { LEVEL_CAP } from '../battle/stats.js';

const BY_ID = new Map(CHARACTERS.map((c) => [c.id, c]));

/**
 * 저장을 판정용 문맥으로 접는다. 39개가 같은 것을 39번 세지 않게 하려는 것이 절반,
 * 판정식이 저장 구조를 안 봐도 되게 하려는 것이 절반이다.
 *
 * @param {object} totals 누적 통계 (storage.getTotals)
 * @param {object} save 저장 사본 (storage.getSave)
 */
export function buildContext(totals, save) {
  const counts = { SSR: 0, SR: 0, R: 0, N: 0 };
  let ownedKinds = 0;
  let maxDup = 0;
  for (const [id, n] of Object.entries(save?.owned ?? {})) {
    const c = BY_ID.get(id);
    if (!c || !(n > 0)) continue;
    counts[c.tier] += 1;
    ownedKinds += 1;
    if (n > maxDup) maxDup = n;
  }

  // 레벨은 **가진 인물의 것만** 센다. 저장이 손으로 고쳐져 안 가진 인물에 레벨이
  // 박혀 있어도 공짜 칭호가 나오면 안 된다.
  const levelByTier = { SSR: 0, SR: 0, R: 0, N: 0 };
  let maxLevel = 0;
  for (const [id, raw] of Object.entries(save?.levels ?? {})) {
    const c = BY_ID.get(id);
    if (!c || !((save?.owned?.[id] ?? 0) > 0)) continue;
    const level = Math.min(raw, LEVEL_CAP);
    if (level > levelByTier[c.tier]) levelByTier[c.tier] = level;
    if (level > maxLevel) maxLevel = level;
  }

  const party = save?.party ?? [];
  const partyAll20 = party.length === 4 && party.every((m) =>
    ((save?.owned?.[m.id] ?? 0) > 0)
    && Math.min(save?.levels?.[m.id] ?? 0, LEVEL_CAP) >= LEVEL_CAP);

  return {
    floor: save?.bestFloor ?? 0,
    owned: ownedKinds,
    counts,
    maxDup,
    maxLevel,
    levelByTier,
    partyAll20,
    totals,
  };
}

/**
 * 지금 상태에서 **새로 딴** 칭호 id 목록.
 *
 * ⚠️ 이미 딴 것은 절대 다시 주지 않는다. 저장이 바뀔 때마다 이 함수가 도는 구조라
 * 여기가 무너지면 「준다 → 저장이 바뀐다 → 또 준다」로 무한히 돈다.
 *
 * @param {object} totals 누적 통계
 * @param {object} save 저장 사본
 * @param {string[]} owned 이미 딴 칭호 id
 * @returns {string[]}
 */
export function earn(totals, save, owned) {
  const has = new Set(owned ?? []);
  const ctx = buildContext(totals, save);
  const out = [];
  for (const t of TITLES) {
    if (has.has(t.id)) continue;
    if (t.met(ctx)) out.push(t.id);
  }
  return out;
}
