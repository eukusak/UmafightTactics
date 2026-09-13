import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { getUnitDef } from '../game/engine/roster';
import { getItem } from '../game/engine/items/item-defs';
import type { ItemTool } from '../game/engine/items/consumables';

export function ItemTools(): JSX.Element | null {
  const player = useGameStore(s => s.human());
  const phase = useGameStore(s => s.match?.phase);
  const running = useGameStore(s => s.battleRunning);
  const [kind, setKind] = useState<ItemTool>('REMOVER');
  const [selected, setSelected] = useState('');
  useGameStore(s => s.revision);
  if (!player) return null;
  const count = (tool: ItemTool) => player.pendingGrants.filter(g => g.kind === tool).reduce((n, g) => n + g.count, 0);
  const clones = player.pendingGrants.filter(g => g.kind === 'CLONE').filter(g => g.count > 0);
  const cloneLabels = [...new Set(clones.map(g => g.maxCost))].sort((a,b)=>a-b).map(cap => (cap === 5 ? '전체 코스트' : '1~'+cap+'코') + ' ' + clones.filter(g=>g.maxCost===cap).reduce((n,g)=>n+g.count,0)+'개').join(' / ');
  const options = [...player.board, ...player.bench].filter(u => kind === 'CLONE' ? clones.some(g => g.maxCost >= getUnitDef(u.unitDefId).cost) : u.items.length).map(u => ({ value: `unit:${u.instanceId}`, label: `${getUnitDef(u.unitDefId).nameKo} ${'★'.repeat(u.star)} · ${getUnitDef(u.unitDefId).cost}코 · 장비 ${u.items.length}개` }));
  if (kind === 'REFORGER') options.push(...player.items.filter(i => !getItem(i.itemId).tactician).map(i => ({ value: `item:${i.instanceId}`, label: `보관함 · ${getItem(i.itemId).name}` })));
  const value = options.some(o => o.value === selected) ? selected : options[0]?.value ?? '';
  return <details className="item-tools">
    <summary>장비 도구 · 제거기 {count('REMOVER')} / 재조합기 {count('REFORGER')} / 복제기 {count('CLONE')}</summary>
    <label>사용할 도구<select aria-label="사용할 장비 도구" value={kind} onChange={e => setKind(e.target.value as ItemTool)}>
      <option value="REMOVER">아이템 제거기 ({count('REMOVER')})</option><option value="REFORGER">아이템 재조합기 ({count('REFORGER')})</option><option value="CLONE">기물 복제기 ({count('CLONE')})</option>
    </select></label>
    <label>사용 대상<select aria-label="장비 도구 대상" value={value} onChange={e => setSelected(e.target.value)}>
      {!options.length && <option value="">{kind === 'CLONE' ? '복제 가능한 기물이 없습니다' : '장비를 가진 대상이 없습니다'}</option>}
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select></label>
    <p>{kind === 'CLONE' ? (cloneLabels ? cloneLabels + '. ' : '') + '선택한 기물의 1성 복사본 1개를 대기석에 추가합니다. 장비는 복제하지 않으며, 공유 풀에 재고가 있어야 합니다. 즉시 합성되면 대기석이 가득 차도 사용할 수 있습니다.' : kind === 'REMOVER' ? '기물의 장비를 모두 보관함으로 돌려받습니다.' : '같은 종류·등급의 다른 장비로 바꿉니다. 기물의 장비는 보관함으로 돌아옵니다.'}</p>
    <button disabled={running || phase !== 'ROUND_PREP' || !count(kind) || !value} onClick={() => {
      const [type, id] = value.split(':');
      useGameStore.getState().useItemTool(kind, type === 'unit' ? { unit: id } : { item: id });
    }}>{kind === 'CLONE' ? '기물 복제' : kind === 'REMOVER' ? '장비 회수' : '장비 재조합'} · 1개 사용</button>
  </details>;
}
