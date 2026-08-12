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
     데이터 검증
     필드가 빠진 항목을 그대로 그리면 화면에 "undefined" 글자가 찍힌다.
     그런 항목은 아예 건너뛰고, 무엇이 빠졌는지 콘솔에 남긴다
     (F12 → Console 에서 확인. 방문자에게는 조용히 안 보이는 편이 낫다).
     --------------------------------------------------------------------- */
  function hasText(v) {
    return typeof v === "string" && v.trim() !== "";
  }

  function serviceProblems(s) {
    var miss = [];
    if (!s || typeof s !== "object") return ["항목이 객체가 아님"];
    if (!hasText(s.title)) miss.push("title");
    if (!hasText(s.desc)) miss.push("desc");
    if (s.type !== "game" && s.type !== "worksheet") miss.push('type("game" 또는 "worksheet")');
    // href는 live일 때만 필요하다. soon은 링크가 없는 게 정상.
    if (s.status === "live" && !hasText(s.href)) miss.push("href (status가 live면 필수)");
    // 썸네일이 없으면 이모지 플레이스홀더를 그리므로 emoji가 있어야 한다.
    if (!hasText(s.thumb) && !hasText(s.emoji)) miss.push("emoji (thumb이 없으면 필수)");
    return miss;
  }

  function newsProblems(n) {
    var miss = [];
    if (!n || typeof n !== "object") return ["항목이 객체가 아님"];
    if (!hasText(n.date)) miss.push("date");
    if (!hasText(n.title)) miss.push("title");
    return miss;
  }

  function keepValid(list, problemsOf, where) {
    if (!Array.isArray(list)) {
      if (list != null) console.warn("[" + where + "] 배열이 아닙니다 — 아무것도 그리지 않습니다.");
      return [];
    }
    var out = [];
    list.forEach(function (item, i) {
      var miss = problemsOf(item);
      if (miss.length === 0) {
        out.push(item);
        return;
      }
      var label = (item && (item.id || item.title)) || "#" + i;
      console.warn('[' + where + '] "' + label + '" 항목을 건너뜁니다 — 빠진 필드: ' + miss.join(", "));
    });
    return out;
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

  /* ---------------------------------------------------------------------
     소식 (data/news.js 의 window.NEWS)
     - 최신 MAX_NEWS 개만 표시. 목록이 비면 섹션 자체를 숨긴다.
     --------------------------------------------------------------------- */
  var MAX_NEWS = 5;

  function formatNewsDate(raw) {
    // "2026-08-10" → "2026.08.10" (형식이 다르면 원문 그대로 표시)
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(raw || "").trim());
    return m ? m[1] + "." + m[2] + "." + m[3] : String(raw || "");
  }

  function buildNewsInner(item) {
    var tag = item.tag
      ? '<span class="news-tag">' + escapeHtml(item.tag) + "</span>"
      : "";
    var desc = item.desc
      ? '<p class="news-desc">' + escapeHtml(item.desc) + "</p>"
      : "";
    var arrow = item.href
      ? '<span class="news-arrow" aria-hidden="true">→</span>'
      : "";

    return (
      '<div class="news-meta">' +
      '<time class="news-date" datetime="' + escapeHtml(item.date) + '">' +
      escapeHtml(formatNewsDate(item.date)) +
      "</time>" +
      tag +
      "</div>" +
      '<div class="news-body">' +
      '<h3 class="news-title">' + escapeHtml(item.title) + arrow + "</h3>" +
      desc +
      "</div>"
    );
  }

  function renderNews() {
    var section = document.getElementById("news-section");
    var listEl = document.getElementById("news-list");
    if (!section || !listEl) return;

    var items = keepValid(window.NEWS, newsProblems, "data/news.js").slice(0, MAX_NEWS);
    if (items.length === 0) {
      // 소식이 없으면 섹션을 통째로 감춘다 (빈 칸을 남기지 않음)
      section.hidden = true;
      return;
    }
    section.hidden = false;

    listEl.innerHTML = "";
    items.forEach(function (item, i) {
      var li = document.createElement("li");
      li.className = "news-item";
      li.style.setProperty("--i", String(i));

      var el;
      if (item.href) {
        el = document.createElement("a");
        el.className = "news-entry";
        el.href = item.href;
        // 외부 주소면 새 탭으로 (내 사이트 안이면 같은 탭)
        if (/^https?:\/\//i.test(item.href)) {
          el.target = "_blank";
          el.rel = "noopener";
        }
      } else {
        el = document.createElement("div");
        el.className = "news-entry news-entry--plain";
      }
      el.innerHTML = buildNewsInner(item);
      li.appendChild(el);
      listEl.appendChild(li);
    });
  }

  function renderAll() {
    var services = keepValid(window.SERVICES, serviceProblems, "data/services.js");
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

    renderNews();
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
