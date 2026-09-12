import { describe, expect, it } from 'vitest';
import { ANIMATION_CLIPS, animationFrame, arenaUrl, type AnimationName } from '../src/game/ui/art';
import { boardPoint, prepPoint } from '../src/game/ui/board-projection';
import { toBattleCell } from '../src/game/engine/battle/hex';

describe('art playback contract', () => {
  it('keeps all 28 placed units at the same coordinates when battle starts', () => {
    const seen = new Set<string>();
    for (let r = 0; r < 4; r += 1) for (let q = 0; q < 7; q += 1) {
      const point = prepPoint({ q, r });
      expect(point).toEqual(boardPoint(toBattleCell({ q, r }, 'A')));
      expect(point.x).toBeGreaterThan(128);
      expect(point.x).toBeLessThan(1192);
      expect(point.y).toBeGreaterThan(200);
      expect(point.y).toBeLessThan(560);
      seen.add(`${point.x},${point.y}`);
    }
    expect(seen.size).toBe(28);
  });

  it('never plays padding cells, including at long elapsed times', () => {
    const blanks = new Set([6, 7, 8, 9, 18, 19, 28, 29, 40, 41, 42, 43, 58, 59]);
    for (const name of Object.keys(ANIMATION_CLIPS) as AnimationName[]) {
      const clip = ANIMATION_CLIPS[name];
      for (const t of [-1, 0, .01, .35, .8, 1, 10000]) {
        const frame = animationFrame(name, t);
        expect(blanks.has(frame)).toBe(false);
        expect(frame).toBeGreaterThanOrEqual(clip.start);
        expect(frame).toBeLessThan(clip.start + clip.count);
      }
      if (!clip.loop) expect(animationFrame(name, 10000)).toBe(clip.start + clip.count - 1);
    }
  });

  it('uses the training environment for every PvE stage', () => {
    for (let stage = 1; stage < 10; stage += 1) {
      expect(arenaUrl(stage, true)).toBe('/assets/boards/bg_pve_training.png?v=test');
    }
  });
});
