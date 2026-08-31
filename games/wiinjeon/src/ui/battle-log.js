// 이벤트 하나를 사람이 읽는 한 줄로. 화면을 안 쓰는 순수 함수라 노드에서 확인할 수 있다.
//
// 전장 안에 두면 검증할 방법이 브라우저를 눈으로 보는 것뿐인데,
// 깊은 층까지 가야 나오는 문구(관통·도발·소생)는 그 방법으로는 확인이 안 된다.

// 역할 기술이 걸린 공격은 그렇다고 말해준다. 안 그러면 왜 뒷줄이 맞았는지 모른다.
export const VIA_LABEL = {
  pierce: '관통',
  guard: '도발',
  massed: '밀집 직격',
  // 앞줄이 하나도 없어서 그냥 노출된 상태. **왜 크게 맞았는지 로그로 보여야**
  // 「한 명은 앞에 세운다」를 스스로 알아챈다.
  // 앞줄이 두꺼워 관통이 막혔다. **왜 뒷줄이 안 맞았는지** 보여야 앞줄의 값이 읽힌다
  blocked: '가로막힘',
  // 앞줄이 얇아 공격이 뒤로 샌 것. 앞줄이 하나면 확률이 **45%** 인데
  // 예전에는 화면에 아무 표시가 없어서, 뒷줄이 왜 맞았는지 알 방법이 없었다.
  leak: '뒤로 샘',
};

/** 앞줄이 하나도 없어 30% 더 맞았다. via 와 겹칠 수 있어 따로 붙인다 */
const EXPOSED_LABEL = '무방비';

/**
 * @param {object} e 엔진이 뱉은 이벤트
 * @param {(uid: string) => string} nameOf uid → 이름
 * @returns {string} 빈 문자열이면 표시하지 않는다
 */
export function describeEvent(e, nameOf) {
  const n = (uid) => nameOf(uid) ?? '?';
  // 고유기로 나온 것은 기술 이름을 앞에 붙인다. 뽑은 보람이 로그에서도 보여야 한다.
  const by = e.skill ? `《${e.skill}》 ` : '';

  switch (e.t) {
    case 'skill': return `✦ ${n(e.from)} — 《${e.name}》`;
    case 'attack': {
      const marks = [];
      if (e.via) marks.push(VIA_LABEL[e.via] ?? e.via);
      if (e.exposed) marks.push(EXPOSED_LABEL);
      const tag = marks.length ? ` [${marks.join('·')}]` : '';
      return `${by}${n(e.from)} → ${n(e.to)}${tag}  ${e.dmg}`;
    }
    case 'aoeHit': {
      const total = e.hits.reduce((a, h) => a + h.dmg, 0);
      return `《${e.name}》 ${n(e.from)} — 적 ${e.hits.length}명에게 ${total}`;
    }
    case 'aoeHeal': {
      const total = e.heals.reduce((a, h) => a + h.amount, 0);
      return `《${e.name}》 ${n(e.from)} — 아군 ${e.heals.length}명 회복 ${total}`;
    }
    case 'weaken': return `《${e.skill}》 ${n(e.from)} — 적 전체 공격력 -${e.pct}%`;
    case 'heal': return `${by}${n(e.from)}가 ${n(e.to)} 회복 ${e.amount}`;
    case 'revive': return `${n(e.from)} — ${n(e.to)} 소생!`;
    case 'buff': return `${by}${n(e.from)} — 아군 공격력 +${e.pct}%`;
    case 'shield': return `${by}${n(e.from)} — 아군에 방어막 ${e.amount}`;
    case 'die': return `${n(e.who)} 쓰러짐`;
    case 'rage': return '⚡ 광폭화 — 이제부터 피해가 계속 커집니다';
    default: return '';
  }
}
