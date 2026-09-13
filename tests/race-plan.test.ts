import { describe, expect, it } from 'vitest';
import { BATTLE_NORMAL_SECONDS, RACE_PLAN_ROUNDS, AUGMENT_ROUNDS } from '../src/game/engine/constants';
import { getRaceCombatPhase, laterPhase, raceProgress } from '../src/game/engine/race-plan/race-phases';
import {
  ALL_FINISHING_DEFS, ALL_RACE_PLAN_NODES, FINISHING_MOVE_DEFS, RACE_EVOLUTION_DEFS,
  RACE_PLAN_DEFS, SIGNATURE_MOVE_DEFS, evolutionFitsPlan, guardPasses,
} from '../src/game/engine/race-plan/defs';
import { RACING_PROFILES, G1_THEMES, readPct } from '../src/game/engine/race-plan/profiles';
import { aptitudeFlavor } from '../src/game/engine/race-plan/score';
import { createRacePlanOffer, rerollRacePlanSlot } from '../src/game/engine/race-plan/offers';
import { entryCandidates, entryIsFielded, reconcileEntryUnit } from '../src/game/engine/race-plan/entry';
import { itemFit } from '../src/game/engine/ai/evaluation';
import { chooseRaceEntry, chooseRacePlanOption, transferRaceEntry } from '../src/game/engine/race-plan/director-ops';
import { describeEffects } from '../src/game/engine/race-plan/presentation';
import { createMatch, RoundDirector } from '../src/game/engine/rounds/director';
import { ALL_UNITS, getUnitDef } from '../src/game/engine/roster';
import { newInstance } from '../src/game/engine/shop';
import { racePlanKindBefore, roundInfo } from '../src/game/engine/rounds/schedule';
import type { MatchState, PlayerState } from '../src/game/engine/state';
import type { RaceCombatPhase, RacePlanNode } from '../src/game/engine/race-plan/types';
import {
  RUN_STYLES, curveWeightedDamage, styleCurveEffects, styleStepAt,
} from '../src/game/engine/race-plan/style-curve';
import {
  CLAUSE_DEFS, DEFAULT_CONDITIONS, GOING_DEFS, PACE_DEFS, WEATHER_DEFS,
  describeConditions, getWeather, paceStyleScale, rollRaceConditions,
} from '../src/game/engine/race-plan/conditions';
import { g1Identity } from '../src/game/engine/race-plan/g1-identity';
import { scaleFactor } from '../src/game/engine/battle/effects';
import { MAX_RECAST_DEPTH } from '../src/game/engine/constants';
import { Rng } from '../src/game/engine/rng';

function board(state: MatchState, player: PlayerState, unitIds: string[]): void {
  player.board = unitIds.map((id, i) => ({
    ...newInstance(state, id, 1),
    position: { q: i % 7, r: Math.floor(i / 7) % 4 },
  }));
}

function seeded(seed = 4242): { state: MatchState; player: PlayerState } {
  const state = createMatch({ seed, allAi: true, seasonId: 's1' });
  return { state, player: state.players[0] };
}

describe('race progress and phases', () => {
  const side = (alive: number, start = 8) => ({ alive, start, hp: alive, startHp: start });

  it('reaches the last 3F on a fast wipe as well as a long grind', () => {
    // Ten seconds in and one side is down to a single unit: the race is in its
    // final straight, which the clock alone would never say.
    expect(getRaceCombatPhase(10, raceProgress(10, [side(8), side(1)]))).toBe('LAST_3F');
    // Half a side gone is the 승부처, not yet the straight.
    expect(getRaceCombatPhase(10, raceProgress(10, [side(8), side(2.5)]))).toBe('LATE');
    // Nothing has died: the clock carries it instead.
    expect(getRaceCombatPhase(26, raceProgress(26, [side(8), side(8)]))).toBe('LAST_3F');
    expect(getRaceCombatPhase(2, raceProgress(2, [side(8), side(8)]))).toBe('START');
    expect(getRaceCombatPhase(10, raceProgress(10, [side(8), side(7)]))).toBe('POSITIONING');
    expect(getRaceCombatPhase(BATTLE_NORMAL_SECONDS, 1)).toBe('OVERTIME');
  });

  it('measures the side closest to being wiped, not the whole field', () => {
    // Counting both sides together caps a clean 8-0 win at 0.5 and puts the
    // final straight permanently out of reach.
    expect(raceProgress(1, [side(8), side(0)])).toBe(1);
    expect(raceProgress(1, [side(8), side(4)])).toBeCloseTo(0.5);
  });

  it('never lets a revive walk the race backwards', () => {
    const before = raceProgress(12, [side(8), side(1)]);
    const after = raceProgress(12.1, [side(8), side(3)]); // two units revived
    expect(after).toBeLessThan(before);
    expect(laterPhase(getRaceCombatPhase(12, before), getRaceCombatPhase(12.1, after)))
      .toBe(getRaceCombatPhase(12, before));
  });

  it('keeps its rounds clear of the augment rounds', () => {
    for (const race of RACE_PLAN_ROUNDS) {
      expect(AUGMENT_ROUNDS.some((a) => a.stage === race.stage && a.round === race.round)).toBe(false);
      const info = roundInfo(race.stage, race.round);
      expect(info.kind).toBe('PVP');
      expect(info.racePlanKind).toBe(race.kind);
      expect(info.hasAugment).toBe(false);
      expect(info.prepSeconds).toBeGreaterThanOrEqual(45);
    }
    expect(racePlanKindBefore(2, 5)).toBe('PLAN');
    expect(racePlanKindBefore(2, 6)).toBeNull();
  });
});

describe('catalogue', () => {
  it('ships 40 plans, 40 evolutions, 41 generic and 16 signature moves', () => {
    expect(RACE_PLAN_DEFS).toHaveLength(40);
    expect(RACE_EVOLUTION_DEFS).toHaveLength(40);
    expect(FINISHING_MOVE_DEFS).toHaveLength(41);
    expect(SIGNATURE_MOVE_DEFS).toHaveLength(16);
    expect(new Set(ALL_RACE_PLAN_NODES.map((n) => n.id)).size).toBe(ALL_RACE_PLAN_NODES.length);
  });

  it('gives every plan at least three compatible evolutions', () => {
    for (const plan of RACE_PLAN_DEFS) {
      const fitting = RACE_EVOLUTION_DEFS.filter((e) => evolutionFitsPlan(e, plan));
      expect(fitting.length, plan.id).toBeGreaterThanOrEqual(3);
    }
  });

  it('points every signature move at a unit that actually exists', () => {
    for (const move of SIGNATURE_MOVE_DEFS) {
      const unit = ALL_UNITS.find((u) => u.id === move.signatureUnitId);
      expect(unit, move.id).toBeDefined();
      // A signature written for a melee horse must not land on a ranged build.
      const ranged = unit!.attackRange >= 2;
      if (move.guard.appliesTo === 'MELEE') expect(ranged, move.id).toBe(false);
      if (move.guard.appliesTo === 'RANGED') expect(ranged, move.id).toBe(true);
    }
  });

  it('describes every node with real numbers rather than a hand-written blurb', () => {
    for (const node of ALL_RACE_PLAN_NODES) {
      const lines = describeEffects(node);
      expect(lines.length, node.id).toBeGreaterThan(0);
      for (const line of lines) expect(line, node.id).not.toMatch(/undefined|NaN/);
    }
  });
});

describe('role guard', () => {
  it('never offers a melee-only move to a ranged unit, or the reverse', () => {
    for (const unit of ALL_UNITS) {
      for (const move of ALL_FINISHING_DEFS) {
        const allowed = guardPasses(move, unit, 8);
        if (!allowed) continue;
        if (move.guard.appliesTo === 'MELEE') expect(unit.attackRange, `${unit.id}/${move.id}`).toBeLessThan(2);
        if (move.guard.appliesTo === 'RANGED') expect(unit.attackRange, `${unit.id}/${move.id}`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('leaves every unit at least three legal moves across three categories', () => {
    for (const unit of ALL_UNITS) {
      const legal = FINISHING_MOVE_DEFS.filter((n) => guardPasses(n, unit, 8));
      expect(legal.length, unit.id).toBeGreaterThanOrEqual(3);
      const categories = new Set(legal.map((n: RacePlanNode) => n.finishingCategory));
      expect(categories.size, unit.id).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('racing profiles', () => {
  it('joins all 145 units and keeps percentiles inside 0..1', () => {
    expect(RACING_PROFILES.size).toBe(ALL_UNITS.length);
    for (const unit of ALL_UNITS) {
      const profile = RACING_PROFILES.get(unit.id);
      expect(profile, unit.id).toBeDefined();
      for (const axis of ['stylePct.nige', 'distancePct.long', 'surfacePct.dirt']) {
        const value = readPct(profile!, axis);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
    expect(G1_THEMES.length).toBeGreaterThan(0);
    // JGI is the 장애 (jump) grade, added with the overseas races in the manual layer.
    for (const theme of G1_THEMES) expect(['GI', 'JpnI', 'JGI']).toContain(theme.grade);
  });

  it('separates a rare aptitude from a universal one', () => {
    // 132 of 145 units hold turf A or better and 93 are dirt F, so grading on
    // the letter would hand almost everyone the turf bonus and nobody the dirt
    // one. The percentile is what makes the two mean different things.
    const turf = [...RACING_PROFILES.values()].filter((p) => p.surface.turf === 'A');
    const dirt = [...RACING_PROFILES.values()].filter((p) => p.surface.dirt === 'A');
    expect(turf.length).toBeGreaterThan(50);
    expect(dirt.length).toBeGreaterThan(0);
    const meanTurf = turf.reduce((n, p) => n + p.surfacePct.turf, 0) / turf.length;
    const meanDirt = dirt.reduce((n, p) => n + p.surfacePct.dirt, 0) / dirt.length;
    expect(meanDirt).toBeGreaterThan(meanTurf + 0.15);
  });

  it('keeps the aptitude weight inside +-15% and never zeroes a candidate', () => {
    const node = RACE_PLAN_DEFS.find((n) => n.fit.aptitudeAxes?.length)!;
    for (const profile of RACING_PROFILES.values()) {
      const weight = aptitudeFlavor(node, profile);
      expect(weight).toBeGreaterThanOrEqual(0.88);
      expect(weight).toBeLessThanOrEqual(1.15);
    }
    expect(aptitudeFlavor(node, undefined)).toBe(1);
  });
});

describe('offers', () => {
  it('is deterministic for the same state, including after rerolls', () => {
    const build = () => {
      const { state, player } = seeded();
      board(state, player, ALL_UNITS.slice(0, 6).map((u) => u.id));
      const offer = createRacePlanOffer({ state, player, phase: 'PLAN', rerollIndex: 0 });
      player.racePlan!.currentOffer = offer;
      rerollRacePlanSlot(state, player, 1);
      return player.racePlan!.currentOffer!;
    };
    const a = build();
    const b = build();
    expect(a.options).toEqual(b.options);
    expect(a.reasons).toEqual(b.reasons);
  });

  it('always deals exactly three cards with distinct tags', () => {
    for (let seed = 1; seed <= 12; seed += 1) {
      const { state, player } = seeded(seed * 97);
      board(state, player, ALL_UNITS.slice(seed, seed + 6).map((u) => u.id));
      const offer = createRacePlanOffer({ state, player, phase: 'PLAN', rerollIndex: 0 });
      expect(offer.options).toHaveLength(3);
      expect(new Set(offer.options).size).toBe(3);
      const tags = offer.options.map((id) => ALL_RACE_PLAN_NODES.find((n) => n.id === id)!.majorTag);
      expect(new Set(tags).size, `seed ${seed}`).toBeGreaterThan(1);
      for (const reasons of offer.reasons) expect(reasons.length).toBeGreaterThan(0);
    }
  });

  it('does not hand eight players the same three cards', () => {
    const state = createMatch({ seed: 777, allAi: true, seasonId: 's1' });
    const units = ALL_UNITS.slice(0, 40);
    state.players.forEach((player, i) => {
      board(state, player, units.slice(i * 4, i * 4 + 5).map((u) => u.id));
      player.gold = i * 9;
      player.level = 4 + (i % 4);
      player.racePlan!.currentOffer = createRacePlanOffer({ state, player, phase: 'PLAN', rerollIndex: 0 });
    });
    const sets = state.players.map((p) => [...p.racePlan!.currentOffer!.options].sort().join('|'));
    const worst = Math.max(...sets.map((s) => sets.filter((o) => o === s).length));
    expect(worst).toBeLessThanOrEqual(2);
  });

  it('spends a reroll only when it can actually replace the card', () => {
    const { state, player } = seeded(31);
    board(state, player, ALL_UNITS.slice(0, 6).map((u) => u.id));
    const offer = createRacePlanOffer({ state, player, phase: 'PLAN', rerollIndex: 0 });
    player.racePlan!.currentOffer = offer;
    const before = offer.options[0];
    expect(rerollRacePlanSlot(state, player, 0)).toBe(true);
    expect(offer.options[0]).not.toBe(before);
    expect(rerollRacePlanSlot(state, player, 0)).toBe(false);
    expect(rerollRacePlanSlot(state, player, 9)).toBe(false);
  });

  it('gives the finishing offer three different categories', () => {
    for (const unitId of ['kitasan_black', 'special_week', 'gold_ship', 'silence_suzuka', 'hokko_tarumae']) {
      const { state, player } = seeded(11);
      board(state, player, [unitId, ...ALL_UNITS.slice(0, 5).map((u) => u.id)]);
      player.racePlan!.planId = 'RP_SLOW_STORE';
      player.racePlan!.entryUnitDefId = unitId;
      const offer = createRacePlanOffer({ state, player, phase: 'FINISHING', rerollIndex: 0, entryUnitDefId: unitId });
      expect(offer.options).toHaveLength(3);
      const categories = offer.options.map(
        (id) => ALL_FINISHING_DEFS.find((n) => n.id === id)!.finishingCategory,
      );
      expect(new Set(categories).size, unitId).toBe(3);
      const unit = getUnitDef(unitId);
      for (const id of offer.options) {
        expect(guardPasses(ALL_FINISHING_DEFS.find((n) => n.id === id)!, unit, player.board.length), `${unitId}/${id}`).toBe(true);
      }
    }
  });
});

describe('entry lifecycle', () => {
  it('recommends a low-cost three-star as readily as a legendary', () => {
    const { state, player } = seeded(5);
    const cheap = ALL_UNITS.find((u) => u.cost === 1 && u.role === 'AD_CARRY')!;
    const legendary = ALL_UNITS.find((u) => u.cost === 5)!;
    board(state, player, [cheap.id, legendary.id, ...ALL_UNITS.slice(0, 3).map((u) => u.id)]);
    player.board[0].star = 3;
    player.board[0].items = ['champion_trophy', 'twilight_racing_suit'];
    const ranked = entryCandidates(state, player);
    expect(ranked[0].unitDefId, '3-star with items should beat a bare legendary').toBe(cheap.id);
    // And the legendary is still a candidate, not filtered out.
    expect(ranked.some((c) => c.unitDefId === legendary.id)).toBe(true);
  });

  it('follows the entry through a star-up that deletes its instance', () => {
    const { state, player } = seeded(6);
    const unit = ALL_UNITS[0];
    board(state, player, [unit.id]);
    player.racePlan!.entryUnitDefId = unit.id;
    player.racePlan!.entryUnitInstanceId = player.board[0].instanceId;

    // applyCombines keeps the copy with the most items; simulate that outcome.
    const heir = { ...newInstance(state, unit.id, 2), position: { q: 0, r: 0 }, items: ['champion_trophy'] };
    player.board = [heir];
    reconcileEntryUnit(player);
    expect(player.racePlan!.entryUnitInstanceId).toBe(heir.instanceId);
    expect(player.racePlan!.entryUnitDefId).toBe(unit.id);
  });

  it('restores a sold entry once, then lets it go for good', () => {
    const { state, player } = seeded(7);
    const unit = ALL_UNITS[0];
    board(state, player, [unit.id]);
    player.racePlan!.entryUnitDefId = unit.id;
    player.racePlan!.entryUnitInstanceId = player.board[0].instanceId;
    player.racePlan!.finishingMoveId = 'FM_EVEN_PACE';

    player.board = [];
    reconcileEntryUnit(player);
    expect(player.racePlan!.entryDetached).toBe(true);
    expect(player.racePlan!.entryUnitDefId).toBe(unit.id);

    board(state, player, [unit.id]);
    reconcileEntryUnit(player);
    expect(player.racePlan!.entryDetached).toBe(false);
    expect(player.racePlan!.entryRestoreUsed).toBe(true);
    expect(player.racePlan!.finishingMoveId).toBe('FM_EVEN_PACE');

    player.board = [];
    reconcileEntryUnit(player);
    player.board = [];
    reconcileEntryUnit(player);
    expect(player.racePlan!.entryUnitDefId).toBeUndefined();
    expect(player.racePlan!.finishingMoveId).toBeUndefined();
  });

  it('allows one transfer, drops the old finishing move and re-deals three', () => {
    const { state, player } = seeded(8);
    state.stage = 5; state.round = 1;
    const [a, b] = ALL_UNITS.slice(0, 2);
    board(state, player, [a.id, b.id]);
    player.racePlan!.planId = 'RP_MIDDLE_BALANCE';
    player.racePlan!.offerPhase = 'ENTRY';
    expect(chooseRaceEntry(state, player, player.board[0].instanceId)).toBe(true);
    const first = player.racePlan!.currentOffer!.options[0];
    expect(chooseRacePlanOption(state, player, first)).toBe(true);
    expect(player.racePlan!.finishingMoveId).toBe(first);

    expect(transferRaceEntry(state, player, player.board[1].instanceId)).toBe(true);
    expect(player.racePlan!.entryUnitDefId).toBe(b.id);
    expect(player.racePlan!.finishingMoveId).toBeUndefined();
    expect(player.racePlan!.currentOffer!.options).toHaveLength(3);
    // One per match.
    expect(transferRaceEntry(state, player, player.board[0].instanceId)).toBe(false);
  });
});

describe('match integration', () => {
  it('opens the plan at 2-5, the branch at 3-5 and the entry at 4-5 for every AI', () => {
    const state = createMatch({ seed: 99, allAi: true, seasonId: 's1' });
    const director = new RoundDirector(state);
    director.runToCompletion(60);
    const survivors = state.players.filter((p) => (p.racePlan?.planId ?? null) !== null);
    expect(survivors.length).toBeGreaterThanOrEqual(6);
    for (const player of survivors) {
      expect(player.racePlan!.planId).toBeTruthy();
      // Anyone who lived past stage 4 should carry an entry and a finishing move.
      if (player.eliminatedAtRound === null || player.placement! <= 4) {
        expect(player.racePlan!.entryUnitDefId, player.id).toBeTruthy();
        expect(player.racePlan!.finishingMoveId, player.id).toBeTruthy();
      }
    }
    expect(state.g1ThemeId).toBeTruthy();
  });

  it('reaches the last 3F in the overwhelming majority of real fights', () => {
    let fights = 0;
    let reached = 0;
    for (const seed of [11, 23, 37, 51]) {
      const state = createMatch({ seed, allAi: true, seasonId: 's1' });
      const director = new RoundDirector(state);
      director.beginPrep();
      for (let i = 0; i < 18 && !director.isOver; i += 1) {
        const pvp = director.info.kind !== 'PVE';
        director.resolveRound(false, true);
        for (const frames of pvp ? director.playerFrames.values() : []) {
          if (!frames.length) continue;
          fights += 1;
          const sawLast3f = frames.some((f) =>
            f.events.some((e) => e.type === 'RACE_PHASE' && e.phase === 'LAST_3F'));
          if (sawLast3f) reached += 1;
        }
        director.advance();
      }
    }
    expect(fights).toBeGreaterThan(50);
    // Clock-only phases would land near the 17% overtime rate instead.
    expect(reached / fights).toBeGreaterThan(0.8);
  });

  it('keeps the lobby on one shared GⅠ and one shared going per round', () => {
    const state = createMatch({ seed: 1234, allAi: true, seasonId: 's1' });
    const director = new RoundDirector(state);
    director.beginPrep();
    const theme = state.g1ThemeId;
    for (let i = 0; i < 6; i += 1) { director.resolveRound(); director.advance(); }
    expect(state.g1ThemeId).toBe(theme);
    expect(['FAST', 'STANDARD', 'HEAVY']).toContain(state.racePlanTrack);
  });
});

describe('AI awareness', () => {
  it('always fields its own GⅠ entry and never sells it', () => {
    // Race Plan effects only apply to a unit that races, so an AI that leaves
    // its entry on the bench has switched off the plan it just chose.
    let registered = 0;
    let unfielded = 0;
    let detached = 0;
    for (const seed of [17, 29, 43]) {
      const state = createMatch({ seed: seed * 113, allAi: true, seasonId: 's1' });
      const director = new RoundDirector(state);
      director.beginPrep();
      for (let i = 0; i < 40 && !director.isOver; i += 1) {
        for (const player of state.players) {
          if (player.eliminatedAtRound !== null || !player.racePlan?.entryUnitDefId) continue;
          registered += 1;
          if (!entryIsFielded(player)) unfielded += 1;
          if (player.racePlan.entryDetached) detached += 1;
        }
        director.resolveRound();
        director.advance();
      }
    }
    expect(registered).toBeGreaterThan(100);
    expect(unfielded).toBe(0);
    expect(detached).toBe(0);
  });

  it('spreads its picks across the catalogue instead of converging on one plan', () => {
    const plans = new Set<string>();
    const moves = new Set<string>();
    for (const seed of [5, 61, 97]) {
      const state = createMatch({ seed: seed * 71, allAi: true, seasonId: 's1' });
      const director = new RoundDirector(state);
      director.runToCompletion(60);
      for (const player of state.players) {
        if (player.racePlan?.planId) plans.add(player.racePlan.planId);
        if (player.racePlan?.finishingMoveId) moves.add(player.racePlan.finishingMoveId);
      }
    }
    expect(plans.size).toBeGreaterThanOrEqual(6);
    expect(moves.size).toBeGreaterThanOrEqual(6);
  });

  it('prefers to put gear on the horse carrying the race', () => {
    const { state, player } = seeded(2026);
    const carry = ALL_UNITS.find((u) => u.role === 'AD_CARRY' && u.cost === 3)!;
    const other = ALL_UNITS.find((u) => u.role === 'AD_CARRY' && u.cost === 3 && u.id !== carry.id)!;
    board(state, player, [carry.id, other.id]);
    const [entryUnit, plainUnit] = player.board;
    player.racePlan!.planId = 'RP_HIGH_PACE_PRESSURE';
    player.racePlan!.entryUnitDefId = entryUnit.unitDefId;
    player.racePlan!.entryUnitInstanceId = entryUnit.instanceId;
    expect(itemFit(entryUnit, 'champion_trophy', player))
      .toBeGreaterThan(itemFit(plainUnit, 'champion_trophy', player));
  });
});

describe('각질 phase curve', () => {
  const WEIGHTS: Record<RaceCombatPhase, number> = {
    // Share of a full race each phase occupies, from RACE_PHASE_AT.
    START: 1 / 6, POSITIONING: 1 / 2, LATE: 1 / 6, LAST_3F: 1 / 6, OVERTIME: 0,
  };

  it('gives every style a differently shaped curve rather than the same one', () => {
    const shapes = RUN_STYLES.map((style) =>
      (['START', 'POSITIONING', 'LATE', 'LAST_3F'] as RaceCombatPhase[])
        .map((p) => styleStepAt(style, p).damage.toFixed(2)).join(','));
    expect(new Set(shapes).size).toBe(RUN_STYLES.length);
  });

  it('rises monotonically for the closers and falls for the front-runner', () => {
    const order: RaceCombatPhase[] = ['START', 'POSITIONING', 'LATE', 'LAST_3F'];
    const damage = (s: 'nige' | 'senko' | 'sashi' | 'oikomi') =>
      order.map((p) => styleStepAt(s, p).damage);
    // A closer is worth more the longer the race runs.
    for (const style of ['sashi', 'oikomi'] as const) {
      const curve = damage(style);
      for (let i = 1; i < curve.length; i += 1) expect(curve[i], style).toBeGreaterThan(curve[i - 1]);
      // And it buys that late power with early damage reduction.
      expect(styleStepAt(style, 'START').resist).toBeGreaterThan(0);
      expect(styleStepAt(style, 'LAST_3F').resist).toBe(0);
    }
    // 도주 is the mirror image: paid up front, spent by the straight.
    const nige = damage('nige');
    expect(nige[0]).toBeGreaterThan(0);
    expect(nige.at(-1)!).toBeLessThan(0);
  });

  it('keeps the four styles within a narrow band once phase length is counted', () => {
    // Each phase is weighted by how much of the race it actually occupies, so a
    // 26% bonus over the last sixth does not read as six times a 4% one.
    const totals = RUN_STYLES.map((s) => curveWeightedDamage(s, WEIGHTS));
    const spread = Math.max(...totals) - Math.min(...totals);
    expect(spread, `totals ${totals.map((t) => t.toFixed(3)).join(' ')}`).toBeLessThan(0.06);
  });

  it('binds the curve to every unit with a style, not just the GⅠ entry', () => {
    for (const style of RUN_STYLES) {
      const effects = styleCurveEffects(style);
      // Four curve steps plus one signature, all reachable.
      expect(effects.some((e) => e.trigger?.when === 'IN_RACE_PHASE'), style).toBe(true);
      expect(effects.some((e) => e.trigger?.when === 'ON_RACE_PHASE'), style).toBe(true);
    }
  });

  it('lets the pace bend the curve in opposite directions for front and back', () => {
    const high = { ...DEFAULT_CONDITIONS, pace: 'HIGH' as const };
    const slow = { ...DEFAULT_CONDITIONS, pace: 'SLOW' as const };
    // A hard pace empties the front-runner and pays the closer.
    expect(paceStyleScale(high, 'nige')).toBeLessThan(1);
    expect(paceStyleScale(high, 'oikomi')).toBeGreaterThan(1);
    // A slow one does exactly the reverse; that symmetry is the whole mechanic.
    expect(paceStyleScale(slow, 'nige')).toBeGreaterThan(1);
    expect(paceStyleScale(slow, 'oikomi')).toBeLessThan(1);
  });
});

describe('race conditions', () => {
  it('never announces clear skies on a bog', () => {
    for (let i = 0; i < 500; i += 1) {
      const c = rollRaceConditions(Rng.forStream(i, 'race-track'));
      expect(getWeather(c.weather).goings, `${c.weather}/${c.going}`).toContain(c.going);
    }
  });

  it('produces real variety rather than three going values', () => {
    const lines = new Set<string>();
    for (let i = 0; i < 400; i += 1) lines.add(describeConditions(rollRaceConditions(Rng.forStream(i, 'race-track'))));
    expect(lines.size).toBeGreaterThan(60);
  });

  it('keeps 개최 특례 rare enough to stay special', () => {
    let withClause = 0;
    for (let i = 0; i < 600; i += 1) {
      if (rollRaceConditions(Rng.forStream(i, 'race-track')).clause !== 'NONE') withClause += 1;
    }
    const rate = withClause / 600;
    expect(rate).toBeGreaterThan(0.2);
    expect(rate).toBeLessThan(0.5);
  });

  it('gives every axis a note the help panel can print', () => {
    for (const def of [...GOING_DEFS, ...PACE_DEFS, ...WEATHER_DEFS, ...CLAUSE_DEFS]) {
      expect(def.nameKo.length, def.id).toBeGreaterThan(0);
      expect(def.noteKo.endsWith('.') || def.noteKo.endsWith('다'), def.id).toBe(true);
    }
  });

  it('leaves a battle with no round behind it on neutral ground', () => {
    // A synthetic battle is not a race: no going, no 과제, no 각질 curve. If this
    // ever regresses, every exact-damage contract test starts drifting.
    const state = createMatch({ seed: 77, allAi: true, seasonId: 's1' });
    expect(state.raceConditions).toEqual(DEFAULT_CONDITIONS);
    expect(state.g1ThemeId).toBeTruthy();
  });
});

describe('GⅠ identity', () => {
  it('covers the whole calendar and adds the overseas and 장애 races', () => {
    expect(G1_THEMES.length).toBeGreaterThanOrEqual(46);
    expect(G1_THEMES.some((t) => t.id === 'ARC')).toBe(true);
    expect(G1_THEMES.some((t) => t.grade === 'JGI')).toBe(true);
    // The vendored calendar was thin at both ends; the manual layer fills it.
    const sprints = G1_THEMES.filter((t) => t.distanceClass === 'SPRINT').length;
    const longs = G1_THEMES.filter((t) => t.distanceClass === 'LONG').length;
    expect(sprints).toBeGreaterThanOrEqual(5);
    expect(longs).toBeGreaterThanOrEqual(5);
  });

  it('gives every race a 과제 with effects and a readable note', () => {
    for (const theme of G1_THEMES) {
      const id = g1Identity(theme);
      expect(id.effects.length, theme.id).toBeGreaterThan(0);
      expect(id.favours.length, theme.id).toBeGreaterThan(0);
      expect(id.noteKo.length, theme.id).toBeGreaterThan(10);
    }
  });

  it('spreads the calendar across several identities instead of one', () => {
    const names = new Set(G1_THEMES.map((t) => g1Identity(t).nameKo));
    expect(names.size).toBeGreaterThanOrEqual(8);
  });

  it('has no duplicate race ids after the merge', () => {
    expect(new Set(G1_THEMES.map((t) => t.id)).size).toBe(G1_THEMES.length);
  });
});

describe('new effect primitives', () => {
  it('scales a value by a live quantity and respects the cap', () => {
    const ctx = {
      now: 0, overtime: false, units: [] as never[],
      dealDamage: () => 0, applyStatus: () => {}, dash: () => {}, summon: () => {},
    } as unknown as Parameters<typeof scaleFactor>[0];
    const self = { hp: 40, maxHp: 100, team: 'A', id: 'x' } as unknown as Parameters<typeof scaleFactor>[1];
    expect(scaleFactor(ctx, self, { kind: 'DAMAGE_AMP', value: 1, scaleBy: 'SELF_MISSING_HP_PCT' })).toBeCloseTo(0.6);
    expect(scaleFactor(ctx, self, { kind: 'DAMAGE_AMP', value: 1, scaleBy: 'SELF_CURRENT_HP_PCT' })).toBeCloseTo(0.4);
    expect(scaleFactor(ctx, self, { kind: 'DAMAGE_AMP', value: 1, scaleBy: 'SELF_MISSING_HP_PCT', scaleCap: 0.25 })).toBeCloseTo(0.25);
    // No scaleBy means no scaling at all, never zero.
    expect(scaleFactor(ctx, self, { kind: 'DAMAGE_AMP', value: 1 })).toBe(1);
  });

  it('caps how many free re-releases one cast can buy', () => {
    // Two is the ceiling; without it a pair of ENCORE cards on one unit loops.
    expect(MAX_RECAST_DEPTH).toBeGreaterThan(0);
    expect(MAX_RECAST_DEPTH).toBeLessThanOrEqual(3);
  });

  it('uses the new primitives in real cards rather than declaring them unused', () => {
    const all = ALL_RACE_PLAN_NODES.flatMap((n) => n.effects);
    for (const kind of ['RECAST_SKILL', 'MANA_FILL', 'CONVERT_STAT']) {
      expect(all.some((e) => e.kind === kind), kind).toBe(true);
    }
    expect(all.some((e) => e.scaleBy), 'scaleBy').toBe(true);
    expect(all.some((e) => e.trigger?.when === 'IN_RACE_PHASE'), 'IN_RACE_PHASE').toBe(true);
  });
});
