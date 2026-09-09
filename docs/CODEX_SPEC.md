# UmafightTactics — CODEX 전체 구현 명세서 v1.0 FINAL

> **상태:** IMPLEMENTATION READY / 초안 아님  
> **대상 저장소:** `https://github.com/eukusak/UmafightTactics`  
> **참조 데이터 저장소:** `https://github.com/eukusak/UmaRogue` (`pr0`)  
> **기준 해상도:** 1920×1080  
> **장르:** 1인 + 7 AI 기반 8인 오토배틀러 / 우마무스메 팬메이드 게임  
> **목표:** 이 문서만 Codex에 제공해도 저장소 초기화 → 데이터 생성 → 게임 구현 → 테스트 → Render 배포 설정까지 끝낼 수 있어야 한다.

---

# 0. Codex 실행 지시

Codex는 아래 순서로 **질문 없이 끝까지 구현**한다.

1. `UmafightTactics` 저장소 상태를 확인한다. 비어 있으면 이 문서의 기술 스택으로 새 프로젝트를 만든다.
2. `UmaRogue/pr0/data/horse-game-db.json`과 validation 파일을 빌드 시점에 내려받아 `src/data/source/`에 vendor하는 스크립트를 만든다.
3. P0 145두를 검증하고 UmafightTactics 전용 점수/역할/특성을 계산한다.
4. Season 1 활성 로스터 60명을 고정 생성하고 1~5코스트를 `14/14/13/11/8`명으로 배정한다.
5. 상점 공유 풀, 경제, 배치, 별 합성, 아이템, 특성, 증강, 전투, AI, 라운드, 최종 순위를 모두 구현한다.
6. 145명 전체는 도감/연습모드에서 확인 가능하게 하고, 표준 매치에는 60명만 사용한다.
7. 아트가 없어도 fallback으로 플레이 가능하게 한다.
8. `npm run verify`가 통과할 때까지 수정한다.
9. `render.yaml`과 README 실행/배포 안내를 만든다.
10. **TODO, `throw new Error("not implemented")`, 빈 버튼, 가짜 결과 화면을 남기지 않는다.**

---


## 1. 기준 자료와 강제 원칙

이 명세는 다음 자료를 기준으로 한다.

- 사용자 제공 `전략적 팀 전투/시스템` 자료: 상점, 경제, 레벨, 공유 기물 풀, PvE/PvP, 증강, 전투 타임아웃 구조의 기준.
- 사용자 제공 `전략적 팀 전투/아이템` 자료: 재료 10종, 조합/상징/소모/유물/찬란한 아이템 구조의 기준.
- 사용자 제공 `우마무스메 등장인물` 자료: 게임에 사용할 우마무스메 후보군 145명.
- `https://github.com/eukusak/UmaRogue` 브랜치 `pr0`
  - `data/horse-game-db.json`: 331두 공개 게임 DB.
  - `data/horse-game-db.validation.json`: 331두, P0 145두, 스탯 누락 0 검증.
  - `data_pipeline/horse_ratings.py`: 실제 전적 feature를 전체/세대 percentile로 변환하여 5스탯을 생성.
  - `data_pipeline/export_game_db.py`: `priority`, `nameKo`, `birthYear`, `powerIndex`, `stats`, `aptitudes`, `affinities`, `archetype`, `raceTraits`, `signature`, `historySummary`를 export.

### 절대 규칙

1. **UmaRogue의 기존 `tier`와 `starterCost`는 UmafightTactics의 코스트 산정에 사용하지 않는다.**
2. 런타임에서 경마 사이트나 외부 API를 호출하지 않는다. 빌드 시 `UmaRogue`의 JSON을 vendor하여 정적 데이터로 사용한다.
3. `priority == "P0"`인 145두를 전체 캐릭터 풀로 본다.
4. 표준 매치에서는 145두 전부를 상점에 넣지 않고 **Season 1 활성 로스터 60명**만 사용한다.
5. 활성 로스터/코스트는 빌드 스크립트로 결정한 뒤 JSON을 저장소에 commit하여 한 버전 안에서는 절대 변하지 않게 한다.
6. 모든 난수는 seed 기반 PRNG를 사용한다. 전투/상점/AI에서 `Math.random()` 직접 호출 금지.
7. 게임 로직은 Phaser/DOM과 분리된 순수 TypeScript 엔진으로 구현한다.
8. 아트가 하나도 없어도 fallback 도형/실루엣으로 처음부터 끝까지 플레이 가능해야 한다.
9. 공식 TFT 또는 공식 우마무스메 게임의 이미지/UI를 추출하여 포함하지 않는다. 시스템은 참고하되 코드와 시각 자산은 독자 구현한다.


---

# 2. 제품 범위

## 2.1 1차 완성 버전에서 반드시 되는 것

- 새 게임 시작
- 8인 로비 생성: 플레이어 1 + AI 7
- 100 체력 시작
- 1-1부터 최종 생존자 결정까지 라운드 자동 진행
- 상점 5칸
- 유닛 구매/판매
- 상점 잠금
- 2골드 리롤
- XP 구매
- 레벨 1~10
- 필드 배치/벤치 이동
- 1성→2성→3성 자동 합성
- 공유 유닛 풀
- 아이템 10 재료 + 55 조합 결과
- 유닛당 최대 3 아이템
- 특성/시너지
- 증강체 48종
- 트윙클 드래프트
- PvE
- PvP
- 고스트 보드
- 전투 30초 + 오버타임 15초
- 결과/피해 계산
- 1~8위 최종 순위
- 저장/이어하기
- 도감
- 개발자 디버그 패널
- 7 AI의 완전한 경제/구매/배치/전투
- headless 밸런스 시뮬레이터
- Render 배포 설정

## 2.2 후속 확장만 고려하고 1차에서 하지 않는 것

- 실시간 온라인 PvP
- 계정 서버/로그인
- 과금/광고
- 랭크 서버
- 친구 초대
- 모바일 전용 터치 UX 최적화
- 공식 우마무스메 음원/보이스 사용

단, 엔진은 향후 온라인 동기화가 가능하도록 순수 상태 + 명령(Command) 구조로 만든다.

---

# 3. 기술 스택

## 3.1 확정 스택

- Node.js 22 LTS
- TypeScript 5.x
- Vite
- React
- Phaser 3
- Zustand
- Vitest
- ESLint
- Prettier
- Zod: JSON 스키마 런타임 검증
- seedrandom 금지: 자체 `xorshift32` 구현
- CSS Modules 또는 plain CSS 중 하나. Tailwind는 사용하지 않는다.

## 3.2 실행 명령

```bash
npm install
npm run sync:data
npm run data:build
npm run dev
```

검증:

```bash
npm run typecheck
npm test
npm run simulate -- --matches 1000
npm run check:art
npm run build
npm run verify
```

## 3.3 package.json scripts

```json
{
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview",
  "typecheck": "tsc -b --pretty false",
  "test": "vitest run",
  "test:watch": "vitest",
  "sync:data": "tsx scripts/sync-umarogue.ts",
  "data:build": "tsx scripts/build-game-data.ts",
  "data:validate": "tsx scripts/validate-game-data.ts",
  "simulate": "tsx scripts/simulate.ts",
  "check:art": "tsx scripts/check-art-manifest.ts",
  "verify": "npm run sync:data && npm run data:build && npm run data:validate && npm run typecheck && npm test && npm run simulate -- --matches 250 && npm run check:art && npm run build"
}
```

---

# 4. 저장소 구조

```text
UmafightTactics/
├─ docs/
│  ├─ CODEX_SPEC.md
│  ├─ ART_REQUEST.md
│  ├─ BALANCE.md
│  └─ DATA_NOTES.md
├─ public/
│  └─ assets/
│     ├─ characters/
│     ├─ portraits/
│     ├─ items/
│     ├─ traits/
│     ├─ augments/
│     ├─ vfx/
│     ├─ ui/
│     ├─ boards/
│     └─ audio/
├─ scripts/
│  ├─ sync-umarogue.ts
│  ├─ build-game-data.ts
│  ├─ validate-game-data.ts
│  ├─ simulate.ts
│  └─ check-art-manifest.ts
├─ src/
│  ├─ app/
│  ├─ components/
│  ├─ game/
│  │  ├─ engine/
│  │  │  ├─ battle/
│  │  │  ├─ economy/
│  │  │  ├─ shop/
│  │  │  ├─ pool/
│  │  │  ├─ roster/
│  │  │  ├─ items/
│  │  │  ├─ traits/
│  │  │  ├─ augments/
│  │  │  ├─ ai/
│  │  │  ├─ rounds/
│  │  │  └─ rng/
│  │  ├─ phaser/
│  │  └─ ui/
│  ├─ data/
│  │  ├─ source/
│  │  │  ├─ horse-game-db.json
│  │  │  └─ horse-game-db.validation.json
│  │  ├─ generated/
│  │  │  ├─ all-units.json
│  │  │  ├─ active-set-s1.json
│  │  │  ├─ shop-config.json
│  │  │  ├─ traits.json
│  │  │  ├─ items.json
│  │  │  ├─ augments.json
│  │  │  └─ art-manifest.json
│  │  └─ manual/
│  │     ├─ unit-overrides.json
│  │     └─ trait-overrides.json
│  ├─ store/
│  ├─ styles/
│  └─ main.tsx
├─ tests/
├─ index.html
├─ package.json
├─ tsconfig.json
├─ vite.config.ts
└─ render.yaml
```

---

# 5. 데이터 동기화

## 5.1 sync-umarogue.ts

빌드 시 아래 URL을 다운로드한다.

```text
https://raw.githubusercontent.com/eukusak/UmaRogue/pr0/data/horse-game-db.json
https://raw.githubusercontent.com/eukusak/UmaRogue/pr0/data/horse-game-db.validation.json
```

다운로드한 파일을 `src/data/source/`에 저장한다.

### 동기화 검증

다음을 모두 만족하지 않으면 실패:

```text
horseCount == 331
validation.horseCount == 331
validation.p0Count == 145
missingStats == 0
duplicateIds == 0
```

네트워크 실패 시 기존 vendor 파일이 있고 SHA가 기록되어 있으면 그것을 사용한다. 기존 파일도 없으면 명확한 에러로 종료한다.

런타임 브라우저는 외부 URL을 절대 호출하지 않는다.

---

# 6. 전체 캐릭터 풀

P0 전체 캐릭터는 145명으로 고정한다.

| 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|
| 1. 스페셜 위크 | 2. 사일런스 스즈카 | 3. 토카이 테이오 | 4. 마루젠스키 | 5. 후지 키세키 |
| 6. 오구리 캡 | 7. 골드 쉽 | 8. 보드카 | 9. 다이와 스칼렛 | 10. 타이키 셔틀 |
| 11. 그래스 원더 | 12. 히시 아마존 | 13. 메지로 맥퀸 | 14. 엘 콘도르 파사 | 15. 티엠 오페라 오 |
| 16. 나리타 브라이언 | 17. 심볼리 루돌프 | 18. 에어 그루브 | 19. 아그네스 디지털 | 20. 세이운 스카이 |
| 21. 타마모 크로스 | 22. 파인 모션 | 23. 비와 하야히데 | 24. 마야노 탑건 | 25. 미호노 부르봉 |
| 26. 메지로 라이언 | 27. 히시 아케보노 | 28. 유키노 비진 | 29. 라이스 샤워 | 30. 아이네스 후진 |
| 31. 아그네스 타키온 | 32. 어드마이어 베가 | 33. 이나리 원 | 34. 위닝 티켓 | 35. 에어 샤커 |
| 36. 에이신 플래시 | 37. 카렌짱 | 38. 카와카미 프린세스 | 39. 골드 시티 | 40. 사쿠라 바쿠신 오 |
| 41. 시킹 더 펄 | 42. 신코 윈디 | 43. 스윕 토쇼 | 44. 슈퍼 크릭 | 45. 스마트 팔콘 |
| 46. 젠노 롭 로이 | 47. 토센 조던 | 48. 나카야마 페스타 | 49. 나리타 타이신 | 50. 니시노 플라워 |
| 51. 하루 우라라 | 52. 뱀부 메모리 | 53. 비코 페가수스 | 54. 마블러스 선데이 | 55. 마치카네 후쿠키타루 |
| 56. 미스터 시비 | 57. 메이쇼 도토 | 58. 메지로 도베르 | 59. 나이스 네이처 | 60. 킹 헤일로 |
| 61. 마치카네 탄호이저 | 62. 이쿠노 딕터스 | 63. 메지로 파머 | 64. 다이타쿠 헬리오스 | 65. 트윈 터보 |
| 66. 사토노 다이아몬드 | 67. 키타산 블랙 | 68. 사쿠라 치요노 오 | 69. 시리우스 심볼리 | 70. 메지로 아르당 |
| 71. 야에노 무테키 | 72. 츠루마루 츠요시 | 73. 메지로 브라이트 | 74. 데어링 택트 | 75. 사쿠라 로렐 |
| 76. 나리타 탑 로드 | 77. 야마닌 제퍼 | 78. 푸리오소 | 79. 트랜센드 | 80. 노스 플라이트 |
| 81. 심볼리 크리스 에스 | 82. 타니노 김렛 | 83. 다이이치 루비 | 84. 메지로 라모누 | 85. 애스턴 마짱 |
| 86. 사토노 크라운 | 87. 슈발 그랑 | 88. 비블로스 | 89. 단츠 플레임 | 90. 케이에스 미라클 |
| 91. 정글 포켓 | 92. 빌리브 | 93. 노 리즌 | 94. 스틸 인 러브 | 95. 코파노 리키 |
| 96. 홋코 타루마에 | 97. 원더 어큐트 | 98. 삼손 빅 | 99. 사운즈 오브 어스 | 100. 로이스 앤 로이스 |
| 101. 카츠라기 에이스 | 102. 네오 유니버스 | 103. 히시 미라클 | 104. 탭 댄스 시티 | 105. 두라멘테 |
| 106. 라인 크라프트 | 107. 세자리오 | 108. 에어 메사이어 | 109. 데어링 하트 | 110. 후사이치 판도라 |
| 111. 부에나 비스타 | 112. 오르페브르 | 113. 젠틸돈나 | 114. 윈 바리아시옹 | 115. 어드마이어 그루브 |
| 116. 드림 저니 | 117. 칼스톤 라이트 오 | 118. 뒤랑달 | 119. 제뉴인 | 120. 버블검 펠로 |
| 121. 사쿠라 치토세 오 | 122. 페노메노 | 123. 블래스트 원피스 | 124. 아몬드 아이 | 125. 럭키 라일락 |
| 126. 그란 알레그리아 | 127. 러브즈 온리 유 | 128. 크로노 제네시스 | 129. 카렌 부케도르 | 130. 스테이 골드 |
| 131. 레드 디자이어 | 132. 키세키 | 133. 포에버 영 | 134. 마르슈 로렌 | 135. 에피파네이아 |
| 136. 로고타입 | 137. 빅투아르 피사 | 138. 로즈 킹덤 | 139. 룰러쉽 | 140. 에프포리아 |
| 141. 타이틀홀더 | 142. 팔레놉시스 | 143. 몬쥬 | 144. 딥 임팩트 | 145. 킹 카메하메하 |

위 목록은 **도감/연습모드 전체 캐릭터 범위**다.

`horse-game-db.json`에서는 아래 조건으로 추출:

```ts
const p0 = horses.filter(h => h.priority === "P0");
```

그리고 `nameKo`를 위 145명 canonical list와 대조한다.

- 완전 일치: 사용
- 공백/중점/장음 차이: normalization 후 사용
- 145:145가 아니면 build 실패
- fuzzy matching으로 자동 추정하여 조용히 통과시키지 않는다.

---

# 7. UmafightTactics 전용 코스트 산정

## 7.1 기존 UmaRogue Tier 사용 금지

다음 필드는 **참고/디버그 표시 외에는 사용 금지**:

```text
tier
starterCost
marketValue
maintenance
```

## 7.2 사용할 데이터

우선순위:

1. `powerIndex`
2. `stats.speed`
3. `stats.stamina`
4. `stats.power`
5. `stats.guts`
6. `stats.intelligence`
7. `aptitudes`
8. `affinities`
9. `raceTraits`
10. `archetype`
11. `signature`
12. `historySummary`
13. `birthYear`
14. `dataConfidence`

`UmaRogue`의 `powerIndex`와 5스탯은 실제 전적에서 생성된 feature의 전체/세대 percentile 기반이므로 사용할 수 있다.

## 7.3 역사 전적 기반 `uftRating`

활성 후보 145명 내부에서 percentile을 다시 계산한다.

```ts
pPowerIndex
pSpeed
pStamina
pPower
pGuts
pIntelligence
```

추가 feature:

```ts
g1Score          // historySummary/signature에서 G1/LEGACY_G1_EQUIV 성과
winScore         // 통산 승/출전 비율이 있을 경우
top3Score        // 통산 3위권 비율이 있을 경우
versatilityScore // distance/surface aptitude 분산
confidence01     // HIGH 1.0 / MEDIUM 0.85 / LOW 0.70 / VERY_LOW 0.55
iconicBonus      // 아래 조건으로만 자동 계산
```

`earnings`는 UmaRogue 현재 데이터에서 결측이므로 필수 feature가 아니다. 향후 `earnings`가 채워지면 전체 145명 로그 percentile로 최대 `+0.03`만 가산한다. 결측이면 0.

### 점수식

```ts
recordCore =
  0.36 * pPowerIndex +
  0.12 * pSpeed +
  0.10 * pStamina +
  0.12 * pPower +
  0.08 * pGuts +
  0.07 * pIntelligence +
  0.08 * g1Score +
  0.04 * versatilityScore +
  0.03 * iconicBonus;

confidenceAdjusted =
  recordCore * confidence01 +
  pPowerIndex * (1 - confidence01);

uftRating = clamp(confidenceAdjusted + earningsBonus, 0, 1);
```

### iconicBonus 자동 조건

각 조건 +0.25, 합계 최대 1.0:

- 무패로 클래식/주요 G1 다승
- 삼관 또는 암말 삼관
- 해외 최상위 G1 우승
- 동일 시즌 G1 3승 이상
- 세대 내 `powerIndex` 상위 3%

수동 감성 보정으로 점수를 직접 바꾸지 않는다.

## 7.4 Season 1 활성 60명 선정

단순 상위 60명만 뽑지 않는다.

1. `uftRating` 상위 36명 고정.
2. 나머지 24명은 아래 다양성 점수로 greedy 선택.
3. 선택 후 총 60명을 freeze.

```ts
diversityNeed =
  styleNeed * 0.30 +
  distanceNeed * 0.25 +
  surfaceNeed * 0.20 +
  eraNeed * 0.15 +
  roleNeed * 0.10;

selectionScore = 0.72 * uftRating + 0.28 * diversityNeed;
```

최소 커버리지:

- 도주/선행/선입/추입 각각 8명 이상
- 스프린터/마일러/중거리/스테이어 각각 7명 이상
- 더트 챔피언 6명 이상
- 1989년 이전 6명 이상
- 1990s 10명 이상
- 2000s 10명 이상
- 2010s 이후 12명 이상
- 탱커/브루저/물리캐리/스킬캐리/서포터 각각 8명 이상

부족 시 낮은 우선순위 선택자를 교체하여 제약을 만족시킨다.

## 7.5 코스트별 캐릭터 수

활성 60명 내부에서 `uftRating`으로 정렬하되 역할/특성 대표성을 보정한다.

| 코스트 | 활성 유닛 종류 수 | 유닛당 공유 수량 | 목적 |
|---:|---:|---:|---|
| 1 | **14** | **22** | 초반/리롤 |
| 2 | **14** | **20** | 초중반 |
| 3 | **13** | **17** | 중반 주력 |
| 4 | **11** | **10** | 후반 핵심 |
| 5 | **8** | **9** | 전설급 |

초기 컷:

```text
1코: rating 하위 14
2코: 다음 14
3코: 다음 13
4코: 다음 11
5코: 상위 8
```

단, 동일 역할이 한 코스트에 45%를 넘으면 경계에 있는 유닛끼리 최대 1코스트 범위에서 swap 가능하다.
`manual/unit-overrides.json`으로 최종 오버라이드 가능하지만 반드시 이유 문자열을 남긴다.

---

# 8. 전투 역할 자동 분류

각 유닛은 아래 5역할 중 1개를 가진다.

- `TANK`
- `BRUISER`
- `AD_CARRY`
- `AP_CARRY`
- `SUPPORT`

145명 내부 percentile을 사용한다.

```ts
tankScore =
  0.42*pStamina + 0.33*pGuts + 0.15*pIntelligence + 0.10*pPowerIndex;

bruiserScore =
  0.30*pPower + 0.25*pStamina + 0.20*pGuts + 0.15*pSpeed + 0.10*pPowerIndex;

adCarryScore =
  0.38*pPower + 0.32*pSpeed + 0.20*pPowerIndex + 0.10*pGuts;

apCarryScore =
  0.38*pIntelligence + 0.27*pSpeed + 0.25*pPowerIndex + 0.10*pGuts;

supportScore =
  0.42*pIntelligence + 0.25*pGuts + 0.18*versatilityScore + 0.15*pPowerIndex;
```

최고 점수 역할을 기본으로 하되 활성 60명에서 각 역할 최소 8명을 만족시킨다.

---

# 9. 전투 스탯 변환

## 9.1 기본 구조

```ts
type BattleUnitDef = {
  id: string;
  horseId: string;
  nameKo: string;
  cost: 1|2|3|4|5;
  role: "TANK"|"BRUISER"|"AD_CARRY"|"AP_CARRY"|"SUPPORT";
  hp: number;
  attackDamage: number;
  abilityPower: number;       // 기본 100
  armor: number;
  magicResist: number;
  attackSpeed: number;
  attackRange: 1|2|3|4;
  moveSpeedHexPerSec: number;
  critChance: number;         // 기본 0.25
  critMultiplier: number;     // 기본 1.30
  startMana: number;
  maxMana: number;
  traits: string[];
  skillId: string;
  source: {
    powerIndex: number;
    stats: object;
    birthYear: number;
    signatureId: string;
  };
};
```

## 9.2 코스트 기준치

| Cost | HP | AD | AS | Armor/MR 기준 | Mana |
|---:|---:|---:|---:|---:|---:|
| 1 | 650 | 48 | 0.68 | 28 | 0/70 |
| 2 | 720 | 54 | 0.70 | 30 | 0/70 |
| 3 | 820 | 60 | 0.72 | 32 | 0/75 |
| 4 | 930 | 68 | 0.74 | 35 | 0/80 |
| 5 | 1050 | 76 | 0.76 | 38 | 20/90 |

## 9.3 percentile 보정

```ts
hp =
  baseHp[cost] *
  (0.88 + 0.16*pStamina + 0.08*pGuts);

attackDamage =
  baseAD[cost] *
  (0.88 + 0.20*pPower + 0.04*pSpeed);

attackSpeed =
  baseAS[cost] *
  (0.92 + 0.16*pSpeed);

armor =
  baseResist[cost] +
  round(18*pStamina + 12*pGuts);

magicResist =
  baseResist[cost] +
  round(16*pIntelligence + 10*pGuts);

abilityPower = 100;

moveSpeedHexPerSec = 1.65 + 0.35*pSpeed;
```

최종 반올림:
- HP: 5단위
- AD: 정수
- 방어/마저: 정수
- AS: 소수점 둘째
- 이동속도: 소수점 둘째

## 9.4 공격 사거리

- TANK: 1
- BRUISER: 1
- AD_CARRY: 3, 단 추입이면 2
- AP_CARRY: 4
- SUPPORT: 3

## 9.5 마나

- TANK: 30/90
- BRUISER: 20/80
- AD_CARRY: 0/70
- AP_CARRY: 20/80
- SUPPORT: 30/90

도주 유닛은 시작마나 -10, 선행 +0, 선입 +10, 추입 +15 보정. 0 미만 금지.

---

# 10. 별 등급

구매되는 유닛은 1성.

- 동일 1성 3개 → 2성
- 동일 2성 3개 → 3성
- 총 9개 필요
- 합성은 준비 단계에서 즉시
- 전투 중 필드 유닛은 전투 종료 후 합성
- 벤치 유닛끼리만으로 합성 가능하면 전투 중에도 처리 가능

스탯 배율:

| 별 | HP/AD | 스킬 기본 배율 |
|---:|---:|---:|
| 1 | 1.00 | 1.00 |
| 2 | 1.80 | 1.45 |
| 3 (1~3코) | 3.24 | 2.20 |
| 3 (4코) | 3.24 | 3.60 |
| 3 (5코) | 3.24 | 6.00 |

3성 5코는 사실상 게임 종결급으로 설계하되 즉시 승리 코드는 넣지 않는다.

---

# 11. 특성 시스템

유닛은 기본적으로 3개 특성을 가진다.

1. 각질 특성 1개
2. 거리/주로 특성 1개
3. 역사/세대 특성 1개

5코스트는 최대 4개 가능.

| `nige` | **도주** | 2/4/6 | 공속 +10/25/45%, 이동속도 +10/20/35%. 6: 전투 시작 4초간 방해 효과 면역. |
| `senko` | **선행** | 2/4/6 | 체력 70% 이상일 때 피해 증폭 +8/15/25%. 첫 스킬까지 필요한 마나 -5/-10/-15. |
| `sashi` | **선입** | 2/4/6 | 적 처치 관여 시 6초간 치명타 +10/20/35%, 피해 증폭 +0/5/10%. |
| `oikomi` | **추입** | 2/4/6 | 대상 체력 50% 이하일 때 피해 증폭 +10/20/35%. 6: 처치 관여 시 즉시 마나 +20. |
| `sprinter` | **스프린터** | 2/4 | 기본 공격 3회마다 40/90 추가 물리피해. 공격속도 상한 +0/1. |
| `miler` | **마일러** | 2/4 | 스킬 사용 후 5초간 공격력/주문력 +10/25%. |
| `middle` | **중거리** | 2/4 | 전투 8초 후 최대 체력 +8/18%, 공격력/주문력 +8/18%. |
| `stayer` | **스테이어** | 2/4 | 5초마다 잃은 체력의 4/8% 회복. 4: 전투 15초 후 방어력/마저 +25. |
| `dirt_champion` | **더트 챔피언** | 2/3/4 | 방어력/마저 +10/20/35, 군중제어 저항 +0/15/30%. |
| `all_rounder` | **올라운더** | 2/3 | 모든 피해 흡혈 +8/15%, 공격 사거리 +0/1(최대 4). |
| `golden_generation` | **황금세대** | 2/4/6 | 아군 전체 공격력/주문력 +5/10/18%. 6: 첫 패배를 막고 1초간 체력 1로 생존(유닛당 1회). |
| `famous_house` | **명가** | 2/4 | 전투 시작 시 최대 체력 +8/16%, 같은 명가 유닛끼리 인접하면 추가 방어력/마저 +10/20. |
| `international` | **국제파** | 2/3/4 | 스킬 피해 +8/15/25%, 적의 보호막에 주는 피해 +15/30/50%. |
| `unbeaten` | **무패 전설** | 2/3 | 전투 시작 시 8초간 피해 증폭 +12/25%. 3: 이 효과가 전투 종료까지 지속. |
| `comeback` | **역전극** | 2/4 | 체력 50% 아래에서 공격속도 +20/40%, 모든 피해 흡혈 +8/16%. |
| `triple_crown` | **삼관** | 2/3 | 스킬 피해 +15/30%. 3: 첫 스킬이 마나를 소모한 직후 최대 마나의 50% 회복. |
| `era_star` | **시대의 스타** | 2/4/6 | 아군 전체 치명타 +5/10/15%, 치명타 피해 +5/10/20%. |
| `classic_legend` | **클래식 레전드** | 2/4 | 방어력/마저 +8/18. 4: 전투 시작 6초간 피해 감소 10%. |
| `heisei_dynasty` | **헤이세이 왕조** | 2/4/6 | 공격력/주문력 +6/12/20%. |
| `reiwa_elite` | **레이와 엘리트** | 2/4 | 시작 마나 +10/20, 이동속도 +10/20%. |
| `queen` | **여왕** | 2/3 | 스킬 사용 시 체력이 가장 낮은 아군에게 최대 체력 8/14% 보호막. |
| `emperor` | **황제** | 1 | 고유 특성. 자신이 살아 있는 동안 모든 아군 피해 증폭 +5%, 군중제어 저항 +10%. 동일 특성 중복 불가. |
| `record_breaker` | **레코드 브레이커** | 2/3 | 기본 공격 4회마다 공격속도 +12/25% 영구 중첩(전투 중 최대 4회). |
| `iron_horse` | **철마** | 2/4 | 최대 체력 +10/20%, 체력 30% 이하에서 받는 피해 8/18% 감소. |

## 11.1 각질 결정

`aptitudes`/`archetype`/`raceTraits`에서 대표 주행 스타일을 읽는다.

우선순위:
1. 데이터 신뢰도 높은 대표 스타일
2. archetype
3. raceTraits
4. 없으면 `senko`

## 11.2 거리 특성

대표 적성 점수가 가장 높은 거리 하나:

- SPRINT → `sprinter`
- MILE → `miler`
- MIDDLE → `middle`
- LONG → `stayer`

더트 적성이 잔디보다 명확히 높고 표본 충분하면 거리 대신 `dirt_champion`.
잔디/더트 모두 상위 25%이고 거리 3개 이상 상위 적성이면 `all_rounder`.

## 11.3 역사 특성 자동 판정

우선순위:

1. 삼관/암말 삼관 → `triple_crown`
2. 무패 G1급 챔피언 → `unbeaten`
3. 해외 최고등급 승리 → `international`
4. 이름/혈통/게임 설정상 명가 그룹 룰 일치 → `famous_house`
5. 대표적 역전/저평가 승리 지표 상위 10% → `comeback`
6. durability 상위 10% → `iron_horse`
7. 레코드/속도 지표 상위 5% → `record_breaker`
8. 출생연도:
   - <=1989 `classic_legend`
   - 1990~2009 `heisei_dynasty`
   - >=2010 `reiwa_elite`

특수 수동 태그 `queen`, `emperor`, `golden_generation`, `era_star`는 `trait-overrides.json`에 명시한다.

---

# 12. 스킬 생성

## 12.1 원칙

145명 각각 별도 하드코딩 함수 금지.
`SkillDef` JSON DSL + 12개 공통 행동 템플릿으로 구성한다.

```ts
type SkillDef = {
  id: string;
  displayName: string;
  template:
    | "DASH_LINE"
    | "AOE_BURST"
    | "SINGLE_EXECUTE"
    | "SHIELD_TAUNT"
    | "HEAL_BUFF"
    | "BACKLINE_DIVE"
    | "MULTI_SHOT"
    | "CONE"
    | "AURA"
    | "CONTROL"
    | "RAMP"
    | "SUMMON";
  baseValues: number[];
  starMultipliers: number[];
  damageType: "PHYSICAL"|"MAGIC"|"TRUE"|"NONE";
  targetRule: string;
  effects: EffectDef[];
  vfxKey: string;
};
```

## 12.2 역할→템플릿 후보

- TANK: `SHIELD_TAUNT`, `CONTROL`, `AURA`
- BRUISER: `DASH_LINE`, `CONE`, `RAMP`
- AD_CARRY: `MULTI_SHOT`, `SINGLE_EXECUTE`, `DASH_LINE`
- AP_CARRY: `AOE_BURST`, `CONTROL`, `BACKLINE_DIVE`
- SUPPORT: `HEAL_BUFF`, `AURA`, `CONTROL`

## 12.3 각질 보정

- 도주: 전방 직선, 자기 가속
- 선행: 보호막/안정적 광역
- 선입: 중거리 돌진/타겟 변경
- 추입: 후열 침투/낮은 체력 처형

## 12.4 이름

가능하면 `signature.name` 또는 대표 경주명을 안전하게 조합:

```text
"{signatureDisplayName}"
```

signature 표시명이 없으면:

```text
"{캐릭터명} - 라스트 스퍼트"
```

공식 게임의 고유 스킬 텍스트를 복사하지 않는다.

---

# 13. 전장과 좌표

## 13.1 논리 보드

- 플레이어 진영: 7열 × 4행
- 적 진영: 7열 × 4행
- 전투 시 합쳐서 7 × 8 hex grid
- offset coordinate: odd-r
- 플레이어 벤치: 9칸
- 아이템 보관: 10칸

## 13.2 1920×1080 레이아웃

```text
Top HUD:       x 0~1920, y 0~72
Left panel:    x 0~280,  y 72~824
Battle field: x 300~1620,y 72~730
Right panel:   x 1640~1920,y 72~824
Bench:         x 300~1620,y 742~824
Shop:          x 300~1620,y 836~1018
Footer:        y 1018~1080
```

반응형은 전체 게임 캔버스를 비율 유지 scale한다.
논리 좌표는 1920×1080에서만 계산하고 CSS scale로 축소한다.

## 13.3 Hex

- 중심 간 X: 112 px
- 중심 간 Y: 82 px
- odd row X offset: 56 px
- 유닛 anchor: cell center
- 보드 렌더 크기와 논리 좌표를 분리

---

# 14. 전투 엔진

## 14.1 고정 timestep

- 시뮬레이션: 50ms fixed step
- 렌더: requestAnimationFrame
- 렌더는 두 sim state를 interpolation
- 전투 로직은 Phaser API 사용 금지

## 14.2 타겟팅

기본 우선순위:

1. 현재 타겟이 살아 있고 사거리 접근 가능하면 유지
2. 도발 대상
3. hex distance 최소 적
4. 동률: 현재 체력 비율 낮은 적
5. 동률: unitId 사전순

## 14.3 이동

- A* hex pathfinding
- 다른 유닛이 점유한 cell은 blocked
- 목적지는 공격 사거리 안에 들어가는 가장 가까운 free cell
- 500ms 이상 길막이면 path 재계산
- 완전 고립 시 다음 타겟 탐색

## 14.4 공격

```ts
attackCooldown = 1 / attackSpeed;
```

기본 치명타:
- 확률 25%
- 배율 130%
- 스킬은 기본적으로 치명타 불가

## 14.5 방어 계산

저항 >= 0:

```ts
multiplier = 100 / (100 + resist);
```

저항 < 0:

```ts
multiplier = 2 - 100 / (100 - resist);
```

## 14.6 마나

기본 공격:
```text
+10 mana
```

피격:
```ts
manaFromDamage =
  min(50, preMitigationDamage*0.01 + postMitigationDamage*0.07);
```

스킬 사용 후 기본 mana lock 1초.

## 14.7 전투 종료/오버타임

- 30초까지 정상 전투
- 30초에 오버타임 진입
- 추가 15초
- 오버타임:
  - 공격속도 +300% (최종 ×4, cap 5.0)
  - 공격력/주문력 ×3
  - CC 지속시간 ×0.34
  - 회복/보호막 ×0.34
- 45초에도 양측 생존 시 무승부

---

# 15. 플레이어 피해

스테이지 기본 피해:

| Stage | 기본 피해 |
|---:|---:|
| 1~2 | 0 |
| 3 | 2 |
| 4 | 3 |
| 5 | 5 |
| 6 | 8 |
| 7 | 15 |
| 8+ | 150 |

생존 적 유닛 추가 피해:

| 생존 수 | 추가 피해 |
|---:|---:|
| 0 | 0 |
| 1 | 2 |
| 2 | 4 |
| 3 | 6 |
| 4 | 8 |
| 5 | 10 |
| 6 | 11 |
| 7 | 12 |
| 8 | 13 |
| 9 | 14 |
| 10+ | `5 + count` |

최종 피해:

```ts
damage = baseStageDamage + survivorDamage;
```

트레이너 방패/증강 등으로 감소하더라도 패배 피해 최소 1.

무승부는 양측 모두 `1 + survivorDamage(상대 생존수)` 적용, 연승/연패 초기화.

---

# 16. 경제

## 16.1 시작

- 시작 체력: 100
- 시작 골드: 0
- 시작 레벨: 1
- 1-1 시작 전 `트윙클 스타트 선택` 실시

## 16.2 라운드 수입

- 1-1 종료: +2
- 1-2 종료: +2
- 1-3 종료: +4
- 2-1 이후: 기본 +5

추가:
- PvP 승리 +1
- 10골드당 이자 +1, 최대 +5
- 연승/연패:
  - 2~4: +1
  - 5: +2
  - 6+: +3

## 16.3 상점/XP

- 상점 새로고침: 2골드
- XP 구매: 4골드 → XP 4
- 매 PvP/PvE 라운드 종료: 자동 XP +2

## 16.4 레벨 필요 XP

| 목표 레벨 | 필요 XP |
|---:|---:|
| 2 | 2 |
| 3 | 2 |
| 4 | 6 |
| 5 | 10 |
| 6 | 20 |
| 7 | 36 |
| 8 | 60 |
| 9 | 68 |
| 10 | 68 |

---

# 17. 상점

## 17.1 슬롯

- 5개
- 라운드 시작 자동 새로고침
- lock 가능
- lock 시 다음 라운드 자동 새로고침하지 않음

## 17.2 레벨별 코스트 확률

| Cost \ Lv | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 |100|100|75|55|45|30|19|18|10|5|
| 2 |0|0|25|30|33|40|35|25|20|10|
| 3 |0|0|0|15|20|25|35|36|25|20|
| 4 |0|0|0|0|2|5|10|18|35|40|
| 5 |0|0|0|0|0|0|1|3|10|25|

각 열 합계 100 검증.

## 17.3 공유 풀

유닛마다:

```text
1코 22
2코 20
3코 17
4코 10
5코 9
```

구매 시 감소, 판매 시 반환.
2성은 3장, 3성은 9장을 점유한다.

탈락한 플레이어의 모든 보유 유닛은 즉시 pool에 반환한다.

상점에 roll된 상태의 유닛은 아직 pool에서 빼지 않는다. 구매 순간만 차감.
한 번의 shop 생성 중 동일 복제 수량을 초과해서 노출되지 않도록 provisional reservation을 사용한다.

---

# 18. 판매 가격

- 1코: 투자 비용 전액
- 2~5코:
  - 1성: cost
  - 2성: `cost*3 - 1`
  - 3성: `cost*9 - 1`

아이템은 판매 시 자동으로 아이템 보관함으로 이동.
보관함이 부족하면 판매 불가.

---

# 19. 라운드 일정

## 19.1 Stage 1

| Round | 종류 |
|---|---|
| 1-1 | 스타트 선택 + PvE |
| 1-2 | PvE |
| 1-3 | PvE |

## 19.2 Stage 2 이후

각 stage는 7라운드:

| Round | 종류 |
|---|---|
| x-1 | PvP |
| x-2 | PvP |
| x-3 | PvP |
| x-4 | 트윙클 드래프트 |
| x-5 | PvP |
| x-6 | PvP |
| x-7 | PvE |

증강:
- 2-1 준비 단계 전
- 3-2 준비 단계 전
- 4-2 준비 단계 전

## 19.3 준비 시간

- 일반 PvP: 30초
- PvE: 20초
- 증강: 45초
- 드래프트: 30초
- 개발 모드에서는 즉시 진행 버튼 제공

---

# 20. 트윙클 드래프트

TFT 공동 선택을 우마 테마로 재해석한 시스템.

- 중앙 트랙에 9개의 `유닛 + 재료 아이템` 조합 표시
- 2026-09-09 요청 반영: 기물이 회전하며, 트레이너를 직접 움직여 먼저 접촉한 참가자가 획득
- 바닥 좌클릭/우클릭·방향키 이동, 기물 클릭은 따라가기 목표 지정
- 1-1 첫 선택은 seeded RNG로 출발 위치를 정하고 2.5초 후 전원 동시 출발
- 이후:
  - 체력 낮은 순
  - 2명씩 4.5초 간격으로 출발
  - 동일 체력은 해당 체력에 먼저 도달한 플레이어 우선
  - 그래도 동일하면 seeded RNG
- 서버/싱글 엔진이 이동 속도·접촉을 판정하며 각 참가자는 한 번만 획득
- 출발 후 12초 내 미획득 시 자동 이동, 모두 획득한 뒤 1.2초 후 준비 단계 진행
- 선택한 유닛은 pool에서 차감
- 아이템은 즉시 분리되어 보관함으로 들어가고 유닛은 벤치로. 보관함이 가득 찼으면 획득 유닛이 재료를 장착
- 대량 시뮬레이터는 기존 즉시 선택 방식 유지; 실제 싱글/온라인 경기는 이동 기반 공동 선택 사용
- 벤치가 가득 차면 임시 1칸을 허용하고 다음 준비 단계 종료 전 정리 강제

---

# 21. PvE

PvE 유닛은 캐릭터 pool을 쓰지 않는다.

종류:
- 연습용 허수아비
- 트랙 골렘
- 보급 로봇
- 트로피 수호자
- 그랜드 트로피 수호자

보상 오브:
- 회색: 1~3골드
- 파랑: 재료 아이템 또는 2~4골드
- 금색: 완성 아이템 모루/복제기/5~8골드

PvE에서 패배해도 플레이어 피해는 받지 않지만 해당 라운드 보상 1단계 감소.

---

# 22. PvP 매칭

- 직전 상대와 즉시 재매칭 금지
- 가능한 상대 중 seeded shuffle
- 생존 인원이 홀수면 1명은 고스트 보드와 전투
- 고스트에게 이겨도 원본에게 피해 없음
- 고스트에게 지면 자신의 체력 피해는 정상 적용
- 고스트는 전투 시작 snapshot만 사용

다른 AI끼리 전투는 동일 `BattleEngine`을 headless 20× 속도로 처리.

---

# 23. 아이템

## 23.1 장착 규칙

- 유닛당 최대 3 슬롯
- 재료 2개가 한 유닛에 장착되면 즉시 조합
- 완성 아이템은 다시 분해 불가
- 같은 완성 아이템 중복 가능, 단 `UNIQUE` 플래그가 있으면 불가
- 전투 중 필드 유닛에게 장착 금지
- 준비 단계/벤치에는 장착 가능

## 23.2 재료 10종

| ID | 이름 | 기본 효과 | 코드 |
|---|---|---|---|
| `winner_ribbon` | **우승자 리본** | +10% 공격력 | `AD` |
| `reinforced_horseshoe` | **강화 편자** | +20 방어력 | `AR` |
| `training_belt` | **트레이닝 벨트** | +150 체력 | `HP` |
| `tactics_notebook` | **작전 노트** | +10 주문력 | `AP` |
| `spurt_band` | **스퍼트 밴드** | +10% 공격속도 | `AS` |
| `focus_drop` | **집중의 물방울** | +15 시작 마나 | `MN` |
| `weather_cloak` | **비바람 망토** | +20 마법저항력 | `MR` |
| `race_glove` | **레이스 글러브** | +20% 치명타 확률 | `CR` |
| `factor_badge` | **인자 배지** | 능력치 없음 | `SP` |
| `support_card` | **서포트 카드** | 능력치 없음 | `PN` |

## 23.3 전체 55 조합

| ID | 조합 | 완성 이름 | 효과 |
|---|---|---|---|
| `champion_trophy` | 우승자 리본 + 우승자 리본 | **챔피언 트로피** | 기본 공격력 합산 후 추가 공격력 +20%. |
| `twilight_racing_suit` | 우승자 리본 + 강화 편자 | **황혼의 승부복** | 체력이 처음 60% 아래로 내려가면 0.75초 동안 대상 지정 불가. 이후 5초간 공격속도 +25%. 전투당 1회. |
| `unyielding_fighting_spirit` | 우승자 리본 + 트레이닝 벨트 | **불굴의 승부근성** | 체력이 처음 60% 아래로 내려가면 최대 체력 25% 보호막(5초) + 공격력 20%. 전투당 1회. |
| `trainer_lifeblade` | 우승자 리본 + 작전 노트 | **트레이너 생명검** | 모든 피해 흡혈 20%. 피해로 회복한 양의 20%를 체력이 가장 낮은 아군에게 회복. |
| `giant_overtaker` | 우승자 리본 + 스퍼트 밴드 | **거인 추월자** | 피해량 +15%. 대상 최대 체력이 1600 이상이면 추가로 피해량 +25%. |
| `start_dash_plan` | 우승자 리본 + 집중의 물방울 | **스타트 대시 작전** | 기본 공격마다 추가 마나 +5. |
| `victory_bloodwind` | 우승자 리본 + 비바람 망토 | **우승의 혈풍** | 모든 피해 흡혈 20%. 체력이 처음 40% 아래로 내려가면 최대 체력 25% 보호막(5초). |
| `finish_line_strike` | 우승자 리본 + 레이스 글러브 | **결승선의 일격** | 치명타 피해 +35%. 스킬이 치명타 적용 가능. 초과 치명타 확률은 1%당 치명타 피해 +0.5%. |
| `iron_stable` | 강화 편자 + 강화 편자 | **철벽 마굿간** | 받는 치명타 피해 25% 감소. 기본 공격 피격 시 주변 1칸 적에게 60 마법피해, 2초 재사용. |
| `heated_training_blanket` | 강화 편자 + 트레이닝 벨트 | **열혈 훈련 담요** | 2초마다 2칸 내 적 1명에게 10초 화상: 초당 대상 최대 체력 1% 고정피해, 치유량 33% 감소. |
| `trainer_crownguard` | 강화 편자 + 작전 노트 | **트레이너 크라운가드** | 전투 시작 시 최대 체력 25% 보호막(8초). 보호막 종료 시 주문력 +20. |
| `iron_horseshoe_resolve` | 강화 편자 + 스퍼트 밴드 | **철편자의 결의** | 공격하거나 피해를 받으면 결의 1중첩(최대 25). 중첩당 공격력/주문력 +2%. 최대 중첩 시 방어력/마저 +20. |
| `pre_race_vow` | 강화 편자 + 집중의 물방울 | **출전 전 맹세** | 체력이 처음 40% 아래로 내려가면 최대 체력 25% 보호막(5초), 방어력/마저 +20. 전투당 1회. |
| `racecourse_stoneplate` | 강화 편자 + 비바람 망토 | **경주장 석갑** | 자신을 공격 대상으로 삼은 적 1명당 방어력/마저 +10. |
| `steadfast_heart` | 강화 편자 + 레이스 글러브 | **굳건한 하트** | 받는 피해 8% 감소. 현재 체력이 50% 이상일 때 감소량 15%. |
| `long_distance_training_coat` | 트레이닝 벨트 + 트레이닝 벨트 | **장거리 훈련 코트** | 추가 체력 +600, 최대 체력 +12%. |
| `burning_spirit_strategy` | 트레이닝 벨트 + 작전 노트 | **타오르는 투지의 작전서** | 스킬 피해를 받은 적에게 10초 화상: 초당 최대 체력 1% 고정피해, 치유량 33% 감소. |
| `pace_up_snack` | 트레이닝 벨트 + 스퍼트 밴드 | **페이스 업 보급식** | 스킬 사용 후 5초간 공격속도 +40%. |
| `recovery_saddle` | 트레이닝 벨트 + 집중의 물방울 | **회복의 안장** | 받는 모든 회복/보호막 +25%. 5초마다 최대 체력 2.5% 회복. |
| `evening_race_armor` | 트레이닝 벨트 + 비바람 망토 | **야간 경주 갑주** | 2칸 내 적의 방어력/마저 20% 감소. 전투 시작 후 10초간 최대 체력 +10%. |
| `frontline_retake_mallet` | 트레이닝 벨트 + 레이스 글러브 | **선두 탈환 메달** | 피해를 받거나 입히면 추월 중첩(최대 12). 중첩당 공격력/주문력 +1.5%. 최대 중첩 시 피해 증폭 +10%. |
| `genius_trainer_hat` | 작전 노트 + 작전 노트 | **천재 트레이너 모자** | 주문력 +50 추가, 스킬 피해 +10%. |
| `endless_spurt` | 작전 노트 + 스퍼트 밴드 | **끝없는 스퍼트** | 기본 공격 시 공격속도 +5% 누적. 최대 12중첩. |
| `accumulated_fighting_spirit` | 작전 노트 + 집중의 물방울 | **축적된 투지** | 전투 시작 후 5초마다 주문력 +20. |
| `gate_shock_device` | 작전 노트 + 비바람 망토 | **게이트 충격기** | 2칸 내 적의 마저 30% 감소. 적이 스킬을 사용할 때 해당 적에게 최대 마나의 160% 마법피해, 대상별 3초 재사용. |
| `jewel_race_glove` | 작전 노트 + 레이스 글러브 | **보석 레이스 글러브** | 스킬이 치명타 적용 가능. 치명타 피해 +20%, 주문력 +15 추가. |
| `red_turf_booster` | 스퍼트 밴드 + 스퍼트 밴드 | **레드 터프 부스터** | 공격속도 +35% 추가. 기본 공격이 5초간 화상(초당 최대 체력 1%, 치유량 33% 감소). |
| `corner_piercer` | 스퍼트 밴드 + 집중의 물방울 | **코너 관통봉** | 기본 공격 후 대상 주변 1칸의 추가 적 1명에게 45% 물리피해. 공격 시 마나 +2. |
| `breakaway_horseshoe` | 스퍼트 밴드 + 비바람 망토 | **파죽지세 편자** | 같은 대상을 3회 공격할 때마다 90 고정피해 + 대상 최대 체력 3% 고정피해. |
| `last_overtake` | 스퍼트 밴드 + 레이스 글러브 | **최후의 추월** | 물리 피해를 입히면 5초간 대상 방어력 30% 감소. 공격속도 +20% 추가. |
| `blue_focus` | 집중의 물방울 + 집중의 물방울 | **푸른 집중력** | 시작 마나 +25 추가. 스킬 사용 후 마나 10 회복. 최대 마나가 60 이하인 유닛은 추가로 마나 10 회복. |
| `adaptive_headgear` | 집중의 물방울 + 비바람 망토 | **적응형 헤드기어** | 전투 시작 위치에 따라: 앞 2열이면 방어력/마저 +35, 뒤 2열이면 3초마다 마나 +10. |
| `hand_of_victory` | 집중의 물방울 + 레이스 글러브 | **승리의 손길** | 전투 시작 시 두 효과 중 1개를 무작위로 2배 적용: 공격력/주문력 +15%, 모든 피해 흡혈 15%. 체력 50% 아래에서는 두 효과 모두 적용. |
| `stormproof_racing_cloak` | 비바람 망토 + 비바람 망토 | **폭풍 방지 마의** | 마법저항력 +65 추가. 2초마다 최대 체력 2.5% 회복. |
| `composure_ribbon` | 비바람 망토 + 레이스 글러브 | **평정의 리본** | 전투 시작 후 18초간 군중제어 면역. 공격속도 +20% 추가. |
| `trick_strategy_gloves` | 레이스 글러브 + 레이스 글러브 | **변칙 작전 글러브** | 아이템 슬롯 3칸을 사용. 매 준비 단계 종료 시 현재 라운드에 적합한 완성 아이템 2개를 무작위 장착. 같은 완성 아이템 중복 불가. |
| `emblem_nige` | 인자 배지 + 우승자 리본 | **도주 인자** | 도주 특성 +1. |
| `emblem_senko` | 인자 배지 + 강화 편자 | **선행 인자** | 선행 특성 +1. |
| `emblem_sashi` | 인자 배지 + 트레이닝 벨트 | **선입 인자** | 선입 특성 +1. |
| `emblem_oikomi` | 인자 배지 + 작전 노트 | **추입 인자** | 추입 특성 +1. |
| `emblem_sprinter` | 인자 배지 + 스퍼트 밴드 | **스프린터 인자** | 스프린터 특성 +1. |
| `emblem_miler` | 인자 배지 + 집중의 물방울 | **마일러 인자** | 마일러 특성 +1. |
| `emblem_middle` | 인자 배지 + 비바람 망토 | **중거리 인자** | 중거리 특성 +1. |
| `emblem_stayer` | 인자 배지 + 레이스 글러브 | **스테이어 인자** | 스테이어 특성 +1. |
| `emblem_golden_generation` | 서포트 카드 + 우승자 리본 | **황금세대 엠블럼** | 황금세대 특성 +1. |
| `emblem_famous_house` | 서포트 카드 + 강화 편자 | **명가 엠블럼** | 명가 특성 +1. |
| `emblem_dirt_champion` | 서포트 카드 + 트레이닝 벨트 | **더트 챔피언 엠블럼** | 더트 챔피언 특성 +1. |
| `emblem_international` | 서포트 카드 + 작전 노트 | **국제파 엠블럼** | 국제파 특성 +1. |
| `emblem_unbeaten` | 서포트 카드 + 스퍼트 밴드 | **무패 전설 엠블럼** | 무패 전설 특성 +1. |
| `emblem_comeback` | 서포트 카드 + 집중의 물방울 | **역전극 엠블럼** | 역전극 특성 +1. |
| `emblem_triple_crown` | 서포트 카드 + 비바람 망토 | **삼관 엠블럼** | 삼관 특성 +1. |
| `emblem_era_star` | 서포트 카드 + 레이스 글러브 | **시대의 스타 엠블럼** | 시대의 스타 특성 +1. |
| `trainer_crown` | 인자 배지 + 인자 배지 | **트레이너 왕관** | 전략가 전용. 팀 최대 규모 +1. 유닛에게 장착하지 않음. |
| `trainer_cloak` | 인자 배지 + 서포트 카드 | **트레이너 망토** | 전략가 전용. 팀 최대 규모 +1. 전투 시작 시 아군 전체 이동속도 +10%(10초). |
| `trainer_shield` | 서포트 카드 + 서포트 카드 | **트레이너 방패** | 전략가 전용. 팀 최대 규모 +1. 플레이어가 받는 라운드 피해 10% 감소(최소 1). |

## 23.4 아이템 DSL

```ts
type ItemDef = {
  id: string;
  name: string;
  components: [string,string];
  stats: Partial<BattleStats>;
  tags: ("DAMAGE"|"TANK"|"MANA"|"UTILITY"|"EMBLEM"|"TACTICIAN")[];
  unique?: boolean;
  effects: EffectDef[];
};
```

아이템 ID별 `if/else`를 BattleEngine에 넣지 않는다.
효과는 공통 EffectSystem으로 처리한다.

---

# 24. 특성 엠블럼

`인자 배지` 또는 `서포트 카드` 조합으로 16개 제작 가능.
해당 유닛이 이미 같은 특성을 갖고 있으면 장착 불가.

전략가 전용 3개:
- 트레이너 왕관
- 트레이너 망토
- 트레이너 방패

이 3개는 유닛 아이템 3슬롯을 차지하지 않는다.

---

# 25. 증강체 48종

등급:
- S = Silver
- G = Gold
- P = Prism

각 선택 시 같은 등급 3개를 제시.
동일 증강 중복 제시 금지.
이미 선택한 증강 재등장 금지.

| ID | 등급 | 이름 | 효과 |
|---|:---:|---|---|
| `economy_interest_seed` | S | **저축의 미학** | 최대 이자 +1. 즉시 5골드. |
| `economy_free_refresh` | S | **가벼운 재편** | 매 라운드 첫 상점 새로고침 무료. |
| `economy_sell_back` | S | **깔끔한 정리** | 2·3성 판매 손실이 추가로 1골드 감소. |
| `shop_low_cost` | S | **기초 훈련 집중** | 1·2코 상점 등장 후 해당 코스트 내 중복 유닛 가중치 +8%. |
| `trait_nige` | S | **도주의 기본** | 도주 유닛 공격속도 +8%. 도주 유닛 1명 획득. |
| `trait_senko` | S | **선행의 기본** | 선행 유닛 최대 체력 +6%. 선행 유닛 1명 획득. |
| `trait_sashi` | S | **선입의 기본** | 선입 유닛 치명타 +8%. 선입 유닛 1명 획득. |
| `trait_oikomi` | S | **추입의 기본** | 추입 유닛 처형 기준 체력 50%→55%. 추입 유닛 1명 획득. |
| `item_component_choice` | S | **트레이닝 보급** | 재료 아이템 선택 모루 1개. |
| `item_remove` | S | **장비 점검** | 아이템 제거기 2개. |
| `combat_front_guard` | S | **초반 버티기** | 앞 2열 유닛 방어력/마저 +8. |
| `combat_back_focus` | S | **후열 집중** | 뒤 2열 유닛 시작 마나 +5. |
| `bench_expand` | S | **넓은 마방** | 벤치 +1칸. |
| `xp_small` | S | **집중 육성** | 즉시 경험치 8. |
| `healing_small` | S | **컨디션 관리** | 아군 모든 회복/보호막 +8%. |
| `crit_small` | S | **승부 감각** | 아군 치명타 확률 +5%. |
| `economy_rich` | G | **대형 스폰서** | 즉시 18골드. 이후 기본 라운드 수입 -1. |
| `economy_streak` | G | **연승의 박자** | 연승/연패 보너스 골드 구간을 1연속 앞당김. |
| `shop_pair_hunter` | G | **쌍둥이 훈련** | 상점에 보유 유닛과 동일 유닛이 등장할 상대 가중치 +15%. |
| `reroll_credit` | G | **리롤 크레딧** | 라운드마다 리롤 2회까지 비용 1골드. |
| `trait_distance_flex` | G | **거리 적성 확장** | 스프린터/마일러/중거리/스테이어 중 현재 가장 높은 특성 +1. |
| `trait_surface_flex` | G | **주로 적응** | 더트 챔피언 또는 올라운더 중 현재 더 높은 특성 +1. |
| `trait_legacy_flex` | G | **명예의 혈통** | 황금세대/명가/국제파/삼관 중 무작위 엠블럼 1개. |
| `item_complete_anvil` | G | **완성 장비 보급** | 완성 아이템 선택 모루 1개. |
| `item_reforge` | G | **장비 재조정** | 재조합기 2개. |
| `combat_first_cast` | G | **선수필승** | 아군 첫 스킬 피해 +25%. |
| `combat_last_stand` | G | **마지막 직선** | 체력 30% 아래 아군 피해 증폭 +20%. |
| `combat_adjacent` | G | **페이스메이커** | 전투 시작 시 인접 아군 2명 이상인 유닛 방어력/마저 +15. |
| `combat_isolated` | G | **단독 질주** | 전투 시작 시 인접 아군이 없는 유닛 공격력/주문력 +18%. |
| `clone_low` | G | **육성 복제권** | 1~3코 유닛 복제기 1개. |
| `level_cap_speed` | G | **조기 승급** | 다음 레벨업에 필요한 경험치 12 감소(최소 0). |
| `player_damage_guard` | G | **안전한 운영** | 플레이어가 받는 전투 피해 2 감소(최소 1). |
| `economy_windfall` | P | **대박 스폰서 계약** | 즉시 40골드. 최대 이자 +2. |
| `shop_high_cost` | P | **스타 발굴** | 4·5코 상점 등장 확률을 레벨별 총 +5%p, 1코부터 비례 차감. |
| `shop_extra_slot` | P | **확장 스카우팅** | 상점 슬롯 5→6칸. |
| `team_size` | P | **특별 출전권** | 팀 최대 규모 +1. |
| `trait_any_emblem` | P | **궁극의 인자** | 원하는 제작 가능 특성 엠블럼 1개 선택. |
| `trait_double` | P | **이중 적성** | 선택한 유닛 1명에게 장착 아이템과 별개로 보조 특성 +1 부여. 같은 유닛 1회. |
| `item_radiant` | P | **찬란한 레이스 장비** | 찬란한 완성 아이템 선택 모루 1개. MVP에서는 일반 아이템 효과 ×1.5 프리셋 사용. |
| `item_crown` | P | **왕관의 자격** | 트레이너 왕관 1개. |
| `combat_all_stats` | P | **완성형 육성** | 아군 공격력/주문력/방어력/마저 +12%, 공격속도 +12%. |
| `combat_execute` | P | **결승선 집념** | 아군이 체력 12% 미만 적을 즉시 처치. |
| `combat_revive` | P | **기적의 복귀** | 각 유닛이 처음 사망할 때 1.5초 후 체력 25%로 부활. 유닛당 1회. |
| `combat_mana` | P | **완벽한 작전** | 모든 아군 시작 마나 +20, 최대 마나 -10(최소 30). |
| `clone_any` | P | **전설의 복제권** | 모든 코스트 유닛 복제기 1개. |
| `level_10` | P | **엘리트 트레이너** | 즉시 경험치 36. 10레벨 상점에서 5코 등장확률 +5%p. |
| `bench_dual` | P | **대형 트레이닝 센터** | 벤치 +2칸, 아이템 보관함 +2칸. |
| `overtime_master` | P | **장기전의 제왕** | 전투 15초 후 아군 공격력/주문력 +25%, 받는 피해 15% 감소. |

---

# 26. AI

## 26.1 AI 7명

매치 시작 시 아래 성향 중 7개 배정:

1. `BALANCED`
2. `REROLL`
3. `FAST_LEVEL`
4. `ECONOMY`
5. `AD_FOCUS`
6. `AP_FOCUS`
7. `TRAIT_FOCUS`

## 26.2 AI가 볼 수 있는 정보

사람 플레이어와 동일한 공개 정보만 사용:
- 자신의 상점
- 자신의 벤치/보드/아이템
- 다른 플레이어가 현재 보유한 공개 유닛/별/특성
- 전체 남은 pool 수량은 **직접 알 수 없음**
- 숨은 RNG state를 읽지 않음

## 26.3 구매 점수

```ts
buyScore =
  pairNeed*2.2 +
  upgradeNeed*3.0 +
  traitFit*1.5 +
  roleFit*1.2 +
  itemFit*0.8 +
  rawPower*0.8 -
  benchPressure*1.3 -
  econPenalty;
```

- 3성 완성 직전이면 최고 가중치
- 현재 핵심 2개 특성과 맞는 유닛 우선
- 5코라도 시너지/경제가 나쁘면 무조건 구매하지 않음

## 26.4 레벨/리롤

- REROLL: 핵심 1~3코 3성 목표, 목표 레벨에서 돈 50 이상 리롤
- FAST_LEVEL: 50골드 이자 유지하며 빠른 8/9레벨
- ECONOMY: 30골드 이하 리롤 거의 금지
- BALANCED: 체력 <55이면 강해지기 위해 소비
- TRAIT_FOCUS: 가장 높은 활성 특성에 맞는 유닛 우선

## 26.5 배치

점수 기반 탐색:
- Tank 앞 2열
- Bruiser 앞/중앙
- AD/AP carry 뒤 2열
- Support carry 옆
- 상대 암살/후열 침투가 많으면 캐리 코너 고정 금지
- 최대 40개 후보 배치만 평가하여 성능 확보

## 26.6 아이템

태그 기반:
- DAMAGE → AD_CARRY/BRUISER
- AP/MANA → AP_CARRY/SUPPORT
- TANK → TANK
- EMBLEM → 특성 완성도가 가장 많이 증가하는 유닛

---

# 27. UI

## 27.1 화면

1. Boot/Loading
2. Title
3. Main Menu
4. Match Setup
5. Battle
6. Twinkle Draft
7. Augment Select
8. Collection
9. Settings
10. Final Result

## 27.2 Battle HUD

좌:
- 현재 활성 특성
- 아이템 보관함

상:
- Stage/Round
- 준비 남은 시간
- 체력
- 골드
- 레벨/XP
- 연승/연패

우:
- 8명 순위
- 각 플레이어 체력
- 관전 버튼

하:
- 벤치 9칸
- 상점 5칸
- 리롤
- 잠금
- XP 구매

## 27.3 입력

- 좌클릭: 선택
- 드래그: 유닛/아이템 이동
- 우클릭: 상세 정보
- D: 리롤
- F: XP 구매
- E: 마우스오버 유닛 판매
- W: 마우스오버 유닛 보드↔벤치
- Space: 내 보드
- 1/3: 이전/다음 플레이어 관전
- Tab: 전투 정보
- Esc: 설정

키 바인딩은 설정에서 수정 가능.

---

# 28. 툴팁

유닛 우클릭:
- 이름/코스트/별
- HP/AD/AP/AS/Armor/MR/Range/Mana
- 역할
- 특성
- 스킬
- 장착 아이템
- 실제 말 데이터 요약:
  - 출생연도
  - powerIndex
  - 대표 거리/주로
  - signature
- `UmaRogue tier`는 표시하지 않는다.

---

# 29. 도감

145명 모두 표시.

필터:
- 이름
- Season 1 활성 여부
- 코스트
- 역할
- 각질
- 거리
- 더트
- 출생연대
- 특성

비활성 캐릭터도 실제 데이터/초상화는 확인 가능하지만 표준 상점에서는 나오지 않음.

---

# 30. 저장

localStorage key:

```text
uma-fight-tactics-save-v1
```

저장 시점:
- 준비 단계 시작
- 준비 단계 종료
- 전투 종료
- 드래프트 종료
- 증강 선택 직후

저장:
- seed/rngState
- 모든 플레이어 상태
- pool
- shop
- round
- active roster version/hash
- 선택 증강
- 아이템
- 유닛 instance

전투 중 새로고침하면 해당 전투 시작 snapshot으로 되돌아가 deterministic 재실행.

---

# 31. RNG

`xorshift32`.

```ts
function nextUint32(state:number) {
  let x = state >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x >>> 0;
}
```

스트림 분리:
- match
- shop
- battle-pair-N
- ai-N
- draft
- loot

한 스트림의 호출 횟수가 다른 시스템 결과를 흔들지 않게 seed 파생.

---

# 32. 상태 머신

```text
BOOT
→ LOBBY
→ ROUND_PREP
→ AUGMENT_SELECT(optional)
→ DRAFT(optional)
→ BATTLE
→ ROUND_RESOLVE
→ ELIMINATION
→ NEXT_ROUND
→ ...
→ GAME_OVER
```

각 상태 전이는 단일 `RoundDirector`에서만 수행한다.

---

# 33. 데이터 스키마

## 33.1 MatchState

```ts
type MatchState = {
  version: 1;
  seed: number;
  phase: MatchPhase;
  stage: number;
  round: number;
  players: PlayerState[];
  pool: PoolState;
  activeRosterHash: string;
  battleSnapshots: BattleSnapshot[];
};
```

## 33.2 PlayerState

```ts
type PlayerState = {
  id: string;
  isHuman: boolean;
  hp: number;
  gold: number;
  level: number;
  xp: number;
  streak: number;
  board: UnitInstance[];
  bench: UnitInstance[];
  items: ItemInstance[];
  augments: string[];
  shop: ShopSlot[];
  shopLocked: boolean;
  placement?: number;
  aiProfile?: AiProfile;
};
```

## 33.3 UnitInstance

```ts
type UnitInstance = {
  instanceId: string;
  unitDefId: string;
  star: 1|2|3;
  sourceCopies: 1|3|9;
  items: string[];
  position?: { q:number; r:number };
};
```

---

# 34. 성능

목표:
- 1920×1080 / Chrome desktop
- 플레이어 전투 렌더 60fps 목표
- headless AI 전투는 frame render 없이 처리
- 한 매치에서 메모리 <250MB 목표
- 145 sprite sheet는 전부 선로드하지 않음
- 활성 60만 match 시작 전 lazy preload
- 화면에 필요한 portrait만 동적 load

---

# 35. 아트 fallback

각 asset key에 대해:
1. 실제 PNG 확인
2. 없으면 procedural fallback 생성
3. 오류 로그는 1회만

fallback:
- 캐릭터: cost 색 원형 + 이름 첫 글자
- 아이템: 48×48 도트 프레임 + 약어
- trait: 단색 심볼
- VFX: 원/선/파티클
- board: CSS/Phaser primitive

따라서 디자인팀 납품 전에도 게임 완주 가능해야 한다.

---

# 36. 개발자 도구

URL query:

```text
?dev=1
```

기능:
- +10 / +50 골드
- +20 XP
- 체력 1/50/100
- 원하는 유닛 1성/2성/3성 생성
- 모든 재료 아이템 생성
- 완성 아이템 검색 지급
- 특성 강제 활성
- 다음 라운드
- AI 일시정지
- 전투 1×/2×/4×/10×
- seed 표시/복사
- pool 상태 보기
- 현재 shop 확률 보기
- 전투 이벤트 로그 다운로드
- save JSON 다운로드/업로드
- active roster 재생성 버튼은 dev build에만 존재

---

# 37. 테스트

## 37.1 필수 unit test

- shop odds 레벨별 합 100
- pool conservation
- buy/sell 반환
- 3→2성 합성
- 9→3성 합성
- 전투 중 합성 보류
- 판매가격
- 이자
- streak
- XP/level
- damage mitigation
- crit
- mana gain
- overtime
- trait threshold
- emblem
- item recipe 55개 유일
- augment 중복 방지
- ghost board 원본 무피해
- elimination pool return
- save/load determinism

## 37.2 데이터 검증

- source horses 331
- P0 145
- canonical list 145
- active roster 60
- cost distribution exactly 14/14/13/11/8
- copies 22/20/17/10/9
- 모든 active unit 스탯/skill/portrait key 존재
- 모든 특성은 traits.json에 존재
- 모든 item recipe 결과 유일
- 55 recipes
- 48 augments

## 37.3 deterministic test

고정 seed `20260907`.

같은 명령 sequence:
- 상점 결과 동일
- AI 구매 동일
- 전투 winner 동일
- 최종 순위 동일

## 37.4 시뮬레이션

`npm run simulate -- --matches 10000`

BALANCE.md에 기록:
- 평균 종료 stage
- 평균 round 수
- 각 코스트 3성 완성률
- 각 AI profile 평균 순위
- 각 trait top4/top1 빈도
- 5코 3성 발생률
- player damage curve
- 평균 보유 골드
- active unit 구매율

초기 목표:
- 평균 종료: stage 5~7
- 1코 3성: 매치당 0.8~2.5개
- 2코 3성: 0.5~1.8
- 3코 3성: 0.2~1.0
- 4코 3성: 10매치당 0~2
- 5코 3성: 20매치당 0~1
- 특정 AI profile 평균 순위가 2.5 이하 또는 6.5 이상이면 재조정
- 특정 단일 trait의 top1 점유율이 25% 초과 시 경고

---

# 38. 아트 매니페스트

`data:build` 후 `art-manifest.json` 생성:

```json
{
  "version": 1,
  "characters": [
    {
      "id": "...",
      "nameKo": "...",
      "activeS1": true,
      "cost": 5,
      "portrait": "portraits/<id>.png",
      "battleSheet": "characters/<id>.png",
      "cutinRequired": true
    }
  ]
}
```

- 145명 모두 portrait/battleSheet key 생성
- S1 5코 8명은 `cutinRequired=true`
- `check:art`는 파일 누락을 P0/P1로 나눠 보고
- production build는 fallback 때문에 누락 자체로 실패시키지 않음
- `STRICT_ART=1 npm run check:art`에서만 전체 납품 강제

---

# 39. Render 배포

`render.yaml`:

```yaml
services:
  - type: web
    name: umafight-tactics
    runtime: static
    buildCommand: npm ci && npm run verify
    staticPublishPath: ./dist
    pullRequestPreviewsEnabled: true
```

SPA fallback 설정.

---

# 40. README에 반드시 넣을 내용

- 게임 설명
- 팬메이드/비공식 표기
- 실행법
- 데이터 출처: UmaRogue
- 데이터 업데이트법
- 아트 넣는 법
- Render 배포법
- 테스트 명령
- 라이선스/자산 주의

---

# 41. 완료 판정

아래가 모두 되어야 “완료”.

- [ ] 저장소 clone 후 `npm ci && npm run verify` 성공
- [ ] 아트 0개 상태에서도 새 게임→최종 순위 완주
- [ ] P0 145명 도감 표시
- [ ] 활성 S1 60명 자동 생성/고정
- [ ] 코스트 종류 수 14/14/13/11/8
- [ ] 공유 풀 22/20/17/10/9
- [ ] 55 아이템 recipe 작동
- [ ] 48 증강 작동
- [ ] AI 7명 정상 경제/배치/전투
- [ ] 2성/3성 합성
- [ ] PvE/PvP/드래프트/증강
- [ ] 저장/불러오기
- [ ] deterministic seed 테스트
- [ ] headless simulation
- [ ] Render build 설정
- [ ] 모바일 1366×768까지 비율 축소 시 기능 사용 가능
- [ ] console error 0
- [ ] TypeScript error 0
- [ ] 테스트 실패 0

---

# 42. 구현 금지 패턴

- `Math.random()` 직접 사용
- 145명 각각 별도 combat code
- itemId별 거대한 switch
- skillId별 거대한 switch
- UI DOM 안에서 전투 계산
- Phaser Scene 내부에 경제 로직
- 외부 경마 API 런타임 호출
- `tier`/`starterCost`를 새 cost로 복사
- 145명을 표준 상점에 전부 투입
- placeholder 버튼
- “나중에 구현” 주석으로 핵심 기능 생략
- 공식 게임 아트를 repository에 무단 복사

---

# 43. 최종 Codex 작업 순서

1. Scaffold
2. RNG / types / Zod
3. source sync
4. data generator
5. active roster + cost
6. item/trait/augment generated JSON
7. pool
8. shop/economy
9. star combine
10. round state machine
11. battle engine
12. skills/effects
13. items
14. traits
15. augments
16. PvE
17. AI
18. draft
19. save/load
20. Phaser board
21. React HUD
22. collection/settings/result
23. fallback art
24. debug tools
25. tests
26. simulator
27. art manifest
28. Render
29. README
30. `npm run verify`

**Codex는 30번까지 끝낸 뒤 작업을 종료한다.**
