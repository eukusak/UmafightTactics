import { useMemo, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { contributionTotals, frameAt, type ContributionMetric } from '../game/ui/battle-playback';
import { getUnitDef } from '../game/engine/roster';
import { Portrait } from './common';
const METRICS: { id: ContributionMetric; label: string }[] = [{ id: 'dealt', label: '가한 피해량' }, { id: 'taken', label: '받은 피해량' }, { id: 'shield', label: '보호막 생성량' }];
export function BattleRecap(): JSX.Element {
  const frames = useGameStore(s => s.battleFrames), time = useGameStore(s => s.battleTime), running = useGameStore(s => s.battleRunning);
  const humanId = useGameStore(s => s.human()?.id);
  const [index, setIndex] = useState(0), [side, setSide] = useState<'allies' | 'enemies'>('allies');
  const metric = METRICS[index];
  const totals = useMemo(() => contributionTotals(frames ?? [], time, metric.id), [frames, time, metric]);
  if (!frames?.length) return <><h3>전투 통계</h3><p>첫 전투가 시작되면 통계를 확인할 수 있습니다.</p></>;
  const frame = frames[frameAt(frames, time)];
  const team = frames[0].units.find(u => u.id.startsWith(`${humanId}#`))?.team ?? 'A';
  const rows = frame.units.filter(u => (side === 'allies' ? u.team === team : u.team !== team)).sort((a, b) => (totals.get(b.id) ?? 0) - (totals.get(a.id) ?? 0));
  const max = Math.max(1, ...rows.map(u => totals.get(u.id) ?? 0));
  return <div className="battle-recap"><h3>전투 통계 · {running ? '현재 전투' : '이전 전투'}</h3>
    <div className="recap-tabs"><button aria-label="이전 통계" onClick={() => setIndex((index + 2) % 3)}>‹</button><strong>{metric.label}</strong><button aria-label="다음 통계" onClick={() => setIndex((index + 1) % 3)}>›</button></div>
    <div className="recap-tabs"><button aria-pressed={side === 'allies'} onClick={() => setSide('allies')}>아군</button><button aria-pressed={side === 'enemies'} onClick={() => setSide('enemies')}>상대</button></div>
    <p className="muted">{metric.id === 'shield' ? '아군에게 생성한 보호막을 시전자에게 합산' : '보호막이 흡수한 피해 포함'} · {time.toFixed(1)}초</p>
    {rows.map((u, i) => { const def = getUnitDef(u.unitDefId), value = totals.get(u.id) ?? 0; return <div className="recap-row" key={u.id}>
      <Portrait id={def.id} name={def.nameKo} size={34} /><div><span>{i + 1}. {def.nameKo} {'★'.repeat(u.star)}</span><div className="damage-meter"><i style={{ width: `${value / max * 100}%` }} /></div></div><b>{Math.round(value).toLocaleString()}</b>
    </div>; })}
    <p className="muted">다음 전투가 시작될 때까지 유지됩니다.</p>
  </div>;
}
