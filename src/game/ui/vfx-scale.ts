/**
 * How large a combat effect is allowed to be drawn.
 *
 * These used to be magic numbers inside `BattleScene`, which made it easy for a
 * new effect to be added a size larger than the last one and for nobody to
 * notice until the board was covered. A hex is 112 wide and rows are 82 apart,
 * so an effect is measured in tiles rather than pixels, and `tests/vfx-scale`
 * holds the ceiling.
 *
 * The rule they encode: an effect may overhang its own tile — that is what
 * makes an impact read as an impact — but it must never reach the units two
 * tiles away, or the player loses track of who is doing what to whom.
 */
import { HEX_STEP_X, HEX_STEP_Y } from '../engine/constants';

/** Widest an effect may be drawn, as a multiple of the column pitch. */
export const MAX_EFFECT_TILES_X = 1.6;
/** Tallest an effect may be drawn, as a multiple of the row pitch. */
export const MAX_EFFECT_TILES_Y = 2.0;

export const EFFECT_SIZE = {
  /** A skill or on-hit flash centred on the unit it belongs to. */
  standard: 115,
  /** A 각질 signature firing: bigger, because it happens once a race. */
  signature: 135,
  /** The kill flash at the end of a dive — the largest thing on the board. */
  execute: 150,
  /** Where a diving bruiser lands. */
  diveImpact: 120,
  /** The older hand-authored race effects, drawn from 192px source sheets. */
  race: 120,
} as const;

/** Source pixel size of the hand-authored race sheets `raceEffect` draws. */
export const RACE_SHEET_SOURCE = 192;

/** The 각질 aura under a unit's feet: wide and flat, so it reads as ground. */
export const STYLE_AURA = { width: 105, height: 52 } as const;
/** The dive trail is as long as the dive; only its thickness is fixed. */
export const DIVE_TRAIL_THICKNESS = 52;
/** A status pip on a unit's card. Not an effect, but it must stay a pip. */
export const STATUS_ICON = 21;

/** The size to draw one of the generated sheets at, before the actor's scale. */
export function effectSize(key: string): number {
  if (key === 'dive_execute') return EFFECT_SIZE.execute;
  if (key.startsWith('style_signature')) return EFFECT_SIZE.signature;
  return EFFECT_SIZE.standard;
}

/** Widest and tallest any effect is drawn, in tiles. Used by the guard test. */
export const effectTileSpan = (px: number): { x: number; y: number } =>
  ({ x: px / HEX_STEP_X, y: px / HEX_STEP_Y });
