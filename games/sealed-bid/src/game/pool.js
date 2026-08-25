// 용병 풀 34명. characters.js의 스탯 골격(id/tier/role)을 빌리고 이름만 용병으로 덮어쓴다.
// 도트도 위인 것을 임시로 쓴다 — 프로토타입의 목적은 경매의 재미 검증이지 아트가 아니다.
//
// 구성: 전사8 · 포격7 · 지휘7 · 치유6 · 장인6 = 34 (N4 / R18 / SR8 / SSR4)
// 밸런스에서 문제 유닛이 나오면 코드 수정 없이 이 명단에서 뺀다.
// SSR을 6→4로 줄였다 — 6이면 참가자 4인 거의 전원이 SSR을 들게 돼 희소성이 사라졌다(200판 실측).

import { CHARACTERS } from '../data/characters.js';
import { ECON, lotCount } from './economy.js';

// [원본 id, 용병명] — 이름은 역할·티어 분위기만 맞춘 콜사인이다.
const MERCS = [
  // 전사 8
  ['spear', '신참 톨보'], ['spartacus', '사슬끊기 바로크'], ['leonidas', '방패벽 오르도'],
  ['elcid', '떠돌이 백검'], ['hanni', '코끼리몰이 한'], ['musashi', '쌍검 무영'],
  ['kimyusin', '맹약의 유신'], ['guanyu', '적수염 대장군'],
  // 포격 7
  ['kepler', '별점쟁이 케플'], ['pythagoras', '삼각 노포수'], ['choimuseon', '화통장이 무선'],
  ['zhenghe', '함포 제독'], ['galileo', '망원경 갈보'], ['archimedes', '지렛대 광인'],
  ['napo', '포병황제 나포'],
  // 지휘 7
  ['drummer', '북치기 꼬마'], ['sunzi', '병법서 손가'], ['augustus', '존엄자 옥타브'],
  ['cyrus', '관용왕 키루'], ['caesar', '주사위 카이'], ['hwangjini', '달빛 진이'],
  ['khan', '초원의 대칸'],
  // 치유 6
  ['cook', '국자 아줌마'], ['saladin', '자비의 살라'], ['ibnsina', '약장수 시나'],
  ['xuanzang', '서역 순례자'], ['heojun', '동의보감 준'], ['mencius', '어진 맹로'],
  // 장인 6
  ['mason', '돌쌓기 영감'], ['gutenberg', '활자장이 구텐'], ['magellan', '지구돌이 마젤'],
  ['kimmandeok', '객주 만덕'], ['michelangelo', '끌잡이 미켈'], ['davinci', '만능공 다빈'],
];

const byId = new Map(CHARACTERS.map((c) => [c.id, c]));

/** 용병 = 원본 인물의 스탯 골격 + 용병명. 전투 엔진은 role/tier/id만 읽으므로 name 교체는 안전하다. */
export const POOL = MERCS.map(([id, name]) => {
  const base = byId.get(id);
  if (!base) throw new Error(`풀에 없는 인물: ${id}`);
  return { ...base, name, realName: base.name };
});

const poolById = new Map(POOL.map((c) => [c.id, c]));
export const mercOf = (id) => poolById.get(id);

/**
 * 라운드 매물 뽑기. remaining(아직 시장에 안 나온 id 집합)에서 소모식으로 뽑는다 —
 * 뽑은 것을 빼는 방식이라 고정 rng에서도 반드시 끝난다(enemy.js와 같은 이유).
 *
 * SSR 확정 라운드(4/8/11)에는 SSR 1명을 먼저 박는다. 남은 SSR이 없으면 그냥 진행.
 * legacy(탈락자 유산 매물)가 있으면 매물 수를 채우는 데 먼저 쓴다.
 *
 * 암시장 라운드(opts.blackMarket)에는 SSR을 빼고 뽑는다 — 티어를 못 보는 채로
 * SSR 보유 상한(2명)을 어기는 사고를 원천 차단한다. 유산 매물도 안 태운다(정체가 이미 알려진 용병이라).
 *
 * @returns {Array<object>} 매물 인물 배열 (remaining/legacy에서 제거됨)
 */
export function drawLots(remaining, round, rng, legacy = [], opts = {}) {
  const count = lotCount(round, rng);
  const lots = [];

  if (!opts.blackMarket) {
    while (legacy.length && lots.length < count) {
      lots.push(legacy.shift());
    }
  }

  const take = (ids) => {
    const arr = [...ids];
    const picked = arr[Math.floor(rng() * arr.length)];
    remaining.delete(picked);
    return poolById.get(picked);
  };

  if (!opts.blackMarket && ECON.SSR_ROUNDS.includes(round) && lots.length < count) {
    const ssrs = [...remaining].filter((id) => poolById.get(id).tier === 'SSR');
    if (ssrs.length) lots.push(take(ssrs));
  }
  const eligible = () => (opts.blackMarket
    ? [...remaining].filter((id) => poolById.get(id).tier !== 'SSR')
    : [...remaining]);
  while (lots.length < count && eligible().length) lots.push(take(eligible()));

  return lots;
}
