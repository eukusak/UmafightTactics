import { useInteractionStore } from '../store/interactionStore';
import { useMemo } from 'react';
import { useGameStore } from '../store/gameStore';
import { frameAt, damageTotals } from '../game/ui/battle-playback';
import { getUnitDef } from '../game/engine/roster';
import { Portrait } from './common';

/** Reads only events already played; never exposes the precomputed outcome. */
export function BattleTelemetry(): JSX.Element | null {
  const frames = useGameStore((s) => s.battleFrames);
  const time = useGameStore((s) => s.battleTime);
  const humanId = useGameStore((s) => s.human()?.id);
  const running = useGameStore(s => s.battleRunning);
  const complete = useGameStore((s) => s.battleComplete);
  const totals = useMemo(() => damageTotals(frames ?? [], time), [frames, time]);
  if (!frames?.length) return null;
  const frame = frames[frameAt(frames, time)];
  const team = frames[0].units.find((u) => u.id.startsWith(`${humanId}#`))?.team ?? 'A';
  const allies = frame.units.filter((u) => u.team === team);
  const enemies = frame.units.filter((u) => u.team !== team);
  const rows = allies.filter((u) => !u.id.includes('~summon')).sort((a, b) => (totals.get(b.id) ?? 0) - (totals.get(a.id) ?? 0)).slice(0, 4);
  const max = Math.max(1, ...rows.map((u) => totals.get(u.id) ?? 0));
  const health = (units: typeof allies) => units.reduce((v, u) => v + Math.max(0, u.hp), 0) / Math.max(1, units.reduce((v, u) => v + u.maxHp, 0));
  return <>
    {running && <div className={`battle-clock${frame.overtime ? ' overtime' : ''}`}>
      <span>{complete ? '전투 종료' : frame.overtime ? '오버타임' : '전투 진행'}</span>
      <strong>{Math.floor(time)}<small>초</small></strong>
      <div className="battle-survivors"><span>아군 {allies.filter((u) => u.alive).length}</span><span>상대 {enemies.filter((u) => u.alive).length}</span></div>
      <div className="team-vitals"><i style={{ width: `${health(allies) * 100}%` }} /><i style={{ width: `${health(enemies) * 100}%` }} /></div>
    </div>}
    <button type="button" aria-label="전투 기여 전체 보기" className={`battle-damage-panel${running ? '' : ' previous'}`} onClick={() => useInteractionStore.getState().inspect({ kind: 'recap' })}>
      <div className="battle-damage-heading"><strong>전투 기여</strong><span>{running ? '전체 보기 ›' : '이전 전투 · 전체 보기 ›'}</span></div>
      <div className="battle-damage-rows">{rows.map((u) => {
        const def = getUnitDef(u.unitDefId); const damage = totals.get(u.id) ?? 0;
        return <div className={`battle-damage-row${u.alive ? '' : ' fallen'}`} key={u.id}>
          <Portrait id={def.id} name={def.nameKo} size={32} />
          <div><span>{def.nameKo}</span><div className="damage-meter"><i style={{ width: `${damage / max * 100}%` }} /></div></div>
          <b>{Math.round(damage).toLocaleString()}</b>
        </div>;
      })}</div>
    </button>
  </>;
}
