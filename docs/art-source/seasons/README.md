# 시즌 배경 · 2026-09-09

내장 이미지 생성 기능으로 시즌별 원화 5장을 제작했다. 원본 PNG와 전체 프롬프트는 이 폴더에, 게임용 WebP는 `public/assets/seasons/`에 보존한다. 구도와 해상도(1672×941)를 유지하며 WebP quality 88로 인코딩했다. 게임용 5장의 합계는 1,901,682바이트다.

| 시즌 | 장면 | 게임 파일 |
|---|---|---|
| S1 트윙클 개막전 | 금빛 아침의 아카데미 경주장 | `public/assets/seasons/s1.webp` |
| S2 별빛 오케스트라 | 별빛과 음악 아치의 야간 아레나 | `public/assets/seasons/s2.webp` |
| S3 와일드 프런티어 | 협곡과 오아시스의 초원 트랙 | `public/assets/seasons/s3.webp` |
| S4 네온 스프린트 | 청록 네온 도시 경주장 | `public/assets/seasons/s4.webp` |
| S5 크라운 피날레 | 장밋빛 석양의 왕관 챔피언십 | `public/assets/seasons/s5.webp` |

새 게임의 시즌 카드와 전체 배경, 온라인 방 생성·입장 후 대기실에 적용한다. 방에 입장하면 방장이 정한 시즌을 사용한다. 전투 보드 좌표와 배경은 기존 공용 아레나를 유지한다. 프레젠테이션 전용 매핑 `src/game/ui/season-art.ts`로 연결해 로스터 해시나 세이브 호환성은 바뀌지 않는다.

`npm run build && npm run test:ui`는 두 화면 크기에서 시즌 선택, 이미지 디코딩, 60명 명단, 전용 특성 단계, 도감 필터, 게임 시작과 온라인 입장을 검사한다. Chromium 최초 설치는 `npx playwright install --with-deps chromium`으로 수행한다. CI의 `season-ui-report` 아티팩트에 화면과 HTML 보고서를 저장한다.
