import { describe, expect, it } from 'vitest';
import { RoomService, type Peer } from '../server/rooms';
import { clientMessageSchema, type ServerMessage, type ClientMessage } from '../src/game/network/protocol';

function peer() {
  const messages: ServerMessage[] = [];
  let closed = false;
  return { messages, send: (m: ServerMessage) => messages.push(structuredClone(m)), close: () => { closed = true; }, get closed() { return closed; } } satisfies Peer & { messages: ServerMessage[]; readonly closed: boolean };
}
function fixture(count = 8) {
  let time = 1000;
  const service = new RoomService(() => time);
  const peers = Array.from({ length: count }, peer);
  service.receive(peers[0], { type: 'create', name: 'Trainer 1' });
  const room = [...service.rooms.values()][0];
  for (let i = 1; i < count; i++) service.receive(peers[i], { type: 'join', name: `Trainer ${i + 1}`, code: room.code });
  const send = (i: number, message: ClientMessage) => service.receive(peers[i], message);
  const start = () => { peers.forEach((_, i) => send(i, { type: 'ready', ready: true })); send(0, { type: 'start', fillAi: count < 8 }); };
  const tick = (at = room.deadline + 1) => { time = at; service.tick(); };
  const prep = () => { for (let i = 0; i < 20 && room.director?.state.phase !== 'ROUND_PREP'; i++) tick(); expect(room.director?.state.phase).toBe('ROUND_PREP'); };
  return { service, room, peers, send, start, tick, prep };
}

describe('authoritative eight-player rooms', () => {
  it('requires host, eight ready seats, and refuses a ninth participant', () => {
    const f = fixture();
    f.send(1, { type: 'start', fillAi: false }); expect(f.room.director).toBeNull();
    f.send(0, { type: 'start', fillAi: false }); expect(f.room.director).toBeNull();
    const extra = peer(); f.service.receive(extra, { type: 'join', name: 'Extra', code: f.room.code });
    expect(extra.messages.at(-1)?.type).toBe('error');
    f.start(); expect(f.room.director!.state.players.filter((p) => p.isHuman)).toHaveLength(8);
    expect(new Set(f.room.seats.map((s) => s.token)).size).toBe(8);
  });
  it('redacts private stores, shared pool and RNG separately for every seat', () => {
    const f = fixture(); f.start(); f.prep();
    f.peers.forEach((p, i) => {
      const m = p.messages.filter((m) => m.type === 'state').at(-1)!;
      expect(m.match.players.filter((p) => p.isHuman).map((p) => p.id)).toEqual([`p${i + 1}`]);
      expect(m.match.players[i].shop.length).toBeGreaterThan(0);
      expect(m.match.players.filter((p) => !p.isHuman).every((p) => p.shop.length === 0 && p.bench.length === 0)).toBe(true);
      expect(m.match.pool.remaining).toEqual({}); expect(m.match.rngStates).toEqual({}); expect(m.match.seed).toBe(0);
      expect(JSON.stringify(m)).not.toContain(f.room.seats[(i + 1) % 8].token);
    });
  });
  it('deduplicates commands, rejects stale rounds and enforces unit ownership', () => {
    const f = fixture(); f.start(); f.prep();
    const d = f.room.director!, player = d.state.players[0], opponent = d.state.players[1];
    const round = `${d.state.stage}-${d.state.round}`;
    f.send(0, { type: 'command', seq: 1, round, command: { action: 'lock' } }); expect(player.shopLocked).toBe(true);
    f.send(0, { type: 'command', seq: 1, round, command: { action: 'lock' } }); expect(player.shopLocked).toBe(true);
    f.send(0, { type: 'command', seq: 2, round: '99-99', command: { action: 'lock' } }); expect(player.shopLocked).toBe(true);
    const enemy = [...opponent.board, ...opponent.bench][0]; expect(enemy).toBeDefined();
    const before = structuredClone(opponent);
    f.send(0, { type: 'command', seq: 3, round, command: { action: 'sell', unit: enemy.instanceId } });
    expect(opponent).toEqual(before); expect(f.peers[0].messages.at(-1)?.type).toBe('error');
  });
  it('records all eight battles, sends no future frames and settles only at the server deadline', () => {
    const f = fixture(); f.start(); f.prep(); f.tick();
    const d = f.room.director!; expect(d.state.phase).toBe('BATTLE'); expect(d.playerFrames.size).toBe(8);
    const hp = d.state.players.map((p) => p.hp);
    f.tick(f.room.battleStarted + 500);
    for (const p of f.peers) {
      const batches = p.messages.filter((m) => m.type === 'frames');
      expect(batches.length).toBeGreaterThan(0);
      for (const m of batches) expect(m.frames.every((frame) => frame.t <= m.time)).toBe(true);
    }
    expect(d.state.players.map((p) => p.hp)).toEqual(hp); expect(d.state.lastResolution).toBeNull();
    const enemyUnit = d.state.players[0].board[0]; const position = { ...enemyUnit.position! };
    f.send(0, { type: 'command', seq: 1, round: `${d.state.stage}-${d.state.round}`, command: { action: 'move', unit: enemyUnit.instanceId, position: null } });
    expect(enemyUnit.position).toEqual(position);
    f.tick(); expect(d.state.phase).toBe('ROUND_RESOLVE'); expect(d.state.history).toHaveLength(1);
    f.tick(f.room.deadline - 1); expect(d.state.history).toHaveLength(1);
    f.tick(); expect(d.state.round).toBe(2);
  });
  it('restores a seat and playback history with a token and revokes the previous connection', () => {
    const f = fixture(); f.start(); f.prep(); f.tick(); f.tick(f.room.battleStarted + 1000);
    const seat = f.room.seats[2], token = seat.token, restored = peer();
    f.service.receive(restored, { type: 'resume', code: f.room.code, token });
    expect(f.peers[2].closed).toBe(true); expect(seat.peer).toBe(restored);
    expect(restored.messages.some((m) => m.type === 'frames' && m.reset && m.frames.length > 0)).toBe(true);
    const invalid = peer(); f.service.receive(invalid, { type: 'resume', code: f.room.code, token: 'x'.repeat(48) });
    expect(invalid.messages.at(-1)?.type).toBe('error');
    f.service.disconnect(f.peers[2]); expect(seat.peer).toBe(restored);
  });
  it('continues timers for disconnected players and expires abandoned rooms', () => {
    const f = fixture(2); f.start();
    f.service.disconnect(f.peers[1]); f.prep(); f.tick(); expect(f.room.director!.state.phase).toBe('BATTLE');
    f.service.disconnect(f.peers[0]); f.tick(1_000_000); expect(f.service.rooms.size).toBe(0);
  });
  it('keeps every PvP seat on its actual pairing and reaches eight final placements', () => {
    const f = fixture(); f.start(); let sawPvp = false;
    for (let n = 0; n < 350 && !f.room.director!.isOver; n++) {
      f.tick(); const d = f.room.director!;
      if (d.state.phase === 'BATTLE' && d.info.kind === 'PVP') {
        sawPvp = true;
        for (const p of d.state.players.filter((p) => p.hp > 0)) {
          const frames = d.playerFrames.get(p.id);
          expect(frames?.[0].units.some((u) => u.id.startsWith(`${p.id}#`))).toBe(true);
        }
      }
    }
    expect(sawPvp).toBe(true); expect(f.room.director!.isOver).toBe(true);
    expect(f.room.director!.state.players.map((p) => p.placement).sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(f.peers.every((p) => p.messages.some((m) => m.type === 'state' && m.match.phase === 'GAME_OVER'))).toBe(true);
  });
  it('rejects client-authored game state, invalid cells and prototype-like extras', () => {
    expect(clientMessageSchema.safeParse({ type: 'command', seq: 1, round: '1-1', command: { action: 'move', unit: 'p1#x', position: { q: 99, r: 0 } } }).success).toBe(false);
    expect(clientMessageSchema.safeParse({ type: 'command', seq: 1, round: '1-1', command: { action: 'xp', gold: 999 } }).success).toBe(false);
    expect(clientMessageSchema.safeParse({ type: 'state', match: {} }).success).toBe(false);
  });
});

describe('server restart checkpoints', () => {
  it('preserves eight seats, private state and the remaining draft deadline', () => {
    const f = fixture(); f.start();
    const saved = JSON.parse(JSON.stringify(f.service.snapshot()));
    const resumedAt = saved.savedAt + 60_000;
    const restored = new RoomService(() => resumedAt);
    restored.restore(saved);
    const room = restored.rooms.get(f.room.code)!;
    expect(room.director!.state).toEqual(f.room.director!.state);
    expect(room.deadline - resumedAt).toBe(f.room.deadline - saved.savedAt);
    expect(room.seats.every((seat) => seat.peer === null)).toBe(true);
    const peers = Array.from({ length: 8 }, peer);
    peers.forEach((p, i) => restored.receive(p, { type: 'resume', code: room.code, token: f.room.seats[i].token }));
    expect(room.seats.every((seat) => seat.peer !== null)).toBe(true);
    peers.forEach((p, i) => {
      const state = p.messages.filter((m) => m.type === 'state').at(-1)!;
      expect(state.match.players.filter((player) => player.id !== `p${i + 1}`).every((player) => !player.shop.length)).toBe(true);
      expect(JSON.stringify(p.messages)).not.toContain(f.room.seats[(i + 1) % 8].token);
    });
  });

  it('resumes battle without future frames, duplicate rewards or RNG divergence', () => {
    const f = fixture(); f.start(); f.prep(); f.tick();
    // Purchases during playback must survive too; restoring must not rerun combat.
    const d = f.room.director!;
    f.send(0, { type: 'command', seq: 7, round: `${d.state.stage}-${d.state.round}`, command: { action: 'lock' } });
    f.tick(f.room.battleStarted + 500);
    const saved = JSON.parse(JSON.stringify(f.service.snapshot()));
    let time = saved.savedAt + 90_000;
    const restored = new RoomService(() => time); restored.restore(saved);
    const room = restored.rooms.get(f.room.code)!;
    const p = peer(); restored.receive(p, { type: 'resume', code: room.code, token: f.room.seats[0].token });
    expect(p.messages.find((m) => m.type === 'welcome')).toMatchObject({ lastSeq: 7 });
    const frames = p.messages.find((m) => m.type === 'frames')!;
    expect(frames.reset).toBe(true);
    expect(frames.frames.length).toBeGreaterThan(0);
    expect(frames.frames.every((frame) => frame.t <= 0.5)).toBe(true);
    time = room.deadline + 1; restored.tick(); f.tick();
    expect(room.director!.state).toEqual(d.state);
    const settled = structuredClone(room.director!.state);
    room.director!.settleRound(); expect(room.director!.state).toEqual(settled);
    time = room.deadline + 1; restored.tick(); f.tick();
    expect(room.director!.state).toEqual(d.state);
  });

  it('restores settled rounds without a second payout and rejects incompatible snapshots atomically', () => {
    const f = fixture(); f.start(); f.prep(); f.tick(); f.tick();
    const saved = f.service.snapshot();
    const restored = new RoomService(); restored.restore(saved);
    const d = restored.rooms.get(f.room.code)!.director!;
    const before = structuredClone(d.state); d.settleRound(); expect(d.state).toEqual(before);
    const empty = new RoomService();
    expect(() => empty.restore({ ...saved, rosterHash: 'different' })).toThrow();
    expect(empty.rooms.size).toBe(0);
    const broken = structuredClone(saved); broken.rooms[0].match!.phase = 'BATTLE';
    expect(() => empty.restore(broken)).toThrow(); expect(empty.rooms.size).toBe(0);
  });
});

it('synchronizes carousel targets, preserves progress across restart, and awards XP sound only once', () => {
  const f = fixture(); f.start();
  const d = f.room.director!, a = d.state.draft!.carousel!.avatars.find(a => a.playerId === 'p1')!;
  const home = { x: a.x, y: a.y };
  f.send(0, { type: 'command', seq: 1, round: '1-1', command: { action: 'carouselMove', target: { x: 550, y: 325 }, option: 0 } });
  expect({ x: a.x, y: a.y }).toEqual(home); expect(a.targetOption).toBe(0);
  f.send(0, { type: 'command', seq: 2, round: '1-1', command: { action: 'draft', index: 0 } });
  expect(f.peers[0].messages.at(-1)?.type).toBe('error');
  f.tick(4200);
  for (const peer of f.peers) {
    const view = peer.messages.filter(m => m.type === 'state').at(-1)!;
    expect(view.match.draft!.carousel).toEqual(d.state.draft!.carousel);
  }
  const snapshot = f.service.snapshot();
  let time = 100000;
  const restored = new RoomService(() => time); restored.restore(snapshot);
  const restoredRoom = [...restored.rooms.values()][0];
  expect(restoredRoom.director!.state.draft).toEqual(d.state.draft);
  time += 100; restored.tick(); f.tick(4300);
  expect(restoredRoom.director!.state.draft).toEqual(d.state.draft);
  f.prep();
  const p = d.state.players[0]; p.gold = 20;
  const xp = { type: 'command', seq: 3, round: '1-1', command: { action: 'xp' } } as const;
  f.send(0, xp); f.send(0, xp);
  expect(p.gold).toBe(16);
  expect(f.peers[0].messages.filter(m => m.type === 'ack' && m.sound === 'level-up')).toHaveLength(1);
  p.gold = 0; f.send(0, { ...xp, seq: 4 });
  expect(f.peers[0].messages.filter(m => m.type === 'ack' && m.sound === 'level-up')).toHaveLength(1);
});
