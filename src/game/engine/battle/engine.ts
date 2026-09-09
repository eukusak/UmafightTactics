/**
 * Deterministic fixed-timestep battle simulation (spec §14).
 *
 * Pure TypeScript: no Phaser, no DOM, no Math.random. The renderer reads
 * snapshots and interpolates; it never drives the simulation.
 */
import {
  BATTLE_MAX_SECONDS, BATTLE_NORMAL_SECONDS, BATTLE_TICK_MS, MANA_FROM_DAMAGE_CAP,
  MANA_LOCK_AFTER_CAST_SECONDS, ROLE_ATTACK_MANA, ROLE_MANA_REGEN, OVERTIME_ATTACK_SPEED_MULT,
  OVERTIME_CC_MULT, OVERTIME_DAMAGE_MULT,
  fighterAttackSpeed,
} from '../constants';
import { getItem } from '../items/item-defs';
import { activeTierIndex, getTrait } from '../traits/trait-defs';
import { getAugment } from '../augments/augment-defs';
import type { Rng } from '../rng';
import type { BattleStats, EffectDef, StatusKind, TraitId } from '../types';
import {
  addModifier, addShield, cleanupExpired, heal, isSilenced, isStunned, isTargetable,
  makeCombatUnit, mitigationMultiplier, resistFor, stat, totalShield, hasStatus,
  type CombatUnit, type Team,
} from './combat-unit';
import {
  accumulateAura, applyEffect, isAuraKind, resolveTargets, triggerHolds,
  type EffectContext, type TriggerEvent,
} from './effects';
import {
  findAttackPosition, findPath, hexDistance, hexKey, inBounds, neighbours, teamKey, toBattleCell,
  type Hex, type KeyFn,
} from './hex';
import { emptyAura } from './combat-unit';
import { skillDuration, skillTimeline, skillWindup } from './skill-timeline';

export type BattleSideInput = {
  playerId: string;
  units: Array<{
    instanceId: string;
    unitDefId: string;
    star: 1 | 2 | 3;
    items: string[];
    position: Hex;
    /** Traits granted outside the unit definition (이중 적성 augment). */
    extraTraits?: TraitId[];
    /** Flat multiplier on hp / attack damage; PvE encounters scale by stage. */
    statScale?: number;
  }>;
  augments: string[];
  tacticianItems: string[];
};

export type BattleResult = {
  winner: 'A' | 'B' | null;
  survivorsA: number;
  survivorsB: number;
  durationSeconds: number;
  wentToOvertime: boolean;
  events: BattleEvent[];
};

export type BattleEvent =
  | { t: number; type: 'ATTACK_START'; source: string; target: string; releaseAt: number; impactAt: number; ranged: boolean }
  | { t: number; type: 'PROJECTILE'; source: string; target: string; impactAt: number }
  | { t: number; type: 'DAMAGE'; source: string; target: string; damage: number; absorbed: number; isSkill: boolean }
  | { t: number; type: 'ATTACK'; source: string; target: string; damage: number; crit: boolean }
  | { t: number; type: 'CAST'; source: string; skill: string; target?: string; releaseAt?: number; endAt?: number }
  | { t: number; type: 'SKILL_EFFECT'; source: string; targets: string[]; kind: EffectDef['kind']; radius: number }
  | { t: number; type: 'CAST_CANCEL'; source: string }
  | { t: number; type: 'DEATH'; unit: string }
  | { t: number; type: 'REVIVE'; unit: string }
  | { t: number; type: 'OVERTIME' }
  | { t: number; type: 'END'; winner: 'A' | 'B' | null };

/** Renderable snapshot of a single simulation step. */
export type BattleFrame = {
  t: number;
  overtime: boolean;
  units: Array<{
    id: string; team: Team; unitDefId: string; star: 1 | 2 | 3;
    q: number; r: number; fromQ: number | null; fromR: number | null; progress: number;
    hp: number; maxHp: number; shield: number; mana: number; maxMana: number;
    alive: boolean; casting: boolean; statuses: StatusKind[];
  }>;
  events: BattleEvent[];
};

export type BattleOptions = {
  /** Record a frame per tick for playback. Headless AI battles leave this off. */
  recordFrames?: boolean;
  maxSeconds?: number;
  stage?: number;
};

/** Maximum nesting for damage that itself causes damage. */
const MAX_DAMAGE_DEPTH = 4;

type EffectBinding = {
  effect: EffectDef;
  index: number;
  sourceKey: string;
  /** Star-scaled magnitude for skill effects, 1 for everything else. */
  power: number;
};

export class BattleEngine {
  readonly units: CombatUnit[] = [];
  private readonly events: BattleEvent[] = [];
  readonly frames: BattleFrame[] = [];
  private time = 0;
  private overtimeApplied = false;
  /** Which team resolves first each tick. Seeded once so mirror matches are fair. */
  private readonly firstTeam: Team;
  private finished = false;
  private recordedEventCount = 0;
  private winner: 'A' | 'B' | null = null;

  /** Passive effect bindings per unit id, rebuilt once at combat start. */
  private readonly bindings = new Map<string, EffectBinding[]>();
  private readonly periodicNext = new Map<string, number>();
  /** Cooldown clocks for event-triggered effects that declare an `interval`. */
  private readonly triggerReadyAt = new Map<string, number>();
  /** Guards against damage -> on-hit-damage -> damage ping-pong between units. */
  private damageDepth = 0;
  private attacks: Array<{ source: string; target: string; releaseAt: number; impactAt: number; ranged: boolean; released: boolean }> = [];
  private readonly ctx: EffectContext;
  private casts: Array<{ source: string; target: string | null; start: number; end: number; timeline: ReturnType<typeof skillTimeline> }> = [];

  constructor(
    sideA: BattleSideInput,
    sideB: BattleSideInput,
    private readonly rng: Rng,
    private readonly options: BattleOptions = {},
  ) {
    this.firstTeam = rng.bool(0.5) ? 'A' : 'B';
    this.spawn(sideA, 'A');
    this.spawn(sideB, 'B');
    this.ctx = {
      now: 0,
      overtime: false,
      units: this.units,
      dealDamage: (s, t, amount, type, isSkill) => this.dealDamage(s, t, amount, type ?? 'MAGIC', isSkill),
      applyStatus: (s, t, e) => this.applyStatus(s, t, e),
      dash: (u, t, d) => this.dash(u, t, d),
      summon: (owner, power, duration) => this.summon(owner, power, duration),
    };
    this.prepare(sideA, 'A');
    this.prepare(sideB, 'B');
  }

  // ------------------------------------------------------------------ setup
  private spawn(side: BattleSideInput, team: Team): void {
    for (const u of side.units) {
      const cell: Hex = toBattleCell(u.position, team);
      const unit = makeCombatUnit({
        id: `${side.playerId}#${u.instanceId}`,
        instanceId: u.instanceId,
        unitDefId: u.unitDefId,
        star: u.star,
        items: u.items,
        extraTraits: u.extraTraits ?? [],
        team,
        cell,
      });
      if (u.statScale && u.statScale !== 1) {
        unit.base.hp *= u.statScale;
        unit.base.attackDamage *= u.statScale;
        unit.maxHp = unit.base.hp;
        unit.hp = unit.maxHp;
      }
      this.units.push(unit);
      if (unit.role === 'BRUISER') addModifier(unit, 'attackSpeed', fighterAttackSpeed(this.options.stage ?? 2), true, 0, 0);
    }
  }

  /** Counts trait members on one side; emblem items already folded into traits. */
  private traitCounts(team: Team): Map<TraitId, number> {
    const counts = new Map<TraitId, number>();
    const seenByTrait = new Map<TraitId, Set<string>>();
    for (const u of this.units) {
      if (u.team !== team) continue;
      for (const t of u.traits) {
        // Distinct unit *kinds* count once each, as in the source game.
        const seen = seenByTrait.get(t) ?? new Set<string>();
        if (seen.has(u.unitDefId)) continue;
        seen.add(u.unitDefId);
        seenByTrait.set(t, seen);
        counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    }
    return counts;
  }

  private prepare(side: BattleSideInput, team: Team): void {
    const counts = this.traitCounts(team);
    const teamUnits = this.units.filter((u) => u.team === team);

    for (const unit of teamUnits) {
      const list: EffectBinding[] = [];

      // --- traits: only tiers whose threshold the side actually reached
      for (const [traitId, count] of counts) {
        const def = getTrait(traitId);
        const tierIdx = activeTierIndex(def, count);
        if (tierIdx < 0) continue;
        const tier = def.tiers[tierIdx];
        const appliesToAll = tier.effects.some((e) => e.target === 'ALL_ALLIES');
        // A trait's own effects only reach units carrying the trait, unless the
        // effect explicitly targets the whole team.
        if (!unit.traits.includes(traitId) && !appliesToAll) continue;
        tier.effects.forEach((effect, i) => {
          if (!unit.traits.includes(traitId) && effect.target !== 'ALL_ALLIES') return;
          list.push({ effect, index: i, sourceKey: `trait:${traitId}:${tierIdx}`, power: 1 });
        });
      }

      // --- items on this unit
      unit.items.forEach((itemId, slot) => {
        getItem(itemId).effects.forEach((effect, i) => {
          list.push({ effect, index: i, sourceKey: `item:${itemId}:${slot}`, power: 1 });
        });
      });

      // --- tactician items apply to the whole side
      for (const itemId of side.tacticianItems) {
        getItem(itemId).effects.forEach((effect, i) => {
          list.push({ effect, index: i, sourceKey: `tactician:${itemId}`, power: 1 });
        });
      }

      // --- augments
      for (const augId of side.augments) {
        const aug = getAugment(augId);
        aug.teamEffects.forEach((effect, i) => {
          // Trait-scoped augments only touch units with that trait.
          const scoped = effect.tag?.startsWith('TRAIT:');
          if (scoped) {
            const need = effect.tag!.slice(6) as TraitId;
            if (!unit.traits.includes(need)) return;
          }
          list.push({ effect, index: i, sourceKey: `augment:${augId}`, power: 1 });
        });
      }

      this.bindings.set(unit.id, list);
    }
  }

  // ------------------------------------------------------------------- loop
  /** Runs the whole battle and returns the result. */
  run(): BattleResult {
    this.fire('COMBAT_START');
    if (this.options.recordFrames) this.recordFrame();
    const maxSeconds = this.options.maxSeconds ?? BATTLE_MAX_SECONDS;
    const dt = BATTLE_TICK_MS / 1000;

    while (!this.finished && this.time < maxSeconds) {
      this.step(dt);
    }
    if (!this.finished) {
      this.finish(null);
      if (this.options.recordFrames) {
        this.frames.at(-1)?.events.push(...this.events.slice(this.recordedEventCount));
        this.recordedEventCount = this.events.length;
      }
    }

    const survivorsA = this.units.filter((u) => u.team === 'A' && u.alive).length;
    const survivorsB = this.units.filter((u) => u.team === 'B' && u.alive).length;
    return {
      winner: this.winner,
      survivorsA,
      survivorsB,
      durationSeconds: Math.round(this.time * 100) / 100,
      wentToOvertime: this.overtimeApplied,
      events: this.events,
    };
  }

  private step(dt: number): void {
    this.time += dt;
    this.ctx.now = this.time;

    if (!this.overtimeApplied && this.time >= BATTLE_NORMAL_SECONDS) this.enterOvertime();

    // Recompute aura totals and conditional passives before anyone acts.
    for (const unit of this.units) {
      if (!unit.alive) continue;
      cleanupExpired(unit, this.time);
      this.recomputeAura(unit);
      if (this.time >= unit.manaLockUntil) {
        unit.mana = Math.min(stat(unit, 'maxMana', this.time), unit.mana + ROLE_MANA_REGEN[unit.role] * dt);
      }
    }

    this.tickStatuses();
    this.tickPeriodics();
    this.resolveCasts();
    this.resolveAttacks();

    // Deterministic act order: team then id.
    const teamRank = (t: Team): number => (t === this.firstTeam ? 0 : 1);
    const order = this.units.slice().sort(
      (a, b) => teamRank(a.team) - teamRank(b.team) || a.id.localeCompare(b.id),
    );
    for (const unit of order) {
      if (unit.alive) this.act(unit, dt);
      else this.tryRevive(unit);
    }

    this.checkEnd();
    if (this.options.recordFrames) this.recordFrame();
  }

  private recomputeAura(unit: CombatUnit): void {
    const keepCcImmune = unit.aura.ccImmuneUntil;
    const keepUntargetable = unit.aura.untargetableUntil;
    unit.aura = emptyAura();
    unit.aura.ccImmuneUntil = keepCcImmune;
    unit.aura.untargetableUntil = keepUntargetable;

    const target = unit.targetId ? this.byId(unit.targetId) : null;
    for (const entry of unit.timedEffects) {
      if (entry.expiresAt > this.time && triggerHolds(unit, entry.effect.trigger, this.ctx, 'RECOMPUTE', target)) accumulateAura(unit, entry.effect);
    }
    for (const b of this.bindings.get(unit.id) ?? []) {
      if (!isAuraKind(b.effect.kind)) continue;
      const gate = b.effect.trigger;
      // Aura effects with an event trigger are handled when that event fires.
      if (gate && !['ALWAYS', 'HP_BELOW', 'HP_ABOVE', 'TARGET_HP_BELOW', 'AFTER_SECONDS',
        'IN_FRONT_ROWS', 'IN_BACK_ROWS', 'ADJACENT_ALLIES_AT_LEAST', 'NO_ADJACENT_ALLIES'].includes(gate.when)) {
        continue;
      }
      if (!triggerHolds(unit, gate, this.ctx, 'RECOMPUTE', target)) continue;
      if (b.effect.tag === 'AT_MAX_STACKS') {
        const key = Object.keys(unit.stacks).find((k) => k.startsWith('count:'));
        if (!key || (unit.stacks[key] ?? 0) < 12) continue;
      }
      accumulateAura(unit, b.effect);
    }
    // 경주장 석갑: resistance scales with how many enemies target this unit.
    const perAttacker = (this.bindings.get(unit.id) ?? []).filter((b) => b.effect.tag === 'PER_ATTACKER');
    if (perAttacker.length) {
      const n = unit.attackedBy.size;
      for (const b of perAttacker) {
        addModifier(unit, b.effect.stat as keyof BattleStats, (b.effect.value ?? 0) * n, false, 0.1, this.time);
      }
    }
  }

  private act(unit: CombatUnit, dt: number): void {
    unit.attackCooldown -= dt;
    if (isStunned(unit, this.time)) return;
    // A reserved destination remains occupied while the body travels to it.
    if (unit.moveFrom) {
      this.advanceMove(unit, dt);
      return;
    }
    if (this.casts.some((cast) => cast.source === unit.id)) return;
    if (this.attacks.some((a) => a.source === unit.id && !a.released)) return;

    // Cast as soon as mana fills, unless silenced or mana-locked.
    const maxMana = stat(unit, 'maxMana', this.time);
    if (unit.mana >= maxMana && !isSilenced(unit, this.time) && this.time >= unit.manaLockUntil) {
      this.cast(unit);
      return;
    }

    const target = this.acquireTarget(unit);
    if (!target) return;

    const range = stat(unit, 'attackRange', this.time);
    const dist = hexDistance(unit.cell, target.cell);

    if (dist <= range) {
      unit.blockedSince = -1;
      const disarmed = unit.statuses.some((s) => s.kind === 'DISARM' && s.expiresAt > this.time);
      if (unit.attackCooldown <= 0 && !disarmed) {
        this.beginAttack(unit, target);
        unit.attackCooldown = 1 / Math.max(0.1, stat(unit, 'attackSpeed', this.time));
      }
      return;
    }

    this.moveToward(unit, target, range, dt);
  }

  // --------------------------------------------------------------- targeting
  /** Spec §14.2 target priority. */
  private acquireTarget(unit: CombatUnit): CombatUnit | null {
    const taunt = unit.statuses.find((s) => s.kind === 'TAUNT' && s.expiresAt > this.time);
    if (taunt) {
      const tauntSource = this.byId(taunt.sourceId);
      if (tauntSource && tauntSource.alive && isTargetable(tauntSource, this.time)) {
        this.setTarget(unit, tauntSource);
        return tauntSource;
      }
    }

    const current = unit.targetId ? this.byId(unit.targetId) : null;
    const validCurrent = current?.alive && isTargetable(current, this.time) ? current : null;
    const range = stat(unit, 'attackRange', this.time);
    if (validCurrent && hexDistance(unit.cell, validCurrent.cell) <= range) return validCurrent;

    const foes = this.units.filter(
      (u) => u.team !== unit.team && u.alive && isTargetable(u, this.time),
    );
    if (!foes.length) return null;
    // Keep chasing only when there is no immediately attackable replacement.
    if (validCurrent && !foes.some((foe) => hexDistance(unit.cell, foe.cell) <= range)) return validCurrent;

    foes.sort((a, b) => {
      const da = hexDistance(unit.cell, a.cell);
      const db = hexDistance(unit.cell, b.cell);
      if (da !== db) return da - db;
      const rolePriority = Number(b.role === 'TANK') - Number(a.role === 'TANK');
      if (rolePriority) return rolePriority;
      const ra = a.hp / a.maxHp;
      const rb = b.hp / b.maxHp;
      if (ra !== rb) return ra - rb;
      return a.id.localeCompare(b.id);
    });
    this.setTarget(unit, foes[0]);
    return foes[0];
  }

  private setTarget(unit: CombatUnit, target: CombatUnit): void {
    if (unit.targetId === target.id) return;
    if (unit.targetId) this.byId(unit.targetId)?.attackedBy.delete(unit.id);
    unit.targetId = target.id;
    unit.attacksOnCurrentTarget = 0;
    target.attackedBy.add(unit.id);
  }

  // ------------------------------------------------------------------ moving
  private occupied(exclude?: string): Set<string> {
    const s = new Set<string>();
    for (const u of this.units) {
      if (!u.alive || u.id === exclude) continue;
      s.add(hexKey(u.cell));
    }
    return s;
  }

  private moveToward(unit: CombatUnit, target: CombatUnit, range: number, dt: number): void {
    const blocked = this.occupied(unit.id);
    const keyOf = this.keyFor(unit);
    const goal = findAttackPosition(unit.cell, target.cell, range, blocked, keyOf);
    if (!goal) {
      // Fully boxed in: look for a different target next tick.
      if (unit.blockedSince < 0) unit.blockedSince = this.time;
      if (this.time - unit.blockedSince > 0.5) {
        unit.targetId = null;
        unit.blockedSince = -1;
      }
      return;
    }

    const path = findPath(unit.cell, goal, blocked, keyOf);
    if (!path.length) {
      if (unit.blockedSince < 0) unit.blockedSince = this.time;
      if (this.time - unit.blockedSince > 0.5) { unit.targetId = null; unit.blockedSince = -1; }
      return;
    }
    unit.blockedSince = -1;

    const next = path[0];
    if (!next || this.occupied(unit.id).has(hexKey(next))) return;
    unit.moveFrom = { ...unit.cell };
    unit.cell = { ...next };
    unit.moveProgress = 0;
    this.advanceMove(unit, dt);
  }

  private advanceMove(unit: CombatUnit, dt: number): void {
    unit.moveProgress = Math.min(1, unit.moveProgress + stat(unit, 'moveSpeedHexPerSec', this.time) * dt);
    if (unit.moveProgress >= 1) {
      unit.moveFrom = null;
      unit.moveProgress = 0;
    }
  }

  /** Tie-break key in this unit's own frame, so both teams behave identically. */
  private keyFor(unit: CombatUnit): KeyFn {
    return (h: Hex) => teamKey(h, unit.team);
  }

  private dash(unit: CombatUnit, target: CombatUnit, maxDistance: number): void {
    const blocked = this.occupied(unit.id);
    const keyOf = this.keyFor(unit);
    let best: Hex | null = null;
    let bestDist = Infinity;
    let bestKey = '';
    for (const cand of this.cellsWithin(target.cell, 1, keyOf)) {
      if (blocked.has(hexKey(cand))) continue;
      const d = hexDistance(unit.cell, cand);
      if (d > maxDistance) continue;
      const candKey = keyOf(cand);
      if (d < bestDist || (d === bestDist && best !== null && candKey < bestKey)) {
        bestDist = d; best = cand; bestKey = candKey;
      }
    }
    if (best) {
      unit.moveFrom = unit.cell;
      unit.cell = best;
      unit.moveProgress = 0;
    }
  }

  private cellsWithin(centre: Hex, radius: number, keyOf: KeyFn = hexKey): Hex[] {
    const out: Hex[] = [];
    const seen = new Set<string>();
    let frontier: Hex[] = [centre];
    seen.add(hexKey(centre));
    for (let step = 0; step <= radius; step += 1) {
      const next: Hex[] = [];
      for (const h of frontier) {
        if (inBounds(h)) out.push(h);
        for (const nb of neighbours(h)) {
          const k = hexKey(nb);
          if (seen.has(k) || !inBounds(nb)) continue;
          seen.add(k);
          next.push(nb);
        }
      }
      frontier = next;
    }
    return out.sort((a, b) => keyOf(a).localeCompare(keyOf(b)));
  }

  // ----------------------------------------------------------------- attacks
  private beginAttack(unit: CombatUnit, target: CombatUnit): void {
    const interval = 1 / Math.max(.1, stat(unit, 'attackSpeed', this.time));
    const windup = Math.min(.24, Math.max(.06, interval * .22));
    const ranged = stat(unit, 'attackRange', this.time) > 1;
    const releaseAt = this.time + windup;
    const impactAt = releaseAt + (ranged ? Math.min(.35, .065 * hexDistance(unit.cell, target.cell)) : 0);
    this.attacks.push({ source: unit.id, target: target.id, releaseAt, impactAt, ranged, released: false });
    this.events.push({ t: this.time, type: 'ATTACK_START', source: unit.id, target: target.id, releaseAt, impactAt, ranged });
  }

  private resolveAttacks(): void {
    const pending = this.attacks;
    this.attacks = [];
    for (const attack of pending) {
      const source = this.byId(attack.source);
      const target = this.byId(attack.target);
      if (!source || !target?.alive || !isTargetable(target, this.time)) continue;
      if (!attack.released) {
        if (!source.alive || isStunned(source, this.time) || source.statuses.some((s) => s.kind === 'DISARM' && s.expiresAt > this.time)) continue;
        if (this.time < attack.releaseAt) { this.attacks.push(attack); continue; }
        if (!attack.ranged && hexDistance(source.cell, target.cell) > stat(source, 'attackRange', this.time)) continue;
        attack.released = true;
        if (attack.ranged) this.events.push({ t: this.time, type: 'PROJECTILE', source: source.id, target: target.id, impactAt: Math.max(this.time, attack.impactAt) });
      }
      if (this.time + 1e-8 < attack.impactAt) this.attacks.push(attack);
      else this.basicAttack(source, target);
    }
  }

  private basicAttack(unit: CombatUnit, target: CombatUnit): void {
    unit.attackCount += 1;
    if (unit.lastTargetId === target.id) unit.attacksOnCurrentTarget += 1;
    else { unit.attacksOnCurrentTarget = 1; unit.lastTargetId = target.id; }

    const critChance = stat(unit, 'critChance', this.time) + unit.aura.critChance;
    const isCrit = this.rng.bool(Math.min(1, critChance));
    let damage = stat(unit, 'attackDamage', this.time);
    if (isCrit) {
      damage *= stat(unit, 'critMultiplier', this.time) + unit.aura.critDamage
        + this.excessCritDamage(unit, critChance);
    }

    const dealt = this.dealDamage(unit, target, damage, 'PHYSICAL', false);
    this.events.push({ t: this.time, type: 'ATTACK', source: unit.id, target: target.id, damage: dealt, crit: isCrit });

    if (this.time >= unit.manaLockUntil) {
      unit.mana = Math.min(stat(unit, 'maxMana', this.time), unit.mana + ROLE_ATTACK_MANA[unit.role]);
    }
    this.fireFor(unit, 'ON_ATTACK', target);
  }

  /** 결승선의 일격 converts crit chance beyond 100% into crit damage. */
  private excessCritDamage(unit: CombatUnit, critChance: number): number {
    const hasConverter = (this.bindings.get(unit.id) ?? []).some((b) => b.effect.tag === 'CONVERT_EXCESS_CRIT');
    if (!hasConverter || critChance <= 1) return 0;
    return (critChance - 1) * 100 * 0.005;
  }

  private dealDamage(
    source: CombatUnit, target: CombatUnit, rawAmount: number,
    type: NonNullable<EffectDef['damageType']>, isSkill: boolean,
  ): number {
    if (!target.alive || rawAmount <= 0) return 0;
    // Reflect-style effects can chain: A's on-hit damage triggers B's, and back.
    // The per-effect cooldown normally stops this; the depth cap is the backstop.
    if (this.damageDepth >= MAX_DAMAGE_DEPTH) return 0;
    this.damageDepth += 1;
    try {
      return this.resolveDamage(source, target, rawAmount, type, isSkill);
    } finally {
      this.damageDepth -= 1;
    }
  }

  private resolveDamage(
    source: CombatUnit, target: CombatUnit, rawAmount: number,
    type: NonNullable<EffectDef['damageType']>, isSkill: boolean,
  ): number {

    let amount = rawAmount;
    if (isSkill) {
      amount *= source.skillMultiplier;
      amount *= 1 + source.aura.skillDamageAmp;
    }
    amount *= 1 + source.aura.damageAmp;
    // 거인 추월자: extra amp against big targets.
    if ((this.bindings.get(source.id) ?? []).some((b) => b.effect.tag === 'TARGET_MAXHP_AT_LEAST_1600') && target.maxHp >= 1600) {
      const bonus = (this.bindings.get(source.id) ?? []).find((b) => b.effect.tag === 'TARGET_MAXHP_AT_LEAST_1600');
      amount *= 1 + (bonus?.effect.value ?? 0);
    }
    if (this.overtimeApplied) amount *= OVERTIME_DAMAGE_MULT;

    const preMitigation = amount;
    amount *= mitigationMultiplier(resistFor(target, type, this.time));
    amount *= 1 - Math.min(0.9, target.aura.damageReduction);

    // Execution thresholds bypass the remaining health.
    const execute = Math.max(source.aura.executeThreshold, 0);
    if (execute > 0 && target.hp / target.maxHp < execute) {
      amount = Math.max(amount, target.hp + totalShield(target, this.time));
    }

    // Shields soak first; 국제파 amplifies damage against them.
    let remaining = amount;
    const shieldAmp = 1 + source.aura.shieldDamageAmp;
    for (const shield of target.shields) {
      if (shield.expiresAt <= this.time || remaining <= 0) continue;
      const applied = Math.min(shield.amount, remaining * shieldAmp);
      shield.amount -= applied;
      remaining -= applied / shieldAmp;
    }

    const postMitigation = Math.max(0, remaining);
    const visibleDamage = Math.min(target.hp, postMitigation);
    target.hp -= postMitigation;
    this.events.push({ t: this.time, type: 'DAMAGE', source: source.id, target: target.id, damage: Math.max(0, visibleDamage), absorbed: Math.max(0, amount - remaining), isSkill });

    // Spec §14.6 — mana from taking damage.
    if (target.role === 'TANK' && this.time >= target.manaLockUntil) {
      const gained = Math.min(MANA_FROM_DAMAGE_CAP, preMitigation * 0.01 + postMitigation * 0.07);
      target.mana = Math.min(stat(target, 'maxMana', this.time), target.mana + gained);
    }

    // Omnivamp.
    if (source.aura.omnivamp > 0 && postMitigation > 0) {
      const healed = heal(source, postMitigation * source.aura.omnivamp, this.time);
      const share = (this.bindings.get(source.id) ?? []).find((b) => b.effect.tag === 'SHARE_VAMP_TO_LOWEST');
      if (share && healed > 0) {
        const ally = resolveTargets(this.ctx, source, 'LOWEST_HP_ALLY', undefined, null)[0];
        if (ally && ally.id !== source.id) heal(ally, healed * (share.effect.value ?? 0), this.time);
      }
    }

    source.recentDamageTo.set(target.id, (source.recentDamageTo.get(target.id) ?? 0) + postMitigation);
    if (postMitigation > 0) this.fireFor(target, 'ON_HIT_TAKEN', source);

    if (target.hp <= 0) this.kill(target, source);
    return postMitigation;
  }

  private kill(target: CombatUnit, source: CombatUnit): void {
    // 황금세대 6: survive one lethal blow at 1 hp.
    if (target.stacks['surviveLethal'] === 1) {
      target.stacks['surviveLethal'] = 0;
      target.hp = 1;
      target.aura.untargetableUntil = Math.max(target.aura.untargetableUntil, this.time + 1);
      return;
    }

    target.alive = false;
    this.casts = this.casts.filter((cast) => cast.source !== target.id);
    target.hp = 0;
    target.diedAt = this.time;
    target.shields = [];
    for (const u of this.units) {
      if (u.targetId === target.id) u.targetId = null;
      u.attackedBy.delete(target.id);
    }
    this.events.push({ t: this.time, type: 'DEATH', unit: target.id });

    this.fireFor(target, 'ON_DEATH', source);
    this.fireFor(source, 'ON_KILL', target);
    // Everyone on the killer's side who damaged the victim gets assist credit.
    for (const u of this.units) {
      if (u.team !== source.team || u.id === source.id || !u.alive) continue;
      if ((u.recentDamageTo.get(target.id) ?? 0) > 0) this.fireFor(u, 'ON_ASSIST', target);
    }

    if (target.stacks['revive:pct'] > 0) {
      target.reviveAt = this.time + (target.stacks['revive:delay'] ?? 1.5);
    }
  }

  private tryRevive(unit: CombatUnit): void {
    if (unit.reviveAt === null || this.time < unit.reviveAt) return;
    const pct = unit.stacks['revive:pct'] ?? 0;
    unit.reviveAt = null;
    unit.stacks['revive:pct'] = 0;
    if (pct <= 0) return;
    // Only revive when the cell is still free.
    if (this.occupied(unit.id).has(hexKey(unit.cell))) return;
    unit.alive = true;
    unit.hp = unit.maxHp * pct;
    unit.mana = 0;
    unit.statuses = [];
    this.events.push({ t: this.time, type: 'REVIVE', unit: unit.id });
  }

  // ------------------------------------------------------------------- casts
  private cast(unit: CombatUnit): void {
    const target = this.acquireTarget(unit);
    unit.mana = 0;
    const end = this.time + skillDuration(unit.skill);
    unit.manaLockUntil = Math.max(end, this.time + MANA_LOCK_AFTER_CAST_SECONDS);

    const selectionRadius = unit.skill.effects.find(e => e.target === unit.skill.targetRule && e.radius)?.radius;
    const skillTargets = resolveTargets(this.ctx, unit, unit.skill.targetRule, selectionRadius, target);
    const primary = skillTargets[0] ?? target;
    this.events.push({ t: this.time, type: 'CAST', source: unit.id, skill: unit.skill.id, target: primary?.id,
      releaseAt: this.time + skillWindup(unit.skill), endAt: end });
    this.casts.push({ source: unit.id, target: primary?.id ?? null, start: this.time, end, timeline: skillTimeline(unit.skill) });
    this.fireFor(unit, 'ON_CAST', primary);
    this.resolveCasts();
  }

  private resolveCasts(): void {
    const pending = this.casts;
    this.casts = [];
    for (const cast of pending) {
      const unit = this.byId(cast.source);
      if (!unit?.alive) continue;
      if (isStunned(unit, this.time)) {
        this.events.push({ t: this.time, type: 'CAST_CANCEL', source: unit.id });
        continue;
      }
      let primary = cast.target ? this.byId(cast.target) : null;
      if (!primary?.alive || (primary.team !== unit.team && !isTargetable(primary, this.time))) {
        primary = resolveTargets(this.ctx, unit, unit.skill.targetRule, undefined, this.acquireTarget(unit))[0] ?? null;
        cast.target = primary?.id ?? null;
      }
      while (unit.alive && cast.timeline.length && cast.start + cast.timeline[0].at <= this.time + 1e-8) {
        const { effect, index } = cast.timeline.shift()!;
        const lockPrimary = effect.target === unit.skill.targetRule && !['SELF', 'ALL_ALLIES', 'ALL_ENEMIES'].includes(effect.target ?? '');
        const targets = resolveTargets(this.ctx, unit, lockPrimary ? 'CURRENT_TARGET' : effect.target ?? 'SELF', effect.radius, primary);
        const touched = applyEffect(this.ctx, unit, effect, index, {
          power: ['HEAL', 'SHIELD_FLAT'].includes(effect.kind) ? unit.skillMultiplier : 1,
          sourceKey: `skill:${unit.id}:${unit.skill.id}`, currentTarget: primary, event: 'ON_CAST', targets,
        });
        if (touched && targets.length) this.events.push({ t: this.time, type: 'SKILL_EFFECT', source: unit.id,
          targets: targets.map((u) => u.id), kind: effect.kind, radius: effect.radius ?? 0 });
      }
      if (unit.alive && cast.end > this.time + 1e-8) this.casts.push(cast);
    }
  }

  private summon(owner: CombatUnit, power: number, duration: number): void {
    const blocked = this.occupied();
    const spot = this.cellsWithin(owner.cell, 1, this.keyFor(owner)).find((c) => !blocked.has(hexKey(c)));
    if (!spot) return;
    const clone = makeCombatUnit({
      id: `${owner.id}~summon${this.units.length}`,
      instanceId: `${owner.instanceId}~s`,
      unitDefId: owner.unitDefId,
      star: 1,
      items: [],
      extraTraits: [],
      team: owner.team,
      cell: spot,
    });
    // A summon is a stripped-down body: no traits, no items, fixed lifetime.
    clone.traits = [];
    clone.maxHp = Math.max(100, power);
    clone.hp = clone.maxHp;
    clone.base.hp = clone.maxHp;
    clone.base.attackDamage = Math.max(20, power * 0.12);
    clone.base.maxMana = 9999;
    clone.mana = 0;
    clone.stacks['summonExpiresAt'] = this.time + duration;
    this.units.push(clone);
    this.bindings.set(clone.id, []);
  }

  // ---------------------------------------------------------------- statuses
  private applyStatus(source: CombatUnit, target: CombatUnit, effect: EffectDef): void {
    const kind = (effect.status ?? 'STUN') as StatusKind;
    let duration = effect.duration ?? 1;

    const isCc = kind === 'STUN' || kind === 'SILENCE' || kind === 'TAUNT' || kind === 'DISARM' || kind === 'SLOW';
    if (isCc) {
      if (target.aura.ccImmuneUntil > this.time) return;
      duration *= 1 - Math.min(0.9, target.aura.ccResist);
      if (this.overtimeApplied) duration *= OVERTIME_CC_MULT;
      if (duration <= 0.05) return;
    }

    const status = {
      kind,
      expiresAt: this.time + duration,
      sourceId: source.id,
      magnitude: effect.value,
      nextTickAt: kind === 'BURN' ? this.time + 1 : undefined,
    };
    // Refresh rather than stack the same status from the same source.
    const existing = target.statuses.find((s) => s.kind === kind && s.sourceId === source.id);
    if (existing) {
      existing.expiresAt = Math.max(existing.expiresAt, status.expiresAt);
      existing.magnitude = Math.max(existing.magnitude ?? 0, status.magnitude ?? 0);
    } else {
      target.statuses.push(status);
    }
    // A burn always carries a wound (healing reduction) alongside it.
    if (kind === 'BURN' && !hasStatus(target, 'WOUND', this.time)) {
      target.statuses.push({ kind: 'WOUND', expiresAt: status.expiresAt, sourceId: source.id });
    }
  }

  private tickStatuses(): void {
    for (const unit of this.units) {
      if (!unit.alive) continue;
      for (const s of unit.statuses) {
        if (s.kind !== 'BURN' || s.expiresAt <= this.time) continue;
        if (s.nextTickAt !== undefined && this.time >= s.nextTickAt) {
          s.nextTickAt = this.time + 1;
          const source = this.byId(s.sourceId);
          const tick = unit.maxHp * (s.magnitude ?? 0.01);
          if (source) this.dealDamage(source, unit, tick, 'TRUE', false);
        }
      }
      // Summons expire on their own clock.
      const expiry = unit.stacks['summonExpiresAt'];
      if (expiry && this.time >= expiry) {
        unit.alive = false;
        unit.hp = 0;
      }
    }
  }

  /** EVERY_SECONDS effects, driven off a per-binding next-fire clock. */
  private tickPeriodics(): void {
    for (const unit of this.units) {
      if (!unit.alive) continue;
      const target = unit.targetId ? this.byId(unit.targetId) : null;
      const list = this.bindings.get(unit.id) ?? [];
      list.forEach((b, i) => {
        if (b.effect.trigger?.when !== 'EVERY_SECONDS') return;
        const interval = b.effect.interval ?? b.effect.trigger.threshold ?? 1;
        const key = `${unit.id}:${i}`;
        const next = this.periodicNext.get(key) ?? interval;
        if (this.time < next) return;
        this.periodicNext.set(key, this.time + interval);
        applyEffect(this.ctx, unit, b.effect, b.index, {
          power: b.power, sourceKey: b.sourceKey, currentTarget: target, event: 'TICK',
        });
      });
    }
  }

  // ------------------------------------------------------------------ events
  private fire(event: TriggerEvent): void {
    for (const unit of this.units) {
      if (!unit.alive) continue;
      this.fireFor(unit, event, null);
    }
  }

  private fireFor(unit: CombatUnit, event: TriggerEvent, contextTarget: CombatUnit | null): void {
    const target = contextTarget ?? (unit.targetId ? this.byId(unit.targetId) : null);
    const list = this.bindings.get(unit.id) ?? [];
    for (let i = 0; i < list.length; i += 1) {
      const b = list[i];
      if (isAuraKind(b.effect.kind)) continue;
      const gate = b.effect.trigger;
      if (event === 'COMBAT_START') {
        // At combat start, run untriggered passives plus explicit COMBAT_START effects.
        if (gate && gate.when !== 'COMBAT_START' && gate.when !== 'ALWAYS') continue;
      } else if (!gate || gate.when === 'EVERY_SECONDS' || !triggerHolds(unit, gate, this.ctx, event, target)) {
        continue;
      }
      // An `interval` on an event-triggered effect is a re-use cooldown.
      if (b.effect.interval && gate && gate.when !== 'EVERY_SECONDS') {
        const key = `${unit.id}:${i}`;
        if (this.time < (this.triggerReadyAt.get(key) ?? 0)) continue;
        this.triggerReadyAt.set(key, this.time + b.effect.interval);
      }
      applyEffect(this.ctx, unit, b.effect, b.index, {
        power: b.power, sourceKey: b.sourceKey, currentTarget: target, event,
      });
    }
    if (event === 'COMBAT_START') {
      unit.maxHp = stat(unit, 'hp', this.time);
      unit.hp = unit.maxHp;
      unit.mana = Math.min(stat(unit, 'maxMana', this.time), stat(unit, 'startMana', this.time));
    }
  }

  // --------------------------------------------------------------- overtime
  private enterOvertime(): void {
    this.overtimeApplied = true;
    this.ctx.overtime = true;
    this.events.push({ t: this.time, type: 'OVERTIME' });
    for (const unit of this.units) {
      if (!unit.alive) continue;
      // ×4 total attack speed, i.e. +300%.
      addModifier(unit, 'attackSpeed', OVERTIME_ATTACK_SPEED_MULT - 1, true, 0, this.time);
    }
  }

  // ------------------------------------------------------------------- end
  private checkEnd(): void {
    const aliveA = this.units.some((u) => u.team === 'A' && u.alive);
    const aliveB = this.units.some((u) => u.team === 'B' && u.alive);
    if (aliveA && aliveB) return;
    if (!aliveA && !aliveB) this.finish(null);
    else this.finish(aliveA ? 'A' : 'B');
  }

  private finish(winner: 'A' | 'B' | null): void {
    if (this.finished) return;
    this.finished = true;
    this.winner = winner;
    this.events.push({ t: this.time, type: 'END', winner });
  }

  private byId(id: string): CombatUnit | null {
    return this.units.find((u) => u.id === id) ?? null;
  }

  private recordFrame(): void {
    this.frames.push({
      t: Math.round(this.time * 1000) / 1000,
      overtime: this.overtimeApplied,
      units: this.units.map((u) => ({
        id: u.id, team: u.team, unitDefId: u.unitDefId, star: u.star,
        q: u.cell.q, r: u.cell.r,
        fromQ: u.moveFrom?.q ?? null, fromR: u.moveFrom?.r ?? null,
        progress: u.moveProgress,
        hp: Math.max(0, Math.round(u.hp)), maxHp: Math.round(u.maxHp),
        shield: Math.round(totalShield(u, this.time)),
        mana: Math.round(u.mana), maxMana: Math.round(stat(u, 'maxMana', this.time)),
        alive: u.alive,
        casting: this.casts.some(c => c.source === u.id),
        statuses: u.statuses.filter((s) => s.expiresAt > this.time).map((s) => s.kind),
      })),
      events: this.events.slice(this.recordedEventCount),
    });
    this.recordedEventCount = this.events.length;
  }
}

/** Convenience wrapper for a one-shot headless battle. */
export function simulateBattle(
  a: BattleSideInput, b: BattleSideInput, rng: Rng, options: BattleOptions = {},
): BattleResult {
  return new BattleEngine(a, b, rng, options).run();
}

export { addShield, heal };
