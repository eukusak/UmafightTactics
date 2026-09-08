import { describe, expect, it } from 'vitest';
import { BattleEngine, type BattleSideInput } from '../src/game/engine/battle/engine';
import { ACTIVE_UNITS, ACTIVE_BY_COST } from '../src/game/engine/roster';
import { Rng } from '../src/game/engine/rng';
import { movingPoint } from '../src/game/ui/board-projection';
import { hexDistance } from '../src/game/engine/battle/hex';
import { PVE_ENEMIES, pveScale } from '../src/game/engine/rounds/pve';
import { PVE_UNIT_IDS } from '../src/game/engine/battle/pve-units';

function fixture(seconds: number): BattleEngine {
  const side = (playerId: string): BattleSideInput => ({ playerId, augments: [], tacticianItems: [], units: [{ instanceId: playerId, unitDefId: ACTIVE_UNITS[0].id, star: 1, items: [], position: { q: 3, r: 0 } }] });
  const engine = new BattleEngine(side('a'), side('b'), new Rng(901), { recordFrames: true, maxSeconds: seconds });
  for (const unit of engine.units) {
    unit.base.maxMana = 999999; unit.mana = 0;
    unit.skill = { ...unit.skill, effects: [] };
    unit.base.attackDamage = 10; unit.base.attackSpeed = 1;
    unit.base.hp = unit.maxHp = unit.hp = 5000;
  }
  return engine;
}

describe('combat timing and presentation', () => {
  it('lets every 1-cost starter clear the opening training with no item', () => {
    const def = PVE_ENEMIES.training_dummy;
    const enemies: BattleSideInput = { playerId: 'pve', augments: [], tacticianItems: [], units: def.positions.map((position, i) => ({ instanceId: `pve${i}`, unitDefId: PVE_UNIT_IDS.training_dummy, star: 1, items: [], position, statScale: pveScale(1) })) };
    for (const starter of ACTIVE_BY_COST[1]) for (const seed of [7, 41, 901]) {
      const allies: BattleSideInput = { playerId: 'human', augments: [], tacticianItems: [], units: [{ instanceId: 'starter', unitDefId: starter.id, star: 1, items: [], position: { q: 3, r: starter.role === 'TANK' || starter.role === 'BRUISER' ? 0 : 3 } }] };
      const result = new BattleEngine(allies, enemies, new Rng(seed)).run();
      expect(result.winner, `${starter.id} / ${seed}`).toBe('A');
    }
  });
  it('records an untouched opening frame, windup, projectile, then damage on impact', () => {
    const engine = fixture(2);
    engine.units[0].cell = { q: 2, r: 4 };
    engine.units[1].cell = { q: 4, r: 4 };
    for (const u of engine.units) u.base.attackRange = 3;
    const result = engine.run();
    expect(engine.frames[0].t).toBe(0);
    const start = result.events.find((e) => e.type === 'ATTACK_START');
    expect(start?.type).toBe('ATTACK_START');
    if (start?.type !== 'ATTACK_START') throw new Error('missing windup');
    const shot = result.events.find((e) => e.type === 'PROJECTILE' && e.source === start.source);
    const hit = result.events.find((e) => e.type === 'ATTACK' && e.source === start.source);
    expect(shot!.t).toBeGreaterThan(start.t);
    expect(hit!.t).toBeGreaterThanOrEqual(start.impactAt - 1e-8);
    const damage = result.events.find((e) => e.type === 'DAMAGE' && e.source === start.source);
    expect(damage!.t).toBe(hit!.t);
    const before = engine.frames.filter((f) => f.t < damage!.t - 1e-6).at(-1)!;
    expect(before.units.find((u) => u.id === start.target)!.hp).toBe(5000);
  });

  it('keeps reserved cells unique and follows movement without backwards interpolation', () => {
    const engine = fixture(4);
    engine.units[0].cell = { q: 0, r: 7 };
    engine.units[1].cell = { q: 6, r: 0 };
    for (const u of engine.units) { u.base.attackRange = 1; u.base.moveSpeedHexPerSec = 2; }
    engine.run();
    let moving = 0;
    for (let i = 1; i < engine.frames.length; i++) {
      const frame = engine.frames[i];
      const live = frame.units.filter((u) => u.alive);
      expect(new Set(live.map((u) => `${u.q},${u.r}`)).size).toBe(live.length);
      for (const u of frame.units) {
        const prior = engine.frames[i - 1].units.find((p) => p.id === u.id)!;
        const a = movingPoint(prior), b = movingPoint(u);
        expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeLessThan(22);
        if (u.fromQ !== null && u.fromR !== null) {
          moving++;
          expect(hexDistance({ q: u.fromQ, r: u.fromR }, u)).toBe(1);
          if (prior.fromQ === u.fromQ && prior.fromR === u.fromR && prior.q === u.q && prior.r === u.r) expect(u.progress).toBeGreaterThanOrEqual(prior.progress);
        }
      }
    }
    expect(moving).toBeGreaterThan(5);
  });

  it('prevents basic attacks while disarmed', () => {
    const engine = fixture(2);
    const blocked = engine.units[0];
    blocked.statuses.push({ kind: 'DISARM', expiresAt: 10, sourceId: engine.units[1].id });
    const result = engine.run();
    expect(result.events.filter((e) => e.type === 'ATTACK_START' && e.source === blocked.id)).toHaveLength(0);
  });
});
