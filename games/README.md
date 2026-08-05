이 폴더의 파일은 직접 수정 금지. 전부 다른 폴더의 게임에서 복사해 온 **배포본 사본**입니다.

## ⚠️ 복사할 때마다 반드시 다시 넣을 것 — 방문자 집계 스크립트

원본에는 없고 이 사본에만 들어 있는 두 줄이 있습니다. 덮어쓰면 사라지므로,
복사한 뒤 각 `index.html` 의 `</head>` 바로 위에 다시 붙여넣으세요.

```html
<!-- Cloudflare Web Analytics -->
<script type='module' src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "66d74d758a3b4b68ae33d7a072440b61"}'></script>
```

확인: `grep -rc cloudflareinsights games/` → 게임마다 **1** 이어야 함.

## cat-survivors (냥서바이버)
- 원본: `Desktop\고양이\냥서바이버`
- 빌드: `node tools/build-dist.js` (개발자 치트를 걷어낸 배포본을 만듦)
- 갱신 절차: 원본 수정 → 재빌드 → `dist/index.html` 을 `games/cat-survivors/index.html` 로 복사
- ⚠️ 커밋 전 `grep -c yejun games/cat-survivors/index.html` 이 **0** 인지 확인 (치트 발동어)

## shrubdown (Shrubdown / 풀스윙)
- 원본: `Desktop\고양이\plant fight`
- 배포본: `plant fight/dist/` (index.html + assets.js 두 파일 세트)
- 갱신 절차: 원본 수정 → `dist/` 갱신 → **두 파일 모두** `games/shrubdown/` 로 복사
- ⚠️ itch.io(nye-jun.itch.io/shrubdown)에도 같은 게임이 올라가 있음 → 패치하면 **양쪽 다** 갱신할 것

## balloon-bust (풍선빵)
- 원본: `Desktop\고양이\풍선게임`
- 배포본: 단일 `index.html`
- 갱신 절차: 원본 수정 → `games/balloon-bust/index.html` 로 복사
