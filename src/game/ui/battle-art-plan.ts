import type { PlayerState } from '../engine/state';
import { getUnitDef } from '../engine/roster';
import { assetUrl, cutinUrl, portraitUrl, standeeUrl } from './art';
import { frameSheetUrl } from './frame-animation';
import { RACE_ART } from './race-art';

/**
 * The art a battle will ask for, decided from the prep board.
 *
 * Ordered by how certain and how heavy each item is. The player's own board is
 * guaranteed to be in the fight and its motion sheets are the largest single
 * cost, so those go first; shop rows are speculative and small, so they go
 * last. Warming runs one request at a time and can be cut off at any point, so
 * the ordering is what decides whether a short prep phase was worth anything.
 */
export function battleArtPlan(player: PlayerState): string[] {
  const urls: Array<string | null> = [];
  const unitArt = (defId: string): void => {
    urls.push(frameSheetUrl(defId));
    urls.push(assetUrl(`characters/${defId}.png`));
    urls.push(standeeUrl(defId));
    urls.push(portraitUrl(defId));
  };

  // Fielded units are certain to appear and carry the heaviest sheets.
  for (const unit of player.board) unitArt(unit.unitDefId);
  // A cut-in is a megabyte that plays mid-battle, and only five-costs have one.
  for (const unit of player.board) urls.push(cutinUrl(unit.unitDefId, getUnitDef(unit.unitDefId).cost));
  // The bench is one drag away from the board.
  for (const unit of player.bench) unitArt(unit.unitDefId);
  // Every battle draws these regardless of what is on the board.
  for (const key of CORE_RACE_ART) {
    const art = RACE_ART[key];
    if (art) urls.push(assetUrl(art.file));
  }
  // Shop rows are speculative, so only the cheap portrait.
  for (const slot of player.shop) if (slot?.unitDefId) urls.push(portraitUrl(slot.unitDefId));

  const seen = new Set<string>();
  return urls.filter((url): url is string => !!url && !seen.has(url) && !!seen.add(url));
}

/**
 * Art every battle uses, whatever is on the board: the gate and phase
 * furniture the race HUD draws from the first second. The heavier per-style
 * signature and dive sheets are deliberately absent — BattleScene loads the
 * ones a recording references and defers the rest, so warming them all here
 * would put back the 8.6MB that change removed.
 */
const CORE_RACE_ART = [
  'hud_track_bar', 'hud_track_fill', 'hud_marker_self', 'hud_marker_enemy', 'hud_gate', 'hud_finish',
  'phase_banner_start', 'phase_banner_positioning', 'phase_banner_late', 'phase_banner_last3f',
] as const;
