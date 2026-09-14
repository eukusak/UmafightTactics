/**
 * Race progress bar shown above the board during combat.
 *
 * The marker tracks race progress, not the clock, which is why it can run ahead
 * of the timer: when half the field is down the race is already at the 4코너 even if
 * only twelve seconds have passed. That is the whole point of the system and it
 * has to be visible, so the bar shows the progress and the clock side by side.
 */
import { useEffect } from 'react';
import { RaceArt, RaceSprite } from './RaceArt';
import { raceArtUrl } from '../../game/ui/race-art';
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


  const current = frames?.[frameAt(frames, time)];
  let progress = current?.race?.progress ?? 0;
  let phase: RaceCombatPhase = current?.race?.phase ?? 'START';
  // Old saves have no race snapshot. Scan backwards only until the last event.
  if (current && !current.race) {
    outer: for (let i = frameAt(frames!, time); i >= 0; i--) {
      for (const event of [...frames![i].events].reverse()) {
        if (event.type === 'RACE_PHASE') { progress = event.progress; phase = event.phase; break outer; }
      }
    }
    progress = Math.max(progress, Math.min(1, time / 30));
    phase = getRaceCombatPhase(time, progress);
  }

  let phaseAt = 0;
  if (frames) {
    outer: for (let i = frameAt(frames, time); i >= 0; i--) {
      for (const event of frames[i].events) if (event.type === 'RACE_PHASE' && event.phase === phase) {
        phaseAt = event.t; break outer;
      }
    }
  }
  const bannerAge = time - phaseAt;
  const bannerKey = 'phase_banner_' + (phase === 'LAST_3F' ? 'last3f' : phase.toLowerCase());

  useEffect(() => {
    if (!running) return;
    const phases = ['start', 'positioning', 'late', 'last3f', 'overtime'];
    const index = phases.indexOf(bannerKey.replace('phase_banner_', ''));
    for (const name of phases.slice(Math.max(0,index), index+2)) {
      const url = raceArtUrl('phase_banner_' + name);
      if (url) { const image = new Image(); image.src = url; image.decode().catch(() => {}); }
    }
  }, [running, bannerKey]);

  if (!running || !frames?.length) return null;
  const clamped = Math.min(1, Math.max(0, progress));

  return (
    <div className="race-hud" aria-label={`레이스 진행 ${RACE_PHASE_LABEL[phase]}`}>
      <div className="race-hud-track" style={{ backgroundImage: `url("${raceArtUrl('hud_track_bar') ?? ''}")` }}>
        <RaceArt name="hud_gate" className="race-hud-gate" /><RaceArt name="hud_finish" className="race-hud-finish" />
        <div className="race-hud-fill" style={{ width: '100%', clipPath: `inset(0 ${(1-clamped)*100}% 0 0)`, backgroundImage: `url("${raceArtUrl('hud_track_fill') ?? ''}")` }} />
        {ORDER.slice(1).map((p) => (
          <div key={p} className="race-hud-tick" style={{ left: `${RACE_PHASE_AT[p] * 100}%` }} />
        ))}
        <div className="race-hud-marker" style={{ left: `${clamped * 100}%` }}><RaceArt name="hud_marker_self" /><RaceArt name="hud_marker_enemy" /></div>
      </div>
      <div className="race-hud-labels">
        {ORDER.map((p) => (
          <span key={p} className={p === phase ? 'active' : ''}>{RACE_PHASE_LABEL[p]}</span>
        ))}
        <span className={phase === 'OVERTIME' ? 'active' : ''}>GOAL</span>
      </div>
      <span className="race-clock">{time.toFixed(1)}초 · {Math.round(clamped * 100)}%</span>
      {bannerAge >= 0 && bannerAge < .6 && <div className="race-hud-banner"><RaceSprite name={bannerKey} seconds={bannerAge} /></div>}
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
