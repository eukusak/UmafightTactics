import { SEASONS, getSeason } from '../../game/engine/roster';
import type { SeasonId } from '../../game/engine/seasons/catalog';
import { useEffect, useState } from 'react';
import { useOnlineStore } from '../../store/onlineStore';
import { useGameStore } from '../../store/gameStore';
import { seasonBackdrop } from '../../game/ui/season-art';

export function OnlineScreen(): JSX.Element {
  const online = useOnlineStore();
  const [name, setName] = useState('트레이너');
  const [code, setCode] = useState('');
  const [seasonId, setSeasonId] = useState<SeasonId>('s1');
  const [fillAi, setFillAi] = useState(true);
  const self = online.room?.seats.find((s) => s.id === online.session?.playerId);
  const host = online.room?.hostId === self?.id;
  return <div className="menu-screen online-screen season-screen" style={seasonBackdrop(online.room?.seasonId ?? seasonId)}>
    <div className="online-heading"><span>TWINKLE ARENA · MULTIPLAYER</span><h1>함께 아레나로</h1><p>방 코드를 공유하고, 최대 8명이 같은 아레나에서 경쟁하세요.</p></div>
    {!online.room ? <div className="online-connect panel">
      <label>트레이너 이름<input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} /></label>
      <label>새 방 시즌<select value={seasonId} onChange={e => setSeasonId(e.target.value as SeasonId)}>{SEASONS.map(s => <option key={s.id} value={s.id}>{s.id.toUpperCase()} · {s.name} · 60명</option>)}</select></label>
      <p className="muted">참가자는 방장이 선택한 시즌으로 함께 플레이합니다.</p>
      <button className="btn-primary" disabled={online.connecting || !name.trim()} onClick={() => online.connect({ type: 'create', name: name.trim(), seasonId })}>새 방 만들기</button>
      <div className="online-divider">또는 방 코드로 참가</div>
      <label>방 코드<input value={code} maxLength={6} placeholder="ABC234" onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ''))} /></label>
      <button disabled={online.connecting || code.length !== 6 || !name.trim()} onClick={() => online.connect({ type: 'join', code, name: name.trim() })}>방 참가</button>
      <button className="btn-ghost" onClick={online.resume}>이전 방에 재접속</button>
    </div> : <div className="online-lobby panel">
      <div className="room-code"><span>초대 코드</span><strong>{online.room.code}</strong><b>{online.room.seats.length}/8</b></div>
      <p className="gold-text">{online.room.seasonId.toUpperCase()} · {getSeason(online.room.seasonId).name} · 출전 60명</p>
      <div className="online-seats">{Array.from({ length: 8 }, (_, i) => {
        const seat = online.room!.seats[i];
        return <div key={seat?.id ?? i} className={`online-seat ${seat ? 'occupied' : ''} ${seat?.ready ? 'ready' : ''}`}>
          <span className="seat-emblem">{seat ? seat.name.slice(0, 1) : '+'}</span><strong>{seat?.name ?? '참가 대기'}</strong>
          <small>{seat ? seat.ai ? 'AI · 준비 완료' : !seat.connected ? '재접속 대기' : seat.ready ? '준비 완료' : '준비 중' : '친구를 초대하세요'}</small>
          {host && seat?.ai && !online.room!.started && <button className="btn-ghost" aria-label={`${seat.name} 제거`} onClick={() => online.send({ type: 'removeAi', id: seat.id })}>AI 제거</button>}
          {seat?.id === online.room!.hostId && <b className="host-badge">방장</b>}
        </div>;
      })}</div>
      <div className="online-actions">
        <button className={self?.ready ? 'btn-ghost' : 'btn-primary'} disabled={!online.connected || online.room.started} onClick={() => online.send({ type: 'ready', ready: !self?.ready })}>{self?.ready ? '준비 취소' : '준비 완료'}</button>
        {host && <><button disabled={!online.connected || online.room.started || online.room.seats.length >= 8} onClick={() => online.send({ type: 'addAi' })}>AI 추가</button><label><input type="checkbox" checked={fillAi} onChange={(e) => setFillAi(e.target.checked)} />빈자리는 AI로 채우기</label><button className="btn-primary" disabled={!online.connected || online.room.started || online.room.seats.some((s) => !s.ai && (!s.ready || !s.connected)) || (!fillAi && online.room.seats.length !== 8)} onClick={() => online.send({ type: 'start', fillAi })}>대전 시작</button></>}
        <button className="btn-ghost" onClick={online.leave}>방 나가기</button>
      </div>
    </div>}
    {online.error && <p className="online-error" role="alert">{online.error}</p>}
    {!online.room && <button className="btn-ghost" style={{ marginTop: 18 }} onClick={() => { online.leave(); useGameStore.getState().setScreen('MAIN_MENU'); }}>돌아가기</button>}
  </div>;
}

export function OnlineClock(): JSX.Element {
  const deadline = useGameStore((s) => s.onlineDeadline);
  const offset = useGameStore((s) => s.onlineClockOffset);
  const connected = useGameStore((s) => s.networkConnected);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 100); return () => clearInterval(timer); }, []);
  const remaining = Math.max(0, Math.ceil((deadline - now - offset) / 1000));
  return <div className={`prep-clock${remaining <= 5 ? ' urgent' : ''}`}><span>{connected ? '다음 단계까지' : '재접속 중'}</span><strong>{remaining}s</strong></div>;
}
