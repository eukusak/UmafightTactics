# TFT 공개 규칙 동일성 검증

검증일: 2026-09-08. 최신 확인 문서: TFT 18.1 (8/31·9/1 수정 포함). **결론: 동일하지 않음.**

일치 4, 차이 11, 미검증 4. 이 수량은 아래 표의 개별 검증 항목 수이며 게임 전체의 동일성 백분율이 아니다.

각 행은 해당 패치에 공개된 규칙과 비교한다. 과거 패치 수치를 전부 최신 18.1의 완전한 명세로 간주하지 않는다. 공식 패치 노트는 변경분만 제공하며 최신 전체 수치표·Riot 내부 엔진·동일 데이터와 시드의 리플레이 비교는 확보하지 못했다. AP_CARRY→Caster, AD_CARRY→Marksman은 비교용 역할 대응이다.

| 항목 | 결과 | 공식 기준 | 현재 실행 결과 | 근거 |
|---|---|---|---|---|
| attack_mana_TANK | DIFFERENT | 5 | 10 | [15.1 published role contract](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-15-1-notes-2025/) |
| attack_mana_AP_CARRY | DIFFERENT | 7 | 10 | [15.1 published role contract](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-15-1-notes-2025/) |
| attack_mana_AD_CARRY | MATCH | 10 | 10 | [15.1 published role contract](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-15-1-notes-2025/) |
| caster_passive_mana_per_second | DIFFERENT | 2 | 0 | [15.1 published role contract](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-15-1-notes-2025/) |
| equal_distance_tank_priority | DIFFERENT | "auditB#auditB1" | "auditB#auditB0" | [15.1 targeting priority](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-15-1-notes-2025/) |
| retarget_in_range_before_chasing | DIFFERENT | "auditB#auditB1" | "auditB#auditB0" | [17.1 published targeting change](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-17-1/) |
| retain_valid_target_after_cc | MATCH | "auditB#auditB0" | "auditB#auditB0" | [18.1 targeting change](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-18-1/) |
| augment_rounds | MATCH | ["2-1","3-2","4-2"] | ["2-1","3-2","4-2"] | [12.11 default augment schedule](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-12-11-notes/) |
| pool_copies | DIFFERENT | [30,25,18,10,9] | [22,20,17,10,9] | [14.15 historical standard pool](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-15-notes/) |
| shop_level_7 | DIFFERENT | [19,30,40,10,1] | [19,35,35,10,1] | [17.1 published odds](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-17-1/) |
| shop_level_8 | DIFFERENT | [15,20,32,30,3] | [18,25,36,18,3] | [16.1 published odds](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-16-1/) |
| shop_level_9 | DIFFERENT | [10,17,25,33,15] | [10,20,25,35,10] | [16.1 published odds](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-16-1/) |
| xp_to_levels_8_9_10 | MATCH | [60,68,68] | [60,68,68] | [16.1 + 16.4 rollback](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-16-4/) |
| stage_3_4_player_damage | DIFFERENT | [6,7] | [2,3] | [16.1 published base player damage](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-16-1/) |
| surviving_enemy_damage | DIFFERENT | [1,2,3,4,5,6] | [2,4,6,8,10,11] | [16.1 survivor damage description](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-16-1/) |
| latest_full_set_content | UNVERIFIED | null | "Uma Musume roster, custom skills/items/traits; no Wisps" | [18.1 scope limit](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-18-1/) |
| riot_internal_combat_timing | UNVERIFIED | null | "50ms deterministic simulation; custom windup/projectile timing" | [18.1 scope limit](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-18-1/) |
| latest_complete_numeric_tables | UNVERIFIED | null | "Only individually cited patch values were checked" | [18.1 scope limit](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-18-1/) |
| matchmaking_and_randomness | UNVERIFIED | null | "Custom seeded RNG and round pairing" | [18.1 scope limit](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-18-1/) |

실행: `npm run audit:tft`. 보고서는 매번 실제 엔진 실행/현재 상수로 다시 작성된다. `npm run audit:tft -- --strict`는 불일치 또는 미검증이 있으면 종료 코드 1이다. 기본 모드의 종료 코드 0은 보고서 생성 성공만 뜻한다.

기존 npm 테스트 및 200회 매치 시뮬레이션은 자체 엔진의 회귀/완주 검증이다. TFT 동일성 통과를 뜻하지 않는다. 8인 경쟁·공유 풀·경제·편성·자동 전투라는 구조는 구현되어 있지만, 마나·대상 선택·상점 확률·플레이어 피해의 차이가 결과와 운영 전략을 바꾼다. 이번 검증을 통과시키기 위해 기존 프로젝트 밸런스 상수를 임의로 바꾸지 않았다.

우선순위: (1) 기준 세트를 고정한 역할/마나·대상 선택 이식, (2) 경제/피해/공유 풀 전체표 확정, (3) 아이템·특성·스킬과 예외 판정, (4) 동일 입력의 원본 TFT 실행 결과 대조. 상세 fixture 조건은 [JSON 보고서](qa/tft-parity-report.json)에 있다.
