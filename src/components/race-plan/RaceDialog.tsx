import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { assetUrl } from '../../game/ui/art';
import { useGameStore } from '../../store/gameStore';
import { RACE_PLAN_SECONDS } from '../../game/engine/constants';
import { playSound } from '../../game/ui/audio';

/** Shared artwork, focus boundary and opening cue for each race selection step. */
export function RaceDialog({ children, label, kind = 'plan', busy = false }: {
  children: ReactNode; label: string; kind?: 'plan' | 'entry' | 'finishing'; busy?: boolean;
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const online = useGameStore(s => !!s.onlinePlayerId);
  const deadline = useGameStore(s => s.onlineDeadline);
  const offset = useGameStore(s => s.onlineClockOffset);
  const timeout = useGameStore(s => s.timeoutRacePlan);
  const seconds = kind === 'entry' ? RACE_PLAN_SECONDS.ENTRY : kind === 'finishing' ? RACE_PLAN_SECONDS.FINISHING : RACE_PLAN_SECONDS.PLAN;
  const [remaining,setRemaining] = useState<number>(seconds);
  const remainingRef = useRef<number>(seconds);
  const [paused,setPaused] = useState(false);
  const due = useRef(Date.now()+seconds*1000);
  useEffect(() => { due.current=Date.now()+seconds*1000;remainingRef.current=seconds;setRemaining(seconds); },[seconds,label]);
  useEffect(() => {
    if (!online && paused) return;
    if (!online) due.current=Date.now()+remainingRef.current*1000;
    const timer=setInterval(() => {
      const left=Math.max(0,((online ? deadline-offset : due.current)-Date.now())/1000);
      remainingRef.current=left;setRemaining(left);
      if(!online && left<=0) { clearInterval(timer);timeout(); }
    },100);
    return () => clearInterval(timer);
  },[online,deadline,offset,paused,seconds,label,timeout]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    playSound('race-plan-open');
    return () => { if (previous?.isConnected) previous.focus(); };
  }, [label]);
  const background = (file: string) => {
    const url = assetUrl(file);
    return url ? `url("${url}")` : 'none';
  };
  const style = {
    '--race-paper-image': background('boards/bg_race_plan_paper.png'),
    '--race-entry-image': background('boards/bg_g1_entry_board.png'),
    '--race-paddock-image': background('boards/bg_paddock_panel.png'),
  } as CSSProperties;
  return <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={label}
    className={`race-overlay race-kind-${kind}${busy ? ' race-confirming' : ''}`} style={style}
    onKeyDown={(event) => {
      if (event.key === 'Escape') { event.stopPropagation(); return; }
      if (event.key !== 'Tab') return;
      const controls = [...(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [href], [tabindex="0"]') ?? [])];
      const first = controls[0], last = controls.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) {
        event.preventDefault(); first.focus();
      }
    }}>
    {children}
    <div className="race-selection-clock"><span>선택까지 {Math.ceil(remaining)}초</span>{!online && <button type="button" onClick={() => setPaused(p => !p)} aria-label={paused ? '작전 타이머 재개' : '작전 타이머 일시정지'}>{paused ? '▶' : 'Ⅱ'}</button>}</div>
    {busy && <div className="race-confirm-stamp" role="status">작전 확정</div>}
  </div>;
}
