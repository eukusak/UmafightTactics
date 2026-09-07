/** Left (traits + items), right (leaderboard), top HUD and footer panels. */
import { useGameStore } from '../store/gameStore';
import { AUGMENT_BY_ID, TRAIT_DEFS } from '../game/engine/roster';
import { activeTierIndex } from '../game/engine/traits/trait-defs';
import { interestGold, streakBonus, xpToNextLevel } from '../game/engine/economy';
import { itemStorageCapacity, teamSizeLimit } from '../game/engine/shop';
import { roundInfo } from '../game/engine/rounds/schedule';
import { ItemIcon, Stat } from './common';
import { traitTierLabel } from './UnitTooltip';
import type { PlayerState } from '../game/engine/state';

export function TopHud(): JSX.Element | null {
  const match = useGameStore((s) => s.match);
  const player = useGameStore((s) => s.human());
  useGameStore((s) => s.revision);
  if (!match || !player) return null;

  const info = roundInfo(match.stage, match.round);
  const kindLabel = { PVE: 'PvE', PVP: 'PvP', DRAFT: '트윙클 드래프트' }[info.kind];
  const streak = player.streak;

  return (
    <div className="hud-top">
      <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: 1 }}>
        {info.label} <span className="muted" style={{ fontSize: 15 }}>{kindLabel}</span>
      </div>
      <Stat label="체력" value={player.hp} color={player.hp <= 25 ? 'var(--danger)' : 'var(--success)'} />
      <Stat label="골드" value={player.gold} color="var(--gold)" />
      <Stat label="레벨" value={`${player.level}`} />
      <div className="stat">
        <span className="muted" style={{ fontSize: 13 }}>XP</span>
        <b>{player.xp}/{xpToNextLevel(player) || '-'}</b>
      </div>
      <Stat label="팀 규모" value={`${player.board.length}/${teamSizeLimit(player)}`} />
      {streak !== 0 && (
        <span className="pill" style={{ borderColor: streak > 0 ? 'var(--success)' : 'var(--danger)' }}>
          {streak > 0 ? `${streak}연승` : `${-streak}연패`} +{streakBonus(player)}G
        </span>
      )}
      <span className="pill">이자 +{interestGold(player)}G</span>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
        {player.augments.map((id) => (
          <span key={id} className="pill" style={{ borderColor: 'var(--violet)' }}>
            {AUGMENT_BY_ID.get(id)?.name ?? id}
          </span>
        ))}
      </div>
    </div>
  );
}

export function TraitPanel(): JSX.Element | null {
  const counts = useGameStore((s) => s.traitCounts());
  useGameStore((s) => s.revision);

  const rows = TRAIT_DEFS
    .map((t) => ({ trait: t, count: counts.get(t.id) ?? 0 }))
    .filter((r) => r.count > 0)
    .sort((a, b) => {
      const ta = activeTierIndex(a.trait, a.count);
      const tb = activeTierIndex(b.trait, b.count);
      return tb - ta || b.count - a.count || a.trait.id.localeCompare(b.trait.id);
    });

  return (
    <div className="panel scroll" style={{ padding: 10, marginBottom: 12 }}>
      <h4 style={{ margin: '0 0 8px', fontSize: 15 }}>활성 특성</h4>
      {rows.length === 0 && <div className="muted" style={{ fontSize: 13 }}>배치된 유닛이 없습니다.</div>}
      {rows.map(({ trait, count }) => {
        const tier = activeTierIndex(trait, count);
        return (
          <div key={trait.id} className={`trait-row${tier >= 0 ? ' active' : ''}`} title={
            tier >= 0 ? trait.tiers[tier].description : trait.description
          }>
            <img className="trait-icon" src={`/assets/traits/${trait.id}.png`} alt="" />
            <span>{trait.name}</span>
            <span className="count">{traitTierLabel(trait.id, count)}</span>
          </div>
        );
      })}
    </div>
  );
}

export function ItemPanel(): JSX.Element | null {
  const player = useGameStore((s) => s.human());
  const unequipTarget = useGameStore((s) => s.revision);
  if (!player) return null;
  void unequipTarget;

  return (
    <div className="panel" style={{ padding: 10 }}>
      <h4 style={{ margin: '0 0 8px', fontSize: 15 }}>
        아이템 보관함 <span className="muted">{player.items.length}/{itemStorageCapacity(player)}</span>
      </h4>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {player.items.map((i) => (
          <div
            key={i.instanceId}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('application/x-item', i.instanceId);
              e.dataTransfer.effectAllowed = 'move';
            }}
          >
            <ItemIcon itemId={i.itemId} />
          </div>
        ))}
        {player.items.length === 0 && <div className="muted" style={{ fontSize: 13 }}>보유 아이템 없음</div>}
      </div>

      {player.tacticianItems.length > 0 && (
        <>
          <h4 style={{ margin: '12px 0 6px', fontSize: 14 }}>전략가 장비</h4>
          <div style={{ display: 'flex', gap: 6 }}>
            {player.tacticianItems.map((id, idx) => (
              <ItemIcon key={`${id}-${idx}`} itemId={id} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function Leaderboard(): JSX.Element | null {
  const match = useGameStore((s) => s.match);
  const spectating = useGameStore((s) => s.spectating);
  const setSpectate = useGameStore((s) => s.spectate);
  useGameStore((s) => s.revision);
  if (!match) return null;

  const ordered = [...match.players].sort((a, b) => {
    if (a.eliminatedAtRound === null && b.eliminatedAtRound !== null) return -1;
    if (a.eliminatedAtRound !== null && b.eliminatedAtRound === null) return 1;
    return b.hp - a.hp || a.id.localeCompare(b.id);
  });

  return (
    <div className="panel" style={{ padding: 10, marginBottom: 12 }}>
      <h4 style={{ margin: '0 0 8px', fontSize: 15 }}>순위</h4>
      {ordered.map((p, i) => (
        <div
          key={p.id}
          className={`leader-row${p.isHuman ? ' self' : ''}${p.eliminatedAtRound !== null ? ' dead' : ''}`}
          onClick={() => { if (!p.isHuman && p.eliminatedAtRound === null) setSpectate(1); }}
          title={p.aiProfile ? `성향: ${p.aiProfile}` : '플레이어'}
        >
          <span style={{ width: 18 }}>{i + 1}</span>
          <span style={{ width: 66, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {p.name}
          </span>
          <span className="hpbar"><span style={{ width: `${Math.max(0, p.hp)}%` }} /></span>
          <span style={{ width: 28, textAlign: 'right' }}>{Math.max(0, p.hp)}</span>
          <span className="muted" style={{ width: 22, textAlign: 'right' }}>L{p.level}</span>
        </div>
      ))}
      {spectating && (
        <button className="btn-ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => setSpectate(1)}>
          관전 전환 (1 / 3)
        </button>
      )}
    </div>
  );
}

export function OpponentBoardPeek(): JSX.Element | null {
  const viewed = useGameStore((s) => s.viewedPlayer());
  const human = useGameStore((s) => s.human());
  useGameStore((s) => s.revision);
  if (!viewed || !human || viewed.id === human.id) return null;
  return (
    <div className="panel" style={{ padding: 10 }}>
      <h4 style={{ margin: '0 0 6px', fontSize: 14 }}>{viewed.name} 관전 중</h4>
      <div className="muted" style={{ fontSize: 12 }}>
        레벨 {viewed.level} · 유닛 {viewed.board.length} · 골드 {viewed.gold}
      </div>
    </div>
  );
}

export function playerSummary(p: PlayerState): string {
  return `${p.name} · HP ${p.hp} · L${p.level}`;
}

export function ItemDropTargetHint(): JSX.Element {
  return <div className="muted" style={{ fontSize: 12 }}>아이템을 유닛 위로 끌어다 놓으세요.</div>;
}
