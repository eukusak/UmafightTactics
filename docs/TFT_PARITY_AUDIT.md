# TFT 공개 규칙 비교

검증일: 2026-09-09. 현재 구조를 유지하며 공개된 전투·성장 규칙부터 맞춘다. **전체 TFT와 동일하다는 판정은 아니다.**

일치 17, 차이 0, 미검증 4. 각 행은 링크된 공개 패치 규칙에 한정된다. 과거 패치의 변경분을 합친 프로젝트 기준이며, 최신 18.1의 완전한 명세가 아니다.

| 항목 | 결과 | 공식 기준 | 실제 결과 | 근거 |
|---|---|---|---|---|
| attack_mana_TANK | MATCH | 5 | 5 | [15.1 published role contract](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-15-1-notes-2025/) |
| attack_mana_AP_CARRY | MATCH | 7 | 6.999999999999997 | [15.1 published role contract](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-15-1-notes-2025/) |
| attack_mana_AD_CARRY | MATCH | 10 | 10 | [15.1 published role contract](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-15-1-notes-2025/) |
| caster_passive_mana_per_second | MATCH | 2 | 2.0000000000000004 | [15.1 published role contract](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-15-1-notes-2025/) |
| equal_distance_tank_priority | MATCH | "auditB#auditB1" | "auditB#auditB1" | [15.1 targeting priority](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-15-1-notes-2025/) |
| retarget_in_range_before_chasing | MATCH | "auditB#auditB1" | "auditB#auditB1" | [17.1 published targeting change](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-17-1/) |
| retain_valid_target_after_cc | MATCH | "auditB#auditB0" | "auditB#auditB0" | [18.1 targeting change](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-18-1/) |
| augment_rounds | MATCH | ["2-1","3-2","4-2"] | ["2-1","3-2","4-2"] | [12.11 default augment schedule](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-12-11-notes/) |
| pool_copies | MATCH | [30,25,18,10,9] | [30,25,18,10,9] | [14.15 historical standard pool](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-15-notes/) |
| shop_level_7 | MATCH | [19,30,40,10,1] | [19,30,40,10,1] | [17.1 published odds](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-17-1/) |
| shop_level_8 | MATCH | [15,20,32,30,3] | [15,20,32,30,3] | [16.1 published odds](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-16-1/) |
| shop_level_9 | MATCH | [10,17,25,33,15] | [10,17,25,33,15] | [16.1 published odds](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-16-1/) |
| xp_to_levels_8_9_10 | MATCH | [60,68,68] | [60,68,68] | [16.1 + 16.4 rollback](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-16-4/) |
| stage_3_4_player_damage | MATCH | [6,7] | [6,7] | [16.1 published base player damage](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-16-1/) |
| surviving_enemy_damage | MATCH | [1,2,3,4,5,6] | [1,2,3,4,5,6] | [16.1 survivor damage description](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-16-1/) |
| base_damage_other_stages | MATCH | [0,2,10,12,17,150] | [0,2,10,12,17,150] | [14.9 full table, with 16.1 stage 3/4 updates above](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-9-notes/) |
| streak_gold | MATCH | [0,0,0,1,1,2,3,3] | [0,0,0,1,1,2,3,3] | [14.1 public streak thresholds](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-1-notes/) |
| latest_full_set_content | UNVERIFIED | null | "Uma Musume roster, custom skills/items/traits; no Wisps" | [18.1 scope limit](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-18-1/) |
| riot_internal_combat_timing | UNVERIFIED | null | "50ms deterministic simulation; custom windup/projectile timing" | [18.1 scope limit](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-18-1/) |
| latest_complete_numeric_tables | UNVERIFIED | null | "Only individually cited patch values were checked" | [18.1 scope limit](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-18-1/) |
| matchmaking_and_randomness | UNVERIFIED | null | "Custom seeded RNG and round pairing" | [18.1 scope limit](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-18-1/) |

공격 마나는 같은 시간의 비공격 대조군을 빼서 자연 재생과 분리했다. SUPPORT는 Caster 자원 모델에 대응한다. BRUISER는 15.4의 Fighter 공격속도 보너스를 실제 스테이지로 받는다. [15.4 역할 변경](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-15-4-notes/)

새 스킬은 캐릭터별 창작 변형이다. 내부 판정 시간, 최신 전체 수치표, 세트 고유 콘텐츠, 동일 입력의 Riot 리플레이 대조는 미검증으로 남긴다.

실행: `npm run audit:tft`. `--strict`는 불일치 또는 미검증이 있으면 종료 코드 1이다. 자체 테스트와 매치 시뮬레이션의 성공은 게임 전체 동일성을 뜻하지 않는다. 상세 조건은 [JSON 보고서](qa/tft-parity-report.json)에 있다.
