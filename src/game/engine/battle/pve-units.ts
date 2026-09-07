/**
 * Synthetic unit definitions for the 5 PvE enemies.
 *
 * They are registered with the roster lookup so the battle engine can build them
 * like any other unit, but they are deliberately kept out of ALL_UNITS /
 * ACTIVE_UNITS, so they never reach the shop, the shared pool or the collection.
 */
import { PVE_ENEMIES, type PveEnemyId } from '../rounds/pve';
import { registerSyntheticUnit } from '../roster';
import type { SkillDef, UnitDef } from '../types';

const pveSkill = (id: string, name: string, damage: number): SkillDef => ({
  id: `skill_${id}`,
  displayName: name,
  template: 'AOE_BURST',
  baseValues: [damage],
  starMultipliers: [1, 1, 1],
  damageType: 'MAGIC',
  targetRule: 'LARGEST_ENEMY_CLUSTER',
  manaCost: 100,
  effects: [{ kind: 'DAMAGE', value: damage, damageType: 'MAGIC', target: 'LARGEST_ENEMY_CLUSTER', radius: 1 }],
  vfxKey: 'vfx_aoe_burst',
  description: `주변 적에게 ${damage} 마법피해.`,
});

export const PVE_UNIT_IDS: Record<PveEnemyId, string> = {
  training_dummy: 'pve_training_dummy',
  track_golem: 'pve_track_golem',
  supply_robot: 'pve_supply_robot',
  trophy_guardian: 'pve_trophy_guardian',
  grand_trophy_guardian: 'pve_grand_trophy_guardian',
};

function makePveUnitDef(enemyId: PveEnemyId): UnitDef {
  const e = PVE_ENEMIES[enemyId];
  const id = PVE_UNIT_IDS[enemyId];
  return {
    id,
    horseId: `PVE-${enemyId}`,
    nameKo: e.nameKo,
    nameJa: '',
    nameEn: enemyId,
    cost: 1,
    role: 'BRUISER',
    activeS1: false,
    uftRating: 0,
    hp: e.hp,
    attackDamage: e.attackDamage,
    abilityPower: 100,
    armor: e.armor,
    magicResist: e.magicResist,
    attackSpeed: e.attackSpeed,
    attackRange: e.attackRange,
    moveSpeedHexPerSec: 1.6,
    critChance: 0,
    critMultiplier: 1.3,
    startMana: 0,
    maxMana: 100,
    // PvE bodies carry no traits, so they never activate a player's synergies.
    traits: [],
    skillId: `skill_${id}`,
    skill: pveSkill(id, `${e.nameKo}의 반격`, Math.round(e.attackDamage * 2.2)),
    source: {
      powerIndex: 0,
      stats: { speed: 0, stamina: 0, power: 0, guts: 0, intelligence: 0 },
      birthYear: 0,
      signatureId: '',
      signatureName: '',
      archetype: 'PVE',
      primaryStyle: 'senko',
      bestDistance: 'middle',
      dataConfidence: 'PVE',
      historySummary: { starts: 0, wins: 0, mainWin: null, gradeWins: {} },
      legacyTier: 0,
      legacyStarterCost: 0,
    },
  } as UnitDef;
}

let registered = false;

export function registerPveUnits(): void {
  if (registered) return;
  registered = true;
  for (const id of Object.keys(PVE_ENEMIES) as PveEnemyId[]) {
    registerSyntheticUnit(makePveUnitDef(id));
  }
}

registerPveUnits();
