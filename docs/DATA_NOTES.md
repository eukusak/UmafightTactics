# DATA_NOTES — 데이터 출처와 파생 규칙

이 문서는 `src/data/generated/` 아래 JSON이 **어떤 원본에서 어떤 규칙으로** 만들어지는지,
그리고 원본과 명세가 어긋난 지점을 어떻게 처리했는지 기록한다.

---

## 1. 원본 데이터

| 파일 | 출처 | 비고 |
|---|---|---|
| `src/data/source/horse-game-db.json` | `eukusak/UmaRogue` 브랜치 `pr0` · `data/horse-game-db.json` | 331두 |
| `src/data/source/horse-game-db.validation.json` | 같은 저장소 `data/horse-game-db.validation.json` | 검증 결과 |
| `src/data/source/source.lock.json` | `npm run sync:data`가 생성 | SHA-256 잠금 |

`npm run sync:data`는 다음 순서로 원본을 확보한다.

1. `https://raw.githubusercontent.com/eukusak/UmaRogue/pr0/data/…` 다운로드
2. 실패하면 로컬 클론 미러(`/home/user/umarogue/data` 또는 저장소 옆의 `../umarogue/data`)
3. 그것도 없으면 이미 vendor된 파일 — 단 `source.lock.json`의 SHA-256이 일치할 때만

> **UmaRogue 저장소는 private이므로 raw URL은 인증 없이 404를 반환한다.**
> vendor된 사본을 저장소에 커밋해 두었기 때문에 `npm ci && npm run verify`는
> 네트워크 없이도 통과한다.

동기화 후 아래를 모두 만족하지 않으면 빌드가 실패한다.

```text
horses == 331
validation.horseCount == 331
validation.p0Count == 145
missingStats == 0
duplicateIds == 0
priority == "P0" 인 말 == 145
```

**런타임(브라우저)은 외부 URL을 절대 호출하지 않는다.** 동기화는 빌드 단계 전용이다.

---

## 2. 로스터 정합 — 명세 v1.0의 캐릭터 목록 3건 수정

명세 §6의 canonical 145명 목록과 원본 DB의 `priority == "P0"` 145두를 대조한 결과
**142명은 일치**했고 3건이 어긋났다.

| 명세 v1.0 표기 | 원본 DB 상태 | 조치 |
|---|---|---|
| 몬쥬 | **어떤 priority로도 DB에 존재하지 않음** | 베르시나(Verxina)로 대체 |
| 딥 임팩트 | `P1-SEED`로만 존재 (`H-2002100816`) | 맨하탄 카페(Manhattan Cafe)로 대체 |
| 킹 카메하메하 | `P1-SEED`로만 존재 (`H-2001103460`) | 에스포와르 시티(Espoir City)로 대체 |

판단 근거:

- **딥 임팩트**와 **킹 카메하메하**는 씨수말이며 《우마무스메 프리티 더비》의 등장 캐릭터가 아니다.
  원본 DB에서도 P0(캐릭터 후보군)이 아니라 P1-SEED(혈통/시드용)로 분류되어 있다.
- **몬쥬**는 원본 DB에 어떤 형태로도 존재하지 않는다.
- 반대로 원본 P0에는 **맨하탄 카페 / 에스포와르 시티 / 베르시나**가 들어 있는데,
  셋 모두 실제 게임의 플레이어블 우마무스메다.

즉 원본 DB의 P0 집합이 "우마무스메 캐릭터 145명"의 정의로 더 정확하며,
명세의 canonical 목록 쪽에 오기가 있었다고 판단했다.

교체 내역은 `src/data/manual/canonical-roster.json`의 `replacedFromSpecV1` 필드에
사유와 함께 남아 있다. 되돌리려면 그 파일만 수정하면 된다.

### 2.1 이름 표기 정합 (81건)

원본 DB의 `nameKo` 중 81개는 일본어 가타카나를 그대로 음차한 표기다
(예: `타마모쿠로스`, `에루콘도르파사`, `우오드카`).
게임 UI에는 한국에서 통용되는 표기를 쓰기 위해 **명시적 별칭 표를** 둔다.

```text
src/data/manual/name-aliases.json   # 81건, canonicalNameKo → horseId
```

각 항목은 `canonicalNameKo` / `horseId` / `sourceNameKo` / `nameJa` / `nameEn`을 모두 기록한다.
빌드 시 별칭이 가리키는 말의 `nameKo`가 기록과 다르면 **에러로 중단**한다(원본이 바뀐 신호).

명세 §6이 금지한 "fuzzy matching으로 조용히 통과"는 하지 않는다.
매칭 순서는 **정확 일치 → 공백/중점/장음 정규화 → 명시적 별칭**이며, 그래도 실패하면 빌드 실패다.

---

## 3. 파생 규칙 요약

### 3.1 `uftRating`

명세 §7.3의 식을 그대로 사용한다. percentile은 **145명 내부**에서 다시 계산한다.

- `earnings`는 현재 원본에 결측이므로 `earningsBonus = 0`.
- `winScore` / `top3Score`는 명세가 "사용 가능한 feature"로 열거하지만
  확정 점수식(`recordCore`)이 소비하지 않으므로 계산하지 않는다.
- `iconicBonus`는 5개 조건 × 0.25, 최대 1.0으로 **자동 산출**한다. 수동 감성 보정은 없다.

### 3.2 UmaRogue 레거시 필드

`tier` / `starterCost` / `marketValue` / `maintenance`는 **코스트 산정에 사용하지 않는다**(명세 §7.1).
`source.legacyTier` / `source.legacyStarterCost`에 참고용으로만 보존하며 툴팁에도 노출하지 않는다.
`tests/data.test.ts`가 코스트와 레거시 값이 일치하지 않음을 검사한다.

### 3.3 Season 1 활성 60명

명세 §7.4 그대로 상위 36명 고정 + 다양성 greedy 24명 + 제약 만족 스왑.

**추가한 규칙 — 소프트 상한:** 명세는 최소 커버리지만 규정한다.
그런데 원본 데이터는 중거리(145명 중 56명)와 도주 쪽으로 크게 치우쳐 있어,
최소 조건만 적용하면 활성 60명 중 중거리가 26명이 되고 시뮬레이션에서
중거리 특성의 top1 점유율이 40%까지 올라갔다(경고선 25%).

그래서 다양성 점수에 상한 페널티를 추가했다.

```text
MAX_STYLE = 18   (최소 8)
MAX_DISTANCE = 14 (최소 7)
MAX_DIRT = 12    (최소 6)
```

결과: 활성 60명의 거리/주로 분포가 `중거리 15 / 마일러 14 / 스테이어 14 / 스프린터 8 / 더트 8 / 올라운더 1`,
각질 분포가 `도주 18 / 선행 18 / 선입 16 / 추입 8`이 되었고 25% 경고선을 넘는 특성이 사라졌다.

최소 커버리지(하드 플로어)는 여전히 **0이 아니면 빌드 실패**다.

### 3.4 자동 판정할 수 없는 역사 사실

원본 DB는 경주별 기록 없이 `gradeWins` 집계와 `mainWin` 문자열 하나만 갖는다.
따라서 **삼관 / 해외 G1**은 데이터에서 유도할 수 없다.
추정 대신 명시적 목록을 둔다.

```text
src/data/manual/legacy-tags.json
  tripleCrown        8건 (클래식 삼관 3 + 암말 삼관 5)
  internationalG1   11건
  famousHouseGroups 12개 관명(冠名) 그룹
```

`queen` / `emperor` / `golden_generation` / `era_star`는 명세 §11.3이 요구한 대로
`src/data/manual/trait-overrides.json`에 사유와 함께 수동 지정한다.

`emperor`는 고유 특성이므로 보유자가 2명 이상이면 `uftRating` 상위 1명만 남기고
나머지는 자동 강등되며, 그 사실을 빌드 로그에 남긴다.

### 3.5 유닛 ID

`nameEn`을 ASCII snake_case로 정규화해 사용한다(`Tamamo Cross` → `tamamo_cross`).
아트 파일명이 이 ID를 그대로 쓰므로 한글/공백은 들어가지 않는다(발주서 §20).
충돌 시 `_2` 접미사를 붙이며, 검증 스크립트가 `^[a-z0-9_]+$`를 강제한다.

---

## 4. 데이터 갱신 절차

```bash
npm run sync:data      # 원본 재-vendor (+ SHA 잠금 갱신)
npm run data:build     # 생성 JSON 재작성
npm run data:validate  # 카운트/스키마 검증
npm test               # 회귀 검사
```

`data:build`는 `rosterHash`를 새로 계산한다. 해시가 바뀌면 **기존 세이브는 이어할 수 없다**
(`parseSave`가 `ROSTER_MISMATCH`로 거부). 로스터를 바꾼 릴리스는 세이브 호환이 깨진다는 뜻이므로
버전 노트에 반드시 남길 것.

생성된 JSON은 **저장소에 커밋**한다. 한 버전 안에서 로스터가 절대 변하지 않아야 하기 때문이다(명세 §1 규칙 5).
