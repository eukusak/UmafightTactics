import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore';

/** Selection overlays pause preparation; purchases and placements do not reset it. */
export function PrepCountdown({ active, seconds }: { active: boolean; seconds: number }): JSX.Element {
  const remaining = useRef(seconds);
  const [display, setDisplay] = useState(seconds);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (!active || paused) return;
    let last = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      remaining.current = Math.max(0, remaining.current - (now - last) / 1000);
      last = now;
      setDisplay(Math.ceil(remaining.current));
      if (remaining.current <= 0) {
        window.clearInterval(timer);
        useGameStore.getState().startBattle();
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [active, paused]);
  return <div className={`prep-clock${display <= 5 ? ' urgent' : ''}`}>
    <span>{active ? '전투까지' : '선택 대기'}</span><strong>{display}s</strong>
    <button className="btn-ghost" onClick={() => setPaused((p) => !p)} aria-label={paused ? '준비 타이머 재개' : '준비 타이머 일시정지'}>{paused ? '▶' : 'Ⅱ'}</button>
  </div>;
}
