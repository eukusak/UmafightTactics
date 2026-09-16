/**
 * The item half of the codex.
 *
 * Every row is read from ITEM_DEFS, including the recipe: a hand-kept list of
 * "A + B makes C" is a list that drifts the first time a recipe changes, and
 * nothing fails when it does. The recipe shows each component's icon beside its
 * name, because that is how a player reads the shop — they are matching
 * pictures, not strings.
 */
import { useMemo, useState } from 'react';
import {
  COMPONENT_DEFS, COMPLETED_ITEM_DEFS, SPECIAL_ITEM_DEFS, getItem,
} from '../game/engine/items/item-defs';
import { itemUrl } from '../game/ui/art';
import type { ItemDef } from '../game/engine/types';

type Group = 'ALL' | 'COMPONENT' | 'COMPLETE' | 'SPECIAL';

const GROUPS: Array<{ id: Group; label: string }> = [
  { id: 'ALL', label: '전체' },
  { id: 'COMPONENT', label: '기본 재료' },
  { id: 'COMPLETE', label: '조합' },
  { id: 'SPECIAL', label: '특수' },
];

const groupOf = (item: ItemDef): Exclude<Group, 'ALL'> =>
  item.isComponent ? 'COMPONENT'
    : SPECIAL_ITEM_DEFS.some((s) => s.id === item.id) ? 'SPECIAL'
      : 'COMPLETE';

export function ItemIcon({ id, size = 46 }: { id: string; size?: number }): JSX.Element {
  const url = itemUrl(id);
  return url
    ? <img className="item-icon" src={url} alt="" width={size} height={size} draggable={false} />
    : <span className="item-icon item-icon-missing" style={{ width: size, height: size }} />;
}

export function ItemCodex(): JSX.Element {
  const [group, setGroup] = useState<Group>('ALL');
  const [query, setQuery] = useState('');

  const all = useMemo(
    () => [...COMPONENT_DEFS, ...COMPLETED_ITEM_DEFS, ...SPECIAL_ITEM_DEFS],
    [],
  );
  const shown = all.filter((item) => {
    if (group !== 'ALL' && groupOf(item) !== group) return false;
    if (query && !item.name.includes(query) && !item.description.includes(query)) return false;
    return true;
  });

  return (
    <>
      {/* The header is fixed; clear it or the first row sits under it and
          cannot be clicked. The unit tab offsets inline for the same reason. */}
      <div className="filters" style={{ marginTop: 84 }}>
        {GROUPS.map((g) => (
          <button key={g.id} className={`chip${group === g.id ? ' active' : ''}`}
            aria-pressed={group === g.id} onClick={() => setGroup(g.id)}>{g.label}</button>
        ))}
        <input aria-label="아이템 검색" placeholder="아이템 검색" value={query}
          onChange={(e) => setQuery(e.target.value)} />
        <span className="muted" style={{ marginLeft: 'auto' }}>{shown.length} / {all.length}개</span>
      </div>

      <div className="item-codex scroll">
        {shown.map((item) => (
          <article key={item.id} className="item-row">
            <ItemIcon id={item.id} />
            <div className="item-main">
              <div className="item-name">
                {item.name}
                {item.tactician && <span className="pill">전략가 전용</span>}
                {item.grantsTrait && <span className="pill">특성 부여</span>}
              </div>
              <p className="item-desc">{item.description}</p>
            </div>
            <div className="item-recipe">
              {item.components?.length
                ? item.components.map((componentId, i) => (
                  <span key={i} className="item-part">
                    {i > 0 && <span className="item-plus">+</span>}
                    <ItemIcon id={componentId} size={24} />
                    {getItem(componentId).name}
                  </span>
                ))
                : <span className="muted">
                  {groupOf(item) === 'COMPONENT' ? '기본 재료' : '조합 불가'}
                </span>}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
