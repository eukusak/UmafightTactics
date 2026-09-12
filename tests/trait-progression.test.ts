import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { ALL_UNITS, SEASONS, getSeasonUnits, getUnitDef } from '../src/game/engine/roster';
import { TRAIT_BY_ID, getTrait, activeTierIndex } from '../src/game/engine/traits/trait-defs';
import { BattleEngine, type BattleSideInput } from '../src/game/engine/battle/engine';
import { stat } from '../src/game/engine/battle/combat-unit';
import { Rng } from '../src/game/engine/rng';
import { createMatch } from '../src/game/engine/rounds/director';
import { newInstance } from '../src/game/engine/shop';
import { activeTraitCounts } from '../src/game/engine/ai';
import type { SkillDef } from '../src/game/engine/types';

describe('late trait progression', () => {
  it('keeps 30 broad traits at four or five ordered, reachable tiers', () => {
    expect([...TRAIT_BY_ID.values()].filter(t => t.tiers.length >= 4)).toHaveLength(30);
    for (const trait of TRAIT_BY_ID.values()) {
      expect(trait.thresholds).toEqual(trait.tiers.map(t => t.count));
      expect(trait.thresholds).toEqual([...new Set(trait.thresholds)].sort((a, b) => a - b));
      expect(trait.thresholds.at(-1)).toBeLessThanOrEqual(10);
      for (let i = 0; i < trait.tiers.length; i++) {
        expect(activeTierIndex(trait, trait.thresholds[i] - 1)).toBe(i - 1);
        expect(activeTierIndex(trait, trait.thresholds[i])).toBe(i);
      }
    }
    for (const id of ['nige', 'senko', 'sashi', 'oikomi', 'middle', 'heisei_dynasty'] as const) {
      expect(getTrait(id).thresholds).toEqual([2, 4, 6, 8, 10]);
    }
  });

  it('requires additional trait grants for nine sprinters in every season', () => {
    for (const season of SEASONS) {
      const natural = getSeasonUnits(season.id).filter(u => u.traits.includes('sprinter'));
      expect(natural.length).toBeLessThan(9);
      const state = createMatch({ seed: 41, seasonId: season.id });
      const player = state.players[0];
      player.level = 9;
      const donors = getSeasonUnits(season.id).filter(u => !u.traits.includes('sprinter')).slice(0, 9 - natural.length);
      player.board = [...natural, ...donors].map((u, i) => ({ ...newInstance(state, u.id, 1), position: { q: i % 7, r: Math.floor(i / 7) } }));
      expect(activeTierIndex(getTrait('sprinter'), activeTraitCounts(player, player.board).get('sprinter')!)).toBeLessThan(3);
      for (const unit of player.board.slice(natural.length)) unit.items.push('emblem_sprinter');
      expect(activeTraitCounts(player, player.board).get('sprinter')).toBe(9);
      expect(activeTierIndex(getTrait('sprinter'), 9)).toBe(3);
      // A duplicate body and an emblem on a native member cannot inflate the count.
      player.board[0].items.push('emblem_sprinter');
      player.board.push({ ...newInstance(state, natural[0].id, 1), position: { q: 2, r: 1 } });
      expect(activeTraitCounts(player, player.board).get('sprinter')).toBe(9);
    }
  });

  it('applies only the reached eighth/tenth tier in real combat, to members only', () => {
    const roster = ALL_UNITS.filter(u => !u.traits.includes('nige')).slice(0, 11);
    const run = (count: number) => {
      const side = (id: string): BattleSideInput => ({ playerId: id, augments: [], tacticianItems: [], units: roster.map((u, i) => ({
        instanceId: id + i, unitDefId: u.id, star: 1, items: [], position: { q: i % 7, r: Math.floor(i / 7) }, extraTraits: id === 'a' && i < count ? ['nige'] : [],
      })) });
      const engine = new BattleEngine(side('a'), side('b'), new Rng(9), { maxSeconds: 0 });
      engine.run();
      return engine;
    };
    const baseline = run(0), eight = run(8), ten = run(10);
    const speed = (e: BattleEngine, i: number) => stat(e.units[i], 'attackSpeed', 0);
    // No cumulative +10/+22/+38: the increment is precisely the top tier's modifier.
    expect(speed(eight, 0) - speed(baseline, 0)).toBeCloseTo(eight.units[0].base.attackSpeed * .55);
    expect(speed(ten, 0) - speed(baseline, 0)).toBeCloseTo(ten.units[0].base.attackSpeed * .8);
    expect(speed(ten, 10)).toBe(speed(baseline, 10));
  });
});

describe('five-cost style distribution and motion compatibility', () => {
  it.each(SEASONS)('$id offers two five-cost units in each running style', season => {
    const five = getSeasonUnits(season.id).filter(u => u.cost === 5);
    expect(five).toHaveLength(8);
    for (const style of ['nige', 'senko', 'sashi', 'oikomi']) expect(five.filter(u => u.traits[0] === style)).toHaveLength(2);
    for (const role of new Set(five.map(u => u.role))) expect(five.filter(u => u.role === role).length / 8).toBeLessThanOrEqual(.45);
  });

  it('changes six costs and power values without changing any animation contract', () => {
    const review = JSON.parse(readFileSync('docs/qa/trait-progression/cost-skill-compatibility.json', 'utf8')) as { units: Record<string, { fromCost: number; toCost: number; previousSkill: SkillDef; previousSkillSignature: string; skillSignature: string }> };
    const motionContract = (skill: SkillDef) => {
      const shape: Partial<SkillDef> = structuredClone(skill);
      delete shape.baseValues;
      delete shape.starMultipliers;
      delete shape.description;
      for (const effect of shape.effects!) if (['DAMAGE', 'SHIELD_FLAT', 'HEAL'].includes(effect.kind) || (effect.kind === 'STAT_MUL' && (effect.value ?? 0) > 0)) delete effect.value;
      return shape;
    };
    const hash = (s: SkillDef) => createHash('sha256').update(JSON.stringify(s)).digest('hex');
    expect(Object.values(review.units).filter(e => e.fromCost !== e.toCost)).toHaveLength(6);
    for (const [id, entry] of Object.entries(review.units)) {
      const unit = getUnitDef(id);
      expect(unit.cost).toBe(entry.toCost);
      expect(Math.abs(entry.toCost - entry.fromCost)).toBeLessThanOrEqual(1);
      expect(hash(entry.previousSkill)).toBe(entry.previousSkillSignature);
      expect(hash(unit.skill)).toBe(entry.skillSignature);
      expect(motionContract(unit.skill)).toEqual(motionContract(entry.previousSkill));
    }
  });
});
