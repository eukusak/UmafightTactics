import { randomBytes } from 'node:crypto';
import { createMatch, RoundDirector } from '../src/game/engine/rounds/director';
import { isAlive, type MatchState } from '../src/game/engine/state';
import { currentPickers } from '../src/game/engine/rounds/draft';
import { roundInfo } from '../src/game/engine/rounds/schedule';
import { ROSTER_HASH, getSeason } from '../src/game/engine/roster';
import { isSeasonId } from '../src/game/engine/seasons/catalog';
import type { PendingSettlement } from '../src/game/engine/rounds/director';
import type { BattleFrame } from '../src/game/engine/battle/engine';
import { applyOnlineCommand, autoField } from '../src/game/network/commands';
import type { ClientMessage, RoomView, ServerMessage } from '../src/game/network/protocol';

export type Peer = { send: (message: ServerMessage) => void; close: () => void };
type Seat = { id: string; name: string; token: string; ready: boolean; peer: Peer | null; disconnectedAt: number; lastSeq: number; sentFrames: number };
export type Room = { seasonId: import('../src/game/engine/seasons/catalog').SeasonId; code: string; hostId: string; seats: Seat[]; director: RoundDirector | null; deadline: number; changedAt: number; phaseKey: string; battleStarted: number; battleDuration: number; battleId: string | null; settled: boolean; draftUpdatedAt?: number; draftBroadcastAt?: number };
type SavedRoom = Omit<Room, 'director' | 'seats'> & {
  seats: Omit<Seat, 'peer'>[];
  match: MatchState | null;
  pending: PendingSettlement | null;
  frames: [string, BattleFrame[]][];
};
export type RoomSnapshot = { version: 1; rosterHash: string; savedAt: number; rooms: SavedRoom[] };

/** Only public scouting data and the recipient's private economy leave the server. */
export function privateMatch(state: MatchState, playerId: string): MatchState {
  return {
    ...state, seed: 0, rngStates: {}, pool: { seasonId: state.seasonId, remaining: {} },
    players: state.players.map((p) => p.id === playerId ? { ...p, isHuman: true } : {
      ...p, isHuman: false, shop: [], bench: [], items: [], pendingGrants: [], freeRerolls: 0, cheapRerollsUsed: 0, aiProfile: null, aiPlan: undefined,
    }),
    augmentOffers: state.augmentOffers.filter((o) => o.playerId === playerId),
  };
}

export class RoomService {
  readonly rooms = new Map<string, Room>();
  private memberships = new Map<Peer, { room: Room; seat: Seat }>();
  constructor(private now: () => number = Date.now, private maxRooms = 16) {}

  /** Private server checkpoint, including tokens and future frames. Never serve it over HTTP. */
  snapshot(): RoomSnapshot {
    return structuredClone({ version: 1, rosterHash: ROSTER_HASH, savedAt: this.now(), rooms: [...this.rooms.values()].map((room) => {
      const { director, seats, ...rest } = room;
      director?.syncRng();
      return { ...rest, seats: seats.map(({ peer: _peer, ...seat }) => seat),
        match: director?.state ?? null, pending: director?.exportPendingSettlement() ?? null,
        frames: director ? [...director.playerFrames] : [] };
    }) });
  }

  restore(snapshot: RoomSnapshot): void {
    if (this.rooms.size || this.memberships.size) throw new Error('Restore requires an empty room service');
    if (snapshot.version !== 1 || snapshot.rosterHash !== ROSTER_HASH || !Number.isFinite(snapshot.savedAt)
      || !Array.isArray(snapshot.rooms) || snapshot.rooms.length > this.maxRooms) throw new Error('Incompatible room checkpoint');
    const saved = structuredClone(snapshot);
    const restored = new Map<string, Room>();
    const now = this.now();
    // Pause downtime: players return to the same remaining selection/battle time.
    const shift = now - saved.savedAt;
    for (const entry of saved.rooms) {
      const { match, pending, frames, seats, ...rest } = entry;
      if (!/^[A-Z2-9]{6}$/.test(rest.code) || restored.has(rest.code) || !seats.length || seats.length > 8
        || !Number.isFinite(rest.deadline) || !Number.isFinite(rest.battleStarted)) throw new Error('Invalid saved room');
      if (!isSeasonId(rest.seasonId)) throw new Error('Invalid saved season');
      if (match && match.seasonId !== rest.seasonId) throw new Error('Saved room season mismatch');
      const director = match ? new RoundDirector(match, true) : null;
      director?.restorePendingSettlement(pending);
      for (const [id, record] of frames) director?.playerFrames.set(id, record);
      restored.set(rest.code, { ...rest, director, deadline: rest.deadline ? rest.deadline + shift : 0,
        draftUpdatedAt: now, draftBroadcastAt: 0,
        battleStarted: rest.battleId ? rest.battleStarted + shift : 0, changedAt: now,
        seats: seats.map((seat) => ({ ...seat, peer: null, disconnectedAt: now, sentFrames: 0 })) });
    }
    for (const [code, room] of restored) this.rooms.set(code, room);
  }

  receive(peer: Peer, message: ClientMessage): void {
    try { this.handle(peer, message); } catch (e) {
      peer.send({ type: 'error', message: e instanceof Error ? e.message : '요청을 처리하지 못했습니다.' });
    }
  }

  private handle(peer: Peer, message: ClientMessage): void {
    const member = this.memberships.get(peer);
    if (message.type === 'create' || message.type === 'join' || message.type === 'resume') {
      if (member) throw new Error('이미 방에 참가했습니다. 먼저 나가기를 누르세요.');
      let room: Room;
      if (message.type === 'create') {
        if (this.rooms.size >= this.maxRooms) throw new Error('서버의 방이 가득 찼습니다. 잠시 뒤 다시 시도하세요.');
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code: string;
        do { code = [...randomBytes(6)].map((v) => chars[v % chars.length]).join(''); } while (this.rooms.has(code));
        room = { seasonId: getSeason(message.seasonId).id, code, hostId: 'p1', seats: [], director: null, deadline: 0, changedAt: this.now(), phaseKey: '', battleStarted: 0, battleDuration: 0, battleId: null, settled: false };
        this.rooms.set(code, room);
      } else {
        const found = this.rooms.get(message.code);
        if (!found) throw new Error('방이 없거나 만료되었습니다.');
        room = found;
      }
      let seat: Seat;
      if (message.type === 'resume') {
        const found = room.seats.find((s) => s.token === message.token);
        if (!found) throw new Error('재접속 정보가 올바르지 않습니다.');
        seat = found;
        if (seat.peer) { this.memberships.delete(seat.peer); seat.peer.close(); }
        seat.peer = peer; seat.disconnectedAt = 0;
      } else {
        if (room.director) throw new Error('이미 시작된 방입니다.');
        if (room.seats.length >= 8) throw new Error('최대 8명까지 참가할 수 있습니다.');
        const id = Array.from({ length: 8 }, (_, i) => `p${i + 1}`).find((id) => !room.seats.some((s) => s.id === id))!;
        seat = { id, name: message.name, token: randomBytes(24).toString('hex'), ready: false, peer, disconnectedAt: 0, lastSeq: 0, sentFrames: 0 };
        room.seats.push(seat);
      }
      room.changedAt = this.now(); this.memberships.set(peer, { room, seat });
      peer.send({ type: 'welcome', code: room.code, token: seat.token, playerId: seat.id, lastSeq: seat.lastSeq });
      this.broadcastRoom(room);
      if (room.director) { this.sendState(room, seat); this.sendFrames(room, seat, true); }
      return;
    }
    if (!member) throw new Error('먼저 방에 참가하세요.');
    const { room, seat } = member;
    room.changedAt = this.now();
    if (message.type === 'leave') { this.disconnect(peer, true); return; }
    if (message.type === 'ready') {
      if (room.director) throw new Error('이미 게임이 시작되었습니다.');
      seat.ready = message.ready; this.broadcastRoom(room); return;
    }
    if (message.type === 'start') {
      if (seat.id !== room.hostId) throw new Error('방장만 시작할 수 있습니다.');
      if (room.director) throw new Error('이미 게임이 시작되었습니다.');
      if (room.seats.length < 2 || (!message.fillAi && room.seats.length !== 8)) throw new Error(message.fillAi ? '사람 2명 이상이 필요합니다.' : '8명이 모여야 시작할 수 있습니다.');
      if (room.seats.some((s) => !s.peer || !s.ready)) throw new Error('모두 연결된 상태에서 준비를 눌러 주세요.');
      const state = createMatch({ seed: randomBytes(4).readUInt32LE(), allAi: true, seasonId: room.seasonId });
      for (const p of state.players) {
        const human = room.seats.find((s) => s.id === p.id);
        if (human) { p.isHuman = true; p.aiProfile = null; p.name = human.name; }
      }
      room.director = new RoundDirector(state, true); room.director.beginPrep();
      this.setDeadline(room); this.broadcastRoom(room); this.broadcastState(room); return;
    }
    if (message.type === 'command') {
      if (message.seq <= seat.lastSeq) { peer.send({ type: 'ack', seq: message.seq }); return; }
      seat.lastSeq = message.seq;
      const director = room.director;
      if (!director) throw new Error('게임이 시작되지 않았습니다.');
      if (message.round !== `${director.state.stage}-${director.state.round}`) throw new Error('라운드가 변경되었습니다. 다시 조작하세요.');
      const error = applyOnlineCommand(director, seat.id, message.command);
      if (error) throw new Error(error);
      if (director.state.phase !== 'BATTLE') this.setDeadline(room);
      peer.send({ type: 'ack', seq: message.seq, ...(message.command.action === 'xp' ? { sound: 'level-up' as const } : {}) });
      if (message.command.action !== 'carouselMove') this.broadcastState(room);
    }
  }

  disconnect(peer: Peer, leave = false): void {
    const member = this.memberships.get(peer); if (!member) return;
    this.memberships.delete(peer);
    const { room, seat } = member;
    if (seat.peer !== peer) return;
    seat.peer = null; seat.disconnectedAt = this.now(); room.changedAt = this.now();
    if (leave && !room.director) room.seats = room.seats.filter((s) => s !== seat);
    if (!room.director && room.hostId === seat.id) room.hostId = room.seats.find((s) => s.peer)?.id ?? room.seats[0]?.id ?? '';
    if (!room.seats.length) this.rooms.delete(room.code); else this.broadcastRoom(room);
    if (leave) peer.close();
  }

  private setDeadline(room: Room): void {
    const d = room.director!;
    const cursor = d.state.draft?.carousel ? 'carousel' : d.state.draft?.cursor ?? '-';
    const key = `${d.state.stage}-${d.state.round}:${d.state.phase}:${cursor}`;
    if (room.phaseKey === key) return;
    room.phaseKey = key;
    if (d.state.draft?.carousel) room.draftUpdatedAt = this.now();
    const seconds = d.state.draft?.carousel ? 45 : d.state.draft ? 12 : d.state.augmentOffers.length ? 30 : roundInfo(d.state.stage, d.state.round).prepSeconds;
    room.deadline = this.now() + seconds * 1000;
  }

  /** One wall clock owns every seat. No client's speed/skip changes the match. */
  private readonly aiScoutTimes = new Map<string, number>();
  tick(): void {
    const now = this.now();
    for (const room of this.rooms.values()) {
      if (!room.seats.some((s) => s.peer) && now - room.changedAt > 300_000) { this.rooms.delete(room.code); continue; }
      const d = room.director;
      if (!d || d.isOver) continue;
      if (d.state.phase === 'BATTLE') {
        for (const seat of room.seats) if (seat.peer) this.sendFrames(room, seat);
        if (now < room.deadline) continue;
        d.settleRound(); room.settled = true; room.deadline = now + 5000;
        this.broadcastState(room); continue;
      }
      if (d.state.draft?.carousel) {
        d.advanceCarousel(Math.max(0, now - (room.draftUpdatedAt ?? now)));
        room.draftUpdatedAt = now;
        if (!d.state.draft) this.setDeadline(room);
        if (!d.state.draft || now - (room.draftBroadcastAt ?? 0) >= 100) {
          this.broadcastState(room); room.draftBroadcastAt = now;
        }
        continue;
      }
      if (d.state.phase === 'ROUND_PREP' && now - (this.aiScoutTimes.get(room.code) ?? 0) >= 3000) {
        d.refreshAiPlacements(); this.aiScoutTimes.set(room.code, now); this.broadcastState(room);
      }
      if (now < room.deadline) continue;
      if (d.state.phase === 'ROUND_RESOLVE') {
        d.advance(); room.battleId = null; room.settled = false;
        this.setDeadline(room); this.broadcastState(room); continue;
      }
      if (d.state.augmentOffers.length) {
        for (const offer of [...d.state.augmentOffers]) if (offer.chosen === null) d.chooseAugment(offer.playerId, offer.options[0]);
        this.setDeadline(room); this.broadcastState(room); continue;
      }
      if (d.state.draft) {
        // Advance one pick window at a time, including for disconnected seats.
        for (const id of currentPickers(d.state.draft)) {
          const option = d.state.draft?.options.find((o) => !o.takenBy);
          if (option) d.pickDraft(id, option.index);
        }
        this.setDeadline(room); this.broadcastState(room); continue;
      }
      for (const p of d.state.players.filter(isAlive)) autoField(d, p.id);
      const resolution = d.resolveRound(true);
      room.battleStarted = this.now(); room.battleDuration = Math.max(0, ...resolution.outcomes.map((o) => o.durationSeconds));
      room.battleId = `${d.state.stage}-${d.state.round}`; room.settled = false;
      room.deadline = room.battleStarted + (room.battleDuration + 1) * 1000;
      for (const s of room.seats) s.sentFrames = 0;
      this.broadcastState(room);
      for (const s of room.seats) if (s.peer) this.sendFrames(room, s, true);
    }
  }

  private broadcastRoom(room: Room): void {
    const view: RoomView = { seasonId: room.seasonId, code: room.code, hostId: room.hostId, started: !!room.director, seats: room.seats.map((s) => ({ id: s.id, name: s.name, ready: s.ready, connected: !!s.peer })), deadline: room.deadline, serverNow: this.now() };
    for (const s of room.seats) s.peer?.send({ type: 'room', room: view });
  }
  private broadcastState(room: Room): void { for (const s of room.seats) if (s.peer) this.sendState(room, s); }
  private sendState(room: Room, seat: Seat): void {
    if (!room.director) return;
    seat.peer?.send({ type: 'state', match: privateMatch(room.director.state, seat.id), playerId: seat.id, deadline: room.deadline, serverNow: this.now(), battleId: room.battleId, battleTime: room.battleId ? Math.min(room.battleDuration + 1, Math.max(0, (this.now() - room.battleStarted) / 1000)) : 0, settled: room.settled });
  }
  private sendFrames(room: Room, seat: Seat, reset = false): void {
    if (!room.battleId) return;
    const frames = room.director?.playerFrames.get(seat.id) ?? [];
    const time = Math.max(0, (this.now() - room.battleStarted) / 1000);
    let end = seat.sentFrames;
    while (end < frames.length && frames[end].t <= time) end++;
    if (!reset && end === seat.sentFrames) return;
    seat.peer?.send({ type: 'frames', battleId: room.battleId, frames: frames.slice(reset ? 0 : seat.sentFrames, end), time, reset });
    seat.sentFrames = end;
  }
}
