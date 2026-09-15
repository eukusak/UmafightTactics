/**
 * Records what a roster pass did to costs and skills, and proves the artwork
 * still fits.
 *
 * Every balance pass that moves costs writes one of these. A cost change moves
 * a unit's damage numbers and star multipliers, which changes the skill hash
 * the motion sheets are pinned to — but it does not change the *motion*, and
 * re-drawing 70 sheets because a number moved would be absurd. So the record
 * carries the proof: for each changed unit, the skill before and after with
 * every value stripped out. If those two shapes are identical, the poses the
 * artist drew are still the right poses.
 *
 * A unit whose motion contract genuinely changed is written out too, and loudly
 * — that one needs new art and belongs in the next art request.
 *
 *   npx tsx scripts/build-roster-change-review.ts <baseline-all-units.json>
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SkillDef, UnitDef } from '../src/game/engine/types';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs', 'qa', 'roster-additions');

/** The shape the artwork is drawn against: poses, targeting, timing — no numbers. */
export function motionContract(skill: SkillDef): Partial<SkillDef> {
  const shape: Partial<SkillDef> = structuredClone(skill);
  delete shape.baseValues;
  delete shape.starMultipliers;
  delete shape.description;
  for (const effect of shape.effects ?? []) {
    if (['DAMAGE', 'SHIELD_FLAT', 'HEAL'].includes(effect.kind)
      || (effect.kind === 'STAT_MUL' && (effect.value ?? 0) > 0)) delete effect.value;
  }
  return shape;
}

const hash = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

// The record documents a whole pass, so it is taken against the branch point
// rather than the last commit: baselining on HEAD would describe only the most
// recent edit and silently drop everything earlier in the same pass.
const baselineArg = process.argv[2];
const baselineRef = process.env.ROSTER_REVIEW_BASE ?? 'origin/main';
const baselineRaw = baselineArg
  ? readFileSync(baselineArg, 'utf8')
  : execFileSync('git', ['show', `${baselineRef}:src/data/generated/all-units.json`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 });

const before = new Map<string, UnitDef>(
  (JSON.parse(baselineRaw).units as UnitDef[]).map((u) => [u.id, u]),
);
const after = JSON.parse(
  readFileSync(path.join(ROOT, 'src/data/generated/all-units.json'), 'utf8'),
).units as UnitDef[];

const added: string[] = [];
const costChanges: Array<{ id: string; nameKo: string; oldCost: number; newCost: number; before: SkillDef; after: SkillDef }> = [];
const styleChanges: Array<{ id: string; nameKo: string; from: string; to: string }> = [];
const valueOnly: Array<{ id: string; nameKo: string; previousSkillSignature: string; skillSignature: string; before: SkillDef; after: SkillDef }> = [];
const motionChanged: Array<{ id: string; nameKo: string; before: Partial<SkillDef>; after: Partial<SkillDef> }> = [];
/**
 * A changed motion contract only costs anything if someone has already drawn
 * the unit. Changing it while the art request is still open is free — and is
 * the right time to do it — so those are recorded separately rather than
 * counted as redraw work.
 */
const motionChangedBeforeArt: Array<{ id: string; nameKo: string; reason: string }> = [];
const pendingArt = JSON.parse(
  readFileSync(path.join(ROOT, 'src/data/manual/pending-art.json'), 'utf8'),
) as { pending: Array<{ path: string }> };
const awaitingArt = new Set(pendingArt.pending.map((p) => p.path));
const sheets = JSON.parse(
  readFileSync(path.join(ROOT, 'src/data/manual/frame-sheets.json'), 'utf8'),
) as Record<string, { file: string }>;
const undrawn = (id: string): boolean => awaitingArt.has(sheets[id]?.file ?? '');

const STYLES = ['nige', 'senko', 'sashi', 'oikomi'];
const styleOf = (u: UnitDef): string => u.traits.find((t) => STYLES.includes(t)) ?? '';

for (const unit of after) {
  const old = before.get(unit.id);
  if (!old) { added.push(unit.id); continue; }
  if (old.cost !== unit.cost) {
    // The full skills are stored, not just the costs, so this record can be the
    // newest link in the review chain: a later pass has to compare against what
    // this pass actually produced, not against an older pass's terminal state.
    costChanges.push({
      id: unit.id, nameKo: unit.nameKo, oldCost: old.cost, newCost: unit.cost,
      before: old.skill, after: unit.skill,
    });
  }
  if (styleOf(old) !== styleOf(unit)) {
    styleChanges.push({ id: unit.id, nameKo: unit.nameKo, from: styleOf(old), to: styleOf(unit) });
  }
  if (hash(old.skill) === hash(unit.skill)) continue;

  // A run-style correction moves exactly one style-derived field — the
  // `vfx_dash_<style>` key — and the drawn poses are unaffected, so it is
  // compared with that key set aside rather than counted as a motion change.
  const a = motionContract(old.skill);
  const b = motionContract(unit.skill);
  if (a.vfxKey !== b.vfxKey
    && String(a.vfxKey).startsWith('vfx_dash_') && String(b.vfxKey).startsWith('vfx_dash_')) {
    delete a.vfxKey; delete b.vfxKey;
  }
  if (hash(a) === hash(b)) {
    valueOnly.push({
      id: unit.id, nameKo: unit.nameKo,
      previousSkillSignature: hash(old.skill), skillSignature: hash(unit.skill),
      before: old.skill, after: unit.skill,
    });
  } else if (undrawn(unit.id)) {
    motionChangedBeforeArt.push({
      id: unit.id, nameKo: unit.nameKo,
      reason: '원화가 아직 발주 대기 상태이므로 계약 변경에 재작업 비용이 없다.',
    });
  } else {
    motionChanged.push({ id: unit.id, nameKo: unit.nameKo, before: a, after: b });
  }
}

mkdirSync(OUT, { recursive: true });
const record = {
  date: new Date().toISOString().slice(0, 10),
  note: '추입 로스터 추가 3인 및 그에 따른 코스트 재배정. 스킬 수치는 코스트를 따라 움직였고, 몸동작 계약(포즈·대상·타이밍)이 바뀐 유닛은 아래 motionChanged에 실린다.',
  contract: '몸동작 계약 = 스킬에서 baseValues·starMultipliers·description과 피해/보호막/회복 수치를 제거한 나머지. 각질 교정이 옮기는 vfx_dash_<각질> 키도 제외한다 — 엔진이 그리는 이펙트라 원화의 포즈와 무관하다. 이 값이 같으면 기존 원화를 그대로 쓴다.',
  added,
  costChanges: costChanges.sort((x, y) => x.nameKo.localeCompare(y.nameKo)),
  styleChanges,
  valueOnly: valueOnly.sort((x, y) => x.nameKo.localeCompare(y.nameKo)),
  motionChangedBeforeArt,
  motionChanged,
};
writeFileSync(path.join(OUT, 'cost-skill-compatibility-2026-09-15.json'), JSON.stringify(record, null, 2) + '\n');

console.log(`roster change review — 신규 ${added.length}명, 코스트 변경 ${costChanges.length}명, 각질 변경 ${styleChanges.length}명`);
console.log(`  스킬 수치만 변경(원화 재사용 가능): ${valueOnly.length}명`);
console.log(`  몸동작 계약 변경, 원화 발주 전(비용 없음): ${motionChangedBeforeArt.length}명`);
for (const m of motionChangedBeforeArt) console.log(`    - ${m.nameKo} (${m.id})`);
console.log(`  몸동작 계약 변경, 원화 납품 완료(재작업 필요): ${motionChanged.length}명`);
for (const m of motionChanged) console.log(`    - ${m.nameKo} (${m.id})`);
