/**
 * Race progress bar shown above the board during combat.
 *
 * The marker tracks race progress, not the clock, which is why it can run ahead
 * of the timer: when half the field is down the race is already at 승부처 even if
 * only twelve seconds have passed. That is the whole point of the system and it
 * has to be visible, so the bar shows the progress and the clock side by side.
 */
import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { useGameStore } from '../../store/gameStore';
import { frameAt } from '../../game/ui/battle-playback';
import { RACE_PHASE_AT, RACE_PHASE_LABEL, type RaceCombatPhase } from '../../game/engine/race-plan/types';
import { getRaceCombatPhase } from '../../game/engine/race-plan/race-phases';
import { findRacePlanNode } from '../../game/engine/race-plan/defs';
import { getUnitDef } from '../../game/engine/roster';

type BarPhase = Exclude<RaceCombatPhase, 'OVERTIME'>;
const ORDER: BarPhase[] = ['START', 'POSITIONING', 'LATE', 'LAST_3F'];

export function RaceProgressHud(): JSX.Element | null {
  const frames = useGameStore((s) => s.viewedBattleFrames());
  const time = useGameStore((s) => s.battleTime);
  const running = useGameStore((s) => s.battleRunning);
  const [flash, setFlash] = useState<RaceCombatPhase | null>(null);
  const lastPhase = useRef<RaceCombatPhase>('START');

  // Progress is read from the RACE_PHASE events the simulation already emits,
  // so the bar can never disagree with what the battle actually did.
  let progress = 0;
  let phase: RaceCombatPhase = 'START';
  if (frames?.length) {
    const upTo = frames.slice(0, frameAt(frames, time) + 1);
    for (const frame of upTo) {
      for (const event of frame.events) {
        if (event.type === 'RACE_PHASE') { progress = event.progress; phase = event.phase; }
      }
    }
    const clockPhase = getRaceCombatPhase(time, progress);
    if (ORDER.indexOf(clockPhase as BarPhase) > ORDER.indexOf(phase as BarPhase)) phase = clockPhase;
    progress = Math.max(progress, Math.min(1, time / 30));
  }

  useEffect(() => {
    if (phase === lastPhase.current) return;
    lastPhase.current = phase;
    if (phase === 'LATE' || phase === 'LAST_3F') {
      setFlash(phase);
      const timer = setTimeout(() => setFlash(null), 450);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [phase]);

  if (!running || !frames?.length) return null;
  const clamped = Math.min(1, Math.max(0, progress));

  return (
    <div className="race-hud" aria-label={`레이스 진행 ${RACE_PHASE_LABEL[phase]}`}>
      <div className="race-hud-track">
        <div className="race-hud-fill" style={{ width: `${clamped * 100}%` }} />
        {ORDER.slice(1).map((p) => (
          <div key={p} className="race-hud-tick" style={{ left: `${RACE_PHASE_AT[p] * 100}%` }} />
        ))}
        <div className="race-hud-marker" style={{ left: `${clamped * 100}%` }} />
      </div>
      <div className="race-hud-labels">
        {ORDER.map((p) => (
          <span key={p} className={p === phase ? 'active' : ''}>{RACE_PHASE_LABEL[p]}</span>
        ))}
        <span className={phase === 'OVERTIME' ? 'active' : ''}>GOAL</span>
      </div>
      {flash && <div className="race-hud-flash">{RACE_PHASE_LABEL[flash]}</div>}
    </div>
  );
}

/** One-line scouting summary: plan, branch, entry and finishing move. */
export function RacePlanScoutSummary({ playerId }: { playerId: string }): JSX.Element | null {
  const match = useGameStore((s) => s.match);
  const rp = match?.players.find((p) => p.id === playerId)?.racePlan;
  if (!rp?.planId) return null;
  const plan = findRacePlanNode(rp.planId);
  if (!plan) return null;
  const evolution = rp.evolutionId ? findRacePlanNode(rp.evolutionId) : undefined;
  const move = rp.finishingMoveId ? findRacePlanNode(rp.finishingMoveId) : undefined;
  const entry = rp.entryUnitDefId ? getUnitDef(rp.entryUnitDefId) : undefined;
  return (
    <div className="race-scout">
      <b>{plan.nameKo}</b>
      {evolution && <span>→ <b>{evolution.nameKo}</b></span>}
      {entry && <span>· 출주마 <b>{entry.nameKo}</b></span>}
      {move && <span>· <b>{move.nameKo}</b></span>}
    </div>
  );
}
