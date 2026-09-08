import { describe, expect, it } from 'vitest';
import { findAttackPosition, findPath, hexKey, neighbours, reflectCell, teamKey } from '../src/game/engine/battle/hex';

describe('reachable attack positions', () => {
  it('returns no destination when allies surround the attacker', () => {
    const from = { q: 3, r: 6 };
    const blocked = new Set(neighbours(from).map(hexKey));
    expect(findAttackPosition(from, { q: 3, r: 2 }, 1, blocked)).toBeNull();
  });

  it('walks around a sealed near-side firing cell to an open flank', () => {
    const from = { q: 3, r: 6 };
    const target = { q: 3, r: 2 };
    const pocket = { q: 3, r: 3 };
    const blocked = new Set(neighbours(pocket).map(hexKey));
    blocked.add(hexKey(target));
    const goal = findAttackPosition(from, target, 1, blocked, (h) => teamKey(h, 'A'));
    expect(goal).not.toBeNull();
    expect(goal).not.toEqual(pocket);
    expect(findPath(from, goal!, blocked).length).toBeGreaterThan(0);

    const mirrored = new Set([...blocked].map((key) => {
      const [q, r] = key.split(',').map(Number);
      return hexKey(reflectCell({ q, r }));
    }));
    expect(findAttackPosition(reflectCell(from), reflectCell(target), 1, mirrored,
      (h) => teamKey(h, 'B'))).toEqual(reflectCell(goal!));
  });

  it('keeps its occupied current cell when already in range', () => {
    const from = { q: 3, r: 4 };
    expect(findAttackPosition(from, { q: 3, r: 3 }, 1,
      new Set([hexKey(from), '3,3']))).toEqual(from);
  });
});
