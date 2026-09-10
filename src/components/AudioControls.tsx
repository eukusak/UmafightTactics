import { useGameStore } from '../store/gameStore';
export function AudioControls({ expanded = false }: { expanded?: boolean }): JSX.Element {
  const settings = useGameStore(s => s.settings), update = useGameStore(s => s.setSettings);
  return <div className={`audio-controls${expanded ? ' expanded' : ''}`}>
    <button className="btn-ghost" aria-label="전체 음소거" aria-pressed={settings.muted} onClick={() => update({ muted: !settings.muted })}>{settings.muted ? '음소거 해제' : '음소거'}</button>
    <label>음악 <input aria-label="음악 음량" type="range" min="0" max="100" value={Math.round(settings.musicVolume * 100)} onChange={e => update({ musicVolume: Number(e.target.value) / 100 })} /></label>
    {expanded && <label>효과음 <input aria-label="효과음 음량" type="range" min="0" max="100" value={Math.round(settings.effectsVolume * 100)} onChange={e => update({ effectsVolume: Number(e.target.value) / 100 })} /></label>}
  </div>;
}
