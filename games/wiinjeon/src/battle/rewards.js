// 층 보상. 몇 층마다 셋 중 하나를 고른다.
//
// 이게 없으면 판이 그냥 흘러간다 — 편성하고 나면 죽을 때까지 할 게 없다.
// 보상은 판이 끝나면 같이 사라진다. 다음 판은 다시 맨손에서 시작한다.
//
// **쓸모없는 선택지는 아예 안 내놓는다.** 치유가 없는 파티에 "소생 1회 추가"를 내밀면
// 셋 중 하나가 죽은 칸이 되어 고르는 재미가 그만큼 줄어든다.

/** 몇 층을 깰 때마다 고르는가 */
export const REWARD_EVERY = 5;

/** 이 층을 깬 직후 보상을 고르는가 */
export const isRewardFloor = (clearedFloor) =>
  clearedFloor > 0 && clearedFloor % REWARD_EVERY === 0;

// 무한히 쌓이면 판이 안 끝난다. 실측에서 682층까지 간 판이 나왔다.
// 상한에 닿은 보상은 when이 false가 되어 후보에서 빠진다 —
// 다 찬 것을 계속 내미는 게 제일 나쁘다.
const tune = (key, fallback) => Number(globalThis.process?.env?.[key] ?? fallback);

const CAP = {
  guard: 0.4,       // 앞줄 추가 감소
  startShield: 0.45, // 층 시작 방어막
  rageDelay: 9,     // 광폭화 지연 (3번까지)
  revives: 2,       // 소생 추가
  pierce: 0.9,      // 관통 추가 피해
  // 예기·단련은 한동안 상한이 없었다. 둘 다 층수에 비례해 쌓이는데 적도 층수에 비례해
  // 세지니 언젠가 균형이 맞을 줄 알았지만, 운 좋은 판이 500층까지 갔다(400판 중 2%).
  // 사람이 30분씩 지켜보다 직접 그만두게 되는 상태라 몇 장까지만 받게 막는다.
  atkStacks: tune('ATK_STACKS', 8),
  hpStacks: tune('HP_STACKS', 8),
};

/** 이번 판에 그 보상을 몇 번 골랐는가 */
const taken = (run, id) => run.rewards.filter((r) => r.id === id).length;

const alive = (run) => run.party.filter((u) => u.hp > 0);
const hasRole = (run, role) => run.party.some((u) => u.character.role === role);
const hurt = (run) => alive(run).some((u) => u.hp < u.maxHp);

/**
 * name  — 화면에 뜨는 이름
 * text  — 무엇을 하는지
 * when  — 이 파티에 쓸모가 있는가. false면 안 내놓는다
 * apply — run을 직접 고친다
 */
export const REWARDS = [
  {
    id: 'heal',
    name: '재정비',
    text: '전원 최대 체력의 40%를 회복한다',
    when: (run) => hurt(run),
    apply: (run) => {
      for (const u of alive(run)) u.hp = Math.min(u.maxHp, u.hp + Math.round(u.maxHp * 0.4));
    },
  },
  {
    id: 'atk',
    name: '예기',
    text: '전원 공격력이 15% 오른다',
    when: (run) => taken(run, 'atk') < CAP.atkStacks,
    apply: (run) => {
      for (const u of run.party) u.bonusAtk = (u.bonusAtk ?? 0) + 0.15;
    },
  },
  {
    id: 'maxhp',
    name: '단련',
    text: '전원 최대 체력이 12% 늘고, 늘어난 만큼 회복한다',
    when: (run) => taken(run, 'maxhp') < CAP.hpStacks,
    apply: (run) => {
      for (const u of run.party) {
        // **처음 체력 기준으로 더한다.** 지금 체력에 곱하면 복리가 되어,
        // 층수에 비례(선형)해 세지는 적을 언젠가 반드시 앞지른다(실측 682층).
        const add = Math.round((u.baseMaxHp ?? u.maxHp) * 0.12);
        u.maxHp += add;
        if (u.hp > 0) u.hp += add;
      }
    },
  },
  {
    id: 'guard',
    name: '방벽',
    text: '앞줄이 받는 피해가 10% 더 줄어든다',
    // 앞줄이 아무도 없으면 아무 일도 안 일어난다
    when: (run) => alive(run).some((u) => u.front) && (run.party[0]?.guard ?? 0) < CAP.guard,
    apply: (run) => {
      for (const u of run.party) u.guard = Math.min(CAP.guard, (u.guard ?? 0) + 0.1);
    },
  },
  {
    id: 'pierce',
    name: '조준',
    text: '관통과 밀집 직격 피해가 30% 늘어난다',
    when: (run) => hasRole(run, '포격') && (run.party[0]?.pierceBonus ?? 0) < CAP.pierce,
    apply: (run) => {
      for (const u of run.party) u.pierceBonus = Math.min(CAP.pierce, (u.pierceBonus ?? 0) + 0.3);
    },
  },
  {
    id: 'revive',
    name: '구명',
    text: '치유가 쓸 수 있는 소생이 한 번 늘어난다',
    when: (run) => hasRole(run, '치유')
      && run.party.some((u) => u.character.role === '치유' && (u.bonusRevives ?? 0) < CAP.revives),
    apply: (run) => {
      for (const u of run.party) {
        if (u.character.role === '치유') u.bonusRevives = Math.min(CAP.revives, (u.bonusRevives ?? 0) + 1);
      }
    },
  },
  {
    id: 'patience',
    name: '지구전',
    text: '광폭화가 3턴 늦게 온다',
    when: (run) => (run.rageDelay ?? 0) < CAP.rageDelay,
    apply: (run) => { run.rageDelay = Math.min(CAP.rageDelay, (run.rageDelay ?? 0) + 3); },
  },
  {
    id: 'shield',
    name: '철벽',
    text: '층을 시작할 때 최대 체력 15%만큼 방어막을 두른다',
    when: (run) => (run.startShield ?? 0) < CAP.startShield,
    apply: (run) => { run.startShield = Math.min(CAP.startShield, (run.startShield ?? 0) + 0.15); },
  },
];

const BY_ID = new Map(REWARDS.map((r) => [r.id, r]));

/**
 * 고를 것 세 개. 쓸모 있는 것 중에서만 뽑는다.
 * 후보가 셋보다 적으면 있는 만큼만 준다.
 */
export function offerRewards(run, rng = Math.random, count = 3) {
  const pool = REWARDS.filter((r) => r.when(run));
  const picked = [];
  const rest = [...pool];
  while (picked.length < count && rest.length) {
    picked.push(rest.splice(Math.floor(rng() * rest.length), 1)[0]);
  }
  return picked.map(({ id, name, text }) => ({ id, name, text }));
}

/** 고른 것을 실제로 건다. 모르는 id면 아무 일도 안 한다 */
export function applyReward(run, id) {
  const reward = BY_ID.get(id);
  if (!reward) return false;
  reward.apply(run);
  run.rewards.push({ id, name: reward.name, floor: run.floor });
  return true;
}
