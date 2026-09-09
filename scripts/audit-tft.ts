/** Evidence-based differential audit; PASS means only this named fixture matched. */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AUGMENT_ROUNDS, POOL_COPIES, SHOP_ODDS, XP_TO_LEVEL, baseStageDamage, survivorDamage, streakGold } from '../src/game/engine/constants';
import { ACTIVE_BY_COST } from '../src/game/engine/roster';
import { BattleEngine, type BattleSideInput } from '../src/game/engine/battle/engine';
import { Rng } from '../src/game/engine/rng';
import { hexDistance } from '../src/game/engine/battle/hex';

const official = (slug: string): string => `https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/${slug}/`;
const sources = {
  live: official('teamfight-tactics-patch-18-1'),
  movement: official('teamfight-tactics-patch-17-1'),
  systems: official('teamfight-tactics-patch-16-1'),
  xp: official('teamfight-tactics-patch-16-4'),
  roles: official('teamfight-tactics-patch-15-1-notes-2025'),
  pool: official('teamfight-tactics-patch-14-15-notes'),
  augments: official('teamfight-tactics-patch-12-11-notes'),
};
type Result = { id: string; status: 'MATCH' | 'DIFFERENT' | 'UNVERIFIED'; expected: unknown; actual: unknown; source: string; baseline: string; evidence: string };
const results: Result[] = [];
function compare(id: string, expected: unknown, actual: unknown, source: string, baseline: string, evidence: string): void {
  const same = typeof expected === 'number' && typeof actual === 'number'
    ? Math.abs(expected - actual) < .00001 : JSON.stringify(expected) === JSON.stringify(actual);
  results.push({ id, status: same ? 'MATCH' : 'DIFFERENT', expected, actual, source, baseline, evidence });
}
function fixture(seconds = .8, opponents = 1): BattleEngine {
  const side = (playerId: string, n: number): BattleSideInput => ({ playerId, augments: [], tacticianItems: [], units: Array.from({ length: n }, (_, i) => ({ instanceId: `${playerId}${i}`, unitDefId: ACTIVE_BY_COST[1][0].id, star: 1 as const, items: [], position: { q: i + 1, r: 0 } })) });
  const engine = new BattleEngine(side('auditA', 1), side('auditB', opponents), new Rng(91), { maxSeconds: seconds, recordFrames: true });
  for (const u of engine.units) {
    u.base.attackDamage = 1; u.base.attackSpeed = .1; u.base.attackRange = 4;
    // COMBAT_START restores HP/start mana from base stats, so set those too.
    u.base.maxMana = 100000; u.base.startMana = 0; u.base.hp = 100000;
    u.mana = 0; u.hp = u.maxHp = 100000;
    u.skill = { ...u.skill, effects: [] };
    u.cell = u.team === 'A' ? { q: 3, r: 4 } : { q: 3, r: 3 };
    if (u.team === 'B') u.statuses.push({ kind: 'STUN', expiresAt: 10, sourceId: 'audit' });
  }
  return engine;
}
function assertZeroManaStart(engine: BattleEngine): void {
  if (engine.frames[0]?.units.some(u => u.mana !== 0)) throw new Error('Invalid mana fixture: COMBAT_START added starting mana');
}

for (const [role, expected] of [['TANK', 5], ['AP_CARRY', 7], ['AD_CARRY', 10]] as const) {
  const engine = fixture(); const unit = engine.units[0]; unit.role = role;
  const result = engine.run();
  assertZeroManaStart(engine);
  const attacks = result.events.filter(e => e.type === 'ATTACK' && e.source === unit.id).length;
  if (attacks !== 1) throw new Error(`Invalid mana fixture: ${attacks} attacks ${JSON.stringify(result.events)}`);
  const control = fixture(); control.units[0].role = role; control.units[0].attackCooldown = 20; control.run();
  compare(`attack_mana_${role}`, expected, unit.mana - control.units[0].mana, sources.roles, '15.1 published role contract', 'One isolated attack minus a same-duration no-attack control to separate passive regeneration. AP_CARRY mapped to Caster and AD_CARRY to Marksman.');
}
{
  const engine = fixture(1); const unit = engine.units[0]; unit.role = 'AP_CARRY'; unit.attackCooldown = 20;
  engine.run();
  assertZeroManaStart(engine);
  compare('caster_passive_mana_per_second', 2, unit.mana, sources.roles, '15.1 published role contract', '1 second, no attacks or damage, no items.');
}
{
  const engine = fixture(.1, 2), [unit, carry, tank] = engine.units;
  unit.cell = { q: 3, r: 4 }; tank.cell = { q: 2, r: 4 }; carry.cell = { q: 3, r: 3 };
  tank.role = 'TANK'; carry.role = 'AD_CARRY';
  if (hexDistance(unit.cell, tank.cell) !== 1 || hexDistance(unit.cell, carry.cell) !== 1) throw new Error('Invalid equal-distance target fixture');
  engine.run();
  compare('equal_distance_tank_priority', tank.id, unit.targetId, sources.roles, '15.1 targeting priority', 'Two adjacent full-health targets. Non-tank sorts first by ID, so an ID tie-break cannot be mistaken for role priority.');
}
{
  const engine = fixture(.1, 2), [unit, old, nearby] = engine.units;
  unit.base.attackRange = 1; unit.cell = { q: 3, r: 4 };
  old.cell = { q: 3, r: 0 }; nearby.cell = { q: 3, r: 3 }; unit.targetId = old.id;
  engine.run();
  compare('retarget_in_range_before_chasing', nearby.id, unit.targetId, sources.movement, '17.1 published targeting change', 'Existing target outside range; another enemy already in range.');
}
{
  const engine = fixture(.2, 2), [unit, old, nearby] = engine.units;
  unit.cell = { q: 3, r: 4 }; old.cell = { q: 3, r: 1 }; nearby.cell = { q: 3, r: 3 };
  unit.targetId = old.id; unit.statuses.push({ kind: 'STUN', expiresAt: .1, sourceId: nearby.id });
  engine.run();
  compare('retain_valid_target_after_cc', old.id, unit.targetId, sources.live, '18.1 targeting change', 'Existing target stays in attack range; a closer enemy does not replace it solely because stun ends.');
}
compare('augment_rounds', ['2-1', '3-2', '4-2'], AUGMENT_ROUNDS.map(r => `${r.stage}-${r.round}`), sources.augments, '12.11 default augment schedule', 'Runtime constants; opening-encounter exceptions excluded.');
compare('pool_copies', [30, 25, 18, 10, 9], Object.values(POOL_COPIES), sources.pool, '14.15 historical standard pool', 'Historical comparison only: latest 18.1 full pool table not independently confirmed.');
for (const [level, expected, source, baseline] of [
  [7, [19, 30, 40, 10, 1], sources.movement, '17.1'],
  [8, [15, 20, 32, 30, 3], sources.systems, '16.1'],
  [9, [10, 17, 25, 33, 15], sources.systems, '16.1'],
] as const) compare(`shop_level_${level}`, expected, Object.values(SHOP_ODDS).map(column => column[level - 1]), source, `${baseline} published odds`, 'Unmodified base odds, no augment/encounter effects.');
compare('xp_to_levels_8_9_10', [60, 68, 68], [XP_TO_LEVEL[8], XP_TO_LEVEL[9], XP_TO_LEVEL[10]], sources.xp, '16.1 + 16.4 rollback', 'Runtime constants. Level 8 and 10 baseline: ' + sources.systems);
compare('stage_3_4_player_damage', [6, 7], [baseStageDamage(3), baseStageDamage(4)], sources.systems, '16.1 published base player damage', 'No player damage reduction effects.');
compare('surviving_enemy_damage', [1, 2, 3, 4, 5, 6], [1, 2, 3, 4, 5, 6].map(survivorDamage), sources.systems, '16.1 survivor damage description', 'One damage per surviving enemy in the published rule.');
compare('base_damage_other_stages', [0, 2, 10, 12, 17, 150], [1, 2, 5, 6, 7, 8].map(baseStageDamage), official('teamfight-tactics-patch-14-9-notes'), '14.9 full table, with 16.1 stage 3/4 updates above', 'Historical full table used where the later patch does not override it.');
compare('streak_gold', [0, 0, 0, 1, 1, 2, 3, 3], [0, 1, 2, 3, 4, 5, 6, 7].map(streakGold), official('teamfight-tactics-patch-14-1-notes'), '14.1 public streak thresholds', 'Three/four wins or losses pay 1; five pays 2; six or more pays 3.');
for (const [id, actual, evidence] of [
  ['latest_full_set_content', 'Uma Musume roster, custom skills/items/traits; no Wisps', '18.1 introduces Wisps and a different roster; content equivalence is intentionally absent.'],
  ['riot_internal_combat_timing', '50ms deterministic simulation; custom windup/projectile timing', 'No official executable oracle or complete internal timing specification was available.'],
  ['latest_complete_numeric_tables', 'Only individually cited patch values were checked', 'Patch notes are deltas, not a complete versioned engine specification; intervening per-set exceptions may exist.'],
  ['matchmaking_and_randomness', 'Custom seeded RNG and round pairing', 'No Riot replay corpus with identical champion data and seeds was available for differential replay.'],
] as const) results.push({ id, status: 'UNVERIFIED', expected: null, actual, source: sources.live, baseline: '18.1 scope limit', evidence });

const counts = { MATCH: 0, DIFFERENT: 0, UNVERIFIED: 0 };
for (const row of results) counts[row.status]++;
const report = { checkedAt: '2026-09-09', latestOfficialPatchReviewed: '18.1, including Aug 31 / Sep 1 update', verdict: 'NOT_IDENTICAL', method: 'Public-rule fixture comparison, not binary/replay equivalence. Each row pins its own published baseline; older values are not asserted to be a complete 18.1 ruleset.', counts, results };
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
writeFileSync(path.join(root, 'docs/qa/tft-parity-report.json'), JSON.stringify(report, null, 2) + '\n');
const rows = results.map(r => `| ${r.id} | ${r.status} | ${JSON.stringify(r.expected)} | ${JSON.stringify(r.actual)} | [${r.baseline}](${r.source}) |`).join('\n');
writeFileSync(path.join(root, 'docs/TFT_PARITY_AUDIT.md'), `# TFT 공개 규칙 비교

검증일: 2026-09-09. 현재 구조를 유지하며 공개된 전투·성장 규칙부터 맞춘다. **전체 TFT와 동일하다는 판정은 아니다.**

일치 ${counts.MATCH}, 차이 ${counts.DIFFERENT}, 미검증 ${counts.UNVERIFIED}. 각 행은 링크된 공개 패치 규칙에 한정된다. 과거 패치의 변경분을 합친 프로젝트 기준이며, 최신 18.1의 완전한 명세가 아니다.

| 항목 | 결과 | 공식 기준 | 실제 결과 | 근거 |
|---|---|---|---|---|
${rows}

공격 마나는 같은 시간의 비공격 대조군을 빼서 자연 재생과 분리했다. SUPPORT는 Caster 자원 모델에 대응한다. BRUISER는 15.4의 Fighter 공격속도 보너스를 실제 스테이지로 받는다. [15.4 역할 변경](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-15-4-notes/)

새 스킬은 캐릭터별 창작 변형이다. 내부 판정 시간, 최신 전체 수치표, 세트 고유 콘텐츠, 동일 입력의 Riot 리플레이 대조는 미검증으로 남긴다.

실행: \`npm run audit:tft\`. \`--strict\`는 불일치 또는 미검증이 있으면 종료 코드 1이다. 자체 테스트와 매치 시뮬레이션의 성공은 게임 전체 동일성을 뜻하지 않는다. 상세 조건은 [JSON 보고서](qa/tft-parity-report.json)에 있다.
`);
console.log(JSON.stringify({ verdict: report.verdict, counts }, null, 2));
if (process.argv.includes('--strict') && (counts.DIFFERENT || counts.UNVERIFIED)) process.exitCode = 1;
