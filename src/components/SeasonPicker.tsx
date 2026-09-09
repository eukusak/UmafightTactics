import { useState } from 'react';
import { getSeason, getSeasonUnits, SEASONS } from '../game/engine/roster';
import type { SeasonId } from '../game/engine/seasons/catalog';
import { Portrait, costVar } from './common';

export function SeasonPicker({ value, onChange }: { value: SeasonId; onChange: (id: SeasonId) => void }): JSX.Element {
  const [rosterOpen, setRosterOpen] = useState(false);
  const season = getSeason(value);
  return <section className="season-picker" aria-label="시즌 선택">
    <div className="season-picker-heading"><strong>이번에는 어떤 무대로?</strong><span>5개 시즌 · 시즌당 60명 · 전체 145명 출전</span></div>
    <div className="season-cards">{SEASONS.map((s, i) => <button key={s.id} type="button" aria-pressed={s.id === value}
      className={`season-card${s.id === value ? ' selected' : ''}`} style={{ '--season-color': s.color } as React.CSSProperties} onClick={() => onChange(s.id)}>
      <small>SEASON 0{i + 1}</small><strong>{s.name}</strong><span>{s.subtitle}</span>
    </button>)}</div>
    <div className="season-details" style={{ '--season-color': season.color } as React.CSSProperties}>
      <div className="season-detail-heading"><strong>{season.name} · 전용 시너지</strong><button className="btn-ghost" type="button" onClick={() => setRosterOpen(true)}>출전 기물 60명 보기</button></div>
      <p className="muted">서로 다른 기물 3 / 5 / 7명으로 강화됩니다. 각 기물의 기존 특성과 함께 적용됩니다.</p>
      <div className="season-traits">{season.traits.map(t => <div key={t.id}><b>{t.name}</b>{t.tiers.map(tier => <span key={tier.count}><em>{tier.count}</em>{tier.description}</span>)}</div>)}</div>
    </div>
    {rosterOpen && <div className="overlay" onClick={() => setRosterOpen(false)}><div className="overlay-card season-roster scroll" onClick={e => e.stopPropagation()}>
      <div className="season-detail-heading"><h2>{season.name} · 60명</h2><button onClick={() => setRosterOpen(false)}>닫기</button></div>
      {season.traits.map(t => <section key={t.id}><h3>{t.name} <small className="muted">15명</small></h3><div className="season-roster-units">
        {getSeasonUnits(value).filter(u => season.unitTraits[u.id] === t.id).sort((a,b) => a.cost-b.cost).map(u => <div key={u.id} title={`${u.skill.displayName}\n${u.skill.description}`}>
          <Portrait id={u.id} name={u.nameKo} size={36} /><span>{u.nameKo}</span><b style={{ color: costVar(u.cost) }}>{u.cost}G</b>
        </div>)}
      </div></section>)}
    </div></div>}
  </section>;
}
