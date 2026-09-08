/** Evidence-based differential audit; PASS means only this named fixture matched. */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AUGMENT_ROUNDS, POOL_COPIES, SHOP_ODDS, XP_TO_LEVEL, baseStageDamage, survivorDamage } from '../src/game/engine/constants';
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
  compare(`attack_mana_${role}`, expected, unit.mana, sources.roles, '15.1 published role contract', 'One isolated attack; enemy stunned; mana initially zero. AP_CARRY mapped to Caster and AD_CARRY to Marksman for this comparison.');
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
for (const [id, actual, evidence] of [
  ['latest_full_set_content', 'Uma Musume roster, custom skills/items/traits; no Wisps', '18.1 introduces Wisps and a different roster; content equivalence is intentionally absent.'],
  ['riot_internal_combat_timing', '50ms deterministic simulation; custom windup/projectile timing', 'No official executable oracle or complete internal timing specification was available.'],
  ['latest_complete_numeric_tables', 'Only individually cited patch values were checked', 'Patch notes are deltas, not a complete versioned engine specification; intervening per-set exceptions may exist.'],
  ['matchmaking_and_randomness', 'Custom seeded RNG and round pairing', 'No Riot replay corpus with identical champion data and seeds was available for differential replay.'],
] as const) results.push({ id, status: 'UNVERIFIED', expected: null, actual, source: sources.live, baseline: '18.1 scope limit', evidence });

const counts = { MATCH: 0, DIFFERENT: 0, UNVERIFIED: 0 };
for (const row of results) counts[row.status]++;
const report = { checkedAt: '2026-09-08', latestOfficialPatchReviewed: '18.1, including Aug 31 / Sep 1 update', verdict: 'NOT_IDENTICAL', method: 'Public-rule fixture comparison, not binary/replay equivalence. Each row pins its own published baseline; older values are not asserted to be a complete 18.1 ruleset.', counts, results };
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
writeFileSync(path.join(root, 'docs/qa/tft-parity-report.json'), JSON.stringify(report, null, 2) + '\n');
const rows = results.map(r => `| ${r.id} | ${r.status} | ${JSON.stringify(r.expected)} | ${JSON.stringify(r.actual)} | [${r.baseline}](${r.source}) |`).join('\n');
writeFileSync(path.join(root, 'docs/TFT_PARITY_AUDIT.md'), `# TFT 공개 규칙 동일성 검증\n\n검증일: 2026-09-08. 최신 확인 문서: TFT 18.1 (8/31·9/1 수정 포함). **결론: 동일하지 않음.**\n\n일치 ${counts.MATCH}, 차이 ${counts.DIFFERENT}, 미검증 ${counts.UNVERIFIED}. 이 수량은 아래 표의 개별 검증 항목 수이며 게임 전체의 동일성 백분율이 아니다.\n\n각 행은 해당 패치에 공개된 규칙과 비교한다. 과거 패치 수치를 전부 최신 18.1의 완전한 명세로 간주하지 않는다. 공식 패치 노트는 변경분만 제공하며 최신 전체 수치표·Riot 내부 엔진·동일 데이터와 시드의 리플레이 비교는 확보하지 못했다. AP_CARRY→Caster, AD_CARRY→Marksman은 비교용 역할 대응이다.\n\n| 항목 | 결과 | 공식 기준 | 현재 실행 결과 | 근거 |\n|---|---|---|---|---|\n${rows}\n\n실행: \`npm run audit:tft\`. 보고서는 매번 실제 엔진 실행/현재 상수로 다시 작성된다. \`npm run audit:tft -- --strict\`는 불일치 또는 미검증이 있으면 종료 코드 1이다. 기본 모드의 종료 코드 0은 보고서 생성 성공만 뜻한다.\n\n기존 npm 테스트 및 200회 매치 시뮬레이션은 자체 엔진의 회귀/완주 검증이다. TFT 동일성 통과를 뜻하지 않는다. 8인 경쟁·공유 풀·경제·편성·자동 전투라는 구조는 구현되어 있지만, 마나·대상 선택·상점 확률·플레이어 피해의 차이가 결과와 운영 전략을 바꾼다. 이번 검증을 통과시키기 위해 기존 프로젝트 밸런스 상수를 임의로 바꾸지 않았다.\n\n우선순위: (1) 기준 세트를 고정한 역할/마나·대상 선택 이식, (2) 경제/피해/공유 풀 전체표 확정, (3) 아이템·특성·스킬과 예외 판정, (4) 동일 입력의 원본 TFT 실행 결과 대조. 상세 fixture 조건은 [JSON 보고서](qa/tft-parity-report.json)에 있다.\n`);
console.log(JSON.stringify({ verdict: report.verdict, counts }, null, 2));
if (process.argv.includes('--strict') && (counts.DIFFERENT || counts.UNVERIFIED)) process.exitCode = 1;
