import type { PlayerState } from '../state';
import { benchCapacity } from './index';

/** Benches are compact arrays: occupied slots swap; an empty slot moves to the end. */
export function moveToBench(player: PlayerState, instanceId: string, index?: number): string | null {
  if (index !== undefined && (!Number.isInteger(index) || index < 0 || index >= benchCapacity(player))) return '유효하지 않은 대기석입니다.';
  const from = player.bench.findIndex(u => u.instanceId === instanceId);
  const unit = from >= 0 ? player.bench[from] : player.board.find(u => u.instanceId === instanceId);
  if (!unit) return '본인 기물만 이동할 수 있습니다.';
  if (from >= 0 && index === undefined) return null;
  const target = index === undefined ? undefined : player.bench[index];
  if (from >= 0) {
    if (target) [player.bench[from], player.bench[index!]] = [target, unit];
    else { player.bench.splice(from, 1); player.bench.push(unit); }
  } else if (target) {
    // A full bench can still swap with the field without changing either count.
    target.position = unit.position;
    player.board[player.board.indexOf(unit)] = target;
    player.bench[index!] = unit; unit.position = null;
  } else {
    if (player.bench.length >= benchCapacity(player)) return '대기석이 가득 찼습니다.';
    player.board = player.board.filter(u => u !== unit);
    unit.position = null; player.bench.push(unit);
  }
  return null;
}
