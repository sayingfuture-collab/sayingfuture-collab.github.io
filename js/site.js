// js/site.js
// -----------------------------------------------------------------------
// NYEJUN 허브 페이지 스크립트.
// - data/services.js 의 window.SERVICES 배열을 읽어 카드 목록을 그립니다.
// - 새 카드를 추가하려면 이 파일을 건드릴 필요 없이 data/services.js 의
//   SERVICES 배열에 항목만 추가하면 자동으로 화면에 나타납니다.
// - 게임은 썸네일 중심 카드(project-card), 학습지는 가로형 문서 카드
//   (worksheet-card)로 각각 다른 레이아웃을 사용합니다.
// - thumb 필드가 있으면 이미지를, 없으면 그라디언트+이모지 플레이스홀더를
//   자동으로 렌더링합니다 (실제 스크린샷 준비되는 대로 교체 가능).
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

  function pad2(n) {
    var s = String(n);
    return s.length < 2 ? "0" + s : s;
  }

  /* ---------------------------------------------------------------------
     게임 카드 (썸네일 중심)
     --------------------------------------------------------------------- */
  function buildProjectCardInner(service, isLive) {
    var thumbClass = "project-thumbnail" + (service.thumb ? "" : " project-thumbnail--placeholder");
    var thumbInner = service.thumb
      ? '<img src="' + escapeHtml(service.thumb) + '" alt="" class="project-thumbnail__img" loading="lazy">'
      : '<span class="project-thumbnail__emoji" aria-hidden="true">' + escapeHtml(service.emoji) + "</span>";

    var badge = isLive
      ? '<span class="badge badge--live project-badge"><span class="badge__dot" aria-hidden="true"></span>LIVE</span>'
      : '<span class="badge badge--soon project-badge">준비 중</span>';

    var tag = service.tag
      ? '<span class="project-tag">' + escapeHtml(service.tag) + "</span>"
      : "";

    var foot = isLive
      ? '<div class="project-foot"><span class="card-cta">플레이하기 <span class="arrow" aria-hidden="true">→</span></span></div>'
      : "";

    return (
      '<div class="' + thumbClass + '">' + thumbInner + badge + "</div>" +
      '<div class="project-body">' +
      tag +
      '<h3 class="card-title">' + escapeHtml(service.title) + "</h3>" +
      '<p class="card-desc">' + escapeHtml(service.desc) + "</p>" +
      foot +
      "</div>"
    );
  }

  function renderProjectCard(service, index) {
    var li = document.createElement("li");
    li.className = "project-item";
    li.style.setProperty("--i", String(index));

    var isLive = service.status === "live";
    var cardClass = "project-card" + (isLive ? "" : " is-soon");

    var el;
    if (!isLive) {
      // 준비 중: 링크 없이 div로만 렌더 (클릭 불가)
      el = document.createElement("div");
      el.className = cardClass;
      el.setAttribute("aria-disabled", "true");
    } else {
      el = document.createElement("a");
      el.className = cardClass;
      el.href = service.href;
      // 게임(외부/새 창): 새 탭으로 열기
      el.target = "_blank";
      el.rel = "noopener";
    }
    el.innerHTML = buildProjectCardInner(service, isLive);
    li.appendChild(el);
    return li;
  }

  /* ---------------------------------------------------------------------
     학습지 카드 (가로형 문서 카드)
     --------------------------------------------------------------------- */
  function buildWorksheetCardInner(service, isLive) {
    var iconInner = service.thumb
      ? '<img src="' + escapeHtml(service.thumb) + '" alt="" loading="lazy">'
      : '<span class="project-thumbnail__emoji" aria-hidden="true">' + escapeHtml(service.emoji) + "</span>";

    var format = service.format
      ? '<span class="format-badge">' + escapeHtml(service.format) + "</span>"
      : "";

    var action = isLive
      ? format + '<span class="open-button">열기 <span aria-hidden="true">→</span></span>'
      : format + '<span class="badge badge--soon">준비 중</span>';

    return (
      '<div class="worksheet-card__icon">' + iconInner + "</div>" +
      '<div class="worksheet-card__body">' +
      '<h3 class="card-title">' + escapeHtml(service.title) + "</h3>" +
      '<p class="card-desc">' + escapeHtml(service.desc) + "</p>" +
      "</div>" +
      '<div class="worksheet-card__action">' + action + "</div>"
    );
  }

  function renderWorksheetCard(service, index) {
    var li = document.createElement("li");
    li.className = "worksheet-item";
    li.style.setProperty("--i", String(index));

    var isLive = service.status === "live";
    var cardClass = "worksheet-card" + (isLive ? "" : " is-soon");

    var el;
    if (!isLive) {
      el = document.createElement("div");
      el.className = cardClass;
      el.setAttribute("aria-disabled", "true");
    } else {
      el = document.createElement("a");
      el.className = cardClass;
      el.href = service.href;
      // 학습지는 같은 탭에서 이동 (target 지정 안 함)
    }
    el.innerHTML = buildWorksheetCardInner(service, isLive);
    li.appendChild(el);
    return li;
  }

  /* ---------------------------------------------------------------------
     빈 상태
     --------------------------------------------------------------------- */
  function buildEmptyState() {
    var li = document.createElement("li");
    li.className = "empty-state";
    li.innerHTML =
      '<div class="empty-state__orbit" aria-hidden="true"><span class="empty-state__dot"></span></div>' +
      '<p class="empty-state__title">첫 번째 프로젝트를 준비하고 있어요.</p>' +
      '<p class="empty-state__desc">곧 이곳에서 직접 플레이할 수 있습니다.</p>';
    return li;
  }

  function renderSection(listEl, items, kind) {
    if (!listEl) return;
    listEl.innerHTML = "";
    if (items.length === 0) {
      listEl.appendChild(buildEmptyState());
      return;
    }
    items.forEach(function (service, i) {
      var card = kind === "worksheet" ? renderWorksheetCard(service, i) : renderProjectCard(service, i);
      listEl.appendChild(card);
    });
  }

  function renderAll() {
    var services = window.SERVICES || [];
    var games = services.filter(function (s) { return s.type === "game"; });
    var worksheets = services.filter(function (s) { return s.type === "worksheet"; });

    renderSection(document.getElementById("game-grid"), games, "game");
    renderSection(document.getElementById("worksheet-grid"), worksheets, "worksheet");

    // 히어로 통계: 라이브 서비스 개수 (2자리, 예: "01")
    var liveGames = games.filter(function (s) { return s.status === "live"; }).length;
    var liveWorksheets = worksheets.filter(function (s) { return s.status === "live"; }).length;
    var statGames = document.getElementById("stat-games");
    var statWorksheets = document.getElementById("stat-worksheets");
    if (statGames) statGames.textContent = pad2(liveGames);
    if (statWorksheets) statWorksheets.textContent = pad2(liveWorksheets);
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
