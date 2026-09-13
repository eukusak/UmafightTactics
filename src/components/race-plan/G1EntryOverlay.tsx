/**
 * GⅠ 출주 등록 (4-5, or 4-3 when the player is on 20 hp or less).
 *
 * Laid out as a race card rather than a champion picker: the grid is the field,
 * the right column is the form line for the horse under the cursor. The marks
 * ◎ ○ ▲ recommend; nothing here forbids a pick.
 */
import { useState } from 'react';
import type { JSX } from 'react';
import { useGameStore } from '../../store/gameStore';
import { Portrait } from '../common';
import { getUnitDef } from '../../game/engine/roster';
import { entryCandidates } from '../../game/engine/race-plan/entry';
import { findRacePlanNode } from '../../game/engine/race-plan/defs';
import { getG1Theme, getRacingProfile } from '../../game/engine/race-plan/profiles';
import { RACE_PHASE_LABEL } from '../../game/engine/race-plan/types';
import { describeEffects } from '../../game/engine/race-plan/presentation';
import { IconDirectionLeft, IconDirectionRight, IconSurfaceDirt, IconSurfaceTurf } from './RaceIcons';

const STYLE_LABEL: Record<string, string> = { nige: '도주', senko: '선행', sashi: '선입', oikomi: '추입' };
const DISTANCE_LABEL: Record<string, string> = { sprinter: '단거리', miler: '마일', middle: '중거리', stayer: '장거리' };
const markClassName = (mark: string): string =>
  mark === '◎' ? 'best' : mark === '○' ? 'good' : mark === '▲' ? 'exp' : '';

export function G1EntryOverlay(): JSX.Element | null {
  const match = useGameStore((s) => s.match);
  const human = useGameStore((s) => s.human());
  const choose = useGameStore((s) => s.chooseRaceEntry);
  const defer = useGameStore((s) => s.deferRaceEntry);
  useGameStore((s) => s.revision);
  const [selected, setSelected] = useState<string | null>(null);

  if (!match || !human) return null;
  const rp = human.racePlan;
  if (!rp || rp.offerPhase !== 'ENTRY' || rp.entryUnitDefId) return null;

  const theme = getG1Theme(match.g1ThemeId);
  const candidates = entryCandidates(match, human);
  if (!candidates.length) return null;
  const active = candidates.find((c) => c.instanceId === selected) ?? candidates[0];
  const activeDef = getUnitDef(active.unitDefId);
  const profile = getRacingProfile(active.unitDefId);
  const plan = rp.planId ? findRacePlanNode(rp.planId) : undefined;
  const evolution = rp.evolutionId ? findRacePlanNode(rp.evolutionId) : undefined;
  const Direction = theme.direction === 'LEFT' ? IconDirectionLeft : IconDirectionRight;
  const Surface = theme.surface === 'TURF' ? IconSurfaceTurf : IconSurfaceDirt;

  return (
    <div className="race-overlay">
      <div className="race-panel">
        <div className="race-header">
          <div className="race-g1-head">
            <div className="race-g1-badge">GⅠ</div>
            <div>
              <h2>{theme.nameKo}</h2>
              <div className="race-g1-meta">
                {theme.courseNameKo} · {theme.distanceM}m · {theme.surface === 'TURF' ? '잔디' : '더트'} ·{' '}
                {theme.direction === 'LEFT' ? '좌회전' : '우회전'}
              </div>
            </div>
          </div>
          <div className="race-stats">
            <div><span>현재 작전</span><b style={{ fontSize: 14 }}>{plan?.nameKo ?? '—'}</b></div>
            <div><span>전개</span><b style={{ fontSize: 14 }}>{evolution?.nameKo ?? '—'}</b></div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--race-line)' }}>
              <Surface size={22} /><Direction size={22} />
            </div>
          </div>
        </div>

        <div className="race-entry-layout">
          <div className="race-entry-grid">
            {candidates.map((candidate) => {
              const def = getUnitDef(candidate.unitDefId);
              return (
                <button
                  type="button"
                  key={candidate.instanceId}
                  className={`race-entry-card${candidate.onBench ? ' bench' : ''}`}
                  aria-pressed={candidate.instanceId === active.instanceId}
                  onClick={() => setSelected(candidate.instanceId)}
                >
                  <Portrait id={def.id} name={def.nameKo} size={72} />
                  <div style={{ minWidth: 0 }}>
                    <div className="race-entry-name">{def.nameKo}</div>
                    <div className="race-entry-line">
                      {'★'.repeat(candidate.star)} · {def.cost}코 · {def.role}
                      {candidate.onBench ? ' · 대기석' : ''}
                    </div>
                    <div className="race-entry-line">
                      {STYLE_LABEL[def.source.primaryStyle]} · {DISTANCE_LABEL[def.source.bestDistance]}
                    </div>
                  </div>
                  {candidate.mark && (
                    <span className={`race-entry-mark ${markClassName(candidate.mark)}`}>{candidate.mark}</span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="race-entry-detail">
            <h3>{activeDef.nameKo}</h3>
            <div style={{ color: 'var(--race-green-700)' }}>
              출주 적합도 <b style={{ fontSize: 20 }}>{Math.round(active.fit * 100)}</b>
            </div>
            {active.onBench && (
              <p style={{ color: 'var(--race-red)', fontSize: 12 }}>
                대기석 기물입니다. 필드에 올려야 작전 효과가 적용됩니다.
              </p>
            )}
            <dl>
              <dt>현재 작전</dt><dd>{plan?.nameKo ?? '—'}</dd>
              <dt>전개</dt><dd>{evolution?.nameKo ?? '—'}</dd>
              <dt>장착 장비</dt><dd>{active.items.length}/3</dd>
              <dt>고유 승부수</dt><dd>{active.hasSignature ? '있음' : '없음'}</dd>
            </dl>
            {profile && (
              <>
                <div style={{ fontWeight: 600, marginTop: 8 }}>경주 적성</div>
                <dl>
                  <dt>각질</dt>
                  <dd>
                    {STYLE_LABEL[activeDef.source.primaryStyle]} {profile.style[activeDef.source.primaryStyle]}
                  </dd>
                  <dt>거리</dt>
                  <dd>
                    {DISTANCE_LABEL[activeDef.source.bestDistance]}{' '}
                    {profile.distance[
                      { sprinter: 'sprint', miler: 'mile', middle: 'middle', stayer: 'long' }[
                        activeDef.source.bestDistance
                      ] as 'middle'
                    ]}
                  </dd>
                  <dt>마장</dt>
                  <dd>잔디 {profile.surface.turf} · 더트 {profile.surface.dirt}</dd>
                  <dt>코스</dt>
                  <dd>
                    {profile.courses.find((c) => c.id === theme.racecourse)?.rating ?? '기록 없음'}
                  </dd>
                </dl>
              </>
            )}
            {plan && (
              <>
                <div style={{ fontWeight: 600, marginTop: 8 }}>예상 발동</div>
                <ul className="race-effects">
                  {[...describeEffects(plan), ...(evolution ? describeEffects(evolution) : [])]
                    .slice(0, 5)
                    .map((line, i) => <li key={i}>{line}</li>)}
                </ul>
              </>
            )}
          </div>
        </div>

        <div className="race-entry-actions">
          <button type="button" className="race-take" onClick={() => choose(active.instanceId)}>
            출주 등록
          </button>
          <button type="button" className="race-defer" onClick={() => defer()}>
            등록 보류
          </button>
          <span style={{ alignSelf: 'center', fontSize: 12, color: 'var(--race-green-700)' }}>
            보류해도 손해는 없습니다. 5-2 준비가 끝나기 전까지 등록하면 됩니다.
          </span>
        </div>
      </div>
    </div>
  );
}

/** Three finishing moves, dealt the moment the entry is confirmed. */
export function FinishingMoveOverlay(): JSX.Element | null {
  const match = useGameStore((s) => s.match);
  const human = useGameStore((s) => s.human());
  useGameStore((s) => s.revision);
  const rp = human?.racePlan;
  if (!match || !human || !rp || rp.offerPhase !== 'FINISHING') return null;
  const offer = rp.currentOffer;
  if (!offer || offer.chosen !== null) return null;
  const entry = rp.entryUnitDefId ? getUnitDef(rp.entryUnitDefId) : null;
  return <FinishingCards entryName={entry?.nameKo ?? ''} entryId={entry?.id ?? ''} />;
}

function FinishingCards({ entryName, entryId }: { entryName: string; entryId: string }): JSX.Element | null {
  const human = useGameStore((s) => s.human());
  const choose = useGameStore((s) => s.chooseRacePlan);
  const offer = human?.racePlan?.currentOffer;
  if (!offer) return null;
  return (
    <div className="race-overlay">
      <div className="race-panel">
        <div className="race-header">
          <div>
            <div className="race-kicker">FINISHING MOVE</div>
            <h2>최종 승부수</h2>
            <div className="race-sub">기수에게 내리는 마지막 지시입니다.</div>
          </div>
          <div className="race-stats" style={{ alignItems: 'center' }}>
            {entryId && <Portrait id={entryId} name={entryName} size={56} />}
            <div><span>출주마</span><b style={{ fontSize: 15 }}>{entryName}</b></div>
          </div>
        </div>
        <div className="race-cards">
          {offer.options.map((id, i) => {
            const node = findRacePlanNode(id);
            if (!node) return null;
            return (
              <div className="race-card" key={id}>
                <div className="race-band">
                  <span>작전 {offer.slots[i] ?? i + 1}</span>
                </div>
                <div className="race-body">
                  <h3>{node.nameKo}</h3>
                  <p className="race-flavor">{node.descriptionKo}</p>
                  <ul className="race-effects">
                    {describeEffects(node).map((line, k) => <li key={k}>{line}</li>)}
                  </ul>
                  <div className="race-tags">
                    <span>{node.fit.phases.map((p) => RACE_PHASE_LABEL[p]).join(' · ')}</span>
                    {node.signatureUnitId && <span>고유 승부수</span>}
                  </div>
                </div>
                <div className="race-card-actions">
                  <button type="button" className="race-take" onClick={() => choose(id)}>이 승부수로 간다</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
