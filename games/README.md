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
- **갱신 절차 = 게임 폴더에서 `node deploy-nyejun.js --push "메시지"` 한 줄.** 손으로 복사하지 말 것.
  빌드(치트 제거)→복사→beacon 삽입→검증 9종→커밋·푸시→라이브 확인까지 자동. 검증 실패 시 푸시를 막는다.
- 확인만: `node deploy-nyejun.js --verify` (라이브 게임 버전·집계·치트 노출 여부)
- ⚠️ 치트 발동어가 `yejun` 이라 이 파일 안에 그 글자가 있으면 안 된다 — 주석에도 쓰지 말 것

## shrubdown (Shrubdown / 풀스윙)
- 원본: `Desktop\고양이\plant fight`
- 배포본: `plant fight/dist/` (index.html + assets.js 두 파일 세트)
- 갱신 절차: 원본 수정 → `dist/` 갱신 → **두 파일 모두** `games/shrubdown/` 로 복사
- ⚠️ itch.io(nye-jun.itch.io/shrubdown)에도 같은 게임이 올라가 있음 → 패치하면 **양쪽 다** 갱신할 것

## balloon-bust (풍선빵)
- 원본: `Desktop\고양이\풍선게임` (단일 `index.html` + `og.png`, 빌드 단계 없음)
- **갱신 절차 = 게임 폴더에서 `node deploy-nyejun.js --push "메시지"`.** 손으로 복사하지 말 것.
- `--push` 없이 실행하면 **검사만 하고 이 폴더를 건드리지 않는다** (빌드 단계가 없어서 작업 중인 코드가 섞여 올라갈 위험이 크기 때문)
- 지금 라이브가 로컬과 같은지: `node deploy-nyejun.js --verify` (내용 지문 비교)
