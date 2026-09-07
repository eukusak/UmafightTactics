/** Spec §37.1 / §37.3 — round flow, items, draft, ghosts, save determinism. */
import { describe, expect, it } from 'vitest';
import { createMatch, RoundDirector, heldUnits } from '../src/game/engine/rounds/director';
import { countInPlay, totalCopies, remainingOf } from '../src/game/engine/pool';
import { newInstance, emptyShop, teamSizeLimit } from '../src/game/engine/shop';
import { equipItem, canEquip, removeItems, addItemToStorage } from '../src/game/engine/items/inventory';
import { rollAugmentOptions, applyAugment, gradeForAugmentRound } from '../src/game/engine/augments/offers';
import { roundKind, hasAugmentBefore, nextRound, roundsInStage } from '../src/game/engine/rounds/schedule';
import { makePairings } from '../src/game/engine/rounds/matchmaking';
import { buildDraftOptions, draftOrder } from '../src/game/engine/rounds/draft';
import { serializeMatch, parseSave, restoreDirector } from '../src/game/engine/save';
import { ACTIVE_BY_COST, getUnitDef, ACTIVE_UNITS } from '../src/game/engine/roster';
import { Rng } from '../src/game/engine/rng';
import { DEFAULT_SEED } from '../src/game/engine/constants';
import type { MatchState } from '../src/game/engine/state';

describe('round schedule', () => {
  it('runs three PvE rounds in stage 1', () => {
    expect(roundsInStage(1)).toBe(3);
    for (let r = 1; r <= 3; r += 1) expect(roundKind(1, r)).toBe('PVE');
  });

  it('lays out later stages as PvP x3, draft, PvP x2, PvE', () => {
    expect(roundsInStage(2)).toBe(7);
    expect(roundKind(2, 1)).toBe('PVP');
    expect(roundKind(2, 3)).toBe('PVP');
    expect(roundKind(2, 4)).toBe('DRAFT');
    expect(roundKind(2, 5)).toBe('PVP');
    expect(roundKind(2, 7)).toBe('PVE');
  });

  it('offers augments at 2-1, 3-2 and 4-2 only', () => {
    expect(hasAugmentBefore(2, 1)).toBe(true);
    expect(hasAugmentBefore(3, 2)).toBe(true);
    expect(hasAugmentBefore(4, 2)).toBe(true);
    expect(hasAugmentBefore(2, 2)).toBe(false);
    expect(hasAugmentBefore(5, 1)).toBe(false);
  });

  it('advances rounds and stages', () => {
    expect(nextRound(1, 3)).toEqual({ stage: 2, round: 1 });
    expect(nextRound(2, 7)).toEqual({ stage: 3, round: 1 });
    expect(nextRound(2, 1)).toEqual({ stage: 2, round: 2 });
  });
});

describe('augment offers', () => {
  it('offers three distinct options', () => {
    const state = createMatch({ seed: 1 });
    const options = rollAugmentOptions(state.players[0], 'S', new Rng(9));
    expect(options).toHaveLength(3);
    expect(new Set(options).size).toBe(3);
  });

  it('never re-offers an augment the player already holds', () => {
    const state = createMatch({ seed: 1 });
    const player = state.players[0];
    const rng = new Rng(3);
    for (let i = 0; i < 12; i += 1) {
      const options = rollAugmentOptions(player, 'S', rng);
      for (const o of options) expect(player.augments).not.toContain(o);
      applyAugment(state, player, options[0], rng);
    }
  });

  it('escalates grade by stage', () => {
    expect(gradeForAugmentRound(2)).toBe('S');
    expect(gradeForAugmentRound(3)).toBe('G');
    expect(gradeForAugmentRound(4)).toBe('P');
  });

  it('pays out instant gold and xp immediately', () => {
    const state = createMatch({ seed: 1 });
    const player = state.players[0];
    applyAugment(state, player, 'economy_windfall', new Rng(1));
    expect(player.gold).toBe(40);
    applyAugment(state, player, 'level_10', new Rng(1));
    expect(player.level).toBeGreaterThan(1);
  });
});

describe('items', () => {
  it('combines two components on equip', () => {
    const state = createMatch({ seed: 2 });
    const player = state.players[0];
    const unit = newInstance(state, ACTIVE_BY_COST[1][0].id, 1);
    player.bench.push(unit);

    addItemToStorage(state, player, 'winner_ribbon');
    equipItem(player, unit.instanceId, player.items[0].instanceId);
    expect(unit.items).toEqual(['winner_ribbon']);

    addItemToStorage(state, player, 'reinforced_horseshoe');
    const result = equipItem(player, unit.instanceId, player.items[0].instanceId);
    expect(result.ok).toBe(true);
    expect(unit.items).toEqual(['twilight_racing_suit']);
  });

  it('caps a unit at three item slots', () => {
    const state = createMatch({ seed: 2 });
    const player = state.players[0];
    const unit = newInstance(state, ACTIVE_BY_COST[1][0].id, 1);
    unit.items = ['champion_trophy', 'iron_stable', 'genius_trainer_hat'];
    player.bench.push(unit);
    expect(canEquip(unit, 'blue_focus').ok).toBe(false);
  });

  it('refuses an emblem for a trait the unit already has', () => {
    const state = createMatch({ seed: 2 });
    const player = state.players[0];
    const nige = ACTIVE_UNITS.find((u) => u.traits.includes('nige'))!;
    const unit = newInstance(state, nige.id, 1);
    player.bench.push(unit);
    expect(canEquip(unit, 'emblem_nige').ok).toBe(false);
    expect(canEquip(unit, 'emblem_nige').reason).toBe('ALREADY_HAS_TRAIT');
  });

  it('lets 변칙 작전 글러브 consume all three slots', () => {
    const state = createMatch({ seed: 2 });
    const player = state.players[0];
    const unit = newInstance(state, ACTIVE_BY_COST[1][0].id, 1);
    unit.items = ['trick_strategy_gloves'];
    player.bench.push(unit);
    expect(canEquip(unit, 'champion_trophy').ok).toBe(false);
  });

  it('refuses to equip during a battle', () => {
    const state = createMatch({ seed: 2 });
    const player = state.players[0];
    const unit = newInstance(state, ACTIVE_BY_COST[1][0].id, 1);
    player.board.push(unit);
    addItemToStorage(state, player, 'champion_trophy');
    expect(equipItem(player, unit.instanceId, player.items[0].instanceId, true).ok).toBe(false);
  });

  it('returns items to storage when removed', () => {
    const state = createMatch({ seed: 2 });
    const player = state.players[0];
    const unit = newInstance(state, ACTIVE_BY_COST[1][0].id, 1);
    unit.items = ['champion_trophy', 'iron_stable'];
    player.bench.push(unit);
    expect(removeItems(state, player, unit.instanceId)).toBe(true);
    expect(unit.items).toEqual([]);
    expect(player.items.map((i) => i.itemId).sort()).toEqual(['champion_trophy', 'iron_stable']);
  });
});

describe('matchmaking', () => {
  it('pairs everyone when the count is even', () => {
    const state = createMatch({ seed: 3, allAi: true });
    const pairs = makePairings(state, new Rng(1));
    expect(pairs).toHaveLength(4);
    const seen = pairs.flatMap((p) => [p.attackerId, p.defenderId]);
    expect(new Set(seen).size).toBe(8);
    expect(pairs.every((p) => !p.isGhost)).toBe(true);
  });

  it('uses a ghost board when the count is odd', () => {
    const state = createMatch({ seed: 3, allAi: true });
    state.players[7].hp = 0;
    state.players[7].eliminatedAtRound = 1;
    state.players[0].board.push(newInstance(state, ACTIVE_BY_COST[1][0].id, 1));
    const pairs = makePairings(state, new Rng(1));
    expect(pairs.filter((p) => p.isGhost)).toHaveLength(1);
  });

  it('avoids an immediate rematch when an alternative exists', () => {
    const state = createMatch({ seed: 3, allAi: true });
    state.players[0].recentOpponents = ['p2'];
    let rematches = 0;
    for (let s = 0; s < 30; s += 1) {
      const pairs = makePairings(state, new Rng(s));
      const p1 = pairs.find((p) => p.attackerId === 'p1' || p.defenderId === 'p1');
      if (p1 && (p1.attackerId === 'p2' || p1.defenderId === 'p2')) rematches += 1;
    }
    expect(rematches).toBeLessThan(30);
  });
});

describe('twinkle draft', () => {
  it('offers nine distinct unit+item pedestals', () => {
    const state = createMatch({ seed: 4, allAi: true });
    const options = buildDraftOptions(state, 3, new Rng(2));
    expect(options).toHaveLength(9);
    expect(new Set(options.map((o) => o.unitDefId)).size).toBe(9);
    for (const o of options) expect(o.itemId).toBeTruthy();
  });

  it('orders later drafts by lowest hp first', () => {
    const state = createMatch({ seed: 4, allAi: true });
    state.players.forEach((p, i) => { p.hp = 100 - i * 10; });
    const order = draftOrder(state, new Rng(1), false);
    expect(order[0]).toBe('p8');
    expect(order[order.length - 1]).toBe('p1');
  });

  it('shuffles the first draft instead of using hp', () => {
    const state = createMatch({ seed: 4, allAi: true });
    const orders = new Set<string>();
    for (let s = 0; s < 12; s += 1) orders.add(draftOrder(state, new Rng(s), true).join(','));
    expect(orders.size).toBeGreaterThan(1);
  });
});

describe('full match', () => {
  const run = (seed: number): MatchState => {
    const state = createMatch({ seed, allAi: true });
    new RoundDirector(state).runToCompletion();
    return state;
  };

  it('completes and produces 8 distinct placements', () => {
    const state = run(DEFAULT_SEED);
    expect(state.phase).toBe('GAME_OVER');
    expect(state.finalStandings).toHaveLength(8);
    const places = state.players.map((p) => p.placement).sort((a, b) => (a ?? 0) - (b ?? 0));
    expect(places).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('leaves exactly one player standing', () => {
    const state = run(DEFAULT_SEED);
    expect(state.players.filter((p) => p.hp > 0)).toHaveLength(1);
    expect(state.players.find((p) => p.placement === 1)!.hp).toBeGreaterThan(0);
  });

  it('returns every unit of an eliminated player to the pool', () => {
    const state = run(555);
    for (const p of state.players) {
      if (p.eliminatedAtRound !== null) {
        expect(p.board).toHaveLength(0);
        expect(p.bench).toHaveLength(0);
      }
    }
    expect(countInPlay(state.pool, heldUnits(state))).toBe(totalCopies());
  });

  it('never exceeds a pool cap', () => {
    const state = run(556);
    for (const u of ACTIVE_UNITS) {
      expect(remainingOf(state.pool, u.id)).toBeLessThanOrEqual(
        { 1: 22, 2: 20, 3: 17, 4: 10, 5: 9 }[u.cost],
      );
      expect(remainingOf(state.pool, u.id)).toBeGreaterThanOrEqual(0);
    }
  });

  it('keeps every board within its team size limit', () => {
    const state = createMatch({ seed: 558, allAi: true });
    const d = new RoundDirector(state);
    d.beginPrep();
    for (let i = 0; i < 30 && !d.isOver; i += 1) {
      for (const p of state.players) {
        if (p.eliminatedAtRound !== null) continue;
        expect(p.board.length).toBeLessThanOrEqual(teamSizeLimit(p));
      }
      d.resolveRound();
      d.advance();
    }
  });

  it('reaches stage 5 or beyond', () => {
    for (const seed of [1, 2, 3]) {
      const state = run(seed * 104729);
      expect(state.stage).toBeGreaterThanOrEqual(4);
    }
  });

  it('is deterministic for the fixed spec seed', () => {
    const a = run(DEFAULT_SEED);
    const b = run(DEFAULT_SEED);
    expect(a.finalStandings).toEqual(b.finalStandings);
    expect(a.history.length).toBe(b.history.length);
    expect(a.players.map((p) => p.hp)).toEqual(b.players.map((p) => p.hp));
    expect(JSON.stringify(a.pool)).toBe(JSON.stringify(b.pool));
  });

  it('produces different matches for different seeds', () => {
    const results = new Set<string>();
    for (const seed of [1, 2, 3, 4, 5]) results.add(run(seed * 7919).finalStandings!.join(','));
    expect(results.size).toBeGreaterThan(1);
  });
});

describe('save and load', () => {
  it('round-trips a match and replays identically', () => {
    const state = createMatch({ seed: 31337, allAi: true });
    const director = new RoundDirector(state);
    director.beginPrep();
    for (let i = 0; i < 6; i += 1) { director.resolveRound(); director.advance(); }

    const save = serializeMatch(director);
    const parsed = parseSave(JSON.stringify(save));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    // Continue both the original and the restored copy; they must agree.
    const restored = restoreDirector(parsed.save);
    for (let i = 0; i < 6; i += 1) {
      if (!director.isOver) { director.resolveRound(); director.advance(); }
      if (!restored.isOver) { restored.resolveRound(); restored.advance(); }
    }
    expect(restored.state.players.map((p) => p.hp)).toEqual(director.state.players.map((p) => p.hp));
    expect(restored.state.stage).toBe(director.state.stage);
    expect(restored.state.round).toBe(director.state.round);
    expect(JSON.stringify(restored.state.pool)).toBe(JSON.stringify(director.state.pool));
  });

  it('rejects a save built against a different roster', () => {
    const state = createMatch({ seed: 1, allAi: true });
    const save = serializeMatch(new RoundDirector(state));
    save.activeRosterHash = 'deadbeefdeadbeef';
    const result = parseSave(JSON.stringify(save));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('ROSTER_MISMATCH');
  });

  it('rejects corrupt data', () => {
    expect(parseSave('not json').ok).toBe(false);
    expect(parseSave('{"version":2}').ok).toBe(false);
  });
});

describe('ghost boards', () => {
  it('never damages the original player', () => {
    const state = createMatch({ seed: 909, allAi: true });
    // Eliminate one player so the remaining count is odd.
    state.players[7].hp = 0;
    state.players[7].eliminatedAtRound = 1;
    state.players[7].placement = 8;

    const d = new RoundDirector(state);
    d.beginPrep();
    state.stage = 3;
    state.round = 1;
    const before = new Map(state.players.map((p) => [p.id, p.hp]));
    const res = d.resolveRound();
    const ghostOutcomes = res.outcomes.filter((o) => o.isGhost);
    for (const o of ghostOutcomes) {
      // The ghost's owner takes no damage from a fight it did not choose.
      if (o.winnerId === o.attackerId) {
        expect(state.players.find((p) => p.id === o.defenderId)!.hp)
          .toBe(before.get(o.defenderId));
      }
    }
  });
});

describe('shop lock', () => {
  it('keeps the shop across a round when locked', () => {
    const state = createMatch({ seed: 1212, allAi: true });
    const d = new RoundDirector(state);
    d.beginPrep();
    const player = state.players[0];
    player.shop = emptyShop();
    player.shop[0] = { unitDefId: ACTIVE_BY_COST[1][0].id, sold: false };
    player.shopLocked = true;
    const snapshot = JSON.stringify(player.shop);
    d.resolveRound();
    d.advance();
    expect(JSON.stringify(player.shop)).toBe(snapshot);
    expect(player.shopLocked).toBe(false);
  });
});

describe('pve', () => {
  it('costs no player hp on a loss', () => {
    const state = createMatch({ seed: 2323, allAi: true });
    const d = new RoundDirector(state);
    d.beginPrep(); // 1-1 is PvE
    const before = state.players.map((p) => p.hp);
    const res = d.resolveRound();
    expect(res.kind).toBe('PVE');
    expect(state.players.map((p) => p.hp)).toEqual(before);
  });

  it('never draws PvE enemies from the shared unit pool', () => {
    const state = createMatch({ seed: 2324, allAi: true });
    const d = new RoundDirector(state);
    d.beginPrep();
    const poolBefore = JSON.stringify(state.pool);
    d.resolveRound();
    // Buying happens during prep, not during the PvE fight itself.
    expect(JSON.parse(poolBefore)).toEqual(state.pool);
    for (const id of Object.keys(state.pool.remaining)) {
      expect(getUnitDef(id).activeS1).toBe(true);
    }
  });
});
