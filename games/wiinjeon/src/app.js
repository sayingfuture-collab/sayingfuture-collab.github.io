// 앱 조립. 탭 전환과 뽑기 게이트를 맡는다.
import { draw } from './gacha.js';
import { recordPull, spendPull, getGold, getTickets, onSaveChange, noteTenPull } from './storage.js';
import { checkTitles, takeTitleNews } from './titles/check.js';
import { createGachaScreen } from './ui/screen-gacha.js';
import { createCollection } from './ui/collection.js';
import { createBattleScreen } from './ui/screen-battle.js';
import { createTitlesScreen } from './ui/screen-titles.js';

if (location.protocol !== 'file:') {
  // ── 뽑기 게이트 ──
  // 뽑아도 되는지 판단하는 곳은 여기 하나뿐이다. 화면은 결과만 받는다.
  //
  // 뽑기권이 있으면 권이 먼저 나가고, 없으면 골드를 낸다.
  // 예전에는 단발 10번으로 10연차를 충전하는 방식이었는데, 골드가 들어오면서
  // 조절 장치가 둘이 되어 "골드는 있는데 왜 10연차가 안 되지"가 된다. 그래서 걷어냈다.
  /** @returns {Array<{character, isNew, count}>|null} 못 뽑으면 null */
  function pull(n) {
    if (!spendPull(n)) return null;

    const out = [];
    for (let i = 0; i < n; i++) {
      const character = draw();
      const { isNew, count } = recordPull(character);
      out.push({ character, isNew, count });
    }
    // 「쓸어담기」— 10연차 한 번에 SSR 2명. 여기서 안 세면 영영 못 딴다.
    if (n === 10) noteTenPull(out.filter((e) => e.character.tier === 'SSR').length);
    return out;
  }

  // ── 지갑 ──
  // 얼마 있는지 늘 보여야 강화도 뽑기도 판단이 선다.
  const purse = document.getElementById('purse');

  function node(tag, text) {
    const n = document.createElement(tag);
    n.textContent = text;
    return n;
  }

  function refreshPurse() {
    const t = getTickets();
    purse.replaceChildren(node('b', `${getGold().toLocaleString()} G`));
    if (t > 0) purse.append(node('span', `뽑기권 ${t}`));
  }

  const book = createCollection();
  // 도감 갱신은 공개가 끝난 뒤에만 한다. 먼저 갱신하면 힌트가 나오는 동안
  // 도감 탭으로 넘어가서 정답을 미리 볼 수 있다.
  const gacha = createGachaScreen({ pull, onDone: () => book.refresh() });

  const battle = createBattleScreen();
  const titles = createTitlesScreen();

  document.getElementById('screen-gacha').append(gacha.el);
  document.getElementById('screen-battle').append(battle.el);
  document.getElementById('screen-book').append(book.el);
  document.getElementById('screen-titles').append(titles.el);

  // 탭 전환. 연출 중에도 막지 않는다 — 돌아오면 카드는 그 자리에 있다.
  const tabs = [
    { btn: document.getElementById('tab-gacha'), screen: document.getElementById('screen-gacha') },
    { btn: document.getElementById('tab-book'), screen: document.getElementById('screen-book') },
    { btn: document.getElementById('tab-battle'), screen: document.getElementById('screen-battle') },
    { btn: document.getElementById('tab-titles'), screen: document.getElementById('screen-titles') },
  ];

  for (const t of tabs) {
    t.btn.onclick = () => {
      for (const x of tabs) {
        const on = x === t;
        x.btn.setAttribute('aria-selected', String(on));
        x.screen.hidden = !on;
      }
      if (t.screen.id === 'screen-battle') battle.refresh();
      if (t.screen.id === 'screen-titles') titles.refresh();
    };
  }

  // 골드가 바뀌는 자리를 세지 않는다 — 저장이 바뀌면 무조건 다시 그린다.
  //
  // ⚠️ **지갑만 다시 그리면 안 된다.** 예전엔 여기가 refreshPurse 하나였는데,
  // 그래서 전투로 골드를 벌고 뽑기 탭에 와도 뽑기 버튼은 옛 상태 그대로였다.
  // 「10연차(300골드)」가 잠긴 채로 남아 있다가, 1뽑을 하고 나서야
  // (그때 화면이 스스로 refresh 를 부른다) 갑자기 열렸다.
  // 지갑 숫자는 늘었는데 버튼은 안 열리니 고장으로 보인다 — 실제로 고장이었다.
  onSaveChange(() => { checkTitles(); refreshPurse(); gacha.refresh(); titles.refresh(); });
  refreshPurse();

  // 저장을 읽자마자 한 번. v5 로 갓 올라온 사람이 이미 채운 조건
  // (수집·레벨·최고층)을 여기서 딴다 — 소급 지급은 안 하지만 조건은 조건이다.
  checkTitles();
  // ⚠️ **그 결과를 알림으로 띄우지는 않는다.** 판을 하나도 안 했는데 축포가
  // 열두 개 터지면 뭘 해서 땄는지 알 수가 없다. 칭호 탭에서 보면 된다.
  takeTitleNews();
}
