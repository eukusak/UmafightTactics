# UmafightTactics

**우마무스메 팬메이드 오토배틀러** — 싱글플레이(1명 + AI 7)와 온라인 방 대전(최대 사람 8명)을 지원하는 전략 팀 전투 게임.

> ⚠️ **비공식 팬 제작물입니다.** Cygames / 《우마무스메 프리티 더비》와 아무 관련이 없으며,
> 공식 게임의 이미지·UI·음원·고유 스킬 텍스트를 일절 포함하지 않습니다.
> 등장 캐릭터는 실존 경주마의 **공개된 전적 데이터**를 기반으로 독자 재해석한 것입니다.

---

## 게임 소개

- 8인 로비: 싱글 1명 + AI 7 / 온라인 사람 8명 또는 사람 2~7명 + AI, 시작 체력 100
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

프로덕션 빌드를 로컬에서 확인하려면:

```bash
npm run build
npm start             # http://localhost:4173 (PORT 환경변수로 변경 가능)
```

### 온라인 방 대전

메인 메뉴 → 온라인 대전 → 새 방 → 코드 공유 → 8명 준비 → 방장 시작.
`npm run dev`와 `npm start`는 같은 주소의 `/multiplayer` WebSocket 서버를 함께 실행한다.
`npm run preview`·`npm run start:static`은 정적 미리보기이며 온라인 방 서버가 없다.
외부 접속에는 Node 웹 서비스와 WebSocket 프록시가 필요하다. [운영 안내](docs/ONLINE_MULTIPLAYER.md).

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

### 캐릭터 레퍼런스 이미지 (`public/assets/characters/race/`)

이 디렉터리의 캐릭터 레퍼런스 이미지는 공개 UmaRefs 페이지(`https://umarefs.crd.co/`)에서
자동 워크플로(`.github/workflows/sync-umarefs*.yml`, `tools/sync_umarefs*.py`)로 동기화된다.

- 원본 파일명을 보존한다 (예: `SpecialWeek-Race.png`).
- `manifest.json`이 캐릭터↔파일 매핑, 원본 링크, 크기, 용량, SHA-256을 기록한다.
- UmaRefs에서 incomplete로 표시된 항목은 다운로드를 강제하지 않고 매니페스트에만 남긴다.
- NPC/승부복 레퍼런스는 이 세트에서 의도적으로 제외한다.

> **게임이 직접 로드하는 자산이 아니다.** 게임은 `art-manifest.json`이 정의하는 경로
> (`portraits/`, `characters/<unitId>.png` 등)만 읽는다. 레이스 이미지는 도트 아트 제작 시
> **참고용 레퍼런스**이며, 그대로 게임에 넣지 않는다.
>
> UmaRefs는 Cygames와 무관하다고 명시하고 있으며, 이 저장소 역시 제3자 레퍼런스 아트/자산의
> 권리를 주장하지 않는다. 재배포·공개 전에 해당 권리와 허가 범위를 반드시 확인할 것.

---

## Render 배포

이 게임은 **정적 SPA**입니다. 서버 런타임이 필요 없습니다.

### 권장: Static Site

Render 대시보드에서 **New → Blueprint**로 저장소를 연결하면 루트의 `render.yaml`을 그대로 사용합니다.

```yaml
runtime: static
buildCommand: npm ci && npm run build
staticPublishPath: ./dist
```

SPA fallback(`/* → /index.html`), `/assets/*` 장기 캐시 헤더, `NODE_VERSION=22`가 함께 설정됩니다.

> **`render.yaml`은 Blueprint로 만든 서비스에만 적용됩니다.**
> 대시보드에서 손으로 만든 서비스는 이 파일을 무시하고 대시보드 설정을 씁니다.
> Node 프로젝트의 기본값은 `yarn`(설치만) + `yarn start`라서, 빌드가 일어나지 않고
> `start` 스크립트도 없어 `Command "start" not found`로 실패합니다.

이미 손으로 만든 서비스가 있다면 **Settings**에서 다음으로 맞추세요.

| 항목 | 값 |
|---|---|
| Service Type | Static Site |
| Build Command | `npm ci && npm run build` |
| Publish Directory | `dist` |
| Rewrite Rule | `/*` → `/index.html` (Action: Rewrite) |

### 대안: Node Web Service

정적 사이트로 못 바꾸는 상황이면 Web Service로도 뜹니다.

| 항목 | 값 |
|---|---|
| Build Command | `npm ci && npm run build` |
| Start Command | `npm start` |

`npm start`는 `scripts/serve.mjs`(외부 의존성 없음)를 실행해 `dist/`를 `0.0.0.0:$PORT`로 서빙합니다.
SPA fallback, gzip, 해시 자산 immutable 캐시, 경로 탈출 차단이 들어 있습니다.

빌드 커맨드가 설치만 하는 기본값(`yarn`)이어도, 설치 중 `scripts/render-postinstall.mjs`가
빌드를 대신 수행하므로 서비스가 뜹니다.

### 런타임 인스턴스는 빌드하지 않는다

`serve.mjs`는 **빌드를 시도하지 않고**, `dist/`가 없으면 안내 메시지와 함께 즉시 종료합니다.

이 빌드는 힙이 **약 500MB** 필요한데 작은 런타임 인스턴스는 기본 힙이 **256MB 부근**입니다.
실제로 시작 시점에 빌드를 시도했더니 2분간 GC를 돌다
`Reached heap limit Allocation failed`로 죽으면서 서비스가 크래시 루프에 빠졌습니다.

그래서 빌드는 **메모리가 넉넉한 빌드 단계**에서만 수행합니다.

- `scripts/render-postinstall.mjs`가 `RENDER` 환경변수가 있을 때만, 그리고 `dist/`가 없을 때만 빌드합니다.
  로컬 `npm ci`에는 아무 영향이 없습니다.
- 빌드 시 `NODE_OPTIONS`에 `--max-old-space-size=1024`를 덧붙입니다. 상한을 **올리기만** 하므로
  큰 빌드 머신의 기본값을 낮추지 않습니다.

검증: 부모 힙을 256MB로 묶은 상태에서 상향 없이는 `exit 134 / heap out of memory`,
상향 후에는 13초 만에 정상 빌드됩니다.

### Node 버전

`.node-version`이 **22**로 고정되어 있습니다. Render는 `.node-version`을 `package.json`의
`engines`보다 우선하므로, `engines: ">=22"`가 최신 메이저(26 등)를 끌어오는 일을 막습니다.
프로젝트가 검증된 버전은 Node 22 LTS입니다.

### 배포 빌드에 `verify`를 쓰지 않는 이유

명세 §39는 `buildCommand: npm ci && npm run verify`를 제시하지만, `verify`에는 테스트와
250매치 시뮬레이션이 포함되어 배포마다 수 분이 걸리고 실패 지점이 늘어납니다.
생성 데이터는 저장소에 커밋되어 있으므로 배포에는 `npm run build`로 충분합니다.
전체 게이트는 **`.github/workflows/verify.yml`** 에서 push/PR마다 실행됩니다
(데이터 재생성 후 diff 검사 · typecheck · lint · 테스트 · 시뮬레이션 · 빌드 · 서버 기동 확인).

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
- `public/assets/characters/race/`의 레퍼런스 이미지는 제3자(UmaRefs) 자산이며 이 저장소가 권리를 주장하지 않습니다.
- 본 프로젝트는 비영리 팬 제작물이며 상업적 이용을 의도하지 않습니다.
