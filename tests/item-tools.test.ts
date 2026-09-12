import { describe, expect, it } from 'vitest';
import { createMatch, RoundDirector } from '../src/game/engine/rounds/director';
import { newInstance, itemStorageCapacity } from '../src/game/engine/shop';
import { ACTIVE_UNITS } from '../src/game/engine/roster';
import { Rng } from '../src/game/engine/rng';
import { ALL_ITEM_DEFS, getItem } from '../src/game/engine/items/item-defs';
import { applyItemTool } from '../src/game/engine/items/consumables';
import { rollPveLoot } from '../src/game/engine/rounds/pve';
import { applyOnlineCommand } from '../src/game/network/commands';

function fixture() {
  const state = createMatch({ seed: 90 }); state.phase = 'ROUND_PREP'; state.draft = null;
  const player = state.players[0], unit = newInstance(state, ACTIVE_UNITS[0].id, 1);
  player.bench = [unit]; player.items = []; player.pendingGrants = [{ kind: 'REMOVER', count: 2 }, { kind: 'REFORGER', count: 2 }];
  return { state, player, unit, rng: new Rng(18) };
}
describe('consumable equipment tools', () => {
  it('returns permanent equipment and consumes exactly one remover', () => {
    const f = fixture(); f.unit.items = ['trick_strategy_gloves', 'iron_stable', 'champion_trophy'];
    expect(applyItemTool(f.state, f.player, 'REMOVER', { unit: f.unit.instanceId }, f.rng)).toBe(true);
    expect(f.player.items.map(i => i.itemId)).toEqual(['trick_strategy_gloves']); expect(f.unit.items).toEqual([]);
    expect(f.player.pendingGrants[0].count).toBe(1);
    expect(applyItemTool(f.state, f.player, 'REMOVER', { unit: f.unit.instanceId }, f.rng)).toBe(false);
    expect(f.player.pendingGrants[0].count).toBe(1);
  });
  it.each(ALL_ITEM_DEFS.filter(i => !i.tactician))('reforges $id into a different item of the same category', original => {
    const f = fixture(); f.player.items = [{ instanceId: 'stored', itemId: original.id }];
    expect(applyItemTool(f.state, f.player, 'REFORGER', { item: 'stored' }, f.rng)).toBe(true);
    const result = getItem(f.player.items[0].itemId);
    expect(result.id).not.toBe(original.id); expect(result.isComponent).toBe(original.isComponent);
    expect(result.tier).toBe(original.tier); expect(!!result.grantsTrait).toBe(!!original.grantsTrait);
    expect(f.player.items[0].instanceId).toBe('stored');
  });
  it('rejects full inventory, missing ownership, empty charges and battle use atomically', () => {
    const f = fixture(); f.unit.items = ['winner_ribbon'];
    f.player.items = Array.from({ length: itemStorageCapacity(f.player) }, (_, i) => ({ instanceId: `i${i}`, itemId: 'winner_ribbon' }));
    const before = JSON.stringify(f.state), random = JSON.stringify(f.rng);
    expect(applyItemTool(f.state, f.player, 'REFORGER', { unit: f.unit.instanceId }, f.rng)).toBe(false);
    expect(applyItemTool(f.state, f.player, 'REMOVER', { unit: 'enemy' }, f.rng)).toBe(false);
    expect(JSON.stringify(f.state)).toBe(before); expect(JSON.stringify(f.rng)).toBe(random);
    f.state.phase = 'BATTLE';
    expect(applyItemTool(f.state, f.player, 'REFORGER', { item: 'i0' }, f.rng)).toBe(false);
    f.state.phase = 'ROUND_PREP'; f.player.pendingGrants = [];
    expect(applyItemTool(f.state, f.player, 'REFORGER', { item: 'i0' }, f.rng)).toBe(false);
  });
  it('uses the same tool rules in authoritative online commands', () => {
    const f = fixture(); f.unit.items = ['winner_ribbon', 'iron_stable'];
    const d = new RoundDirector(f.state);
    expect(applyOnlineCommand(d, f.player.id, { action: 'itemTool', kind: 'REFORGER', target: { unit: f.unit.instanceId } })).toBeNull();
    expect(f.unit.items).toEqual([]); expect(f.player.items).toHaveLength(2);
    expect(f.player.items[0].itemId).not.toBe('winner_ribbon'); expect(f.player.items[1].itemId).not.toBe('iron_stable');
  });
  it('guarantees components and removers even on unlucky PvE rolls', () => {
    for (let seed = 1; seed <= 100; seed++) for (let stage = 1; stage <= 6; stage++) for (const won of [true, false]) {
      const loot = rollPveLoot(new Rng(seed), stage, won);
      const minimum = !won || stage === 1 ? 1 : stage <= 3 ? 2 : 3;
      expect(loot.components.filter(id => id !== 'factor_badge' && id !== 'support_card').length).toBeGreaterThanOrEqual(minimum);
      expect(loot.removers).toBe(1); if (stage === 2) expect(loot.reforgers).toBe(1);
    }
  });
});
