// data/services.js
// -----------------------------------------------------------------------
// 새 카드 추가 방법: 아래 SERVICES 배열에 항목 하나만 추가하면 됩니다.
// (예: 게임이 새로 출시되면 status를 "soon"에서 "live"로, href를 실제
//  주소로 바꿔주기만 하면 index.html 카드 그리드에 자동으로 반영됩니다.)
//
// 필드 설명
//  id     : 고유 문자열 (영문 소문자 + 하이픈)
//  title  : 카드에 표시될 제목
//  emoji  : 카드 아이콘으로 쓸 이모지 한 글자 (thumb이 없을 때 플레이스홀더에 표시됨)
//  type   : "game" | "worksheet" — 어느 섹션에 들어갈지 결정
//  status : "live"(정식 오픈, 클릭 가능) | "soon"(준비 중, 링크 없음)
//  href   : 이동할 주소. 상대경로는 반드시 "./"로 시작할 것
//  desc   : 한 줄 설명
//  thumb  : (선택) 16:9 썸네일 또는 문서 미리보기 이미지 경로. 없으면 그라디언트+
//           이모지 플레이스홀더가 자동으로 표시됩니다. 스크린샷이 준비되면 이
//           필드에 경로만 채워주세요.
//  tag    : (선택, game 전용) 장르/플랫폼 짧은 라벨
//  format : (선택, worksheet 전용) "WEB" | "PDF" 라벨
//
// 주의: 이 파일은 <script src="./data/services.js"> 형태의 "고전" 스크립트로
// 로드됩니다. import/export, fetch 등은 사용하지 마세요 (file:// 더블클릭 지원용).
// -----------------------------------------------------------------------
window.SERVICES = [
  { id: "shrubdown", title: "Shrubdown (풀스윙)", emoji: "🌱", type: "game", status: "live", href: "./games/shrubdown/index.html", desc: "식물 오토배틀러", tag: "오토배틀러", thumb: "" },
  { id: "cat-survivors", title: "냥서바이버", emoji: "🐱", type: "game", status: "live", href: "./games/cat-survivors/index.html", desc: "고양이 vs 쥐떼 서바이버", tag: "서바이버", thumb: "" },
  { id: "sentence-forms", title: "문장의 형식 Vol.1", emoji: "📘", type: "worksheet", status: "live", href: "./worksheets/sentence-forms/index.html", desc: "영문법 학습지 — 기본편 280제·실전편 340제", format: "WEB", thumb: "./worksheets/sentence-forms/images/cover-basic.png" }

  // ── 웹에 올리면 아래 형식으로 한 줄씩 다시 추가하세요 (status: "live", href 채우기) ──
  // { id: "nyajackpot", title: "냥잭팟", emoji: "🎰", type: "game", status: "live", href: "./games/nyajackpot/index.html", desc: "원-탭 고양이 가챠", tag: "가챠", thumb: "" },
  // { id: "regression", title: "그때도 이걸 알았더라면", emoji: "📈", type: "game", status: "live", href: "./games/regression/index.html", desc: "회귀 경제 시뮬", tag: "경제 시뮬레이션", thumb: "" },
  // { id: "bible-slot", title: "성경슬롯", emoji: "✨", type: "game", status: "live", href: "./games/bible-slot/index.html", desc: "3릴 슬롯", tag: "슬롯", thumb: "" },
  // { id: "lowpoly-fc", title: "LOWPOLY FC", emoji: "⚽", type: "game", status: "live", href: "./games/lowpoly-fc/index.html", desc: "3v3 축구", tag: "3v3 스포츠", thumb: "" }
];
