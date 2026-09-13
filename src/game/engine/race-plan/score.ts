/**
 * Offer scoring.
 *
 * Eleven clamped factors, multiplied. The clamps matter more than the formula:
 * no single signal may delete a candidate, and nothing here is allowed to make
 * an effect *stronger* — a rich or low-health player gets different kinds of
 * card, never a bigger number.
 */
import type { RacePlanContext } from './context';
import { guardAffinity } from './defs';
import { getG1Theme, getRacingProfile, readPct } from './profiles';
import { RACE_PHASE_LABEL } from './types';
import type { G1Theme, HorseRacingProfile, OfferReasonPayload, RacePlanNode } from './types';

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export type ScoreBreakdown = {
  score: number;
  boardFit: number;
  itemFit: number;
  economyFit: number;
  combatFit: number;
  traitFit: number;
  aptitudeFlavor: number;
  themeFlavor: number;
  diversity: number;
  antiRepeat: number;
  lobbyVariety: number;
};

function boardFit(node: RacePlanNode, ctx: RacePlanContext): number {
  let fit = 1;
  if (node.fit.roles?.length) {
    const covered = node.fit.roles.reduce((n, r) => n + (ctx.roleCounts[r] ?? 0), 0);
    fit *= covered === 0 ? 0.82 : 1 + Math.min(0.22, covered * 0.05);
  }
  if (node.fit.styles?.length) {
    const covered = node.fit.styles.reduce((n, s) => n + (ctx.styleCounts[s] ?? 0), 0);
    fit *= 1 + Math.min(0.14, covered * 0.035);
  }
  if (node.fit.distances?.length) {
    const covered = node.fit.distances.reduce((n, d) => n + (ctx.distanceCounts[d] ?? 0), 0);
    fit *= 1 + Math.min(0.1, covered * 0.03);
  }
  if (node.fit.surfaces?.length) {
    const covered = node.fit.surfaces.reduce((n, s) => n + (ctx.surfaceCounts[s] ?? 0), 0);
    fit *= 1 + Math.min(0.1, covered * 0.04);
  }
  fit *= guardAffinity(node, ctx.meleeRatio);
  return clamp(fit, 0.7, 1.35);
}

function itemFit(node: RacePlanNode, ctx: RacePlanContext): number {
  const axes = node.fit.itemAxes;
  if (!axes?.length) return 1;
  const mean = axes.reduce((n, a) => n + ctx.itemProfile[a], 0) / axes.length;
  return clamp(0.88 + mean * 0.45, 0.8, 1.25);
}

function economyFit(node: RacePlanNode, ctx: RacePlanContext): number {
  if (!node.fit.economy?.length) return 1;
  return node.fit.economy.includes(ctx.economy) ? 1.2 : 0.9;
}

/**
 * Recent fights, translated into "which part of the race is actually being
 * played". Weights only; the system never fixes a weakness for the player.
 */
function combatFit(node: RacePlanNode, ctx: RacePlanContext): number {
  const rc = ctx.recentCombat;
  if (rc.sampleCount === 0) return 1;
  let fit = 1;
  const early = node.fit.phases.includes('START') || node.fit.phases.includes('POSITIONING');
  const late = node.fit.phases.includes('LATE') || node.fit.phases.includes('LAST_3F');

  if (rc.avgEndProgress < 0.55 && early) fit *= 1.2;
  if ((rc.avgEndProgress > 0.9 || rc.overtimeRate > 0.4) && late) fit *= 1.2;
  if (rc.frontlineLossBeforeMid > 0.5 && node.tags.includes('SURVIVAL')) fit *= 1.18;
  if (rc.enemyFrontlineHpAtLate > 0.6 && (node.tags.includes('PENETRATION') || node.tags.includes('EXECUTE'))) fit *= 1.22;
  if (rc.castsPerCombat < 2 && node.tags.includes('CAST')) fit *= 1.15;
  if (ctx.itemProfile.mana > 0.7 && node.tags.includes('CAST')) fit *= 0.85;
  return clamp(fit, 0.8, 1.25);
}

function traitFit(node: RacePlanNode, ctx: RacePlanContext): number {
  const styles = node.fit.styles ?? [];
  const active = styles.filter((s) => (ctx.activeTraits.get(s) ?? 0) >= 2).length;
  return clamp(1 + active * 0.1, 0.85, 1.2);
}

/**
 * Aptitude weighting, on the roster percentile rather than the letter.
 *
 * 132 of 145 units hold turf A or better, so weighting the letter would hand
 * almost everyone the same bonus and separate nothing. The percentile makes
 * "dirt A" (25 units) count and "turf A" (132 units) not.
 */
export function aptitudeFlavor(node: RacePlanNode, profile: HorseRacingProfile | undefined): number {
  const axes = node.fit.aptitudeAxes;
  if (!profile || !axes?.length) return 1;
  if (profile.confidence === 'VERY_LOW') return 1;
  const usable = axes.filter((a) => !(a.startsWith('stylePct') && profile.styleConfidence === 'LOW'));
  if (!usable.length) return 1;
  const mean = usable.reduce((n, a) => n + readPct(profile, a), 0) / usable.length;
  return clamp(1 + (mean - 0.5) * 0.3, 0.88, 1.15);
}

function themeFlavor(node: RacePlanNode, theme: G1Theme): number {
  let fit = 1;
  const surface = theme.surface === 'TURF' ? 'turf' : 'dirt';
  if (node.fit.surfaces?.includes(surface)) fit *= 1.08;
  const distance = { SPRINT: 'sprinter', MILE: 'miler', MIDDLE: 'middle', LONG: 'stayer' }[theme.distanceClass];
  if (node.fit.distances?.includes(distance as 'stayer')) fit *= 1.08;
  return clamp(fit, 0.9, 1.1);
}

/**
 * Keeps an offer from doubling down on what the augments already bought.
 * Capped at 0.75 so a themed board can still be handed its theme.
 */
function diversity(node: RacePlanNode, ctx: RacePlanContext): number {
  let fit = 1;
  if (ctx.itemProfile.attackSpeed > 0.7 && node.fit.itemAxes?.includes('attackSpeed')) fit *= 0.78;
  if (ctx.itemProfile.mana > 0.7 && node.fit.itemAxes?.includes('mana')) fit *= 0.8;
  if (ctx.itemProfile.tank > 0.7 && node.tags.includes('SURVIVAL')) fit *= 0.82;
  return clamp(fit, 0.75, 1.2);
}

export function scoreNode(
  node: RacePlanNode,
  ctx: RacePlanContext,
  opts: {
    themeId?: string;
    seenIds: ReadonlySet<string>;
    lobbyExposure: ReadonlyMap<string, number>;
    profile?: HorseRacingProfile;
    jitter: number;
  },
): ScoreBreakdown {
  const exposure = opts.lobbyExposure.get(node.id) ?? 0;
  const lobbyVariety = exposure <= 2 ? 1 : exposure === 3 ? 0.97 : exposure === 4 ? 0.94 : exposure === 5 ? 0.91 : 0.9;
  const antiRepeat = opts.seenIds.has(node.id) ? 0.25 : 1;

  const parts = {
    boardFit: boardFit(node, ctx),
    itemFit: itemFit(node, ctx),
    economyFit: economyFit(node, ctx),
    combatFit: combatFit(node, ctx),
    traitFit: traitFit(node, ctx),
    aptitudeFlavor: aptitudeFlavor(node, opts.profile),
    themeFlavor: themeFlavor(node, getG1Theme(opts.themeId)),
    diversity: diversity(node, ctx),
    antiRepeat,
    lobbyVariety,
  };

  const raw = node.baseWeight *
    parts.boardFit * parts.itemFit * parts.economyFit * parts.combatFit *
    parts.traitFit * parts.aptitudeFlavor * parts.themeFlavor *
    parts.diversity * parts.antiRepeat * parts.lobbyVariety *
    clamp(opts.jitter, 0.94, 1.06);

  return { ...parts, score: clamp(raw, 0.1, 4) };
}

/** Up to four reasons, at least one of them a caveat. */
export function buildReasons(
  node: RacePlanNode, ctx: RacePlanContext, themeId: string | undefined, unitId?: string,
): OfferReasonPayload[] {
  // Where the card's power lands. Always true, so a card is never reason-less
  // on an empty early board.
  const out: OfferReasonPayload[] = [{
    reason: 'NODE_TIMING',
    text: node.fit.phases.map((p) => RACE_PHASE_LABEL[p]).join(' · '),
  }];
  const rc = ctx.recentCombat;
  const axes = node.fit.itemAxes ?? [];

  if (axes.includes('attackSpeed') && ctx.itemProfile.attackSpeed > 0.3) out.push({ reason: 'ITEM_AS_HIGH', n: Math.round(ctx.itemProfile.attackSpeed * 3) });
  if (axes.includes('ad') && ctx.itemProfile.ad > 0.3) out.push({ reason: 'ITEM_AD_HIGH', n: Math.round(ctx.itemProfile.ad * 3) });
  if (axes.includes('ap') && ctx.itemProfile.ap > 0.3) out.push({ reason: 'ITEM_AP_HIGH', n: Math.round(ctx.itemProfile.ap * 3) });
  if (axes.includes('tank') && ctx.itemProfile.tank > 0.3) out.push({ reason: 'ITEM_TANK_HIGH' });
  if (axes.includes('mana') && ctx.itemProfile.mana > 0.3) out.push({ reason: 'ITEM_MANA_HIGH' });

  for (const style of node.fit.styles ?? []) {
    const n = ctx.styleCounts[style] ?? 0;
    if (n >= 2) {
      out.push({
        reason: (`STYLE_${style.toUpperCase()}` as OfferReasonPayload['reason']),
        n,
      });
      break;
    }
  }
  for (const distance of node.fit.distances ?? []) {
    const n = ctx.distanceCounts[distance] ?? 0;
    if (n >= 2) {
      const key = { sprinter: 'DISTANCE_SPRINT', miler: 'DISTANCE_MILE', middle: 'DISTANCE_MIDDLE', stayer: 'DISTANCE_LONG' }[distance];
      out.push({ reason: key as OfferReasonPayload['reason'], n });
      break;
    }
  }
  if (node.fit.surfaces?.includes('dirt') && ctx.surfaceCounts.dirt >= 1) {
    out.push({ reason: 'SURFACE_DIRT', n: ctx.surfaceCounts.dirt });
  }

  if (rc.sampleCount > 0) {
    if (rc.avgEndProgress > 0.9 || rc.overtimeRate > 0.4) out.push({ reason: 'OVERTIME_OFTEN' });
    else if (rc.avgEndProgress > 0.7) out.push({ reason: 'LONG_COMBAT', n: Math.round(rc.avgDuration * 10) / 10 });
    else out.push({ reason: 'FAST_COMBAT', n: Math.round(rc.avgDuration * 10) / 10 });
  }
  if (ctx.economy === 'FAST_8' || ctx.economy === 'FAST_9') out.push({ reason: 'HIGH_ECONOMY', n: ctx.gold });
  if (ctx.economy === 'REROLL') out.push({ reason: 'LOW_LEVEL_REROLL' });

  const theme = getG1Theme(themeId);
  if (unitId) {
    const profile = getRacingProfile(unitId);
    const course = profile?.courses.find((c) => c.id === theme.racecourse);
    if (course && course.rating !== 'WEAK') out.push({ reason: 'COURSE_AFFINITY', text: theme.courseNameKo });
  }

  // Always end on a caveat: an offer that only lists upsides is an advert.
  const caveats: OfferReasonPayload[] = [];
  if (rc.sampleCount > 0 && rc.frontlineLossBeforeMid > 0.4) caveats.push({ reason: 'EARLY_FRONTLINE_COLLAPSE' });
  if (rc.sampleCount > 0 && rc.enemyFrontlineHpAtLate > 0.55) caveats.push({ reason: 'ENEMY_TANK_WALL' });
  if (rc.sampleCount > 0 && rc.castsPerCombat < 2) caveats.push({ reason: 'CARRY_CAST_LATE' });
  if (!node.fit.roles?.length) caveats.push({ reason: 'PIVOT_ROOM' });
  if (ctx.streak <= -2) caveats.push({ reason: 'LOSS_STREAK' });

  return [...out.slice(0, 3), ...caveats.slice(0, 1)].slice(0, 4);
}
