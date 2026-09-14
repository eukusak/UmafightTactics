import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  DIVE_TRAIL_THICKNESS, EFFECT_SIZE, MAX_EFFECT_TILES_X, MAX_EFFECT_TILES_Y,
  STYLE_AURA, effectSize, effectTileSpan,
} from '../src/game/ui/vfx-scale';
import { HEX_STEP_X, HEX_STEP_Y } from '../src/game/engine/constants';

/**
 * A combat effect that covers the board is a bug you only see by playing, and
 * only once it ships. These keep every drawn size inside a budget expressed in
 * tiles, so a new effect cannot quietly be added a size larger than the last.
 */
describe('전투 이펙트 크기 예산', () => {
  it('모든 이펙트가 타일 예산 안에 있다', () => {
    for (const [name, px] of Object.entries(EFFECT_SIZE)) {
      const span = effectTileSpan(px);
      expect(span.x, `${name} 가로 ${span.x.toFixed(2)}타일`).toBeLessThanOrEqual(MAX_EFFECT_TILES_X);
      expect(span.y, `${name} 세로 ${span.y.toFixed(2)}타일`).toBeLessThanOrEqual(MAX_EFFECT_TILES_Y);
    }
  });

  it('각질 오라는 기물이 선 칸을 넘지 않는다 — 발밑에 깔리는 것이라 더 엄격하다', () => {
    expect(STYLE_AURA.width).toBeLessThanOrEqual(HEX_STEP_X);
    expect(STYLE_AURA.height).toBeLessThanOrEqual(HEX_STEP_Y);
  });

  it('다이브 궤적은 두께만 고정이고 길이는 실제 이동 거리를 따른다', () => {
    expect(DIVE_TRAIL_THICKNESS).toBeLessThanOrEqual(HEX_STEP_Y);
  });

  /** The ordering is the design: a once-a-race payout should read bigger. */
  it('처형 > 시그니처 > 일반 순서를 지킨다', () => {
    expect(EFFECT_SIZE.execute).toBeGreaterThan(EFFECT_SIZE.signature);
    expect(EFFECT_SIZE.signature).toBeGreaterThan(EFFECT_SIZE.standard);
  });

  it('키에 따라 올바른 크기를 고른다', () => {
    expect(effectSize('dive_execute')).toBe(EFFECT_SIZE.execute);
    expect(effectSize('style_signature_nige')).toBe(EFFECT_SIZE.signature);
    expect(effectSize('hit_physical_t3')).toBe(EFFECT_SIZE.standard);
    expect(effectSize('vfx_recast')).toBe(EFFECT_SIZE.standard);
  });

  /**
   * The scene must go through `effectSize` rather than writing pixels inline,
   * which is the habit that produced the numbers this module replaced.
   */
  it('BattleScene은 인라인 픽셀 대신 예산 상수를 쓴다', () => {
    const scene = readFileSync('src/game/phaser/BattleScene.ts', 'utf8');
    const inline = [...scene.matchAll(/setDisplaySize\(\s*(\d+)\s*,\s*(\d+)\s*\)/g)]
      .map(m => `${m[1]}x${m[2]}`);
    expect(inline, `인라인 크기 발견: ${inline.join(', ')}`).toEqual([]);
  });
});
