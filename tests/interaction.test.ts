import { beforeEach, describe, expect, it } from 'vitest';
import { matchesKey, bindingKey } from '../src/game/ui/keybindings';
import { useGameStore } from '../src/store/gameStore';
import { useInteractionStore } from '../src/store/interactionStore';
import { ACTIVE_BY_COST } from '../src/game/engine/roster';
import { itemStorageCapacity, sellPrice } from '../src/game/engine/shop';
import { buildBaseStats } from '../src/game/engine/battle/combat-unit';
import { applyOnlineCommand } from '../src/game/network/commands';

describe('game key normalization', () => {
  it('accepts physical Korean and uppercase keys plus custom bindings', () => {
    expect(matchesKey({ key: 'ㅇ', code: 'KeyD' }, 'd')).toBe(true);
    expect(matchesKey({ key: 'D', code: 'KeyD' }, 'd')).toBe(true);
    expect(matchesKey({ key: 'ㅋ', code: 'KeyZ' }, 'z')).toBe(true);
    expect(matchesKey({ key: 'd', code: 'KeyD' }, 'z')).toBe(false);
    expect(matchesKey({ key: 'Tab', code: 'Tab' }, 'Tab')).toBe(true);
    expect(matchesKey({ key: ' ', code: 'Space' }, ' ')).toBe(true);
    expect(bindingKey({ key: 'ㅇ', code: 'KeyD' })).toBe('d');
  });
});

describe('sale and inspection contracts', () => {
  beforeEach(() => {
    useGameStore.setState({ onlinePlayerId: null });
    useGameStore.getState().newMatch(901);
    const s = useGameStore.getState();
    s.match!.draft = null; s.match!.augmentOffers = [];
    s.devGrant('unit', ACTIVE_BY_COST[2][0].id);
    useInteractionStore.getState().reset();
  });
  it('selling returns gear, refunds the engine price, clears selection, and cannot pay twice', () => {
    const s = useGameStore.getState(), p = s.human()!, u = p.bench[0];
    u.items = ['reinforced_horseshoe', 'training_belt'];
    s.selectUnit(u.instanceId);
    const gold = p.gold, price = sellPrice(p, u), count = p.items.length;
    s.sell(u.instanceId);
    expect(p.gold).toBe(gold + price);
    expect(p.items).toHaveLength(count + 2);
    expect(p.bench.some(x => x.instanceId === u.instanceId)).toBe(false);
    expect(useGameStore.getState().selectedUnitId).toBeNull();
    s.sell(u.instanceId);
    expect(p.gold).toBe(gold + price);
  });
  it('a full item store rejects the entire sale without losing the unit or its equipment', () => {
    const s = useGameStore.getState(), p = s.human()!, u = p.bench[0];
    u.items = ['reinforced_horseshoe'];
    p.items = Array.from({ length: itemStorageCapacity(p) }, (_, i) => ({ instanceId: `test-${i}`, itemId: 'training_belt' }));
    const gold = p.gold;
    s.sell(u.instanceId);
    expect(p.gold).toBe(gold); expect(p.bench).toContain(u); expect(u.items).toEqual(['reinforced_horseshoe']);
    expect(useGameStore.getState().lastError).toContain('가득');
  });
  it('online sales reject opponents and fighting field units but allow owned bench units', () => {
    const s = useGameStore.getState(), p = s.human()!, u = p.bench[0];
    const enemy = s.match!.players[1];
    expect(applyOnlineCommand(s.director!, enemy.id, { action: 'sell', unit: u.instanceId })).not.toBeNull();
    s.moveUnit(u.instanceId, { q: 3, r: 0 }); s.startBattle();
    expect(applyOnlineCommand(s.director!, p.id, { action: 'sell', unit: u.instanceId })).not.toBeNull();
    expect(p.board).toContain(u);
  });
  it('recorded stats include gear and do not change when the preparation object changes later', () => {
    const s = useGameStore.getState(), p = s.human()!, u = p.bench[0];
    u.items = ['reinforced_horseshoe'];
    const base = buildBaseStats(u.unitDefId, u.star, u.items);
    s.moveUnit(u.instanceId, { q: 3, r: 0 }); s.startBattle();
    const snapshot = useGameStore.getState().battleFrames![0].units.find(x => x.id === `${p.id}#${u.instanceId}`)!;
    expect(snapshot.stats!.armor).toBeGreaterThanOrEqual(base.armor);
    expect(snapshot.items).toEqual(['reinforced_horseshoe']);
    expect(snapshot.traits!.length).toBeGreaterThan(0);
    u.items.push('training_belt');
    expect(snapshot.items).toEqual(['reinforced_horseshoe']);
  });
});
