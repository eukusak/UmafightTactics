/** Small shared presentational pieces. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { getUnitDef } from '../game/engine/roster';
import { getItem } from '../game/engine/items/item-defs';
import { getTrait } from '../game/engine/traits/trait-defs';
import { ART_COLORS, ITEM_TAG_COLORS, ROLE_COLORS, ROLE_LABELS, STYLE_COLORS } from '../game/ui/palette';
import { initialOf } from '../game/phaser/fallback-art';
import type { UnitInstance } from '../game/engine/state';
import { portraitUrl, itemUrl } from '../game/ui/art';
import type { TraitId } from '../game/engine/types';

export const costVar = (cost: number): string => `var(--cost-${cost})`;

export function traitColor(id: TraitId): string {
  return STYLE_COLORS[id] ?? ART_COLORS.edgeLight;
}

export function Portrait({ id, name, size = 64 }: { id: string; name: string; size?: number }): JSX.Element {
  const [failed, setFailed] = useState(false);
  const url = portraitUrl(id);
  useEffect(() => setFailed(false), [id]);
  return url && !failed
    ? <img className="portrait-art" src={url} alt={name} width={size} height={size} draggable={false} onError={() => setFailed(true)} />
    : <span className="portrait-fallback" style={{ width: size, height: size }}>{initialOf(name)}</span>;
}

/** Circular unit token used on the bench, board and shop. */
export function UnitToken({
  unit, size = 64, onContextMenu,
}: {
  unit: UnitInstance;
  size?: number;
  onContextMenu?: (e: React.MouseEvent) => void;
}): JSX.Element {
  const def = getUnitDef(unit.unitDefId);
  return (
    <div
      className="token"
      onContextMenu={onContextMenu}
      style={{
        width: size, height: size, fontSize: size * 0.34,
        border: `3px solid ${costVar(def.cost)}`,
      }}
    >
      {unit.star > 1 && <div className="stars">{'★'.repeat(unit.star)}</div>}
      <Portrait id={def.id} name={def.nameKo} size={size - 6} />
      {unit.items.length > 0 && (
        <div className="items">
          {unit.items.map((id, i) => (
            <i key={`${id}-${i}`} style={{ background: ITEM_TAG_COLORS[getItem(id).tags[0]] ?? ART_COLORS.muted }} />
          ))}
        </div>
      )}
    </div>
  );
}

export function TraitChip({ id }: { id: TraitId }): JSX.Element {
  const trait = getTrait(id);
  return (
    <span className="pill" style={{ borderColor: traitColor(id) }}>
      {trait.name}
    </span>
  );
}

export function RoleChip({ role }: { role: string }): JSX.Element {
  return (
    <span className="pill" style={{ borderColor: ROLE_COLORS[role], color: ROLE_COLORS[role] }}>
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

/** Item square with a two-letter abbreviation as the fallback art. */
export function ItemIcon({
  itemId, size = 34, onClick, title,
}: {
  itemId: string; size?: number; onClick?: () => void; title?: string;
}): JSX.Element {
  const item = getItem(itemId);
  const tint = ITEM_TAG_COLORS[item.tags[0]] ?? ART_COLORS.muted;
  return (
    <div
      onClick={onClick}
      title={title ?? `${item.name} — ${item.description}`}
      style={{
        width: size, height: size, borderRadius: 5,
        border: `2px solid ${tint}`, background: ART_COLORS.panelBright,
        display: 'grid', placeItems: 'center', fontSize: size * 0.36, fontWeight: 700,
        cursor: onClick ? 'pointer' : 'default', flex: '0 0 auto',
      }}
    >
      {itemUrl(itemId)
        ? <img src={itemUrl(itemId)!} alt={item.name} width={size - 4} height={size - 4} draggable={false} />
        : item.name.slice(0, 2)}
    </div>
  );
}

/** Right-click tooltip anchored to the cursor. */
export function Tooltip({
  x, y, children, onClose,
}: {
  x: number; y: number; children: ReactNode; onClose: () => void;
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // Keep the tooltip on screen.
    setPos({
      x: Math.min(x, window.innerWidth - rect.width - 12),
      y: Math.min(y, window.innerHeight - rect.height - 12),
    });
  }, [x, y]);

  useEffect(() => {
    const handler = (): void => onClose();
    window.addEventListener('click', handler);
    window.addEventListener('contextmenu', handler);
    return () => {
      window.removeEventListener('click', handler);
      window.removeEventListener('contextmenu', handler);
    };
  }, [onClose]);

  return (
    <div ref={ref} className="tooltip" style={{ left: pos.x + 12, top: pos.y + 12 }}>
      {children}
    </div>
  );
}

export function Stat({ label, value, color }: { label: string; value: ReactNode; color?: string }): JSX.Element {
  return (
    <div className="stat">
      <span className="muted" style={{ fontSize: 13 }}>{label}</span>
      <b style={{ color }}>{value}</b>
    </div>
  );
}
