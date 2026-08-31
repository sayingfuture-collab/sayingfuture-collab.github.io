// 배포본에는 치트가 없다. 원본은 개발 폴더의 src/cheat.js 에 있다.
//
// ⚠️ **이 파일을 지우지 마라.** app.js 와 ui/screen-titles.js 가 여전히 import 하므로
// 파일이 사라지면 모듈 그래프가 끊겨 화면이 통째로 안 뜬다. 이름 둘은 남아 있어야 한다.
//
// cheatMark 가 null 이면 칭호 화면의 치트 표식 줄이 빈 칸으로 남는다(그리는 쪽에서 처리).

/** @returns {null} 배포본에는 흔적이 없다 */
export function cheatMark() { return null; }

/** 배포본에서는 아무것도 걸지 않는다 */
export function installCheat() {}
