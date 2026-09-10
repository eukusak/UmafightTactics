import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMatch, RoundDirector } from '../src/game/engine/rounds/director';
import { newInstance } from '../src/game/engine/shop';
import { ACTIVE_UNITS } from '../src/game/engine/roster';
import { combineStoredItems, equipItem } from '../src/game/engine/items/inventory';
import { COMPLETED_ITEM_DEFS } from '../src/game/engine/items/item-defs';
import { applyOnlineCommand } from '../src/game/network/commands';
import { commandSchema } from '../src/game/network/protocol';
import { useGameStore } from '../src/store/gameStore';
import { useInteractionStore } from '../src/store/interactionStore';
import { createItemCombineHold, ITEM_COMBINE_HOLD_MS } from '../src/game/ui/item-combine-drag';
import { onlineBridge } from '../src/game/network/bridge';

function fixture(a = 'winner_ribbon', b = 'reinforced_horseshoe') {
  const state = createMatch({ seed: 12 }); state.phase = 'ROUND_PREP'; state.draft = null;
  const player = state.players[0];
  player.items = [{ instanceId: 'a', itemId: a }, { instanceId: 'b', itemId: b }];
  const unit = newInstance(state, ACTIVE_UNITS[0].id, 1); player.bench.push(unit);
  return { state, player, unit };
}
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); onlineBridge.send = null; });

describe('item crafting rules', () => {
  it.each(COMPLETED_ITEM_DEFS.filter(i => i.components))('crafts $id from two distinct stored components', item => {
    const { player } = fixture(...item.components!);
    expect(combineStoredItems(player, 'a', 'b')).toEqual({ ok: true, resultItemId: item.id });
    if (item.tactician) { expect(player.items).toHaveLength(0); expect(player.tacticianItems).toContain(item.id); }
    else expect(player.items).toEqual([{ instanceId: 'b', itemId: item.id }]);
    const after = structuredClone(player);
    expect(combineStoredItems(player, 'a', 'b').ok).toBe(false); expect(player).toEqual(after);
  });
  it('rejects self, missing, completed items and battle crafting without consuming anything', () => {
    const { player } = fixture(); const before = structuredClone(player);
    for (const [a, b, battle] of [['a', 'a', false], ['a', 'other', false], ['a', 'b', true]] as const) {
      expect(combineStoredItems(player, a, b, battle).ok).toBe(false); expect(player).toEqual(before);
    }
    player.items[0].itemId = 'champion_trophy';
    expect(combineStoredItems(player, 'a', 'b').ok).toBe(false); expect(player.items).toHaveLength(2);
  });
  it('auto combines on a full unit, replacing its remaining component', () => {
    const { player, unit } = fixture(); unit.items = ['iron_stable', 'genius_trainer_hat'];
    expect(equipItem(player, unit.instanceId, 'a').ok).toBe(true);
    expect(equipItem(player, unit.instanceId, 'b').ok).toBe(true);
    expect(unit.items).toEqual(['iron_stable', 'genius_trainer_hat', 'twilight_racing_suit']); expect(player.items).toHaveLength(0);
  });
  it('rejects a three-slot glove result alongside another item, retaining both components', () => {
    const { player, unit } = fixture('race_glove', 'race_glove');
    unit.items = ['champion_trophy'];
    expect(equipItem(player, unit.instanceId, 'a').ok).toBe(true);
    const before = structuredClone(player);
    expect(equipItem(player, unit.instanceId, 'b')).toEqual({ ok: false, reason: 'NO_SLOT' }); expect(player).toEqual(before);
  });
  it('rejects crafting an emblem for a native trait and sends crafted tactician gear to its slots', () => {
    const emblem = COMPLETED_ITEM_DEFS.find(i => i.grantsTrait && ACTIVE_UNITS.some(u => u.traits.includes(i.grantsTrait!)))!;
    const { state, player } = fixture(...emblem.components!);
    const u = newInstance(state, ACTIVE_UNITS.find(u => u.traits.includes(emblem.grantsTrait!))!.id, 1); player.bench.push(u);
    expect(equipItem(player, u.instanceId, 'a').ok).toBe(true);
    const before = structuredClone(player);
    expect(equipItem(player, u.instanceId, 'b')).toEqual({ ok: false, reason: 'ALREADY_HAS_TRAIT' }); expect(player).toEqual(before);
    const crown = COMPLETED_ITEM_DEFS.find(i => i.id === 'trainer_crown')!;
    const f = fixture(...crown.components!);
    equipItem(f.player, f.unit.instanceId, 'a'); equipItem(f.player, f.unit.instanceId, 'b');
    expect(f.unit.items).toEqual([]); expect(f.player.tacticianItems).toContain('trainer_crown');
  });
  it('validates online ownership, recipe and phase using the same authoritative engine', () => {
    const { state, player, unit } = fixture(); const director = new RoundDirector(state);
    const command = commandSchema.parse({ action: 'combineItems', source: 'a', target: 'b' });
    expect(applyOnlineCommand(director, state.players[1].id, command)).not.toBeNull();
    expect(player.items).toHaveLength(2);
    state.phase = 'BATTLE'; expect(applyOnlineCommand(director, player.id, command)).not.toBeNull();
    state.phase = 'ROUND_PREP'; expect(applyOnlineCommand(director, player.id, command)).toBeNull();
    expect(player.items[0].itemId).toBe('twilight_racing_suit');
    player.items = fixture().player.items;
    expect(applyOnlineCommand(director, player.id, { action: 'equip', item: 'a', unit: unit.instanceId })).toBeNull();
    expect(applyOnlineCommand(director, player.id, { action: 'equip', item: 'b', unit: unit.instanceId })).toBeNull();
    expect(unit.items).toEqual(['twilight_racing_suit']);
  });
});

describe('continuous drag hold', () => {
  function setup() {
    vi.useFakeTimers(); const f = fixture();
    useGameStore.setState({ match: f.state, director: new RoundDirector(f.state), onlinePlayerId: null, battleRunning: false });
    const hold = createItemCombineHold(); hold.start('a'); return { ...f, hold };
  }
  it('waits 700ms, cancels on leaving, and restarts a full hold on return', () => {
    const { player, hold } = setup();
    hold.over('b'); vi.advanceTimersByTime(500); hold.over(null); vi.advanceTimersByTime(1000);
    expect(player.items).toHaveLength(2); expect(useInteractionStore.getState().itemCombine).toBeNull();
    hold.over('b'); vi.advanceTimersByTime(ITEM_COMBINE_HOLD_MS - 1); expect(player.items).toHaveLength(2);
    hold.over('b'); vi.advanceTimersByTime(1); expect(player.items).toEqual([{ instanceId: 'b', itemId: 'twilight_racing_suit' }]);
    hold.over('b'); vi.advanceTimersByTime(1000); expect(player.items).toHaveLength(1); hold.stop();
  });
  it('cancels on gesture end or battle transition and rechecks missing inventory', () => {
    for (const change of ['stop', 'battle', 'missing'] as const) {
      const { player, hold } = setup(); hold.over('b'); vi.advanceTimersByTime(300);
      if (change === 'stop') hold.stop();
      if (change === 'battle') useGameStore.setState({ battleRunning: true });
      if (change === 'missing') player.items.pop();
      vi.advanceTimersByTime(1000); expect(player.items[0].itemId).toBe('winner_ribbon'); hold.stop();
    }
  });
  it('sends exactly one online command while waiting for the server snapshot', () => {
    const { player, hold } = setup(); const send = vi.fn(); onlineBridge.send = send;
    useGameStore.setState({ onlinePlayerId: player.id, networkConnected: true });
    hold.over('b'); vi.advanceTimersByTime(700); hold.over('b'); vi.advanceTimersByTime(1000);
    expect(send).toHaveBeenCalledTimes(1); expect(send).toHaveBeenCalledWith({ action: 'combineItems', source: 'a', target: 'b' });
    expect(player.items).toHaveLength(2); hold.stop();
  });
});
