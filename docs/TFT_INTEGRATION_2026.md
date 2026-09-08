# TFT 계열 시스템·연출 연동 기록

2026-09-08 사용자 지시: TFT와 같은 게임 흐름, Live2D 느낌, 부드러운 배치와 공격/피격, 배경과 전투 공간의 일치.

비교 기준은 [Riot의 TFT 소개](https://teamfighttactics.leagueoflegends.com/en-gb/news/game-updates/what-is-teamfight-tactics/)에서 설명하는 공유 기물 풀, 팀 편성, 경제, 아이템, 배치, 자동 1대1 라운드와 최후 생존 구조다. TFT는 세트마다 캐릭터·특성·규칙을 바꾼다. 이 프로젝트가 현재 라이브 세트의 모든 수치·내부 판정·콘텐츠와 동일하다고 검증한 것은 아니다.

| 영역 | 현재 구현 | 코드 |
|---|---|---|
| 8인 생존 경쟁 | 플레이어 1명 + AI 7명, 라운드 매칭·피해·탈락·순위 | engine/rounds |
| 공유 기물 | 코스트별 유한 풀, 구매·판매·탈락 반환, 상점 5칸 | engine/pool, engine/shop |
| 합성 | 같은 1성 3개→2성, 같은 2성 3개→3성; 아이템 승계 | engine/shop |
| 경제 | 이자·연승/연패·경험치·레벨·리롤 | engine/economy, constants.ts |
| 특성·장비·증강 | 보드 편성에 따른 특성, 아이템 효과, 증강 선택 | engine/traits, items, augments |
| 준비 시간 | PvE 20초 / PvP 30초 등 기존 명세 적용, 선택 중 정지, 만료 시 시작 | PrepCountdown.tsx |
| 자동 출전 | 빈 슬롯만 대기석으로 채움; 기존 배치 유지; 역할별 앞/뒤열 우선 | gameStore.ts |
| 이동 | 목적지 칸 예약, 이동률 0~1, 이동 완료 후 공격, 중복 점유 방지 | battle/engine.ts |
| 일반 공격 | 공격 준비, 발사, 명중 분리; 원거리 투사체 비행; 실제 명중 시 피해 | battle/engine.ts |
| 피격 | 일반/스킬/보호막 피해를 DAMAGE 기록에 연결, 동일 재생 시계 사용 | phaser/BattleScene.ts |
| 공간 | 준비/전투가 같은 배경·격자·좌표·전신 크기·발 앵커 공유 | BoardView.tsx, ui/board-projection.ts |
| 2.5D 캐릭터 | 투명 전신 4명, WebGL 상체 메시 변형, 접지 그림자, 깊이 정렬 | phaser/BattleScene.ts |

## 아직 동일하거나 완성되지 않은 범위

- 온라인 8인 동시 대전이 아니라 1인 + AI 구조다. 서버 권위형 네트워크 동기화는 없다.
- 말 전적 기반 캐릭터·자체 스킬·특성·아이템과 기존 프로젝트의 경제 수치를 사용한다. Riot 라이브 세트의 유닛/시너지/아이템/패치 밸런스 복제는 아니다.
- 전투는 결정론 엔진으로 먼저 계산한 뒤 그 기록을 재생한다. 결과 정산도 현재 사전 계산 구조를 사용한다. 싱글플레이 일시정지와 결과 확인 버튼이 있다.
- 현재 공격 준비/투사체 시간은 이 프로젝트의 구현값이다. Riot 내부 판정 수치와 동일하다고 주장하지 않는다. 준비 시간은 공격 간격의 22%(0.06~0.24초), 원거리 비행은 거리당 0.065초(최대 0.35초)이며 시뮬레이션 틱에서 명중한다.
- 캐릭터 독립 원화 50동작 시트 145명, 초상화 나머지 141명, 5코 컷인 8명이 미완료다. 전신 4개의 메시 변형을 50개 원화 납품으로 세지 않는다. 현재 220/514 규격 통과다.
- Live2D Cubism 모델/리깅, 실제 3D 모델과 관절별 보행은 없다. 현재 메시 변형은 상체의 미세한 곡률과 회전/크기 변형이며 다리·팔의 독립 리깅을 대체하지 않는다.

## 자산 제작 기록

도구: 내장 image_gen. API/CLI 대체 경로는 사용하지 않았다.
입력: 사용자 Genuine.png·SamsonBig.png와 기존 SpecialWeek-Race.png·TokaiTeio-Race.png. 생성 원본은 docs/art-source/standees, 제작 메타데이터는 src/data/manual/standees.json.

공통 프롬프트: `One full-body [character] game sprite faithfully matching the attached racing costume reference. Preserve hair, face, ears, tail and costume colors. Smooth cel-shaded modern Pokémon-like 2.5D anime / Live2D-like volume. Three-quarter view facing right, relaxed battle-ready stance. Entire ears, shoes and tail with margin. Actual transparent alpha PNG, zero alpha outside silhouette; no ground, shadow, glow, background, checkerboard, UI or labels.`

투명 생성 결과만 import-standee.py로 전체 알파 경계와 검토한 얼굴 영역을 잘라 규격화했다. 배경 제거는 코드로 하지 않았다. 하루 우라라·오구리 캡은 RGB 결과로 거절했으며 재시도 배경 제거 프롬프트 역시 실패했다.

## 검증

- 초반 훈련 난이도: stage 1의 PvE HP·AD 배율을 0.35로 조정했다. 2스테이지 이후 배율은 유지한다. 모든 1코스트 시작 유닛을 무장비로 3개 시드에서 검사해 첫 훈련 승리를 확인한다.
- 회귀: tests/combat-presentation.test.ts에서 공격 준비 이전 피해 없음, 실제 명중 이벤트 시각, 이동 연속성, 점유 중복, 무장 해제 차단을 확인한다.
- 전체 테스트 121개, 타입 검사·린트·프로덕션 빌드 통과.
- 준비 타이머 20초 만료 후 자동 출전 1명과 전투 1회 시작을 실제 브라우저에서 확인했다.
- Chromium 1366×768: 전신 4명 배치→이동→전투→4배속→결과→도감 경로 확인. 콘솔 오류와 깨진 이미지 0건.
- 엄격 아트 게이트는 미완료 294개 때문에 실패해야 한다. 비엄격 검수 성공은 전체 제작 완료를 뜻하지 않는다.
