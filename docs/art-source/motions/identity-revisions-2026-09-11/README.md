# 초상화·인게임 얼굴 수정 — 복구 체크포인트

**명단 우선 공개 단계입니다. 아래 반영 수는 복구된 로컬 체크포인트 기준이며 이미지 커밋은 순차 업로드합니다. 완료본이 아닌 Draft입니다. 51명 중 6명 반영, 12명 배경 수정 대기, 33명 생성 대기입니다.**

기준: PR #12 병합 커밋 `2191d948b9d6d00c2a18857fd7944097771a5f1b`.
145명 전체 검토 명단에서 51명 수정 대상을 복구했습니다. 이전 폴더에 캐릭터별 생성본이 연결된 인원은 13명이며, 3명만 실제 게임에 반영되어 있었습니다. 이번 복구에서 기존 생성본 3명을 검수·반영하고 5명의 추가 후보를 생성해 총 18명의 생성본을 보존합니다.

## 반영 및 검수

- 비코 페가수스, 츠루마루 츠요시, 로이스 앤 로이스의 이전 수정본 보존.
- 어드마이어 베가, 뱀부 메모리, 메이쇼 도토의 기존 투명 생성본을 검수하고 24프레임씩 반영.
- 모든 초상화와 미반영 139명의 모션 PNG는 기준 해시 보존. 기존 스킬 타이밍·스킬 데이터 유지.
- 전후 원본, 프롬프트, 검수 및 프레임별 패킹 기록은 캐릭터 하위 폴더에 보관.
- 게임 크기 검수: [6명 비교](../../../qa/identity-restored-six.png).

## 진행을 막는 문제

내장 image_gen에 투명 PNG를 요청하고 한국어 및 간단한 영어 배경 제거로 재시도했지만, 이번 출력은 알파 채널 없는 RGB PNG였습니다. 체크무늬 또는 불투명 배경이 실제 픽셀에 포함되어 있어 게임에 연결하지 않았습니다.

`alpha-blocked`는 완성 또는 승인 상태가 아닙니다. 심볼리 루돌프는 4번째 스킬 행이 KO 행으로 바뀌어 재생성도 필요하고, 히시 아케보노는 양쪽 묶음머리도 재검수해야 합니다.

## 재개 방법

1. 아래 `alpha-blocked`의 배경을 실제 투명 알파로 수정하고 얼굴·머리·24포즈를 검수합니다.
2. `pending`의 `generation.json` 프롬프트와 `reference.png`를 사용해 캐릭터당 개별 생성합니다. 왼쪽 초상화가 외모 기준이고 오른쪽은 동작 참고입니다.
3. 알파·외모·포즈가 실제로 통과한 경우에만 `review.json`을 승인한 후 `python scripts/pack-identity-revision.py <id>`로 연결합니다.
4. 전체 통합 후 테스트·빌드·게임 화면 검수 및 이 목록의 집계를 갱신하고 Draft를 해제합니다.

자동 테스트는 미완료 대상을 숨기지 않으며, 승인하지 않은 이미지가 런타임에 들어오지 못하도록 검사합니다. 테스트 통과만으로 51명이 완료되었다는 뜻은 아닙니다.

## 검증 결과

- Vitest 24개 파일, 351개 테스트 통과.
- TypeScript 포함 프로덕션 빌드 및 ESLint 통과. 기존 500kB 번들 경고 유지.
- `STRICT_ART=1 node --import tsx scripts/check-art-manifest.ts`: 514/514 규격 통과.
- 6명 실제 128px 프레임 합성 이미지 시각 검수. 이번 복구에서 브라우저 실시간 검수는 별도로 수행하지 않음.
- `git diff --check` 통과.

## 명단

| ID | 이름 | 상태 |
|---|---|---|
| maruzensky | 마루젠스키 | alpha-blocked |
| el_condor_pasa | 엘 콘도르 파사 | alpha-blocked |
| symboli_rudolf | 심볼리 루돌프 | alpha-blocked |
| agnes_digital | 아그네스 디지털 | alpha-blocked |
| hishi_akebono | 히시 아케보노 | alpha-blocked |
| ines_fujin | 아이네스 후진 | pending |
| admire_vega | 어드마이어 베가 | integrated |
| inari_one | 이나리 원 | alpha-blocked |
| curren_chan | 카렌짱 | pending |
| kawakami_princess | 카와카미 프린세스 | pending |
| gold_city | 골드 시티 | pending |
| smart_falcon | 스마트 팔콘 | pending |
| zenno_rob_roy | 젠노 롭 로이 | pending |
| narita_taishin | 나리타 타이신 | pending |
| bamboo_memory | 뱀부 메모리 | integrated |
| biko_pegasus | 비코 페가수스 | integrated |
| meisho_doto | 메이쇼 도토 | integrated |
| nice_nature | 나이스 네이처 | pending |
| matikanetannhauser | 마치카네 탄호이저 | pending |
| mejiro_palmer | 메지로 파머 | pending |
| sakura_chiyono_o | 사쿠라 치요노 오 | pending |
| yaeno_muteki | 야에노 무테키 | pending |
| tsurumaru_tsuyoshi | 츠루마루 츠요시 | integrated |
| daring_tact | 데어링 택트 | alpha-blocked |
| sakura_laurel | 사쿠라 로렐 | pending |
| yamanin_zephyr | 야마닌 제퍼 | pending |
| furioso | 푸리오소 | pending |
| transcend | 트랜센드 | alpha-blocked |
| north_flight | 노스 플라이트 | alpha-blocked |
| symboli_kris_s | 심볼리 크리스 에스 | pending |
| tanino_gimlet | 타니노 김렛 | alpha-blocked |
| aston_machan | 애스턴 마짱 | alpha-blocked |
| satono_crown | 사토노 크라운 | pending |
| dantsu_flame | 단츠 플레임 | pending |
| ks_miracle | 케이에스 미라클 | alpha-blocked |
| jungle_pocket | 정글 포켓 | pending |
| no_reason | 노 리즌 | pending |
| copano_rickey | 코파노 리키 | pending |
| hokko_tarumae | 홋코 타루마에 | pending |
| wonder_acute | 원더 어큐트 | pending |
| samson_big | 삼손 빅 | pending |
| sounds_of_earth | 사운즈 오브 어스 | pending |
| royce_and_royce | 로이스 앤 로이스 | integrated |
| katsuragi_ace | 카츠라기 에이스 | pending |
| hishi_miracle | 히시 미라클 | pending |
| tap_dance_city | 탭 댄스 시티 | pending |
| duramente | 두라멘테 | pending |
| cesario | 세자리오 | pending |
| buena_vista | 부에나 비스타 | pending |
| stay_gold | 스테이 골드 | pending |
| logotype | 로고타입 | pending |
