/**
 * Battle-side Race Plan: which effects bind to the entry unit, and the two
 * accrued resources (각력 / 지구력) that pay out at a race phase.
 *
 * Everything a node does is an ordinary `EffectDef` applied through the existing
 * effect system. The only bespoke machinery here is the resource counter, which
 * needs to observe attacks, casts and hits and cannot be expressed as a trigger.
 */
import type { EffectDef } from '../types';
import type { PlayerState } from '../state';
import { findRacePlanNode } from './defs';
import { RACE_READ_BRANCHES } from './finishing-defs';
import { TRACK_STATE_EFFECTS } from './plan-defs';
import { entryIsFielded, fieldedEntryInstance, provisionalEntryInstance } from './entry';
import type { RaceCombatPhase, RacePlanBattleInput, RacePlanNode, TrackState } from './types';

/**
 * The nodes a player currently races with.
 *
 * Before the GⅠ entry they ride the board's best carry, so the plan chosen at
 * 2-5 is not inert for six rounds; after it, they belong to the registered unit.
 */
export function racePlanBattleInput(
  player: PlayerState,
  trackState: TrackState,
  provisionalInstanceId?: string,
): RacePlanBattleInput | undefined {
  const rp = player.racePlan;
  if (!rp) return undefined;
  const nodeIds = [rp.planId, rp.evolutionId, rp.finishingMoveId].filter(Boolean) as string[];
  if (!nodeIds.length) return undefined;

  const fielded = fieldedEntryInstance(player);
  if (rp.entryUnitDefId) {
    if (!fielded || !entryIsFielded(player)) return undefined;
    return {
      entryUnitDefId: rp.entryUnitDefId,
      entryInstanceId: fielded.instanceId,
      nodeIds,
      trackState,
    };
  }

  if (!provisionalInstanceId) return undefined;
  const unit = player.board.find((u) => u.instanceId === provisionalInstanceId);
  if (!unit) return undefined;
  return {
    entryUnitDefId: unit.unitDefId,
    entryInstanceId: unit.instanceId,
    // Only the plan and evolution ride a provisional carry; a finishing move
    // belongs to the unit it was chosen for.
    nodeIds: [rp.planId, rp.evolutionId].filter(Boolean) as string[],
    trackState,
  };
}

export function provisionalEntryId(
  state: Parameters<typeof provisionalEntryInstance>[0], player: PlayerState,
): string | undefined {
  return provisionalEntryInstance(state, player)?.instanceId;
}

/** Effects a node contributes at bind time, including going-dependent extras. */
export function nodeBattleEffects(node: RacePlanNode, trackState: TrackState): EffectDef[] {
  const effects = [...node.effects];
  if (node.id === 'RP_TRACK_GOING' || node.id === 'EV_TRACK_ADAPT') {
    const extra = TRACK_STATE_EFFECTS[trackState];
    // EV_TRACK_ADAPT carries 60% of the plan's going package: same total, later.
    effects.push(...(node.id === 'EV_TRACK_ADAPT' ? scaleEffects(extra, 0.6) : extra));
  }
  return effects;
}

function scaleEffects(effects: EffectDef[], factor: number): EffectDef[] {
  return effects.map((e) => (e.value === undefined ? e : { ...e, value: e.value * factor }));
}

export type ResourceState = {
  kind: 'LEG' | 'STAMINA';
  label: string;
  stacks: number;
  max: number;
  paid: boolean;
  nodeId: string;
};

/**
 * Tracks 각력/지구력 for one unit.
 *
 * Kept deliberately small: two resources for the whole system, never one per
 * node, so the gauge under a unit always means the same thing.
 */
export class RaceResourceTracker {
  readonly resources: ResourceState[] = [];
  private secondsAccrued = new Map<string, number>();

  constructor(nodeIds: string[]) {
    for (const id of nodeIds) {
      const node = findRacePlanNode(id);
      if (!node?.resource) continue;
      this.resources.push({
        kind: node.resource.kind,
        label: node.resource.label,
        stacks: 0,
        max: node.resource.max,
        paid: false,
        nodeId: node.id,
      });
    }
  }

  get active(): boolean { return this.resources.length > 0; }

  /** Highest fill ratio across tracked resources, for the on-unit gauge. */
  gauge(): { kind: 'LEG' | 'STAMINA'; stacks: number; max: number } | null {
    if (!this.resources.length) return null;
    const best = this.resources.reduce((a, b) => (b.stacks / b.max > a.stacks / a.max ? b : a));
    return { kind: best.kind, stacks: best.stacks, max: best.max };
  }

  private gain(resource: ResourceState, amount: number): number {
    if (amount <= 0 || resource.paid) return 0;
    const before = resource.stacks;
    resource.stacks = Math.min(resource.max, resource.stacks + amount);
    return resource.stacks - before;
  }

  /** Returns effects to apply now, for resources that pay out continuously. */
  onTick(elapsed: number, phase: RaceCombatPhase): EffectDef[] {
    if (phase === 'OVERTIME') return [];
    const out: EffectDef[] = [];
    for (const resource of this.resources) {
      const node = findRacePlanNode(resource.nodeId);
      const spec = node?.resource;
      if (!spec?.gainPerSeconds) continue;
      const key = resource.nodeId;
      const due = Math.floor(elapsed / spec.gainPerSeconds);
      const had = this.secondsAccrued.get(key) ?? 0;
      if (due <= had) continue;
      this.secondsAccrued.set(key, due);
      const gained = this.gain(resource, due - had);
      if (gained && !spec.payoutPhase) {
        for (let i = 0; i < gained; i += 1) out.push(...spec.perStack);
      }
    }
    return out;
  }

  onEvent(kind: 'ATTACK' | 'CAST' | 'HIT_TAKEN'): EffectDef[] {
    const out: EffectDef[] = [];
    for (const resource of this.resources) {
      const spec = findRacePlanNode(resource.nodeId)?.resource;
      if (!spec) continue;
      const amount =
        kind === 'ATTACK' ? spec.gainOnAttack ?? 0
        : kind === 'CAST' ? spec.gainOnCast ?? 0
        : spec.gainOnHitTaken ?? 0;
      const gained = this.gain(resource, amount);
      if (gained && !spec.payoutPhase) {
        for (let i = 0; i < gained; i += 1) out.push(...spec.perStack);
      }
    }
    return out;
  }

  /** Payout at a phase boundary. Returns the effects and what to log. */
  onPhase(phase: RaceCombatPhase): Array<{ nodeId: string; label: string; stacks: number; effects: EffectDef[] }> {
    const out: Array<{ nodeId: string; label: string; stacks: number; effects: EffectDef[] }> = [];
    for (const resource of this.resources) {
      const spec = findRacePlanNode(resource.nodeId)?.resource;
      if (!spec?.payoutPhase || resource.paid || spec.payoutPhase !== phase) continue;
      if (resource.stacks <= 0) { resource.paid = true; continue; }
      const effects: EffectDef[] = [];
      for (let i = 0; i < resource.stacks; i += 1) effects.push(...spec.perStack);
      out.push({ nodeId: resource.nodeId, label: spec.label, stacks: resource.stacks, effects });
      resource.paid = true;
      if (spec.consume) resource.stacks = 0;
    }
    return out;
  }
}

/**
 * FM_RACE_READ, resolved once at LATE.
 *
 * Both branches are printed on the card, and the check is a single explicit
 * comparison — the deleted v1 design silently topped up "whichever stat is
 * lowest", which could not be written into a tooltip or reproduced in a test.
 */
export function raceReadBranch(alliesAlive: number, enemiesAlive: number): {
  branch: 'HOLD' | 'PUSH'; effects: EffectDef[];
} {
  return enemiesAlive > alliesAlive
    ? { branch: 'HOLD', effects: RACE_READ_BRANCHES.hold }
    : { branch: 'PUSH', effects: RACE_READ_BRANCHES.push };
}
