import { beforeEach, describe, expect, it } from 'vitest';
import { createMatch, RoundDirector } from '../src/game/engine/rounds/director';
import { useGameStore } from '../src/store/gameStore';
import { ACTIVE_BY_COST } from '../src/game/engine/roster';
import { orientSnapshot, samplePosition, effectProgress, damageTotals, attackExtension } from '../src/game/ui/battle-playback';
import { serializeMatch } from '../src/game/engine/save';
import { prepPoint } from '../src/game/ui/board-projection';
import { toBattleCell } from '../src/game/engine/battle/hex';
import type { BattleFrame } from '../src/game/engine/battle/engine';

const snapshot = (q: number, r: number): BattleFrame['units'][number] => ({ id: 'p1#unit', unitDefId: ACTIVE_BY_COST[1][0].id, team: 'B', star: 1, q, r, fromQ: null, fromR: null, progress: 1, hp: 100, maxHp: 100, shield: 0, mana: 0, maxMana: 100, alive: true, casting: false, statuses: [] });

function director(seed = 941) {
  const state = createMatch({ seed, allAi: true });
  const result = new RoundDirector(state); result.beginPrep();
  return result;
}

describe('settlement follows playback', () => {
  it('keeps PvE loot, XP, HP and history hidden until settlement, then matches immediate resolution', () => {
    const immediate = director(), deferred = director();
    const before = structuredClone(deferred.state.players);
    immediate.resolveRound(); deferred.resolveRound(true);
    expect(deferred.state.phase).toBe('BATTLE');
    expect(deferred.state.history).toHaveLength(0);
    for (const [i, player] of deferred.state.players.entries()) {
      expect([player.hp, player.gold, player.xp, player.streak, player.items]).toEqual([before[i].hp, before[i].gold, before[i].xp, before[i].streak, before[i].items]);
    }
    expect(() => deferred.resolveRound(true)).toThrow();
    expect(() => deferred.advance()).toThrow();
    expect(() => serializeMatch(deferred)).toThrow();
    deferred.settleRound();
    expect(deferred.state).toEqual(immediate.state);
    const settled = structuredClone(deferred.state);
    deferred.settleRound(); expect(deferred.state).toEqual(settled);
  });

  it('records the human live pairing even when another player fights their ghost', () => {
    let coveredGhost = false;
    for (let seed = 1; seed <= 24; seed++) {
      const d = director(seed);
      d.state.players = d.state.players.slice(0, 3);
      d.state.players[0].isHuman = true;
      d.state.stage = 2; d.state.round = 1;
      const result = d.resolveRound();
      const own = result.outcomes.find((o) => o.attackerId === 'p1' || (!o.isGhost && o.defenderId === 'p1'))!;
      const ids = new Set(d.lastHumanFrames![0].units.map((u) => u.id.split('#')[0]));
      expect([...ids].sort()).toEqual([own.attackerId, own.defenderId].sort());
      if (result.outcomes.some((o) => o.isGhost && o.defenderId === 'p1')) coveredGhost = true;
    }
    expect(coveredGhost).toBe(true);
  });

  it('defers PvP player damage, streaks and elimination without changing the outcome', () => {
    const immediate = director(13), deferred = director(13);
    for (const d of [immediate, deferred]) { d.state.stage = 2; d.state.round = 1; for (const p of d.state.players) p.hp = 1; }
    immediate.resolveRound(); deferred.resolveRound(true);
    expect(deferred.state.players.every((p) => p.hp === 1 && p.eliminatedAtRound === null && p.streak === 0)).toBe(true);
    deferred.settleRound();
    expect(deferred.state).toEqual(immediate.state);
    expect(deferred.state.players.some((p) => p.eliminatedAtRound !== null)).toBe(true);
  });
});

describe('store battle lifecycle and scouting', () => {
  beforeEach(() => {
    useGameStore.getState().newMatch(901);
    const state = useGameStore.getState();
    state.match!.draft = null; state.match!.augmentOffers = [];
    state.devGrant('unit', ACTIVE_BY_COST[1][0].id);
    state.moveUnit(state.human()!.bench[0].instanceId, { q: 3, r: 0 });
  });

  it('allows current-gold purchases but rejects field edits and settles/skips only once', () => {
    const store = useGameStore.getState();
    store.devGrant('gold50');
    const player = store.human()!;
    const unit = player.board[0]; const position = { ...unit.position! };
    const gold = player.gold;
    store.startBattle();
    expect(player.gold).toBe(gold);
    const slot = player.shop.findIndex((s) => s.unitDefId && s.unitDefId !== unit.unitDefId);
    store.buy(slot); expect(player.gold).toBeLessThan(gold);
    store.moveUnit(unit.instanceId, null); expect(unit.position).toEqual(position);
    store.sell(unit.instanceId); expect(player.board.some((u) => u.instanceId === unit.instanceId)).toBe(true);
    store.startBattle(); expect(store.match!.history).toHaveLength(0);
    store.completeBattle(); expect(store.match!.history).toHaveLength(1);
    store.completeBattle(); expect(store.match!.history).toHaveLength(1);
    store.finishBattle(); const round = store.match!.round;
    store.finishBattle(); expect(store.match!.round).toBe(round);
    expect(useGameStore.getState().battleRunning).toBe(false);
  });

  it('finishes the remaining AI standings after the human is eliminated', () => {
    const store = useGameStore.getState();
    store.match!.stage = 2; store.match!.round = 1;
    store.human()!.hp = 1; store.human()!.board = []; store.human()!.bench = [];
    store.startBattle(); store.completeBattle();
    expect(store.human()!.eliminatedAtRound).not.toBeNull();
    store.finishBattle();
    expect(useGameStore.getState().screen).toBe('RESULT');
    expect(store.match!.finalStandings).toHaveLength(8);
  });

  it('fields every AI starter after the human completes the opening draft', () => {
    useGameStore.getState().newMatch(901);
    const store = useGameStore.getState();
    store.moveCarousel({ x: 550, y: 325 }, store.match!.draft!.options[0].index);
    expect(store.match!.draft).not.toBeNull();
    store.tickCarousel(45000);
    expect(store.match!.draft).toBeNull();
    expect(store.match!.players.filter((p) => !p.isHuman).every((p) => p.board.length > 0)).toBe(true);
  });

  it('selects exactly the requested player and resets battle flags for a new game', () => {
    const store = useGameStore.getState();
    store.inspectPlayer('p5'); expect(useGameStore.getState().viewedPlayer()!.id).toBe('p5');
    store.inspectPlayer('p1'); expect(useGameStore.getState().spectating).toBeNull();
    store.startBattle(); store.newMatch(12);
    expect(useGameStore.getState().battleRunning).toBe(false);
    expect(useGameStore.getState().battleComplete).toBe(false);
  });
});

describe('continuous perspective and event clock', () => {
  it('keeps every human defender cell at the same position as preparation', () => {
    for (let q = 0; q < 7; q++) for (let r = 0; r < 4; r++) {
      const cell = { q, r }; const b = toBattleCell(cell, 'B');
      const oriented = orientSnapshot(snapshot(b.q, b.r), true);
      expect(samplePosition(oriented, undefined, 0)).toEqual(prepPoint(cell));
      expect(orientSnapshot(oriented, true)).toEqual(snapshot(b.q, b.r));
    }
  });

  it('interpolates scale as well as position and does not show future damage', () => {
    const a = snapshot(3, 4), b = snapshot(3, 5);
    const start = samplePosition(a, b, 0), end = samplePosition(a, b, 1), middle = samplePosition(a, b, .5);
    expect(middle.scale).toBeCloseTo((start.scale + end.scale) / 2);
    expect(middle.y).toBeCloseTo((start.y + end.y) / 2);
    const frames: BattleFrame[] = [{ t: 0, overtime: false, units: [a], events: [] }, { t: 1, overtime: false, units: [b], events: [{ t: 1, type: 'DAMAGE', source: a.id, target: 'enemy', damage: 25, absorbed: 5, isSkill: false }] }];
    expect(damageTotals(frames, .99).size).toBe(0);
    expect(damageTotals(frames, 1).get(a.id)).toBe(30);
    expect(effectProgress(1.1, 1, .2)).toBeCloseTo(.5);
    expect(effectProgress(4, 1, .2)).toBe(1);
    expect(attackExtension(1.1, 1, 1.24)).toBeLessThan(0);
    expect(attackExtension(1.24, 1, 1.24)).toBe(1);
    expect(attackExtension(1.5, 1, 1.24)).toBe(0);
  });
});
