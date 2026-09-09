/** Collection: all 145 characters with the spec §29 filters. */
import { useMemo, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import type { SeasonId } from '../../game/engine/seasons/catalog';
import { ALL_UNITS, SEASONS, getSeason, getUnitTraits } from '../../game/engine/roster';
import { getTrait } from '../../game/engine/traits/trait-defs';
import { ROLE_LABELS } from '../../game/ui/palette';
import { Portrait, costVar, RoleChip, TraitChip } from '../common';
import type { UnitDef } from '../../game/engine/types';

const DECADES = ['~1989', '1990s', '2000s', '2010s+'];

function decadeOf(u: UnitDef): string {
  const y = u.source.birthYear;
  if (y <= 1989) return '~1989';
  if (y <= 1999) return '1990s';
  if (y <= 2009) return '2000s';
  return '2010s+';
}

export function CollectionScreen(): JSX.Element {
  const setScreen = useGameStore((s) => s.setScreen);
  const match = useGameStore((s) => s.match);

  const [query, setQuery] = useState('');
  const [seasonId, setSeasonId] = useState<SeasonId>(match?.seasonId ?? 's1');
  const [faction, setFaction] = useState('all');
  const season = getSeason(seasonId);
  const available = new Set(season.unitIds);
  const [activeOnly, setActiveOnly] = useState<'all' | 'active' | 'inactive'>('all');
  const [cost, setCost] = useState('all');
  const [role, setRole] = useState('all');
  const [style, setStyle] = useState('all');
  const [distance, setDistance] = useState('all');
  const [decade, setDecade] = useState('all');
  const [selected, setSelected] = useState<UnitDef | null>(null);

  const filtered = useMemo(() => ALL_UNITS.filter((u) => {
    if (query && !u.nameKo.includes(query) && !u.nameEn.toLowerCase().includes(query.toLowerCase())) return false;
    if (activeOnly === 'active' && !season.unitIds.includes(u.id)) return false;
    if (activeOnly === 'inactive' && season.unitIds.includes(u.id)) return false;
    if (faction !== 'all' && season.unitTraits[u.id] !== faction) return false;
    if (cost !== 'all' && u.cost !== Number(cost)) return false;
    if (role !== 'all' && u.role !== role) return false;
    if (style !== 'all' && !u.traits.includes(style as never)) return false;
    if (distance !== 'all' && !u.traits.includes(distance as never)) return false;
    if (decade !== 'all' && decadeOf(u) !== decade) return false;
    return true;
  }), [query, activeOnly, cost, role, style, distance, decade, season, faction]);

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <div className="hud-top">
        <h2 style={{ margin: 0, fontSize: 24 }}>도감</h2>
        <span className="muted">{filtered.length} / {ALL_UNITS.length}명</span>
        <button className="btn-ghost" style={{ marginLeft: 'auto' }}
          onClick={() => setScreen(match ? 'BATTLE' : 'MAIN_MENU')}>
          돌아가기
        </button>
      </div>

      <div className="filters" style={{ marginTop: 84 }}>
        <select aria-label="도감 시즌" value={seasonId} onChange={e => { setSeasonId(e.target.value as SeasonId); setFaction("all"); }}>{SEASONS.map(s => <option key={s.id} value={s.id}>{s.id.toUpperCase()} · {s.name}</option>)}</select>
        <select aria-label="시즌 시너지" value={faction} onChange={e => setFaction(e.target.value)}><option value="all">시즌 시너지 전체</option>{season.traits.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
        <input placeholder="이름 검색" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select value={activeOnly} onChange={(e) => setActiveOnly(e.target.value as never)}>
          <option value="all">전체</option>
          <option value="active">{seasonId.toUpperCase()} 출전</option>
          <option value="inactive">다른 시즌 출전</option>
        </select>
        <select value={cost} onChange={(e) => setCost(e.target.value)}>
          <option value="all">코스트 전체</option>
          {[1, 2, 3, 4, 5].map((c) => <option key={c} value={c}>{c}코</option>)}
        </select>
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="all">역할 전체</option>
          {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={style} onChange={(e) => setStyle(e.target.value)}>
          <option value="all">각질 전체</option>
          {['nige', 'senko', 'sashi', 'oikomi'].map((s) =>
            <option key={s} value={s}>{getTrait(s as never).name}</option>)}
        </select>
        <select value={distance} onChange={(e) => setDistance(e.target.value)}>
          <option value="all">거리/주로 전체</option>
          {['sprinter', 'miler', 'middle', 'stayer', 'dirt_champion', 'all_rounder'].map((s) =>
            <option key={s} value={s}>{getTrait(s as never).name}</option>)}
        </select>
        <select value={decade} onChange={(e) => setDecade(e.target.value)}>
          <option value="all">연대 전체</option>
          {DECADES.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      <div className="collection-grid scroll">
        {filtered.map((u) => (
          <div
            key={u.id}
            className={`collection-card${available.has(u.id) ? '' : ' inactive'}`}
            style={{ borderColor: costVar(u.cost) }}
            onClick={() => setSelected(u)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="token" style={{ width: 42, height: 42, fontSize: 18, border: `3px solid ${costVar(u.cost)}` }}>
                <Portrait id={u.id} name={u.nameKo} size={74} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {u.nameKo}
                </div>
                <div className="muted" style={{ fontSize: 11 }}>
                  {u.cost}코 · {SEASONS.filter(s => s.unitIds.includes(u.id)).map(s => s.id.toUpperCase()).join(' / ')}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
              {getUnitTraits(u.id, seasonId).map((t) => (
                <span key={t} className="pill" style={{ fontSize: 10, padding: '1px 6px' }}>
                  {getTrait(t).name}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <div className="overlay" onClick={() => setSelected(null)}>
          <div className="overlay-card" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: 0 }}>
              {selected.nameKo} <span className="gold-text">{selected.cost}코</span>
            </h2>
            <div className="muted" style={{ marginBottom: 10 }}>
              {selected.nameJa} · {selected.nameEn} · {selected.source.birthYear}년생
              <br />출전 시즌: {SEASONS.filter(s => s.unitIds.includes(selected.id)).map(s => `${s.id.toUpperCase()} ${s.name}`).join(' · ')}
              {!available.has(selected.id) && <div>현재 선택한 시즌에는 출전하지 않습니다.</div>}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
              <RoleChip role={selected.role} />
              {getUnitTraits(selected.id, seasonId).map((t) => <TraitChip key={t} id={t} />)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 20px', fontSize: 14 }}>
              <span className="muted">체력</span><span>{selected.hp}</span>
              <span className="muted">공격력</span><span>{selected.attackDamage}</span>
              <span className="muted">공격속도</span><span>{selected.attackSpeed.toFixed(2)}</span>
              <span className="muted">방어력 / 마저</span><span>{selected.armor} / {selected.magicResist}</span>
              <span className="muted">사거리</span><span>{selected.attackRange}칸</span>
              <span className="muted">마나</span><span>{selected.startMana} / {selected.maxMana}</span>
              <span className="muted">전적</span>
              <span>{selected.source.historySummary.starts}전 {selected.source.historySummary.wins}승</span>
              <span className="muted">대표 승리</span><span>{selected.source.historySummary.mainWin ?? '-'}</span>
              <span className="muted">powerIndex</span><span>{selected.source.powerIndex.toFixed(3)}</span>
            </div>
            <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid #24384a' }}>
              <strong style={{ color: 'var(--cyan)' }}>{selected.skill.displayName}</strong>
              <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>{selected.skill.description}</div>
            </div>
            <button className="btn-primary" style={{ marginTop: 18 }} onClick={() => setSelected(null)}>
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
