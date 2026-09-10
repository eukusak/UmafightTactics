import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { isItemReward, itemRewardOptions, type ItemRewardKind } from '../game/engine/items/rewards';
import { getItem } from '../game/engine/items/item-defs';
import { ItemIcon } from './common';

const labels: Record<ItemRewardKind, string> = {
  COMPONENT_CHOICE: '하위 재료',
  COMPLETED_CHOICE: '완성 장비',
  EMBLEM_CHOICE: '특성 인자',
  RADIANT_CHOICE: '찬란한 장비',
  ARTIFACT_CHOICE: '유물',
};

function RewardChoice({
  kind,
  count,
  disabled,
}: {
  kind: ItemRewardKind;
  count: number;
  disabled: boolean;
}): JSX.Element {
  const options = itemRewardOptions(kind);
  const [id, setId] = useState(options[0]);
  const item = getItem(id);
  return (
    <details
      className="item-reward"
      style={{ marginTop: 10, borderTop: '1px solid var(--gold)', paddingTop: 8 }}
    >
      <summary style={{ cursor: 'pointer', color: 'var(--gold)' }}>
        {labels[kind]} 보상 · {count}개
      </summary>
      <label style={{ display: 'block', marginTop: 8 }}>
        {labels[kind]} 선택
        <select value={id} onChange={(e) => setId(e.target.value)} style={{ width: '100%' }}>
          {options.map((id) => (
            <option key={id} value={id}>
              {getItem(id).name}
            </option>
          ))}
        </select>
      </label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'start', marginTop: 8 }}>
        <ItemIcon itemId={id} size={32} />
        <p style={{ margin: 0, fontSize: 12 }}>{item.description}</p>
      </div>
      <button
        disabled={disabled}
        style={{ width: '100%', marginTop: 8 }}
        onClick={() => useGameStore.getState().claimItemReward(kind, id)}
      >
        선택한 장비 받기
      </button>
      {disabled && <p className="muted">준비 단계에서 받을 수 있습니다.</p>}
    </details>
  );
}

export function ItemRewards(): JSX.Element | null {
  const player = useGameStore((s) => s.human());
  const phase = useGameStore((s) => s.match?.phase);
  useGameStore((s) => s.revision);
  if (!player) return null;
  const counts = new Map<ItemRewardKind, number>();
  for (const grant of player.pendingGrants)
    if (isItemReward(grant) && grant.count > 0)
      counts.set(grant.kind, (counts.get(grant.kind) ?? 0) + grant.count);
  return (
    <>
      {[...counts].map(([kind, count]) => (
        <RewardChoice key={kind} kind={kind} count={count} disabled={phase !== 'ROUND_PREP'} />
      ))}
    </>
  );
}
