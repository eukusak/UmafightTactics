# Umafight Tactics — 레이스 플랜 / GⅠ 출주 시스템
## Codex 원샷 구현 명세 **v2.0 (실코드 검증판)**

> **상태:** IMPLEMENTATION READY
> **대상 저장소:** `eukusak/UmafightTactics` (현재 main 기준 검증 완료)
> **참조 데이터 저장소:** `eukusak/UmaRogue` (`pr0`)
> **기준 해상도:** 1920×1080 / 모바일 360×800
> **이 문서의 위치:** v1.0 초안을 **실제 코드베이스와 대조해 40건을 수정·보강한 최종본**이다.
> v1.0은 참고용으로만 두고, 구현은 이 문서를 따른다.
>
> **Codex에게:** 이 문서는 "무엇을 만들지"가 아니라 **"이 저장소의 어느 파일에 어떤 값을 넣을지"** 까지 지정한다.
> 파일 경로·상수명·함수 시그니처는 2026-09-13 시점 main에서 실제로 확인한 것이다.
> 구조가 달라졌다면 **최신 코드를 우선**하되, 이 문서의 §0.4 재사용 목록은 반드시 다시 찾아서 연결한다.

---

# 서문 — v1.0에서 발견한 문제 40건

v1.0 초안을 실제 코드·데이터와 대조했다. 아래가 **그대로 구현하면 깨지거나 죽는 항목**이다.
각 항목은 본문에서 수정된 형태로 다시 나온다.

## A. 코드 현실과 맞지 않는 것 (18건)

| # | v1.0 내용 | 실제 코드 | 이 문서의 수정 |
|---|---|---|---|
| A1 | `scripts/import-umarogue-racing-profile.mjs` 신규 작성 | UmaRogue `horse-game-db.json`은 **이미 `src/data/source/`에 vendor되어 있고 `aptitudes`·`affinities`를 전부 포함**한다 | 신규 임포트 스크립트 **금지**. `scripts/build-game-data.ts`에 변환 단계만 추가 (§2.2) |
| A2 | 이름 fuzzy-match, `horse-aliases.json` 신설 | `UnitDef.horseId` ↔ UmaRogue `horses[].id`가 **145/145 정확 일치** (실측) | alias 파일 **금지**. 145 미만이면 **빌드 실패**시킨다 (§2.3) |
| A3 | `race-templates.json`을 UmaRogue에서 읽음 | `sync-umarogue.ts`의 `FILES`에 없음 → **현재 vendor 안 됨** | `FILES`에 `race-templates.json`, `racecourses.json` 추가 (§2.1) |
| A4 | `RACE_PLAN_OFFER` 등 신규 WebSocket 메시지 11종 | 프로토콜은 `commandSchema` **discriminated union(`action`)** 하나뿐. 상태는 `ServerMessage.state`가 MatchState 통째로 전달 | 신규 메시지 타입 **금지**. `action` 6종만 추가 (§20.2) |
| A5 | (언급 없음) | `privateMatch()`가 상대 플레이어 필드를 지운다. Race Plan을 MatchState에 넣으면 **상대의 오퍼 후보·추천 근거가 전부 브로드캐스트된다** | `privateMatch()` sanitize 규칙 필수 (§20.3) |
| A6 | `RACE_PLAN_SELECT_SECONDS = 45` | `PREP_SECONDS`는 constants에 있으나 **서버 `setDeadline()`은 증강에 하드코딩 30초**를 써서 이미 `PREP_SECONDS.AUGMENT=45`와 불일치 | `setDeadline()`에 분기 추가를 **필수 항목**으로 명시 (§20.4) |
| A7 | (언급 없음) | `MatchPhase`에 선택 단계가 없으면 서버 `phaseKey`가 안 바뀌어 **deadline이 갱신되지 않는다** | `MatchPhase`에 2종 추가 + `phaseKey` 반영 (§20.4) |
| A8 | `.webp` 배경 3장 + `.svg` 아이콘 21종 | 아트 파이프라인은 **PNG 전용**. `check-art-manifest.ts`가 PNG IHDR만 읽고, `art-manifest.json`에 없는 파일은 검수 대상이 아님 | 래스터는 **PNG + manifest 등록**, 아이콘은 **인라인 React SVG 컴포넌트** (§24) |
| A9 | `race_plan_open.ogg` 등 SFX 9종 | 효과음은 파일이 아니라 `SOUND_DESIGNS` **WebAudio 신스 테이블**이다 (`select`/`level-up`만 mp3) | 9종을 **신스 파라미터로 제공** (§26) |
| A10 | `GAME_VERSION` 올리고 save migration | `parseSave()`는 `version!==1`이면 `CORRUPT`, `activeRosterHash` 불일치면 `ROSTER_MISMATCH` | **version 유지 + optional 필드 + ROSTER_HASH 불변** 전략 (§22) |
| A11 | (언급 없음) | 이 게임은 **시즌 5종 × 60명** 구조다. 매치 로스터는 145명이 아니라 60명 | 모든 오퍼/적성 계산은 `getSeasonUnits(player.seasonId)` 기준 (§2.4) |
| A12 | 신규 훅 10종 (`onAttack`, `onCast`, …)을 전투 엔진에 추가 | `TriggerDef.when`에 `ON_ATTACK`/`ON_CAST`/`ON_KILL`/`ON_TAKEDOWN_ASSIST`/`HP_BELOW`/`TARGET_HP_BELOW`/`AFTER_SECONDS`/`EVERY_SECONDS`/`ON_NTH_ATTACK`/`ON_SAME_TARGET_NTH_ATTACK` **이미 전부 존재** | 신규 트리거는 **2종만** 추가: `ON_RACE_PHASE`, `ON_TARGET_CHANGED` (§17.1) |
| A13 | Race Plan 전용 effect 시스템 | `EffectDef`/`applyEffect`/`addModifier(refreshKey)` 완비. 아이템·특성·증강이 전부 이걸 쓴다 | Race Plan도 **같은 `EffectDef`로만 표현**. 전용 런타임 금지 (§17.2) |
| A14 | 배틀 로그 recap | `BattleFrame.events`가 이미 재생·관전·리플레이에 자동 반영된다 | `BattleEvent`에 2종 추가하면 recap/HUD/관전이 공짜 (§17.3) |
| A15 | `entryUnitInstanceId`로 출주마 추적 | `applyCombines()`는 **아이템이 가장 많은 사본을 남긴다**. 3성 합성 시 등록한 instanceId가 사라질 수 있다 | `entryUnitDefId`를 1차 키로, instanceId는 힌트 (§16.2) |
| A16 | 30초 이후 무한 스케일링 금지 | `enterOvertime()`이 공격속도 ×4를 곱으로 부여하고 `ATTACK_SPEED_CAP = 5.0` | **라스트3F 공격속도 보너스는 오버타임에서 캡에 막혀 가치 0** → 라스트3F는 AS 대신 다른 축 (§19.3) |
| A17 | `Math.random()` 금지 | 이미 금지. `Rng.forStream(matchSeed, streamName)` + `MatchState.rngStates` | seed 규칙을 **실제 API 형태로** 다시 씀 (§11) |
| A18 | AI가 Race Plan 사용 | `resolveAiAugments()`가 **AI 리롤까지 수행하는** 완성된 패턴 | 같은 구조로 `resolveAiRacePlans()` (§21) |

## B. 설계 결함 (12건)

| # | 문제 | 근거 | 해결 |
|---|---|---|---|
| B1 | **라스트 3F(25–30초) 콘텐츠가 대부분 안 터진다** | `docs/BALANCE.md` 500매치 실측: 오버타임 진입 **17.4%**. 즉 82.6%의 전투가 30초 전에 끝나고, 상당수는 20초도 못 간다 | **레이스 진행도(`raceProgress`) 도입** — 페이즈를 절대 초가 아니라 `max(시간진행, 전멸진행)`으로 판정 (§4). 경마적으로도 "최종 직선"은 시간이 아니라 남은 거리다 |
| B2 | Stage 4-5 도달 전 탈락한 플레이어는 **대형 컨텐츠를 아예 못 본다** | 평균 종료 스테이지 6.13 → 7~8등은 스테이지 4 중반에 탈락 | HP ≤ 20이면 **4-3부터 조기 개방**. 파워는 동일, 접근권만 앞당김 (§3.4) |
| B3 | `RP_PASS_OUTSIDE` / `FM_OUTSIDE_PASS` / `EV_PASS_BACKLINE` / `RP_TRACK_TURF` 등은 **원거리 유닛에게 무의미**하거나 근접에게만 유효 | TFT 이상현상 `눈알 광선` 사례 — 원거리 기물이 뽑으면 광선이 닿지 않는 대참사 | **역할 가드(Role Guard)** 신설. 모든 노드가 `appliesTo: MELEE/RANGED/ANY`를 선언하고 맞지 않으면 **풀에서 하드 제외** (§10) |
| B4 | `FM_FREE_RUNNING`(자유 전개), `FM_RACE_SENSE`(전개 읽기)의 "가장 부족한 축 자동 보정" | 툴팁으로 설명 불가, 결정론 검증 불가, 학습 불가 | **명시적 2분기 조건**으로 재작성 (§15.3) |
| B5 | 3개 오퍼의 슬롯 A/B/C 규칙만으로는 중복을 못 막는다 | TFT 이상현상은 **9개 카테고리**(탱커/공격력/위력/마법피해/공격속도/보조/피해증폭/마나/치명타)로 분류해 성격 중복을 구조적으로 차단 | 승부수에 **9카테고리 도입 + 3장 전부 다른 카테고리 강제** (§9.2) |
| B6 | 리롤이 "3장 전부 교체" | 증강은 이미 **슬롯별 1회**(`rerolled: boolean[]`) | 슬롯별 1회로 통일 — 조작 학습 비용 0 (§5.4) |
| B7 | 출주마를 **판매하면 어떻게 되는지 규정 없음** | 실전에서 반드시 발생 | TFT 이상현상 규칙 차용: 판매 시 해제, **같은 unitDefId 재획득 시 1회 자동 재등록** (§16.3) |
| B8 | 출주마가 **벤치에 있을 때** 규정 없음 | 등록은 벤치 유닛도 가능하다고 써 있음 | 벤치에 있으면 효과 **전부 비활성** + UI 경고 (§16.4) |
| B9 | 각력/지구력 게이지를 "체력바 밑"에 그린다 | 전투 렌더러는 **Phaser `BattleScene`** 이다. React가 아니다 | `BattleScene`에 그리는 구체 좌표·색 지정 (§18.3) |
| B10 | `AptitudeFlavor` 최대 ±15% | 실측: **잔디 A 이상이 145명 중 132명**. 잔디 적성으로는 아무것도 구분되지 않는다 | 등급 문자 대신 **로스터 분포 퍼센타일**로 정규화 (§8.3) |
| B11 | 밸런스 예산 "완성템 1.3~1.6개" | 측정 불가능한 단위 | **`ItemEquivalent(IE)` 정의 + 검증 스크립트**로 자동 판정 (§19) |
| B12 | `RP_TRACK_GOING`의 track state 결정 시점 | 8명이 4쌍으로 동시 전투한다 | **라운드 공통 1개**, `rngStates`에 저장 (§12.8) |

## C. 지시가 부족했던 것 (10건)

C1 이미지 프레임 수·픽셀 크기·앵커 / C2 VFX 지속시간·색상 hex / C3 효과음 파형·주파수 /
C4 각 노드의 EffectDef JSON 실물 / C5 UI 좌표(px) / C6 한국어 카피 원문 /
C7 GⅠ 테마 21종의 실제 데이터 매핑 / C8 전투 recap 로그 포맷 /
C9 오퍼 추천 근거 문장 생성 규칙 / C10 테스트 판정 기준의 수치.

→ §12·§15·§23·§24·§25·§26·§28에서 전부 채웠다.

---

# 0. 실측 기준 (2026-09-13 main 검증 완료)

## 0.1 실제 디렉터리

```text
src/
  app/App.tsx
  components/            ← 40개 (Overlays.tsx, BoardView.tsx, BattleTelemetry.tsx …)
    screens/             ← BattleScreen, MenuScreens, CollectionScreen, OnlineScreen, ResultScreen, MotionScreen
  data/
    source/              ← UmaRogue vendor 산출물 (horse-game-db.json 331두)
    generated/           ← all-units.json, traits.json, items.json, augments.json, seasons.json, art-manifest.json
    manual/              ← 튜닝/보정 JSON 22종
  game/
    engine/
      ai/ augments/ battle/ economy/ items/ pool/ rng/ roster/ rounds/ save/ seasons/ shop/ traits/
      constants.ts schema.ts state.ts types.ts
    network/             ← bridge.ts endpoint.ts protocol.ts commands.ts
    phaser/              ← ManagedGame.ts BattleScene.ts fallback-art.ts
    ui/                  ← audio.ts art.ts frame-animation.ts palette.ts …
  store/                 ← gameStore.ts onlineStore.ts interactionStore.ts wishlistStore.ts
  styles/                ← global.css arena.css mobile.css carousel.css pixel.css typography.css
server/                  ← index.ts rooms.ts persistence.ts metrics.ts origins.ts
scripts/                 ← sync-umarogue.ts build-game-data.ts validate-game-data.ts simulate.ts check-art-manifest.ts …
tests/                   ← vitest 40여개 + tests/browser/ (Playwright)
```

**v1.0이 몰랐던 것:** `src/game/network/`, `src/game/phaser/`, `src/game/ui/`, `src/store/`.
Race Plan은 이 4곳 전부를 건드린다.

## 0.2 실제 상수 (`src/game/engine/constants.ts`)

```ts
GAME_VERSION = 1
SAVE_KEY = 'uma-fight-tactics-save-v1'
BATTLE_TICK_MS = 50            // 초당 20틱
BATTLE_NORMAL_SECONDS = 30
BATTLE_OVERTIME_SECONDS = 15
BATTLE_MAX_SECONDS = 45
OVERTIME_ATTACK_SPEED_MULT = 4 // 오버타임 진입 시 공속 ×4
OVERTIME_DAMAGE_MULT = 3
OVERTIME_CC_MULT = 0.34
OVERTIME_HEAL_MULT = 0.34
ATTACK_SPEED_CAP = 5.0         // ★ 라스트3F AS 보너스 설계에 직결
PREP_SECONDS = { PVP: 30, PVE: 20, AUGMENT: 45, DRAFT: 30 }
AUGMENT_ROUNDS = [ {2,1}, {3,2}, {4,2} ]
BOARD_COLS = 7, BOARD_ROWS_PER_SIDE = 4
PLAYER_COUNT = 8, AI_COUNT = 7
DEFAULT_CRIT_CHANCE = 0.25, DEFAULT_CRIT_MULTIPLIER = 1.3
```

라운드 캘린더 (`rounds/schedule.ts`):

```text
Stage 1 : 1-1 ~ 1-3  전부 PVE (1-1은 트윙클 스타트 선택)
Stage 2+: r1 r2 r3 = PVP / r4 = DRAFT(회전 드래프트) / r5 r6 = PVP / r7 = PVE
증강    : 2-1, 3-2, 4-2
```

→ **레이스 플랜 타이밍 2-5 / 3-5 / 4-5 는 증강·드래프트·PvE와 전부 충돌하지 않는다. 확인 완료.**

## 0.3 실측 데이터 현황 — 이 수치를 전제로 설계한다

`src/data/source/horse-game-db.json`(331두) ∩ `src/data/generated/all-units.json`(145명) 실측:

| 항목 | 실측값 | 설계 함의 |
|---|---|---|
| horseId 조인 성공 | **145 / 145 (100%)** | alias·fuzzy match 불필요 |
| 코스 affinity 보유 | **80 / 145 (55%)** | 코스 연출은 "있으면 보너스" |
| 마장상태(going) affinity 보유 | **22 / 145 (15%)** | **going 기반 콘텐츠 금지** — flavor만 |
| 계절 affinity 보유 | **87 / 145 (60%)** | 보조 가중치로만 |
| styleConfidence HIGH | 132 / 145 | 각질은 신뢰 가능 |
| 잔디 적성 A 이상 | **132 / 145 (91%)** | **잔디 적성은 변별력 0** → 퍼센타일 정규화 필수 |
| 더트 적성 B 이상 | **25 / 145 (17%)**, F가 93명 | 더트 플랜은 적성 잠금 시 **즉사** |
| 장거리 적성 B 이상 | 47 / 145 | |
| 단거리 적성 B 이상 | 38 / 145 | |
| 각질 trait 분포 | nige 39 / senko 54 / sashi 32 / **oikomi 20** | 추입 플랜이 가장 희소 |
| 거리 trait 분포 | middle 72 / stayer 32 / miler 27 / **sprinter 14** | |

**시즌(60명)별 분포 — 매치에서 실제로 쓰이는 값:**

| 시즌 | nige | senko | sashi | oikomi | sprinter | stayer | 더트 B+ |
|---|---:|---:|---:|---:|---:|---:|---:|
| s1 트윙클 개막전 | 18 | 18 | 15 | 9 | 8 | 14 | 14 |
| s2 별빛 오케스트라 | 18 | 23 | 12 | 7 | 5 | 13 | 13 |
| s3 와일드 프런티어 | 17 | 22 | 13 | 8 | 6 | 12 | 14 |
| s4 네온 스프린트 | 17 | 23 | 12 | 8 | 5 | 12 | 13 |
| s5 크라운 피날레 | 20 | 23 | 11 | **6** | 5 | 13 | **10** |

**결론: 어떤 시즌에서도 oikomi·sprinter·dirt는 10% 안팎이다.
적성을 자격 조건으로 쓰면 해당 계열 콘텐츠는 로비에서 0~1회 등장하고 죽는다.
적성은 오직 "가중치·이름·연출"로만 쓴다.**

**전투 길이 실측 (`docs/BALANCE.md`, 500매치 / 71,405 전투):**

| 지표 | 값 |
|---|---|
| 평균 종료 스테이지 | 6.13 (목표 5~7) |
| 평균 라운드 수 | 35.2 |
| 오버타임(30초 초과) 진입 | **12,460 / 71,405 = 17.4%** |
| 무승부 | 23 (0.03%) |

→ **전투의 82.6%가 30초 전에 끝난다. 절대 초 기준 25~30초 콘텐츠는 대부분 안 터진다. §4가 이 문제를 푼다.**

## 0.4 반드시 재사용할 실제 API

| 용도 | 실제 심볼 | 위치 |
|---|---|---|
| 결정론 난수 | `Rng.forStream(matchSeed, streamName)`, `RngRegistry`, `rng.pick/sample/shuffle/next` | `engine/rng/index.ts` |
| 상태 소유 | `RoundDirector` (모든 전이의 단일 소유자) | `engine/rounds/director.ts` |
| 오퍼 패턴 | `createAugmentOffers` / `rollAugmentOptions` / `rerollAugmentOffer` / `chooseAugment` | `engine/augments/offers.ts` |
| AI 선택 패턴 | `augmentScore` / `chooseAiAugment` / `resolveAiAugments` | `engine/ai/augment-choice.ts`, director |
| 효과 선언 | `EffectDef`, `TriggerDef`, `EffectKind`, `StatusKind` | `engine/types.ts` |
| 효과 적용 | `applyEffect(ctx, self, effect, index, opts)` | `engine/battle/effects.ts` |
| 스탯 수정 | `addModifier(unit, stat, value, isMultiplier, duration, now, refreshKey?)` / `stat(unit, key, now)` | `engine/battle/combat-unit.ts` |
| 전투 이벤트 | `BattleEvent`, `BattleFrame.events` | `engine/battle/engine.ts` |
| 유닛 조회 | `getUnitDef`, `getSeasonUnits`, `getSeason`, `ROSTER_HASH` | `engine/roster/index.ts` |
| 온라인 명령 | `commandSchema`(zod), `applyOnlineCommand` | `network/protocol.ts`, `network/commands.ts` |
| 방/타이머 | `RoomService.setDeadline` / `tick` / `privateMatch` | `server/rooms.ts` |
| 클라 액션 | `useGameStore` 액션 + `onlineBridge.send?.({action})` | `store/gameStore.ts` |
| 효과음 | `playSound(name)`, `SOUND_DESIGNS` | `ui/audio.ts` |
| 전투 렌더 | Phaser `BattleScene` | `phaser/BattleScene.ts` |
| 아트 검수 | `art-manifest.json` + `npm run check:art`(`STRICT_ART=1`) | `scripts/check-art-manifest.ts` |

---

# 1. 시스템 정체성

## 1.1 명칭

**레이스 플랜 (Race Plan)** — 4단계.

| 단계 | UI 명칭 | 타이밍 | 귀속 |
|---|---|---|---|
| 1 | **출주 계획** | Stage 2-5 준비 | 없음 (플레이어 귀속) |
| 2 | **전개 수정** | Stage 3-5 준비 | 없음 |
| 3 | **GⅠ 출주 등록** | Stage 4-5 준비 (조기 개방 §3.4) | 유닛 1명 |
| 4 | **최종 승부수** | 출주마 확정 직후 | 그 유닛 |

내부 식별자: `racePlan` / `racePlanOffer` / `racePlanEvolution` / `g1Entry` / `finishingMove`

## 1.2 기존 시스템과의 역할 분리

| 시스템 | 답하는 질문 | 이 시스템이 절대 하지 않는 것 |
|---|---|---|
| 증강체 | "이번 판 운영 규칙은?" | Race Plan은 **골드/XP/상점확률/무료리롤을 절대 건드리지 않는다** |
| 아이템 | "이 유닛의 스탯은?" | Race Plan은 아이템 슬롯을 쓰지 않고 아이템을 대체하지 않는다 |
| 시너지 | "어떤 조합인가?" | Race Plan은 특성 수치를 복제하지 않는다 |
| **레이스 플랜** | **"이번 경주를 어떤 전개로 끌고, 마지막에 누구를 승부마로 내보낼 것인가?"** | — |

## 1.3 TFT 이상현상에서 가져온 것 / 버린 것

| TFT 이상현상 | 채택 | 이유 |
|---|---|---|
| 스테이지 4-6에 등장, 챔피언 1명 강화 | ✅ Stage 4-5 GⅠ 출주 등록 | 후반 귀속 = 조기 강제 없음 |
| 9개 역할 카테고리(탱커/공격력/위력/…) | ✅ 승부수 카테고리 (§9.2) | 3장 중복 방지의 구조적 해법 |
| 팔아도 재구매하면 효과 유지 | ✅ §16.3 | 실전 필수 규칙 |
| 1골드 리롤 | ❌ **무료 슬롯별 1회** | 경제 조작은 증강체의 정체성 |
| `눈알 광선` 류 사거리 의존 함정 | ❌ **역할 가드로 차단** (§10) | 즐거움이 아니라 사고다 |
| `SSR`/rarity 표기 | ❌ | 출마표 톤과 충돌 |
| `궁극의 영웅`(4성 승격) 같은 규칙 파괴 | ❌ | 별 등급 시스템은 건드리지 않는다 |
| `탐욕의 화신`(골드 보상) | ❌ | 경제 침범 금지 |

---

# 2. 데이터 파이프라인 (수정본)

## 2.1 vendor 확장 — `scripts/sync-umarogue.ts`

`FILES` 상수에 2개를 추가한다. **그 외에는 손대지 않는다.**

```ts
const FILES = [
  'horse-game-db.json',
  'horse-game-db.validation.json',
  'race-templates.json',   // 신규 — GⅠ 테마 원본
  'racecourses.json',      // 신규 — 코스 방향/직선거리/기복
] as const;
```

기존 SHA-256 lock/네트워크 폴백 로직을 그대로 재사용한다.
런타임 fetch는 여전히 **금지**다.

## 2.2 프로필 생성 — `scripts/build-game-data.ts`에 단계 추가

새 스크립트를 만들지 않는다. 기존 빌더 마지막에 `buildRacePlanData()`를 붙인다.

출력 2개:

```text
src/data/generated/race-plan/horse-racing-profiles.json
src/data/generated/race-plan/g1-themes.json
```

`horse-racing-profiles.json` 스키마:

```jsonc
{
  "version": 1,
  "sourceSnapshot": "UMA_ROGUE_JPN_DB_20260904",
  "rosterSize": 145,
  "profiles": {
    "special_week": {                       // key = UnitDef.id
      "horseId": "H-1995103211",
      "confidence": "HIGH",                 // dataConfidence.history
      "styleConfidence": "HIGH",            // dataConfidence.styleConfidence
      "starts": 17,
      "distance": { "sprint": "D", "mile": "B", "middle": "S", "long": "A" },
      "surface":  { "turf": "S", "dirt": "F" },
      "style":    { "nige": "C", "senko": "B", "sashi": "S", "oikomi": "A" },
      "distancePct": { "sprint": 0.31, "mile": 0.62, "middle": 0.94, "long": 0.81 },
      "surfacePct":  { "turf": 0.88, "dirt": 0.12 },
      "stylePct":    { "nige": 0.40, "senko": 0.61, "sashi": 0.95, "oikomi": 0.86 },
      "courses":  [ { "id": "TOKYO",  "rating": "FAVORITE", "sample": 6, "delta": 0.13 } ],
      "going":    [],
      "seasons":  [ { "id": "AUTUMN", "rating": "GOOD", "sample": 8, "delta": 0.11 } ],
      "signatureId": "sig_1995103211",
      "signatureName": "LEGACY · 東京優駿(GI)",
      "mainWin": "98'日本ダービー(G1)",
      "gradeWins": { "GI": 4, "GII": 4, "GIII": 1, "OTHER": 1 }
    }
  }
}
```

### 2.2.1 `*Pct` 필드 — B10의 해법 (필수)

**등급 문자를 그대로 가중치로 쓰면 안 된다.** 잔디 A 이상이 91%이므로 아무것도 구분하지 못한다.

`*Pct`는 **현재 145명 로스터 안에서의 퍼센타일**이다.

```ts
// 등급 → 실수
const GRADE_VALUE = { S: 1.00, A: 0.86, B: 0.72, C: 0.58, D: 0.44, E: 0.30, F: 0.16, G: 0.02 };

// 축(axis)별로 145명 값을 모아 정렬한 뒤, 해당 유닛의 위치를 0..1로
function percentile(axisValues: number[], mine: number): number {
  const below = axisValues.filter(v => v < mine).length;
  const equal = axisValues.filter(v => v === mine).length;
  return (below + equal / 2) / axisValues.length;   // midrank, 동점 공정
}
```

이러면 "잔디 A"는 turfPct ≈ 0.45(평범)가 되고, "더트 A"는 dirtPct ≈ 0.93(희소)이 된다.
**가중치는 `*Pct`만 본다. 등급 문자는 UI 표기 전용이다.**

### 2.2.2 각질/거리 키 매핑 (UmaRogue → Umafight)

```text
front   -> nige       sprint -> sprinter
pace    -> senko      mile   -> miler
stalker -> sashi      middle -> middle
closer  -> oikomi     long   -> stayer
```

`source.primaryStyle` / `source.bestDistance`가 이미 `all-units.json`에 있으면 **그 필드를 우선**한다
(빌더가 `running-style-corrections.json`·`trait-corrections.json` 수동 보정을 이미 반영한 값이다).

## 2.3 조인 검증 — 실패하면 빌드를 세운다

```ts
if (matched !== units.length) {
  throw new Error(
    `race-plan: horseId join ${matched}/${units.length}. ` +
    `Missing: ${missing.join(', ')}`
  );
}
```

실측 기준 145/145이므로 이 예외가 뜨면 **데이터가 깨진 것이지 매칭 규칙이 부족한 게 아니다.**
alias 파일로 덮지 말고 원인을 고친다.

부가 리포트: `docs/generated/RACE_PLAN_DATA_IMPORT_REPORT.md`

```markdown
- 로스터: 145 / 조인 성공: 145 / 실패: 0
- 코스 affinity 보유: 80 (55.2%)
- going affinity 보유: 22 (15.2%)   ← 15% 미만이면 going 콘텐츠 비활성 경고
- 계절 affinity 보유: 87 (60.0%)
- styleConfidence LOW: 7            ← 이 유닛은 고유 승부수 생성 금지
- 시그니처 보유: 145
```

## 2.4 시즌 인지 (A11)

오퍼 생성·후보 필터·로비 다양성 계산은 **전부 `getSeasonUnits(player.seasonId)` 안에서만** 돈다.
145명 프로필은 전부 생성하되, 매치에서는 해당 시즌 60명만 참조한다.
도감(CollectionScreen)에서는 145명 전부 열람 가능.

## 2.5 `ROSTER_HASH` 불변 (A10 연동)

`ROSTER_HASH`는 **유닛 id/코스트/스탯/특성에서만** 계산되고 있다.
`race-plan/*.json`을 해시 입력에 **넣지 않는다.** 넣으면 기존 세이브와 온라인 방 체크포인트가 전부 무효가 된다.

## 2.6 GⅠ 테마 — `g1-themes.json`

`race-templates.json`에서 `grade ∈ {GI, JpnI}`만 추린다. 실제 필드가 그대로 쓸 수 있다.

```jsonc
{
  "id": "TOKYO_YUSHUN", "nameJa": "東京優駿", "nameKo": "일본 더비",
  "racecourse": "TOKYO", "surface": "TURF", "distanceM": 2400,
  "direction": "LEFT", "season": "SPRING", "distanceClass": "MIDDLE", "grade": "GI",
  "straightM": 525,                 // racecourses.json에서 조인
  "profile": ["STRAIGHT","CORNER",...] // 연출 전용
}
```

**GⅠ 테마는 효과 파워를 절대 바꾸지 않는다. 오퍼 가중치 ±10%와 이름/연출만 바꾼다.**

---

# 3. 게임 루프와 타이밍

## 3.1 확정 타이밍

| 시점 | 단계 | `MatchPhase` | 제한 시간 |
|---|---|---|---|
| Stage **2-5** 준비 시작 | 출주 계획 | `RACE_PLAN_SELECT` | 45초 |
| Stage **3-5** 준비 시작 | 전개 수정 | `RACE_PLAN_SELECT` | 45초 |
| Stage **4-5** 준비 시작 | GⅠ 출주 등록 | `RACE_ENTRY_SELECT` | 50초 |
| 출주마 확정 직후 | 최종 승부수 | `RACE_ENTRY_SELECT` 유지 | 35초 |

`constants.ts`:

```ts
export const RACE_PLAN_ROUNDS: Array<{ stage: number; round: number; kind: 'PLAN' | 'EVOLUTION' | 'ENTRY' }> = [
  { stage: 2, round: 5, kind: 'PLAN' },
  { stage: 3, round: 5, kind: 'EVOLUTION' },
  { stage: 4, round: 5, kind: 'ENTRY' },
];
export const RACE_PLAN_SECONDS = { PLAN: 45, ENTRY: 50, FINISHING: 35 } as const;
/** 탈락 임박 플레이어에게 GⅠ 등록을 앞당기는 라운드와 HP 기준. */
export const RACE_ENTRY_EARLY_ROUND = { stage: 4, round: 3 } as const;
export const RACE_ENTRY_EARLY_HP = 20;
/** 출주마 보류의 마감. */
export const RACE_ENTRY_DEADLINE = { stage: 5, round: 2 } as const;
/** 승부마 변경 가능 마감. */
export const RACE_TRANSFER_DEADLINE = { stage: 5, round: 5 } as const;
```

`rounds/schedule.ts`의 `roundInfo()`에 `racePlanKind: 'PLAN'|'EVOLUTION'|'ENTRY'|null`을 추가하고
`prepSeconds`를 그에 맞게 반환한다. **증강과 같은 라운드에 겹치는 경우는 없다(§0.2 확인).**

## 3.2 Stage 2-5 — 출주 계획

- 서로 다른 기본 플랜 **3장**
- 캐릭터 귀속 없음, `PlayerState.racePlan.planId`에만 저장
- **슬롯별 무료 리롤 1회** (증강과 동일 조작)
- 45초 후 자동 선택 = **추천 점수 1위** (증강의 `options[0]`과 달리 반드시 추천 1위)

## 3.3 Stage 3-5 — 전개 수정

- Stage 2 플랜과 호환되는 진화 노드 **3장**
- 왼쪽에 현재 플랜 요약 카드 고정 (분기표 연출, §23.3)
- 슬롯별 무료 리롤 1회

## 3.4 Stage 4-5 — GⅠ 출주 등록 + **조기 개방 (B2 해결)**

기본은 Stage 4-5. 단 아래 조건이면 **Stage 4-3 준비에 미리 열린다.**

```ts
function racePlanEntryOpensNow(state: MatchState, p: PlayerState): boolean {
  const r = state.stage * 100 + state.round;
  if (r === 405) return true;                                    // 정규 개방
  if (r === 403 && p.hp <= RACE_ENTRY_EARLY_HP) return true;     // 탈락 임박 조기 개방
  return false;
}
```

- **파워는 완전히 동일하다.** 조기 개방은 컴백 보상이 아니라 **컨텐츠 접근권**이다.
- 조기 개방된 플레이어도 승부마 변경 1회는 그대로 갖는다.
- 조기 개방 여부는 스카우팅 화면에 노출하지 않는다 (HP는 이미 공개 정보지만 굳이 표시하지 않는다).

**등록 보류**

- `등록 보류` 버튼으로 미룰 수 있다. **보류 자체에 어떤 보너스도 없다.**
- 마감: Stage **5-2** 준비 종료. 미지정이면 `EntryFit` 1위를 시스템이 자동 등록한다.
- 보류 중에는 매 준비 단계 상단에 `GⅠ 출주 등록 미완료 · 5-2까지` 배너를 띄운다 (§23.5).

## 3.5 Stage 4-5 직후 — 최종 승부수

출주마를 확정하면 **그 유닛에 맞춘 승부수 3장**이 즉시 열린다. 리롤 없음 (이미 유닛을 골랐다).

---

# 4. 레이스 진행도 — 이 시스템의 핵심 수정 (B1)

## 4.1 문제

절대 초로 페이즈를 자르면 전투의 **82.6%가 30초 전에 끝나므로** 라스트3F 콘텐츠가 죽는다.
10초 만에 끝나는 덱에게 "25초 보너스"는 존재하지 않는 글자다.

## 4.2 해법 — 경마의 정의를 그대로 쓴다

경마에서 "최종 직선"은 **경과 시간이 아니라 남은 거리**로 정해진다.
전투에서 "남은 거리"에 해당하는 것은 **아직 쓰러지지 않은 유닛의 비율**이다.

```ts
// src/game/engine/race-plan/race-phases.ts
export type RaceCombatPhase = 'START' | 'POSITIONING' | 'LATE' | 'LAST_3F' | 'OVERTIME';

/**
 * 레이스 진행도 0..1.
 *  - timeProgress : 30초를 1.0으로 보는 시계 진행
 *  - fieldProgress: 양 팀 전체 유닛 중 쓰러진 비율 = "소화한 거리"
 * 둘 중 큰 값을 쓴다. 빠른 전투도 반드시 라스트3F를 통과하고,
 * 느린 전투도 시계만으로 라스트3F에 도달한다.
 */
export function raceProgress(elapsed: number, aliveCount: number, startCount: number): number {
  const timeProgress = Math.min(1, elapsed / BATTLE_NORMAL_SECONDS);
  const fieldProgress = startCount > 0 ? 1 - aliveCount / startCount : 0;
  return Math.max(timeProgress, fieldProgress);
}

export function getRaceCombatPhase(elapsed: number, progress: number): RaceCombatPhase {
  if (elapsed >= BATTLE_NORMAL_SECONDS) return 'OVERTIME';
  if (progress >= 0.833) return 'LAST_3F';     // 25/30
  if (progress >= 0.666) return 'LATE';        // 20/30
  if (progress >= 0.166) return 'POSITIONING'; //  5/30
  return 'START';
}
```

### 4.2.1 페이즈 표

| 페이즈 | 진행도 | 시계 환산 | 경마 대응 | 설계 역할 |
|---|---|---|---|---|
| `START` | 0 – 0.166 | 0–5초 | 게이트 · 선두 다툼 | 도주/선행 |
| `POSITIONING` | 0.166 – 0.666 | 5–20초 | 도중 · 포지션 · 랩 유지 | 선행/균형 |
| `LATE` | 0.666 – 0.833 | 20–25초 | 4코너 · 仕掛け(승부처) | 선입/추월 |
| `LAST_3F` | 0.833 – 1.0 | 25–30초 | 上がり3ハロン · 최종 직선 | 추입/스테이어 |
| `OVERTIME` | 시계 30초 초과 | 30–45초 | 극한 승부 | 기존 규칙 그대로 |

### 4.2.2 단조성 보장 (필수)

`fieldProgress`는 부활(`REVIVE`)·소환(`SUMMON`)으로 **줄어들 수 있다.**
페이즈가 뒤로 가면 스택·1회성 효과 회계가 무너진다.

```ts
// BattleEngine 필드
private racePhaseHigh = 0;        // 진행도의 최대값 기록
// 매 틱
const p = Math.max(this.racePhaseHigh, raceProgress(...));
this.racePhaseHigh = p;           // ★ 페이즈는 절대 되돌아가지 않는다
```

`startCount`는 **전투 시작 시각의 양 팀 합계**로 고정한다. 소환물(`id.includes('~summon')`)은 세지 않는다.

### 4.2.3 페이즈 전이 이벤트

틱마다 발송하지 않는다. **페이즈가 바뀔 때 1회만.**

```ts
if (phase !== this.racePhase) {
  const old = this.racePhase; this.racePhase = phase;
  this.events.push({ t: this.time, type: 'RACE_PHASE', phase, progress: p });
  this.fire('RACE_PHASE');     // TriggerDef.when === 'ON_RACE_PHASE'
}
```

`BATTLE_TICK_MS = 50`이므로 최대 20회/초 검사, 전이는 전투당 최대 4회다. 비용 무시 가능.

## 4.3 카탈로그 표기 규칙

플랜 텍스트는 **초가 아니라 페이즈 이름으로 쓴다.**

| ❌ 금지 | ✅ 사용 |
|---|---|
| "20초에 공격속도 +15%" | "**승부처(LATE)** 진입 시 공격속도 +15%" |
| "25초 이후 첫 스킬 피해 +30%" | "**라스트 3F** 진입 후 첫 스킬 피해 +30%" |
| "첫 10초" | "**템(START)** 구간" |

툴팁 보조 표기: `승부처 진입 — 보통 20초 전후` (회색 작은 글씨).

## 4.4 오버타임 상호작용 (A16)

- 오버타임 진입 시 공속 ×4가 곱으로 들어가고 `ATTACK_SPEED_CAP = 5.0`이다.
  → **오버타임에서 공격속도 보너스는 대부분 캡에 먹힌다.**
- 따라서 **`LAST_3F` 계열의 주력 축을 공격속도로 잡지 않는다.**
  피해증폭 / 관통 / 고정피해 / 처형 / 회복 을 쓴다.
- `OVERTIME`에서 Race Plan은 **새 스택을 쌓지 않는다.** 30초 시점 수치를 그대로 들고 간다.

```ts
// runtime.ts
if (phase === 'OVERTIME') return;   // 모든 STACKING/EVERY_SECONDS Race Plan 효과 정지
```

---

# 5. 개인화 오퍼 엔진

## 5.1 절대 규칙

1. **8명에게 같은 3장을 주지 않는다.**
2. **서버가 만든다.** 클라이언트는 ID를 받아 렌더링만 한다.
3. **결정론.** 같은 입력 → 같은 후보·같은 순서.
4. 점수 상위 3개를 그대로 주지 않는다. **상위 풀에서 가중 추첨한다.**

## 5.2 `RacePlanOfferContext`

```ts
export interface RacePlanOfferContext {
  playerId: string;
  seasonId: SeasonId;
  stage: number; round: number;
  phase: 'PLAN' | 'EVOLUTION' | 'ENTRY' | 'FINISHING';
  rerollIndex: number;

  level: number; gold: number; hp: number; streak: number;
  boardUnitCount: number; benchUnitCount: number;
  boardCostHistogram: Record<Cost, number>;
  benchCostHistogram: Record<Cost, number>;
  starHistogram: Record<Star, number>;

  roleCounts: Record<Role, number>;
  styleCounts: Record<RunStyle, number>;
  distanceCounts: Record<DistanceTrait, number>;
  surfaceCounts: { turf: number; dirt: number };
  activeTraitTiers: Record<string, number>;   // activeTierIndex 결과

  itemProfile: ItemProfile;
  carryCandidates: CarryCandidate[];
  recentCombat: RecentCombatProfile;
  economy: EconomyArchetype;

  augments: string[];
  planId?: string; evolutionId?: string;
  offerHistory: string[];                     // 이 매치에서 이미 보여준 후보 id
  lobbyExposure: Record<string, number>;      // 같은 타이밍의 로비 노출 수
}
```

## 5.3 오퍼 생성 흐름

```text
1. 후보 풀 = 카탈로그 ∩ (phase 호환) ∩ (역할 가드 통과, §10)
2. 각 후보에 OfferScore 계산 (§8)
3. 점수 내림차순 상위 Top-K (K = 10) 를 남긴다
4. 슬롯 A/B/C 규칙(§9.1)에 맞춰 3개를 가중 추첨 (§11 시드)
5. 각 후보에 추천 근거 3~4개 생성 (§9.3)
6. currentOffer로 저장, 로비 노출 카운터 갱신
```

## 5.4 리롤 — 슬롯별 1회 (B6)

증강과 **완전히 같은 UX**를 쓴다. `rerolled: [false, false, false]`.

```ts
export function rerollRacePlanOffer(
  state: MatchState, player: PlayerState, slot: number, rng: Rng,
): boolean {
  const offer = player.racePlan.currentOffer;
  if (!offer || offer.chosen !== null) return false;
  if (!Number.isInteger(slot) || slot < 0 || slot >= offer.options.length) return false;
  if (offer.rerolled[slot]) return false;

  // 이미 본 후보는 다시 나오지 않는다.
  const seen = new Set([...offer.seen, ...offer.options]);
  const replacement = drawOne(state, player, offer, seen, rng);
  if (!replacement) return false;

  offer.options[slot] = replacement;
  offer.seen.push(replacement);
  offer.rerolled[slot] = true;
  return true;
}
```

- 교체 후보는 **원래 슬롯의 역할(A/B/C)을 유지**한다. 슬롯 B를 리롤했는데 슬롯 A 성격이 나오면 안 된다.
- 교체 후보가 풀에 없으면 리롤은 실패하고 **리롤권은 소모되지 않는다.**

---

# 6. 보드 분석

## 6.1 캐리 후보 점수 `CarryScore`

보드 + 벤치 전 유닛에 대해 계산한다. 결과는 0..1로 정규화한다.

```text
CarryScore =
  0.22 × CostNorm            // cost/5
+ 0.16 × StarNorm            // {1:0.25, 2:0.60, 3:1.00}
+ 0.20 × ItemCarryFit        // §6.2
+ 0.12 × TraitSupport        // 활성 특성 티어 합 / 4, 최대 1
+ 0.10 × DamageShareRecent   // 최근 3전 팀 내 피해 비중
+ 0.08 × SkillScalingFit     // starSkillMultiplier(star,cost) / 6
+ 0.07 × SurvivalFit         // 최근 3전 평균 생존 시간 / 30
+ 0.05 × AptitudeConfidence  // HIGH 1.0 / MEDIUM 0.6 / LOW 0.3 / VERY_LOW 0.1
```

**공정성 제약 (테스트로 강제, §28.4)**

- 벤치 유닛은 최종 점수에 **×0.90**. 후보에서 제외하지는 않는다.
- 아이템 0개 5코(2성)보다 **완성템 3개 3성 3코가 더 높게 나오는 조합이 반드시 존재**해야 한다.
- `cost >= 4` 같은 하드 필터를 **어디에도 넣지 않는다.**

실측 참고: 500매치에서 4코 3성은 0.00회/매치, 5코 3성도 0.00회다.
**즉 실전의 승부마는 대부분 "4코 2성" 또는 "1~3코 3성"이다.** 두 축이 모두 살아야 한다.

## 6.2 `ItemProfile`

```ts
export interface ItemProfile {
  ad: number; ap: number; attackSpeed: number; crit: number;
  mana: number; tank: number; sustain: number; utility: number;
  burnWound: number; penetration: number;   // 각 0..1
}
```

**하드코딩 금지.** `ItemDef.tags`(`'DAMAGE'|'TANK'|'MANA'|'UTILITY'|'EMBLEM'|'TACTICIAN'`)와
`stats`/`pctStats`/`effects[].kind`에서 유도한다.

```ts
const AXIS_FROM_EFFECT: Partial<Record<EffectKind, keyof ItemProfile>> = {
  BURN: 'burnWound', WOUND: 'burnWound',
  SUNDER_ARMOR_PCT: 'penetration', SHRED_MR_PCT: 'penetration',
  OMNIVAMP: 'sustain', HEAL: 'sustain', HEAL_MAXHP_PCT: 'sustain',
  SHIELD_MAXHP_PCT: 'tank', SHIELD_FLAT: 'tank', DAMAGE_REDUCTION: 'tank',
  MANA_ADD: 'mana', ON_HIT_MANA: 'mana', MANA_MAX_ADD: 'mana',
  CRIT_CHANCE_ADD: 'crit', CRIT_DAMAGE_ADD: 'crit', SKILLS_CAN_CRIT: 'crit',
  TAUNT: 'utility', APPLY_STATUS: 'utility', CLEANSE: 'utility', MANA_DRAIN: 'utility',
};
const AXIS_FROM_STAT: Partial<Record<keyof BattleStats, keyof ItemProfile>> = {
  attackDamage: 'ad', abilityPower: 'ap', attackSpeed: 'attackSpeed',
  critChance: 'crit', critMultiplier: 'crit',
  armor: 'tank', magicResist: 'tank', hp: 'tank',
  startMana: 'mana', maxMana: 'mana',
};
```

장착 아이템은 ×1.0, 보관함 아이템은 ×0.5로 센다. 축별로 `min(1, sum / 3)`로 정규화한다.

**`ItemDef`에 새 태그 필드를 추가하지 않는다.** v1.0은 `item.tags?: ItemTag[]`가 없으면 추가하라고 했지만
**이미 존재하고 전 아이템에 채워져 있다.**

## 6.3 경제 원형 `EconomyArchetype`

```ts
type EconomyArchetype = 'REROLL' | 'TEMPO' | 'FAST_8' | 'FAST_9' | 'FLEX' | 'RECOVERY';
```

판정은 **단일 조건 금지**. 점수제로 뽑는다 (로비 평균 대비 상대값 사용).

| 원형 | 신호 (전부 가점, 최고점 채택) |
|---|---|
| `REROLL` | 레벨 ≤ 로비평균−1 (+3) / 같은 unitDefId 2장 이상 페어 3쌍 이상 (+3) / 3성 1개 이상 (+2) / 골드 < 20 (+1) |
| `FAST_8` | 골드 ≥ 40 (+3) / 레벨 ≥ 로비평균 (+2) / 저코 3성 0개 (+2) / 벤치 4~5코 보유 (+2) |
| `FAST_9` | `FAST_8` 조건 + 레벨 ≥ 8 (+3) |
| `TEMPO` | 연승 ≥ 3 (+3) / 골드 < 15 (+2) / 보드 평균 별 ≥ 2.0 (+2) |
| `RECOVERY` | HP ≤ 35 (+4) / 연패 ≥ 3 (+2) / 보드 파워 하위 2위 이내 (+2) |
| `FLEX` | 위 어느 것도 5점을 못 넘으면 기본값 |

**이 값은 "효과의 세기"를 절대 바꾸지 않는다. 후보의 *종류*만 바꾼다.**
예: `FAST_9`라고 더 강한 플랜을 주면 안 된다. 대신 "미래 고코 캐리와 호환이 좋은 비귀속 플랜"이 더 자주 나오게 한다.

---

# 7. 최근 전투 텔레메트리

## 7.1 수집 방식 — `BattleFrame.events`에서 유도한다

**새 계측 코드를 전투 엔진에 심지 않는다.** `BattleResult.events`가 이미 전부 담고 있다.
`RoundDirector.resolveRound()` 뒤에 요약만 계산해서 `PlayerState.racePlan.recentCombat`에 접는다.

최근 **PvP 3전**만 본다 (PvE·고스트 전투 제외).

```ts
export interface RecentCombatProfile {
  sampleCount: number;              // 0..3

  avgDuration: number;              // 초
  avgEndProgress: number;           // 종료 시점 raceProgress (0..1) ★ B1 판정용
  overtimeRate: number;             // 0..1

  damageByPhase: Record<RaceCombatPhase, number>;   // 비율, 합 1.0
  carryDamageShare: number;
  frontlineLossBeforeMid: number;   // POSITIONING 종료 전 전열 사망 비율
  carryLossBeforeLate: number;      // LATE 진입 전 캐리 사망 비율

  castsPerCombat: number;
  carryCastsPerCombat: number;
  manaOverflow: number;             // 낭비된 마나 평균

  meleeDamageRatio: number;
  ccSecondsPerCombat: number;
  healingPerCombat: number;
  shieldingPerCombat: number;
  targetSwitchesPerCombat: number;
  enemyFrontlineHpAtLate: number;   // LATE 진입 시 적 전열 평균 HP 비율 ★ 탱커 못 뚫는지
}
```

`sampleCount === 0`(스테이지 2-5의 첫 오퍼 등)이면 **`CombatFit = 1.00` 중립**으로 둔다.
데이터가 없을 때 억지로 추정하지 않는다.

## 7.2 가중치 반영 규칙

| 관측 | 가중치를 올리는 쪽 | 올리는 폭 |
|---|---|---|
| `avgEndProgress < 0.55` (전투가 일찍 끝남) | START/POSITIONING 계열 | ×1.20 |
| `avgEndProgress > 0.90` 또는 `overtimeRate > 0.4` | LATE/LAST_3F 계열 | ×1.20 |
| `frontlineLossBeforeMid > 0.5` | 생존·페이스 완화 계열 | ×1.18 |
| `enemyFrontlineHpAtLate > 0.6` (탱커 못 뚫음) | 관통·처형·돌파 계열 | ×1.22 |
| `carryCastsPerCombat < 2` | 마나·캐스트 계열 | ×1.15 |
| `manaOverflow > 30` | 마나 계열 | ×0.85 (이미 남음) |
| `targetSwitchesPerCombat > 6` | 단일 대상 고정 계열 | ×0.88 |

**약점을 자동으로 완전히 메워주지 않는다.** 이건 추천이지 대리 플레이가 아니다.
어떤 관측도 단일 후보를 **강제 등장**시키지 못한다. 최대 배율은 §8의 `CombatFit` 범위 안으로 클램프한다.

---

# 8. 개인화 점수 공식

## 8.1 공식

```text
OfferScore(node) =
  BaseWeight
× BoardFit × ItemFit × EconomyFit × CombatFit
× TraitFit × AptitudeFlavor × G1ThemeFlavor
× Diversity × AntiRepeat × LobbyVariety
× RNGJitter
```

## 8.2 범위 (클램프 필수)

| 인자 | 범위 | 근거 |
|---|---|---|
| `BaseWeight` | 카탈로그 값 (기본 1.00) | |
| `BoardFit` | 0.70 – 1.35 | 역할/별/코스트 구성 |
| `ItemFit` | 0.80 – 1.25 | `ItemProfile` 내적 |
| `EconomyFit` | 0.85 – 1.20 | **종류만 바꾼다** |
| `CombatFit` | 0.80 – 1.25 | §7.2 |
| `TraitFit` | 0.85 – 1.20 | 활성 특성 티어 |
| `AptitudeFlavor` | **0.88 – 1.15** | §8.3 |
| `G1ThemeFlavor` | 0.90 – 1.10 | 코스/거리/마장 일치 |
| `Diversity` | 0.75 – 1.20 | 이미 가진 증강/플랜과의 중복 |
| `AntiRepeat` | **0.25 – 1.00** | 이 매치에서 본 적 있으면 강한 감점 |
| `LobbyVariety` | 0.90 – 1.10 | §8.4 |
| `RNGJitter` | 0.94 – 1.06 | 시드 결정론 |

**곱 결과는 `[0.10, 4.00]`으로 최종 클램프한다.** 부동소수 곱이 폭주하지 않게 한다.

## 8.3 `AptitudeFlavor` — 퍼센타일 기반 (B10 해결)

```ts
/** node가 참조하는 적성 축의 percentile 값들을 평균해 ±15% 안으로 매핑 */
function aptitudeFlavor(profile: HorseRacingProfile | null, node: RacePlanDef): number {
  if (!profile) return 1.0;                       // 프로필 없으면 중립
  if (profile.confidence === 'VERY_LOW') return 1.0;  // 표본 부족 → 적성 미사용
  const axes = node.fit.aptitudeAxes ?? [];       // 예: ['stylePct.oikomi', 'distancePct.long']
  if (!axes.length) return 1.0;
  const mean = axes.reduce((n, a) => n + readPct(profile, a), 0) / axes.length;
  // mean 0.5 → 1.00,  mean 1.0 → 1.15,  mean 0.0 → 0.88
  return clamp(1 + (mean - 0.5) * 0.30 - (mean < 0.5 ? (0.5 - mean) * 0.04 : 0), 0.88, 1.15);
}
```

- **적성 등급 문자는 UI 표기에만 쓴다.** 가중치는 `*Pct`만 본다.
- `styleConfidence === 'LOW'`면 각질 축을 무시한다(7명 해당).
- 어떤 등급도 후보를 **삭제하지 않는다.** 최저 배율 0.88이면 여전히 뽑힌다.

## 8.4 `LobbyVariety`

같은 오퍼 타이밍에서 이미 몇 명에게 노출됐는지만 본다.

| 노출 인원 | 배율 |
|---:|---:|
| 0–2 | 1.00 |
| 3 | 0.97 |
| 4 | 0.94 |
| 5 | 0.91 |
| 6+ | 0.90 |

**금지하지 않는다.** 메타·조합이 같아서 같은 후보가 나오는 것은 정상이다.

## 8.5 `Diversity` — 증강체 중복 감점 (A13 연동)

```text
증강체가 이미 같은 축을 크게 밀고 있으면 감점:
  공격속도 증강 + ItemProfile.attackSpeed > 0.7  → 공속 계열 노드 ×0.78
  마나 증강 + ItemProfile.mana > 0.7             → 마나 계열 노드 ×0.80
  장기전 증강(AFTER_SECONDS 보유)                 → LATE/LAST_3F 노드 ×1.12
  방어 증강 + tank > 0.7                         → 생존 계열 노드 ×0.82
```

**증강체가 특정 Race Plan을 요구하게 만들지 않는다.** 감점은 최대 0.75까지만이고, 후보는 여전히 등장 가능하다.

## 8.6 상위 3개 그대로 반환 금지

```ts
const pool = scored.sort((a, b) => b.score - a.score).slice(0, 10);   // Top-K = 10
// 가중 추첨 (§11 시드). 슬롯 규칙(§9.1)을 만족할 때까지 재추첨, 최대 32회.
```

Top-K를 10으로 두면 같은 보드라도 매 판 다른 3장이 나온다.
K를 3으로 줄이면 시스템 전체가 무의미해진다. **K는 10 미만으로 낮추지 않는다.**

---

# 9. 3장의 구조 — 슬롯 + 카테고리

## 9.1 슬롯 역할 (전 단계 공통)

| 슬롯 | 이름 | 조건 |
|---|---|---|
| **A** | 현재 강점 강화 | `BoardFit × ItemFit ≥ 1.05` 인 후보 중에서 뽑는다 |
| **B** | 약점 보완 / 다른 전개 | 슬롯 A와 **다른 페이즈 대역**을 주력으로 하는 후보 |
| **C** | 경마적 / 실험 | 적성·코스·각질·피벗 가능성 태그(`FLAVOR`)를 가진 후보 |

강제 검증 (§28.3):
- 3장이 모두 같은 `majorTag`이면 실패
- `BoardFit ≥ 1.0`인 후보가 **최소 1장** 있어야 한다
- 이전 오퍼와 2장 이상 겹치면 실패 (리롤 시)

## 9.2 카테고리 — TFT 이상현상에서 차용 (B5)

**최종 승부수 32종은 반드시 아래 9개 중 하나를 가진다. 그리고 3장은 전부 다른 카테고리다.**

```ts
export type FinishingCategory =
  | 'FRONTRUN'    // 선행·초반 압박      (TFT '공격력' 계열 대응)
  | 'SUSTAIN'     // 지구력·생존         (TFT '탱커')
  | 'BURST'       // 종반 폭발           (TFT '위력')
  | 'SPELL'       // 스킬/마나 회전      (TFT '마법 피해' + '마나')
  | 'TEMPO'       // 공격속도·연타       (TFT '공격 속도')
  | 'AMPLIFY'     // 피해증폭·처형       (TFT '피해 증폭')
  | 'PASSING'     // 타겟 전환·추월      (고유)
  | 'SUPPORT'     // 팀 파급             (TFT '보조')
  | 'CRIT';       // 치명타              (TFT '치명타 확률')
```

카테고리는 UI에서 **카드 상단 52px 띠의 라벨과 색**으로 노출된다(§23.4).
플레이어가 "이번엔 생존/폭발/전환 중 뭘 고를까"를 즉시 읽을 수 있어야 한다.

기본 플랜 24종은 8개 `RacePlanCategory`를 쓴다 (§12).

## 9.3 추천 근거 생성 (C9)

내부 점수를 **절대 노출하지 않는다.** reason key → 한국어 문장으로 매핑한다.

```ts
export type OfferReason =
  | 'ITEM_AS_HIGH' | 'ITEM_AD_HIGH' | 'ITEM_AP_HIGH' | 'ITEM_TANK_HIGH' | 'ITEM_MANA_HIGH'
  | 'FAST_COMBAT' | 'LONG_COMBAT' | 'OVERTIME_OFTEN'
  | 'EARLY_FRONTLINE_COLLAPSE' | 'ENEMY_TANK_WALL' | 'CARRY_CAST_LATE'
  | 'LOW_LEVEL_REROLL' | 'HIGH_ECONOMY' | 'WIN_STREAK' | 'LOSS_STREAK'
  | 'STYLE_NIGE' | 'STYLE_SENKO' | 'STYLE_SASHI' | 'STYLE_OIKOMI'
  | 'DISTANCE_SPRINT' | 'DISTANCE_MILE' | 'DISTANCE_MIDDLE' | 'DISTANCE_LONG'
  | 'SURFACE_TURF' | 'SURFACE_DIRT' | 'COURSE_AFFINITY' | 'G1_THEME_MATCH'
  | 'TRAIT_ACTIVE' | 'CARRY_READY' | 'PIVOT_ROOM';
```

한국어 카피 (`src/data/manual/race-plan/reason-copy.json`):

```json
{
  "ITEM_AS_HIGH":             { "mark": "◎", "text": "공격속도 계열 장비 {n}개와 호응합니다." },
  "ITEM_AD_HIGH":             { "mark": "◎", "text": "공격력 계열 장비 {n}개와 호응합니다." },
  "ITEM_TANK_HIGH":           { "mark": "○", "text": "방어 장비 중심 편성과 맞습니다." },
  "FAST_COMBAT":              { "mark": "○", "text": "최근 3전 평균 {sec}초 — 승부가 일찍 납니다." },
  "LONG_COMBAT":              { "mark": "◎", "text": "최근 3전 평균 {sec}초 — 종반까지 이어집니다." },
  "OVERTIME_OFTEN":           { "mark": "◎", "text": "최근 전투가 자주 극한 승부로 갑니다." },
  "EARLY_FRONTLINE_COLLAPSE": { "mark": "△", "text": "전열이 도중에 먼저 무너지고 있습니다." },
  "ENEMY_TANK_WALL":          { "mark": "△", "text": "승부처에서 상대 전열이 아직 두껍습니다." },
  "CARRY_CAST_LATE":          { "mark": "△", "text": "승부마의 첫 스킬이 늦게 나옵니다." },
  "HIGH_ECONOMY":             { "mark": "○", "text": "보유 골드 {gold} — 고코스트 전환 여지가 큽니다." },
  "LOW_LEVEL_REROLL":         { "mark": "○", "text": "저코스트 3성 운영과 호응합니다." },
  "STYLE_OIKOMI":             { "mark": "○", "text": "추입 각질 기물 {n}명과 호응합니다." },
  "DISTANCE_LONG":            { "mark": "○", "text": "장거리 적성 기물 {n}명과 호응합니다." },
  "SURFACE_DIRT":             { "mark": "○", "text": "더트 적성 기물 {n}명과 호응합니다." },
  "COURSE_AFFINITY":          { "mark": "△", "text": "{course} 코스 적성이 있습니다." },
  "G1_THEME_MATCH":           { "mark": "◎", "text": "이번 GⅠ {race}의 거리·마장과 맞습니다." },
  "PIVOT_ROOM":               { "mark": "○", "text": "특정 기물에 묶이지 않는 전개입니다." }
}
```

**카드마다 근거 3~4개.** 최소 1개는 `△`(약점/주의)여야 한다 — 장점만 늘어놓으면 추천이 아니라 광고가 된다.
`{n}`·`{sec}`·`{gold}`·`{course}`·`{race}`는 서버가 채워 보낸다. 클라이언트가 다시 계산하지 않는다.

**금지 문구:** 승률 예측, 확률 수치, "최적", "정답", "AI 분석 결과".

---

# 10. 역할 가드 (Role Guard) — TFT `눈알 광선` 사고 방지 (B3)

## 10.1 문제

TFT 이상현상 `눈알 광선`(일직선 3칸 마법 피해)은 **원거리 챔피언이 뽑으면 광선이 적에게 닿지 않는다.**
"뽑으면 손해인 선택지"는 재미가 아니라 버그로 읽힌다.

v1.0에는 같은 구조의 함정이 최소 6개 있다:

| 노드 | 함정 |
|---|---|
| `RP_HIGH_PACE_GATE` (이동속도 +25%) | 첫 턴에 사거리 안이면 이동하지 않는 원거리에게 무의미 |
| `RP_TRACK_TURF` (이동 후 공속) | 원거리는 거의 이동하지 않는다 |
| `RP_PASS_OUTSIDE` / `FM_OUTSIDE_PASS` (재타겟 후 이동) | 근접은 이동 중 피해를 크게 먹는다 |
| `EV_PASS_BACKLINE` (가장 먼 적 우선) | 근접 유닛이 뒷열로 걸어가다 죽는다 |
| `RP_LEAD_RAIL` (가장 가까운 아군과 연결) | 고립 배치 캐리에게 무의미 |
| `EV_MID_FORMATION` (인접 아군) | 같은 문제 |

## 10.2 해법 — 선언 + 하드 제외

모든 카탈로그 노드는 아래를 **필수로 선언**한다.

```ts
export interface NodeGuard {
  /** 이 노드가 의미 있는 사거리. attackRange 1 = MELEE, 2+ = RANGED */
  appliesTo: 'MELEE' | 'RANGED' | 'ANY';
  /** 이 역할에서만 의미가 있으면 지정. 미지정 = 전 역할 */
  roles?: Role[];
  /** 인접 아군을 요구하면 true — 보드에 아군 2명 미만이면 오퍼에서 제외 */
  needsAdjacentAlly?: boolean;
  /** 처치 관여를 요구하면 true — 캐리가 아닌 탱커 등록 시 감점 */
  needsTakedown?: boolean;
}
```

**GⅠ 출주 등록 이후(= 승부수 단계)에는 가드를 하드 필터로 쓴다.**

```ts
function guardPasses(node: FinishingMoveDef, unit: UnitDef, board: UnitInstance[]): boolean {
  const ranged = unit.attackRange >= 2;
  if (node.guard.appliesTo === 'MELEE' && ranged) return false;
  if (node.guard.appliesTo === 'RANGED' && !ranged) return false;
  if (node.guard.roles && !node.guard.roles.includes(unit.role)) return false;
  if (node.guard.needsAdjacentAlly && board.length < 3) return false;
  return true;
}
```

**출주 등록 이전(플랜/진화)에는 소프트 가드로 쓴다** — 아직 유닛이 정해지지 않았으므로
보드의 근접:원거리 비율로 가중치를 ±15% 조정한다.

## 10.3 가드로 인해 후보가 3장 미만이 되는 경우

```text
1. 가드를 통과하는 노드만으로 3장을 채운다.
2. 부족하면 appliesTo === 'ANY' 인 노드에서 채운다.
3. 그래도 부족하면 §15.2의 범용 승부수 8종(모두 'ANY')에서 채운다.
→ 어떤 유닛도 반드시 3장을 받는다. 2장이 나오는 경우는 버그다.
```

범용 8종(`FM_EVEN_PACE`, `FM_SECOND_WIND`, `FM_LONG_SPURT`, `FM_LAST_3F`, `FM_HEART`,
`FM_PHOTO_FINISH`, `FM_ONE_TARGET`, `FM_STAYER`)은 **절대 가드를 갖지 않는다.**

---

# 11. 결정론

## 11.1 시드 (A17 — 실제 API 형태)

```ts
// 잘못된 v1.0 표기: seed = matchSeed + playerId + offerPhase + rerollIndex (문자열 덧셈)
// 실제 API:
const rng = Rng.forStream(
  state.seed,
  `race-plan:${playerId}:${phase}:${state.stage}-${state.round}:${rerollIndex}`,
);
```

`Rng.forStream`은 내부에서 `deriveSeed(matchSeed, name)` → FNV-1a 해시 → 8회 워밍업을 한다.
**스트림 이름이 다르면 호출 횟수가 서로를 오염시키지 않는다.** 이게 이 프로젝트의 기존 보장이다.

## 11.2 `rngStates` 동기화

RoundDirector는 `RngRegistry`를 통해 스트림을 만들고 `syncRng()`로 `MatchState.rngStates`에 저장한다.
**Race Plan에서 rng를 쓴 뒤 반드시 `this.syncRng()`를 호출한다.** 빼먹으면 재접속 시 결과가 갈라진다.

## 11.3 클라이언트 계산 금지

| 항목 | 계산 주체 |
|---|---|
| 후보 ID 3개, 순서 | 서버 |
| 추천 근거 key + 치환값 | 서버 |
| `EntryFit` 순위와 `◎○▲` 마크 | 서버 |
| 툴팁 문장 렌더 | 클라이언트 |
| 아이콘/색/애니메이션 | 클라이언트 |

클라이언트가 임의 ID를 보내면 서버는 (a) 현재 오퍼에 있는지 (b) 현재 phase가 맞는지 (c) 이미 선택했는지
를 검증하고 거부한다. 거부 메시지는 한국어 1문장 (`applyOnlineCommand` 반환 규약).

## 11.4 재현성 테스트

`tests/race-plan-determinism.test.ts` — 같은 `MatchState`를 두 번 복제해 오퍼를 만들면
**후보 ID 배열과 근거 배열이 완전히 동일**해야 한다. 리롤 3회까지 반복.

---

# 12. 기본 Race Plan 카탈로그 — 24종

## 12.0 데이터 형식

`src/data/manual/race-plan/plans.json`

```jsonc
{
  "id": "RP_SLOW_STORE",
  "nameKo": "힘 비축",
  "nameJa": "脚を溜める",
  "category": "SLOW_PACE",
  "majorTag": "LATE",
  "descriptionKo": "템을 아끼고 종반에 각력을 해방합니다.",
  "baseWeight": 1.0,
  "guard": { "appliesTo": "ANY" },
  "fit": {
    "roles": ["AD_CARRY", "AP_CARRY", "BRUISER"],
    "itemAxes": ["ad", "ap", "sustain"],
    "economy": ["FAST_8", "FAST_9", "FLEX"],
    "styles": ["sashi", "oikomi"],
    "aptitudeAxes": ["stylePct.sashi", "stylePct.oikomi", "distancePct.long"],
    "phases": ["LAST_3F"]
  },
  "vfx": { "key": "vfx_race_store", "color": "#3f785d", "accent": "#a98b4b" },
  "effects": [ /* EffectDef[] — §12.9 참조 */ ]
}
```

- `effects`는 **기존 `EffectDef` 그대로**다. 새 스키마를 만들지 않는다.
- Race Plan 효과는 **출주마 1명에게만** 바인딩된다. 단 `TEAM_SUPPORT` 태그가 붙은 것만 아군에게 퍼진다.
- 출주 등록 전(Stage 2-5 ~ 4-4)에는 플랜 효과가 **보드 전체가 아니라 `CarryScore` 1위 유닛**에게 임시 적용된다.
  → 이렇게 해야 "아직 승부마를 못 정했다"가 무력한 라운드가 되지 않는다. UI에 `임시 승부마` 뱃지를 표시한다(§23.6).

## 12.1 A. 하이 페이스 `HIGH_PACE`

| id | 이름 | 가드 | 효과 (정확한 수치) |
|---|---|---|---|
| `RP_HIGH_PACE_PRESSURE` | 전반 압박 | ANY | START~POSITIONING 전반(진행도 0–0.30) 공격속도 **+12%**. 첫 처치 관여 후 **5초** 피해증폭 **+8%**(1회). |
| `RP_HIGH_PACE_GATE` | 게이트 선점 | **MELEE** | 전투 시작 **6초** 이동속도 **+25%**. 첫 기본 공격 시 마나 **+8**. START 중 스킬을 쓰면 **6초** 방어력·마저 **+10**. |
| `RP_HIGH_PACE_BREAK` | 선두 붕괴 | ANY / roles: `AD_CARRY`,`AP_CARRY`,`BRUISER` | START~POSITIONING 동안 같은 대상 **4회 연속 타격**부터 방어·마저 관통 **12%**. 대상 변경 시 **2회 타격**까지 유지. |

```jsonc
// RP_HIGH_PACE_PRESSURE effects
[
  { "kind": "STAT_MUL", "stat": "attackSpeed", "value": 0.12,
    "trigger": { "when": "COMBAT_START" }, "duration": 9.0 },
  { "kind": "DAMAGE_AMP", "value": 0.08, "duration": 5, "oncePerCombat": true,
    "trigger": { "when": "ON_TAKEDOWN_ASSIST" } }
]
```

> `duration: 9.0`은 "진행도 0.30 ≒ 9초"의 시계 근사다.
> **진행도 기반 종료가 필요한 효과는 `ON_RACE_PHASE` 트리거로 해제한다** (§17.1.3).

## 12.2 B. 선두 유지 `LEAD_CONTROL`

| id | 이름 | 가드 | 효과 |
|---|---|---|---|
| `RP_LEAD_CONTROL` | 선두 고정 | ANY | START 동안 받는 피해 **−8%**. START를 생존 통과하면 전투 종료까지 공격력·주문력 **+6%**. |
| `RP_LEAD_RAIL` | 내측 장악 | ANY, `needsAdjacentAlly: true` | 전투 시작 시 가장 가까운 아군 1명과 **6초** 서로 피해감소 **5%**. 같은 적을 공격 중이면 공격속도 **+8%**, 전투당 최대 **2중첩**. |
| `RP_LEAD_TEMPO` | 일정한 랩 | ANY | **5초마다** 공격속도 **+3%**, 방어력·마저 **+3**. 최대 **4중첩**. `LATE` 진입 후 추가 중첩 없음. |

## 12.3 C. 미들 페이스 `MIDDLE_PACE`

| id | 이름 | 가드 | 효과 |
|---|---|---|---|
| `RP_MIDDLE_BALANCE` | 왕도 전개 | ANY | START 방어·마저 **+8** → POSITIONING 공격력·주문력 **+5%** → LATE 이후 공격속도 **+10%**. 구간 전환 시 이전 보너스는 사라진다. |
| `RP_MIDDLE_CYCLE` | 호흡 조절 | ANY, roles: `AP_CARRY`,`SUPPORT`,`BRUISER` | 첫 스킬 후 **5초** 초당 마나 **+1**. 두 번째 스킬 후 **5초** 모든 피해 흡혈 **+6%**. 이후 반복 없음. |
| `RP_MIDDLE_POSITION` | 좋은 자리 | ANY | 진행도 **0.27 / 0.47** 시점에 생존 중이면 각각 공격력·주문력 **+4%** (최대 2중첩). `LATE` 진입 시 체력 **8%** 회복. |

## 12.4 D. 슬로 페이스 `SLOW_PACE`

| id | 이름 | 가드 | 효과 |
|---|---|---|---|
| `RP_SLOW_STORE` | 힘 비축 | ANY | START~POSITIONING 공격속도 **−5%**. **2초마다 각력 +1**(최대 5). `LATE` 진입 시 각력 1당 공격력·주문력 **+1.5%** (최대 **+7.5%**). |
| `RP_SLOW_PATIENCE` | 마각 대기 | ANY | 진행도 0.50까지 받는 피해 **−5%**. 그 이후 기본 공격 적중 시 대상에게 **4초** 방어·마저 **−8%** (중첩 불가, 갱신). |
| `RP_SLOW_STAMINA` | 지구력 보존 | ANY | **5초마다** 최대 체력 **2.5%** 회복. `LATE` 진입 시 회복 종료, 그 시점 체력이 **60% 이상**이면 전투 종료까지 피해증폭 **+8%**. |

## 12.5 E. 추월 전개 `PASSING`

| id | 이름 | 가드 | 효과 |
|---|---|---|---|
| `RP_PASS_OUTSIDE` | 외곽 추월 | **RANGED** | `LATE` 진입 시 현재 대상 체력이 **50% 이상**이면 사거리 내 체력 비율 최저 적으로 **1회 재타겟**. 재타겟 후 **5초** 공격속도 **+20%**. |
| `RP_PASS_GAP` | 마군 돌파 | ANY | `LATE` 이후 **처음** 새 적을 공격할 때 **6초** 방어·마저 관통 **15%**. 전투당 1회. |
| `RP_PASS_CHAIN` | 연속 추월 | **MELEE**, `needsTakedown: true` | 처치 관여 시 **4초** 이동속도 **+30%**, 공격속도 **+10%**. 전투당 최대 **3회**. |

> `RP_PASS_OUTSIDE`를 RANGED로 못 박은 것이 §10의 실제 적용 예다.
> 근접 유닛이 이걸 뽑으면 재타겟 후 걸어가는 동안 죽는다. 그래서 아예 주지 않는다.
> 근접용 대응 노드는 `RP_PASS_CHAIN`이다.

## 12.6 F. 라스트 3F `LAST_3F`

**A16 때문에 이 계열의 주력 축은 공격속도가 아니다.**

| id | 이름 | 가드 | 효과 |
|---|---|---|---|
| `RP_LAST3F_ACCEL` | 종반 가속 | ANY | `LATE` 진입 시 피해증폭 **+8%**, `LAST_3F` 진입 시 추가 **+8%**. `OVERTIME`에서는 증가 없음. |
| `RP_LAST3F_KICK` | 끝걸음 | ANY | `LAST_3F` 진입 시 공격력·주문력 **+18%**. 그 시점 체력이 **50% 미만**이면 모든 피해 흡혈 **+8%** 추가. |
| `RP_LAST3F_FINISH` | 결승선 집중 | ANY | `LAST_3F` 진입 후 **첫 스킬** 피해 **+20%**. 적을 처치하면 이 보너스가 **1회 재장전**(전투당 최대 2회 발동). |

## 12.7 G. 근성 승부 `GUTS`

| id | 이름 | 가드 | 효과 |
|---|---|---|---|
| `RP_GUTS_LOW_HP` | 근성 | ANY | 체력이 처음 **35% 아래**로 내려갈 때 **2초** 피해감소 **25%**. 이후 전투 종료까지 공격력·주문력 **+7%**. |
| `RP_GUTS_DUEL` | 목 차 승부 | ANY | 현재 대상과 **5초 이상** 교전 중이면 그 대상에게 피해증폭 **+10%**. 대상 변경 시 즉시 초기화. |
| `RP_GUTS_COMEBACK` | 차이 좁히기 | ANY | 살아 있는 아군이 적보다 **2명 이상 적어지는 첫 순간** **6초** 공격속도 **+15%**, 방어·마저 **+12**. 전투당 1회. |

## 12.8 H. 마장 적응 `TRACK`

| id | 이름 | 가드 | 효과 |
|---|---|---|---|
| `RP_TRACK_TURF` | 잔디 리듬 | **MELEE** | 이동을 마치거나 대상을 바꾼 뒤 **4초** 공격속도 **+10%**. 전투당 최대 **2회**. |
| `RP_TRACK_DIRT` | 모래 버티기 | ANY | 기본 공격에 **6회 피격**할 때마다 **5초** 방어·마저 **+12**. 전투당 최대 **2회**. |
| `RP_TRACK_GOING` | 마장 읽기 | ANY | 라운드 공통 `TrackState`에 따라 **총량이 같은** 다른 보너스. |

### 12.8.1 `TrackState` (B12 해결)

```ts
export type TrackState = 'FAST' | 'STANDARD' | 'HEAVY';
// 각 PvP 라운드 시작 시 단 1회, 라운드 전체 공통.
const trackState = pickWeighted(
  [['FAST', 25], ['STANDARD', 55], ['HEAVY', 20]],
  director.rngs.get('race-track'),           // ← rngStates에 저장됨
);
```

- **플레이어별로 다르게 굴리지 않는다.** 8명이 같은 "이번 라운드 마장"에서 싸운다.
- `MatchState.racePlanTrack: TrackState`에 저장하고 라운드 전환마다 갱신한다.
- `TrackState`는 **Race Plan 효과가 참조할 때만 작동한다.** 일반 유닛의 스탯/이동속도를 전역으로 바꾸지 않는다.

| TrackState | `RP_TRACK_GOING` 효과 | 표시 |
|---|---|---|
| `FAST` (양호) | START~POSITIONING 공격속도 **+12%** | 🟩 `양호` |
| `STANDARD` (약간 무거움) | POSITIONING~LATE 공격력·주문력 **+7%** | 🟨 `중` |
| `HEAVY` (불량) | 전 구간 받는 피해 **−6%**, **8초마다** 체력 **4%** 회복 | 🟫 `불량` |

**going 적성(22/145만 보유)을 조건으로 쓰지 않는다.** TrackState는 순수 라운드 난수다.
going 적성이 있는 유닛은 툴팁에 `중마장 적성 GOOD` 한 줄이 추가될 뿐이다.

## 12.9 전체 플랜 효과 JSON — 대표 3종 전문

```jsonc
// RP_SLOW_STORE — 각력 축적형
"effects": [
  { "kind": "STAT_MUL", "stat": "attackSpeed", "value": -0.05,
    "tag": "RACE_PHASE_UNTIL:LATE", "trigger": { "when": "COMBAT_START" } },
  { "kind": "STACKING_STAT", "stat": "__legPower", "value": 1, "maxStacks": 5,
    "trigger": { "when": "EVERY_SECONDS", "threshold": 2 }, "tag": "RESOURCE" },
  { "kind": "STAT_MUL", "stat": "attackDamage", "value": 0.015,
    "tag": "PER_LEG_POWER", "trigger": { "when": "ON_RACE_PHASE", "phase": "LATE" } },
  { "kind": "STAT_MUL", "stat": "abilityPower", "value": 0.015,
    "tag": "PER_LEG_POWER", "trigger": { "when": "ON_RACE_PHASE", "phase": "LATE" } }
]

// RP_LAST3F_KICK — 조건 분기형
"effects": [
  { "kind": "STAT_MUL", "stat": "attackDamage", "value": 0.18,
    "trigger": { "when": "ON_RACE_PHASE", "phase": "LAST_3F" } },
  { "kind": "STAT_MUL", "stat": "abilityPower", "value": 0.18,
    "trigger": { "when": "ON_RACE_PHASE", "phase": "LAST_3F" } },
  { "kind": "OMNIVAMP", "value": 0.08,
    "trigger": { "when": "ON_RACE_PHASE", "phase": "LAST_3F", "hpBelow": 0.5 } }
]

// RP_GUTS_LOW_HP — 기존 트리거 그대로 사용 (신규 코드 0줄)
"effects": [
  { "kind": "DAMAGE_REDUCTION", "value": 0.25, "duration": 2, "oncePerCombat": true,
    "trigger": { "when": "HP_BELOW", "threshold": 0.35 } },
  { "kind": "STAT_MUL", "stat": "attackDamage", "value": 0.07, "oncePerCombat": true,
    "trigger": { "when": "HP_BELOW", "threshold": 0.35 } },
  { "kind": "STAT_MUL", "stat": "abilityPower", "value": 0.07, "oncePerCombat": true,
    "trigger": { "when": "HP_BELOW", "threshold": 0.35 } }
]
```

`__legPower`·`__stamina`는 `BattleStats`가 아니라 **`CombatUnit`의 Race Plan 전용 카운터**다(§18).
`STACKING_STAT`을 재사용하되 `tag: "RESOURCE"`로 분기한다.

---

# 13. Stage 3 전개 수정 — 진화 노드 24종

## 13.1 구조

기본 플랜 × 진화를 전부 하드코딩하지 않는다. **`EvolutionTag`로 호환성을 판정한다.**

```ts
export type EvolutionTag =
  | 'MORE_EARLY' | 'MORE_LATE' | 'SURVIVAL' | 'CAST' | 'BASIC_ATTACK'
  | 'EXECUTE' | 'POSITION' | 'STACK' | 'RESET' | 'PENETRATION'
  | 'SUSTAIN' | 'TEAM_SUPPORT';

// 호환 판정: 플랜의 tags와 진화의 requires가 1개 이상 겹치면 후보
compatible(plan, evo) = plan.tags.some(t => evo.requires.includes(t));
```

24종 전부 필수 구현. 각 플랜은 평균 **9~14개**의 호환 진화를 갖는다 (풀 부족 방지).

## 13.2 진화 24종 — 정확한 수치

| # | id | 이름 | requires | 가드 | 효과 |
|---:|---|---|---|---|---|
| 1 | `EV_EARLY_OVERPACE` | 오버페이스 | `MORE_EARLY` | ANY | 기본 플랜의 **START/POSITIONING 보너스 +35%**. 단 `LATE` 진입 후 그 보너스는 **절반**. |
| 2 | `EV_EARLY_CLEAN_START` | 호발 | `MORE_EARLY` | ANY | START 안에 첫 스킬을 쓰면 최대 체력 **10%** 보호막 **8초**. |
| 3 | `EV_EARLY_FRONT_LOCK` | 선두 고정 | `MORE_EARLY`,`BASIC_ATTACK` | ANY | 첫 대상에게 **8초간 피해증폭 +10%**. 대상을 바꾸면 즉시 종료. |
| 4 | `EV_MID_EFFICIENT` | 효율적인 랩 | `CAST` | ANY | POSITIONING 동안 스킬 마나 비용 **−5**. |
| 5 | `EV_MID_SECOND_WIND` | 두 번째 호흡 | `SUSTAIN`,`SURVIVAL` | ANY | 진행도 **0.40**에 체력 **10%** 회복, **0.60**에 마나 **+10**. |
| 6 | `EV_MID_FORMATION` | 대열 유지 | `POSITION`,`SURVIVAL` | `needsAdjacentAlly` | 가장 가까운 아군이 살아 있는 동안 서로 피해감소 **6%**. |
| 7 | `EV_LATE_SAVE_LEGS` | 각력 온존 | `MORE_LATE`,`STACK` | ANY | `LATE` 이전 공격속도 **−4%**, `LATE` 이후 **+18%**. |
| 8 | `EV_LATE_LONG_SPURT` | 롱 스퍼트 | `MORE_LATE` | ANY | 진행도 **0.60**부터 **0.40 구간에 걸쳐** 공격속도 0%→**+24%** 선형 증가. `OVERTIME` 진입 시 고정. |
| 9 | `EV_LATE_ONE_KICK` | 한 번의 끝걸음 | `MORE_LATE`,`CAST` | ANY | `LAST_3F` 진입 후 **첫 스킬** 피해 **+30%**. 이후 추가 없음. |
| 10 | `EV_PASS_WEAK` | 약자 추월 | `EXECUTE`,`RESET` | ANY | 새 대상의 체력이 **50% 미만**이면 **4초** 그 대상에게 피해증폭 **+12%**. |
| 11 | `EV_PASS_BACKLINE` | 외곽 진로 | `POSITION` | **RANGED** | `LATE` 진입 시 **1회**, 사거리 내 가장 먼 적을 우선 대상으로. |
| 12 | `EV_PASS_ARMOR` | 마군 개방 | `PENETRATION` | ANY | 새 대상 공격 시 **5초** 방어·마저 관통 **+12%**. 재사용 대기 **6초**. |
| 13 | `EV_GUTS_SHIELD` | 버티기 | `SURVIVAL` | ANY | 체력 **35%** 도달 시 최대 체력 **12%** 보호막 **5초**. 전투당 1회. |
| 14 | `EV_GUTS_HEAL` | 재가속 | `SURVIVAL`,`SUSTAIN` | ANY | 저체력 발동 후 **6초** 동안 가한 피해의 **8%** 회복. |
| 15 | `EV_GUTS_LAST` | 마지막 한 걸음 | `SURVIVAL` | ANY | 치명적 피해를 받으면 **1.25초** 체력 1로 생존하고 공격속도 **+20%**. 전투당 1회. |
| 16 | `EV_CAST_RHYTHM` | 호흡 | `CAST` | ANY | **두 번째 스킬부터** 시전 후 마나 **6** 반환. |
| 17 | `EV_CAST_FINISH` | 결승선 스킬 | `CAST`,`MORE_LATE` | ANY | `LAST_3F` 이후 스킬 피해 **+15%**. |
| 18 | `EV_ATTACK_RHYTHM` | 보폭 | `BASIC_ATTACK` | ANY | 기본 공격 **5회마다** **5초** 공격속도 **+10%**. |
| 19 | `EV_ATTACK_PRESSURE` | 압박 | `BASIC_ATTACK`,`PENETRATION` | ANY | 같은 대상 **6회** 공격 시 그 대상 방어·마저 **−10%**, **4초**. |
| 20 | `EV_TEAM_PACE` | 페이스 메이커 | `TEAM_SUPPORT` | `needsAdjacentAlly` | 출주마가 스킬을 쓰면 인접 아군 **2명**에게 **4초** 공격속도 **+8%**. |
| 21 | `EV_STAMINA_BANK` | 지구력 비축 | `STACK`,`SUSTAIN` | ANY | **5초마다 지구력 +1**(최대 6). `LATE` 진입 시 스택당 방어·마저 **+3** (최대 +18). |
| 22 | `EV_STAMINA_CONVERT` | 지구력 전환 | `STACK`,`SUSTAIN` | ANY | `LATE` 이후 회복량의 **35%**를 공격력으로 전환 (전투당 최대 공격력 **+40**). |
| 23 | `EV_TRACK_ADAPT` | 마장 적응 | 전체 | ANY | 이번 라운드 `TrackState`에 따라 **총량이 같은** 다른 보너스 (§12.8.1 표와 동일 구조, 수치 60%). |
| 24 | `EV_COURSE_SENSE` | 코스 감각 | 전체 | ANY | 출주마의 코스 affinity가 이번 GⅠ 테마와 일치하면 **고유 명칭·연출**로 표시. 수치 우위는 **최대 +5%**. |

## 13.3 진화가 하지 않는 것

- 기본 플랜의 **카테고리를 바꾸지 않는다.** 슬로 페이스를 골랐는데 진화가 하이페이스가 되면 안 된다.
- 진화 단독으로는 의미 없는 노드를 만들지 않는다. `EV_EARLY_OVERPACE` 같은 "배율형"은
  **참조할 기본 보너스가 있는 플랜에만** 호환 목록을 연다.
- `EV_COURSE_SENSE`의 +5%는 **AptitudeFlavor와 중복 적용되지 않는다.** 둘 중 큰 값 하나만.

---

# 14. GⅠ 출주 등록

## 14.1 후보 범위

| 포함 | 제외 |
|---|---|
| 현재 보드 유닛 | 소환물 (`id.includes('~summon')`) |
| 벤치 유닛 (경고 표시, §16.4) | PvE 전용 유닛 (`PVE_UNIT_IDS`) |
| | 판매 예약 중인 유닛 |

## 14.2 `EntryFit` — 추천 점수

```text
EntryFit =
  0.30 × CarryScore              (§6.1)
+ 0.20 × RacePlanFit             현재 플랜/진화의 fit과 유닛 role/style/거리 일치도
+ 0.15 × ItemFit                 유닛 장착 아이템 ↔ 플랜 itemAxes 내적
+ 0.10 × RecentContribution      최근 3전 이 유닛의 피해·보호막 기여 비율
+ 0.10 × RoleCompatibility       플랜의 roles 포함 여부
+ 0.10 × RealAptitudeFlavor      §8.3의 퍼센타일 (여기서도 최대 ±15%)
+ 0.05 × SignatureCompatibility  고유 승부수 보유 여부
```

**실제 경마 적성은 총 10%다.** 이 비중을 올리지 않는다.

## 14.3 추천 마크

| 마크 | 조건 | 색 |
|---|---|---|
| `◎` | `EntryFit` 1위이며 2위와 **0.06 이상** 차이 | `--race-brass` `#a98b4b` |
| `○` | 1위의 **85% 이상** | `--race-green-500` `#3f785d` |
| `▲` | 1위의 **60~85%** 이면서 `FLAVOR` 태그 일치 (적성/코스/각질) | `--race-blue` `#3d6679` |
| (무표시) | 나머지 | — |

**마크는 선택을 막지 않는다.** 무표시 유닛도 클릭 한 번으로 등록할 수 있다.
`◎`가 없는 경우(1위와 2위가 팽팽함)도 정상이다. 억지로 `◎`를 만들지 않는다.

## 14.4 자동 등록

Stage **5-2** 준비 종료 시점에 미등록이면 `EntryFit` 1위를 자동 등록하고,
승부수도 그 시점 오퍼의 **추천 1위**를 자동 선택한다. 토스트 1줄:

```text
GⅠ 출주 등록 마감 — 키타산 블랙 / 불침함의 스테이어
```

---

# 15. 최종 승부수 (Finishing Move)

초기 물량: **범용 26 + 고유 16 = 42종.**
(플랜 24 + 진화 24 + 승부수 42 = **총 90노드**)
한 유닛에게 제시되는 것은 언제나 정확히 **3장**이며, **전부 다른 `FinishingCategory`** 다(§9.2).

## 15.1 카테고리별 범용 26종 — 정확한 수치

### FRONTRUN (선행·초반)

| id | 이름 | 가드 | 효과 |
|---|---|---|---|
| `FM_BREAKAWAY` | 단독 선두 | ANY | START~POSITIONING 초반(진행도 0–0.27) 공격속도 **+22%**. 이 구간을 생존 통과하면 전투 종료까지 공격력·주문력 **+8%**. |
| `FM_GATE_BURST` | 게이트 폭발 | MELEE | 전투 시작 시 마나 **+20**, **5초** 이동속도 **+35%**. 첫 스킬 피해 **+15%**. |
| `FM_FRONT_COMMAND` | 선두 지휘 | ANY · `needsAdjacentAlly` | 스킬 시전 시 가장 가까운 아군 **2명**에게 **5초** 공격속도 **+10%**. 재사용 대기 **8초**. |

### SUSTAIN (지구력·생존)

| id | 이름 | 가드 | 효과 |
|---|---|---|---|
| `FM_STAYER` | 스테이어 | ANY | **5초마다 지구력 +1**(최대 6). 스택당 피해감소 **2%**(최대 12%). `LAST_3F` 진입 시 스택당 공격력·주문력 **+2%**(최대 12%). |
| `FM_HEART` | 근성 | ANY | 체력 **30%** 도달 시 **2초** 피해감소 **40%**, 이후 **8초** 모든 피해 흡혈 **+12%**. 전투당 1회. |
| `FM_PHOTO_FINISH` | 사진 판정 | ANY | 치명적 피해를 받으면 **1.0초** 체력 1로 생존. 그 1초 안에 처치 관여하면 체력 **15%** 회복. 전투당 1회. |
| `FM_HEAVY_GOING` | 중마장 | ANY | 받는 이동속도·공격속도 감소를 **35%** 경감. **10초마다** 체력 **5%** 회복. |

### BURST (종반 폭발)

| id | 이름 | 가드 | 효과 |
|---|---|---|---|
| `FM_TURN_OF_FOOT` | 순간 가속 | ANY | `LATE` 진입 시 **6초** 공격속도 **+35%**. |
| `FM_LONG_SPURT` | 롱 스퍼트 | ANY | 진행도 **0.60 → 1.00** 구간에서 공격속도 0%→**+30%**, 공격력·주문력 0%→**+12%** 선형 증가. `OVERTIME` 진입 시 고정. |
| `FM_LAST_3F` | 라스트 3F | ANY | `LAST_3F` 진입 시 피해증폭 **+12%**, 공격속도 **+25%**. |
| `FM_FINAL_KICK` | 끝걸음 | ANY | `LAST_3F` 이후 **첫 스킬** 피해 **+35%**. 그 스킬로 적을 처치하면 **1회 재사용** 가능. |
| `FM_SAVE_LEGS` | 각력 온존 | ANY | 기본 공격 **+1**, 스킬 시전 **+2** 각력(최대 10). `LAST_3F` 진입 시 전부 소모, **6초** 동안 각력 1당 공격력·주문력 **+2%**(최대 +20%). |

### SPELL (스킬·마나)

| id | 이름 | 가드 | 효과 |
|---|---|---|---|
| `FM_SECOND_WIND` | 두 번째 호흡 | ANY | 진행도 **0.40 / 0.73** 시점에 각각 체력 **8%**, 마나 **+10** 회복. |
| `FM_PACE_MAKER` | 페이스 메이커 | ANY | 출주마가 공격 중인 대상에게 다른 아군이 피해를 주면 출주마 마나 **+1**. **초당 최대 2**. |
| `FM_RHYTHM_CAST` | 리듬 시전 | ANY · roles `AP_CARRY`,`SUPPORT` | 스킬 시전 후 **4초** 초당 마나 **+2**. 두 번째 시전부터 스킬 피해 **+8%** 누적, 최대 **3중첩**. |

### TEMPO (공격속도)

| id | 이름 | 가드 | 효과 |
|---|---|---|---|
| `FM_EVEN_PACE` | 정속 주행 | ANY | **5초마다** 공격력·주문력 **+3%**, 방어·마저 **+3**. 최대 **4중첩**. |
| `FM_TURF_STRIDE` | 잔디 보폭 | MELEE | 이동을 마치거나 대상을 바꾼 뒤 **다음 3회 공격** 공격속도 **+20%**. |
| `FM_DIRT_GRIND` | 모래 싸움 | ANY | 기본 공격 **5회 피격**마다 방어·마저 **+8**, 최대 **3중첩**. 최대 중첩 상태에서 공격 시 대상에게 **5초** 방어·마저 **−10%**. |

### AMPLIFY (증폭·처형)

| id | 이름 | 가드 | 효과 |
|---|---|---|---|
| `FM_CHASER` | 추격자 | ANY | 자신보다 체력 **비율이 낮은** 적에게 피해 **+10%**. 처치 관여 후 **4초** 이동속도 **+20%**, 공격속도 **+10%**. |
| `FM_ONE_TARGET` | 일대일 승부 | ANY | 같은 적과 **6초 이상** 교전 시 그 적에게 피해 **+15%**. 대상 변경 시 초기화. |
| `FM_COURSE_SPECIALIST` | 코스 전문가 | ANY | 기본: POSITIONING~LATE 공격력·주문력 **+8%**, `LATE` 이후 방어·마저 **+8**. 이번 GⅠ 코스에 `FAVORITE` 적성이면 **+2%p** 추가(최대치). 이름이 해당 코스명으로 바뀐다. |

### PASSING (전환·추월)

| id | 이름 | 가드 | 효과 |
|---|---|---|---|
| `FM_OUTSIDE_PASS` | 외곽 추월 | **RANGED** | `LATE` 진입 시 **1회** 원거리 우선 재타겟. 재조준 중 받는 피해 **−25%**, 완료 후 **5초** 공격속도 **+20%**. |
| `FM_GAP_SHOT` | 마군 돌파 | ANY | `LATE` 이후 새 대상을 공격한 **첫 5초** 동안 방어·마저 관통 **+20%**. |

### SUPPORT / CRIT

| id | 이름 | 카테고리 | 가드 | 효과 |
|---|---|---|---|---|
| `FM_LEFT_HAND` | 좌회전 적응 | SUPPORT | ANY | 진행도 **0.33 / 0.67** 시점에 각각 **4초** 공격속도 **+12%**. 좌회전 GⅠ 테마면 이름만 `좌회전의 이점`으로 바뀐다. |
| `FM_PHOTO_EDGE` | 종반 집중 | CRIT | ANY · roles `AD_CARRY`,`BRUISER` | `LATE` 진입 시 치명타 확률 **+25%**, 치명타 피해 **+15%**. 치명타 적중 시 대상에게 **3초** 출혈(치명타 피해의 **30%**를 같은 피해 유형으로 분할). |

> **범용 26종 중 8종**(`FM_EVEN_PACE`, `FM_SECOND_WIND`, `FM_LONG_SPURT`, `FM_LAST_3F`,
> `FM_HEART`, `FM_PHOTO_FINISH`, `FM_ONE_TARGET`, `FM_STAYER`)은 **가드가 없는 안전판**이다.
> 어떤 유닛에게도 3장을 채울 수 있게 보장한다(§10.3).

### 15.1.1 카테고리 충족 가능성 증명 (필수 불변식)

"3장 전부 다른 카테고리"(§9.2)와 "역할 가드 하드 필터"(§10)는 서로 충돌할 수 있다.
아래가 **어떤 유닛에서도 성립하는 하한**이다.

| 안전판 (가드 없음) | 카테고리 |
|---|---|
| `FM_EVEN_PACE` | TEMPO |
| `FM_SECOND_WIND` | SPELL |
| `FM_LONG_SPURT`, `FM_LAST_3F` | BURST |
| `FM_HEART`, `FM_PHOTO_FINISH`, `FM_STAYER` | SUSTAIN |
| `FM_ONE_TARGET` | AMPLIFY |

→ 가드를 전부 무시해도 **항상 5개 이상의 서로 다른 카테고리**가 남는다.
`race-plan-role-guard.test.ts`가 **로스터 145명 × 전 노드를 전수 검사**해 이 불변식을 검증한다.

카테고리별 범용 노드 수: FRONTRUN 3 · SUSTAIN 4 · BURST 5 · SPELL 3 · TEMPO 3 ·
AMPLIFY 4(`FM_RACE_READ` 포함) · PASSING 2 · SUPPORT 1 · CRIT 1 = **26**.
`SUPPORT`/`CRIT`는 1종뿐이므로 **Phase B 확장 시 이 두 카테고리를 먼저 채운다.**

## 15.2 삭제된 v1.0 노드 (B4)

| v1.0 | 문제 | 대체 |
|---|---|---|
| `FM_FREE_RUNNING` "가장 부족한 축 자동 보정" | 툴팁 불가, 검증 불가, 학습 불가 | **삭제.** `FM_EVEN_PACE`가 역할을 대신한다 |
| `FM_RACE_SENSE` "자동 생존/공격 분기" | 위와 동일 | **`FM_RACE_READ`로 재작성** ↓ |

```text
FM_RACE_READ — 전개 읽기 (AMPLIFY, ANY)
  LATE 진입 시, 살아 있는 적의 수를 센다.
    · 적이 아군보다 많다  → 방어·마저 +20, 받는 피해 −8%   (기다린다)
    · 그 외              → 피해증폭 +12%                  (간다)
  선택된 분기를 전투 종료까지 유지한다. 판정은 LATE 진입 순간 1회뿐이다.
```

**"자동 최적화"가 아니라 "명시적 2분기"다.** 툴팁에 양쪽 결과를 전부 적는다.

## 15.3 고유 승부수 16종 — 로스터 실존 확인 완료

**아래 16명은 `src/data/generated/all-units.json`에 실재하는 것을 확인했다.**
괄호 안은 실측 `cost / role / attackRange / primaryStyle / bestDistance / 출전 시즌`.

| # | 유닛 id | 승부수 | 실측 프로필 | 가드 | 효과 |
|---:|---|---|---|---|---|
| 1 | `kitasan_black` | **개선문의 왕도** | 4 / TANK / 1 / nige / stayer / 전 시즌 | MELEE | `LATE` 진입 시 최대 체력 **12%** 보호막, 도발 반경 1칸 **2초**. `LAST_3F` 진입 시 보호막이 남아 있으면 잔여량의 **150%**를 공격력으로 전환(최대 +60). |
| 2 | `symboli_rudolf` | **황제의 완전무결** | 5 / TANK / 1 / oikomi / middle / 전 시즌 | MELEE | 전투 중 받은 방해 효과 1종마다 방어·마저 **+6**(최대 5중첩). `LAST_3F` 진입 시 중첩당 인접 아군에게 **3초** 피해감소 **2%**. |
| 3 | `special_week` | **일본 제일의 각력** | 5 / AD_CARRY / 3 / sashi / middle / 전 시즌 | RANGED | `LATE` 진입 시 관통 **+18%** **5초**. 이 동안 처치 관여하면 `LAST_3F` 진입 시 공격력 **+15%**. |
| 4 | `daiwa_scarlet` | **무너지지 않는 선두** | 5 / AP_CARRY / 4 / nige / middle / 전 시즌 | RANGED | START 동안 받는 피해 **−12%**. START를 체력 **80% 이상**으로 통과하면 전투 종료까지 주문력 **+22%**. |
| 5 | `taiki_shuttle` | **국제선의 마일러** | 5 / AP_CARRY / 4 / senko / miler / 전 시즌 | RANGED | 스킬 시전마다 사거리 **+0**(변화 없음), 대신 다음 기본 공격 **2회**가 **2명을 관통**한다. 전투당 최대 **6회**. |
| 6 | `mihono_bourbon` | **사이보그의 랩** | 5 / AP_CARRY / 4 / nige / middle / 전 시즌 | RANGED | **정확히 4초마다** 주문력 **+7**, 방어·마저 **+4** (최대 5중첩). 피격·방해 효과와 무관하게 중단되지 않는다. |
| 7 | `oguri_cap` | **괴물의 말각** | 4 / AP_CARRY / 4 / senko / miler / 전 시즌 | RANGED | `LATE` 이후 새 대상을 공격할 때마다 그 대상에게 피해증폭 **+8%**(대상별 독립, 최대 3대상). 처치 관여 시 마나 **+15**. |
| 8 | `orfevre` | **폭주하는 황금** | 4 / AD_CARRY / 3 / sashi / middle / 전 시즌 | RANGED | 체력이 **60% 아래**로 내려간 뒤 공격속도 **+25%**, 받는 피해 **+8%**. `LAST_3F` 진입 시 받는 피해 증가가 사라진다. |
| 9 | `smart_falcon` | **모래의 선두** | 4 / AP_CARRY / 4 / nige / middle / 전 시즌 | RANGED | 피격마다 모래 **+1**(최대 8). 모래 4 이상이면 기본 공격이 대상 뒤 1칸에 **주문력의 40%** 마법 피해. 모래 8이면 관통 **+15%**. |
| 10 | `maruzensky` | **슈퍼카의 선행** | 4 / SUPPORT / 3 / nige / miler / 전 시즌 | ANY | 전투 시작 시 아군 전체 마나 **+8**. 출주마가 스킬을 쓸 때마다 가장 마나가 낮은 아군에게 마나 **+6**(재사용 대기 4초). |
| 11 | `gold_ship` | **파천황의 롱 스퍼트** | 2 / BRUISER / 1 / oikomi / stayer / 전 시즌 | MELEE | 공격·피격·시전마다 각력 **+1**(최대 10). 진행도 **0.73**에 전부 해방: 각력 1당 공격력 **+3%**, **6초**. 해방 시 **1회** 무작위가 아닌 **가장 체력이 높은 적**으로 재타겟. |
| 12 | `grass_wonder` | **불굴의 그래스** | 3 / AD_CARRY / 3 / sashi / miler / 전 시즌 | RANGED | 같은 대상에게 **3회 연속** 적중 시 **4초** 그 대상 방어력 **−12%**. 대상이 죽으면 즉시 다음 대상에게 **1중첩**으로 이월. |
| 13 | `super_creek` | **불침의 스테이어** | 3 / TANK / 1 / sashi / stayer / 전 시즌 | MELEE | **5초마다 지구력 +1**(최대 6). `LATE` 진입 시 스택당 최대 체력 **2%** 회복 + 방어·마저 **+4**. |
| 14 | `copano_rickey` | **더트의 대기록** | 3 / AD_CARRY / 3 / nige / middle / 전 시즌 | RANGED | 처치 관여마다 공격력 **+6%**, **전투 종료까지 유지**(최대 5중첩). 스택이 3 이상이면 기본 공격이 **1칸 범위 피해**로 바뀐다. |
| 15 | `hokko_tarumae` | **모래 위의 지구력** | 3 / AP_CARRY / 4 / senko / middle / 전 시즌 | RANGED | 스킬 피해의 **12%**를 회복. `LATE` 진입 시 이 수치가 **24%**가 된다. |
| 16 | `silence_suzuka` | **이차원의 도주** | 2 / AP_CARRY / **4** / nige / miler / s2–s5 | **RANGED** | START~POSITIONING 공격속도 **+28%**. 진행도 **0.30** 시점에 생존해 있으면 `독주` 상태: 전투 종료까지 주문력 **+18%**, 받는 피해 **+5%**. 후반 무한 스케일 없음. |

### 15.3.1 `silence_suzuka` 설계 주의 — 실데이터가 직관을 뒤집는 사례

사일런스 스즈카는 각질이 `nige`지만 이 게임에서는 **`AP_CARRY`이고 사거리 4의 원거리 유닛**이다.
v1.0이 제안한 "이동속도 중심 도주 승부수"를 그대로 만들면 **이동하지 않는 유닛에게 이동 버프를 주는 꼴**이다.
그래서 위 효과는 이동속도를 일절 건드리지 않고 **공격속도 + 독주 상태**로 표현했다.

**교훈(Codex는 반드시 지킬 것): 고유 승부수를 쓸 때는 캐릭터의 *역사적 이미지*가 아니라
`all-units.json`의 `role` / `attackRange` / `primaryStyle`을 먼저 읽는다.**

### 15.3.2 고유 승부수의 파워 규칙

- **역사적 위상이 높다고 수치를 올리지 않는다.** 16종의 `ItemEquivalent`(§19)는 범용 26종과 동일 밴드다.
- 고유성은 **발동 방식 / 타겟 규칙 / 시간대 / 자원 / 명칭 / VFX**에서만 만든다.
- `styleConfidence === 'LOW'`인 7명에게는 고유 승부수를 만들지 않는다.
- Phase A 16종에는 **1코 유닛이 없다.** 코스트 중립성은 가드 없는 범용 8종이 보장하며,
  §28.4의 코스트 중립 테스트로 검증한다. Phase B에서 1~2코 고유를 우선 추가한다.

### 15.3.3 Phase B 확장 (145명)

`profiles[].signatureId` / `signatureName` / `mainWin` / `gradeWins`를 읽어 **자동 생성**한다.
자동 생성은 **새 효과를 만들지 않는다.** 범용 26종 중 하나를 고르고

```text
· 이름을 signatureName 기반으로 치환
· VFX 색을 각질/마장에 맞춰 치환
· 툴팁에 "근거: {mainWin}" 한 줄 추가
```

만 한다. **툴팁의 역사 문장은 UmaRogue에 근거가 있는 필드만 쓴다.
`"일본 더비 3승"` 같은 문구를 모델이 임의로 생성하는 것을 금지한다.**

---

# 16. 출주마 수명 주기

## 16.1 승부마 변경 (기수 교체) — UI 명칭 `승부마 변경`

- 게임당 **1회, 무료**
- 마감: Stage **5-5** 준비 종료 전
- Race Plan과 진화는 **유지**
- 최종 승부수는 **이전되지 않는다.** 새 유닛에 맞춰 **기존 계열 2장 + 새 계열 1장**을 다시 제시
- 2회째는 불가. 버튼은 비활성 + 툴팁 `이미 사용했습니다`

## 16.2 별 합성 대응 (A15)

`applyCombines()`는 **아이템이 가장 많은 사본을 남기고 나머지를 소멸시킨다.**
등록한 `instanceId`가 사라질 수 있다.

```ts
// 모든 applyCombines 호출 직후에 실행한다.
export function reconcileEntryUnit(player: PlayerState): void {
  const rp = player.racePlan;
  if (!rp.entryUnitDefId) return;
  const all = [...player.board, ...player.bench];
  if (all.some(u => u.instanceId === rp.entryUnitInstanceId)) return;   // 그대로 살아있음

  // instanceId가 사라졌다 → 같은 unitDefId 중 별이 가장 높은 사본으로 승계
  const heir = all
    .filter(u => u.unitDefId === rp.entryUnitDefId)
    .sort((a, b) => b.star - a.star || b.items.length - a.items.length)[0];
  rp.entryUnitInstanceId = heir?.instanceId;            // 없으면 undefined
  rp.entryDetachedAt = heir ? undefined : currentRoundKey(player);
}
```

**1차 키는 `entryUnitDefId`다. `entryUnitInstanceId`는 캐시일 뿐이다.**
3성이 되어도 출주마 자격과 승부수는 그대로 유지된다.

## 16.3 판매 — TFT 이상현상 규칙 차용 (B7)

```text
· 출주마를 판매하면 즉시 등록이 해제된다 (효과 비활성).
· 같은 unitDefId를 다시 보유하게 되면 자동으로 재등록되고 승부수도 그대로 돌아온다.
· 자동 재등록은 매치당 1회만. 두 번째로 팔면 영구 해제된다.
· 영구 해제 후에도 '승부마 변경' 1회가 남아 있으면 그것으로 새 유닛을 지정할 수 있다.
```

UI: 등록된 유닛의 판매 버튼에 확인 문구를 띄운다.

```text
GⅠ 출주마를 판매합니다.
다시 영입하면 1회에 한해 자동으로 재등록됩니다.
[판매] [취소]
```

## 16.4 벤치 / 미출전 (B8)

- 출주마가 **벤치에 있으면 Race Plan 효과는 전부 비활성**이다. 벤치는 출주하지 않았다.
- 준비 단계 상단에 경고를 띄운다:
  `GⅠ 출주마가 대기석에 있습니다 — 이번 라운드는 작전이 적용되지 않습니다` (`--race-red`)
- 출주마가 전투 중 사망하면 해당 시점 이후 스택 축적만 멈춘다. 이미 적용된 팀 버프는 지속시간까지 유지된다.

## 16.5 상태 구조

```ts
export interface RacePlanState {
  offerPhase: 'NONE' | 'PLAN' | 'EVOLUTION' | 'ENTRY' | 'FINISHING' | 'COMPLETE';
  planId?: string;
  evolutionId?: string;

  entryUnitDefId?: string;        // ★ 1차 키
  entryUnitInstanceId?: string;   // 캐시
  entryDetachedAt?: string;       // '5-1' 등, 판매/소멸 라운드
  entryRestoreUsed: boolean;      // 자동 재등록 1회 소모 여부
  finishingMoveId?: string;

  entryDeferred: boolean;
  transferUsed: boolean;

  currentOffer?: RacePlanOffer;
  offerHistory: string[];
  recentCombat: RecentCombatProfile;
}

export interface RacePlanOffer {
  phase: 'PLAN' | 'EVOLUTION' | 'FINISHING';
  options: string[];              // 정확히 3
  slots: Array<'A' | 'B' | 'C'>;  // options와 같은 길이
  reasons: OfferReasonPayload[][];// options와 같은 길이, 각 3~4개
  rerolled: boolean[];            // [false,false,false]
  seen: string[];
  chosen: string | null;
}
```

`PlayerState`에 `racePlan: RacePlanState`, `MatchState`에 `racePlanTrack: TrackState`, `g1ThemeId: string`.

---

# 17. 전투 런타임

## 17.1 신규 트리거는 **2종만** (A12)

기존 `TriggerDef.when`에 이미 있는 것들:
`ALWAYS` `COMBAT_START` `ON_ATTACK` `ON_SAME_TARGET_NTH_ATTACK` `ON_BASIC_HIT_TAKEN`
`ON_SKILL_HIT` `ON_CC_APPLIED` `ON_SUPPORT_SKILL` `ON_NTH_ATTACK` `ON_HIT_TAKEN`
`ON_CAST` `ON_KILL` `ON_TAKEDOWN_ASSIST` `HP_BELOW` `HP_ABOVE` `TARGET_HP_BELOW`
`AFTER_SECONDS` `EVERY_SECONDS` `ON_DEATH` `ADJACENT_ALLIES_AT_LEAST`
`NO_ADJACENT_ALLIES` `IN_FRONT_ROWS` `IN_BACK_ROWS`

### 17.1.1 추가 1 — `ON_RACE_PHASE`

```ts
export type TriggerDef = {
  when: /* 기존 전부 */ | 'ON_RACE_PHASE' | 'ON_TARGET_CHANGED';
  threshold?: number;
  /** ON_RACE_PHASE 전용 */
  phase?: RaceCombatPhase;
  /** ON_RACE_PHASE 보조 조건 — 전이 순간의 자기 체력 비율 */
  hpBelow?: number;
  hpAbove?: number;
};
```

### 17.1.2 추가 2 — `ON_TARGET_CHANGED`

`CombatUnit.targetId`가 바뀌는 지점에서 `fireFor(unit, 'TARGET_CHANGED', newTarget)`.
`RP_TRACK_TURF`, `FM_TURF_STRIDE`, `EV_PASS_ARMOR`, `FM_GAP_SHOT`가 쓴다.

### 17.1.3 구간 한정 효과의 해제

`tag: "RACE_PHASE_UNTIL:<PHASE>"`가 붙은 스탯 모디파이어는 그 페이즈 진입 시 제거한다.

```ts
// onRacePhaseChanged 안에서
unit.modifiers = unit.modifiers.filter(m => m.key !== `RACE_PLAN_UNTIL:${phase}`);
```

`addModifier(..., refreshKey)`가 이미 key 기반 제거를 지원하므로 **엔진 수정은 이 한 줄이다.**

## 17.2 효과 소스 키와 중첩 규칙

```ts
sourceKey = `race-plan:${nodeId}`      // 예: 'race-plan:FM_LAST_3F'
refreshKey = `${unit.id}:race-plan:${nodeId}:${effectIndex}`
```

| 규칙 | 내용 |
|---|---|
| 같은 노드의 같은 효과 | **갱신**(refresh), 중첩 아님 |
| 다른 노드(플랜/진화/승부수) | 각각 별도 소스, 합산 |
| 공격속도 | `ATTACK_SPEED_CAP = 5.0` 존중. 캡 초과분은 버린다 |
| 관통 | 노드 합산 **최대 40%** 로 클램프 |
| 피해감소 | **곱연산** 누적 (`1-(1-a)(1-b)`) |
| 무적 | **금지.** `DAMAGE_REDUCTION`으로 대체 |
| `SURVIVE_LETHAL` (1HP 생존) | Race Plan 전체에서 **전투당 1회**. 이미 발동했으면 다른 노드의 동종 효과는 무시 |
| 재타겟 | 경로 교착 방지 — 재타겟 대상이 도달 불가면 원래 대상 유지 |

## 17.3 신규 `BattleEvent` 2종 (A14)

```ts
| { t: number; type: 'RACE_PHASE'; phase: RaceCombatPhase; progress: number }
| { t: number; type: 'RACE_PROC'; unit: string; nodeId: string; label: string; stacks?: number }
```

`BattleFrame.events`에 실리므로 **재생·관전·리플레이·recap이 전부 자동으로 따라온다.**
별도 로깅 경로를 만들지 않는다.

## 17.4 전투 recap 출력 (C8)

`BattleRecap.tsx`에 `레이스 플랜` 탭을 추가한다. `RACE_PHASE`/`RACE_PROC` 이벤트만 시간순으로 나열한다.

```text
레이스 플랜 · 롱 스퍼트 → 각력 온존
승부마  키타산 블랙 ★★

 0.0s  게이트 오픈
 6.4s  도중 (POSITIONING)
17.2s  승부처 (LATE)            각력 5 축적 완료
17.2s  각력 온존 발동            공격속도 +18%
22.8s  라스트 3F                 진행도 0.86
22.8s  불침함의 스테이어 발동     지구력 6 → 방어·마저 +24
26.1s  전투 종료 · 승리
```

`진행도`를 함께 보여준다. **플레이어가 "왜 25초가 아닌데 라스트3F가 떴는지"를 배울 수 있어야 한다.**

---

# 18. 전용 자원

전용 자원은 **각력**과 **지구력** 둘뿐이다. 노드마다 새 자원을 만들지 않는다.

## 18.1 각력 (Leg Power)

| 항목 | 값 |
|---|---|
| 최대 | **10** |
| 축적 | 노드별 규정 (2초마다 1 / 공격 시 1 / 시전 시 2 등) |
| 소모 | `LAST_3F` 또는 지정 진행도에서 **전량 소모** |
| 전투 간 유지 | **없음.** 매 전투 0에서 시작 |
| 내부 표현 | `CombatUnit.racePlanLegPower: number` |

## 18.2 지구력 (Stamina)

| 항목 | 값 |
|---|---|
| 최대 | **6** |
| 축적 | 5초마다 1 |
| 소모 | 없음 — 스택 자체가 보너스 |
| 전투 간 유지 | **없음** |
| 내부 표현 | `CombatUnit.racePlanStamina: number` |

## 18.3 게이지 렌더 — Phaser `BattleScene` (B9)

React가 아니라 **Phaser 씬에 그린다.** 체력바/마나바를 그리는 같은 컨테이너에 붙인다.

| 항목 | 값 |
|---|---|
| 위치 | 유닛 체력바 **아래 6px**, 마나바가 있으면 그 아래 4px |
| 크기 | 폭 **44px** × 높이 **3px** (체력바 폭과 동일 정렬) |
| 칸 수 | 각력 = **10칸**(각 폭 3.8px, 간격 0.6px) / 지구력 = **6칸**(각 폭 6.6px, 간격 0.6px) |
| 빈 칸 색 | `#202521` 알파 0.55 |
| 각력 채움 | `#a98b4b` (브라스). 만렙(10)이면 `#e8c86a`로 0.6초 주기 펄스 |
| 지구력 채움 | `#3f785d` (딥그린). 만렙(6)이면 `#6fc49a` |
| 표시 조건 | **출주마이고 해당 자원을 쓰는 노드를 가진 경우에만.** 그 외에는 렌더 자체를 생략 |
| 관전 | 상대 출주마에게도 동일하게 보인다 |
| 성능 | `Graphics`를 유닛당 1개 재사용. 값이 바뀐 틱에만 `clear()+redraw` |

---

# 19. 밸런스 예산 (B11 — 측정 가능한 정의)

## 19.1 `ItemEquivalent (IE)` 정의

완성 아이템 1개 = **1.00 IE**. 실제 아이템 정의에서 역산한 환산표:

| 스탯/효과 | 1.00 IE에 해당하는 양 |
|---|---|
| 공격력 % | **+20%** |
| 주문력 (플랫) | **+40** |
| 공격속도 % | **+30%** |
| 피해증폭 % | **+15%** |
| 방어력 또는 마저 (플랫) | **+45** |
| 최대 체력 (플랫) | **+250** |
| 모든 피해 흡혈 % | **+18%** |
| 방어·마저 관통 % | **+22%** |
| 치명타 확률 % | **+30%** |
| 마나 (플랫, 전투당 총량) | **+60** |
| 피해감소 % | **+12%** |
| 회복 (최대 체력 %, 전투당 총량) | **+22%** |

**조건부 보정 계수** (지속시간·발동 조건을 IE에 반영):

```text
IE_effective = IE_raw × 가용시간계수 × 조건계수

가용시간계수 = (효과가 유효한 진행도 구간 길이)
  전 구간 상시            1.00
  POSITIONING 이후        0.80
  LATE 이후               0.40
  LAST_3F 이후            0.20
  START만                 0.18

조건계수
  무조건                  1.00
  스택 최대치 도달 필요     0.70
  처치 관여 필요           0.65
  저체력(35% 이하) 필요    0.55
  전투당 1회               0.50
```

## 19.2 단계별 예산

| 누적 시점 | 목표 IE | 허용 |
|---|---:|---|
| Stage 2 플랜만 | **0.30** | 0.25 – 0.35 |
| + Stage 3 진화 | **0.65** | 0.55 – 0.75 |
| + 최종 승부수 | **1.40** | 1.25 – 1.55 |

**전 노드가 이 밴드 안에 있어야 한다.** 검증은 사람이 아니라 스크립트가 한다.

```text
npm run audit:race-plan
→ scripts/audit-race-plan.ts
   · 모든 plan/evolution/finishing의 IE_effective 계산
   · 밴드 이탈 노드를 표로 출력
   · 이탈이 1개라도 있으면 exit 1
```

이 스크립트를 `npm run verify` 체인에 넣는다 (`data:validate` 뒤).

## 19.3 파워 배분 우선순위

단순 스탯에 예산을 다 쓰지 않는다. 위에서부터 채운다.

```text
1. 시간대(페이즈)      — 언제 강해지는가
2. 타겟 규칙            — 누구를 때리는가
3. 조건부 분기          — 어떤 상황에서
4. 전용 자원            — 무엇을 모으는가
5. 위치/페이스          — 어디에 서는가
6. 스탯                 — 마지막
```

**`FM_XXX = 공격력 +40%` 같은 순수 스탯 노드는 단 하나도 만들지 않는다.**

## 19.4 라스트3F 계열의 공격속도 제한 (A16 재확인)

`LAST_3F` 또는 `LATE` 계열 노드가 **공격속도만으로** 예산의 50%를 넘게 쓰면 감사 스크립트가 실패시킨다.
오버타임에서 `ATTACK_SPEED_CAP=5.0`에 막혀 실제 가치가 사라지기 때문이다.

```ts
if (node.fit.phases.includes('LAST_3F') && asShare(node) > 0.5) {
  fail(`${node.id}: LAST_3F 계열의 공격속도 비중 ${pct}% — 오버타임 캡으로 가치가 소실됩니다.`);
}
```

## 19.5 코스트 중립 목표

동일 아이템 가치·유사 팀파워 조건에서, Race Plan이 더한 전투 가치가
**1코3성 / 2코3성 / 3코3성 / 4코2성 / 5코2성 사이에서 ±10% 이내**여야 한다 (§28.4).

---

# 20. 멀티플레이 / 서버 (A4–A7)

## 20.1 `MatchPhase` 확장

```ts
export type MatchPhase =
  | 'BOOT' | 'LOBBY' | 'ROUND_PREP' | 'AUGMENT_SELECT'
  | 'RACE_PLAN_SELECT'      // 신규 — 출주 계획 / 전개 수정
  | 'RACE_ENTRY_SELECT'     // 신규 — GⅠ 출주 등록 + 최종 승부수
  | 'DRAFT' | 'BATTLE' | 'ROUND_RESOLVE' | 'ELIMINATION' | 'GAME_OVER';
```

`RoundDirector.advance()`에서 증강과 동일한 위치에 삽입한다.

```ts
if (racePlanOpensNow(s)) {
  openRacePlanOffers(s, this.rngs.get('race-plan'));
  s.phase = racePlanKind(s) === 'ENTRY' ? 'RACE_ENTRY_SELECT' : 'RACE_PLAN_SELECT';
  this.resolveAiRacePlans();          // §21
}
```

**증강 블록보다 뒤, 드래프트 블록보다 앞에 둔다.** (같은 라운드에 둘이 겹치는 경우는 없지만 순서를 고정한다.)

## 20.2 온라인 명령 — `action` 6종 추가

`src/game/network/protocol.ts`의 `commandSchema`에 추가한다. **신규 메시지 타입은 만들지 않는다.**

```ts
z.object({ action: z.literal('racePlan'),        id }).strict(),
z.object({ action: z.literal('racePlanReroll'),  slot: z.number().int().min(0).max(2) }).strict(),
z.object({ action: z.literal('raceEntry'),       unit: id }).strict(),
z.object({ action: z.literal('raceEntryDefer') }).strict(),
z.object({ action: z.literal('finishingMove'),   id }).strict(),
z.object({ action: z.literal('raceTransfer'),    unit: id }).strict(),
```

`src/game/network/commands.ts`의 `applyOnlineCommand` 상단(증강 분기 옆)에 배치한다.
**`['ROUND_PREP','BATTLE'].includes(state.phase)` 검사보다 위**여야 한다. 선택 단계는 그 두 phase가 아니다.

```ts
if (command.action === 'racePlan')
  return director.chooseRacePlan(playerId, command.id) ? null : '선택할 수 없는 작전입니다.';
if (command.action === 'racePlanReroll')
  return director.rerollRacePlan(playerId, command.slot) ? null : '이 작전은 더 이상 새로고침할 수 없습니다.';
if (command.action === 'raceEntry')
  return director.chooseRaceEntry(playerId, command.unit) ? null : '지금 출주 등록할 수 없는 기물입니다.';
if (command.action === 'raceEntryDefer')
  return director.deferRaceEntry(playerId) ? null : '지금은 보류할 수 없습니다.';
if (command.action === 'finishingMove')
  return director.chooseFinishingMove(playerId, command.id) ? null : '선택할 수 없는 승부수입니다.';
if (command.action === 'raceTransfer')
  return director.transferRaceEntry(playerId, command.unit) ? null : '승부마 변경을 사용할 수 없습니다.';
```

클라이언트 `gameStore`는 증강과 같은 패턴을 쓴다.

```ts
chooseRacePlan: (id) => {
  if (get().onlinePlayerId) { onlineBridge.send?.({ action: 'racePlan', id }); return; }
  const { director, player } = ...;
  director.chooseRacePlan(player.id, id);
  saveToStorage(director); playSound('race-plan-select'); bump(set);
},
```

## 20.3 정보 은닉 — `privateMatch()` 필수 수정 (A5)

**수정하지 않으면 상대의 오퍼 후보와 추천 근거가 전부 새어 나간다.**

```ts
export function privateMatch(state: MatchState, playerId: string): MatchState {
  return {
    ...state, seed: 0, rngStates: {}, pool: { seasonId: state.seasonId, remaining: {} },
    players: state.players.map((p) => p.id === playerId ? { ...p, isHuman: true } : {
      ...p, isHuman: false, shop: [], bench: [], items: [], pendingGrants: [],
      freeRerolls: 0, cheapRerollsUsed: 0, aiProfile: null, aiPlan: undefined,
      // ▼ 신규: 스카우팅에 필요한 공개 정보만 남긴다
      racePlan: publicRacePlan(p.racePlan),
    }),
    augmentOffers: state.augmentOffers.filter((o) => o.playerId === playerId),
  };
}

/** 스카우팅에 보이는 것과 보이지 않는 것. */
function publicRacePlan(rp: RacePlanState): RacePlanState {
  return {
    offerPhase: rp.offerPhase === 'COMPLETE' ? 'COMPLETE' : 'NONE',
    planId: rp.planId,                    // 공개 — 어떤 전개인지
    evolutionId: rp.evolutionId,          // 공개
    entryUnitDefId: rp.entryUnitDefId,    // 공개 — 누가 승부마인지
    entryUnitInstanceId: undefined,       // 비공개
    finishingMoveId: rp.finishingMoveId,  // 공개 — 무슨 승부수인지
    entryDeferred: false,                 // 비공개 (보류 여부는 심리전 정보)
    transferUsed: false,                  // 비공개
    entryRestoreUsed: false,              // 비공개
    currentOffer: undefined,              // ★ 절대 비공개
    offerHistory: [],                     // ★ 절대 비공개
    recentCombat: EMPTY_COMBAT_PROFILE,   // ★ 절대 비공개
  };
}
```

**주의:** `privateMatch`가 상대의 `bench`를 비우므로, 상대 출주마가 벤치에 있으면 스카우트 화면에
포트레이트가 없다. 이 경우 `entryUnitDefId`로 `getUnitDef`를 조회해 이름·초상만 표시하고
`대기석` 배지를 붙인다.

## 20.4 서버 타이머 — `setDeadline()` 필수 수정 (A6, A7)

현재 코드는 이렇다.

```ts
const cursor = d.state.draft?.carousel ? 'carousel' : d.state.draft?.cursor ?? '-';
const key = `${d.state.stage}-${d.state.round}:${d.state.phase}:${cursor}`;
if (room.phaseKey === key) return;
...
const seconds = d.state.draft?.carousel ? 45 : d.state.draft ? 12
  : d.state.augmentOffers.length ? 30                    // ← PREP_SECONDS.AUGMENT(45)와 불일치
  : roundInfo(d.state.stage, d.state.round).prepSeconds;
```

**수정 2가지.**

```ts
// 1) phaseKey에 Race Plan 하위 단계를 포함시킨다.
//    포함하지 않으면 '출주 등록 → 승부수'로 넘어갈 때 phase 문자열이 그대로라
//    deadline이 갱신되지 않고 플레이어가 시간을 잃는다.
const rpKey = d.state.players.find(p => p.id === room.hostId)?.racePlan.offerPhase ?? '-';
const key = `${d.state.stage}-${d.state.round}:${d.state.phase}:${cursor}:${rpKey}`;

// 2) 초 계산에 Race Plan 분기를 추가한다.
const seconds =
  d.state.draft?.carousel ? 45
  : d.state.draft ? 12
  : d.state.phase === 'RACE_ENTRY_SELECT'
      ? (anyPlayerAwaitingFinishing(d.state) ? RACE_PLAN_SECONDS.FINISHING : RACE_PLAN_SECONDS.ENTRY)
  : d.state.phase === 'RACE_PLAN_SELECT' ? RACE_PLAN_SECONDS.PLAN
  : d.state.augmentOffers.length ? PREP_SECONDS.AUGMENT   // ← 기존 30 하드코딩 동시 수정
  : roundInfo(d.state.stage, d.state.round).prepSeconds;
```

> **`phaseKey`에 `offerPhase`를 넣을 때 주의:** 8명의 `offerPhase`가 제각각이면 키가 계속 바뀐다.
> 방 전체 기준으로 **"아직 선택하지 않은 플레이어가 있는 최소 단계"** 하나를 계산해서 쓴다.
> 구현: `minPendingRacePlanPhase(state): 'PLAN'|'ENTRY'|'FINISHING'|'-'`.

## 20.5 타임아웃 자동 진행 — `tick()`

증강 블록 바로 위에 추가한다.

```ts
if (d.state.phase === 'RACE_PLAN_SELECT' || d.state.phase === 'RACE_ENTRY_SELECT') {
  d.autoResolveRacePlans();     // 추천 1위로 자동 선택 (options[0]이 아니다)
  this.setDeadline(room); this.broadcastState(room); continue;
}
```

**증강은 `options[0]`을 집지만 Race Plan은 반드시 추천 1위를 집는다.**
오퍼 배열은 슬롯 A/B/C 순서이지 점수 순서가 아니기 때문이다.

## 20.6 재접속

`ServerMessage.state`가 `MatchState`를 통째로 보내므로 **추가 작업이 거의 없다.** 확인할 것만:

| 복원 항목 | 확인 |
|---|---|
| planId / evolutionId / entryUnitDefId / finishingMoveId | `PlayerState.racePlan`에 있음 ✓ |
| currentOffer (본인 것) | `privateMatch`가 본인은 그대로 통과 ✓ |
| rerolled / seen | `currentOffer` 안 ✓ |
| g1ThemeId / racePlanTrack | `MatchState` 최상위 ✓ |
| 선택 오버레이 재표시 | `phase`와 `currentOffer.chosen === null`로 판정 ✓ |
| 남은 시간 | 서버 `deadline` 사용. 클라 타이머 신뢰 금지 ✓ |

`RoomService.restore()`의 `shift` 보정(다운타임만큼 deadline 이동)이 그대로 적용된다.

## 20.7 GⅠ 테마 결정

```ts
// 매치 생성 시 1회. 로비 전원 공통.
state.g1ThemeId = Rng.forStream(state.seed, 'g1-theme').pick(G1_THEME_IDS);
```

**플레이어별로 다른 테마를 뽑지 않는다.** "같은 대회에 출주한다"는 감각이 이 시스템의 핵심 판타지다.

---

# 21. AI (A18)

## 21.1 구조

`resolveAiAugments()`를 그대로 베낀다. 새 구조를 만들지 않는다.

```ts
private resolveAiRacePlans(): void {
  const rng = this.rngs.get('race-plan');
  for (const p of this.state.players) {
    if (!isAlive(p) || p.aiProfile === null) continue;
    const offer = p.racePlan.currentOffer;
    if (!offer || offer.chosen !== null) continue;
    const scouts = publicBoards(this.state, p);

    // 1) 리롤: 최고점 후보보다 낮은 슬롯을 정당하게 교체한다 (증강과 동일 규칙)
    const keep = chooseAiRacePlan(p, offer, this.state, scouts);
    for (let slot = 0; slot < offer.options.length; slot++) {
      if (offer.options[slot] !== keep
        && racePlanScore(p, offer.options[slot], this.state, scouts)
           <= racePlanScore(p, keep, this.state, scouts)) {
        rerollRacePlanOffer(this.state, p, slot, rng);
      }
    }
    // 2) 선택
    offer.chosen = chooseAiRacePlan(p, offer, this.state, scouts);
    applyRacePlanChoice(this.state, p, offer.chosen);
  }
  this.syncRng();
}
```

## 21.2 난이도별 성향

`AiProfileId`는 `'BALANCED'|'REROLL'|'FAST_LEVEL'|'ECONOMY'|'AD_FOCUS'|'AP_FOCUS'|'TRAIT_FOCUS'` 7종이다.
**별도 난이도 등급을 새로 만들지 않는다.** 기존 프로필에 편향만 더한다.

| 프로필 | Race Plan 편향 |
|---|---|
| `REROLL` | 저코 3성 캐리 전제 → `SLOW_PACE`/`GUTS`/`LAST_3F` ×1.12 |
| `FAST_LEVEL` | 고코 전환 전제 → 비귀속·`MIDDLE_PACE` ×1.12 |
| `ECONOMY` | 후반 승부 → `LAST_3F`/`PASSING` ×1.10 |
| `AD_FOCUS` | `TEMPO`/`FRONTRUN` ×1.12 |
| `AP_FOCUS` | `SPELL`/`BURST` ×1.12 |
| `TRAIT_FOCUS` | 각질/거리 특성 티어가 높은 계열 ×1.15 |
| `BALANCED` | 편향 없음 |

선택식:

```ts
chosen = argmax( racePlanScore(...) × profileBias × (1 + seededJitter(-0.08, +0.08)) )
```

## 21.3 AI의 GⅠ 출주 등록

- `EntryFit` 1위를 고른다.
- 단, **다음 라운드에 3성 완성이 임박한 유닛**(같은 unitDefId 사본 합계 ≥ 7)이 있으면 `EntryFit`에 **+0.08** 보정.
  실제 플레이어도 그렇게 판단한다.
- 승부마 변경: 새 후보의 `EntryFit`가 현재보다 **18% 이상** 높을 때만 사용.
  `FAST_LEVEL`/`ECONOMY` 프로필만 적극적으로 쓴다.

## 21.4 AI 결정론

AI 선택도 반드시 `this.rngs.get('race-plan')` 위에서만 굴린다.
`tests/race-plan-determinism.test.ts`가 **AI 8인 로비를 2회 시뮬레이션해 완전 동일**을 검증한다.

---

# 22. 세이브 / 마이그레이션 (A10)

## 22.1 전략 — 버전을 올리지 않는다

```ts
// state.ts
export type PlayerState = {
  ...
  /** 신규 시스템. 구버전 세이브에는 없다. */
  racePlan?: RacePlanState;
};
export type MatchState = {
  ...
  version: 1;                   // ★ 유지
  g1ThemeId?: string;
  racePlanTrack?: TrackState;
};
```

- `GAME_VERSION`과 `SAVE_KEY`를 **바꾸지 않는다.** 바꾸면 진행 중인 세이브가 전부 날아간다.
- `ROSTER_HASH`에 race-plan 데이터를 **넣지 않는다**(§2.5). 넣으면 `ROSTER_MISMATCH`로 같은 결과가 된다.

## 22.2 로드 시 백필

```ts
// RoundDirector 생성자 / restoreDirector 경로
for (const p of state.players) {
  p.racePlan ??= createDefaultRacePlanState();
}
state.g1ThemeId ??= Rng.forStream(state.seed, 'g1-theme').pick(G1_THEME_IDS);
state.racePlanTrack ??= 'STANDARD';
```

구버전 세이브를 Stage 3에서 이어받으면 **Stage 2-5 오퍼는 이미 지나갔다.**
이 경우 `planId`는 비어 있고 Stage 3-5에서 **기본 플랜 + 진화를 한 화면에서 2단계로** 받는다.
(`offerPhase: 'PLAN'` → 선택 즉시 `'EVOLUTION'`. 시간은 45 + 45초.)

## 22.3 서버 방 체크포인트

`RoomSnapshot.version`은 1로 유지하고 `rosterHash` 검사도 그대로 둔다.
`restore()`는 `MatchState`를 통째로 복원하므로 **추가 코드가 필요 없다.**
단 복원 직후 §22.2의 백필을 한 번 돌린다.

---

# 23. UI — 픽셀 단위 명세

## 23.1 시각 언어

**현대 일본 경마 중계 그래픽 + 출마표 + 패독 정보판.**

절대 금지:

| 금지 | 이유 |
|---|---|
| TFT 증강체 카드 3장 배치 그대로 복제 | 정체성 충돌 |
| hextech 프레임 / 네온 보라 | 같은 이유 |
| `SSR` `Silver/Gold/Prismatic` 등 등급 표기 | Race Plan에는 등급이 없다 |
| 캐릭터 일러스트가 카드의 60% 이상 차지 | 이 컨텐츠는 캐릭터가 아니라 **작전**이다 |
| 별·하트·리본 장식 | 경마 방송 톤 파괴 |
| 실존 JRA 로고·마크·서체 복제 | 저작권 |

## 23.2 CSS 토큰 — `src/styles/race-plan.css` 신규

```css
:root {
  --race-ivory:      #f3f0e5;   /* 종이 바탕 */
  --race-paper:      #e9e3d3;   /* 한 단계 어두운 지면 */
  --race-line:       #b9b29f;   /* 1px 괘선 */
  --race-green-900:  #10271f;   /* 헤더 딥그린 */
  --race-green-700:  #1e4938;
  --race-green-500:  #3f785d;   /* 잔디 / 긍정 */
  --race-charcoal:   #202521;   /* 본문 텍스트 */
  --race-brass:      #a98b4b;   /* 추천 ◎ / 각력 */
  --race-brass-hi:   #e8c86a;
  --race-red:        #a53c31;   /* 경고 / 승부처 */
  --race-blue:       #3d6679;   /* 데이터 / 분석 */
  --race-dirt:       #765844;   /* 더트 */
  --race-dim:        rgba(6, 12, 10, .68);
}
```

기존 테마와 충돌하지 않도록 **`--race-` 접두사를 반드시 유지한다.**

## 23.3 Stage 2 / Stage 3 오버레이 — `RacePlanOverlay.tsx`

**Desktop 1920×1080 기준**

```text
┌ 전체 오버레이 ─────────────────────────────────────────────┐
│  background: var(--race-dim)                                │
│  backdrop-filter: blur(5px)                                 │
│                                                             │
│   ┌ 중앙 패널  1460 × 최대 900 ────────────────────────┐   │
│   │ radius 18 / bg var(--race-ivory) / 1px var(--race-line)│
│   │ box-shadow 0 24px 60px rgba(0,0,0,.45)              │   │
│   │                                                      │   │
│   │ ┌ 헤더 1460×120 ─ bg var(--race-green-900) ───────┐ │   │
│   │ │ L: "RACE PLAN" 13px letter-spacing .22em brass  │ │   │
│   │ │    "출주 계획"   32px 700 ivory                  │ │   │
│   │ │    "Stage 2-5"  13px  var(--race-line)          │ │   │
│   │ │ R: 레벨 / 골드 / 체력 / 최근 3전 평균 / 전개 아이콘│ │   │
│   │ │    각 항목 폭 96px, 값 20px 600, 라벨 11px       │ │   │
│   │ └──────────────────────────────────────────────────┘ │   │
│   │                                                      │   │
│   │  카드 3장  410×540  gap 32  상단 여백 36             │   │
│   │  좌우 패딩 (1460 - 410*3 - 32*2) / 2 = 83            │   │
│   │                                                      │   │
│   │  하단 56 : 남은 시간 바 (서버 deadline 기준)          │   │
│   └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 카드 내부 410×540

| y | 높이 | 내용 |
|---:|---:|---|
| 0 | **52** | 카테고리 띠 — 좌측 24×24 계열 아이콘 + 카테고리명 12px 700, 배경은 카테고리 색 8% 틴트 |
| 52 | **8** | 구분선 1px `--race-line` + 여백 |
| 60 | **44** | **플랜 이름** 24px 700 `--race-charcoal` |
| 104 | **40** | 경마식 한 줄 설명 14px `--race-green-700` |
| 144 | **12** | 여백 |
| 156 | **124** | **정확한 게임 효과** — 최대 3줄, 14px, 수치는 `600` + `--race-blue` |
| 280 | **16** | 구분선 |
| 296 | **116** | **추천 근거** 3~4줄 — `◎ ○ △` 마크 14px + 문장 13px |
| 412 | **12** | 여백 |
| 424 | **56** | **호응 태그** — 최대 4개 pill, 높이 24, radius 12, 11px |
| 480 | **60** | 하단 버튼 영역 |

하단 버튼:

```text
[ 이 작전으로 출주 ]   폭 260 × 높이 44, radius 8
                       bg var(--race-green-700), 글자 ivory 15px 600
[ ⟳ 새로고침 · 1회 ]   폭 130 × 높이 44, 외곽선만
                       사용 후 → 비활성 + "새로고침 사용 완료"
```

### 추천 근거 예시 (실제 렌더 결과)

```text
현재 보드와의 호응
 ◎  공격속도 계열 장비 3개와 호응합니다.
 ○  선두형 기물 2명과 호응합니다.
 ○  최근 3전 평균 14.8초 — 승부가 일찍 납니다.
 △  승부처에서 상대 전열이 아직 두껍습니다.
```

**추천 근거를 접거나 숨기지 않는다.** 이 시스템이 "개인화되어 있다"는 것을 증명하는 유일한 화면이다.

### 23.3.1 전개 예상 미니 그래프 (헤더 우측, 폭 200×높이 72)

선택한 플랜의 **힘 분포**를 보여준다. 승률이 아니다.

```text
전개 지수
템     ████████        12
도중   █████           10
승부처 ███████         13
3F     █████████       16
```

- 막대 높이 8px, 간격 4px, 색 `--race-green-500`, 최대치 막대만 `--race-brass`
- 라벨 `전개 지수` 11px `--race-line`
- 툴팁: `실제 속도가 아니라 이 작전의 힘이 어디에 실리는지를 나타냅니다.`

## 23.4 Stage 3 분기 연출 — `RaceEvolutionOverlay.tsx`

좌측 **300px** 고정 요약 카드 + 우측 분기표.

```text
┌ 현재 계획 300×540 ┐   ┌ 분기 3장 ────────────────────────┐
│ 슬로 페이스        │   │                                   │
│ 힘 비축            │───┼── 각력 온존      (STACK)          │
│                    │   ├── 롱 스퍼트      (MORE_LATE)      │
│ 효과 3줄           │   └── 근성 승부      (SURVIVAL)       │
│ 전개 지수 그래프   │   각 카드 380×164, gap 20             │
└────────────────────┘   └───────────────────────────────────┘
```

- 연결선: SVG `path`, 1.5px, `--race-line`. 호버 시 해당 선만 `--race-brass`로 **240ms** 전환
- 선택 시: 도장(stamp) 애니메이션 — `scale(1.6) → 1.0` + `opacity 0 → 1`, **300ms**, `cubic-bezier(.2,.8,.2,1)`
- 도장 문구 `작전 확정`, 회전 −8deg, 색 `--race-red`, 외곽선 2px
- **캐릭터 컷인 금지.** 이 화면에 초상화는 없다

## 23.5 Stage 4 GⅠ 출주 등록 — `G1EntryOverlay.tsx`

가장 중요한 화면. 패널 **1620×920**.

### 헤더 1620×132 — 출마표 스타일

```text
┌───────────────────────────────────────────────────────────┐
│ [GⅠ]  日本ダービー / 일본 더비                             │
│  ↑ 원형 badge 44px, bg --race-red, 글자 ivory 15px 700     │
│       이름 28px 700 ivory  /  한국어 15px --race-line       │
│                                                            │
│  TOKYO  2400m  TURF  LEFT        현재 작전: 슬로 페이스 → 롱 스퍼트 │
│  ↑ 11px letter-spacing .16em, 항목 사이 "·" 구분            │
└───────────────────────────────────────────────────────────┘
```

**GⅠ 표시는 실존 로고를 복제하지 않는다. 단순 타이포 + 원형 badge다.**

### 본문 좌 60% (972px) — 후보 그리드

카드 **216×132**, 4열, gap 16.

| 위치 | 내용 |
|---|---|
| 좌상 | 초상화 **72×72**, radius 6 |
| 우상 | 이름 14px 600 (2줄까지) |
| 우상 2행 | `★★` 12px `--race-brass` + 코스트 원형 badge 18px |
| 우상 3행 | Role 11px `--race-line` |
| 좌하 | 아이템 아이콘 **3 × 22px**, 빈 슬롯은 점선 |
| 우하 | 적성 미니 바 4개 (각질/거리/마장/코스), 폭 40 × 높이 3, gap 2 |
| 우상 코너 | 추천 마크 `◎ ○ ▲` **20px**, 배경 없이 글자만 |
| 카드 테두리 | 기본 1px `--race-line` / 선택 2px `--race-brass` + 안쪽 그림자 |
| 벤치 유닛 | 좌상 코너에 `대기석` 태그 10px, 카드 전체 opacity .82 |

### 본문 우 40% (648px) — 상세 패널

```text
키타산 블랙                        ★★★
출주 적합도  87
─────────────────────────────────
전개 적합
  롱 스퍼트          ◎
  장기전             ◎
  현재 장비          ○
  실제 각질(도주 S)  ○
  GⅠ 코스 적성      △
─────────────────────────────────
예상 발동
  도중 종료   각력 5 축적
  승부처      롱 스퍼트 시작
  라스트 3F   지구력 6 → 방어·마저 +24
─────────────────────────────────
경주 적성
  각질  도주 S   거리  장거리 A
  마장  잔디 A   코스  나카야마 GOOD
```

- `출주 적합도`는 **0~100 정수**로 보여준다. `EntryFit × 100` 반올림. 내부 소수는 노출하지 않는다
- `예상 발동`은 **현재 플랜 + 진화**만으로 계산한다 (승부수는 아직 안 골랐다)
- 적성 4줄은 등급 문자 그대로. `*Pct`는 노출하지 않는다

### 하단 96px

```text
[ 출주 등록 ]  폭 240×48  bg --race-green-700
[ 등록 보류 ]  폭 160×48  외곽선만
               보류 시 토스트: "5-2 준비 종료 전까지 등록할 수 있습니다."
```

보류 중인 플레이어에게는 이후 모든 준비 단계 상단에 스티키 배너:

```text
▲ GⅠ 출주 등록 미완료 · 5-2까지    [지금 등록]
높이 36px, bg --race-red 알파 .12, 좌측 3px 실선 --race-red
```

## 23.6 최종 승부수 — `FinishingMoveOverlay.tsx`

"스킬 카드"가 아니라 **기수 작전 지시서**다.

- 카드 **420×520**, 3장, gap 28
- 헤더 48px: `최종 승부수` 11px + `작전 A / B / C` 20px 700
- 카테고리 라벨은 우상단 pill (색은 §9.2 카테고리 색)
- 캐릭터 초상은 **상단 우측 56×56 한 장뿐**
- 하단 132px: `호응 근거`

```text
호응 근거
 · 추입 적성 A
 · 장거리 적성 S
 · 최근 2전 라스트 3F까지 생존
 · 지구력 계열 장비 2개
```

## 23.7 임시 승부마 배지 (§12.0 연동)

Stage 2-5 ~ 4-4 사이에는 플랜 효과가 `CarryScore` 1위에게 임시 적용된다.
보드에서 해당 유닛 좌상단에 **점선 테두리 뱃지**를 붙인다.

```text
[임시 승부마]  10px, 1px dashed var(--race-brass), radius 4, 패딩 2×5
툴팁: "GⅠ 출주 등록 전까지 이 기물이 작전 효과를 받습니다. 4-5에 직접 지정합니다."
```

## 23.8 전투 HUD — `RaceProgressHud.tsx`

화면 상단 중앙. 폭 **520 × 높이 34**.

```text
START ━━━━━ 도중 ━━━━━━━━ 승부처 ━━━ 라스트 3F ┃ GOAL
  ●
```

| 요소 | 규격 |
|---|---|
| 트랙 선 | 높이 3px, 배경 `--race-line` 알파 .35, 진행분 `--race-green-500` |
| 현재 위치 마커 | 원 8px, `--race-brass`, 그림자 0 0 6px |
| 구간 눈금 | 진행도 .166 / .666 / .833 위치에 2×10px 세로선 |
| 라벨 | 11px, letter-spacing .1em, 현재 구간만 `--race-charcoal` 나머지 `--race-line` |
| **진행도 vs 시계 괴리** | 진행도가 시계보다 앞서면 마커 뒤에 짧은 잔상(폭 24px, 알파 .25) — "예상보다 빠른 전개" |

### 구간 진입 연출

| 시점 | 연출 | 길이 |
|---|---|---|
| 진행도 0 | `START` 텍스트 페이드인 | 400ms |
| 0.166 | 눈금 tick만 깜빡임, 텍스트 없음 | 200ms |
| 0.666 | `승부처` 12px → 18px 확대 + `--race-red` 플래시 | 500ms |
| 0.833 | **`LAST 3F` / `라스트 3F`** — HUD 라인 좌→우 스윕 | 450ms |
| 시계 30초 | 기존 `극한 승부` 배너 재사용 (`banner_overtime.png`) | 기존 유지 |

**VFX는 전부 0.6초 이내. 화면 전체 플래시 금지. 전투를 가리지 않는다.**

## 23.9 출주마 인게임 표시 — `EntryUnitBadge`

머리 위 왕관·거대 별 **금지.**

| 항목 | 값 |
|---|---|
| 위치 | 체력바 **왼쪽 끝에서 −26px**, 세로 중앙 정렬 |
| 모양 | 제켄(번호판) — 둥근 사각 **22×22**, radius 4 |
| 배경 | `--race-ivory` / 테두리 1.5px `--race-brass` |
| 내용 | GⅠ 테마의 출주 번호를 흉내 낸 숫자 1자리 (플레이어 좌석 번호 1~8) 12px 700 `--race-charcoal` |
| 호버 툴팁 | 3줄 |

```text
GⅠ 출주마
작전 : 슬로 페이스 → 롱 스퍼트
승부수 : 불침의 스테이어
```

**상대를 스카우팅할 때도 동일하게 보인다.** 숨기면 전략성이 사라진다.

## 23.10 스카우트 요약 — `RacePlanScoutSummary.tsx`

`DetailPanel` / 관전 스코어보드에 1줄 추가.

```text
p3 카나에  ·  슬로 페이스 → 롱 스퍼트  ·  [초상] 키타산 블랙  ·  불침의 스테이어
```

**노출:** 플랜 / 진화 / 출주마 / 승부수.
**비노출:** 추천 근거, `EntryFit`, 현재 오퍼, 보류 여부, 변경권 사용 여부.

## 23.11 모바일

`.mobile` 클래스 기반 (기존 `src/styles/mobile.css` 규약). 기준 폭 **360 / 390 / 412**.

### Stage 2 / 3

- **가로 3장 배치 금지.** 세로 스냅 carousel
- 카드 폭 `calc(100vw - 32px)`, 다음 카드 **12%** 미리보기
- swipe + 하단 dot 인디케이터 (3개, 지름 6px, 활성 `--race-brass`)
- **카드 내부 효과 요약은 접지 않는다.** 근거만 2줄로 줄인다
- `이 작전으로 출주` 버튼은 화면 하단 **sticky**, 높이 52, 좌우 16 여백, `safe-area-inset-bottom` 반영

### Stage 4

- 후보 그리드 **2열**, 카드 높이 116, 초상 **56×56**
- 상세는 **bottom sheet** (높이 `min(72vh, 620px)`, 드래그 핸들 36×4)
- 적성 바는 4개 → **2개(각질/거리)** 로 축약, 나머지는 시트 안에서
- `출주 등록` sticky

### 드래그 충돌 방지 (필수)

Race Plan 오버레이가 열려 있는 동안 보드 드래그가 동시에 살아 있으면 모바일에서 유닛이 날아간다.

```ts
// interactionStore
if (racePlanOverlayOpen) { pointerLock = true; }   // touch-drag.ts가 이 플래그를 본다
```

`tests/browser/race-plan-mobile.spec.ts`에서 **오버레이 중 보드 드래그가 무시되는지** 검증한다.

### HUD

- 폭 `62vw`, 최소 **210px**
- 라벨은 `START` / `3F` 두 개만 유지

---

# 24. 이미지 자산 — 정확한 규격 (A8)

## 24.1 이 저장소의 실제 아트 규약 (측정 확인)

`scripts/check-art-manifest.ts`가 **실제로 강제하는 규격**이다. 이걸 따르지 않으면 `STRICT_ART=1`에서 실패한다.

| 종류 | 크기 | 알파 | 비고 |
|---|---|---|---|
| 초상화 | **256×256** | 필수 | `characters/portrait/<id>.png` |
| 전투 모션 시트 | **128×128 × 4열 × 6행 = 512×768** | 필수 | 24프레임 (`FRAME_CLIPS`) |
| 컷인 | **960×540** | 필수 | 5코만 |
| 아이콘 (아이템/특성/증강/상태) | **96×96** | 필수 | |
| **VFX 시트** | **1920×192 = 192×192 × 10프레임** | 필수 | 가로 1줄 |
| 별 VFX | 1536×512 | 필수 | |
| 배경(boards) | **1920×1080** | 불투명 허용 | 유일하게 알파 불필요 |
| 배너 | **960×180** | 필수 | |

**v1.0의 `.webp` 2048×1152 지시는 이 파이프라인과 맞지 않는다. 전부 PNG로 바꾼다.**

## 24.2 코드로 만드는 것 — 이미지 발주 불필요 (21종)

아래는 **인라인 React SVG 컴포넌트**로 직접 만든다. AI 이미지 생성을 쓰지 않는다.
`src/components/race-plan/icons/RaceIcons.tsx` 한 파일에 전부 넣는다.
전부 `viewBox="0 0 24 24"`, `stroke-width 1.6`, `currentColor` 사용, `fill="none"` 기본.

| 컴포넌트 | 형태 지시 |
|---|---|
| `IconPaceHigh` | 오른쪽으로 기운 속도선 3줄, 위로 갈수록 짧아짐 |
| `IconPaceLead` | 앞선 원 1개 + 뒤쪽 작은 원 2개 |
| `IconPaceMiddle` | 균등 간격 원 3개 일렬 |
| `IconPaceSlow` | 뒤쪽 원 1개 + 오른쪽 위로 향하는 화살표 |
| `IconPassing` | 바깥쪽으로 휘어 앞지르는 곡선 + 화살촉 |
| `IconLast3F` | 결승선 체크무늬 2×2 + 속도선 2줄 |
| `IconGuts` | 아래로 꺾였다 위로 솟는 꺾은선 |
| `IconTrack` | 타원 트랙 + 내부 파선 |
| `IconPhaseStart` | 게이트 격자 3칸 |
| `IconPhasePosition` | 원 3개가 삼각 배치 |
| `IconPhaseLate` | 코너 곡선 + 안쪽 화살표 |
| `IconPhaseLast3F` | 직선 2줄 + 굵은 화살표 |
| `IconPhaseGoal` | 결승 기둥 2개 + 가로선 |
| `IconSurfaceTurf` | 잔디 5가닥 |
| `IconSurfaceDirt` | 모래 점 6개 + 바닥선 |
| `IconGoingFast` `IconGoingStandard` `IconGoingHeavy` | 같은 바닥선에 물결 0 / 1 / 3줄 |
| `IconDirectionLeft` `IconDirectionRight` | 반시계 / 시계 화살표 원호 |
| `IconEntryBest` | `◎` — 이중 원 |
| `IconEntryGood` | `○` — 단일 원 |
| `IconEntryExperimental` | `▲` — 삼각형 |
| `IconSaddlecloth` | 둥근 사각 + 안쪽 숫자 자리 |

**이유:** 21개를 PNG로 발주하면 `art-manifest` 검수 대상이 21개 늘고, 색 테마 전환(라이트/다크)도 불가능하다.
SVG는 `currentColor`로 카테고리 색을 그대로 받는다.

## 24.3 실제로 이미지 발주가 필요한 것 (7종)

`art-manifest.json`의 `boards` / `ui` / `vfx` 배열에 **반드시 추가**한다.
추가하지 않으면 `check:art`가 검수하지 않고, 아트팀도 알 수 없다.

### 24.3.1 배경 3종 — `boards/` · **1920×1080** · 불투명 허용

| 파일 | 용도 | 지시 |
|---|---|---|
| `boards/bg_race_plan_paper.png` | Stage 2·3 오버레이 바탕 | 현대적인 레이싱 프로그램 용지. 오래된 종이 아님. 오프화이트 `#f3f0e5` 기조, **아주 약한 섬유 텍스처**(대비 3% 이내), 좌우 상단에 극히 옅은 괘선 격자. 텍스트·로고·말 그림 **없음**. 조밀한 UI를 얹어도 글자가 읽혀야 한다 |
| `boards/bg_g1_entry_board.png` | Stage 4 출주 등록 | 일본 경마장 방송 데이터보드에서 영감. 딥그린 `#10271f` → `#1e4938` 세로 그라디언트 + 크림 괘선. 구조적 grid(가로 12칸 느낌). 실존 JRA 로고/브랜드/레이스 사진 **절대 금지**. 텍스트 **없음** |
| `boards/bg_paddock_panel.png` | 승부수 선택 | 어두운 차콜·그린 `#202521`. 패독 전광판 질감(미세한 도트 매트릭스, 대비 5% 이내). 텍스트·말·인물 **없음** |

### 24.3.2 배너 1종 — `ui/` · **960×180** · RGBA

| 파일 | 용도 | 지시 |
|---|---|---|
| `ui/banner_last3f.png` | 라스트 3F 진입 | 기존 `banner_overtime.png`와 **같은 실루엣/여백 규칙**. 중앙에 결승 체크무늬 띠, 좌우로 속도선. 글자는 넣지 않는다(텍스트는 코드가 렌더) |

### 24.3.3 VFX 시트 3종 — `vfx/` · **1920×192 (192×192 × 10프레임)** · RGBA

**프레임 수는 반드시 10. 가로 1줄. 프레임 경계에 잔상이 넘치면 안 된다.**

| 파일 | 재생 | 프레임 구성 |
|---|---|---|
| `vfx/vfx_race_gate.png` | 전투 시작, 출주마 발밑 | 1–2 게이트 격자 실루엣 등장 / 3–5 위로 열리며 흙먼지 / 6–8 먼지 확산 / 9–10 소멸. 색 `#a98b4b` + 흰 하이라이트 |
| `vfx/vfx_race_late_ring.png` | `LATE` 진입, 출주마 발밑 | 1–3 얇은 링 바깥으로 확장 / 4–7 링이 굵어지며 4코너 곡선 암시 / 8–10 페이드. 색 `#a53c31` 알파 최대 .7 |
| `vfx/vfx_race_last3f.png` | `LAST_3F` 진입, 출주마 전신 | 1–4 후방에서 전방으로 흐르는 속도선 5줄 / 5–7 최대 밀도 / 8–10 잔상만 남고 소멸. 색 `#e8c86a` → 투명 |

### 24.3.4 공통 프롬프트 (이미지 생성 도구용)

```text
Original premium Japanese horse-racing broadcast and race-program inspired UI asset.
Modern professional sports data presentation.
Palette: deep green #10271f / #1e4938, warm ivory #f3f0e5, restrained brass #a98b4b.
Clean grid hierarchy, low visual noise, readable behind dense game UI.
No logos, no text, no letters, no numbers, no horse character, no jockey,
no anime character, no real horse photo, no betting ticket, no watermark,
no JRA branding, no Uma Musume branding, no TFT hextech frame.
Flat vector-leaning shading, subtle grain only.
```

**금지 목록을 프롬프트에서 빼지 않는다.** 저작권 리스크가 실제로 있다.

### 24.3.5 `art-manifest.json` 등록 — `scripts/build-game-data.ts`

```ts
manifest.boards.push(
  'boards/bg_race_plan_paper.png',
  'boards/bg_g1_entry_board.png',
  'boards/bg_paddock_panel.png',
);
manifest.banners.push('ui/banner_last3f.png');
manifest.vfx.push(
  'vfx/vfx_race_gate.png',
  'vfx/vfx_race_late_ring.png',
  'vfx/vfx_race_last3f.png',
);
```

## 24.4 아트 미납품 시 폴백 (필수)

**이미지가 없다는 이유로 기능을 생략하지 않는다.** 이 프로젝트는 PNG 0장으로도 플레이 가능해야 한다.

| 자산 | 폴백 |
|---|---|
| `bg_race_plan_paper.png` | CSS `linear-gradient(#f3f0e5, #e9e3d3)` + `repeating-linear-gradient` 1px 괘선 |
| `bg_g1_entry_board.png` | CSS `linear-gradient(#10271f, #1e4938)` + 12칸 세로 괘선 |
| `bg_paddock_panel.png` | 단색 `#202521` |
| `banner_last3f.png` | 텍스트만 렌더 (`LAST 3F` / `라스트 3F`) |
| VFX 3종 | Phaser `Graphics` 원/선 프리미티브. `phaser/fallback-art.ts` 패턴 재사용 |

폴백 품질 기준: **"보라색 빈 카드"가 절대 나오지 않아야 한다.** 폴백도 경마 톤을 유지한다.

## 24.5 발주서 생성

이미지 생성 도구를 쓸 수 없으면 위 7종을 그대로 담은
`docs/ART_REQUEST_RACE_PLAN.md`를 생성한다. 기존 `docs/ART_REQUEST.md`의 서식을 따른다.
**단 기능 UI는 폴백으로 전부 구현한다.**

---

# 25. VFX 명세 (C2)

| 트리거 | 위치 | 에셋/색 | 길이 | 비고 |
|---|---|---|---|---|
| 전투 시작 (출주마) | 발밑 | `vfx_race_gate` 10f @ 20fps | **500ms** | 출주마에게만 |
| `LATE` 진입 | 발밑 | `vfx_race_late_ring` 10f @ 20fps | **500ms** | |
| `LAST_3F` 진입 | 전신 | `vfx_race_last3f` 10f @ 18fps | **555ms** | 화면 전체 플래시 **금지** |
| 각력 만렙(10) | 각력 게이지 | `#e8c86a` 펄스 | **600ms 주기** | 소모 전까지 반복 |
| 각력 해방 | 유닛 외곽 | 기존 `vfx_buff` 재사용 + 틴트 `#a98b4b` | **400ms** | |
| 지구력 만렙(6) | 지구력 게이지 | `#6fc49a` 정적 하이라이트 | — | 애니메이션 없음 |
| 승부수 발동 | 유닛 머리 위 24px | 제켄 뱃지가 **1.25배 → 1.0** 스케일 | **280ms** | 컷인 **금지** |
| 고유 승부수 발동 | 유닛 외곽 | 각질별 기존 `vfx_dash_<style>` 재사용 + 승부수 색 틴트 | **400ms** | 신규 에셋 불필요 |
| 등록 확정 (UI) | 출주 등록 화면 | 초상 → 제켄 뱃지 연결선 | **350ms** | `cubic-bezier(.2,.8,.2,1)` |
| 작전 확정 도장 (UI) | 카드 중앙 | `scale 1.6 → 1.0`, `opacity 0 → 1` | **300ms** | |
| 오버레이 열림 | 패널 | `opacity 0→1` + `translateY(10px→0)` | **220ms** | |
| 카드 호버 | 카드 | `translateY(-4px)` + 테두리 `--race-brass` | **140ms** | |
| 카드 누름 | 카드 | `scale(0.98)` | **120ms** | |

**`prefers-reduced-motion: reduce`일 때:**
연결선·도장·스윕 애니메이션은 **즉시 최종 상태**로. 펄스·플래시는 **제거**. 페이드만 100ms로 유지.

---

# 26. 사운드 명세 (A9, C3)

## 26.1 실제 구조

`src/game/ui/audio.ts`의 `SOUND_DESIGNS`는 **WebAudio 신스 테이블**이다.
`select`와 `level-up`만 `/assets/audio/<name>.mp3`를 재생하고, 나머지는 전부 합성음이다.

```ts
type SynthDesign = {
  notes: number[];      // Hz, duration을 균등 분할해 순서대로 재생
  wave: OscillatorType; // 'sine' | 'triangle' | 'sawtooth' | 'square'
  duration: number;     // 초
  noise: number;        // 0..1, 화이트노이즈 혼합량
};
```

## 26.2 추가할 9종 — 그대로 붙여넣을 수 있는 값

`GameSound` 유니온과 `SOUND_DESIGNS`에 함께 추가한다.

```ts
export type GameSound = /* 기존 */
  | 'race-plan-open' | 'race-plan-hover' | 'race-plan-select' | 'race-plan-stamp'
  | 'race-gate' | 'race-late' | 'race-last3f'
  | 'race-entry-confirm' | 'race-entry-transfer';

export const SOUND_DESIGNS = {
  /* 기존 9종 유지 … */

  // 종이/방송 그래픽 톤 — 부드럽고 짧게
  'race-plan-open':     { notes: [330, 440, 523],        wave: 'sine',     duration: .34, noise: .02 },
  'race-plan-hover':    { notes: [880],                  wave: 'sine',     duration: .05, noise: .01 },
  'race-plan-select':   { notes: [392, 523, 659],        wave: 'triangle', duration: .30, noise: .00 },
  // 스탬프 = 짧은 저역 타격 + 종이 마찰
  'race-plan-stamp':    { notes: [140, 90],              wave: 'triangle', duration: .16, noise: .30 },

  // 출발 게이트 — 금속음이지만 과하지 않게
  'race-gate':          { notes: [520, 300, 180],        wave: 'square',   duration: .22, noise: .22 },
  // 승부처 — 긴장
  'race-late':          { notes: [294, 392],             wave: 'sawtooth', duration: .26, noise: .06 },
  // 라스트 3F — 상승
  'race-last3f':        { notes: [392, 523, 659, 880],   wave: 'triangle', duration: .50, noise: .04 },

  'race-entry-confirm': { notes: [349, 523, 698, 880],   wave: 'triangle', duration: .58, noise: .01 },
  'race-entry-transfer':{ notes: [523, 392, 523],        wave: 'sine',     duration: .34, noise: .00 },
} as const;
```

## 26.3 재생 규칙

| 사운드 | 시점 | 빈도 제한 |
|---|---|---|
| `race-plan-open` | 오버레이가 열릴 때 | 오버레이당 1회 |
| `race-plan-hover` | 카드 포커스/호버 | **80ms 쿨다운** (기존 `lastSound` 맵 재사용) |
| `race-plan-select` | 카드 클릭 | |
| `race-plan-stamp` | 확정 도장이 찍히는 순간 (select 후 **180ms**) | |
| `race-gate` | 전투 시작 시 출주마 보유자에게만 | 전투당 1회 |
| `race-late` | `LATE` 진입 | 전투당 1회 |
| `race-last3f` | `LAST_3F` 진입 | 전투당 1회 |
| `race-entry-confirm` | GⅠ 등록 확정 | |
| `race-entry-transfer` | 승부마 변경 | |

**전투 중 사운드(`race-gate`/`race-late`/`race-last3f`)는 본인 전투를 볼 때만 재생한다.**
관전 중에는 관전 대상 기준. 8개 전투가 동시에 울리면 안 된다.

## 26.4 금지

- 실제 경마장 실황 중계 음성 샘플 **사용 금지**
- 라이선스가 확인되지 않은 외부 효과음 파일 추가 **금지**
- 신규 `.mp3`/`.ogg` 파일을 `public/assets/audio/`에 추가하지 않는다 (번들 크기 회귀 — `npm run check:bundle`)

---

# 27. 접근성

| 항목 | 요구 |
|---|---|
| 색 단독 구분 금지 | 추천은 `◎ ○ ▲` **문자**를 항상 함께 쓴다. 카테고리는 색 + **이름 텍스트** |
| 레이스 페이즈 | HUD에 **텍스트 라벨** 필수. 아이콘만으로 표시하지 않는다 |
| 대비 | 본문 텍스트 대비 **4.5:1 이상**. `--race-charcoal` on `--race-ivory` = 12.6:1 ✓ / `--race-line` 위 텍스트 금지 |
| 키보드 | 카드 3장 `Tab` 순회, `Enter`/`Space` 선택, `R`로 포커스된 카드 리롤 |
| 포커스 링 | `outline: 2px solid var(--race-brass); outline-offset: 2px` — 제거 금지 |
| `Esc` | **상세 패널만 닫는다. 선택 화면 자체는 닫지 않는다** (선택은 필수 단계) |
| 스크린리더 | 각 카드 `role="button"` + `aria-label="작전 A, 힘 비축, 슬로 페이스 계열, 추천 근거 4건"` |
| 수치 | 효과 텍스트의 모든 수치에 `aria-label` 풀어쓰기 (`+12%` → `12퍼센트 증가`) |
| `prefers-reduced-motion` | §25 규칙 적용 |
| 타이머 | 남은 시간을 색만으로 표시하지 않는다. 숫자 병기 |

---

# 28. 테스트

## 28.1 단위 (vitest, `tests/`)

| 파일 | 검증 |
|---|---|
| `race-phase.test.ts` | `raceProgress` 단조성 / 부활·소환에도 페이즈 역행 없음 / 5페이즈 경계 |
| `race-plan-offer-score.test.ts` | 모든 인자 클램프 범위 준수 / 최종 곱 `[0.10, 4.00]` |
| `race-plan-determinism.test.ts` | 동일 입력 2회 → 후보 ID·순서·근거 완전 동일. 리롤 3회 포함. AI 8인 로비 2회 동일 |
| `race-plan-slots.test.ts` | 3장 `majorTag` 전부 동일 금지 / `BoardFit ≥ 1.0` 최소 1장 / 리롤 시 이전 오퍼와 2장 이상 중복 금지 |
| `race-plan-role-guard.test.ts` | **원거리 유닛에게 `MELEE` 노드가 단 한 번도 제시되지 않음** (전 유닛 × 전 노드 전수) |
| `race-plan-entry.test.ts` | `EntryFit` 정렬 / `◎○▲` 규칙 / 벤치 ×0.90 |
| `race-plan-lifecycle.test.ts` | 합성 승계(§16.2) / 판매 후 재획득 1회 복구(§16.3) / 벤치 비활성(§16.4) |
| `race-plan-transfer.test.ts` | 1회 제한 / 5-5 마감 / 승부수 재제시 2+1 구성 |
| `race-plan-aptitude.test.ts` | 퍼센타일 계산 / `AptitudeFlavor ∈ [0.88, 1.15]` / VERY_LOW는 1.0 |
| `race-plan-effects.test.ts` | 각 노드의 `EffectDef`가 실제로 스탯을 바꾸는지 / 소스키 중첩 규칙 / `SURVIVE_LETHAL` 1회 |
| `race-plan-budget.test.ts` | 전 노드(90) `IE_effective`가 §19.2 밴드 안 |
| `g1-theme.test.ts` | 로비 전원 동일 테마 / GI·JpnI만 후보 |
| `race-plan-profile-import.test.ts` | 145/145 조인 / 필수 필드 존재 / `*Pct ∈ [0,1]` |
| `race-plan-save.test.ts` | 구버전 세이브(racePlan 없음) 로드 → 백필 성공 / `version`·`ROSTER_HASH` 불변 |

## 28.2 개인화 검증 — synthetic 8인

```text
1. 저코 리롤 AD        2. AP 캐스터          3. fast-8 유연
4. 탱커 지연           5. 도주 편중          6. 추입 편중
7. 더트 편중           8. 약체 회복(HP 18)
```

- 8명의 3장 세트가 **완전히 동일한 경우가 2명을 초과하면 실패**
- 8명 전원이 **최소 1장 이상 서로 다른 후보**를 받아야 한다

## 28.3 무효 오퍼 방지

- 모든 오퍼가 정확히 3장 (2장이 나오면 실패)
- `BoardFit ≥ 1.0` 후보가 0장이면 실패
- 3장 전부 같은 페이즈 대역이면 실패
- 승부수 3장의 `FinishingCategory`가 겹치면 실패

## 28.4 코스트 중립 (§19.5)

synthetic 보드 5종(`1코3성` / `2코3성` / `3코3성` / `4코2성` / `5코2성`, 동일 아이템 가치)에 대해:

```text
· 각 캐리가 EntryFit 1위(◎)로 추천되는 시드가 최소 1개 존재해야 한다
· Race Plan 적용 전후의 전투 승률 차이가 5종 사이에서 ±10% 이내
· `cost >= 4` 하드 필터가 코드 어디에도 없음을 grep으로 검증
```

## 28.5 적성 자유도

전 대표 유닛 × 전 플랜에 대해:

```text
· 도주 G라도 하이 페이스 플랜을 선택 가능
· 장거리 G라도 슬로/라스트3F 선택 가능
· 더트 F(93명)라도 RP_TRACK_DIRT / FM_DIRT_GRIND 선택 가능
· 단 오퍼 등장 가중치 차이는 허용 (0.88~1.15)
```

## 28.6 라스트 3F 도달률 (B1 검증 — 이 시스템의 핵심 지표)

```text
npm run simulate -- --matches 500
→ 전체 PvP 전투 중 LAST_3F 페이즈에 진입한 비율 ≥ 80%
→ 진입하지 못한 전투의 평균 지속 시간을 리포트에 기록
```

**80% 미만이면 `raceProgress` 계수(0.833 등)를 조정하고 재측정한다.**
절대 초 기준으로 되돌리지 않는다.

## 28.7 Stage 4-5 도달률 (B2 검증)

```text
→ 8명 중 GⅠ 출주 등록 화면을 본 플레이어 비율 ≥ 95% (조기 개방 포함)
→ 95% 미만이면 RACE_ENTRY_EARLY_HP를 올린다 (20 → 25 → 30)
```

## 28.8 E2E (Playwright, `tests/browser/`)

| 파일 | 시나리오 |
|---|---|
| `race-plan-desktop.spec.ts` | 2-5 열림/선택/슬롯 리롤 → 3-5 분기 → 4-5 등록/보류 → 승부수 → HUD → 스카우트 → 승부마 변경 |
| `race-plan-mobile.spec.ts` | 360×800에서 carousel swipe / sticky 버튼 / bottom sheet / **오버레이 중 보드 드래그 무시** / 가로세로 전환 |
| `race-plan-a11y.spec.ts` | Tab 순회 / Esc 동작 / 포커스 링 / aria-label 존재 |

## 28.9 멀티플레이

```text
· 8클라이언트 시뮬레이션 — 각기 다른 오퍼
· 선택 동기화 / 타임아웃 자동 선택(추천 1위)
· 선택 중 새로고침 → 재접속 후 같은 오퍼가 그대로 복원
· host + AI 혼합 로비
· 관전자에게 상대 오퍼가 노출되지 않음 (privateMatch 검증)
· 방 체크포인트 저장/복원 후 racePlan 보존
```

## 28.10 회귀 — 삭제/skip 금지

기존 테스트 전부 그대로 통과해야 한다.

```text
shop / drag&drop / item combine / carousel / augments / battle /
chat / multiplayer / mobile drag / audio / save / reconnect / art manifest
```

**신규 시스템 때문에 관계없는 테스트를 삭제하거나 `skip` 처리하는 것을 금지한다.**

## 28.11 검증 명령

```bash
npm run sync:data
npm run data:build
npm run data:validate
npm run audit:race-plan          # 신규 — IE 밸런스 감사
npm run typecheck
npm test
npm run simulate -- --matches 500
npm run check:art
npm run build
npm run verify                   # 위 전체
```

`package.json`에 추가:

```json
"audit:race-plan": "tsx scripts/audit-race-plan.ts",
"verify": "npm run sync:data && npm run data:build && npm run data:validate && npm run audit:race-plan && npm run typecheck && npm test && npm run simulate -- --matches 250 && npm run check:art && npm run build"
```

---

# 29. 신규 파일 목록

## 29.1 엔진 — `src/game/engine/race-plan/`

```text
index.ts              공개 API 배럴
types.ts              RacePlanState, RacePlanOffer, NodeGuard, FinishingCategory …
schema.ts             zod — plans/evolutions/finishing-moves/g1-themes/profiles
defs.ts               JSON 로드 + Map 인덱싱 (모듈 최상위 1회)
loader.ts             horse-racing-profiles.json → Map<unitDefId, HorseRacingProfile>

context.ts            RacePlanOfferContext 조립
board-profile.ts      CarryScore, 코스트/별/역할 히스토그램
item-profile.ts       ItemProfile (ItemDef.tags/stats/effects에서 유도)
economy-profile.ts    EconomyArchetype 점수제
combat-profile.ts     BattleEvent[] → RecentCombatProfile

score.ts              OfferScore 11인자 + 클램프
offer-slots.ts        슬롯 A/B/C + 카테고리 중복 방지
offer-generator.ts    Top-K 가중 추첨 + 근거 생성
reroll.ts             슬롯별 1회
guard.ts              역할 가드 (§10)

entry.ts              EntryFit, 추천 마크, 자동 등록
transfer.ts           승부마 변경
lifecycle.ts          reconcileEntryUnit / 판매·재획득 복구

race-phases.ts        raceProgress, getRaceCombatPhase
runtime.ts            전투 바인딩 (출주마 탐색 → EffectDef 주입)
resources.ts          각력/지구력

g1-theme.ts           테마 추첨 + affinity 가중
signature.ts          고유 승부수 16 + Phase B 자동 생성
aptitude.ts           퍼센타일 계산, APTITUDE 가중
serialize.ts          기본 상태 생성 + 백필
```

## 29.2 UI — `src/components/race-plan/`

```text
RacePlanOverlay.tsx        Stage 2·3 공용 셸
RacePlanHeader.tsx         헤더 + 전개 지수 그래프
RacePlanCard.tsx           410×540 카드
RacePlanReasonList.tsx     ◎○△ 근거
RaceEvolutionOverlay.tsx   분기표
EvolutionBranch.tsx        SVG 연결선
G1EntryOverlay.tsx         Stage 4 셸
G1ThemeHeader.tsx          출마표 헤더
EntryCandidateGrid.tsx     216×132 그리드
EntryCandidateCard.tsx
EntryDetailPanel.tsx       우측 40%
FinishingMoveOverlay.tsx
FinishingMoveCard.tsx
RaceProgressHud.tsx        전투 HUD
EntryUnitBadge.tsx         제켄
RacePlanScoutSummary.tsx   스카우트 1줄
RaceAptitudeMiniChart.tsx  적성 바
icons/RaceIcons.tsx        SVG 아이콘 21종 (§24.2)
```

**기존 대형 컴포넌트(`Overlays.tsx`, `Panels.tsx`, `BattleScreen.tsx`)를 전면 재작성하지 않는다.**
연결 지점만 최소로 추가한다.

## 29.3 데이터

```text
src/data/manual/race-plan/
  plans.json                 24
  evolutions.json            24
  finishing-moves.json       24
  signature-moves.json       16
  reason-copy.json           근거 한국어 카피
src/data/generated/race-plan/
  horse-racing-profiles.json 145
  g1-themes.json             GI/JpnI 전체
```

## 29.4 스타일 / 스크립트 / 테스트

```text
src/styles/race-plan.css
scripts/audit-race-plan.ts
docs/generated/RACE_PLAN_DATA_IMPORT_REPORT.md   (자동 생성)
docs/ART_REQUEST_RACE_PLAN.md                    (아트 미발주 시)
tests/race-*.test.ts                             §28.1
tests/browser/race-plan-*.spec.ts                §28.8
```

## 29.5 수정할 기존 파일 (전부 최소 변경)

| 파일 | 변경 |
|---|---|
| `engine/constants.ts` | `RACE_PLAN_ROUNDS`, `RACE_PLAN_SECONDS`, 조기 개방/마감 상수 |
| `engine/state.ts` | `MatchPhase` 2종, `PlayerState.racePlan?`, `MatchState.g1ThemeId?`·`racePlanTrack?` |
| `engine/types.ts` | `TriggerDef.when` 2종 + `phase`/`hpBelow`/`hpAbove` 필드 |
| `engine/rounds/schedule.ts` | `racePlanKind`, `prepSeconds` 분기 |
| `engine/rounds/director.ts` | 오퍼 개방 / 선택 / 리롤 / 등록 / 승부수 / 변경 / AI / 자동 진행 |
| `engine/battle/engine.ts` | `raceProgress` 추적, `RACE_PHASE` 이벤트, `fire('RACE_PHASE'/'TARGET_CHANGED')`, `BattleEvent` 2종 |
| `engine/battle/combat-unit.ts` | `racePlanLegPower`, `racePlanStamina` 필드 |
| `engine/battle/effects.ts` | `tag: 'RESOURCE'` / `'PER_LEG_POWER'` 분기 |
| `engine/shop/index.ts` | `applyCombines` 이후 `reconcileEntryUnit` 호출 |
| `engine/save/index.ts` | 로드 후 백필 |
| `network/protocol.ts` | `commandSchema` action 6종 |
| `network/commands.ts` | `applyOnlineCommand` 분기 6종 |
| `server/rooms.ts` | `privateMatch` sanitize / `setDeadline` / `tick` 자동 진행 |
| `store/gameStore.ts` | 액션 6종 |
| `components/screens/BattleScreen.tsx` | `RaceProgressHud` 마운트, `awaitingRacePlan` 가드 |
| `components/Overlays.tsx` | Race Plan 오버레이 마운트 (기존 구조 유지) |
| `components/BattleRecap.tsx` | `레이스 플랜` 탭 |
| `phaser/BattleScene.ts` | 각력/지구력 게이지, 제켄 뱃지, VFX 3종 |
| `ui/audio.ts` | `GameSound` + `SOUND_DESIGNS` 9종 |
| `scripts/sync-umarogue.ts` | `FILES` 2개 추가 |
| `scripts/build-game-data.ts` | `buildRacePlanData()` + `art-manifest` 등록 |
| `package.json` | `audit:race-plan` + `verify` 체인 |

---

# 30. 구현 순서 — 반드시 이 순서

```text
Phase 1  탐색 (코드를 먼저 읽는다)
  1  최신 main 확인, npm ci
  2  engine/state.ts · constants.ts · rounds/director.ts 정독
  3  battle/engine.ts 의 tick·fire·이벤트 흐름 파악
  4  network/protocol.ts · server/rooms.ts 의 권한 모델 파악
  5  components/Overlays.tsx 의 증강 오버레이 패턴 파악
  6  src/data/source/horse-game-db.json 의 aptitudes/affinities 확인

Phase 2  데이터
  7  sync-umarogue.ts FILES 2개 추가 → npm run sync:data
  8  buildRacePlanData() 작성 (퍼센타일 포함) → npm run data:build
  9  zod 스키마 + validate → npm run data:validate
 10  조인 145/145 확인, 임포트 리포트 생성

Phase 3  코어 (전투 없이 순수 함수부터)
 11  types.ts / RacePlanState / serialize.ts
 12  context/board/item/economy/combat 프로파일러
 13  score.ts + guard.ts
 14  offer-generator.ts + offer-slots.ts + reroll.ts
 15  entry.ts / transfer.ts / lifecycle.ts
 16  ★ 여기서 tests/race-plan-*.test.ts 단위 테스트를 먼저 통과시킨다

Phase 4  전투
 17  race-phases.ts + BattleEngine 진행도 추적
 18  TriggerDef 2종 + fire 경로
 19  runtime.ts — 출주마에 EffectDef 바인딩
 20  resources.ts (각력/지구력)
 21  BattleEvent 2종 + recap

Phase 5  서버
 22  MatchPhase 2종 + director 개방/선택
 23  commandSchema + applyOnlineCommand
 24  privateMatch sanitize ★ 여기를 빠뜨리면 정보 누출
 25  setDeadline + tick 자동 진행
 26  AI (resolveAiRacePlans)
 27  재접속 검증

Phase 6  UI
 28  race-plan.css 토큰 + RaceIcons.tsx
 29  Stage 2/3 오버레이
 30  Stage 4 출주 등록
 31  승부수 오버레이
 32  전투 HUD + 제켄 뱃지 + Phaser 게이지
 33  스카우트 요약 + recap 탭
 34  모바일 (pointer lock 포함)
 35  접근성

Phase 7  아트
 36  SVG 아이콘 21종 완성
 37  CSS/Graphics 폴백 완성 ★ 이미지 없이도 100% 동작
 38  PNG 7종 생성 또는 ART_REQUEST_RACE_PLAN.md

Phase 8  검증
 39  단위/통합 전체
 40  audit:race-plan (IE 밴드)
 41  simulate 500 — 라스트3F 도달률 ≥ 80%, 4-5 도달률 ≥ 95%
 42  E2E 데스크톱/모바일
 43  8인 멀티 시뮬레이션 + 재접속
 44  npm run verify 통과
```

**Phase 3의 16번(단위 테스트 선통과)을 건너뛰지 않는다.**
오퍼 엔진이 틀린 채로 UI를 만들면 전부 다시 해야 한다.

---

# 31. 실패로 간주하는 구현 (하나라도 해당하면 미완성)

1. Stage 2에서 캐릭터를 먼저 고르게 한다
2. 각질 G면 해당 계열 플랜을 **선택할 수 없다**
3. 4코/5코를 얻기 전에 최종 효과가 고정된다
4. 8명이 같은 3장을 받는다
5. `Math.random()`을 쓴다
6. 클라이언트가 오퍼를 생성한다
7. `privateMatch`를 고치지 않아 **상대 오퍼가 보인다**
8. `setDeadline`을 고치지 않아 **선택 시간이 30초로 잘린다**
9. 모바일에서 오버레이가 화면 밖으로 나간다
10. 모바일에서 오버레이 중 보드 드래그가 동작해 유닛이 날아간다
11. 재접속 시 플랜이 소실된다
12. AI가 시스템을 쓰지 않는다
13. Race Plan이 골드/XP/상점확률을 건드린다
14. 더트/추입 캐릭터가 적다는 이유로 해당 플랜이 사라진다
15. 역사적으로 강한 말에게 **수치적 우위**를 준다
16. 이미지가 없다고 보라색 빈 카드로 대체한다
17. UI가 TFT 증강체 화면과 사실상 같다
18. 승부수가 단순 `공격력 +40%`다
19. **원거리 유닛에게 이동/근접 전용 노드가 제시된다** (역할 가드 미구현)
20. **라스트 3F 도달률이 80% 미만이다** (진행도 미구현)
21. 3성 합성 후 출주마 등록이 사라진다
22. 출주마를 팔았을 때 동작이 정의되지 않았다
23. 기존 테스트를 삭제하거나 skip했다
24. `GAME_VERSION`/`SAVE_KEY`/`ROSTER_HASH`를 바꿔 기존 세이브를 날렸다

---

# 32. Definition of Done

## 코어
- [ ] Stage 2-5 개인화 3장 + 슬롯별 리롤
- [ ] Stage 3-5 진화 3장 + 슬롯별 리롤
- [ ] Stage 4-5 GⅠ 출주 등록 (+ HP≤20 조기 개방)
- [ ] 등록 보류 → 5-2 자동 등록
- [ ] 최종 승부수 3장 (카테고리 전부 상이)
- [ ] 승부마 변경 1회
- [ ] 결정론적 리롤
- [ ] 로비 공통 GⅠ 테마 + 라운드 공통 TrackState

## 데이터
- [ ] `race-templates.json` / `racecourses.json` vendor
- [ ] 145/145 조인, 실패 시 빌드 중단
- [ ] 퍼센타일 `*Pct` 생성
- [ ] 임포트 리포트 생성

## 전투
- [ ] `raceProgress` 5페이즈 + 단조성
- [ ] 트리거 2종 / 이벤트 2종
- [ ] 기본 플랜 24 / 진화 24 / 범용 승부수 26 / 고유 16 (= 90노드)
- [ ] 각력·지구력 + Phaser 게이지
- [ ] recap `레이스 플랜` 탭

## UI
- [ ] 데스크톱 4화면
- [ ] 모바일 (360/390/412) + pointer lock
- [ ] 전투 HUD + 제켄 뱃지
- [ ] 스카우트 요약
- [ ] 추천 근거 (최소 1개는 `△`)
- [ ] 접근성 전 항목

## 멀티플레이
- [ ] 서버 권위 / action 6종
- [ ] `privateMatch` sanitize
- [ ] `setDeadline` + 타임아웃 추천 1위 자동 선택
- [ ] 8인 동기화 / 재접속 / AI

## 아트·사운드
- [ ] SVG 아이콘 21종
- [ ] PNG 7종 또는 발주서 + 폴백 100%
- [ ] `art-manifest` 등록, `check:art` 통과
- [ ] 신스 9종

## QA
- [ ] `npm run verify` 통과
- [ ] 라스트3F 도달률 ≥ 80%
- [ ] Stage 4-5 도달률 ≥ 95%
- [ ] IE 밴드 전 노드 통과
- [ ] 기존 테스트 무회귀

---

# 33. Codex 완료 보고 형식

```text
## Race Plan 구현 완료

### 구현
- …

### 데이터
- 로스터 145 / 프로필 조인 145 / 실패 0
- 코스 affinity 80 · going 22 · 계절 87
- GⅠ 테마 N종 (GI/JpnI)

### 콘텐츠
- 기본 플랜 24 / 진화 24 / 범용 승부수 26 / 고유 승부수 16 (총 90)

### 밸런스
- IE 밴드 통과: 90/90 노드
- 라스트3F 도달률: XX.X% (기준 80%)
- Stage 4-5 도달률: XX.X% (기준 95%)
- 코스트별 승률 편차: ±X.X% (기준 ±10%)

### 테스트
- unit X통과 / e2e X통과 / build 통과
- 기존 테스트 회귀: 0

### 멀티플레이
- 8클라 서로 다른 오퍼: 통과
- privateMatch 누출 검사: 통과
- 재접속: 통과 / AI: 통과

### 자산
- SVG 코드 생성: 21
- PNG 납품: X / 폴백 동작: X

### 미완 / 한계
- …
```

---

# 부록 A — 경마 개념 → 게임 변환표

| 경마 개념 | 게임 변환 | 구현 위치 |
|---|---|---|
| ゲート(게이트) | 진행도 0 – 0.166 `START` | `race-phases.ts` |
| 先頭争い(선두 다툼) | 초기 타겟 결정 + 공격속도 | `RP_HIGH_PACE_*` |
| ペース(페이스) | 전투 시간대별 파워 분포 | 전개 지수 그래프 |
| 位置取り(위치 선정) | 타겟 규칙 / 진형 | `POSITION` 태그 |
| 馬群(마군) | 근접 혼전 / 타겟 고정 | `FM_GAP_SHOT` |
| 外から差す(외곽 추월) | 재타겟 + 이동 중 피해감소 | `FM_OUTSIDE_PASS` (RANGED) |
| 仕掛ける(승부처) | `LATE` 진입 | 진행도 0.666 |
| 上がり3ハロン(라스트 3F) | `LAST_3F` | 진행도 0.833 |
| 脚(각력) | 후반 폭발용 축적 자원 | 최대 10 |
| スタミナ(지구력) | 장기전 유지 자원 | 최대 6 |
| 根性(근성) | 저체력 생존 분기 | `GUTS` 계열 |
| 重馬場(중마장) | 지속전 / CC 저항 flavor | `TrackState = HEAVY` |
| コース適性(코스 적성) | 오퍼 가중치 + 명칭 | `G1ThemeFlavor` |
| 距離適性(거리 적성) | 템포 대역 호응 | `distancePct` |
| 脚質(각질) | 템포/타겟 호응 | `stylePct` |
| 出走登録(출주 등록) | 최종 캐리 지정 | Stage 4-5 |
| 騎手への指示(기수 지시) | 최종 승부수 | `FinishingMove` |
| 展開予想(전개 예상) | 개인화 추천 근거 | `OfferReason` |
| ラップタイム(랩타임) | 전개 지수 그래프 | 헤더 우측 |
| 手前(手前 바꾸기) | 좌/우회전 flavor | `FM_LEFT_HAND` |

**실제 경주 물리를 시뮬레이션하지 않는다.**
오토배틀 전투의 **시간 / 타겟 / 스킬 주기**에 대응하는 추상화로만 쓴다.

# 부록 B — 우마무스메 / TFT 색채 제거 지침

## 우마무스메 색채를 줄인다
- 학원·아이돌·말귀 이미지를 신규 UI 중심에 두지 않는다
- 캐릭터 초상은 **출주 등록 화면에만** 크게 쓴다
- 화려한 스킬 컷인 카드 대신 **기수 작전 지시서**
- 일본어는 레이스 고유명과 짧은 경마 용어까지만
- 장식용 별·하트·리본 금지
- GⅠ 표시는 **단순 타이포 + 원형 badge**. 실존 로고 복제 금지

## TFT 색채를 줄인다
- hextech 프레임 금지
- 증강체 카드 3장 배치와 **다른 구성**(정보판/출마표)
- rarity 표기 없음 (Silver/Gold/Prismatic 없음)
- 1골드 반복 리롤 없음
- 유닛 조기 영구 귀속 없음
- 2-1 / 3-2 / 4-2 증강 타이밍과 겹치지 않음
- **개인화 근거를 화면에 드러낸다** — TFT는 하지 않는 것

# 부록 C — Codex 원샷 명령 요약

```text
이 명세를 끝까지 읽은 뒤 작업을 시작한다.

eukusak/UmafightTactics 최신 main에서 레이스 플랜 / GⅠ 출주 시스템 전체를 구현한다.
브랜치는 지정된 개발 브랜치를 사용한다.

UmaRogue는 적성·affinity·레이스 템플릿·시그니처 데이터의 출처로만 쓴다.
필요한 데이터는 전부 빌드 시점에 UmafightTactics로 스냅샷한다.
런타임에 외부 저장소나 API를 호출하지 않는다.

반드시 지킬 것
· 이미 vendor된 src/data/source/horse-game-db.json 을 쓴다 (신규 임포트 스크립트 금지)
· horseId 조인은 145/145 정확 일치다. 실패하면 빌드를 세운다
· 적성은 등급 문자가 아니라 로스터 퍼센타일로 가중한다
· 레이스 페이즈는 절대 초가 아니라 raceProgress(시간, 전멸비율)로 판정한다
· 모든 노드에 역할 가드(MELEE/RANGED/ANY)를 선언하고 하드 필터로 쓴다
· server/rooms.ts 의 privateMatch 와 setDeadline 을 반드시 수정한다
· Math.random 금지. Rng.forStream 만 쓴다
· 적성을 자격 조건으로 쓰지 않는다
· GⅠ 출주 등록 전에 유닛에 귀속시키지 않는다
· 4/5코가 이 시스템으로 자동 우위를 갖지 않게 한다
· 8명에게 같은 3장을 주지 않는다
· GAME_VERSION / SAVE_KEY / ROSTER_HASH 를 바꾸지 않는다
· 기존 테스트를 삭제하거나 skip 하지 않는다

아트
· SVG 아이콘 21종은 React 컴포넌트로 직접 만든다
· PNG 7종은 명시된 규격(1920×1080 / 960×180 / 1920×192)으로 만들고
  art-manifest.json 에 등록한다
· 래스터 생성이 불가능하면 CSS/Graphics 폴백을 완성하고
  docs/ART_REQUEST_RACE_PLAN.md 를 만든다. 기능 UI는 절대 생략하지 않는다

검증
npm run verify 가 통과할 때까지 고친다.
simulate 500매치에서 라스트3F 도달률 80% 이상, Stage 4-5 도달률 95% 이상을 확인한다.
완료 후 §33 형식으로 보고한다.
```

---

# 부록 D — v1.0 대비 변경 요약 (한 줄)

```text
데이터    이미 vendor된 파일을 쓴다. 임포트 스크립트·alias 파일 삭제. race-templates만 추가 vendor.
적성      등급 문자 → 로스터 퍼센타일. 잔디 A가 91%라서 등급으로는 아무것도 구분 안 됨.
페이즈    절대 초 → raceProgress(시간, 전멸비율). 전투의 82.6%가 30초 전에 끝나기 때문.
가드      역할 가드 신설. 원거리에게 이동 버프를 주는 TFT '눈알 광선' 사고 차단.
카테고리  승부수 9카테고리 도입 (TFT 이상현상 분류 차용). 3장 전부 다른 카테고리.
리롤      전체 교체 → 슬롯별 1회 (기존 증강과 동일 조작).
수명주기  판매/합성/벤치 규칙 신설. 1차 키를 instanceId → unitDefId.
네트워크  신규 메시지 11종 → commandSchema action 6종. privateMatch·setDeadline 수정 필수.
아트      webp/svg → PNG + art-manifest 등록 + 인라인 SVG 아이콘.
사운드    ogg 9종 → SOUND_DESIGNS 신스 9종 (파라미터 제공).
세이브    버전 올림 → optional 필드 + 백필. ROSTER_HASH 불변.
밸런스    '완성템 1.3개' → IE 환산표 + audit 스크립트로 자동 판정.
접근성    Stage 4-5 도달률 95% 목표 + HP≤20 조기 개방.
```
