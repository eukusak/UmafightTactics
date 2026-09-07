# UmafightTactics — 디자인팀 / 이미지 생성 AI 전체 발주서 v1.1

> **2026-09-07 사용자 지시 우선 적용:** 아래 도트 스타일 지시는 [새 아트 방향과 실제 납품 현황](ART_DIRECTION_2026.md)으로 대체한다. 매끈한 셀 셰이딩·Live2D 느낌의 2.5D 표현을 목표로 하며, 파일/격자 규격은 유지한다. 현재 납품 규격 통과는 **216/514**, 캐릭터 자산 298개는 미완료다. 아래의 PRODUCTION READY는 발주서의 과거 상태이며 전체 이미지 제작 완료를 뜻하지 않는다.

> **상태:** PRODUCTION READY / 구현 완료본 기준으로 갱신됨  
> **기준 화면:** 1920×1080 (최소 지원 1366×768까지 비율 축소)  
> **게임:** 우마무스메 팬메이드 오토배틀러 (비공식 2차 창작)  
> **스타일:** 휴대용 몬스터 배틀 RPG를 연상시키는 선명한 2D 도트 + 경마장/트레이닝 센터 테마  
> **중요:** 공식 우마무스메/TFT 스프라이트를 복사하지 않고, 캐릭터 특징만 식별 가능한 독자 도트 아트로 재해석한다.  
> **납품 원칙:** 게임이 좌표로 자동 슬라이스하므로 아래 셀 크기/행/열/파일명을 절대 변경하지 않는다.

---

## v1.0 대비 변경 요약

이 문서는 게임 구현이 끝난 뒤 **실제 빌드 산출물(`src/data/generated/art-manifest.json`)에서 자동 생성**되었다.
v1.0 발주서 대비 달라진 점은 다음과 같다.

| # | 변경 | 이유 |
|---|---|---|
| 1 | **캐릭터 3명 교체** (몬쥬 → 베르시나, 딥 임팩트 → 맨하탄 카페, 킹 카메하메하 → 에스포와르 시티) | 딥 임팩트/킹 카메하메하는 씨수말로 우마무스메 등장 캐릭터가 아니며, 몬쥬는 원본 DB에 존재하지 않음. 상세는 `docs/DATA_NOTES.md` §2 |
| 2 | **모든 파일명(`unitId`) 확정 및 명기** | v1.0은 `<unitId>.png`라고만 표기해 실제 파일명을 알 수 없었음. §3에 145명 전원의 확정 파일명 수록 |
| 3 | **5코 컷인 8명 실명 확정** | v1.0은 "`cost==5` 8명"이라고만 지정. §6에 확정 명단 수록 |
| 4 | **증강 아이콘 48종에 실제 시각 키워드 부여** | v1.0은 48개 전부 "…을 직관적으로 상징하는 단순 도트 심볼"이라는 동일 문구여서 작업 지시로 쓸 수 없었음 |
| 5 | **P0/P1 우선순위를 실명 목록으로 확정** | `activeS1=true` 60명이 확정되어 배치 작업 순서를 실제 명단으로 대체 |
| 6 | **자동 검수 규격을 코드와 1:1로 명시** | `npm run check:art`가 실제로 검사하는 항목(크기·알파 채널·PNG 헤더)을 §22에 명문화 |
| 7 | **UI 상태 사양 추가** | 구현된 실제 UI 상태(선택 하이라이트, 특성 활성/비활성, 관전 행, 드래프트 페데스털 등)를 §17에 추가 |
| 8 | **엠블럼 보유 특성 16종 구분 명시** | 24개 특성 중 엠블럼 아이템이 존재하는 16종만 아이템 아이콘이 함께 필요 |
| 9 | **fallback 아트 레퍼런스 추가** | 아트 미납품 상태에서 게임이 쓰는 절차적 플레이스홀더를 §23에 도해 — 실루엣/가독성 기준선 |

---

# 0. 발주 총량

## 0.1 캐릭터

- 전체 캐릭터: **145명**
- 초상화: **145장** (256×256)
- 전투 스프라이트시트: **145장** (1280×768)
- 전투 애니메이션 실제 프레임: **캐릭터당 50프레임**
- 전체 캐릭터 전투 프레임: **7250프레임**
- Season 1 활성 캐릭터: **60명** (`activeS1=true`)
- Season 1 5코 컷인: **8장** (`cutinRequired=true`)

## 0.2 시스템 자산

- 아이템 아이콘: **65개** (재료 10 + 조합 결과 55)
- 특성 아이콘: **24개**
- 증강 아이콘: **48개**
- 상태/전투 UI 아이콘: **24개**
- 공통 VFX: **24종 × 10프레임 = 240프레임**
- 별 합성 대형 VFX: **3종 × 12프레임 = 36프레임**
- 전투 보드/배경: **8장**
- PvE 적 스프라이트시트: **5장**
- UI 9-slice/버튼/슬롯 시트: **1세트**
- 결과/라운드 배너: **12종**

> **총 납품 PNG 파일 수: 514개** — `npm run check:art`가 검사하는 전체 항목 수와 동일하다.

---

# 1. 스타일 가이드

## 1.1 시각 방향

한 문장:

> **"경마장과 트레이닝 센터를 무대로 한 2D 휴대용 RPG식 도트 오토배틀러."**

필수:

- 굵고 선명한 픽셀
- 실제 플레이 크기에서 실루엣 즉시 식별
- SD/치비 비율
- 머리/귀/헤어색/대표 액세서리로 캐릭터 구분
- 과도한 세밀 묘사보다 강한 실루엣
- 현대 고해상도 화면에서 nearest-neighbor 2×/3× 확대에 견딜 것

금지:

- 공식 게임 스프라이트 직접 트레이싱
- 공식 UI 프레임 복제
- 실사/반실사
- 안티에일리어싱
- 가장자리 흰 halo
- 이미지 안에 텍스트
- 워터마크
- 캐릭터 아래 자동 그림자
- 바닥 반사
- PNG 내부 가이드선
- 셀 경계선

## 1.2 투명 PNG

캐릭터/아이콘/VFX:

- PNG-32 RGBA
- 배경 알파 0
- 외곽 halo 없음
- 그림자 필요한 경우 별도 VFX 레이어로 제공

배경/보드(`boards/`):

- 불투명 PNG
- **`check:art`에서 알파 채널을 요구하지 않는 유일한 카테고리다.**

## 1.3 픽셀 규칙

- 기본 외곽선: 2px
- 대형 캐릭터 외곽 핵심부: 최대 3px
- 1px 반투명 안티에일리어싱 금지
- 그라데이션 대신 4~6단 색 램프
- 광원 VFX만 알파 허용
- 확대 방식: nearest neighbor

---

# 2. 마스터 팔레트

아래 값은 **게임 CSS(`src/styles/global.css`)에 실제로 들어간 토큰과 동일하다.**
UI 위에 올라가는 아이콘은 이 팔레트 안에서 대비를 확보해야 한다.

UI:

| 토큰 | 값 | 용도 |
|---|---|---|
| BG | `#0B1018` | 최하단 배경 |
| Panel | `#182331` | 패널 바탕 |
| PanelBright | `#24384A` | 버튼/슬롯 바탕 |
| EdgeDark | `#05080C` | 외곽 그림자 |
| EdgeLight | `#7EA7B5` | 기본 테두리 |
| Text | `#EDF5F1` | 본문 |
| Muted | `#91A8A6` | 보조 텍스트 |
| Gold | `#FFCC33` | 강조/골드/승리 |
| Success | `#7DFF8A` | 아군 체력/성공 |
| Danger | `#FF5A4D` | 적 체력/패배 |
| Cyan | `#4FE3FF` | 마나/선택 |
| Violet | `#B98AE0` | 증강/상태 |

코스트 프레임 (게임이 유닛 토큰 테두리에 그대로 사용):

| 코스트 | 값 |
|---|---|
| 1코 | `#8FA3AD` 회청색 |
| 2코 | `#5BD07A` 녹색 |
| 3코 | `#4FA8FF` 청색 |
| 4코 | `#B98AE0` 보라 |
| 5코 | `#FFCC33` 금색 |

각질 VFX:

| 각질 | 색 | 형태 |
|---|---|---|
| 도주 `nige` | `#FF6A3D` 주홍 | 직선형 |
| 선행 `senko` | `#FFCC33` 황금 | 평행선 |
| 선입 `sashi` | `#4FE3FF` 청색 | 쐐기 |
| 추입 `oikomi` | `#B98AE0` 보라 | arc |

**색만으로 의미를 전달하지 않는다. 아이콘 형태도 반드시 다르게 한다.**

---

# 3. 캐릭터 전체 목록 145명 — 확정 파일명

`unitId`는 영문명을 소문자 snake_case로 정규화한 값이며 **파일명에 그대로 쓴다.**
아래 표가 유일한 정본이다. 임의로 변형하지 않는다.

- 초상화: `public/assets/portraits/<unitId>.png`
- 전투 시트: `public/assets/characters/<unitId>.png`
- 컷인(해당 8명): `public/assets/characters/cutin/<unitId>.png`

## 3.1 P0 — Season 1 활성 60명 (최우선)

상점에 등장하는 캐릭터. **이 60명이 없으면 실제 대전 화면이 비어 보인다.**

| # | 이름 | `unitId` | 코스트 | 역할 | 컷인 |
|---:|---|---|---:|---|:---:|
| 1 | 다이와 스칼렛 | `daiwa_scarlet` | 5코 | 스킬 캐리 | **O** |
| 2 | 마루젠스키 | `maruzensky` | 5코 | 서포터 | **O** |
| 3 | 미호노 부르봉 | `mihono_bourbon` | 5코 | 스킬 캐리 | **O** |
| 4 | 스페셜 위크 | `special_week` | 5코 | 물리 캐리 | **O** |
| 5 | 아몬드 아이 | `almond_eye` | 5코 | 물리 캐리 | **O** |
| 6 | 키타산 블랙 | `kitasan_black` | 5코 | 탱커 | **O** |
| 7 | 타이키 셔틀 | `taiki_shuttle` | 5코 | 스킬 캐리 | **O** |
| 8 | 티엠 오페라 오 | `tm_opera_o` | 5코 | 탱커 | **O** |
| 9 | 그란 알레그리아 | `gran_alegria` | 4코 | 물리 캐리 |  |
| 10 | 부에나 비스타 | `buena_vista` | 4코 | 물리 캐리 |  |
| 11 | 비와 하야히데 | `biwa_hayahide` | 4코 | 스킬 캐리 |  |
| 12 | 스마트 팔콘 | `smart_falcon` | 4코 | 스킬 캐리 |  |
| 13 | 심볼리 루돌프 | `symboli_rudolf` | 4코 | 탱커 |  |
| 14 | 심볼리 크리스 에스 | `symboli_kris_s` | 4코 | 브루저 |  |
| 15 | 아그네스 타키온 | `agnes_tachyon` | 4코 | 물리 캐리 |  |
| 16 | 오구리 캡 | `oguri_cap` | 4코 | 스킬 캐리 |  |
| 17 | 오르페브르 | `orfevre` | 4코 | 물리 캐리 |  |
| 18 | 크로노 제네시스 | `chrono_genesis` | 4코 | 브루저 |  |
| 19 | 후지 키세키 | `fuji_kiseki` | 4코 | 스킬 캐리 |  |
| 20 | 그래스 원더 | `grass_wonder` | 3코 | 물리 캐리 |  |
| 21 | 나리타 브라이언 | `narita_brian` | 3코 | 물리 캐리 |  |
| 22 | 노스 플라이트 | `north_flight` | 3코 | 물리 캐리 |  |
| 23 | 메지로 맥퀸 | `mejiro_mcqueen` | 3코 | 탱커 |  |
| 24 | 보드카 | `vodka` | 3코 | 물리 캐리 |  |
| 25 | 슈퍼 크릭 | `super_creek` | 3코 | 탱커 |  |
| 26 | 에스포와르 시티 | `espoir_city` | 3코 | 서포터 |  |
| 27 | 엘 콘도르 파사 | `el_condor_pasa` | 3코 | 서포터 |  |
| 28 | 젠틸돈나 | `gentildonna` | 3코 | 탱커 |  |
| 29 | 코파노 리키 | `copano_rickey` | 3코 | 물리 캐리 |  |
| 30 | 타마모 크로스 | `tamamo_cross` | 3코 | 브루저 |  |
| 31 | 포에버 영 | `forever_young` | 3코 | 스킬 캐리 |  |
| 32 | 홋코 타루마에 | `hokko_tarumae` | 3코 | 스킬 캐리 |  |
| 33 | 골드 쉽 | `gold_ship` | 2코 | 브루저 |  |
| 34 | 니시노 플라워 | `nishino_flower` | 2코 | 물리 캐리 |  |
| 35 | 두라멘테 | `duramente` | 2코 | 브루저 |  |
| 36 | 뒤랑달 | `durandal` | 2코 | 물리 캐리 |  |
| 37 | 라인 크라프트 | `rhein_kraft` | 2코 | 서포터 |  |
| 38 | 럭키 라일락 | `lucky_lilac` | 2코 | 스킬 캐리 |  |
| 39 | 메지로 라모누 | `mejiro_ramonu` | 2코 | 브루저 |  |
| 40 | 메지로 브라이트 | `mejiro_bright` | 2코 | 탱커 |  |
| 41 | 버블검 펠로 | `bubble_gum_fellow` | 2코 | 물리 캐리 |  |
| 42 | 사쿠라 로렐 | `sakura_laurel` | 2코 | 탱커 |  |
| 43 | 사토노 다이아몬드 | `satono_diamond` | 2코 | 탱커 |  |
| 44 | 아그네스 디지털 | `agnes_digital` | 2코 | 물리 캐리 |  |
| 45 | 원더 어큐트 | `wonder_acute` | 2코 | 서포터 |  |
| 46 | 카렌짱 | `curren_chan` | 2코 | 스킬 캐리 |  |
| 47 | 나이스 네이처 | `nice_nature` | 1코 | 서포터 |  |
| 48 | 다이이치 루비 | `daiichi_ruby` | 1코 | 물리 캐리 |  |
| 49 | 드림 저니 | `dream_journey` | 1코 | 물리 캐리 |  |
| 50 | 마르슈 로렌 | `marche_lorraine` | 1코 | 서포터 |  |
| 51 | 맨하탄 카페 | `manhattan_cafe` | 1코 | 브루저 |  |
| 52 | 뱀부 메모리 | `bamboo_memory` | 1코 | 서포터 |  |
| 53 | 비코 페가수스 | `biko_pegasus` | 1코 | 서포터 |  |
| 54 | 사쿠라 치토세 오 | `sakura_chitose_o` | 1코 | 서포터 |  |
| 55 | 사토노 크라운 | `satono_crown` | 1코 | 물리 캐리 |  |
| 56 | 슈발 그랑 | `cheval_grand` | 1코 | 탱커 |  |
| 57 | 스틸 인 러브 | `still_in_love` | 1코 | 브루저 |  |
| 58 | 시킹 더 펄 | `seeking_the_pearl` | 1코 | 물리 캐리 |  |
| 59 | 어드마이어 그루브 | `admire_groove` | 1코 | 물리 캐리 |  |
| 60 | 제뉴인 | `genuine` | 1코 | 물리 캐리 |  |

## 3.2 P1 — 도감 전용 85명

표준 상점에는 등장하지 않지만 **도감 화면에 초상화와 전투 시트가 모두 표시된다.**
컷인은 필요 없다.

| # | 이름 | `unitId` | 표시 코스트 | 역할 |
|---:|---|---|---:|---|
| 1 | 골드 시티 | `gold_city` | 1코 | 서포터 |
| 2 | 나리타 타이신 | `narita_taishin` | 1코 | 브루저 |
| 3 | 나리타 탑 로드 | `narita_top_road` | 2코 | 탱커 |
| 4 | 나카야마 페스타 | `nakayama_festa` | 1코 | 서포터 |
| 5 | 네오 유니버스 | `neo_universe` | 2코 | 브루저 |
| 6 | 노 리즌 | `no_reason` | 1코 | 서포터 |
| 7 | 다이타쿠 헬리오스 | `daitaku_helios` | 2코 | 서포터 |
| 8 | 단츠 플레임 | `dantsu_flame` | 1코 | 서포터 |
| 9 | 데어링 택트 | `daring_tact` | 3코 | 브루저 |
| 10 | 데어링 하트 | `daring_heart` | 1코 | 서포터 |
| 11 | 라이스 샤워 | `rice_shower` | 2코 | 탱커 |
| 12 | 러브즈 온리 유 | `loves_only_you` | 1코 | 탱커 |
| 13 | 레드 디자이어 | `red_desire` | 1코 | 탱커 |
| 14 | 로고타입 | `logotype` | 2코 | 서포터 |
| 15 | 로이스 앤 로이스 | `royce_and_royce` | 1코 | 서포터 |
| 16 | 로즈 킹덤 | `rose_kingdom` | 1코 | 브루저 |
| 17 | 룰러쉽 | `rulership` | 2코 | 탱커 |
| 18 | 마블러스 선데이 | `marvelous_sunday` | 3코 | 탱커 |
| 19 | 마야노 탑건 | `mayano_top_gun` | 4코 | 탱커 |
| 20 | 마치카네 탄호이저 | `matikanetannhauser` | 1코 | 서포터 |
| 21 | 마치카네 후쿠키타루 | `matikanefukukitaru` | 1코 | 서포터 |
| 22 | 메이쇼 도토 | `meisho_doto` | 3코 | 탱커 |
| 23 | 메지로 도베르 | `mejiro_dober` | 3코 | 물리 캐리 |
| 24 | 메지로 라이언 | `mejiro_ryan` | 2코 | 브루저 |
| 25 | 메지로 아르당 | `mejiro_ardan` | 1코 | 서포터 |
| 26 | 메지로 파머 | `mejiro_palmer` | 1코 | 서포터 |
| 27 | 미스터 시비 | `mr_cb` | 1코 | 탱커 |
| 28 | 베르시나 | `verxina` | 1코 | 스킬 캐리 |
| 29 | 블래스트 원피스 | `blast_onepiece` | 1코 | 물리 캐리 |
| 30 | 비블로스 | `vivlos` | 1코 | 물리 캐리 |
| 31 | 빅투아르 피사 | `victoire_pisa` | 3코 | 브루저 |
| 32 | 빌리브 | `believe` | 2코 | 스킬 캐리 |
| 33 | 사운즈 오브 어스 | `sounds_of_earth` | 1코 | 서포터 |
| 34 | 사일런스 스즈카 | `silence_suzuka` | 2코 | 스킬 캐리 |
| 35 | 사쿠라 바쿠신 오 | `sakura_bakushin_o` | 2코 | 서포터 |
| 36 | 사쿠라 치요노 오 | `sakura_chiyono_o` | 2코 | 브루저 |
| 37 | 삼손 빅 | `samson_big` | 1코 | 서포터 |
| 38 | 세이운 스카이 | `seiun_sky` | 2코 | 탱커 |
| 39 | 세자리오 | `cesario` | 3코 | 탱커 |
| 40 | 스윕 토쇼 | `sweep_tosho` | 2코 | 물리 캐리 |
| 41 | 스테이 골드 | `stay_gold` | 1코 | 탱커 |
| 42 | 시리우스 심볼리 | `sirius_symboli` | 1코 | 서포터 |
| 43 | 신코 윈디 | `shinko_windy` | 1코 | 서포터 |
| 44 | 아이네스 후진 | `ines_fujin` | 2코 | 탱커 |
| 45 | 애스턴 마짱 | `aston_machan` | 1코 | 스킬 캐리 |
| 46 | 야마닌 제퍼 | `yamanin_zephyr` | 3코 | 서포터 |
| 47 | 야에노 무테키 | `yaeno_muteki` | 2코 | 서포터 |
| 48 | 어드마이어 베가 | `admire_vega` | 1코 | 브루저 |
| 49 | 에어 그루브 | `air_groove` | 3코 | 탱커 |
| 50 | 에어 메사이어 | `air_messiah` | 2코 | 서포터 |
| 51 | 에어 샤커 | `air_shakur` | 1코 | 서포터 |
| 52 | 에이신 플래시 | `eishin_flash` | 2코 | 탱커 |
| 53 | 에프포리아 | `efforia` | 3코 | 브루저 |
| 54 | 에피파네이아 | `epiphaneia` | 3코 | 탱커 |
| 55 | 위닝 티켓 | `winning_ticket` | 1코 | 브루저 |
| 56 | 윈 바리아시옹 | `win_variation` | 1코 | 탱커 |
| 57 | 유키노 비진 | `yukino_bijin` | 1코 | 서포터 |
| 58 | 이나리 원 | `inari_one` | 1코 | 브루저 |
| 59 | 이쿠노 딕터스 | `ikuno_dictus` | 1코 | 서포터 |
| 60 | 정글 포켓 | `jungle_pocket` | 2코 | 탱커 |
| 61 | 젠노 롭 로이 | `zenno_rob_roy` | 4코 | 탱커 |
| 62 | 츠루마루 츠요시 | `tsurumaru_tsuyoshi` | 1코 | 서포터 |
| 63 | 카렌 부케도르 | `curren_bouquetdor` | 1코 | 서포터 |
| 64 | 카와카미 프린세스 | `kawakami_princess` | 1코 | 스킬 캐리 |
| 65 | 카츠라기 에이스 | `katsuragi_ace` | 1코 | 탱커 |
| 66 | 칼스톤 라이트 오 | `calstone_light_o` | 1코 | 서포터 |
| 67 | 케이에스 미라클 | `ks_miracle` | 1코 | 서포터 |
| 68 | 키세키 | `kiseki` | 1코 | 서포터 |
| 69 | 킹 헤일로 | `king_halo` | 1코 | 서포터 |
| 70 | 타니노 김렛 | `tanino_gimlet` | 3코 | 서포터 |
| 71 | 타이틀홀더 | `titleholder` | 3코 | 탱커 |
| 72 | 탭 댄스 시티 | `tap_dance_city` | 2코 | 탱커 |
| 73 | 토센 조던 | `tosen_jordan` | 1코 | 탱커 |
| 74 | 토카이 테이오 | `tokai_teio` | 4코 | 물리 캐리 |
| 75 | 트랜센드 | `transcend` | 3코 | 스킬 캐리 |
| 76 | 트윈 터보 | `twin_turbo` | 1코 | 서포터 |
| 77 | 파인 모션 | `fine_motion` | 2코 | 물리 캐리 |
| 78 | 팔레놉시스 | `phalaenopsis` | 2코 | 물리 캐리 |
| 79 | 페노메노 | `fenomeno` | 2코 | 브루저 |
| 80 | 푸리오소 | `furioso` | 3코 | 탱커 |
| 81 | 하루 우라라 | `haru_urara` | 1코 | 서포터 |
| 82 | 후사이치 판도라 | `fusaichi_pandora` | 1코 | 서포터 |
| 83 | 히시 미라클 | `hishi_miracle` | 1코 | 물리 캐리 |
| 84 | 히시 아마존 | `hishi_amazon` | 3코 | 서포터 |
| 85 | 히시 아케보노 | `hishi_akebono` | 1코 | 서포터 |

> 코스트는 실제 전적 기반으로 계산된 값이며 명단 순서와 무관하다.
> 로스터를 재생성하면 바뀔 수 있으므로 **작업 착수 시점의 `art-manifest.json`을 정본으로 삼는다.**

---

# 4. 캐릭터 초상화

## 4.1 파일

```text
public/assets/portraits/<unitId>.png
```

## 4.2 규격

- **256×256**
- PNG-32 RGBA / 투명 배경
- 얼굴~가슴 위주
- 머리 위 귀가 잘리지 않게 **12px 이상 여백**
- 캐릭터 시선: 화면 중앙/약간 우측
- 공식 카드 프레임을 그림에 포함하지 않음
- 코스트 테두리는 게임 UI가 별도로 그림 (§2 코스트 프레임 색 참조)

## 4.3 표현

- 캐릭터 고유 헤어색
- 귀
- 대표적인 리본/장식
- 승부복의 핵심 색 2~3색
- 과도한 액세서리 생략 가능
- **상점 카드(약 52×52 표시)에서도 누구인지 구분 가능해야 함**

---

# 5. 캐릭터 전투 스프라이트시트

## 5.1 파일

```text
public/assets/characters/<unitId>.png
```

## 5.2 셀/캔버스

- 셀: **128×128**
- 격자: **10열 × 6행**
- 캔버스: **1280×768**
- 실제 사용 프레임: 50
- 빈 셀: 완전 투명

## 5.3 행 정의

| Row | 애니메이션 | 프레임 | FPS | Loop |
|---:|---|---:|---:|:---:|
| 0 | idle | 6 | 8 | O |
| 1 | run | 8 | 12 | O |
| 2 | basic_attack | 8 | 14 | X |
| 3 | skill_cast | 10 | 15 | X |
| 4 col0~3 | hit | 4 | 12 | X |
| 4 col4~9 | ko | 6 | 10 | X |
| 5 col0~7 | victory | 8 | 10 | O |
| 5 col8~9 | blank | 0 | - | - |

## 5.4 방향

- 기본 3/4 측면
- **오른쪽을 바라보는 방향으로 통일**
- 왼쪽 이동/공격은 게임에서 horizontal flip
- 위/아래 방향 별도 제작하지 않음
- 이동 방향과 상관없이 run loop를 유지하며 타겟 방향만 flip

> 게임의 전투 보드는 홀수행 오프셋(odd-r) 헥스 그리드이며 8행을 두 진영이 반씩 쓴다.
> 유닛은 상대 진영을 향해 이동하므로, 좌우 flip만으로 모든 상황이 커버된다.

## 5.5 앵커

- 발 중심: 셀 `(64, 110)`
- 머리/귀 포함 최대 높이: y=8~112
- 이펙트 제외
- **모든 캐릭터의 발 anchor 동일**
- 장신/단신 차이는 최대 ±10px

## 5.6 애니메이션 키포즈

### idle 6
1. 기준 자세
2. 미세 호흡
3. 귀 움직임
4. 기준
5. 머리/리본 미세 움직임
6. 기준 복귀

### run 8
- 좌/우 발 교대가 분명할 것
- 머리/귀/머리카락 후행
- 마지막→첫 프레임 자연스럽게 연결

### basic_attack 8
1. 준비 / 2. 체중 이동 / 3. 공격 예비 / 4. contact 직전
5. **contact** / 6. follow-through / 7. 회수 / 8. idle 복귀

### skill_cast 10
- 1~3 준비 / 4~5 에너지 집중 / 6 **발동 핵심 포즈** / 7~9 후행 / 10 복귀

### hit 4
- 피격 방향 반대쪽으로 몸이 튐
- 과도한 넘어짐 금지

### ko 6
- 무릎/자세 붕괴
- 최종 프레임은 누워 있거나 힘이 빠진 상태
- **유혈 표현 없음**

### victory 8
- 밝고 명확한 승리 포즈
- 무한 루프 가능

---

# 6. 5코스트 컷인 — 확정 8명

```text
public/assets/characters/cutin/<unitId>.png
```

| # | 이름 | `unitId` |
|---:|---|---|
| 1 | 스페셜 위크 | `special_week` |
| 2 | 마루젠스키 | `maruzensky` |
| 3 | 다이와 스칼렛 | `daiwa_scarlet` |
| 4 | 타이키 셔틀 | `taiki_shuttle` |
| 5 | 티엠 오페라 오 | `tm_opera_o` |
| 6 | 미호노 부르봉 | `mihono_bourbon` |
| 7 | 키타산 블랙 | `kitasan_black` |
| 8 | 아몬드 아이 | `almond_eye` |

규격:

- **960×540**
- PNG-32 RGBA / 투명 배경
- 상반신/전신 혼합 가능
- **화면 오른쪽 60%에 캐릭터**
- **왼쪽 40%는 게임이 스킬명 텍스트를 올릴 공간으로 비움**
- 캐릭터/이펙트 외 배경 없음

---

# 7. 아이템 아이콘 65개

## 7.1 공통 규격

- 각 **96×96** PNG-32 RGBA
- 투명 배경
- 실제 UI에서는 34×34 (보관함) / 30×30 (드래프트) 크기로도 표시된다
- 아이콘 중앙 72×72 안에 핵심 형태
- 테두리 2px
- 텍스트 금지

## 7.2 재료 10개

```text
public/assets/items/components/<itemId>.png
```

| `itemId` | 이름 | 효과 | 시각 키워드 |
|---|---|---|---|
| `winner_ribbon` | **우승자 리본** | 공격력 +10% | B.F. 대검 계열 · 우승 리본 |
| `reinforced_horseshoe` | **강화 편자** | 방어력 +20 | 두껍게 덧댄 방어형 편자 |
| `training_belt` | **트레이닝 벨트** | 체력 +150 | 체력을 상징하는 훈련 벨트 |
| `tactics_notebook` | **작전 노트** | 주문력 +10 | 펼쳐진 작전 노트 |
| `spurt_band` | **스퍼트 밴드** | 공격속도 +10% | 손목에 감는 스퍼트 밴드 |
| `focus_drop` | **집중의 물방울** | 시작 마나 +15 | 집중을 상징하는 물방울 |
| `weather_cloak` | **비바람 망토** | 마법저항력 +20 | 비바람을 막는 망토 |
| `race_glove` | **레이스 글러브** | 치명타 확률 +20% | 치명타를 상징하는 레이스 글러브 |
| `factor_badge` | **인자 배지** | 능력치 없음. 특성 부여 재료. | 인자 배지 — 빈 방패 실루엣 |
| `support_card` | **서포트 카드** | 능력치 없음. 특성 부여 재료. | 서포트 카드 — 카드 뒷면 문양 |

## 7.3 조합 결과 55개

```text
public/assets/items/complete/<itemId>.png
```

| `itemId` | 이름 | 조합 | 효과 |
|---|---|---|---|
| `champion_trophy` | **챔피언 트로피** | 우승자 리본 + 우승자 리본 | 기본 공격력 합산 후 추가 공격력 +20%. |
| `twilight_racing_suit` | **황혼의 승부복** | 우승자 리본 + 강화 편자 | 체력이 처음 60% 아래로 내려가면 0.75초 대상 지정 불가, 이후 5초간 공격속도 +25%. 전투당 1회. |
| `unyielding_fighting_spirit` | **불굴의 승부근성** | 우승자 리본 + 트레이닝 벨트 | 체력이 처음 60% 아래로 내려가면 최대 체력 25% 보호막(5초)과 공격력 +20%. 전투당 1회. |
| `trainer_lifeblade` | **트레이너 생명검** | 우승자 리본 + 작전 노트 | 모든 피해 흡혈 20%. 회복량의 20%를 체력이 가장 낮은 아군에게 전달. |
| `giant_overtaker` | **거인 추월자** | 우승자 리본 + 스퍼트 밴드 | 피해량 +15%. 대상 최대 체력이 1600 이상이면 추가로 +25%. |
| `start_dash_plan` | **스타트 대시 작전** | 우승자 리본 + 집중의 물방울 | 기본 공격마다 추가 마나 +5. |
| `victory_bloodwind` | **우승의 혈풍** | 우승자 리본 + 비바람 망토 | 모든 피해 흡혈 20%. 체력이 처음 40% 아래로 내려가면 최대 체력 25% 보호막(5초). |
| `finish_line_strike` | **결승선의 일격** | 우승자 리본 + 레이스 글러브 | 치명타 피해 +35%. 스킬 치명타 가능. 100% 초과 치명타 확률 1%당 치명타 피해 +0.5%. |
| `iron_stable` | **철벽 마굿간** | 강화 편자 + 강화 편자 | 받는 치명타 피해 25% 감소. 기본 공격 피격 시 주변 1칸 적에게 60 마법피해(2초 재사용). |
| `heated_training_blanket` | **열혈 훈련 담요** | 강화 편자 + 트레이닝 벨트 | 2초마다 2칸 내 적 1명에게 10초 화상: 초당 최대 체력 1% 고정피해, 치유량 33% 감소. |
| `trainer_crownguard` | **트레이너 크라운가드** | 강화 편자 + 작전 노트 | 전투 시작 시 최대 체력 25% 보호막(8초). 보호막 종료 시 주문력 +20. |
| `iron_horseshoe_resolve` | **철편자의 결의** | 강화 편자 + 스퍼트 밴드 | 공격하거나 피해를 받으면 결의 1중첩(최대 25). 중첩당 공격력/주문력 +2%. 최대 중첩 시 방어력/마저 +20. |
| `pre_race_vow` | **출전 전 맹세** | 강화 편자 + 집중의 물방울 | 체력이 처음 40% 아래로 내려가면 최대 체력 25% 보호막(5초)과 방어력/마저 +20. 전투당 1회. |
| `racecourse_stoneplate` | **경주장 석갑** | 강화 편자 + 비바람 망토 | 자신을 공격 대상으로 삼은 적 1명당 방어력/마저 +10. |
| `steadfast_heart` | **굳건한 하트** | 강화 편자 + 레이스 글러브 | 받는 피해 8% 감소. 체력 50% 이상이면 15% 감소. |
| `long_distance_training_coat` | **장거리 훈련 코트** | 트레이닝 벨트 + 트레이닝 벨트 | 추가 체력 +600, 최대 체력 +12%. |
| `burning_spirit_strategy` | **타오르는 투지의 작전서** | 트레이닝 벨트 + 작전 노트 | 스킬 피해를 받은 적에게 10초 화상: 초당 최대 체력 1% 고정피해, 치유량 33% 감소. |
| `pace_up_snack` | **페이스 업 보급식** | 트레이닝 벨트 + 스퍼트 밴드 | 스킬 사용 후 5초간 공격속도 +40%. |
| `recovery_saddle` | **회복의 안장** | 트레이닝 벨트 + 집중의 물방울 | 받는 회복/보호막 +25%. 5초마다 최대 체력 2.5% 회복. |
| `evening_race_armor` | **야간 경주 갑주** | 트레이닝 벨트 + 비바람 망토 | 2칸 내 적의 방어력/마저 20% 감소. 전투 시작 후 10초간 최대 체력 +10%. |
| `frontline_retake_mallet` | **선두 탈환 메달** | 트레이닝 벨트 + 레이스 글러브 | 피해를 받거나 입히면 추월 중첩(최대 12). 중첩당 공격력/주문력 +1.5%. 최대 중첩 시 피해 증폭 +10%. |
| `genius_trainer_hat` | **천재 트레이너 모자** | 작전 노트 + 작전 노트 | 주문력 +50 추가, 스킬 피해 +10%. |
| `endless_spurt` | **끝없는 스퍼트** | 작전 노트 + 스퍼트 밴드 | 기본 공격 시 공격속도 +5% 누적(최대 12중첩). |
| `accumulated_fighting_spirit` | **축적된 투지** | 작전 노트 + 집중의 물방울 | 전투 시작 후 5초마다 주문력 +20. |
| `gate_shock_device` | **게이트 충격기** | 작전 노트 + 비바람 망토 | 2칸 내 적의 마저 30% 감소. 적이 스킬을 쓰면 최대 마나의 160% 마법피해(대상별 3초 재사용). |
| `jewel_race_glove` | **보석 레이스 글러브** | 작전 노트 + 레이스 글러브 | 스킬 치명타 가능. 치명타 피해 +20%, 주문력 +15 추가. |
| `red_turf_booster` | **레드 터프 부스터** | 스퍼트 밴드 + 스퍼트 밴드 | 공격속도 +35% 추가. 기본 공격이 5초간 화상을 남긴다. |
| `corner_piercer` | **코너 관통봉** | 스퍼트 밴드 + 집중의 물방울 | 기본 공격 후 대상 주변 1칸의 적 1명에게 45% 물리피해. 공격 시 마나 +2. |
| `breakaway_horseshoe` | **파죽지세 편자** | 스퍼트 밴드 + 비바람 망토 | 같은 대상을 3회 공격할 때마다 90 고정피해 + 대상 최대 체력 3% 고정피해. |
| `last_overtake` | **최후의 추월** | 스퍼트 밴드 + 레이스 글러브 | 물리 피해를 입히면 5초간 대상 방어력 30% 감소. 공격속도 +20% 추가. |
| `blue_focus` | **푸른 집중력** | 집중의 물방울 + 집중의 물방울 | 시작 마나 +25 추가. 스킬 사용 후 마나 10 회복. 최대 마나 60 이하면 추가로 10 회복. |
| `adaptive_headgear` | **적응형 헤드기어** | 집중의 물방울 + 비바람 망토 | 앞 2열이면 방어력/마저 +35, 뒤 2열이면 3초마다 마나 +10. |
| `hand_of_victory` | **승리의 손길** | 집중의 물방울 + 레이스 글러브 | 전투 시작 시 두 효과 중 1개를 2배로 적용. 체력 50% 아래에서는 두 효과 모두 적용. |
| `stormproof_racing_cloak` | **폭풍 방지 마의** | 비바람 망토 + 비바람 망토 | 마법저항력 +65 추가. 2초마다 최대 체력 2.5% 회복. |
| `composure_ribbon` | **평정의 리본** | 비바람 망토 + 레이스 글러브 | 전투 시작 후 18초간 군중제어 면역. 공격속도 +20% 추가. |
| `trick_strategy_gloves` | **변칙 작전 글러브** | 레이스 글러브 + 레이스 글러브 | 아이템 슬롯 3칸 사용. 매 준비 단계 종료 시 완성 아이템 2개를 무작위로 장착. |
| `emblem_nige` | **도주 인자** | 인자 배지 + 우승자 리본 | 도주 특성 +1. |
| `emblem_senko` | **선행 인자** | 인자 배지 + 강화 편자 | 선행 특성 +1. |
| `emblem_sashi` | **선입 인자** | 인자 배지 + 트레이닝 벨트 | 선입 특성 +1. |
| `emblem_oikomi` | **추입 인자** | 인자 배지 + 작전 노트 | 추입 특성 +1. |
| `emblem_sprinter` | **스프린터 인자** | 인자 배지 + 스퍼트 밴드 | 스프린터 특성 +1. |
| `emblem_miler` | **마일러 인자** | 인자 배지 + 집중의 물방울 | 마일러 특성 +1. |
| `emblem_middle` | **중거리 인자** | 인자 배지 + 비바람 망토 | 중거리 특성 +1. |
| `emblem_stayer` | **스테이어 인자** | 인자 배지 + 레이스 글러브 | 스테이어 특성 +1. |
| `emblem_golden_generation` | **황금세대 엠블럼** | 서포트 카드 + 우승자 리본 | 황금세대 특성 +1. |
| `emblem_famous_house` | **명가 엠블럼** | 서포트 카드 + 강화 편자 | 명가 특성 +1. |
| `emblem_dirt_champion` | **더트 챔피언 엠블럼** | 서포트 카드 + 트레이닝 벨트 | 더트 챔피언 특성 +1. |
| `emblem_international` | **국제파 엠블럼** | 서포트 카드 + 작전 노트 | 국제파 특성 +1. |
| `emblem_unbeaten` | **무패 전설 엠블럼** | 서포트 카드 + 스퍼트 밴드 | 무패 전설 특성 +1. |
| `emblem_comeback` | **역전극 엠블럼** | 서포트 카드 + 집중의 물방울 | 역전극 특성 +1. |
| `emblem_triple_crown` | **삼관 엠블럼** | 서포트 카드 + 비바람 망토 | 삼관 특성 +1. |
| `emblem_era_star` | **시대의 스타 엠블럼** | 서포트 카드 + 레이스 글러브 | 시대의 스타 특성 +1. |
| `trainer_crown` | **트레이너 왕관** | 인자 배지 + 인자 배지 | 전략가 전용. 팀 최대 규모 +1. 유닛에게 장착하지 않는다. |
| `trainer_cloak` | **트레이너 망토** | 인자 배지 + 서포트 카드 | 전략가 전용. 팀 최대 규모 +1. 전투 시작 시 아군 전체 이동속도 +10%(10초). |
| `trainer_shield` | **트레이너 방패** | 서포트 카드 + 서포트 카드 | 전략가 전용. 팀 최대 규모 +1. 플레이어가 받는 라운드 피해 10% 감소(최소 1). |

### 아이콘 디자인 규칙

- 조합 재료 2개의 형태/색을 어느 정도 계승
- 완성 아이템은 재료 아이콘 단순 합성처럼 보이지 않게 **하나의 물건으로 재해석**
- **인자/엠블럼 16개는 동일 방패 실루엣 + 중앙 문양 체계** (§8.2 목록 참조)
- 트레이너 왕관/망토/방패 3종은 금색 프레임으로 통일 (전략가 전용 슬롯에 별도 표시됨)
- `trick_strategy_gloves`(변칙 작전 글러브)는 랜덤성 표현(카드/주사위 느낌) 가능

> 게임은 아이템 첫 태그로 색을 입힌다: DAMAGE `#FF5A4D` / TANK `#7EA7B5` / MANA `#4FE3FF` /
> UTILITY `#B98AE0` / EMBLEM `#FFCC33` / TACTICIAN `#7DFF8A`. 아이콘 본체가 이 색에 묻히지 않게 한다.

---

# 8. 특성 아이콘 24개

## 8.1 규격

```text
public/assets/traits/<traitId>.png
```

- **96×96** PNG-32 RGBA / 투명
- 중앙 심볼
- 텍스트 없음
- **게임이 활성/비활성 상태를 색으로 덧입히므로 명암 분리가 분명해야 한다**
  (좌측 특성 패널에서 22×22 크기로도 표시됨)

| `traitId` | 이름 | 분류 | 단계 | 시각 키워드 | 엠블럼 |
|---|---|---|---|---|:---:|
| `nige` | 도주 | 각질 | 2/4/6 | 앞으로 뻗는 3줄 속도선 | **O** |
| `senko` | 선행 | 각질 | 2/4/6 | 평행한 황금 2줄 | **O** |
| `sashi` | 선입 | 각질 | 2/4/6 | 안쪽으로 파고드는 쐐기 | **O** |
| `oikomi` | 추입 | 각질 | 2/4/6 | 뒤에서 감싸는 반원 arc | **O** |
| `sprinter` | 스프린터 | 거리 | 2/4 | 짧은 번개 + 편자 | **O** |
| `miler` | 마일러 | 거리 | 2/4 | 중간 길이 트랙 표식 | **O** |
| `middle` | 중거리 | 거리 | 2/4 | 2중 타원 트랙 | **O** |
| `stayer` | 스테이어 | 거리 | 2/4 | 장거리 깃발 | **O** |
| `dirt_champion` | 더트 챔피언 | 주로 | 2/3/4 | 흙먼지 편자 | **O** |
| `all_rounder` | 올라운더 | 주로 | 2/3 | 잔디/더트 반반 편자 | — |
| `golden_generation` | 황금세대 | 역사 | 2/4/6 | 금빛 별 5개 | **O** |
| `famous_house` | 명가 | 역사 | 2/4 | 월계관 문장 | **O** |
| `international` | 국제파 | 역사 | 2/3/4 | 지구본 + 비행 궤적 | **O** |
| `unbeaten` | 무패 전설 | 역사 | 2/3 | 깨지지 않은 왕관 | **O** |
| `comeback` | 역전극 | 역사 | 2/4 | 아래→위 반전 화살표 | **O** |
| `triple_crown` | 삼관 | 역사 | 2/3 | 작은 왕관 3개 | **O** |
| `era_star` | 시대의 스타 | 역사 | 2/4/6 | 큰 별 + 후광 | **O** |
| `classic_legend` | 클래식 레전드 | 역사 | 2/4 | 오래된 트로피 | — |
| `heisei_dynasty` | 헤이세이 왕조 | 역사 | 2/4/6 | 리본 문장 | — |
| `reiwa_elite` | 레이와 엘리트 | 역사 | 2/4 | 현대적 육각 메달 | — |
| `queen` | 여왕 | 역사 | 2/3 | 티아라 | — |
| `emperor` | 황제 | 역사 | 1 | 제왕관 | — |
| `record_breaker` | 레코드 브레이커 | 역사 | 2/3 | 스톱워치 파손 | — |
| `iron_horse` | 철마 | 역사 | 2/4 | 철제 편자 | — |

## 8.2 엠블럼 아이템이 존재하는 특성 16종

아래 16개 특성만 **인자 배지/서포트 카드 조합으로 만들 수 있는 엠블럼 아이템**을 함께 갖는다.
특성 아이콘(96×96)과 엠블럼 아이템 아이콘(96×96)이 **각각 필요**하며,
엠블럼 쪽은 공통 방패 실루엣 안에 해당 특성의 심볼을 넣어 계열임이 드러나게 한다.

| 특성 | 특성 아이콘 | 엠블럼 아이템 아이콘 |
|---|---|---|
| 도주 | `traits/nige.png` | `items/complete/emblem_nige.png` |
| 선행 | `traits/senko.png` | `items/complete/emblem_senko.png` |
| 선입 | `traits/sashi.png` | `items/complete/emblem_sashi.png` |
| 추입 | `traits/oikomi.png` | `items/complete/emblem_oikomi.png` |
| 스프린터 | `traits/sprinter.png` | `items/complete/emblem_sprinter.png` |
| 마일러 | `traits/miler.png` | `items/complete/emblem_miler.png` |
| 중거리 | `traits/middle.png` | `items/complete/emblem_middle.png` |
| 스테이어 | `traits/stayer.png` | `items/complete/emblem_stayer.png` |
| 더트 챔피언 | `traits/dirt_champion.png` | `items/complete/emblem_dirt_champion.png` |
| 황금세대 | `traits/golden_generation.png` | `items/complete/emblem_golden_generation.png` |
| 명가 | `traits/famous_house.png` | `items/complete/emblem_famous_house.png` |
| 국제파 | `traits/international.png` | `items/complete/emblem_international.png` |
| 무패 전설 | `traits/unbeaten.png` | `items/complete/emblem_unbeaten.png` |
| 역전극 | `traits/comeback.png` | `items/complete/emblem_comeback.png` |
| 삼관 | `traits/triple_crown.png` | `items/complete/emblem_triple_crown.png` |
| 시대의 스타 | `traits/era_star.png` | `items/complete/emblem_era_star.png` |

나머지 8종(`all_rounder`, `classic_legend`, `heisei_dynasty`, `reiwa_elite`, `queen`, `emperor`,
`record_breaker`, `iron_horse`)은 특성 아이콘만 필요하다.

---

# 9. 증강 아이콘 48개

```text
public/assets/augments/<augmentId>.png
```

- **96×96** PNG-32 RGBA / 투명
- **Silver / Gold / Prism 프레임은 게임이 씌우므로 아이콘 본체는 등급색에 의존하지 않는다**
- 등급은 형태가 아니라 프레임으로만 구분된다 — 같은 등급 안에서도 서로 헷갈리지 않게 한다

> **v1.0에서 바뀐 부분:** 기존 발주서는 48개 전부 "…을 직관적으로 상징하는 단순 도트 심볼"이라는
> 동일한 문구여서 실제 작업 지시로 쓸 수 없었다. 아래는 효과를 읽고 구체화한 시각 키워드다.

## 9.1 Silver 16종

| `augmentId` | 이름 | 효과 | 시각 키워드 |
|---|---|---|---|
| `economy_interest_seed` | **저축의 미학** | 최대 이자 +1. 즉시 5골드. | 금화 더미 위에 돋아난 새싹 하나. 저축이 자란다는 뜻. |
| `economy_free_refresh` | **가벼운 재편** | 매 라운드 첫 상점 새로고침 무료. | 한 바퀴 도는 화살표 + 우측 상단에 작은 "무료" 대신 끊긴 가격표 아이콘. |
| `economy_sell_back` | **깔끔한 정리** | 2·3성 판매 손실이 추가로 1골드 감소. | 깔끔하게 접힌 마의(馬衣)와 그 위에 놓인 동전 1개. |
| `shop_low_cost` | **기초 훈련 집중** | 1·2코 상점 등장 후 해당 코스트 내 중복 유닛 가중치 +8%. | 낮은 허들 2개를 나란히 넘는 발굽 실루엣. 기초 훈련. |
| `trait_nige` | **도주의 기본** | 도주 유닛 공격속도 +8%. 도주 유닛 1명 획득. | 앞으로 뻗는 3줄 속도선 + 작은 은색 방패 테두리. |
| `trait_senko` | **선행의 기본** | 선행 유닛 최대 체력 +6%. 선행 유닛 1명 획득. | 황금 평행 2줄 + 작은 은색 방패 테두리. |
| `trait_sashi` | **선입의 기본** | 선입 유닛 치명타 +8%. 선입 유닛 1명 획득. | 안쪽으로 파고드는 청색 쐐기 + 작은 은색 방패 테두리. |
| `trait_oikomi` | **추입의 기본** | 추입 유닛 처형 기준 체력 50%→55%. 추입 유닛 1명 획득. | 뒤에서 감싸는 보라 반원 arc + 작은 은색 방패 테두리. |
| `item_component_choice` | **트레이닝 보급** | 재료 아이템 선택 모루 1개. | 뚜껑 열린 보급 상자에서 재료 아이콘 실루엣 3개가 떠오름. |
| `item_remove` | **장비 점검** | 아이템 제거기 2개. | 장비를 집어 올리는 집게(핀셋) + 떨어져 나온 나사 1개. |
| `combat_front_guard` | **초반 버티기** | 앞 2열 유닛 방어력/마저 +8. | 지면에 박힌 직사각 방패 2개가 앞줄을 이룸. |
| `combat_back_focus` | **후열 집중** | 뒤 2열 유닛 시작 마나 +5. | 뒤쪽에 놓인 물방울 3개가 위로 상승. 후열 마나. |
| `bench_expand` | **넓은 마방** | 벤치 +1칸. | 마굿간 문 3칸 중 오른쪽 1칸이 새로 열림. |
| `xp_small` | **집중 육성** | 즉시 경험치 8. | 위를 향한 화살표가 관통하는 작은 책 1권. |
| `healing_small` | **컨디션 관리** | 아군 모든 회복/보호막 +8%. | 체온계 대신 편자 모양 안에 든 십자 회복 심볼. |
| `crit_small` | **승부 감각** | 아군 치명타 확률 +5%. | 조준선 안에 든 작은 별. 승부 감각. |

## 9.2 Gold 16종

| `augmentId` | 이름 | 효과 | 시각 키워드 |
|---|---|---|---|
| `economy_rich` | **대형 스폰서** | 즉시 18골드. 이후 기본 라운드 수입 -1. | 큰 금화 주머니 + 리본이 달린 스폰서 명패. |
| `economy_streak` | **연승의 박자** | 연승/연패 보너스 골드 구간을 1연속 앞당김. | 연속으로 이어지는 발굽 자국 3개 위에 박자 점 3개. |
| `shop_pair_hunter` | **쌍둥이 훈련** | 상점에 보유 유닛과 동일 유닛이 등장할 상대 가중치 +15%. | 거울처럼 마주 본 동일 실루엣 2개. |
| `reroll_credit` | **리롤 크레딧** | 라운드마다 리롤 2회까지 비용 1골드. | 회전 화살표 안에 든 동전 1개(값이 깎였다는 표시로 반쪽만 채워짐). |
| `trait_distance_flex` | **거리 적성 확장** | 스프린터/마일러/중거리/스테이어 중 현재 가장 높은 특성 +1. | 길이가 서로 다른 트랙 표식 4개가 하나로 합쳐지는 형태. |
| `trait_surface_flex` | **주로 적응** | 더트 챔피언 또는 올라운더 중 현재 더 높은 특성 +1. | 잔디와 흙이 반반으로 나뉜 원형 주로 단면. |
| `trait_legacy_flex` | **명예의 혈통** | 황금세대/명가/국제파/삼관 중 무작위 엠블럼 1개. | 월계관 안에서 무작위로 회전하는 문장 3종 실루엣. |
| `item_complete_anvil` | **완성 장비 보급** | 완성 아이템 선택 모루 1개. | 모루 위에 놓인 완성 장비 1점 + 망치. |
| `item_reforge` | **장비 재조정** | 재조합기 2개. | 반으로 갈라졌다 다시 붙는 장비 실루엣 + 회전 화살표. |
| `combat_first_cast` | **선수필승** | 아군 첫 스킬 피해 +25%. | 가장 먼저 터지는 섬광 1발 + 그 뒤로 흐릿한 잔상 2발. |
| `combat_last_stand` | **마지막 직선** | 체력 30% 아래 아군 피해 증폭 +20%. | 결승선 직선 구간과 그 위를 달리는 낮은 체력 게이지. |
| `combat_adjacent` | **페이스메이커** | 전투 시작 시 인접 아군 2명 이상인 유닛 방어력/마저 +15. | 앞서 달리는 실루엣과 그 옆에 붙은 동료 실루엣(페이스메이커). |
| `combat_isolated` | **단독 질주** | 전투 시작 시 인접 아군이 없는 유닛 공격력/주문력 +18%. | 넓은 트랙 위 단 하나의 실루엣과 길게 늘어진 속도선. |
| `clone_low` | **육성 복제권** | 1~3코 유닛 복제기 1개. | 유닛 카드 1장에서 반투명 복제본이 갈라져 나옴. |
| `level_cap_speed` | **조기 승급** | 다음 레벨업에 필요한 경험치 12 감소(최소 0). | 계단 3칸 중 한 칸을 건너뛰는 위쪽 화살표. |
| `player_damage_guard` | **안전한 운영** | 플레이어가 받는 전투 피해 2 감소(최소 1). | 트레이너 방패 앞면에 부딪혀 튕겨 나가는 충격파. |

## 9.3 Prism 16종

| `augmentId` | 이름 | 효과 | 시각 키워드 |
|---|---|---|---|
| `economy_windfall` | **대박 스폰서 계약** | 즉시 40골드. 최대 이자 +2. | 터지듯 쏟아지는 금화 분수 + 대형 계약서 도장. |
| `shop_high_cost` | **스타 발굴** | 4·5코 상점 등장 확률을 레벨별 총 +5%p, 1코부터 비례 차감. | 스포트라이트가 비추는 무대 위 별 하나. |
| `shop_extra_slot` | **확장 스카우팅** | 상점 슬롯 5→6칸. | 상점 카드 5장 옆에 빛나며 추가되는 6번째 카드. |
| `team_size` | **특별 출전권** | 팀 최대 규모 +1. | 출전 게이트가 하나 더 열리며 나오는 특별 출전 티켓. |
| `trait_any_emblem` | **궁극의 인자** | 원하는 제작 가능 특성 엠블럼 1개 선택. | 가운데가 비어 있는 인자 방패 + 그 위를 채우는 프리즘 빛. |
| `trait_double` | **이중 적성** | 선택한 유닛 1명에게 보조 특성 +1 부여. 같은 유닛 1회. | 하나의 실루엣에 겹쳐진 서로 다른 특성 심볼 2개. |
| `item_radiant` | **찬란한 레이스 장비** | 찬란한 완성 아이템 선택 모루 1개(효과 ×1.5). | 완성 장비 1점에서 사방으로 뻗는 찬란한 광선. |
| `item_crown` | **왕관의 자격** | 트레이너 왕관 1개. | 금색 트레이너 왕관 정면. |
| `combat_all_stats` | **완성형 육성** | 아군 공격력/주문력/방어력/마저 +12%, 공격속도 +12%. | 5방향으로 균등하게 뻗은 스탯 오각형이 가득 찬 형태. |
| `combat_execute` | **결승선 집념** | 아군이 체력 12% 미만 적을 즉시 처치. | 결승선 테이프를 끊는 순간의 가슴 실루엣 + 낙하하는 체력 조각. |
| `combat_revive` | **기적의 복귀** | 각 유닛이 처음 사망할 때 1.5초 후 체력 25%로 부활. | 쓰러진 실루엣 위로 떠오르는 빛의 편자. |
| `combat_mana` | **완벽한 작전** | 모든 아군 시작 마나 +20, 최대 마나 -10(최소 30). | 완벽하게 채워진 마나 게이지 + 축소된 게이지 테두리. |
| `clone_any` | **전설의 복제권** | 모든 코스트 유닛 복제기 1개. | 전설급 카드에서 갈라져 나오는 프리즘 복제본. |
| `level_10` | **엘리트 트레이너** | 즉시 경험치 36. 10레벨 상점에서 5코 등장확률 +5%p. | 10이 새겨진 트레이너 배지 + 상승 화살표. |
| `bench_dual` | **대형 트레이닝 센터** | 벤치 +2칸, 아이템 보관함 +2칸. | 2층 구조로 확장된 대형 마굿간 정면. |
| `overtime_master` | **장기전의 제왕** | 전투 15초 후 아군 공격력/주문력 +25%, 받는 피해 15% 감소. | 스톱워치 바늘이 한계를 넘어 두 바퀴째 도는 형태. |

---

# 10. 공통 VFX 24종

```text
public/assets/vfx/<vfxKey>.png
```

모든 VFX:

- 셀 **192×192**
- **10열 × 1행**
- 캔버스 **1920×192**
- 10프레임 / 15fps
- 투명 PNG
- 파일 1개 = VFX 1종

| # | `vfxKey` | 용도 |
|---:|---|---|
| 1 | `vfx_hit_physical` | 기본 공격 피격 |
| 2 | `vfx_hit_magic` | 마법 피해 피격 |
| 3 | `vfx_crit` | 치명타 |
| 4 | `vfx_heal` | 회복 · HEAL_BUFF 스킬 |
| 5 | `vfx_shield` | 보호막 · SHIELD_TAUNT 스킬 |
| 6 | `vfx_burn` | 화상 상태 |
| 7 | `vfx_stun` | 기절 · CONTROL 스킬 |
| 8 | `vfx_silence` | 침묵 상태 |
| 9 | `vfx_taunt` | 도발 상태 |
| 10 | `vfx_dash_nige` | 도주 유닛 돌진 스킬 |
| 11 | `vfx_dash_senko` | 선행 유닛 돌진 스킬 |
| 12 | `vfx_dash_sashi` | 선입 유닛 돌진 스킬 |
| 13 | `vfx_dash_oikomi` | 추입 유닛 돌진 스킬 |
| 14 | `vfx_line_red` | DASH_LINE 템플릿 기본 |
| 15 | `vfx_cone_gold` | CONE 템플릿 |
| 16 | `vfx_wedge_cyan` | 쐐기형 범위 표시 |
| 17 | `vfx_arc_violet` | BACKLINE_DIVE 템플릿 |
| 18 | `vfx_aoe_burst` | AOE_BURST 템플릿 · PvE 적 반격 |
| 19 | `vfx_projectile` | MULTI_SHOT 템플릿 |
| 20 | `vfx_execute` | SINGLE_EXECUTE 템플릿 · 처형 |
| 21 | `vfx_buff` | AURA/SUMMON 템플릿 · 버프 |
| 22 | `vfx_debuff` | 디버프 부여 |
| 23 | `vfx_mana` | RAMP 템플릿 · 마나 회복 |
| 24 | `vfx_item_equip` | 아이템 장착 연출 |

### 키프레임 강도

| 프레임 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 강도 | 0~10% | 20% | 40% | 70% | **100%** | 90% | 65% | 40% | 20% | 0~5% |

---

# 11. 별 합성 VFX 3종

| `vfxKey` | 트리거 |
|---|---|
| `vfx_star_2` | 1성 3개 → 2성 합성 |
| `vfx_star_3` | 2성 3개 → 3성 합성 |
| `vfx_cost5_star3` | 5코스트 3성 완성 |

규격:

- 셀 **256×256** / 12프레임 / **6열 × 2행** / 캔버스 **1536×512**
- 15fps / 투명

> 5코 3성은 시뮬레이션상 20매치당 0~1회 수준의 최상위 연출이다.
> 가장 화려하되 **화면 전체를 흰색으로 덮지 않는다.**

---

# 12. 상태/전투 UI 아이콘 24개

```text
public/assets/status/<name>.png
```

96×96 PNG-32 RGBA 투명.

| # | 파일 | 용도 |
|---:|---|---|
| 1 | `stun.png` | 기절 — 행동 불가 |
| 2 | `silence.png` | 침묵 — 스킬 사용 불가 |
| 3 | `taunt.png` | 도발 — 대상 강제 |
| 4 | `burn.png` | 화상 — 초당 최대 체력 비례 고정피해 |
| 5 | `wound.png` | 상처 — 회복량 33% 감소 |
| 6 | `shield.png` | 보호막 |
| 7 | `heal_up.png` | 회복량 증가 |
| 8 | `damage_up.png` | 피해 증폭 |
| 9 | `damage_down.png` | 피해 감소 |
| 10 | `armor_up.png` | 방어력 증가 |
| 11 | `armor_down.png` | 방어력 감소 |
| 12 | `mr_up.png` | 마저 증가 |
| 13 | `mr_down.png` | 마저 감소 |
| 14 | `attack_speed_up.png` | 공격속도 증가 |
| 15 | `attack_speed_down.png` | 공격속도 감소 |
| 16 | `mana_lock.png` | 마나 잠금 — 스킬 직후 1초 |
| 17 | `untargetable.png` | 대상 지정 불가 |
| 18 | `revive.png` | 부활 대기 |
| 19 | `overtime.png` | 오버타임 진입 |
| 20 | `win_streak.png` | 연승 |
| 21 | `lose_streak.png` | 연패 |
| 22 | `shop_lock.png` | 상점 잠금 |
| 23 | `reroll.png` | 상점 새로고침 |
| 24 | `xp.png` | 경험치 구매 |

---

# 13. 전투 보드/배경 8장

```text
public/assets/boards/<name>.png
```

## 공통

- **1920×1080**
- **불투명** (알파 채널 불필요 — 유일한 예외 카테고리)
- UI가 올라갈 자리 고려
- **보드 타일은 게임이 별도 overlay로 그리므로 배경에 hex 경계선을 박지 않는다**

| 파일 | 내용 | UI 고려사항 |
|---|---|---|
| `bg_title.png` | 트레센풍 학원/경마장 입구 · 아침 | 중앙 로고 공간 |
| `bg_main_menu.png` | 트레이닝 센터 | 중앙 세로 메뉴 버튼 340px 폭 |
| `bg_board_turf_day.png` | 잔디 경기장 낮 | 중앙 1320×658 필드 영역 |
| `bg_board_turf_night.png` | 야간 조명 경마장 | 동일 |
| `bg_board_dirt.png` | 더트 경기장 | 동일 |
| `bg_twinkle_draft.png` | 원형 패독/드래프트 트랙 | 9개 페데스털이 3×3으로 올라감 |
| `bg_pve_training.png` | 훈련장 | 동일 |
| `bg_final_result.png` | 시상대/트로피 배경 | 중앙 620px 폭 순위표 |

> 실제 화면 레이아웃: 상단 HUD 72px / 좌 패널 280px / 필드 1320×658 / 우 패널 280px /
> 벤치 82px / 상점 182px / 푸터 62px. 배경 중앙 하단 약 400px는 상점·벤치 UI가 덮는다.

---

# 14. Hex 타일 오버레이

```text
public/assets/ui/board_hex_tiles.png
```

- 셀 **128×96** / **6열 × 1행** / 캔버스 **768×96** / 투명

| col | 상태 | 게임 내 사용 |
|---:|---|---|
| 0 | normal | 기본 셀 |
| 1 | hover | 마우스 오버 |
| 2 | selected | 클릭으로 선택된 유닛의 셀 |
| 3 | valid_drop | 배치 가능 (유닛 선택 중 전체 하이라이트) |
| 4 | invalid_drop | 팀 규모 초과 등 배치 불가 |
| 5 | attack_range | 사거리 표시 |

- 육각형 외곽 2px, 중앙은 반투명
- **pointy-top 방향** (게임이 odd-r 오프셋 그리드로 배치)

---

# 15. UI 9-slice 시트

```text
public/assets/ui/ui_frames.png
```

- 셀 **48×48** / **8열 × 4행** / 캔버스 **384×192** / 투명

| Row | 내용 |
|---:|---|
| 0 | 패널: default / dark / gold / danger / tooltip / shop / trait / leaderboard |
| 1 | 버튼 normal ×8 |
| 2 | 버튼 hover ×8 |
| 3 | 버튼 pressed 4 + disabled 4 |

**버튼 텍스트는 넣지 않는다.**

---

# 16. 슬롯/카드 프레임

```text
public/assets/ui/ui_slots.png
```

- 셀 **192×256** / **8열 × 2행** / 캔버스 **1536×512**

| Row | col0 | col1 | col2 | col3 | col4 | col5 | col6 | col7 |
|---:|---|---|---|---|---|---|---|---|
| 0 | 1코 shop card | 2코 | 3코 | 4코 | 5코 | locked | sold | hover |
| 1 | bench | item | augment silver | augment gold | augment prism | portrait | result card | empty |

**카드 내부 텍스트/초상화는 없다.**

---

# 17. UI 상태 사양 (v1.1 신규)

구현된 화면에서 실제로 쓰이는 상태다. 위 시트로 커버되지 않는 것은 게임이 CSS로 그리지만,
도트 자산으로 대체할 경우 아래 상태를 모두 제공해야 한다.

| 요소 | 상태 | 현재 표현 |
|---|---|---|
| 유닛 토큰 | 기본 / 선택됨 | 선택 시 금색 외곽 광 (`drop-shadow 0 0 8px #FFCC33`) |
| 유닛 토큰 | 1성 / 2성 / 3성 | 상단에 ★ 개수, 3성은 금색 |
| 유닛 토큰 | 아이템 0~3개 | 하단에 12×12 태그색 사각형 |
| 상점 카드 | 구매 가능 / 골드 부족 / 판매됨 | 부족 시 55% 투명, 판매 시 22% 투명 |
| 벤치 슬롯 | 빈 칸 / 채워짐 | 빈 칸은 점선 테두리 |
| 헥스 셀 | 기본 / 드래그 오버 / 배치 대기 | 드래그 오버 시 청록 채움 + 2px 외곽 |
| 특성 행 | 비활성 / 활성 | 활성 시 금색 좌측 3px 바 + 금색 반투명 배경 |
| 순위 행 | 본인 / 타 플레이어 / 탈락 | 본인 금색 테두리, 탈락 40% 투명 |
| 드래프트 페데스털 | 선택 가능 / 선택됨 / 내 차례 아님 | 선택됨 30% 투명 |
| 증강 카드 | Silver / Gold / Prism | 등급별 테두리색 `#C9D6E0` / `#FFCC33` / `#B98AE0` |

# 18. 배너 12종

```text
public/assets/ui/banner_<name>.png
```

- **960×180** RGBA
- **중앙 텍스트 영역을 비운다. 텍스트는 게임이 렌더한다.**
- 텍스트 없는 장식 프레임만 제작

| 파일 | 표시 시점 |
|---|---|
| `banner_round_start.png` | 라운드 시작 |
| `banner_preparation.png` | 준비 단계 |
| `banner_battle.png` | 전투 개시 |
| `banner_overtime.png` | 30초 경과 오버타임 진입 |
| `banner_victory.png` | PvP 승리 |
| `banner_defeat.png` | PvP 패배 |
| `banner_draw.png` | 45초 무승부 |
| `banner_pve.png` | PvE 라운드 |
| `banner_draft.png` | 트윙클 드래프트 |
| `banner_augment.png` | 증강 선택 |
| `banner_eliminated.png` | 플레이어 탈락 |
| `banner_champion.png` | 최종 우승 |

---

# 19. 트윙클 드래프트 자산

- pedestal normal / hover / selected 3종
- 원형 트랙 하이라이트
- 선택권 오픈 이펙트
- 9개 유닛 카드가 읽히는 배경 (`bg_twinkle_draft.png`)

**유닛/아이템은 기존 portrait/item icon을 재사용한다. 별도 캐릭터 일러스트 제작 금지.**

> 게임은 3×3 그리드로 9개 페데스털을 배치하고, 각 칸에 유닛 토큰(46×46)과
> 재료 아이템 아이콘(30×30)을 나란히 표시한다.
> 1-1 "트윙클 스타트 선택"에서도 동일 화면을 재사용한다.

---

# 20. PvE 적 5종

```text
public/assets/pve/<enemyId>.png
```

각각 **1280×512**:

- 셀 **128×128** / **10열 × 4행**
- idle 6 / attack 8 / hit 4 / ko 6
- 남는 셀 투명

| `enemyId` | 이름 | 등장 | 편성 |
|---|---|---|---:|
| `training_dummy` | 연습용 허수아비 | 1-1 | 3기 |
| `track_golem` | 트랙 골렘 | 1-2 | 4기 |
| `supply_robot` | 보급 로봇 | 1-3 | 4기 |
| `trophy_guardian` | 트로피 수호자 | 스테이지 2~3 | 5기 |
| `grand_trophy_guardian` | 그랜드 트로피 수호자 | 스테이지 4+ | 6기 |

> PvE 적은 캐릭터 풀과 무관한 별도 개체다. 우마무스메로 보이지 않게 한다.
> 스테이지가 오를수록 체력/공격력이 배율 증가하므로, 상위 2종은 확실히 더 위압적이어야 한다.

---

# 21. 파일명/폴더

```text
public/assets/
├─ portraits/<unitId>.png                256×256
├─ characters/<unitId>.png               1280×768
├─ characters/cutin/<unitId>.png         960×540   (8명)
├─ items/components/<itemId>.png         96×96     (10)
├─ items/complete/<itemId>.png           96×96     (55)
├─ traits/<traitId>.png                  96×96     (24)
├─ augments/<augmentId>.png              96×96     (48)
├─ status/<name>.png                     96×96     (24)
├─ vfx/<vfxKey>.png                      1920×192  (24) + 1536×512 (3)
├─ pve/<enemyId>.png                     1280×512  (5)
├─ boards/<name>.png                     1920×1080 (8, 불투명)
└─ ui/
   ├─ board_hex_tiles.png                768×96
   ├─ ui_frames.png                      384×192
   ├─ ui_slots.png                       1536×512
   └─ banner_<name>.png                  960×180   (12)
```

**영문 소문자 snake_case. 공백/한글 파일명 금지.**

---

# 22. 납품 검수 (코드와 1:1)

## 22.1 자동 검수

```bash
npm run check:art                # 누락 현황 리포트 (exit 0)
STRICT_ART=1 npm run check:art   # 전체 납품 검수 (누락/규격 위반 시 exit 1)
```

`scripts/check-art-manifest.ts`가 `art-manifest.json` 기준으로 파일별 검사한다.

| 검사 항목 | 판정 방법 |
|---|---|
| 파일 존재 | 경로 존재 + 크기 0바이트 아님 |
| PNG 유효성 | PNG 시그니처 8바이트 + `IHDR` 청크 확인 |
| 픽셀 크기 | IHDR에서 width/height를 읽어 **정확히 일치**해야 함 |
| 알파 채널 | IHDR colour type이 **6(RGBA) 또는 4(Grey+Alpha)** — `boards/`만 예외 |
| unitId 일치 | 매니페스트의 `<unitId>`와 파일명이 정확히 같아야 함 |

누락은 **P0(Season 1 활성 60명 + 전 시스템 자산)** 과 **P1(도감 전용 85명)** 으로 나눠 보고된다.

> **일반 빌드는 누락만으로 실패하지 않는다.** 게임에 절차적 fallback이 있어 아트 0개 상태로도
> 완주 가능하기 때문이다. 전체 납품 강제는 `STRICT_ART=1`에서만 일어난다.

## 22.2 사람이 보는 검수

- 256px 초상화에서 얼굴 식별
- **상점 카드 52px 축소에서도 캐릭터 구분**
- 64px 축소에서 아이템 식별
- 96px 전투 표시에서 캐릭터 식별
- run loop 끊김 없음
- attack contact frame(5번) 명확
- KO와 victory 혼동 없음
- 밝은/어두운 보드 모두에서 외곽선 유지
- 특성 아이콘 22px 축소에서 활성/비활성 구분 가능

---

# 23. 현재 fallback 아트 (기준선)

아트 납품 전 게임은 아래 절차적 플레이스홀더를 사용한다.
**납품 아트는 최소한 이 정도의 즉시 식별성을 넘어야 한다.**

| 대상 | 현재 fallback |
|---|---|
| 캐릭터 | 코스트 색 3px 링 + 어두운 원형 바탕 + **이름 첫 글자** (예: 스페셜 위크 → "스") |
| 별 등급 | 토큰 상단 ★ 문자 반복, 3성은 금색 |
| 아이템 | 태그색 2px 사각 테두리 + **이름 앞 2글자** (예: 챔피언 트로피 → "챔피") |
| 특성 | 각질색 단색 22×22 사각형 |
| 헥스 타일 | Phaser Graphics로 그린 pointy-top 육각 (외곽 2px, 중앙 반투명) |
| 체력/마나 바 | 토큰 하단 62×7 / 62×5 막대 (아군 녹색, 적 적색, 마나 청록) |
| 배경 | CSS 그라디언트 |

누락된 키는 콘솔에 **키당 정확히 한 번** 기록된다 (`[art] using fallback for "…"`).

---

# 24. 이미지 생성 AI 공통 프롬프트

아래 문장을 모든 생성 요청의 공통 prefix로 사용한다.

```text
UmafightTactics fan-made game asset.
2D pixel art, clean handheld monster-battler RPG feeling, strong readable silhouette,
hard pixel edges, no anti-aliasing, no watermark, no text, no UI labels,
original fan-made interpretation, do not trace official game sprites.
Use transparent RGBA background unless the asset is explicitly a background.
Keep the subject centered inside the defined cell and never cross the cell boundary.
```

캐릭터용 추가:

```text
Preserve the character's recognizable hair color, horse ears, iconic accessory colors,
and cheerful racing-academy identity. Chibi proportions, game-combat readability first.
No realistic rendering, no photographic texture.
```

아이템용 추가:

```text
Single centered racing/training-themed object icon.
Readable at 48x48 display size. Use 4-6 step pixel shading, strong outline.
```

VFX용 추가:

```text
No ground plane, no background, no text.
Animation must build to a clear peak around frame 5 and fully dissipate by frame 10.
```

증강용 추가 (v1.1 신규):

```text
Single abstract emblem on transparent background, no frame and no border ring
(the game draws the rarity frame). Must stay legible as a 96x96 icon.
```

---

# 25. 생성 AI 배치 작업 순서

## Batch 1 — 게임 플레이 가능 최소 아트

1. UI frames (`ui_frames.png`, `ui_slots.png`)
2. hex tiles (`board_hex_tiles.png`)
3. 재료 아이콘 10개
4. 특성 아이콘 24개
5. 상태 아이콘 24개
6. 배경 8장
7. 공통 VFX 24종
8. PvE 5종

## Batch 2 — Season 1

1. activeS1 초상화 60장 (§3.1 명단)
2. activeS1 전투 시트 60장
3. 조합 아이템 아이콘 55개
4. 증강 아이콘 48개
5. 5코 컷인 8장 (§6 명단)
6. 별 합성 VFX 3종
7. 배너 12종

## Batch 3 — Collection 완성

1. 나머지 초상화 85장 (§3.2 명단)
2. 나머지 전투 시트 85장

---

# 26. 절대 금지

- 한 이미지에 여러 캐릭터를 합쳐서 생성한 뒤 사람이 임의 crop해야 하는 방식
- 서로 다른 셀의 캐릭터가 겹치는 것
- 셀 밖으로 머리카락/이펙트가 넘어가는 것
- 자동 그림자
- 흰색 배경
- 회색 체크무늬 투명 배경 표시를 실제 픽셀로 넣는 것
- 가이드선/검은 네모 테두리를 실제 delivery PNG에 넣는 것
- 공식 로고/게임 UI 캡처
- 공식 스프라이트 추출
- AI가 임의로 글자 생성
- 프레임마다 의상/색/얼굴이 달라지는 것

**검수용 가이드는 별도 `*_guide.png`로만 제공하고 실제 게임 PNG에는 포함하지 않는다.**

---

# 27. 최종 납품 완료 조건

- [ ] 전체 145 portrait
- [ ] 전체 145 battle sheets
- [ ] S1 5-cost cutin 8
- [ ] item 65
- [ ] trait 24
- [ ] augment 48
- [ ] status 24
- [ ] VFX 24×10
- [ ] star VFX 3×12
- [ ] PvE enemy 5
- [ ] background 8
- [ ] hex overlay 1 sheet
- [ ] UI frame 1 sheet
- [ ] slot/card frame 1 sheet
- [ ] banner 12
- [ ] 모든 PNG 규격 자동 검사 통과
- [ ] transparent 자산 halo 없음
- [ ] `STRICT_ART=1 npm run check:art` 통과

이 체크리스트를 모두 만족하면 디자인 납품 완료로 본다.
