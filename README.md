# UmafightTactics

**우마무스메 팬메이드 오토배틀러** — 플레이어 1명 + AI 7명이 겨루는 8인 전략 팀 전투 게임.

> ⚠️ **비공식 팬 제작물입니다.** Cygames / 《우마무스메 프리티 더비》와 아무 관련이 없으며,
> 공식 게임의 이미지·UI·음원·고유 스킬 텍스트를 일절 포함하지 않습니다.
> 등장 캐릭터는 실존 경주마의 **공개된 전적 데이터**를 기반으로 독자 재해석한 것입니다.

---

## 게임 소개

- 8인 로비(플레이어 1 + AI 7), 시작 체력 100
- 스테이지 1(PvE 3라운드) → 스테이지 2 이후 7라운드 구성(PvP × 5, 트윙클 드래프트, PvE)
- 상점 5칸 · 2골드 리롤 · 상점 잠금 · 4골드 경험치 구매 · 레벨 1~10
- 공유 유닛 풀(코스트별 22 / 20 / 17 / 10 / 9장)
- 1성 → 2성 → 3성 자동 합성(총 9장)
- 재료 10종 + 조합 결과 55종 = **아이템 65종**, 유닛당 최대 3슬롯
- **특성 24종**(각질 / 거리·주로 / 역사·세대), 인자·서포트 카드로 만드는 엠블럼 16종
- **증강체 48종**(Silver / Gold / Prism)
- 헥스 보드 7 × 8, 30초 전투 + 15초 오버타임
- 도감: **전체 145명**(표준 매치에는 Season 1 활성 60명만 등장)
- 저장/이어하기, 관전, 결정론적 시드 재현

### 조작

| 입력 | 동작 |
|---|---|
| 좌클릭 | 선택 / 배치(클릭 후 헥스 클릭) |
| 드래그 | 유닛·아이템 이동 |
| 우클릭 | 유닛 상세 정보 |
| `D` | 상점 새로고침 |
| `F` | 경험치 구매 |
| `1` / `3` | 이전 / 다음 플레이어 관전 |
| `Esc` | 설정 |

키 바인딩은 설정 화면에서 변경할 수 있습니다.

---

## 실행

Node.js **22 LTS** 필요.

```bash
npm ci
npm run sync:data     # UmaRogue 원본 데이터 vendor
npm run data:build    # 로스터/특성/아이템/증강/아트 매니페스트 생성
npm run dev           # http://localhost:5173
```

`sync:data`와 `data:build`의 산출물은 저장소에 커밋되어 있으므로,
그냥 실행만 할 거라면 `npm ci && npm run dev`로 충분합니다.

### 개발자 모드

```text
http://localhost:5173/?dev=1
```

골드/경험치/체력 조작, 재료 아이템 지급, 유닛 검색 생성, 다음 라운드 강제 진행,
전투 속도 1× / 2× / 4× / 10×, 시드·로스터 해시·풀 잔량 표시, 세이브 JSON 다운로드를 지원합니다.

---

## 검증

```bash
npm run typecheck                  # TypeScript 오류 0
npm test                           # 단위/통합 테스트
npm run simulate -- --matches 1000 # headless 밸런스 시뮬레이션
npm run simulate -- --matches 5000 --report   # docs/BALANCE.md 갱신
npm run check:art                  # 아트 납품 현황 리포트
STRICT_ART=1 npm run check:art     # 전체 납품 검수(누락 시 실패)
npm run build
npm run verify                     # 위 전체를 순서대로 실행
```

`npm run verify`는 `sync:data → data:build → data:validate → typecheck → test →
simulate(250) → check:art → build` 순으로 실행합니다.

---

## 데이터 출처

캐릭터 데이터는 **[eukusak/UmaRogue](https://github.com/eukusak/UmaRogue)** 저장소
브랜치 `pr0`의 `data/horse-game-db.json`(331두)에서 가져옵니다.
그 중 `priority == "P0"`인 **145두**가 이 게임의 전체 캐릭터 풀입니다.

- 5스탯과 `powerIndex`는 실제 전적 feature를 전체/세대 percentile로 변환한 값입니다.
- UmaRogue의 `tier` / `starterCost`는 **이 게임의 코스트 산정에 사용하지 않습니다.**
  UmafightTactics는 145명 내부에서 `uftRating`을 다시 계산해 코스트를 정합니다.
- 런타임에는 외부 API를 호출하지 않습니다. 빌드 시 vendor한 정적 JSON만 읽습니다.

파생 규칙, 이름 표기 정합(81건), 명세 캐릭터 목록 수정(3건)에 대한 자세한 내용은
**[docs/DATA_NOTES.md](docs/DATA_NOTES.md)** 를 참고하세요.

### 데이터 업데이트

```bash
npm run sync:data && npm run data:build && npm run data:validate && npm test
```

`data:build`는 `rosterHash`를 새로 계산합니다. 해시가 바뀌면 기존 세이브는 이어할 수 없습니다.

---

## 아트 넣는 법

게임은 **아트가 하나도 없어도 처음부터 끝까지 플레이할 수 있습니다.**
누락된 자산은 절차적 fallback(코스트 색 원형 + 이름 첫 글자, 아이템 약어 타일 등)으로 대체되고,
누락 키는 콘솔에 한 번씩만 기록됩니다.

PNG를 넣을 위치는 `src/data/generated/art-manifest.json`이 정의합니다.

```text
public/assets/
├─ portraits/<unitId>.png          256×256   RGBA
├─ characters/<unitId>.png         1280×768  RGBA (128×128 셀, 10열×6행)
├─ characters/cutin/<unitId>.png   960×540   RGBA (S1 5코 8명)
├─ items/components/<itemId>.png   96×96     RGBA
├─ items/complete/<itemId>.png     96×96     RGBA
├─ traits/<traitId>.png            96×96     RGBA
├─ augments/<augmentId>.png        96×96     RGBA
├─ status/<name>.png               96×96     RGBA
├─ vfx/<vfxKey>.png                1920×192  RGBA (192×192 셀 10프레임)
├─ pve/<enemyId>.png               1280×512  RGBA
├─ boards/<name>.png               1920×1080 불투명
└─ ui/{board_hex_tiles,ui_frames,ui_slots}.png
```

`unitId`는 영문 소문자 snake_case입니다(`특별 위크` → `special_week`).
정확한 파일명 목록은 매니페스트에서 확인하세요.

```bash
npm run check:art                # 누락 현황을 P0/P1로 나눠 리포트
STRICT_ART=1 npm run check:art   # 규격·알파·크기까지 전수 검사
```

디자인팀 발주 사양은 **[docs/ART_REQUEST.md](docs/ART_REQUEST.md)** 에 있습니다.

---

## Render 배포

저장소 루트의 `render.yaml`이 정적 사이트 배포를 정의합니다.

```yaml
buildCommand: npm ci && npm run verify
staticPublishPath: ./dist
```

SPA fallback(`/* → /index.html`)과 `/assets/*` 장기 캐시 헤더가 함께 설정되어 있습니다.
Render 대시보드에서 **New → Blueprint**로 저장소를 연결하면 `render.yaml`을 그대로 사용합니다.

---

## 문서

| 문서 | 내용 |
|---|---|
| [docs/CODEX_SPEC.md](docs/CODEX_SPEC.md) | 원본 구현 명세 v1.0 |
| [docs/ART_REQUEST.md](docs/ART_REQUEST.md) | 디자인팀 / 이미지 생성 AI 발주서 |
| [docs/DATA_NOTES.md](docs/DATA_NOTES.md) | 데이터 출처·파생 규칙·명세 정합 기록 |
| [docs/BALANCE.md](docs/BALANCE.md) | 시뮬레이션 밸런스 리포트(자동 생성) |

---

## 구조

```text
src/
├─ game/engine/     순수 TypeScript 게임 엔진 (Phaser·DOM 비의존)
│  ├─ rng/          xorshift32 시드 PRNG, 스트림 분리
│  ├─ battle/       고정 50ms 타임스텝 전투, 헥스, 이펙트 시스템
│  ├─ rounds/       RoundDirector 상태 머신, PvE, 드래프트, 매칭
│  ├─ ai/           7종 AI 성향, 구매 점수, 배치 탐색
│  └─ …             pool / shop / economy / items / traits / augments / save
├─ game/phaser/     보드 렌더러 + 절차적 fallback 아트
├─ components/      React HUD·화면
├─ store/           Zustand (엔진 ↔ React 유일한 다리)
└─ data/            source(vendor) / generated(커밋됨) / manual(수기 오버라이드)
```

설계 원칙:

- 모든 난수는 시드 기반 `Rng`를 통과합니다. `Math.random()`은 ESLint 규칙으로 금지합니다.
- 게임 로직은 Phaser/DOM과 분리된 순수 TypeScript입니다. 렌더러는 상태를 읽기만 합니다.
- 아이템·특성·증강·스킬은 모두 `EffectDef` 데이터로 표현되고 **하나의 EffectSystem**이 해석합니다.
  전투 엔진에는 itemId/skillId별 분기가 없습니다.
- 상태 전이는 `RoundDirector` 한 곳에서만 일어나므로 UI·AI·시뮬레이터가 동일한 매치를 재현합니다.

---

## 라이선스 / 자산 주의

- 코드는 이 저장소의 라이선스를 따릅니다.
- **공식 우마무스메 / TFT의 이미지·UI·스프라이트·음원을 저장소에 포함하지 마세요.**
  발주 아트는 공식 자산을 트레이싱하지 않은 독자 제작물이어야 합니다.
- 실존 경주마의 전적 데이터는 공개 기록에 기반합니다.
- 본 프로젝트는 비영리 팬 제작물이며 상업적 이용을 의도하지 않습니다.
