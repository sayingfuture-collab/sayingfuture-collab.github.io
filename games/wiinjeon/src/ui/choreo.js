// 역할마다 다르게 싸우는 법.
//
// 지금까지는 전사도 포격도 치유도 **똑같이 15px 앞으로 갔다 왔다.** 역할이 다섯인데
// 화면에서는 하나였다. 여기서 역할을 몸짓으로 옮긴다.
//
// ⚠️ **인물마다 짜지 않는다.** 조사에 따르면 무기 한 종류의 완성된 동작 세트가
//    60~100개다. 134명을 따로 짜는 건 애초에 불가능하고, 필요도 없다 —
//    역할은 이미 데이터에 있고(지휘 43 · 장인 40 · 전사 23 · 치유 15 · 포격 13)
//    싸우는 방식이 갈리는 것도 딱 그 다섯이다.
//
// 화면을 안 쓰는 순수 함수만 둔다. 전장은 이 계획을 받아서 실행하기만 한다 —
// 그래야 노드에서 확인할 수 있다(tests/choreo.test.js).

/** 역할 → 공격 문법 */
export const GRAMMAR = {
  전사: 'dash',   // 적 앞까지 달려가 벤다
  포격: 'arc',    // 제자리에서 포탄을 포물선으로 쏜다
  지휘: 'wave',   // 반 보 나서며 충격파를 밀어 보낸다
  장인: 'bolt',   // 기물을 직선으로 날린다
  치유: 'beam',   // 대상 위로 빛기둥이 내려온다
};

/** 역할을 모르는 인물(적 잡졸 등)은 달려든다 — 제일 안 어색한 기본값 */
export const DEFAULT_GRAMMAR = 'dash';

export function grammarOf(character) {
  return GRAMMAR[character?.role] ?? DEFAULT_GRAMMAR;
}

/**
 * 배속별 연출 등급.
 *
 * ×8이면 한 번 행동이 **42ms**다. 달려갔다 오는 연출은 아무리 줄여도 300ms라
 * 물리적으로 안 들어간다 — 늘리면 다음 이벤트가 이전 동작을 자른다.
 *
 * ×8은 **이미 깬 층을 넘기려고** 쓴다(116층 한 판이 ×1로 16분 36초, 그중 84%가
 * 재방문이다 — fight-view.js 주석에 실측이 있다). 볼 필요가 없는 게 맞다.
 */
export function gradeOf(speed) {
  if (speed <= 1) return 'full';
  if (speed <= 2) return 'short';
  return 'flat';
}

/**
 * 등급마다 무엇을 얼마나 하는가.
 *
 *   travel  이동 거리 배수 (0이면 제자리에서 예전처럼 까딱한다)
 *   hitstop 명중 순간 멈춤(ms). 「때렸다」를 만드는 건 이것 하나다
 *   shake   화면 흔들림 배수
 *   fx      참격·포탄 같은 이펙트를 띄우는가
 */
export const GRADE = {
  full:  { travel: 1, hitstop: 80, shake: 1, fx: true },
  short: { travel: 0.45, hitstop: 0, shake: 0.5, fx: true },
  flat:  { travel: 0, hitstop: 0, shake: 0, fx: false },
};

/**
 * 적 앞에서 남기는 간격(전장 폭의 %).
 *
 * 처음엔 「거리의 82%까지 간다」로 잡았는데, 그러면 **적 진영 한가운데로 파고들어**
 * 셋이 뒤엉키고 이름표가 겹쳐 아무것도 안 읽혔다(실제 화면에서 항우가 뉴턴과 관우
 * 사이에 끼었다). 비율이 아니라 **고정 간격**으로 두면 멀든 가깝든 앞에 선다.
 */
export const STOP_GAP = 16;
/** 아주 가까운 적에게는 고정 간격이 거리보다 커진다. 그때는 거리의 이만큼만 간다 */
export const STOP_RATIO = 0.35;

/**
 * 공격 하나를 어떻게 그릴지 정한다.
 *
 * @param {object} p
 * @param {string} p.grammar dash | arc | wave | bolt | beam
 * @param {string} p.grade full | short | flat
 * @param {{x:number,y:number}} p.from 때리는 쪽 자리(%)
 * @param {{x:number,y:number}} p.to 맞는 쪽 자리(%)
 * @param {number} p.beat 이 이벤트에 주어진 시간(ms). 여기 안에서 끝나야 한다
 * @returns {{move:{x:number,y:number}|null, fx:string|null,
 *            travelMs:number, impactMs:number, backMs:number,
 *            hitstop:number, shake:number}}
 */
export function planAttack({ grammar, grade, from, to, beat }) {
  const g = GRADE[grade];
  if (!g) throw new Error(`모르는 연출 등급: ${grade}`);

  // 이동·복귀·여유를 beat 안에 나눠 담는다. 넘치면 다음 이벤트가 동작을 자른다.
  const travelMs = Math.round(beat * 0.34);
  const backMs = Math.round(beat * 0.3);
  const impactMs = travelMs;

  const base = { move: null, fx: null, travelMs, impactMs, backMs, hitstop: g.hitstop, shake: g.shake };

  // 간략 등급에서는 이동도 이펙트도 없다. 예전 그대로 까딱하고 만다
  if (grade === 'flat') return { ...base, travelMs: 0, impactMs: 0, backMs: 0 };

  if (grammar === 'dash') {
    const dx = to.x - from.x;
    const gap = Math.sign(dx) * Math.min(Math.abs(dx) * STOP_RATIO, STOP_GAP);
    return {
      ...base,
      move: {
        x: (dx - gap) * g.travel,
        // 세로는 끝까지 맞춘다 — 위아래로 어긋나 있으면 옆구리를 때리는 그림이 된다
        y: (to.y - from.y) * g.travel,
      },
      fx: g.fx ? 'slash' : null,
    };
  }

  // 나머지는 제자리에서 무언가를 보낸다. 날아가는 시간이 곧 닿는 시간이다
  const FX = { arc: 'shell', bolt: 'bolt', wave: 'wave', beam: 'beam' };
  return { ...base, move: null, fx: g.fx ? (FX[grammar] ?? null) : null, backMs: 0 };
}
