// 뽑기 화면. 단발은 카드 연출, 10연차는 5×2 격자.
// 뽑기 실행은 직접 하지 않는다 — app이 넣어준 pull()만 부른다.

import { createCard } from './card.js';
import { createResultGrid } from './result-grid.js';
import { getStats, getGold, getTickets } from '../storage.js';
import { PULL_COST } from '../economy.js';
import { CHARACTERS } from '../data/characters.js';
import { createRatesView } from './rates-view.js';
import { takeTitleNews } from '../titles/check.js';
import { titleName } from '../titles/catalog.js';
import { createDuelView } from './duel-view.js';

// 첫 화면에 띄울 예시 인물.
// 반응 테스트에서 14명 중 무엇을 모으는 게임인지 맞힌 사람이 0명이었다 —
// "역사"라는 말이 브라우저 탭 제목에만 있었기 때문이다.
// 문구로 한 번, 실물 카드로 한 번 알려준다.
const SAMPLE_ID = 'sejong';

// 진행도를 처음부터 "134명 중 0명"으로 띄우면 다 모아야 하는 숙제로 읽힌다.
// 몇 명 모은 뒤부터 전체 수를 보여준다.
const SHOW_TOTAL_AFTER = 10;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * 뽑기 전 첫 화면. 무엇을 모으는 게임인지 문구와 예시 카드로 밝힌다.
 *
 * 예시 카드는 **힌트면부터 보여주고 스스로 뒤집힌다.**
 * 예전엔 skip()으로 정답면을 열어둔 채 붙였고, 주석에 "예시에는 뒤집기가 필요 없다"고
 * 적어뒀었다. 그게 틀렸다 — 페르소나 테스트에서 세 명이 같은 곳에 걸렸다:
 *   "이미 '세종'이라고 답이 쓰여 있는데 맞혀보라고 한다. 뭘 맞히라는 건가"
 *   "맞히는 게 재밌을지가 이 게임의 전부인데, 그걸 볼 수가 없다"
 * 힌트 → 뒤집힘 → 세종. **그 뒤집기가 이 게임의 재미 그 자체다.**
 *
 * @returns {{el: HTMLElement, start: () => void}} start 는 DOM에 붙인 뒤에 부른다
 */
function buildIntro() {
  const intro = el('div', 'gacha__intro');
  intro.append(
    el('h1', 'gacha__title', '위인전'),
    // ⚠️ 이 한 줄은 장식이 아니다. 페르소나 테스트에서 14명 중 0명이 소재를 못 맞혔다 —
    // '역사 속 인물'이라는 말이 여기 없으면 뭐 하는 게임인지 아무도 모른다.
    // 이름을 '위인전'으로 바꾸면서 **모아서 싸운다**는 것도 같이 적었다(그게 이 게임의 목적이다).
    el('p', 'gacha__sub', '힌트 세 개로 역사 속 인물을 맞히고, 모아서 싸웁니다')
  );

  const sample = CHARACTERS.find((c) => c.id === SAMPLE_ID);
  if (!sample) return { el: intro, start: () => {}, card: null };

  // skillText:false — 「4턴마다 아군 전체 공격력 +25%」는 아직 뽑지도 않은 사람에게
  // 읽을 이유가 없다. 페르소나 테스트 최다 이탈 지점이었다. 이름(훈민정음)만 남긴다.
  const card = createCard(sample, { skillText: false });
  // 카드는 260×380 고정이라 그대로 두면 작은 폰에서 버튼을 밀어낸다.
  // 축소한 크기만큼 자리를 잡아주는 상자에 넣는다.
  const fit = el('div', 'gacha__sampleFit');
  fit.append(card.el);
  const box = el('div', 'gacha__sample');
  box.append(fit, el('div', 'gacha__sampleTag', '예시 · 이런 카드를 모읍니다'));
  intro.append(box);

  // 규모와 부담. 둘 다 페르소나 테스트에서 나온 자리다.
  //
  //  - "카드가 한 장뿐이라 뭐가 더 있는지 감이 안 온다" → 몇 명인지 밝힌다.
  //    ⚠️ **"134명 중 0명"으로 쓰면 안 된다.** 1차에서 그게 다 모아야 하는 숙제로 읽혀
  //    지웠던 것이고, 지우기만 하고 대체를 안 한 게 2차에 남은 지적이다.
  //    진행도가 아니라 **규모만** 말한다.
  //  - "뽑기권 200을 다 쓰면 나중에 돈 내라고 할 것 같다" → 이 게임엔 결제가 없는데
  //    화면이 그 사실을 어디에도 안 밝혔다.
  //
  // 두 말을 **한 줄에** 붙인 건 첫 화면에 줄이 늘면 "할 일이 세 개나 된다"가 되기 때문이다.
  // 사람 수는 손으로 적지 않는다 — 명단이 늘면 조용히 틀어진다.
  intro.append(el('p', 'gacha__facts',
    `${CHARACTERS.length}명이 기다립니다 · 결제는 없습니다`));

  // DOM에 붙기 전에 부르면 전환 효과가 안 걸린다 — 붙인 뒤에 부르라고 따로 뺐다.
  return { el: intro, start: () => card.reveal(), card };
}

/**
 * @param {{pull: (n: number) => Array<{character: object, isNew: boolean, count: number}>, onDone: () => void}} deps
 * @returns {{el: HTMLElement, refresh: () => void}}
 */
/**
 * 새로 딴 칭호 줄. 없으면 null.
 * **막지 않는다** — 카드를 가리면 뭘 뽑았는지 못 본다.
 */
function titleNews() {
  const news = takeTitleNews();
  if (!news.length) return null;
  const box = el('div', 'gacha__earned');
  for (const id of news) box.append(el('div', 'gacha__earnedLine', `🏅 새 칭호 · ${titleName(id)}`));
  return box;
}

/** 지금 n뽑을 낼 수 있는가. app.js의 게이트와 같은 규칙을 본다 */
function canAfford(n) {
  return getTickets() >= n || getGold() >= PULL_COST * n;
}

export function createGachaScreen({ pull, onDone }) {
  const root = el('div', 'gacha');

  // 확률 정보. 가챠는 확률을 언제든 볼 수 있어야 한다.
  const rates = createRatesView();

  const bar = el('div', 'gacha__bar');
  const progress = el('div', 'gacha__progress');
  const ratesBtn = el('button', 'gacha__rates', '확률');
  ratesBtn.type = 'button';
  ratesBtn.onclick = () => rates.open();
  bar.append(progress, ratesBtn);

  const stage = el('div', 'gacha__stage');
  const intro = buildIntro();
  stage.append(intro.el);

  const buttons = el('div', 'gacha__buttons');
  const one = el('button', 'gacha__btn', '한 장 뽑기');
  one.type = 'button';
  const ten = el('button', 'gacha__btn gacha__btn--sub', '열 장 뽑기');
  ten.type = 'button';
  // 둘이 뽑기. 코어가 「내기하자 할 거리」로 서면서 붙은 첫 지점이다.
  // 이름은 "대결"이 아니다 — 도전 탭의 전투와 헷갈린다.
  const duo = el('button', 'gacha__btn gacha__btn--sub', '둘이 뽑기');
  duo.type = 'button';
  buttons.append(one, ten, duo);

  const shortage = el('div', 'gacha__shortage', '골드가 모자랍니다. 도전 탭에서 층을 오르면 법니다.');
  shortage.hidden = true;

  root.append(bar, stage, buttons, shortage, rates.el);

  // 연출이 도는 동안 버튼을 잠근다. 연타하면 카드만 갈아엎히고 저장은 쌓여서
  // 뽑은 인물을 못 보고 지나간다.
  //
  // ⚠️ **연출 중에도 저장은 바뀐다**(뽑은 카드가 기록된다). 그 신호로 refresh가 돌면
  // 잠가둔 버튼이 도로 열려서 연타가 뚫린다. 그래서 잠금 상태를 변수로 들고
  // refresh가 그걸 존중하게 한다.
  let busy = false;
  function lock(on) {
    busy = on;
    // 잠금을 풀 때도 낼 수 없으면 잠긴 채로 둔다
    one.disabled = on || !canAfford(1);
    ten.disabled = on || !canAfford(10);
    duo.disabled = on || !canAfford(20);
  }

  // 카드를 누르면 남은 연출을 건너뛴다. 아는 인물이면 힌트를 다 볼 이유가 없다.
  // 카드 컴포넌트는 표시만 맡고, 넘기는 조작은 화면이 받는다.
  let current = null;
  stage.onclick = () => {
    if (current && !current.isDone()) current.skip();
  };

  function refresh() {
    const s = getStats();
    // 0명일 때는 아예 안 띄운다. 시작도 안 한 사람에게 0은 알려줄 게 없다.
    if (s.owned === 0) {
      progress.hidden = true;
    } else if (s.owned < SHOW_TOTAL_AFTER) {
      progress.hidden = false;
      progress.replaceChildren('모은 인물 ', el('b', null, String(s.owned)), '명');
    } else {
      progress.hidden = false;
      progress.replaceChildren(`역사 인물 ${s.total}명 중 `, el('b', null, String(s.owned)), '명');
    }

    // 뽑기권이 있으면 권을, 없으면 값을 보여준다.
    // 낼 수 없으면 버튼을 잠그고 어디서 버는지 알려준다 — 막힌 이유가 보여야 한다.
    //
    // ⚠️ **두 버튼은 반드시 같은 것을 센다 — 「드는 값」이다.**
    // 예전엔 단발이 `뽑기 (권 200)`으로 **남은 권 수**를, 열 장이 `10연차 (권 10)`으로
    // **드는 권 수**를 보여줬다. 같은 「권 N」 꼴에 뜻이 둘이라
    // 페르소나 테스트에서 두 갈래로 걸렸다 — "10연차가 무슨 말인가"와
    // "뽑기권 200이 왜 이렇게 많은가". **남은 수는 위 지갑 줄에 이미 있다.**
    const t = getTickets();
    one.textContent = t >= 1 ? '한 장 뽑기 (권 1)' : `한 장 뽑기 (${PULL_COST}골드)`;
    ten.textContent = t >= 10 ? '열 장 뽑기 (권 10)' : `열 장 뽑기 (${PULL_COST * 10}골드)`;
    duo.textContent = t >= 20 ? '둘이 뽑기 (권 20)' : `둘이 뽑기 (${PULL_COST * 20}골드)`;
    one.disabled = busy || !canAfford(1);
    ten.disabled = busy || !canAfford(10);
    duo.disabled = busy || !canAfford(20);
    shortage.hidden = canAfford(1);
  }

  one.onclick = async () => {
    lock(true);
    const entries = pull(1);
    if (!entries) { lock(false); return; }
    const card = createCard(entries[0].character);
    current = card;
    stage.replaceChildren(card.el);
    stage.dataset.skippable = 'true';
    await card.reveal();
    stage.dataset.skippable = 'false';
    // 정답을 보고 난 뒤에 붙인다. 먼저 붙이면 카드 위에 칭호가 먼저 뜬다.
    const got = titleNews();
    if (got) stage.append(got);
    refresh();
    onDone();
    lock(false);
  };

  ten.onclick = () => {
    lock(true);
    current = null;
    stage.dataset.skippable = 'false';
    const entries = pull(10);
    if (!entries) { lock(false); return; } // 충전이 없으면 아무 일도 안 일어난다
    stage.replaceChildren(createResultGrid(entries).el);
    const got = titleNews();
    if (got) stage.append(got);
    refresh();
    onDone();
    lock(false);
  };

  duo.onclick = () => {
    lock(true);
    current = null;
    stage.dataset.skippable = 'false';
    const view = createDuelView({
      pull,
      canRematch: () => canAfford(20),
      // 10장 들어올 때마다. 칭호 줄은 격자 아래에 붙는다(view가 격자를 올린 뒤 부른다).
      onPulled: () => {
        const got = titleNews();
        if (got) view.el.append(got);
        refresh();
        onDone();
      },
      // 끝/그만. 잠금을 풀면 refresh가 낼 수 있는 버튼만 연다.
      onExit: () => { lock(false); refresh(); },
    });
    stage.replaceChildren(view.el);
    view.start();
  };

  refresh();

  // 예시 카드 연출은 **DOM에 붙은 뒤에** 시작한다. 붙기 전에 부르면 전환 효과가 안 걸린다.
  // 눌러서 넘기는 것도 진짜 뽑기와 똑같이 되게 current 에 걸어둔다 —
  // 아는 인물이면 힌트 세 줄을 다 볼 이유가 없다.
  if (intro.card) {
    current = intro.card;
    stage.dataset.skippable = 'true';
    intro.start().then(() => {
      // 그 사이 진짜 뽑기가 시작됐으면 그쪽 것을 건드리면 안 된다
      if (current === intro.card) stage.dataset.skippable = 'false';
    });
  }

  return { el: root, refresh };
}
