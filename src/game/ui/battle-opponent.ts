import type { BattleFrame } from '../engine/battle/engine';
import { PVE_ENEMIES, type PveEnemyId } from '../engine/rounds/pve';

export function battleOpponent(frames: BattleFrame[] | null, viewedId: string, players: { id: string; name: string }[]): { id: string; name: string } | null {
  const first = frames?.[0];
  if (!first) return null;
  // Older recordings did not carry participant metadata.
  const sides = first.participants ?? {
    A: first.units.find(u => u.team === 'A')?.id.split('#')[0] ?? '',
    B: first.units.find(u => u.team === 'B')?.id.split('#')[0] ?? '',
  };
  const id = sides.A === viewedId ? sides.B : sides.B === viewedId ? sides.A : '';
  if (!id) return null;
  const name = id.startsWith('pve:') ? PVE_ENEMIES[id.slice(4) as PveEnemyId]?.nameKo : players.find(p => p.id === id)?.name;
  return name ? { id, name } : null;
}
