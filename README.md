# PIXEL BREAKER

레트로 스타일의 고해상도 벽돌깨기 게임. PC와 모바일 브라우저에서 동작한다.

**바로 플레이: https://jihunyangai.github.io/pixel-breaker/**

- 모드 3개: ARCADE (30 스테이지 + 보스 6종), ENDLESS, DAILY
- 벽돌 8종, 파워업 11종, 콤보 배율, 랭킹, 업적
- 프레임워크·빌드 도구·에셋 파일 없음. 그래픽과 사운드는 모두 코드로 생성한다

## 조작

| | PC | 모바일 |
|---|---|---|
| 패들 이동 | 마우스 또는 ← → / A D | 화면을 좌우로 끌기 |
| 발사·레이저 | 클릭 또는 Space | 짧게 탭 |
| 일시정지 | P 또는 Esc | 화면의 ⏸ 버튼 |
| 음소거 | M | 옵션에서 볼륨 조절 |

## 내 컴퓨터에서 실행

Node.js가 필요하다.

- Windows: `PLAY.bat` 더블클릭
- 터미널: `npm start` 후 `http://localhost:5173`

`index.html`을 직접 열면 실행되지 않는다 (ES 모듈은 `file://`에서 막힌다).

## 문서

기획과 기술 설계는 [design.md](design.md)에 있다.
