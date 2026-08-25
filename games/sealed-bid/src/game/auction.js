// 봉인 입찰 해소. 순수 함수 — UI도 AI도 여기를 거친다.
//
// 규칙: 전 매물 동시 일괄 봉인, 1등가(쓴 만큼 낸다), 최소 1골드, 0은 불참.
// 동점은 생명이 낮은 쪽이 이긴다("절박한 자가 이긴다" — 패자 구제이자 결정적 규칙),
// 생명까지 같으면 rng. 전원 불참 매물은 소멸한다(재등장 없음 — 상태를 단순하게).

import { ECON } from './economy.js';

/**
 * @param {Array<{lotId: string, merc: object}>} lots
 * @param {Record<string, Record<string, number>>} bids  bids[pid][lotId] = 골드
 * @param {Array<{id: string, gold: number, lives: number}>} participants
 * @param {() => number} rng
 * @returns {{awards: Array<{lotId, merc, winnerId, price}>, unsold: string[], spent: Record<string, number>}}
 */
export function resolve(lots, bids, participants, rng) {
  const byId = new Map(participants.map((p) => [p.id, p]));

  // 배분 합이 소지금을 넘는 입찰은 통째로 거부한다. UI가 막고 AI가 clamp하므로
  // 여기 걸리면 버그다 — 조용히 줄여서 가리지 않는다.
  for (const [pid, sheet] of Object.entries(bids)) {
    const total = Object.values(sheet).reduce((a, b) => a + b, 0);
    const p = byId.get(pid);
    if (!p) throw new Error(`모르는 참가자: ${pid}`);
    if (total > p.gold) throw new Error(`소지금 초과 입찰: ${pid} (${total} > ${p.gold})`);
    for (const amt of Object.values(sheet)) {
      if (!Number.isInteger(amt) || amt < 0) throw new Error(`잘못된 입찰액: ${pid} ${amt}`);
    }
  }

  const awards = [];
  const unsold = [];
  const spent = Object.fromEntries(participants.map((p) => [p.id, 0]));

  for (const lot of lots) {
    let best = null; // {pid, amt}
    for (const p of participants) {
      const amt = bids[p.id]?.[lot.lotId] ?? 0;
      if (amt < ECON.MIN_BID) continue;
      if (!best || amt > best.amt) { best = { pid: p.id, amt }; continue; }
      if (amt === best.amt) {
        const a = byId.get(p.id); const b = byId.get(best.pid);
        if (a.lives < b.lives) best = { pid: p.id, amt };
        else if (a.lives === b.lives && rng() < 0.5) best = { pid: p.id, amt };
      }
    }
    if (!best) { unsold.push(lot.lotId); continue; }
    awards.push({ lotId: lot.lotId, merc: lot.merc, winnerId: best.pid, price: best.amt });
    spent[best.pid] += best.amt;
  }

  return { awards, unsold, spent };
}
