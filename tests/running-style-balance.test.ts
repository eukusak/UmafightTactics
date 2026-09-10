import { describe, expect, it } from 'vitest';
import { BattleEngine, type BattleSideInput } from '../src/game/engine/battle/engine';
import { applyEffect, type EffectContext } from '../src/game/engine/battle/effects';
import { cleanupExpired } from '../src/game/engine/battle/combat-unit';
import { Rng } from '../src/game/engine/rng';
import { ALL_UNITS, getUnitDef } from '../src/game/engine/roster';
import type { TraitId } from '../src/game/engine/types';
import evidence from '../src/data/manual/running-style-evidence.json';
import corrections from '../src/data/manual/running-style-corrections.json';
import { createMatch, RoundDirector } from '../src/game/engine/rounds/director';
import { boardTraitCounts } from '../scripts/lib/balance-observations';
function battle() {
  const ids = ALL_UNITS.filter((u) => !u.traits.includes('sashi'))
    .slice(0, 2)
    .map((u) => u.id);
  const side = (playerId: string): BattleSideInput => ({
    playerId,
    augments: [],
    tacticianItems: [],
    units: ids.map((unitDefId, i) => ({
      instanceId: String(i),
      unitDefId,
      star: 1,
      items: [],
      position: { q: i, r: 0 },
      extraTraits: playerId === 'A' ? ['sashi'] : [],
    })),
  });
  return new BattleEngine(side('A'), side('B'), new Rng(5), { maxSeconds: 1 });
}
describe('running styles and active trait effects', () => {
  it('uses supported early race positions for all twelve corrections', () => {
    expect(Object.keys(evidence.units)).toHaveLength(145);
    for (const [id, c] of Object.entries(corrections.units)) {
      const e = evidence.units[id as keyof typeof evidence.units];
      expect(e.validStarts).toBeGreaterThanOrEqual(8);
      expect(e.confidence).toBeGreaterThanOrEqual(0.6);
      expect(e.dominant).toBe(c.to);
      expect(e.previous).toBe(c.from);
      expect(getUnitDef(id).traits).toContain(c.to as TraitId);
      expect(getUnitDef(id).traits).not.toContain(c.from as TraitId);
    }
  });
  it('fires the real takedown event into a lasting, non-stacking crit buff', () => {
    const engine = battle();
    const [a, ally, b, other] = engine.units;
    for (const u of engine.units) {
      u.base.maxMana = 9999;
      u.mana = 0;
      u.attackCooldown = 999;
      u.base.attackRange = 4;
    }
    a.cell = { q: 3, r: 3 };
    ally.cell = { q: 0, r: 0 };
    b.cell = { q: 3, r: 4 };
    other.cell = { q: 6, r: 7 };
    a.attackCooldown = 0;
    a.base.attackDamage = 1000;
    b.hp = 1;
    const result = engine.run();
    expect(result.events.some((e) => e.type === 'DEATH' && e.unit === b.id)).toBe(true);
    const proc = a.timedEffects.find((e) => e.key.startsWith('trait:sashi:'));
    expect(proc).toBeDefined();
    expect(proc!.effect.trigger).toBeUndefined();
    expect(a.aura.critChance).toBeCloseTo(0.15);
    const ctx: EffectContext = {
      now: 2,
      overtime: false,
      units: engine.units,
      dealDamage: () => 0,
      applyStatus: () => {},
      dash: () => {},
      summon: () => {},
    };
    const effect = {
      kind: 'CRIT_CHANCE_ADD' as const,
      value: 0.1,
      duration: 6,
      trigger: { when: 'ON_TAKEDOWN_ASSIST' as const },
    };
    applyEffect(ctx, a, effect, 1, {
      sourceKey: 'trait:sashi:0',
      power: 1,
      currentTarget: b,
      event: 'ON_ASSIST',
    });
    expect(a.aura.critChance).toBeCloseTo(0.15);
    expect(a.timedEffects.filter((e) => e.key.startsWith('trait:sashi:'))).toHaveLength(1);
    expect(a.timedEffects[0].expiresAt).toBe(8);
    cleanupExpired(a, 8.01);
    expect(a.timedEffects).toHaveLength(0);
  });
  it('preserves top-four trait samples after eliminated boards are cleared', () => {
    const state = createMatch({ seed: 12, allAi: true, seasonId: 's1' });
    const d = new RoundDirector(state);
    d.beginPrep();
    for (let i = 0; i < 4; i++) {
      d.resolveRound();
      d.advance();
    }
    d.resolveRound(true);
    const snapshot = state.players.map((p) => boardTraitCounts(state, p.id));
    expect(snapshot.every((c) => c.size > 0)).toBe(true);
    for (const p of state.players) p.board = [];
    expect(snapshot.every((c) => c.size > 0)).toBe(true);
    expect(state.players.every((p) => boardTraitCounts(state, p.id).size === 0)).toBe(true);
  });
});
