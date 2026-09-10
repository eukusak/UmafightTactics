import { describe, expect, it, vi } from 'vitest';
import { BattleEngine, type BattleSideInput } from '../src/game/engine/battle/engine';
import { applyEffect, procDamage, type EffectContext } from '../src/game/engine/battle/effects';
import { makeCombatUnit, resistFor, stat } from '../src/game/engine/battle/combat-unit';
import { ACTIVE_UNITS } from '../src/game/engine/roster';
import { Rng } from '../src/game/engine/rng';
import { ALL_ITEM_DEFS, getItem, SPECIAL_ITEM_DEFS } from '../src/game/engine/items/item-defs';
import { claimItemReward, itemRewardOptions } from '../src/game/engine/items/rewards';
import { canEquip } from '../src/game/engine/items/inventory';
import { createMatch, RoundDirector } from '../src/game/engine/rounds/director';
import { applyOnlineCommand } from '../src/game/network/commands';
import { commandSchema } from '../src/game/network/protocol';
import { newInstance, itemStorageCapacity } from '../src/game/engine/shop';
import { resolveAiItemRewards } from '../src/game/engine/ai';
import { itemUrl } from '../src/game/ui/art';
import { EffectSchema } from '../src/game/engine/schema';

function unit(id: string, team: 'A' | 'B' = 'A') {
  return makeCombatUnit({
    id,
    instanceId: id,
    unitDefId: ACTIVE_UNITS[0].id,
    star: 1,
    items: [],
    extraTraits: [],
    team,
    cell: { q: 3, r: team === 'A' ? 4 : 3 },
  });
}
function context(units = [unit('self'), unit('friend'), unit('enemy', 'B')]): EffectContext {
  return {
    units,
    now: 0,
    overtime: false,
    dealDamage: vi.fn(() => 1),
    applyStatus: vi.fn(),
    dash: vi.fn(),
    summon: vi.fn(),
    supportSkillApplied: vi.fn(),
  };
}
function duel(item: string, seconds = 3, casts = false) {
  const side = (id: string, items: string[]): BattleSideInput => ({
    playerId: id,
    augments: [],
    tacticianItems: [],
    units: [
      { instanceId: '0', unitDefId: ACTIVE_UNITS[0].id, star: 1, items, position: { q: 3, r: 0 } },
    ],
  });
  const e = new BattleEngine(side('A', [item]), side('B', []), new Rng(9), {
    maxSeconds: seconds,
    recordFrames: true,
  });
  for (const u of e.units) {
    Object.assign(u.base, {
      hp: 10000,
      attackDamage: 100,
      abilityPower: 100,
      armor: 0,
      magicResist: 0,
      attackSpeed: 1,
      attackRange: 4,
      maxMana: 10000,
      startMana: 0,
      critChance: 0,
    });
    u.maxHp = u.hp = 10000;
    u.role = 'AD_CARRY';
    u.skillMultiplier = 1;
    u.cell = { q: 3, r: u.team === 'A' ? 4 : 3 };
    u.skill = {
      ...u.skill,
      targetRule: 'CURRENT_TARGET',
      effects: [],
      choreography: {
        windup: 0.1,
        recovery: 0.1,
        pulseInterval: 0.1,
        color: '#ffffff',
        variant: 'item-test',
      },
    };
    if (u.team === 'B') u.attackCooldown = 999;
  }
  if (casts) e.units[0].base.startMana = 10000;
  return e;
}

describe('item proc contracts', () => {
  it('a cast arms exactly one physical spellblade strike, with no crit or star amplification', () => {
    const e = duel('twilight_racing_suit', 3, true);
    e.units[0].skillMultiplier = 4;
    const result = e.run();
    const hits = result.events.filter((ev) => ev.type === 'DAMAGE' && ev.source === e.units[0].id);
    expect(
      hits.filter((ev) => ev.type === 'DAMAGE' && Math.abs(ev.damage - 80) < 0.01),
    ).toHaveLength(1);
    expect(hits.every((ev) => ev.type !== 'DAMAGE' || !ev.isSkill)).toBe(true);
    const plain = duel('twilight_racing_suit', 3).run();
    expect(plain.events.filter((ev) => ev.type === 'DAMAGE' && ev.damage === 80)).toHaveLength(0);
  });
  it('current-health damage is bounded even against a very large PvE target', () => {
    const e = duel('giant_overtaker', 1);
    const result = e.run();
    expect(
      result.events.filter((ev) => ev.type === 'DAMAGE' && ev.source === e.units[0].id),
    ).toHaveLength(2);
    expect(procDamage(e.units[0], e.units[1], getItem('giant_overtaker').effects[0], 0)).toBe(100);
  });
  it('skill-hit echoes do not recursively trigger themselves and do not multiply by stars', () => {
    const e = duel('gate_shock_device', 0.6, true);
    e.units[0].skillMultiplier = 3;
    e.units[0].attackCooldown = 999;
    e.units[0].skill.effects = [
      { kind: 'DAMAGE', value: 10, damageType: 'TRUE', target: 'CURRENT_TARGET' },
    ];
    const hits = e.run().events.filter((ev) => ev.type === 'DAMAGE');
    expect(hits.map((ev) => (ev.type === 'DAMAGE' ? [ev.damage, ev.isSkill] : []))).toEqual([
      [30, true],
      [65, false],
    ]);
  });
  it('skill crit gear enables critical skills without making item echoes crit', () => {
    const e = duel('finish_line_strike', 0.6, true);
    e.units[0].attackCooldown = 999;
    e.units[0].base.critChance = 1;
    e.units[0].base.critMultiplier = 1.4;
    e.units[0].skill.effects = [
      { kind: 'DAMAGE', value: 100, damageType: 'TRUE', target: 'CURRENT_TARGET' },
    ];
    const hits = e.run().events.filter((ev) => ev.type === 'DAMAGE');
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ damage: 170, isSkill: true, crit: true });
    const plain = duel('gate_shock_device', 0.6, true);
    plain.units[0].attackCooldown = 999;
    plain.units[0].base.critChance = 1;
    plain.units[0].skill.effects = [
      { kind: 'DAMAGE', value: 100, damageType: 'TRUE', target: 'CURRENT_TARGET' },
    ];
    expect(
      plain
        .run()
        .events.filter((ev) => ev.type === 'DAMAGE')
        .map((ev) => (ev.type === 'DAMAGE' ? ev.damage : 0)),
    ).toEqual([100, 65]);
  });
  it('target-specific cooldown permits a new target but suppresses repeats on that target', () => {
    const e = duel('victory_bloodwind', 4);
    e.units[1].base.hp = e.units[1].maxHp = e.units[1].hp = 220;
    const next = unit('next-enemy', 'B');
    next.base.hp = next.maxHp = next.hp = 10000;
    next.base.armor = 0;
    next.attackCooldown = 999;
    next.base.maxMana = 10000;
    next.role = 'AD_CARRY';
    next.cell = { q: 4, r: 3 };
    e.units.push(next);
    const hits = e
      .run()
      .events.filter(
        (ev) =>
          ev.type === 'DAMAGE' && ev.source === e.units[0].id && Math.abs(ev.damage - 55) < 0.001,
      );
    expect(hits).toHaveLength(2);
    expect(new Set(hits.map((ev) => (ev.type === 'DAMAGE' ? ev.target : '')))).toHaveProperty(
      'size',
      2,
    );
  });
  it('only a landed basic attack triggers thorn retaliation; a skill hit does not', () => {
    const e = duel('iron_stable', 0.6);
    e.units[0].attackCooldown = 999;
    e.units[1].base.startMana = 10000;
    e.units[1].skill.effects = [
      { kind: 'DAMAGE', value: 100, target: 'CURRENT_TARGET', damageType: 'TRUE' },
    ];
    expect(
      e.run().events.filter((ev) => ev.type === 'DAMAGE' && ev.source === e.units[0].id),
    ).toHaveLength(0);
    const basic = duel('iron_stable', 0.6);
    basic.units[0].attackCooldown = 999;
    basic.units[1].attackCooldown = 0;
    expect(
      basic.run().events.filter((ev) => ev.type === 'DAMAGE' && ev.source === basic.units[0].id),
    ).toHaveLength(1);
  });
  it('six-second stoneplate activates once even when the holder never attacks', () => {
    const e = duel('racecourse_stoneplate', 7);
    e.units[0].attackCooldown = 999;
    e.run();
    expect(stat(e.units[0], 'armor', 7)).toBe(25);
    expect(stat(e.units[0], 'magicResist', 7)).toBe(25);
  });
  it('the same-target third-hit counter resets when the target changes', () => {
    const e = duel('breakaway_horseshoe', 2.7);
    e.units[0].lastTargetId = 'old-enemy';
    e.units[0].attacksOnCurrentTarget = 2;
    const result = e.run();
    const proc = result.events.filter((ev) => ev.type === 'DAMAGE' && ev.damage === 90);
    expect(proc).toHaveLength(1);
    expect(proc[0].t).toBeGreaterThan(2);
  });
  it('successful CC shields the holder, while immune targets give no shield', () => {
    const run = (immune: boolean) => {
      const e = duel('pre_race_vow', 0.5, true);
      e.units[0].skill.effects = [
        { kind: 'APPLY_STATUS', status: 'STUN', duration: 1, target: 'CURRENT_TARGET' },
      ];
      if (immune) e.units[1].aura.ccImmuneUntil = 99;
      e.run();
      return e.units[0].shields;
    };
    expect(run(false)).toHaveLength(1);
    expect(run(true)).toHaveLength(0);
  });
  it('every ordinary and special item completes a finite deterministic combat', () => {
    for (const item of ALL_ITEM_DEFS.filter(
      (i) => !i.isComponent && !i.grantsTrait && !i.tactician,
    )) {
      const a = duel(item.id, 9, true),
        b = duel(item.id, 9, true);
      expect(a.run(), item.id).toEqual(b.run());
      expect(
        a.units.every((u) => Number.isFinite(u.hp) && u.maxHp > 0),
        item.id,
      ).toBe(true);
    }
  });
});

describe('support, stacks and durations', () => {
  it('support gear never heals an enemy or falls back to the holder when alone', () => {
    const ctx = context(),
      [self, friend, foe] = ctx.units;
    self.hp = friend.hp = foe.hp = 10;
    const effect = getItem('recovery_saddle').effects[0];
    applyEffect(ctx, self, effect, 0, {
      power: 1,
      sourceKey: 'item:heal',
      currentTarget: foe,
      event: 'TICK',
    });
    expect(friend.hp).toBeGreaterThan(10);
    expect(self.hp).toBe(10);
    expect(foe.hp).toBe(10);
    friend.alive = false;
    expect(
      applyEffect(ctx, self, effect, 0, {
        power: 1,
        sourceKey: 'item:heal',
        currentTarget: foe,
        event: 'TICK',
      }),
    ).toBe(0);
    expect(self.hp).toBe(10);
  });
  it('only actual ally skill healing/shielding emits the support event', () => {
    const ctx = context(),
      [self, friend] = ctx.units;
    friend.hp = 10;
    const opt = {
      power: 1,
      sourceKey: 'skill:test',
      currentTarget: friend,
      event: 'ON_CAST' as const,
    };
    applyEffect(ctx, self, { kind: 'HEAL', value: 20, target: 'CURRENT_TARGET' }, 0, opt);
    applyEffect(ctx, self, { kind: 'SHIELD_FLAT', value: 20, target: 'CURRENT_TARGET' }, 1, opt);
    expect(ctx.supportSkillApplied).toHaveBeenCalledTimes(2);
    applyEffect(ctx, self, { kind: 'HEAL', value: 20, target: 'CURRENT_TARGET' }, 0, {
      ...opt,
      sourceKey: 'item:bounce',
    });
    expect(ctx.supportSkillApplied).toHaveBeenCalledTimes(2);
    friend.hp = friend.maxHp;
    applyEffect(ctx, self, { kind: 'HEAL', value: 20, target: 'CURRENT_TARGET' }, 0, opt);
    expect(ctx.supportSkillApplied).toHaveBeenCalledTimes(2);
  });
  it('rapid recasts refresh attack speed instead of creating infinite stacking', () => {
    const ctx = context(),
      self = ctx.units[0],
      base = self.base.attackSpeed;
    const effect = getItem('pace_up_snack').effects[0];
    for (let i = 0; i < 5; i++) {
      ctx.now = i;
      applyEffect(ctx, self, effect, 0, {
        power: 1,
        sourceKey: 'item:snack',
        currentTarget: null,
        event: 'ON_CAST',
      });
    }
    expect(stat(self, 'attackSpeed', 4)).toBeCloseTo(base * 1.4);
    expect(stat(self, 'attackSpeed', 8)).toBeCloseTo(base);
    expect(self.modifiers).toHaveLength(1);
  });
  it('armor shred caps, refreshes, expires, and takes the strongest source', () => {
    const ctx = context(),
      self = ctx.units[0],
      target = ctx.units[2];
    target.base.armor = 100;
    const effect = getItem('last_overtake').effects[0];
    for (let i = 0; i < 10; i++)
      applyEffect(ctx, self, effect, 0, {
        power: 1,
        sourceKey: 'item:cleaver',
        currentTarget: target,
        event: 'ON_ATTACK',
      });
    expect(resistFor(target, 'PHYSICAL', 0)).toBeCloseTo(70);
    applyEffect(ctx, ctx.units[1], { ...effect, value: 0.2, maxStacks: undefined }, 0, {
      power: 1,
      sourceKey: 'item:other',
      currentTarget: target,
      event: 'ON_ATTACK',
    });
    expect(resistFor(target, 'PHYSICAL', 0)).toBeCloseTo(70);
    expect(resistFor(target, 'PHYSICAL', 5)).toBe(100);
  });
  it('health growth has a ceiling and never leaks into the next battle', () => {
    const ctx = context(),
      self = ctx.units[0],
      base = self.maxHp;
    const effect = getItem('long_distance_training_coat').effects[0];
    for (let i = 0; i < 20; i++)
      applyEffect(ctx, self, effect, 0, {
        power: 1,
        sourceKey: 'item:heart',
        currentTarget: ctx.units[2],
        event: 'ON_ATTACK',
      });
    expect(self.maxHp).toBe(base + 270);
    expect(unit('fresh').maxHp).toBe(base);
  });
});

describe('special item acquisition and compatibility', () => {
  it('catalogs contain six artifacts/six radiant editions with valid effects and existing icons', () => {
    expect(itemRewardOptions('ARTIFACT_CHOICE')).toHaveLength(6);
    expect(itemRewardOptions('RADIANT_CHOICE')).toHaveLength(6);
    expect(itemRewardOptions('COMPLETED_CHOICE')).toHaveLength(36);
    for (const item of SPECIAL_ITEM_DEFS) {
      expect(itemUrl(item.id), item.id).not.toBeNull();
      expect(item.components).toBeNull();
      expect(itemRewardOptions('COMPLETED_CHOICE')).not.toContain(item.id);
    }
    for (const item of ALL_ITEM_DEFS)
      for (const effect of item.effects)
        expect(EffectSchema.safeParse(effect).success, item.id).toBe(true);
  });
  it('rejects unearned rewards, wrong tiers, battle requests and duplicate claims without mutation', () => {
    const state = createMatch({ seed: 9 });
    state.phase = 'ROUND_PREP';
    state.draft = null;
    const p = state.players[0];
    p.pendingGrants = [{ kind: 'RADIANT_CHOICE', count: 1 }];
    const director = new RoundDirector(state),
      reward = itemRewardOptions('RADIANT_CHOICE')[0];
    const before = structuredClone(state);
    expect(claimItemReward(state, p, 'ARTIFACT_CHOICE', 'artifact_echo_lantern')).toBe(false);
    expect(claimItemReward(state, p, 'RADIANT_CHOICE', 'champion_trophy')).toBe(false);
    expect(state).toEqual(before);
    state.phase = 'BATTLE';
    expect(claimItemReward(state, p, 'RADIANT_CHOICE', reward)).toBe(false);
    state.phase = 'ROUND_PREP';
    const cmd = { action: 'itemReward', kind: 'RADIANT_CHOICE', item: reward } as const;
    expect(commandSchema.safeParse(cmd).success).toBe(true);
    expect(applyOnlineCommand(director, p.id, cmd)).toBeNull();
    expect(p.items.at(-1)?.itemId).toBe(reward);
    const after = structuredClone(state);
    expect(applyOnlineCommand(director, p.id, cmd)).not.toBeNull();
    expect(state).toEqual(after);
  });
  it('a full bag preserves the reward until space is available; state survives serialization', () => {
    const state = createMatch({ seed: 3 });
    state.phase = 'ROUND_PREP';
    const p = state.players[0];
    p.pendingGrants = [{ kind: 'ARTIFACT_CHOICE', count: 1 }];
    p.items = Array.from({ length: itemStorageCapacity(p) }, (_, i) => ({
      instanceId: 'full' + i,
      itemId: 'winner_ribbon',
    }));
    expect(claimItemReward(state, p, 'ARTIFACT_CHOICE', 'artifact_echo_lantern')).toBe(false);
    const restored = JSON.parse(JSON.stringify(state)) as typeof state;
    const owner = restored.players[0];
    owner.items.pop();
    expect(claimItemReward(restored, owner, 'ARTIFACT_CHOICE', 'artifact_echo_lantern')).toBe(true);
    expect(owner.pendingGrants).toHaveLength(0);
  });
  it('AI redeems earned special items but never consumes a human selection', () => {
    const state = createMatch({ seed: 7 });
    const ai = state.players.find((p) => p.aiProfile !== null)!;
    ai.items = [];
    ai.pendingGrants = [
      { kind: 'ARTIFACT_CHOICE', count: 1 },
      { kind: 'RADIANT_CHOICE', count: 1 },
    ];
    resolveAiItemRewards(state, ai);
    expect(ai.pendingGrants).toHaveLength(0);
    expect(ai.items.map((i) => getItem(i.itemId).tier).sort()).toEqual(['ARTIFACT', 'RADIANT']);
    const human = state.players.find((p) => p.aiProfile === null)!;
    human.pendingGrants = [{ kind: 'ARTIFACT_CHOICE', count: 1 }];
    resolveAiItemRewards(state, human);
    expect(human.pendingGrants).toHaveLength(1);
  });
  it('settling 4-7 awards only winners one artifact, including after restoration, without duplicate settlement', () => {
    const state = createMatch({ seed: 8 });
    state.phase = 'BATTLE';
    state.stage = 4;
    state.round = 7;
    const director = new RoundDirector(state),
      [winner, loser] = state.players;
    director.restorePendingSettlement({
      resolution: {
        stage: 4,
        round: 7,
        kind: 'PVE',
        outcomes: [winner, loser].map((p) => ({
          attackerId: p.id,
          defenderId: 'pve',
          winnerId: p === winner ? p.id : 'pve',
          survivorsWinner: 1,
          survivorsLoser: 0,
          durationSeconds: 10,
          wentToOvertime: false,
          isGhost: false,
        })),
        damage: {},
        eliminated: [],
      },
      afterStreaks: Object.fromEntries(state.players.map((p) => [p.id, p.streak])),
      pvpWinners: [],
      isPve: true,
    });
    director.settleRound();
    director.settleRound();
    expect(winner.pendingGrants.filter((g) => g.kind === 'ARTIFACT_CHOICE')).toEqual([
      { kind: 'ARTIFACT_CHOICE', count: 1 },
    ]);
    expect(loser.pendingGrants.some((g) => g.kind === 'ARTIFACT_CHOICE')).toBe(false);
  });
  it('normal and radiant spellblades are mutually exclusive, including component auto-combines', () => {
    const state = createMatch({ seed: 1 });
    const u = newInstance(state, ACTIVE_UNITS[0].id, 1);
    u.items = ['radiant_twilight_racing_suit'];
    expect(canEquip(u, 'twilight_racing_suit').ok).toBe(false);
    expect(canEquip(u, 'artifact_duelist_clock').ok).toBe(false);
    u.items.push('winner_ribbon');
    expect(canEquip(u, 'reinforced_horseshoe').ok).toBe(false);
    expect(canEquip(u, 'artifact_moon_chime').ok).toBe(true);
  });
});
