// data/services.js
// -----------------------------------------------------------------------
// 새 카드 추가 방법: 아래 SERVICES 배열에 항목 하나만 추가하면 됩니다.
// (예: 게임이 새로 출시되면 status를 "soon"에서 "live"로, href를 실제
//  주소로 바꿔주기만 하면 index.html 카드 그리드에 자동으로 반영됩니다.)
//
// 필드 설명
//  id     : 고유 문자열 (영문 소문자 + 하이픈)
//  title  : 카드에 표시될 제목
//  emoji  : 카드 아이콘으로 쓸 이모지 한 글자
//  type   : "game" | "worksheet" — 어느 섹션에 들어갈지 결정
//  status : "live"(정식 오픈, 클릭 가능) | "soon"(준비 중, 링크 없음)
//  href   : 이동할 주소. 상대경로는 반드시 "./"로 시작할 것
//  desc   : 한 줄 설명
//
// 주의: 이 파일은 <script src="./data/services.js"> 형태의 "고전" 스크립트로
// 로드됩니다. import/export, fetch 등은 사용하지 마세요 (file:// 더블클릭 지원용).
// -----------------------------------------------------------------------
window.SERVICES = [
  { id: "shrubdown", title: "Shrubdown (풀스윙)", emoji: "🌱", type: "game", status: "live", href: "https://nye-jun.itch.io/shrubdown", desc: "식물 오토배틀러" },
  { id: "cat-survivors", title: "냥서바이버", emoji: "🐱", type: "game", status: "live", href: "./games/cat-survivors/index.html", desc: "고양이 vs 쥐떼 서바이버" },
  { id: "sentence-forms", title: "문장의 형식 Vol.1", emoji: "📘", type: "worksheet", status: "live", href: "./worksheets/sentence-forms/index.html", desc: "영문법 학습지 — 기본편 280제·실전편 340제" },
  { id: "nyajackpot", title: "냥잭팟", emoji: "🎰", type: "game", status: "soon", href: "", desc: "원-탭 고양이 가챠" },
  { id: "regression", title: "그때도 이걸 알았더라면", emoji: "📈", type: "game", status: "soon", href: "", desc: "회귀 경제 시뮬" },
  { id: "bible-slot", title: "성경슬롯", emoji: "✨", type: "game", status: "soon", href: "", desc: "3릴 슬롯" },
  { id: "lowpoly-fc", title: "LOWPOLY FC", emoji: "⚽", type: "game", status: "soon", href: "", desc: "3v3 축구" }
];
