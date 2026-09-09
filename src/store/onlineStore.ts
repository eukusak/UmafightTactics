import { playSound } from '../game/ui/audio';
import { create } from 'zustand';
import type { ClientMessage, RoomView, ServerMessage } from '../game/network/protocol';
import { onlineBridge } from '../game/network/bridge';
import { useGameStore } from './gameStore';

type Session = { code: string; token: string; playerId: string; lastSeq: number };
type OnlineStore = {
  room: RoomView | null; connected: boolean; connecting: boolean; error: string | null; session: Session | null;
  connect: (message: ClientMessage) => void; send: (message: ClientMessage) => void; leave: () => void; resume: () => void;
};
let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let intentionalClose = false;
let sequence = 0;
const sessionKey = 'uft-online-seat-v1';
function readSession(): Session | null { try { return JSON.parse(sessionStorage.getItem(sessionKey) ?? 'null') as Session | null; } catch { return null; } }
function storeSession(session: Session | null): void { try { if (session) sessionStorage.setItem(sessionKey, JSON.stringify(session)); else sessionStorage.removeItem(sessionKey); } catch { /* transient seat still works */ } }

export const useOnlineStore = create<OnlineStore>((set, get) => ({
  room: null, connected: false, connecting: false, error: null, session: null,
  connect: (message) => {
    intentionalClose = false;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (socket) { socket.onclose = null; socket.close(); }
    set({ connecting: true, error: null });
    const endpoint = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/multiplayer`;
    const ws = new WebSocket(endpoint); socket = ws;
    const timeout = setTimeout(() => { if (ws.readyState === WebSocket.CONNECTING) ws.close(); }, 8000);
    ws.onopen = () => { clearTimeout(timeout); set({ connected: true, connecting: false }); useGameStore.setState({ networkConnected: true }); ws.send(JSON.stringify(message)); };
    ws.onmessage = (event) => {
      let m: ServerMessage;
      try { m = JSON.parse(event.data as string) as ServerMessage; } catch { return; }
      const game = useGameStore.getState();
      if (m.type === 'welcome') {
        const session = { code: m.code, token: m.token, playerId: m.playerId, lastSeq: m.lastSeq };
        sequence = m.lastSeq; storeSession(session); set({ session, error: null });
      } else if (m.type === 'room') set({ room: m.room });
      else if (m.type === 'error') { set({ error: m.message }); useGameStore.setState({ lastError: m.message }); }
      else if (m.type === 'state') {
        const newBattle = m.battleId !== game.onlineBattleId;
        const battling = m.match.phase === 'BATTLE' || m.match.phase === 'ROUND_RESOLVE';
        const first = !game.onlinePlayerId;
        useGameStore.setState({
          director: null, match: m.match, onlinePlayerId: m.playerId, onlineBattleId: m.battleId,
          onlineDeadline: m.deadline, onlineClockOffset: m.serverNow - Date.now(), networkConnected: true, lastError: null,
          battleRunning: battling, battleComplete: m.settled, revision: game.revision + 1,
          ...(newBattle ? { battleFrames: null, battleTime: m.battleTime, selectedUnitId: null } : {}),
          screen: m.match.phase === 'GAME_OVER' ? 'RESULT' : first || game.screen === 'ONLINE' || game.screen === 'RESULT' ? 'BATTLE' : game.screen,
        });
      } else if (m.type === 'ack' && m.sound) playSound(m.sound);
      else if (m.type === 'frames' && m.battleId === game.onlineBattleId) {
        useGameStore.setState({ battleFrames: m.reset ? m.frames : [...(game.battleFrames ?? []), ...m.frames] });
      }
    };
    ws.onclose = (event) => {
      clearTimeout(timeout); if (socket !== ws) return;
      set({ connected: false, connecting: false }); useGameStore.setState({ networkConnected: false });
      if (intentionalClose) return;
      if (event.code === 1000) { storeSession(null); set({ session: null, error: '이 기기의 접속이 종료되었습니다. 방에 다시 참가해 주세요.' }); return; }
      const session = get().session ?? readSession();
      if (session) { set({ error: '연결이 끊어졌습니다. 재접속 중입니다.' }); reconnectTimer = setTimeout(() => get().connect({ type: 'resume', code: session.code, token: session.token }), 1500); }
      else set({ error: '온라인 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.' });
    };
    ws.onerror = () => set({ error: '온라인 연결에 실패했습니다.' });
  },
  send: (message) => {
    if (socket?.readyState !== WebSocket.OPEN) { set({ error: '재접속 후 조작할 수 있습니다.' }); return; }
    socket.send(JSON.stringify(message));
  },
  resume: () => { const session = get().session ?? readSession(); if (session) get().connect({ type: 'resume', code: session.code, token: session.token }); else set({ error: '재접속할 방이 없습니다.' }); },
  leave: () => {
    intentionalClose = true; if (reconnectTimer) clearTimeout(reconnectTimer);
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'leave' }));
    socket?.close(); socket = null; storeSession(null);
    set({ room: null, session: null, connected: false, connecting: false, error: null });
    useGameStore.setState({ onlinePlayerId: null, onlineBattleId: null, onlineDeadline: 0, networkConnected: false, director: null, match: null, battleRunning: false, battleComplete: false, battleFrames: null, battleTime: 0, spectating: null });
  },
}));

onlineBridge.send = (command) => {
  const state = useGameStore.getState();
  useOnlineStore.getState().send({ type: 'command', seq: ++sequence, round: `${state.match?.stage}-${state.match?.round}`, command });
};
onlineBridge.leave = () => useOnlineStore.getState().leave();
