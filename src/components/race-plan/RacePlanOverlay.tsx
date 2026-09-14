/**
 * 출주 계획 (2-5) and 전개 수정 (3-5).
 *
 * Three cards, one free reroll each — the same shape as the augment screen so
 * nothing new has to be learned — but presented as a race programme: what the
 * plan does, in exact numbers, and why it was offered to *this* board.
 */
import { RaceArt, RaceConditionsStrip, G1Crest } from './RaceArt';
import { cardFrameKey } from '../../game/ui/race-art';
import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { useGameStore } from '../../store/gameStore';
import { playSound } from '../../game/ui/audio';
import { findRacePlanNode } from '../../game/engine/race-plan/defs';
import {
  CATEGORY_COLOR, CATEGORY_LABEL, FINISHING_COLOR, FINISHING_LABEL,
  describeEffects, reasonText,
} from '../../game/engine/race-plan/presentation';
import { getG1Theme } from '../../game/engine/race-plan/profiles';
import { describeConditions } from '../../game/engine/race-plan/conditions';
import { g1Identity } from '../../game/engine/race-plan/g1-identity';
import { RACE_PHASE_LABEL } from '../../game/engine/race-plan/types';
import type { RacePlanNode } from '../../game/engine/race-plan/types';
import { CATEGORY_ICON } from './RaceIcons';
import { RaceDialog } from './RaceDialog';

const markClass = (mark: string): string =>
  mark === '◎' ? 'mark-best' : mark === '△' ? 'mark-warn' : 'mark-good';

function bandStyle(node: RacePlanNode): { label: string; color: string } {
  if (node.finishingCategory) {
    return { label: FINISHING_LABEL[node.finishingCategory], color: FINISHING_COLOR[node.finishingCategory] };
  }
  if (node.category) return { label: CATEGORY_LABEL[node.category], color: CATEGORY_COLOR[node.category] };
  return { label: '전개 수정', color: '#3d6679' };
}

export function RacePlanCard({
  node, slot, reasons, rerolled, onTake, onReroll, busy,
}: {
  node: RacePlanNode;
  slot: string;
  reasons: Array<{ mark: string; text: string }>;
  rerolled: boolean;
  onTake: () => void;
  onReroll: () => void;
  busy: boolean;
}): JSX.Element {
  const band = bandStyle(node);
  const Icon = node.category ? CATEGORY_ICON[node.category] : undefined;
  const phases = node.fit.phases.map((p) => RACE_PHASE_LABEL[p]).join(' · ');
  return (
    <div className="race-card" onPointerEnter={() => playSound('race-plan-hover')} onFocus={() => playSound('race-plan-hover')}>
      {cardFrameKey(node) && <RaceArt name={cardFrameKey(node)!} className="race-card-decoration" />}
      <div className="race-band" style={{ color: band.color }}>
        {Icon ? <Icon size={18} /> : null}
        <span>{band.label}</span>
        <span style={{ marginLeft: 'auto', color: 'var(--race-green-700)' }}>작전 {slot}</span>
      </div>
      <div className="race-body">
        <h3>{node.nameKo}</h3>
        <p className="race-flavor">{node.descriptionKo}</p>
        <ul className="race-effects">
          {describeEffects(node).map((line, i) => <li key={i}>{line}</li>)}
        </ul>
        <div className="race-tags">
          <span>{phases}</span>
          {node.guard.appliesTo !== 'ANY' && <span>{node.guard.appliesTo === 'MELEE' ? '근접 전용' : '원거리 전용'}</span>}
        </div>
        <ul className="race-reasons">
          {reasons.map((r, i) => (
            <li key={i}><i className={markClass(r.mark)}>{r.mark}</i>{r.text}</li>
          ))}
        </ul>
      </div>
      <div className="race-card-actions">
        <button type="button" className="race-take" disabled={busy} onClick={onTake}>이 작전으로 출주</button>
        <button
          type="button" className="race-reroll" disabled={busy || rerolled} onClick={onReroll}
          aria-label={`${slot} 작전 새로고침`}
        >
          {rerolled ? '새로고침 완료' : '⟳ 새로고침 · 1회'}
        </button>
      </div>
    </div>
  );
}

export function RacePlanOverlay(): JSX.Element | null {
  const match = useGameStore((s) => s.match);
  const human = useGameStore((s) => s.human());
  const choose = useGameStore((s) => s.chooseRacePlan);
  const reroll = useGameStore((s) => s.rerollRacePlan);
  useGameStore((s) => s.revision);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const commitTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => { clearTimeout(timer.current); clearTimeout(commitTimer.current); }, []);

  const offer = human?.racePlan?.currentOffer;
  if (!match || !human || !offer || offer.chosen !== null) return null;
  if (offer.phase !== 'PLAN' && offer.phase !== 'EVOLUTION') return null;

  const take = (id: string): void => {
    if (busy) return;
    setBusy(true);
    playSound('race-plan-select');
    timer.current = setTimeout(() => playSound('race-plan-stamp'), 180);
    commitTimer.current = setTimeout(() => { choose(id); setBusy(false); }, 320);
  };

  const theme = getG1Theme(match.g1ThemeId);
  const isPlan = offer.phase === 'PLAN';
  const recent = human.racePlan?.recentCombat;

  return (
    <RaceDialog label={isPlan ? '출주 계획' : '전개 수정'} busy={busy}>
      <div className="race-panel">
        <div className="race-header">
          <div>
            <G1Crest theme={theme} />
            <div className="race-kicker">RACE PLAN</div>
            <h2>{isPlan ? '출주 계획' : '전개 수정'}</h2>
            <div className="race-sub">
              Stage {match.stage}-{match.round} · 목표 GⅠ {theme.nameKo} ({theme.courseNameKo} {theme.distanceM}m)
              {match.raceConditions ? ` · ${describeConditions(match.raceConditions)}` : ''}
              {` · ${g1Identity(theme).nameKo}`}
            </div>
          </div>
          <div className="race-stats">
            <div><span>레벨</span><b>{human.level}</b></div>
            <div><span>골드</span><b>{human.gold}</b></div>
            <div><span>체력</span><b>{human.hp}</b></div>
            <div>
              <span>최근 전투</span>
              <b>{recent?.sampleCount ? `${recent.avgDuration.toFixed(1)}초` : '—'}</b>
            </div>
          </div>
        </div>
        {match.raceConditions && <RaceConditionsStrip conditions={match.raceConditions} />}
        {!isPlan && human.racePlan?.planId && (
          <div style={{ padding: '12px 28px 0', fontSize: 13, color: 'var(--race-green-700)' }}>
            현재 작전 <b>{findRacePlanNode(human.racePlan.planId)?.nameKo}</b> 에서 갈라집니다.
          </div>
        )}
        <div className="race-cards">
          {offer.options.map((id, i) => {
            const node = findRacePlanNode(id);
            if (!node) return null;
            return (
              <RacePlanCard
                key={id}
                node={node}
                slot={offer.slots[i] ?? String(i + 1)}
                reasons={(offer.reasons[i] ?? []).map(reasonText)}
                rerolled={offer.rerolled[i] ?? false}
                busy={busy}
                onTake={() => take(id)}
                onReroll={() => reroll(i)}
              />
            );
          })}
        </div>
      </div>
    </RaceDialog>
  );
}
