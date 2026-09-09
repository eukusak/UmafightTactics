/** Spec §37.1 — economy, shop, pool and star combination. */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  addXp, buyXp, interestGold, maxInterest, payReroll, rerollCost, roundIncome,
  streakBonus, xpToNextLevel,
} from '../src/game/engine/economy';
import { XP_TO_LEVEL, POOL_COPIES, streakGold } from '../src/game/engine/constants';
import { createPool, countInPlay, remainingOf, totalCopies, take, give } from '../src/game/engine/pool';
import { applyCombines, buyUnit, emptyShop, newInstance, rollShop, sellPrice, sellUnit, shopOddsFor } from '../src/game/engine/shop';
import { ACTIVE_BY_COST, getUnitDef } from '../src/game/engine/roster';
import { Rng } from '../src/game/engine/rng';
import { createMatch, RoundDirector, heldUnits } from '../src/game/engine/rounds/director';
import type { MatchState, PlayerState } from '../src/game/engine/state';
import type { Cost } from '../src/game/engine/types';

function freshMatch(): { state: MatchState; player: PlayerState } {
  const state = createMatch({ seed: 4242 });
  return { state, player: state.players[0] };
}

describe('xp and levels', () => {
  it('follows the spec XP table', () => {
    const { player } = freshMatch();
    expect(player.level).toBe(1);
    expect(xpToNextLevel(player)).toBe(XP_TO_LEVEL[2]);
    addXp(player, 2);
    expect(player.level).toBe(2);
    addXp(player, 2);
    expect(player.level).toBe(3);
  });

  it('caps at level 10', () => {
    const { player } = freshMatch();
    addXp(player, 1000);
    expect(player.level).toBe(10);
    expect(xpToNextLevel(player)).toBe(0);
    expect(buyXp(player).ok).toBe(false);
  });

  it('charges 4 gold for 4 xp', () => {
    const { player } = freshMatch();
    player.gold = 10;
    expect(buyXp(player).ok).toBe(true);
    expect(player.gold).toBe(6);
    // Levels 2 and 3 cost 2 XP each, so 4 XP from level 1 reaches level 3.
    expect(player.level).toBe(3);
  });
});

describe('interest and streaks', () => {
  it('pays 1 gold per 10, capped at 5', () => {
    const { player } = freshMatch();
    for (const [gold, expected] of [[0, 0], [9, 0], [10, 1], [39, 3], [50, 5], [90, 5]] as const) {
      player.gold = gold;
      expect(interestGold(player), `gold ${gold}`).toBe(expected);
    }
  });

  it('raises the interest cap with 저축의 미학', () => {
    const { player } = freshMatch();
    player.augments = ['economy_interest_seed'];
    player.gold = 90;
    expect(maxInterest(player)).toBe(6);
    expect(interestGold(player)).toBe(6);
  });

  it('follows the streak table', () => {
    expect(streakGold(0)).toBe(0);
    expect(streakGold(1)).toBe(0);
    expect(streakGold(2)).toBe(0);
    expect(streakGold(3)).toBe(1);
    expect(streakGold(4)).toBe(1);
    expect(streakGold(5)).toBe(2);
    expect(streakGold(7)).toBe(3);
  });

  it('pays streak gold on losing streaks too', () => {
    const { player } = freshMatch();
    player.streak = -5;
    expect(streakBonus(player)).toBe(2);
  });

  it('adds a win bonus to round income', () => {
    const { player } = freshMatch();
    player.gold = 20;
    expect(roundIncome(player, 2, 1, true)).toBe(5 + 1 + 2);
    expect(roundIncome(player, 2, 1, false)).toBe(5 + 2);
  });

  it('pays the stage 1 ramp', () => {
    const { player } = freshMatch();
    expect(roundIncome(player, 1, 1, false)).toBe(2);
    expect(roundIncome(player, 1, 3, false)).toBe(4);
  });
});

describe('reroll cost', () => {
  it('costs 2 gold by default', () => {
    const { player } = freshMatch();
    player.gold = 10;
    expect(rerollCost(player)).toBe(2);
    payReroll(player);
    expect(player.gold).toBe(8);
  });

  it('is free while free rerolls remain', () => {
    const { player } = freshMatch();
    player.gold = 10;
    player.freeRerolls = 1;
    expect(rerollCost(player)).toBe(0);
    payReroll(player);
    expect(player.gold).toBe(10);
    expect(rerollCost(player)).toBe(2);
  });

  it('honours 리롤 크레딧 for two rolls', () => {
    const { player } = freshMatch();
    player.gold = 20;
    player.augments = ['reroll_credit'];
    expect(rerollCost(player)).toBe(1);
    payReroll(player);
    payReroll(player);
    expect(player.gold).toBe(18);
    expect(rerollCost(player)).toBe(2);
  });
});

describe('shared pool', () => {
  it('starts with 22/20/17/10/9 copies per unit kind', () => {
    const pool = createPool();
    for (const cost of [1, 2, 3, 4, 5] as Cost[]) {
      for (const u of ACTIVE_BY_COST[cost]) expect(remainingOf(pool, u.id)).toBe(POOL_COPIES[cost]);
    }
  });

  it('never exceeds its cap when copies are returned', () => {
    const pool = createPool();
    const unit = ACTIVE_BY_COST[1][0];
    give(pool, unit.id, 5);
    expect(remainingOf(pool, unit.id)).toBe(POOL_COPIES[1]);
  });

  it('refuses to take more than remain', () => {
    const pool = createPool();
    const unit = ACTIVE_BY_COST[5][0];
    expect(take(pool, unit.id, 100)).toBe(false);
    expect(remainingOf(pool, unit.id)).toBe(POOL_COPIES[5]);
  });

  it('conserves every copy across a full match', () => {
    const state = createMatch({ seed: 777, allAi: true });
    new RoundDirector(state).runToCompletion();
    expect(countInPlay(state.pool, heldUnits(state))).toBe(totalCopies());
  });
});

describe('buying and selling', () => {
  let state: MatchState;
  let player: PlayerState;

  beforeEach(() => {
    const m = freshMatch();
    state = m.state;
    player = m.player;
    player.gold = 50;
    player.shop = emptyShop();
  });

  it('takes exactly one copy from the pool on purchase', () => {
    const unit = ACTIVE_BY_COST[1][0];
    player.shop[0] = { unitDefId: unit.id, sold: false };
    const before = remainingOf(state.pool, unit.id);
    expect(buyUnit(state, player, 0).ok).toBe(true);
    expect(remainingOf(state.pool, unit.id)).toBe(before - 1);
    expect(player.gold).toBe(49);
  });

  it('does not remove copies for units merely shown in the shop', () => {
    const rng = new Rng(99);
    const before = { ...state.pool.remaining };
    player.level = 6;
    rollShop(player, state.pool, rng);
    expect(state.pool.remaining).toEqual(before);
  });

  it('refuses a purchase the player cannot afford', () => {
    const unit = ACTIVE_BY_COST[5][0];
    player.gold = 1;
    player.shop[0] = { unitDefId: unit.id, sold: false };
    const result = buyUnit(state, player, 0);
    expect(result.ok).toBe(false);
    expect(remainingOf(state.pool, unit.id)).toBe(POOL_COPIES[5]);
  });

  it('returns every copy of a sold unit to the pool', () => {
    const unit = ACTIVE_BY_COST[2][0];
    const before = remainingOf(state.pool, unit.id);
    for (let i = 0; i < 3; i += 1) {
      take(state.pool, unit.id, 1);
      player.bench.push(newInstance(state, unit.id, 1));
    }
    applyCombines(state, player);
    const two = [...player.bench].find((u) => u.star === 2)!;
    expect(two.sourceCopies).toBe(3);
    sellUnit(state, player, two.instanceId);
    expect(remainingOf(state.pool, unit.id)).toBe(before);
  });

  it('prices sales per the spec table', () => {
    const one = ACTIVE_BY_COST[1][0];
    const three = ACTIVE_BY_COST[3][0];
    const oneStar = newInstance(state, one.id, 1);
    expect(sellPrice(player, oneStar)).toBe(1);

    const threeCost1 = newInstance(state, three.id, 1);
    expect(sellPrice(player, threeCost1)).toBe(3);
    const threeCost2 = newInstance(state, three.id, 2);
    expect(sellPrice(player, threeCost2)).toBe(3 * 3 - 1);
    const threeCost3 = newInstance(state, three.id, 3);
    expect(sellPrice(player, threeCost3)).toBe(3 * 9 - 1);
  });

  it('refunds a 1-cost unit in full at every star level', () => {
    const one = ACTIVE_BY_COST[1][0];
    expect(sellPrice(player, newInstance(state, one.id, 2))).toBe(3);
    expect(sellPrice(player, newInstance(state, one.id, 3))).toBe(9);
  });

  it('reduces star-up losses with 깔끔한 정리', () => {
    const three = ACTIVE_BY_COST[3][0];
    player.augments = ['economy_sell_back'];
    expect(sellPrice(player, newInstance(state, three.id, 2))).toBe(9);
  });
});

describe('star combination', () => {
  it('merges three 1-stars into a 2-star', () => {
    const { state, player } = freshMatch();
    const unit = ACTIVE_BY_COST[1][0];
    for (let i = 0; i < 3; i += 1) player.bench.push(newInstance(state, unit.id, 1));
    applyCombines(state, player);
    expect(player.bench).toHaveLength(1);
    expect(player.bench[0].star).toBe(2);
    expect(player.bench[0].sourceCopies).toBe(3);
  });

  it('merges nine 1-stars into a 3-star', () => {
    const { state, player } = freshMatch();
    const unit = ACTIVE_BY_COST[1][0];
    for (let i = 0; i < 9; i += 1) player.bench.push(newInstance(state, unit.id, 1));
    applyCombines(state, player);
    expect(player.bench).toHaveLength(1);
    expect(player.bench[0].star).toBe(3);
    expect(player.bench[0].sourceCopies).toBe(9);
  });

  it('carries items onto the upgraded unit', () => {
    const { state, player } = freshMatch();
    const unit = ACTIVE_BY_COST[1][0];
    for (let i = 0; i < 3; i += 1) player.bench.push(newInstance(state, unit.id, 1));
    player.bench[0].items = ['champion_trophy'];
    applyCombines(state, player);
    expect(player.bench[0].items).toContain('champion_trophy');
  });

  it('holds back a combine that would need a unit fighting on the board', () => {
    const { state, player } = freshMatch();
    const unit = ACTIVE_BY_COST[1][0];
    player.board.push(newInstance(state, unit.id, 1));
    player.bench.push(newInstance(state, unit.id, 1));
    player.bench.push(newInstance(state, unit.id, 1));

    expect(applyCombines(state, player, true)).toBe(0);
    expect(player.bench).toHaveLength(2);

    // Out of battle the same three copies combine immediately.
    expect(applyCombines(state, player, false)).toBe(1);
    expect([...player.board, ...player.bench]).toHaveLength(1);
  });
});

describe('shop odds by level', () => {
  it('offers no 5-cost below level 7', () => {
    const { player } = freshMatch();
    for (let level = 1; level <= 6; level += 1) {
      player.level = level;
      expect(shopOddsFor(player)[5]).toBe(0);
    }
    player.level = 7;
    expect(shopOddsFor(player)[5]).toBeGreaterThan(0);
  });

  it('keeps augment-adjusted odds summing to 100', () => {
    const { player } = freshMatch();
    player.level = 9;
    player.augments = ['shop_high_cost'];
    const odds = shopOddsFor(player);
    const sum = ([1, 2, 3, 4, 5] as Cost[]).reduce((a, c) => a + odds[c], 0);
    expect(sum).toBeCloseTo(100, 6);
    expect(odds[4] + odds[5]).toBeGreaterThan(45);
  });

  it('only rolls units that still have copies left', () => {
    const { state, player } = freshMatch();
    player.level = 1;
    for (const u of ACTIVE_BY_COST[1]) state.pool.remaining[u.id] = 0;
    const shop = rollShop(player, state.pool, new Rng(5));
    for (const slot of shop) {
      if (slot.unitDefId) expect(getUnitDef(slot.unitDefId).cost).not.toBe(1);
    }
  });
});
