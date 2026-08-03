// js/site.js
// -----------------------------------------------------------------------
// NYEJUN 허브 페이지 스크립트.
// - data/services.js 의 window.SERVICES 배열을 읽어 카드 그리드를 그립니다.
// - 새 카드를 추가하려면 이 파일을 건드릴 필요 없이 data/services.js 의
//   SERVICES 배열에 항목만 추가하면 자동으로 화면에 나타납니다.
//
// 주의: 이 파일은 <script src="./js/site.js"></script> 형태로, type="module"
// 없이 로드됩니다. import/export/fetch를 쓰지 않습니다 (file:// 지원 목적).
// -----------------------------------------------------------------------
(function () {
  "use strict";

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (ch) {
      return (
        { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
          ch
        ] || ch
      );
    });
  }

  function buildCardInner(service, isLive) {
    var badge = isLive
      ? '<span class="badge badge--live"><span class="badge__dot" aria-hidden="true"></span>LIVE</span>'
      : '<span class="badge badge--soon">준비 중</span>';

    var footer = isLive
      ? '<span class="card__cta">바로가기 <span class="arrow" aria-hidden="true">→</span></span>' +
        badge
      : "<span></span>" + badge;

    return (
      '<div class="card__top">' +
      '<span class="card__icon"><span class="card__emoji" aria-hidden="true">' +
      escapeHtml(service.emoji) +
      "</span></span>" +
      "</div>" +
      '<h3 class="card__title">' +
      escapeHtml(service.title) +
      "</h3>" +
      '<p class="card__desc">' +
      escapeHtml(service.desc) +
      "</p>" +
      '<div class="card__foot">' +
      footer +
      "</div>"
    );
  }

  function renderCard(service, index) {
    var li = document.createElement("li");
    li.style.setProperty("--i", String(index));

    var isLive = service.status === "live";
    var isWorksheet = service.type === "worksheet";
    var cardClass =
      "card" + (isWorksheet ? " card--worksheet" : "") + (isLive ? "" : " card--soon");

    if (!isLive) {
      // 준비 중: 링크 없이 div로만 렌더 (클릭 불가)
      var div = document.createElement("div");
      div.className = cardClass;
      div.setAttribute("aria-disabled", "true");
      div.innerHTML = buildCardInner(service, false);
      li.appendChild(div);
      return li;
    }

    var a = document.createElement("a");
    a.className = cardClass;
    a.href = service.href;
    if (service.type === "game") {
      // 게임(외부/새 창): 새 탭으로 열기
      a.target = "_blank";
      a.rel = "noopener";
    }
    // worksheet 는 같은 탭에서 이동 (target 지정 안 함)
    a.innerHTML = buildCardInner(service, true);
    li.appendChild(a);
    return li;
  }

  function renderSection(listEl, countEl, items) {
    if (!listEl) return;
    listEl.innerHTML = "";
    items.forEach(function (service, i) {
      listEl.appendChild(renderCard(service, i));
    });
    if (countEl) {
      countEl.textContent = String(items.length) + "개";
    }
  }

  function renderAll() {
    var services = window.SERVICES || [];
    var games = services.filter(function (s) { return s.type === "game"; });
    var worksheets = services.filter(function (s) { return s.type === "worksheet"; });

    renderSection(
      document.getElementById("game-grid"),
      document.getElementById("game-count"),
      games
    );
    renderSection(
      document.getElementById("worksheet-grid"),
      document.getElementById("worksheet-count"),
      worksheets
    );

    // 히어로 영역 통계 (라이브 서비스 개수)
    var liveGames = games.filter(function (s) { return s.status === "live"; }).length;
    var liveWorksheets = worksheets.filter(function (s) { return s.status === "live"; }).length;
    var statGames = document.getElementById("stat-games");
    var statWorksheets = document.getElementById("stat-worksheets");
    if (statGames) statGames.textContent = String(liveGames);
    if (statWorksheets) statWorksheets.textContent = String(liveWorksheets);
  }

  function init() {
    renderAll();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
