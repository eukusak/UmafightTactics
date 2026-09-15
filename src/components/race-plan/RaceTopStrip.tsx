/**
 * The race line in the top HUD: today's GⅠ, today's ground, and the plan the
 * player is actually running.
 *
 * All three already existed in the prep-phase side panel, but that panel sits
 * under an eight-row leaderboard in a column that overflows at 1080p, so from
 * 1-1 onward a player had to scroll a side column to find out what race they
 * were preparing for. These are the three facts every decision in the round is
 * made against, so they belong on the line the round number is on.
 *
 * Everything here is a button that opens the detail the side panel already
 * renders; the strip itself stays one line.
 */
import type { JSX } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useInteractionStore } from '../../store/interactionStore';
import { getG1Theme } from '../../game/engine/race-plan/profiles';
import { conditionNotes } from '../../game/engine/race-plan/conditions';
import { findRacePlanNode } from '../../game/engine/race-plan/defs';
import { planSummary } from '../../game/engine/race-plan/presentation';
import { RACE_PLAN_ROUNDS } from '../../game/engine/constants';
import { RaceArt } from './RaceArt';
import { g1CrestKey, courseArtKey } from '../../game/ui/race-art';

/** Which choice is still ahead, so the empty state says when rather than what. */
function pendingLabel(hasPlan: boolean, hasEvolution: boolean, hasEntry: boolean): string | null {
  const at = (kind: string): string => {
    const r = RACE_PLAN_ROUNDS.find((x) => x.kind === kind);
    return r ? `${r.stage}-${r.round}` : '';
  };
  if (!hasPlan) return `${at('PLAN')}에 작전 선택`;
  if (!hasEvolution) return `${at('EVOLUTION')}에 전개 선택`;
  if (!hasEntry) return `${at('ENTRY')}에 출주마 등록`;
  return null;
}

export function RaceTopStrip(): JSX.Element | null {
  const match = useGameStore((s) => s.match);
  const human = useGameStore((s) => s.human());
  useGameStore((s) => s.revision);
  if (!match || !human) return null;

  const theme = getG1Theme(match.g1ThemeId);
  const conditions = match.raceConditions;
  const rp = human.racePlan;
  const plan = rp?.planId ? findRacePlanNode(rp.planId) : undefined;
  const evolution = rp?.evolutionId ? findRacePlanNode(rp.evolutionId) : undefined;
  const pending = pendingLabel(!!plan, !!evolution, !!rp?.entryUnitDefId);
  const course = courseArtKey(theme.racecourse);
  const surface = theme.surface === 'TURF' ? '잔디' : '더트';
  // The side panel is the detail view for all three chips, so every chip opens it.
  const openPanel = (): void => { useInteractionStore.getState().inspect(null); };

  return (
    <div className="race-top-strip">
      <button type="button" className="race-chip race-chip-g1" onClick={openPanel}
        title={`이번 로비의 목표 · ${theme.nameKo} · ${theme.courseNameKo} ${theme.distanceM}m ${surface}`}>
        <span className="race-chip-art">
          <RaceArt name={g1CrestKey(theme)} />
          {course && <RaceArt name={course} className="race-chip-course" />}
        </span>
        <span className="race-chip-text">
          <small>이번 로비의 목표</small>
          <b>{theme.nameKo}</b>
          <em>{theme.distanceM}m {surface}</em>
        </span>
      </button>

      {conditions && (
        <button type="button" className="race-chip race-chip-cond" onClick={openPanel}
          title={conditionNotes(conditions).map((c) => `${c.label} — ${c.note}`).join('\n')}>
          <span className="race-chip-text">
            <small>오늘의 마장</small>
            <span className="race-chip-conds">
              {conditionNotes(conditions).map((c) => <b key={c.label}>{c.label}</b>)}
            </span>
          </span>
        </button>
      )}

      <button type="button" className={`race-chip race-chip-plan${plan ? '' : ' empty'}`} onClick={openPanel}
        title={plan ? planSummary(plan, evolution) : '아직 작전을 고르지 않았습니다'}>
        <span className="race-chip-text">
          <small>내 작전</small>
          {plan
            ? <b>{plan.nameKo}{evolution ? ` → ${evolution.nameKo}` : ''}</b>
            : <b className="muted">{pending ?? '미정'}</b>}
          {plan && <em>{planSummary(plan, evolution)}</em>}
        </span>
      </button>
    </div>
  );
}
