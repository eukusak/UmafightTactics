import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';

/** Selection overlays pause preparation; purchases and placements do not reset it. */
export function PrepCountdown({ active, seconds }: { active: boolean; seconds: number }): JSX.Element {
  const remaining = useGameStore((s) => s.prepRemaining);
  const paused = useGameStore((s) => s.prepPaused);
  const setClock = useGameStore((s) => s.setPrepClock);
  const display = Math.ceil(remaining ?? seconds);
  useEffect(() => {
    if (!active || paused) return;
    let last = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const remaining = Math.max(0, (useGameStore.getState().prepRemaining ?? seconds) - (now - last) / 1000);
      setClock(remaining);
      last = now;
      if (remaining <= 0) {
        window.clearInterval(timer);
        useGameStore.getState().startBattle();
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [active, paused, seconds, setClock]);
  return <div className={`prep-clock${display <= 5 ? ' urgent' : ''}`}>
    <span>{active ? '전투까지' : '선택 대기'}</span><strong>{display}s</strong>
    <button className="btn-ghost" onClick={() => setClock(remaining ?? seconds, !paused)} aria-label={paused ? '준비 타이머 재개' : '준비 타이머 일시정지'}>{paused ? '▶' : 'Ⅱ'}</button>
  </div>;
}
