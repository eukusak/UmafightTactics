import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { useWishlistStore } from '../store/wishlistStore';
import { getSeason, getSeasonUnits } from '../game/engine/roster';
import { Portrait } from './common';

export function WishlistPanel(): JSX.Element | null {
  const season = useGameStore(s => s.human() ? s.human()?.seasonId ?? s.match?.seasonId : undefined);
  const { wishlist, toggle, clear } = useWishlistStore();
  const [search, setSearch] = useState(''), [cost, setCost] = useState('all');
  if (!season) return null;
  const selected = wishlist[season] ?? [];
  const units = getSeasonUnits(season).filter(u => (!search.trim() || u.nameKo.includes(search.trim())) && (cost === 'all' || u.cost === Number(cost)))
    .slice().sort((a, b) => a.cost - b.cost || a.nameKo.localeCompare(b.nameKo, 'ko'));
  return <details className="panel wishlist-panel">
    <summary>★ 희망 기물 <span>{selected.length}명</span></summary>
    <p className="muted">체크한 기물이 상점에 나오면 ★ 표시됩니다.</p>
    <small>{getSeason(season).name}</small>
    <div className="wishlist-filters">
      <input aria-label="희망 기물 검색" placeholder="기물 이름 검색" value={search} onChange={e => setSearch(e.target.value)} />
      <select aria-label="희망 기물 코스트" value={cost} onChange={e => setCost(e.target.value)}>
        <option value="all">전체</option>{[1, 2, 3, 4, 5].map(c => <option key={c} value={c}>{c}G</option>)}
      </select>
    </div>
    <div className="wishlist-roster">{units.map(u => <label key={u.id} className={selected.includes(u.id) ? 'checked' : ''}>
      <input type="checkbox" aria-label={`${u.nameKo} 희망 기물`} checked={selected.includes(u.id)} onChange={() => toggle(season, u.id)} />
      <Portrait id={u.id} name={u.nameKo} size={28} /><span>{u.nameKo}</span><b style={{ color: `var(--cost-${u.cost})` }}>{u.cost}G</b>
    </label>)}</div>
    {units.length === 0 && <p className="muted">검색 결과가 없습니다.</p>}
    <button className="btn-ghost" disabled={!selected.length} onClick={() => clear(season)}>이번 시즌 체크 해제</button>
  </details>;
}
