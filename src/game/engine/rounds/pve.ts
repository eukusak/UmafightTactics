/** PvE encounters and loot (spec §21). PvE units never touch the shared pool. */
import { COMPONENT_IDS } from '../items/item-defs';
import type { Rng } from '../rng';
import type { BattleSideInput } from '../battle/engine';
import type { Hex } from '../battle/hex';

export type PveEnemyId =
  | 'training_dummy' | 'track_golem' | 'supply_robot' | 'trophy_guardian' | 'grand_trophy_guardian';

export type PveEnemyDef = {
  id: PveEnemyId;
  nameKo: string;
  /** Stand-in unit def used for stats; PvE bodies are built from a scaled template. */
  count: number;
  hp: number;
  attackDamage: number;
  armor: number;
  magicResist: number;
  attackSpeed: number;
  attackRange: 1 | 2 | 3 | 4;
  positions: Hex[];
};

const line = (qs: number[], r: number): Hex[] => qs.map((q) => ({ q, r }));

export const PVE_ENEMIES: Record<PveEnemyId, PveEnemyDef> = {
  training_dummy: {
    id: 'training_dummy', nameKo: '연습용 허수아비', count: 3,
    hp: 520, attackDamage: 26, armor: 12, magicResist: 12, attackSpeed: 0.55, attackRange: 1,
    positions: line([2, 3, 4], 1),
  },
  track_golem: {
    id: 'track_golem', nameKo: '트랙 골렘', count: 4,
    hp: 780, attackDamage: 38, armor: 26, magicResist: 18, attackSpeed: 0.6, attackRange: 1,
    positions: [...line([2, 3, 4], 1), { q: 3, r: 0 }],
  },
  supply_robot: {
    id: 'supply_robot', nameKo: '보급 로봇', count: 4,
    hp: 900, attackDamage: 46, armor: 28, magicResist: 28, attackSpeed: 0.65, attackRange: 2,
    positions: [...line([1, 3, 5], 1), { q: 3, r: 0 }],
  },
  trophy_guardian: {
    id: 'trophy_guardian', nameKo: '트로피 수호자', count: 5,
    hp: 1250, attackDamage: 62, armor: 34, magicResist: 34, attackSpeed: 0.7, attackRange: 2,
    positions: [...line([1, 2, 4, 5], 1), { q: 3, r: 0 }],
  },
  grand_trophy_guardian: {
    id: 'grand_trophy_guardian', nameKo: '그랜드 트로피 수호자', count: 6,
    hp: 1900, attackDamage: 88, armor: 44, magicResist: 44, attackSpeed: 0.78, attackRange: 2,
    positions: [...line([1, 2, 4, 5], 1), { q: 2, r: 0 }, { q: 4, r: 0 }],
  },
};

/** Which encounter a PvE round uses; later stages escalate. */
export function pveEnemyFor(stage: number, round: number): PveEnemyId {
  if (stage === 1) return round === 1 ? 'training_dummy' : round === 2 ? 'track_golem' : 'supply_robot';
  if (stage <= 3) return 'trophy_guardian';
  return 'grand_trophy_guardian';
}

/** Scales the encounter so it keeps pace with the players' boards. */
export function pveScale(stage: number): number {
  // Opening training must be clearable with the draft starter, before the player can build a team.
  if (stage === 1) return .35;
  const scale = 1 + Math.max(0, stage - 1) * 0.28;
  return scale * (stage === 4 ? .88 : stage === 5 ? .9 : 1);
}

export type OrbTier = 'GRAY' | 'BLUE' | 'GOLD';

export type PveLoot = {
  gold: number;
  components: string[];
  completedAnvil: number;
  cloneToken: number;
  removers: number;
  reforgers: number;
};

/** Spec §21 — reward orbs; a PvE loss drops the reward one tier. */
export function rollPveLoot(rng: Rng, stage: number, won: boolean): PveLoot {
  const loot: PveLoot = { gold: 0, components: [], completedAnvil: 0, cloneToken: 0, removers: 1, reforgers: 0 };
  const tiers: OrbTier[] = stage === 1
    ? ['GRAY', 'GRAY', 'BLUE']
    : stage <= 3
      ? ['GRAY', 'BLUE', 'BLUE']
      : ['BLUE', 'BLUE', 'GOLD'];

  const downgrade = (t: OrbTier): OrbTier => (t === 'GOLD' ? 'BLUE' : t === 'BLUE' ? 'GRAY' : 'GRAY');

  for (const raw of tiers) {
    const tier = won ? raw : downgrade(raw);
    switch (tier) {
      case 'GRAY':
        loot.gold += rng.int(1, 4);
        break;
      case 'BLUE':
        if (rng.bool(0.55)) loot.components.push(rng.pick(COMPONENT_IDS as readonly string[]));
        else loot.gold += rng.int(2, 5);
        break;
      case 'GOLD': {
        const roll = rng.int(0, 3);
        if (roll === 0) loot.completedAnvil += 1;
        else if (roll === 1) loot.cloneToken += 1;
        else loot.gold += rng.int(5, 9);
        break;
      }
    }
  }
  // Guaranteed ordinary components prevent gold-only PvE rounds. Special
  // spatula/pan components remain bonus orb drops, outside this minimum.
  const minimum = !won || stage === 1 ? 1 : stage <= 3 ? 2 : 3;
  while (loot.components.filter(id => id !== 'factor_badge' && id !== 'support_card').length < minimum)
    loot.components.push(rng.pick(COMPONENT_IDS.slice(0, 8)));
  loot.reforgers = stage === 2 || (stage > 2 && rng.bool(.35)) ? 1 : 0;
  return loot;
}

/**
 * Builds the PvE side. Enemies reuse the battle unit shape via a synthetic
 * "unit def" override applied by the caller, so no roster unit is consumed.
 */
export function buildPveSide(enemyId: PveEnemyId, stage: number): {
  def: PveEnemyDef; scale: number; side: Omit<BattleSideInput, 'units'> & { positions: Hex[] };
} {
  const def = PVE_ENEMIES[enemyId];
  return {
    def,
    scale: pveScale(stage),
    side: { playerId: `pve:${enemyId}`, augments: [], tacticianItems: [], positions: def.positions },
  };
}
