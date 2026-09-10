import { describe, expect, it } from 'vitest';
import { BattleEngine, type BattleSideInput } from '../src/game/engine/battle/engine';
import { applyEffect, resolveEffectTargets, type EffectContext } from '../src/game/engine/battle/effects';
import { heal } from '../src/game/engine/battle/combat-unit';
import { ALL_UNITS, getUnitDef } from '../src/game/engine/roster';
import { Rng } from '../src/game/engine/rng';
import type { EffectDef, StatusKind, TraitId } from '../src/game/engine/types';
import evidence from '../src/data/manual/race-evidence.json';
import profiles from '../src/data/manual/skill-profiles.json';
import corrections from '../src/data/manual/trait-corrections.json';
import { skillMotionFrame } from '../src/game/ui/frame-animation';
import { skillTimeline } from '../src/game/engine/battle/skill-timeline';

function setup() {
  const side = (playerId: string): BattleSideInput => ({ playerId, augments: [], tacticianItems: [],
    units: Array.from({ length: 5 }, (_, i) => ({ instanceId: String(i), unitDefId: 'special_week', star: 1, items: [], position: { q: i, r: 0 } })) });
  const e = new BattleEngine(side('A'), side('B'), new Rng(4));
  const self = e.units[0], foes = e.units.filter(u => u.team === 'B'), allies = e.units.filter(u => u.team === 'A');
  self.cell = { q: 0, r: 2 };
  foes.forEach((u, i) => { u.cell = { q: i + 1, r: 2 }; u.hp = u.maxHp = 1000; });
  allies.slice(1).forEach((u, i) => { u.cell = { q: i + 1, r: 0 }; });
  const ctx: EffectContext = { now: 0, overtime: false, units: e.units,
    dealDamage: (_s, t, amount) => { const actual = Math.min(t.hp, amount); t.hp -= actual; t.alive = t.hp > 0; return amount; },
    applyStatus: () => {}, dash: () => {}, summon: () => {} };
  const apply = (effect: EffectDef) => applyEffect(ctx, self, effect, 0, { sourceKey: 'skill:test', event: 'ON_CAST', power: 1, currentTarget: foes[0] });
  return { e, ctx, self, foes, allies, apply };
}

describe('spatial skills and conditional effects', () => {
  it('hits a line but excludes off-axis and behind targets; a cone admits its flank', () => {
    const { ctx, self, foes } = setup();
    foes[2].cell = { q: 2, r: 3 }; foes[3].cell = { q: 0, r: 0 }; foes[4].cell = { q: 6, r: 2 };
    const effect: EffectDef = { kind: 'DAMAGE', target: 'CURRENT_TARGET', shape: 'LINE', range: 4, maxTargets: 4 };
    expect(resolveEffectTargets(ctx, self, effect, foes[0]).map(u => u.id)).toEqual([foes[0].id, foes[1].id]);
    expect(resolveEffectTargets(ctx, self, { ...effect, shape: 'CONE' }, foes[0])).toContain(foes[2]);
  });
  it('chains only across reachable distinct enemies and respects untargetability', () => {
    const { ctx, self, foes } = setup();
    foes[1].aura.untargetableUntil = 10; foes[3].cell = { q: 6, r: 7 }; foes[4].alive = false;
    const hit = resolveEffectTargets(ctx, self, { kind: 'DAMAGE', target: 'CURRENT_TARGET', shape: 'CHAIN', range: 2, maxTargets: 4 }, foes[0]);
    expect(hit.map(u => u.id)).toEqual([foes[0].id, foes[2].id]);
  });
  it('selects a bounded ally chain without healing enemies', () => {
    const { ctx, self, allies } = setup();
    allies[1].cell = { q: 1, r: 2 }; allies[1].hp = 1; allies[2].cell = { q: 2, r: 2 };
    const hit = resolveEffectTargets(ctx, self, { kind: 'HEAL', target: 'LOWEST_HP_ALLY', shape: 'CHAIN', range: 2, maxTargets: 3 }, null);
    expect(hit[0]).toBe(allies[1]); expect(hit).toHaveLength(3); expect(hit.every(u => u.team === self.team)).toBe(true);
  });
  it('honors nearby ally radii and does not impose a new cap on global traits', () => {
    const { ctx, self, allies } = setup(); allies[1].cell = { q: 1, r: 2 };
    expect(resolveEffectTargets(ctx, self, { kind: 'SHIELD_FLAT', target: 'ALL_ALLIES', radius: 1 }, null)).toEqual([self, allies[1]]);
    expect(resolveEffectTargets(ctx, self, { kind: 'HEAL', target: 'ALL_ALLIES' }, null)).toHaveLength(5);
  });
  it('cleanses control while retaining wounds and burn', () => {
    const { self, apply } = setup();
    self.statuses = (['STUN','SILENCE','DISARM','SLOW','TAUNT','WOUND','BURN'] as StatusKind[]).map(kind => ({ kind, expiresAt: 10, sourceId: 'other' }));
    apply({ kind: 'CLEANSE', target: 'SELF' }); expect(self.statuses.map(s => s.kind)).toEqual(['WOUND','BURN']);
  });
  it('drains mana to zero and refunds only a killing blow, capped by max mana', () => {
    const { self, foes, apply } = setup(); foes[0].mana = 5;
    apply({ kind: 'MANA_DRAIN', value: 15, target: 'CURRENT_TARGET' }); expect(foes[0].mana).toBe(0);
    self.mana = 0; const hit: EffectDef = { kind: 'DAMAGE', value: 5, onKillMana: 25, target: 'CURRENT_TARGET' };
    apply(hit); expect(self.mana).toBe(0); foes[0].hp = 1; self.mana = self.base.maxMana - 2;
    apply(hit); expect(self.mana).toBe(self.base.maxMana); apply(hit); expect(self.mana).toBe(self.base.maxMana);
  });
  it('leech ignores absorbed damage and overkill, and respects wounds', () => {
    const { ctx, self, foes, apply } = setup(); self.hp = 100; self.maxHp = 1000;
    ctx.dealDamage = () => 500;
    apply({ kind: 'DAMAGE', value: 500, leech: .5, target: 'CURRENT_TARGET' }); expect(self.hp).toBe(100);
    ctx.dealDamage = (_s, t) => { t.hp = 0; t.alive = false; return 500; }; foes[0].hp = 20;
    apply({ kind: 'DAMAGE', value: 500, leech: .5, target: 'CURRENT_TARGET' }); expect(self.hp).toBe(110);
    self.statuses.push({ kind: 'WOUND', expiresAt: 5, sourceId: 'other', magnitude: .33 });
    const before = self.hp; heal(self, 100, 0); expect(self.hp - before).toBeLessThan(100);
  });
  it('scales flat skill shields with star power while item shields stay unscaled', () => {
    const { ctx, self } = setup();
    const shield: EffectDef = { kind: 'SHIELD_FLAT', value: 100, duration: 4, target: 'SELF' };
    applyEffect(ctx, self, shield, 0, { sourceKey: 'skill:test', event: 'ON_CAST', power: 1.8, currentTarget: null });
    expect(self.shields.at(-1)?.amount).toBe(180);
    applyEffect(ctx, self, shield, 0, { sourceKey: 'item:test', event: 'ON_CAST', power: 1, currentTarget: null });
    expect(self.shields.at(-1)?.amount).toBe(100);
  });
  it('grants isolation damage only without living nearby teammates', () => {
    const { ctx, self, foes } = setup();
    const hit: EffectDef = { kind: 'DAMAGE', value: 100, isolatedMultiplier: 1.4, target: 'CURRENT_TARGET' };
    const use = () => applyEffect(ctx, self, hit, 0, { sourceKey: 'skill:test', event: 'ON_CAST', power: 1, currentTarget: foes[0] });
    use(); expect(foes[0].hp).toBe(900); foes.slice(1).forEach(u => { u.alive = false; });
    use(); expect(foes[0].hp).toBe(760);
  });
});

describe('authored roster and race evidence', () => {
  it('casts all 145 kits at every star level without non-finite combat state', () => {
    for (const u of ALL_UNITS) for (const star of [1, 2, 3] as const) {
      const side = (playerId: string): BattleSideInput => ({ playerId, augments: [], tacticianItems: [],
        units: [{ instanceId: 'unit', unitDefId: u.id, star, items: [], position: { q: 3, r: 0 } }] });
      const e = new BattleEngine(side('A'), side('B'), new Rng(719), { maxSeconds: 2.5 });
      for (const unit of e.units) { unit.base.startMana = unit.base.maxMana; unit.base.hp = 100000; unit.base.attackRange = 4; unit.attackCooldown = 20; }
      const result = e.run();
      expect(result.events.some(ev => ev.type === 'CAST'), u.id).toBe(true);
      expect(e.units.every(unit => Number.isFinite(unit.hp) && Number.isFinite(unit.mana)), u.id).toBe(true);
    }
  });

  it('has 145 finite profiles, explicit race IDs, and truthful race results', () => {
    expect(Object.keys(profiles.units)).toHaveLength(145);
    for (const [id, p] of Object.entries(profiles.units)) {
      expect(Number.isFinite(p.powerScale)).toBe(true);
      const race = evidence.units[id as keyof typeof evidence.units].representative;
      expect(p.representativeRaceId).toBe(race.race_id);
      expect(getUnitDef(id).skill.description).toContain(race.race_name);
      expect(getUnitDef(id).skill.description).toContain(race.finish_rank + '위');
    }
    expect(evidence.units.haru_urara.representative.finish_rank).toBe(2);
    expect(evidence.units.tokai_teio.representative.race_date).toContain('1993');
    expect(evidence.units.silence_suzuka.representative.race_name).toContain('GII');
  });
  it('applies all twelve documented distance corrections', () => {
    for (const [id, c] of Object.entries(corrections.units)) {
      expect(getUnitDef(id).traits).toContain(c.to as TraitId);
      expect(evidence.units[id as keyof typeof evidence.units].distanceRecommendation).toBe(c.to);
    }
  });
  it('keeps every release within its skill row, and channels hold the release pose', () => {
    for (const u of ALL_UNITS) {
      const timeline = skillTimeline(u.skill);
      for (const e of timeline) {
        expect(skillMotionFrame(u.skill, e.at + 1e-7)).toBe(14);
      }
      expect(skillMotionFrame(u.skill, (timeline.at(-1)?.at ?? 0) + 1)).toBe(15);
    }
    const beam = getUnitDef('silence_suzuka').skill;
    expect(skillMotionFrame(beam, .8)).toBe(14);
  });
});
