// 도감 — 빈 실루엣 슬롯을 일부러 보여준다 (Zeigarnik: 미완성이 다음 판의 이유).
// 3단계: 못 봄(실루엣 ?) → 목격(회색 + "도망갔다") → 소유(★1~3).
import { VERBS, FAMILY_NAME } from '../data.js';
import { getDex, ownedCount, dexTotal, isTrained, trainedCount } from '../store.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export function createDexView({ onBack }) {
  const root = el('div', 'dex');

  function render() {
    const dex = getDex();
    root.innerHTML = '';
    root.append(el('h2', null, '📖 동사 도감'));
    root.append(el('div', 'dex__count',
      `${ownedCount()} / ${dexTotal()} 마리 · 🧠 각인 ${trainedCount()}마리`));

    for (const family of ['be', 'act']) {
      root.append(el('h3', null, FAMILY_NAME[family]));
      const grid = el('div', 'dex__grid');
      for (const v of VERBS.filter((x) => x.family === family)) {
        const d = dex[v.lemma];
        const card = el('div', 'dexcard');
        if (d && d.stars > 0) {
          card.append(el('div', 'emo', v.emoji));
          card.append(el('div', 'nm', v.lemma));
          card.append(el('div', 'ko', v.ko));
          card.append(el('div', 'st', '★'.repeat(d.stars)));
          // 철자까지 각인한 동사는 훈장을 단다 — 도감이 '모은 것'과 '외운 것'을 함께 보여준다
          if (isTrained(v.lemma)) { card.classList.add('trained'); card.append(el('div', 'brain', '🧠')); }
        } else if (d && d.seen) {
          card.classList.add('seen');
          card.append(el('div', 'emo', v.emoji));
          card.append(el('div', 'nm', v.lemma));
          card.append(el('div', 'ko', '도망갔다…'));
        } else {
          card.classList.add('unseen');
          card.append(el('div', 'emo', v.emoji));
          card.append(el('div', 'nm', '???'));
          card.append(el('div', 'ko', '아직 못 봄'));
        }
        grid.append(card);
      }
      root.append(grid);
    }

    const back = el('div', 'backrow');
    const btn = el('button', 'btn ghost', '홈으로');
    btn.onclick = onBack;
    back.append(btn);
    root.append(back);
  }

  render();
  return { el: root, refresh: render };
}
