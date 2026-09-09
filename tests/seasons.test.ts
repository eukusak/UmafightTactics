import { describe, expect, it } from 'vitest';
import { ALL_UNITS, ACTIVE_UNIT_IDS, SEASONS, getSeasonUnits, getSeasonUnitTraits, getUnitTraits, getSeason } from '../src/game/engine/roster';
import { SEASON_COST_COUNTS, SEASON_TRAIT_DEFS, buildSeasons } from '../src/game/engine/seasons/catalog';
import { createMatch, RoundDirector, heldUnits } from '../src/game/engine/rounds/director';
import { rollShop, newInstance } from '../src/game/engine/shop';
import { createPool, countInPlay, totalCopies } from '../src/game/engine/pool';
import { createDraft } from '../src/game/engine/rounds/draft';
import { Rng } from '../src/game/engine/rng';
import { parseSave, serializeMatch } from '../src/game/engine/save';
import { activeTraitCounts } from '../src/game/engine/ai';
import { applyAugment } from '../src/game/engine/augments/offers';
import { AUGMENT_DEFS } from '../src/game/engine/augments/augment-defs';
import { BattleEngine, type BattleSideInput } from '../src/game/engine/battle/engine';
import { stat } from '../src/game/engine/battle/combat-unit';
import { clientMessageSchema, type ServerMessage } from '../src/game/network/protocol';
import { RoomService } from '../server/rooms';
import generated from '../src/data/generated/seasons.json';

describe('five complete season rosters', () => {
  it('covers every character, preserves the first roster, and is reproducible', () => {
    expect(new Set(SEASONS.flatMap(s => s.unitIds))).toEqual(new Set(ALL_UNITS.map(u => u.id)));
    expect(SEASONS[0].unitIds).toEqual(ACTIVE_UNIT_IDS);
    expect(SEASONS).toEqual(buildSeasons(ALL_UNITS, ACTIVE_UNIT_IDS));
    expect(SEASONS).toEqual(generated.seasons);
    expect(new Set(SEASON_TRAIT_DEFS.map(t => t.id)).size).toBe(20);
    for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) {
      expect(SEASONS[i].unitIds.filter(id => !SEASONS[j].unitIds.includes(id)).length).toBeGreaterThan(15);
    }
  });
  it.each(SEASONS)('$id has a viable roster and four reachable factions', season => {
    const units = getSeasonUnits(season.id);
    expect(new Set(season.unitIds).size).toBe(60);
    for (const [cost, count] of Object.entries(SEASON_COST_COUNTS)) expect(units.filter(u => u.cost === Number(cost))).toHaveLength(count);
    for (const role of ['TANK', 'BRUISER', 'AD_CARRY', 'AP_CARRY', 'SUPPORT']) expect(units.filter(u => u.role === role).length).toBeGreaterThanOrEqual(5);
    for (const trait of ['nige', 'senko', 'sashi', 'oikomi', 'middle', 'miler', 'stayer', 'sprinter']) {
      expect(units.filter(u => u.traits.some(t => t === trait)).length).toBeLessThanOrEqual(27);
    }
    for (const trait of season.traits) {
      const members = units.filter(u => season.unitTraits[u.id] === trait.id);
      expect(members).toHaveLength(15);
      expect(members.some(u => u.cost === 1)).toBe(true);
      expect(members.some(u => u.cost === 5)).toBe(true);
      expect(members.some(u => u.role === 'TANK' || u.role === 'BRUISER')).toBe(true);
      expect(members.some(u => u.role === 'AD_CARRY' || u.role === 'AP_CARRY')).toBe(true);
      for (const member of members) expect(getUnitTraits(member.id, season.id)).toContain(trait.id);
    }
  });
  it.each(SEASONS)('$id uses its own pool, shop and draft at every level', season => {
    const state = createMatch({ seed: 91, seasonId: season.id });
    const rng = new Rng(52), player = state.players[0];
    expect(Object.keys(state.pool.remaining).sort()).toEqual([...season.unitIds].sort());
    for (let level = 1; level <= 10; level++) {
      player.level = level;
      for (let n = 0; n < 10; n++) for (const slot of rollShop(player, state.pool, rng)) expect(season.unitIds).toContain(slot.unitDefId);
    }
    for (let stage = 1; stage <= 7; stage++) {
      state.stage = stage;
      const draft = createDraft(state, rng, true, stage === 1);
      for (const option of draft.options) expect(season.unitIds).toContain(option.unitDefId);
    }
    expect(totalCopies(season.id)).toBe(totalCopies());
    expect(createPool(season.id).seasonId).toBe(season.id);
  });
  it.each(SEASONS)('$id preserves season and RNG through save/restore', season => {
    const director = new RoundDirector(createMatch({ seed: 808, seasonId: season.id }));
    director.beginPrep();
    const loaded = parseSave(JSON.stringify(serializeMatch(director)));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) throw new Error('Save did not load');
    expect(loaded.save.match).toEqual(director.state);
    const restored = new RoundDirector(loaded.save.match);
    for (const d of [director, restored]) d.state.players[0].shop = rollShop(d.state.players[0], d.state.pool, d.rngs.get('shop'));
    expect(restored.state.players[0].shop).toEqual(director.state.players[0].shop);
    const corrupt = serializeMatch(director);
    corrupt.match.players[0].seasonId = season.id === 's1' ? 's2' : 's1';
    expect(parseSave(JSON.stringify(corrupt))).toEqual({ ok: false, reason: 'CORRUPT' });
  });
  it.each(SEASONS)('$id grants trait rewards from its roster, including former reserves', season => {
    for (const augment of AUGMENT_DEFS.filter(a => a.grants?.unitOfTrait)) {
      const state = createMatch({ seed: 77, seasonId: season.id });
      const candidates = getSeasonUnits(season.id).filter(u => u.cost <= 2 && u.traits.includes(augment.grants!.unitOfTrait!));
      expect(candidates.length).toBeGreaterThan(0);
      const target = candidates.find(u => !u.activeS1) ?? candidates[0];
      // Exhaust every other eligible unit to prove this exact season member is reachable.
      for (const unit of candidates) if (unit.id !== target.id) state.pool.remaining[unit.id] = 0;
      const before = state.pool.remaining[target.id];
      applyAugment(state, state.players[0], augment.id, new Rng(12));
      expect(state.players[0].bench.map(u => u.unitDefId)).toContain(target.id);
      expect(state.pool.remaining[target.id]).toBe(before - 1);
    }
  });
  it('counts seasonal factions by distinct unit and does not leak other seasons', () => {
    const state = createMatch({ seed: 1, seasonId: 's2' }), player = state.players[0];
    player.level = 6;
    const members = getSeasonUnits('s2').filter(u => getSeason('s2').unitTraits[u.id] === 's2_aria').slice(0, 3);
    player.board = members.map((u, i) => ({ ...newInstance(state, u.id, 1), position: { q: i, r: 0 } }));
    player.board.push({ ...newInstance(state, members[0].id, 1), position: { q: 3, r: 0 } });
    expect(activeTraitCounts(player).get('s2_aria')).toBe(3);
    expect([...activeTraitCounts(player).keys()].some(t => t.startsWith('s1_'))).toBe(false);
  });
});

function battleFor(trait: string, enabled: boolean, seconds: number) {
  const season = SEASONS.find(s => s.traits.some(t => t.id === trait))!;
  const units = getSeasonUnits(season.id).filter(u => season.unitTraits[u.id] === trait).slice(0, 3);
  const side = (id: string): BattleSideInput => ({ playerId: id, augments: [], tacticianItems: [], units: units.map((u, i) => ({
    instanceId: `${id}-${i}`, unitDefId: u.id, star: 1, items: [], position: { q: i + 1, r: 0 },
    extraTraits: enabled && id === 'a' ? getSeasonUnitTraits(u.id, season.id) : [],
  })) });
  const engine = new BattleEngine(side('a'), side('b'), new Rng(44), { maxSeconds: seconds, recordFrames: true });
  const result = engine.run();
  return { engine, result };
}

describe('seasonal synergy mechanics', () => {
  it('grants starting mana, opening shields and permanent stats to members only', () => {
    for (const trait of ['s1_pace', 's1_banner', 's1_spark', 's1_team', 's3_trail', 's5_crown']) {
      const base = battleFor(trait, false, 0).engine;
      const buffed = battleFor(trait, true, 0).engine;
      const snapshot = (e: BattleEngine, team: string) => e.units.filter(u => u.team === team).map(u => ({ hp: u.hp, mana: u.mana, shields: u.shields, ad: stat(u, 'attackDamage', 0), ap: stat(u, 'abilityPower', 0), armor: stat(u, 'armor', 0), as: stat(u, 'attackSpeed', 0) }));
      expect(snapshot(buffed, 'A'), trait).not.toEqual(snapshot(base, 'A'));
      expect(snapshot(buffed, 'B'), trait).toEqual(snapshot(base, 'B'));
    }
    const base = battleFor('s1_spark', false, 0).engine;
    const buffed = battleFor('s1_spark', true, 0).engine;
    expect(buffed.units[0].mana - base.units[0].mana).toBe(8);
  });
  it.each(SEASON_TRAIT_DEFS)('$id changes combat when its first breakpoint is reached', trait => {
    const base = battleFor(trait.id, false, 20).engine;
    const buffed = battleFor(trait.id, true, 20).engine;
    expect(buffed.frames, trait.id).not.toEqual(base.frames);
    for (const frame of buffed.frames!) for (const u of frame.units) expect(Number.isFinite(u.hp)).toBe(true);
  });
});

describe('online season isolation', () => {
  it('keeps different rooms independent across start, checkpoint and restore', () => {
    const service = new RoomService(() => 1000);
    for (const seasonId of ['s2', 's5'] as const) {
      const makePeer = () => ({ messages: [] as ServerMessage[], send(m: ServerMessage) { this.messages.push(m); }, close() {} });
      const host = makePeer(), guest = makePeer();
      service.receive(host, { type: 'create', name: 'host', seasonId });
      const room = [...service.rooms.values()].find(r => r.seasonId === seasonId)!;
      service.receive(guest, { type: 'join', name: 'guest', code: room.code });
      service.receive(host, { type: 'ready', ready: true });
      service.receive(guest, { type: 'ready', ready: true });
      service.receive(host, { type: 'start', fillAi: true });
      expect(room.director!.state.seasonId).toBe(seasonId);
      expect(Object.keys(room.director!.state.pool.remaining).sort()).toEqual([...getSeason(seasonId).unitIds].sort());
      const sent = guest.messages.filter(m => m.type === 'room').at(-1)!;
      expect(sent.room.seasonId).toBe(seasonId);
    }
    const restored = new RoomService(() => 2000);
    restored.restore(service.snapshot());
    expect([...restored.rooms.values()].map(r => r.director!.state.seasonId)).toEqual(['s2', 's5']);
    expect(clientMessageSchema.safeParse({ type: 'create', name: 'bad', seasonId: 's6' }).success).toBe(false);
    expect(() => createMatch({ seed: 1, seasonId: 's6' as never })).toThrow('Unknown season');
  });
  it.each(SEASONS)('$id completes a match without losing shared copies', season => {
    const state = createMatch({ seed: 4202, allAi: true, seasonId: season.id });
    const d = new RoundDirector(state);
    d.beginPrep();
    for (let round = 0; round < 100 && !d.isOver; round++) {
      expect(countInPlay(state.pool, heldUnits(state))).toBe(totalCopies(season.id));
      for (const p of state.players) for (const u of [...p.board, ...p.bench]) expect(season.unitIds).toContain(u.unitDefId);
      d.resolveRound();
      d.advance();
    }
    expect(state.phase).toBe('GAME_OVER');
    expect(new Set(state.finalStandings).size).toBe(8);
  }, 30000);
});
