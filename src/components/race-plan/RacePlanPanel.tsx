/**
 * Race Plan status and help, shown in the prep-phase side panel.
 *
 * The system makes four decisions across a match and then disappears into the
 * battle, so without this the player has no way to check what they committed to
 * or when the next choice is coming.
 */
import type { JSX } from 'react';
import { useGameStore } from '../../store/gameStore';
import { getUnitDef } from '../../game/engine/roster';
import { findRacePlanNode } from '../../game/engine/race-plan/defs';
import { getG1Theme } from '../../game/engine/race-plan/profiles';
import { TRACK_STATE_LABEL } from '../../game/engine/race-plan/plan-defs';
import { describeEffects } from '../../game/engine/race-plan/presentation';
import { RACE_PLAN_ROUNDS } from '../../game/engine/constants';

/** The next decision still ahead of this player, as a plain sentence. */
function nextStep(hasPlan: boolean, hasEvolution: boolean, hasEntry: boolean): string | null {
  if (!hasPlan) {
    const at = RACE_PLAN_ROUNDS.find((r) => r.kind === 'PLAN')!;
    return `${at.stage}-${at.round}에 출주 계획을 세웁니다. 이번 판을 어느 구간에서 강하게 달릴지 고르는 단계입니다.`;
  }
  if (!hasEvolution) {
    const at = RACE_PLAN_ROUNDS.find((r) => r.kind === 'EVOLUTION')!;
    return `${at.stage}-${at.round}에 전개를 수정합니다. 지금 작전을 더 날카롭게 다듬는 갈림길이 열립니다.`;
  }
  if (!hasEntry) {
    const at = RACE_PLAN_ROUNDS.find((r) => r.kind === 'ENTRY')!;
    return `${at.stage}-${at.round}에 GⅠ 출주마를 등록합니다. 여기서 처음으로 작전이 기물 한 명에게 실립니다.`;
  }
  return null;
}

export function RacePlanPanel(): JSX.Element | null {
  const match = useGameStore((s) => s.match);
  const human = useGameStore((s) => s.human());
  useGameStore((s) => s.revision);
  if (!match || !human) return null;

  const rp = human.racePlan;
  const plan = rp?.planId ? findRacePlanNode(rp.planId) : undefined;
  const evolution = rp?.evolutionId ? findRacePlanNode(rp.evolutionId) : undefined;
  const move = rp?.finishingMoveId ? findRacePlanNode(rp.finishingMoveId) : undefined;
  const entry = rp?.entryUnitDefId ? getUnitDef(rp.entryUnitDefId) : undefined;
  const theme = getG1Theme(match.g1ThemeId);
  const fielded = entry && human.board.some((u) => u.unitDefId === entry.id);
  const upcoming = nextStep(!!plan, !!evolution, !!entry);

  return (
    <div className="panel race-panel-side">
      <strong>레이스 플랜</strong>
      <p className="race-side-theme">
        이번 로비의 목표는 {theme.nameKo}, {theme.courseNameKo} {theme.distanceM}m{' '}
        {theme.surface === 'TURF' ? '잔디' : '더트'} {theme.direction === 'LEFT' ? '좌회전' : '우회전'}입니다
        {match.racePlanTrack ? `. 이번 라운드 마장은 ${TRACK_STATE_LABEL[match.racePlanTrack]}입니다` : ''}.
      </p>

      {!plan && (
        <p className="race-side-help">
          전투를 하나의 경주로 보고 템, 도중, 승부처, 라스트 3F 가운데 어디에서 힘을 쓸지 고르는 시스템입니다.
          증강체와 달리 골드나 상점에는 손대지 않고, 마지막에 지정한 승부마 한 명에게 작전이 실립니다.
        </p>
      )}

      {plan && (
        <dl className="race-side-list">
          <dt>작전</dt>
          <dd>{plan.nameKo}{evolution ? ` → ${evolution.nameKo}` : ''}</dd>
          {entry && <><dt>출주마</dt><dd>{entry.nameKo}</dd></>}
          {move && <><dt>승부수</dt><dd>{move.nameKo}</dd></>}
        </dl>
      )}

      {plan && !entry && (
        <p className="race-side-help">
          아직 기물에 묶이지 않았습니다. 지금은 보드에서 가장 캐리에 가까운 기물이 작전을 대신 받고 있으니,
          누구를 승부마로 키울지는 등록 전까지 자유롭게 바꿔도 됩니다.
        </p>
      )}

      {entry && !fielded && (
        <p className="race-side-warn">
          출주마가 필드에 없습니다. 대기석에 있는 동안에는 작전 효과가 전혀 적용되지 않습니다.
        </p>
      )}

      {plan && (
        <details className="race-side-details">
          <summary>작전 효과 보기</summary>
          <ul className="race-effects">
            {[...describeEffects(plan), ...(evolution ? describeEffects(evolution) : []), ...(move ? describeEffects(move) : [])]
              .map((line, i) => <li key={i}>{line}</li>)}
          </ul>
        </details>
      )}

      {upcoming && <p className="race-side-next">{upcoming}</p>}

      {entry && !rp?.transferUsed && (
        <p className="race-side-help">
          승부마 변경은 판마다 한 번 쓸 수 있습니다. 작전과 전개는 그대로 따라오고 승부수만 새로 고릅니다.
        </p>
      )}
    </div>
  );
}
