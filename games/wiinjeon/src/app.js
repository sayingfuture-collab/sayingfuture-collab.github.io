// 앱 조립. 탭 전환과 뽑기 게이트를 맡는다.
import { draw } from './gacha.js';
import { recordPull, spendPull, getGold, getTickets, onSaveChange, noteTenPull } from './storage.js';
import { checkTitles, takeTitleNews } from './titles/check.js';
import { pendingGift } from './gifts.js';
import { getGiftsTaken } from './storage.js';
import { showGiftScroll } from './ui/gift-scroll.js';
// 개발자용 치트. 지우려면 이 줄과 아래 installCheat 한 줄만 지우면 된다.
import { installCheat } from './cheat.js';
import { createGachaScreen } from './ui/screen-gacha.js';
import { createCollection } from './ui/collection.js';
import { createBattleScreen } from './ui/screen-battle.js';
import { createTitlesScreen } from './ui/screen-titles.js';
import { createTowersScreen } from './ui/screen-towers.js';

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
  // 탑을 고르면 전투 화면으로 넘긴다. **편성 화면을 두 벌 두지 않으려는 것이다.**
  // 전투 중이면 setTower 가 false 를 돌려주고, 그때는 탭도 안 옮긴다 —
  // 판이 도는 중에 넘기면 화면만 바뀌고 도전은 옛 탑 그대로라 거짓말이 된다.
  const towers = createTowersScreen({
    onPick: (tower) => { if (battle.setTower(tower)) showTab('screen-battle'); },
  });

  document.getElementById('screen-gacha').append(gacha.el);
  document.getElementById('screen-battle').append(battle.el);
  document.getElementById('screen-book').append(book.el);
  document.getElementById('screen-towers').append(towers.el);
  document.getElementById('screen-titles').append(titles.el);

  // 탭 전환. 연출 중에도 막지 않는다 — 돌아오면 카드는 그 자리에 있다.
  const tabs = [
    { btn: document.getElementById('tab-gacha'), screen: document.getElementById('screen-gacha') },
    { btn: document.getElementById('tab-book'), screen: document.getElementById('screen-book') },
    { btn: document.getElementById('tab-battle'), screen: document.getElementById('screen-battle') },
    { btn: document.getElementById('tab-towers'), screen: document.getElementById('screen-towers') },
    { btn: document.getElementById('tab-titles'), screen: document.getElementById('screen-titles') },
  ];

  /** 탭 하나를 연다. 탑 목록에서 전투로 넘길 때도 이걸 쓴다 */
  function showTab(screenId) {
    for (const x of tabs) {
      const on = x.screen.id === screenId;
      x.btn.setAttribute('aria-selected', String(on));
      x.screen.hidden = !on;
    }
    if (screenId === 'screen-battle') battle.refresh();
    if (screenId === 'screen-towers') towers.refresh();
    if (screenId === 'screen-titles') titles.refresh();
  }

  for (const t of tabs) t.btn.onclick = () => showTab(t.screen.id);

  // 골드가 바뀌는 자리를 세지 않는다 — 저장이 바뀌면 무조건 다시 그린다.
  //
  // ⚠️ **지갑만 다시 그리면 안 된다.** 예전엔 여기가 refreshPurse 하나였는데,
  // 그래서 전투로 골드를 벌고 뽑기 탭에 와도 뽑기 버튼은 옛 상태 그대로였다.
  // 「10연차(300골드)」가 잠긴 채로 남아 있다가, 1뽑을 하고 나서야
  // (그때 화면이 스스로 refresh 를 부른다) 갑자기 열렸다.
  // 지갑 숫자는 늘었는데 버튼은 안 열리니 고장으로 보인다 — 실제로 고장이었다.
  onSaveChange(() => { checkTitles(); refreshPurse(); gacha.refresh(); titles.refresh(); towers.refresh(); });
  refreshPurse();

  // 저장을 읽자마자 한 번. v5 로 갓 올라온 사람이 이미 채운 조건
  // (수집·레벨·최고층)을 여기서 딴다 — 소급 지급은 안 하지만 조건은 조건이다.
  checkTitles();
  // ⚠️ **그 결과를 알림으로 띄우지는 않는다.** 판을 하나도 안 했는데 축포가
  // 열두 개 터지면 뭘 해서 땄는지 알 수가 없다. 칭호 탭에서 보면 된다.
  takeTitleNews();

  // 개발자용 치트. 지갑을 두드리는 쪽도 같이 걸어준다(폰에는 키보드가 없다).
  installCheat(purse);

  // ── 선물 두루마리 ──
  // **맨 마지막에 띄운다.** 앞의 배선(지갑·칭호 검사)이 다 끝난 뒤라야
  // 「받기」를 누른 순간 지갑 숫자가 같이 움직인다.
  // 안 받고 창을 닫으면 다음 접속에 또 뜬다 — 받아야만 기록되기 때문이다.
  const gift = pendingGift(getGiftsTaken());
  if (gift) showGiftScroll(gift);
}
