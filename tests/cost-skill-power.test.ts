import { expect, it } from 'vitest';
import { ALL_UNITS } from '../src/game/engine/roster';
import { buildSkill } from '../src/game/engine/battle/skill-templates';
import { COST_SKILL_POWER, starSkillMultiplier } from '../src/game/engine/constants';
import { COST_SKILL_PRESENTATION } from '../src/game/ui/cost-skill-presentation';
import type { Cost, RunStyle } from '../src/game/engine/types';

const costs: Cost[] = [1, 2, 3, 4, 5];
function sameKit(id: string, cost: Cost) {
  const unit = ALL_UNITS.find(u => u.id === id)!;
  return buildSkill({ unitId: id, nameKo: unit.nameKo, role: unit.role, style: unit.traits[0] as RunStyle, cost, power01: .5, signatureName: null, mainWin: null });
}

it('gives the same kit a material increase at each cost for damage, healing and shields', () => {
  for (const kind of ['DAMAGE', 'HEAL', 'SHIELD_FLAT']) {
    const unit = ALL_UNITS.find(u => u.skill.effects.some(e => e.kind === kind))!;
    const values = costs.map(c => sameKit(unit.id, c).effects.filter(e => e.kind === kind).reduce((sum, e) => sum + (e.value ?? 0), 0));
    for (let i = 1; i < values.length; i++) expect(values[i] / values[i - 1]).toBeGreaterThan(1.12);
    expect(values[4] / values[0]).toBeGreaterThan(1.85);
  }
  // Reroll investment still matters: a three-star low-cost skill beats the
  // one-star legendary version of that same kit, before items or traits.
  expect(COST_SKILL_POWER[1] * starSkillMultiplier(3, 1)).toBeGreaterThan(COST_SKILL_POWER[5]);
});

it('scales positive utility buffs too, with exact descriptions and unchanged CC/timing', () => {
  const support = ALL_UNITS.find(u => u.skill.choreography?.variant === 'tempo_banner')!;
  const low = sameKit(support.id, 1), high = sameKit(support.id, 5);
  expect(low.effects.find(e => e.kind === 'STAT_MUL')!.value).toBe(.3);
  expect(high.effects.find(e => e.kind === 'STAT_MUL')!.value).toBe(.408);
  expect(high.description).toContain('+40.8%');
  for (const unit of ALL_UNITS) {
    const a = sameKit(unit.id, 1), b = sameKit(unit.id, 5);
    expect(b.choreography).toEqual(a.choreography);
    expect(b.effects.map(e => [e.kind, e.target, e.delay, e.duration, e.radius, e.maxTargets, e.shape])).toEqual(a.effects.map(e => [e.kind, e.target, e.delay, e.duration, e.radius, e.maxTargets, e.shape]));
    expect(b.effects.filter(e => ['APPLY_STATUS', 'TAUNT'].includes(e.kind))).toEqual(a.effects.filter(e => ['APPLY_STATUS', 'TAUNT'].includes(e.kind)));
  }
});

it('adds bounded impact rings and pixel particles as cost rises without scaling body art', () => {
  for (let i = 1; i < costs.length; i++) {
    const a = COST_SKILL_PRESENTATION[costs[i - 1]], b = COST_SKILL_PRESENTATION[costs[i]];
    expect(b.radius).toBeGreaterThan(a.radius);
    expect(b.particles).toBeGreaterThan(a.particles);
    expect(b.duration).toBeLessThanOrEqual(.44);
    expect(b.echoes).toBeLessThanOrEqual(3);
  }
});
