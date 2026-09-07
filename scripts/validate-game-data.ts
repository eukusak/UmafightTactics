/**
 * Hard gate over src/data/generated/. Everything spec §37.2 lists is checked
 * here so a bad data build can never reach the game or the test suite.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

import {
  ACTIVE_S1_SIZE, CANONICAL_ROSTER_SIZE, COST_UNIT_COUNTS, MAX_LEVEL, POOL_COPIES, SHOP_ODDS,
} from '../src/game/engine/constants';
import { TRAIT_DEFS } from '../src/game/engine/traits/trait-defs';
import { ALL_ITEM_DEFS, COMPLETED_ITEM_DEFS, COMPONENT_DEFS, RECIPE_KEY } from '../src/game/engine/items/item-defs';
import { AUGMENT_DEFS } from '../src/game/engine/augments/augment-defs';
import { UnitDefSchema, ArtManifestSchema } from '../src/game/engine/schema';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GEN = path.join(ROOT, 'src', 'data', 'generated');
const SRC = path.join(ROOT, 'src', 'data', 'source');

const readJson = <T>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T;

const failures: string[] = [];
const check = (ok: boolean, message: string): void => {
  if (!ok) failures.push(message);
};

console.log('data:validate — checking generated data');

// ------------------------------------------------------------ source integrity
const source = readJson<{ horses: Array<{ id: string; priority: string }> }>(path.join(SRC, 'horse-game-db.json'));
const validation = readJson<{ horseCount: number; p0Count: number; missingStats: number }>(
  path.join(SRC, 'horse-game-db.validation.json'),
);
check(source.horses.length === 331, `source horses ${source.horses.length} != 331`);
check(validation.horseCount === 331, `validation.horseCount ${validation.horseCount} != 331`);
check(validation.p0Count === 145, `validation.p0Count ${validation.p0Count} != 145`);
check(validation.missingStats === 0, `validation.missingStats ${validation.missingStats} != 0`);
check(
  source.horses.filter((h) => h.priority === 'P0').length === CANONICAL_ROSTER_SIZE,
  'source P0 count != 145',
);

// -------------------------------------------------------------------- units
const allUnits = readJson<{ rosterHash: string; units: unknown[] }>(path.join(GEN, 'all-units.json'));
const parsed = z.array(UnitDefSchema).safeParse(allUnits.units);
if (!parsed.success) {
  failures.push(`all-units.json failed schema validation: ${parsed.error.issues.slice(0, 5).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
}
const units = parsed.success ? parsed.data : [];

check(units.length === CANONICAL_ROSTER_SIZE, `unit count ${units.length} != ${CANONICAL_ROSTER_SIZE}`);
check(new Set(units.map((u) => u.id)).size === units.length, 'duplicate unit ids');
check(new Set(units.map((u) => u.nameKo)).size === units.length, 'duplicate unit nameKo');
check(new Set(units.map((u) => u.horseId)).size === units.length, 'duplicate horseId');
check(units.every((u) => /^[a-z0-9_]+$/.test(u.id)), 'unit ids must be lowercase snake_case ASCII');

const active = units.filter((u) => u.activeS1);
check(active.length === ACTIVE_S1_SIZE, `active roster ${active.length} != ${ACTIVE_S1_SIZE}`);

for (const cost of [1, 2, 3, 4, 5] as const) {
  const n = active.filter((u) => u.cost === cost).length;
  check(n === COST_UNIT_COUNTS[cost], `cost ${cost}: ${n} active units, expected ${COST_UNIT_COUNTS[cost]}`);
}

const traitIds = new Set(TRAIT_DEFS.map((t) => t.id));
for (const u of units) {
  check(u.traits.length >= 3, `${u.id} has ${u.traits.length} traits, expected at least 3`);
  check(u.traits.length <= (u.cost === 5 ? 4 : 3), `${u.id} has too many traits for cost ${u.cost}`);
  check(new Set(u.traits).size === u.traits.length, `${u.id} has duplicate traits`);
  for (const t of u.traits) check(traitIds.has(t), `${u.id} references unknown trait "${t}"`);
  check(u.skill.id === u.skillId, `${u.id} skillId/skill.id mismatch`);
  check(u.hp > 0 && u.attackDamage > 0 && u.attackSpeed > 0, `${u.id} has a non-positive core stat`);
  check(u.startMana >= 0 && u.startMana <= u.maxMana, `${u.id} start mana out of range`);
  check(u.attackRange >= 1 && u.attackRange <= 4, `${u.id} attack range out of range`);
  check(Number.isFinite(u.moveSpeedHexPerSec) && u.moveSpeedHexPerSec > 0, `${u.id} bad move speed`);
}

// `emperor` is documented as a unique trait.
const emperorCount = units.filter((u) => u.traits.includes('emperor')).length;
check(emperorCount <= 1, `emperor is unique but ${emperorCount} units carry it`);

// Every trait must be reachable inside the active roster.
for (const t of TRAIT_DEFS) {
  const n = active.filter((u) => u.traits.includes(t.id)).length;
  check(n >= t.thresholds[0], `trait ${t.id} needs ${t.thresholds[0]} active units to activate but only ${n} exist`);
}

// Spec §7.4 role floor.
for (const role of ['TANK', 'BRUISER', 'AD_CARRY', 'AP_CARRY', 'SUPPORT'] as const) {
  const n = active.filter((u) => u.role === role).length;
  check(n >= 8, `role ${role} has ${n} active units, expected at least 8`);
}

// ------------------------------------------------------------- active set file
const activeSet = readJson<{ rosterHash: string; unitIds: string[]; byCost: Record<string, string[]> }>(
  path.join(GEN, 'active-set-s1.json'),
);
check(activeSet.rosterHash === allUnits.rosterHash, 'rosterHash mismatch between all-units and active-set');
check(activeSet.unitIds.length === ACTIVE_S1_SIZE, 'active-set unitIds size mismatch');
const activeIds = new Set(active.map((u) => u.id));
check(activeSet.unitIds.every((id) => activeIds.has(id)), 'active-set references a non-active unit');
for (const cost of [1, 2, 3, 4, 5] as const) {
  check(
    (activeSet.byCost[String(cost)] ?? []).length === COST_UNIT_COUNTS[cost],
    `active-set byCost[${cost}] size mismatch`,
  );
}

// -------------------------------------------------------------------- shop
for (let level = 1; level <= MAX_LEVEL; level += 1) {
  const sum = ([1, 2, 3, 4, 5] as const).reduce((acc, c) => acc + SHOP_ODDS[c][level - 1], 0);
  check(sum === 100, `shop odds for level ${level} sum to ${sum}, expected 100`);
}
for (const cost of [1, 2, 3, 4, 5] as const) {
  check(SHOP_ODDS[cost].length === MAX_LEVEL, `shop odds row ${cost} has ${SHOP_ODDS[cost].length} levels`);
  check(POOL_COPIES[cost] > 0, `pool copies for cost ${cost} must be positive`);
}

// -------------------------------------------------------------------- items
check(COMPONENT_DEFS.length === 10, `components ${COMPONENT_DEFS.length} != 10`);
check(COMPLETED_ITEM_DEFS.length === 55, `completed items ${COMPLETED_ITEM_DEFS.length} != 55`);
check(new Set(ALL_ITEM_DEFS.map((i) => i.id)).size === 65, 'duplicate item ids');

const recipeKeys = new Set<string>();
const componentIds = new Set(COMPONENT_DEFS.map((c) => c.id));
for (const item of COMPLETED_ITEM_DEFS) {
  check(item.components !== null, `${item.id} is a completed item with no recipe`);
  if (!item.components) continue;
  const [a, b] = item.components;
  check(componentIds.has(a) && componentIds.has(b), `${item.id} references a non-component: ${a}+${b}`);
  const key = RECIPE_KEY(a, b);
  check(!recipeKeys.has(key), `recipe ${key} produces more than one item (duplicate at ${item.id})`);
  recipeKeys.add(key);
}
check(recipeKeys.size === 55, `distinct recipes ${recipeKeys.size} != 55`);
// 10 components combine into 10*11/2 == 55 unordered pairs; every pair must be covered.
const expectedPairs: string[] = [];
const comps = [...componentIds];
for (let i = 0; i < comps.length; i += 1) {
  for (let j = i; j < comps.length; j += 1) expectedPairs.push(RECIPE_KEY(comps[i], comps[j]));
}
for (const key of expectedPairs) check(recipeKeys.has(key), `no completed item exists for recipe ${key}`);

const emblemItems = COMPLETED_ITEM_DEFS.filter((i) => i.grantsTrait);
check(emblemItems.length === 16, `emblem items ${emblemItems.length} != 16`);
for (const e of emblemItems) check(traitIds.has(e.grantsTrait!), `${e.id} grants unknown trait ${e.grantsTrait}`);
check(COMPLETED_ITEM_DEFS.filter((i) => i.tactician).length === 3, 'tactician items != 3');

// ----------------------------------------------------------------- augments
check(AUGMENT_DEFS.length === 48, `augments ${AUGMENT_DEFS.length} != 48`);
check(new Set(AUGMENT_DEFS.map((a) => a.id)).size === 48, 'duplicate augment ids');
for (const grade of ['S', 'G', 'P'] as const) {
  const n = AUGMENT_DEFS.filter((a) => a.grade === grade).length;
  check(n >= 3, `grade ${grade} has only ${n} augments; an offer of 3 would repeat`);
}
for (const a of AUGMENT_DEFS) {
  check(a.name.length > 0 && a.description.length > 0, `augment ${a.id} is missing name/description`);
}

// ----------------------------------------------------------------- traits
check(TRAIT_DEFS.length === 24, `traits ${TRAIT_DEFS.length} != 24`);
for (const t of TRAIT_DEFS) {
  check(t.thresholds.length === t.tiers.length, `${t.id}: thresholds/tiers length mismatch`);
  check(
    t.thresholds.every((v, i) => i === 0 || v > t.thresholds[i - 1]),
    `${t.id}: thresholds must strictly increase`,
  );
  t.tiers.forEach((tier, i) => {
    check(tier.count === t.thresholds[i], `${t.id} tier ${i} count != threshold`);
    check(tier.effects.length > 0, `${t.id} tier ${i} has no effects`);
  });
}

// ------------------------------------------------------------- art manifest
const manifestParsed = ArtManifestSchema.safeParse(readJson(path.join(GEN, 'art-manifest.json')));
if (!manifestParsed.success) {
  failures.push(`art-manifest.json failed schema validation: ${manifestParsed.error.issues[0]?.message}`);
} else {
  const m = manifestParsed.data;
  check(m.characters.length === CANONICAL_ROSTER_SIZE, `manifest characters ${m.characters.length} != 145`);
  check(m.characters.filter((c) => c.cutinRequired).length === 8, 'manifest must mark exactly 8 cut-ins');
  check(m.items.length === 65, `manifest items ${m.items.length} != 65`);
  check(m.traits.length === 24, `manifest traits ${m.traits.length} != 24`);
  check(m.augments.length === 48, `manifest augments ${m.augments.length} != 48`);
  check(m.status.length === 24, `manifest status icons ${m.status.length} != 24`);
  check(m.vfx.length === 24, `manifest vfx ${m.vfx.length} != 24`);
  check(m.starVfx.length === 3, `manifest star vfx ${m.starVfx.length} != 3`);
  check(m.pve.length === 5, `manifest pve ${m.pve.length} != 5`);
  check(m.boards.length === 8, `manifest boards ${m.boards.length} != 8`);
  check(m.banners.length === 12, `manifest banners ${m.banners.length} != 12`);
  const manifestIds = new Set(m.characters.map((c) => c.id));
  check(units.every((u) => manifestIds.has(u.id)), 'a unit is missing from the art manifest');
  for (const c of m.characters) {
    check(c.portrait === `portraits/${c.id}.png`, `manifest portrait path wrong for ${c.id}`);
    check(c.battleSheet === `characters/${c.id}.png`, `manifest battleSheet path wrong for ${c.id}`);
  }
}

// ---------------------------------------------------------------------- done
if (failures.length) {
  console.error(`\ndata:validate FAILED — ${failures.length} problem(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(
  `data:validate — OK (145 units / 60 active / ${COST_UNIT_COUNTS[1]}-${COST_UNIT_COUNTS[2]}-${COST_UNIT_COUNTS[3]}-${COST_UNIT_COUNTS[4]}-${COST_UNIT_COUNTS[5]} costs / 65 items / 24 traits / 48 augments)`,
);
