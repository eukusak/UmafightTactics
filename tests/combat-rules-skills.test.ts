import { describe, it, expect } from 'vitest';
import { BattleEngine, type BattleSideInput } from '../src/game/engine/battle/engine';
import { ALL_UNITS, ACTIVE_BY_COST } from '../src/game/engine/roster';
import { Rng } from '../src/game/engine/rng';
import type { EffectDef, Role } from '../src/game/engine/types';
import { resistFor, stat } from '../src/game/engine/battle/combat-unit';
import { skillMotionFrame } from '../src/game/ui/frame-animation';
import { skillTimeline, skillWindup } from '../src/game/engine/battle/skill-timeline';

function fixture(seconds = 1, effects: EffectDef[] = [], windup = .3, enemyCount = 1): BattleEngine {
  const side = (id: string, count: number): BattleSideInput => ({ playerId: id, augments: [], tacticianItems: [],
    units: Array.from({ length: count }, (_, i) => ({ instanceId: String(i), unitDefId: ACTIVE_BY_COST[1][0].id,
      star: 1, items: [], position: { q: i, r: 0 } })) });
  const engine = new BattleEngine(side('A', 1), side('B', enemyCount), new Rng(91), { maxSeconds: seconds, recordFrames: true });
  for (const u of engine.units) {
    u.role = 'AD_CARRY'; u.base.hp = 100000; u.base.maxMana = 10000; u.base.startMana = 0;
    u.base.attackDamage = 1; u.base.attackSpeed = .1; u.base.attackRange = 4; u.attackCooldown = 20;
    u.skill = { ...u.skill, effects: [], targetRule: 'CURRENT_TARGET' };
    u.cell = u.team === 'A' ? { q: 3, r: 4 } : { q: 3, r: 3 };
  }
  if (effects.length) {
    const u = engine.units[0]; u.base.startMana = u.base.maxMana;
    u.skill = { ...u.skill, effects, choreography: { windup, recovery: .2, pulseInterval: .2, color: '#ffffff', variant: 'test' } };
  }
  return engine;
}
const damage: EffectDef = { kind: 'DAMAGE', value: 100, damageType: 'TRUE', target: 'CURRENT_TARGET' };

describe('public combat role rules', () => {
  it('gives fighters the published attack speed bonus at each stage', () => {
    const fighter = ALL_UNITS.find(u => u.role === 'BRUISER')!;
    for (const [stage, bonus] of [[1, 0], [2, .05], [3, .1], [4, .2], [5, .3], [6, .3]]) {
      const side: BattleSideInput = { playerId: 'fighter', augments: [], tacticianItems: [],
        units: [{ instanceId: 'one', unitDefId: fighter.id, star: 1, items: [], position: { q: 3, r: 0 } }] };
      const e = new BattleEngine(side, { ...side, playerId: 'other' }, new Rng(1), { stage });
      expect(stat(e.units[0], 'attackSpeed', 0) / e.units[0].base.attackSpeed - 1).toBeCloseTo(bonus);
    }
  });
  it.each([['TANK', 5, 0], ['BRUISER', 10, 0], ['AD_CARRY', 10, 0], ['AP_CARRY', 7, 2], ['SUPPORT', 7, 2]] as const)(
    '%s receives its attack mana and passive regeneration separately', (role, attack, regen) => {
      const e = fixture(1); e.units[0].role = role; e.units[0].attackCooldown = 0;
      const result = e.run();
      expect(result.events.filter(ev => ev.type === 'ATTACK' && ev.source === e.units[0].id)).toHaveLength(1);
      expect(e.units[0].mana).toBeCloseTo(attack + regen);
    });
  it.each(['TANK', 'BRUISER', 'AD_CARRY', 'AP_CARRY', 'SUPPORT'] as Role[])(
    'only tanks gain mana from incoming damage (%s)', role => {
      const e = fixture(.8); e.units[1].role = role; e.units[0].attackCooldown = 0;
      e.run();
      if (role === 'TANK') expect(e.units[1].mana).toBeGreaterThan(0);
      else expect(e.units[1].mana).toBeCloseTo(role === 'AP_CARRY' || role === 'SUPPORT' ? 1.6 : 0);
    });
  it('prefers a tank only on acquisition, retains an in-range target, and replaces an out-of-range target', () => {
    const selected = (old: boolean, outside: boolean) => {
      const e = fixture(.1, [], .3, 2), [u, carry, tank] = e.units;
      tank.role = 'TANK'; tank.cell = { q: 2, r: 4 }; carry.cell = outside ? { q: 3, r: 0 } : { q: 3, r: 3 };
      u.base.attackRange = 1; if (old) u.targetId = carry.id;
      e.run(); return { actual: u.targetId, tank: tank.id, carry: carry.id };
    };
    const fresh = selected(false, false); expect(fresh.actual).toBe(fresh.tank);
    const held = selected(true, false); expect(held.actual).toBe(held.carry);
    const moved = selected(true, true); expect(moved.actual).toBe(moved.tank);
  });
});

describe('skill timing and effect lifecycle', () => {
  it('advances a skill dash during recovery without allowing basic attacks', () => {
    const e = fixture(.5, [{ kind: 'DASH', value: 3, target: 'CURRENT_TARGET' }, damage]);
    e.units[1].cell = { q: 3, r: 1 };
    const result = e.run();
    expect(e.frames.some(f => f.units[0].casting && f.units[0].fromQ !== null && f.units[0].progress > 0)).toBe(true);
    expect(result.events.some(ev => ev.type === 'ATTACK_START')).toBe(false);
  });
  it('does no damage during preparation and emits VFX on the damage tick', () => {
    const early = fixture(.25, [damage]); expect(early.run().events.some(e => e.type === 'DAMAGE')).toBe(false);
    const e = fixture(.5, [damage]), result = e.run();
    const hit = result.events.find(ev => ev.type === 'DAMAGE')!;
    expect(hit.t).toBeCloseTo(.35);
    expect(result.events.some(ev => ev.type === 'SKILL_EFFECT' && ev.t === hit.t && ev.kind === 'DAMAGE')).toBe(true);
    expect(result.events.some(ev => ev.type === 'ATTACK_START')).toBe(false);
  });
  it('spreads three hits over three release ticks', () => {
    const e = fixture(.8, [{ ...damage, tag: 'REPEAT:3' }], 0);
    const times = e.run().events.filter(ev => ev.type === 'DAMAGE').map(ev => ev.t);
    expect(times).toHaveLength(3);
    times.forEach((t, i) => expect(t).toBeCloseTo(.05 + i * .2));
  });
  it('records every event exactly once, including the final outcome', () => {
    for (const value of [100, 200000]) {
      const e = fixture(1.3, [{ ...damage, value, tag: 'REPEAT:3' }], 0);
      const result = e.run();
      expect(e.frames.flatMap(f => f.events)).toEqual(result.events);
      expect(e.frames.at(-1)?.events.at(-1)?.type).toBe('END');
    }
  });
  it('cancels a pending cast when the caster is stunned before release', () => {
    const e = fixture(.8, [damage]);
    const enemy = e.units[1]; enemy.base.startMana = enemy.base.maxMana;
    enemy.skill = { ...enemy.skill, effects: [{ kind: 'APPLY_STATUS', status: 'STUN', duration: 1, target: 'CURRENT_TARGET' }],
      choreography: { windup: .1, recovery: .2, pulseInterval: .2, color: '#ffffff', variant: 'interrupt' } };
    const result = e.run();
    expect(result.events.some(ev => ev.type === 'CAST_CANCEL' && ev.source === e.units[0].id)).toBe(true);
    expect(result.events.some(ev => ev.type === 'DAMAGE')).toBe(false);
  });
  it('keeps a selected target for a delayed follow-up and reacquires after death', () => {
    const e = fixture(.6, [{ ...damage, value: 200000, tag: 'REPEAT:3' }], 0, 2);
    e.units[2].cell = { q: 2, r: 3 };
    const hits = e.run().events.filter(ev => ev.type === 'DAMAGE');
    expect(hits).toHaveLength(2);
    expect(new Set(hits.map(ev => ev.type === 'DAMAGE' && ev.target)).size).toBe(2);
  });
  it('expires resistance reduction and temporary crit bonuses', () => {
    const effects: EffectDef[] = [
      { kind: 'SUNDER_ARMOR_PCT', value: .25, duration: .2, target: 'CURRENT_TARGET' },
      { kind: 'CRIT_CHANCE_ADD', value: .15, duration: .2, target: 'SELF' },
    ];
    const during = fixture(.15, effects, 0); during.run();
    expect(resistFor(during.units[1], 'PHYSICAL', .15)).toBeCloseTo(stat(during.units[1], 'armor', .15) * .75);
    expect(during.units[0].aura.critChance).toBeCloseTo(.15);
    const after = fixture(.5, effects, 0); after.run();
    expect(resistFor(after.units[1], 'PHYSICAL', .5)).toBeCloseTo(stat(after.units[1], 'armor', .5));
    expect(after.units[0].aura.critChance).toBe(0);
  });
  it('covers the whole roster with 42 mechanical variants and matching release poses', () => {
    expect(ALL_UNITS).toHaveLength(145);
    expect(new Set(ALL_UNITS.map(u => u.skill.choreography?.variant)).size).toBe(42);
    for (const { skill } of ALL_UNITS) {
      expect(skill.choreography).toBeDefined();
      const windup = skillWindup(skill);
      if (windup) {
        expect(skillMotionFrame(skill, windup - .001)).toBe(13);
        expect(skillMotionFrame(skill, windup)).toBe(14);
      } else expect([0, .2, .35].map(t => skillMotionFrame(skill, t, 0))).toEqual([12, 13, 14]);
      expect(skillTimeline(skill).every(e => e.at >= windup)).toBe(true);
    }
  });
});
