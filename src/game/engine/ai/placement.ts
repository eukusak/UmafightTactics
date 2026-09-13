import { lineupScore, unitPower, lineupTraits, unitTraits } from './evaluation';
import { effectUtility } from './knowledge';
import { getAugment } from '../augments/augment-defs';
import { augmentApplies, augmentEffects } from '../augments/runtime';
import { getItem } from '../items/item-defs';
import { getTrait, activeTierIndex } from '../traits/trait-defs';
import { hexDistance } from '../battle/hex';
import type { PublicBoard } from './strategy';
/** Board placement search (spec §26.5). Bounded to 40 candidate layouts. */
import { BOARD_COLS, BOARD_ROWS_PER_SIDE } from '../constants';
import { getUnitDef } from '../roster';
import type { Role, EffectDef, TraitId } from '../types';
import type { HexPos, PlayerState, UnitInstance } from '../state';
import { teamSizeLimit } from '../shop';

const MAX_CANDIDATES = 180;

/** Preferred row (0 = front line) per role. */
const ROLE_ROW: Record<Role, number> = {
  TANK: 0, BRUISER: 0, AD_CARRY: 3, AP_CARRY: 3, SUPPORT: 2,
};

/** How strongly a unit wants its preferred row. */
const ROLE_ROW_WEIGHT: Record<Role, number> = {
  TANK: 3.0, BRUISER: 2.0, AD_CARRY: 3.2, AP_CARRY: 3.4, SUPPORT: 1.6,
};

export type Layout = { instanceId: string; position: HexPos }[];

function scoreLayout(layout: Layout, units: Map<string, UnitInstance>, spreadCarries: boolean, opponents: PublicBoard[] = [], effects:Map<string,EffectDef[]> = new Map()): number {
  let score = 0;
  const byCell = new Map<string, Role>();

  for (const slot of layout) {
    const unit = units.get(slot.instanceId)!;
    const def = getUnitDef(unit.unitDefId);
    const want = preferredRow(unit);
    score -= Math.abs(slot.position.r - want) * ROLE_ROW_WEIGHT[def.role];
    byCell.set(`${slot.position.q},${slot.position.r}`, def.role);
  }

  // Carries in a corner are easy prey for divers; nudge them inward when asked.
  if (spreadCarries) {
    for (const slot of layout) {
      const def = getUnitDef(units.get(slot.instanceId)!.unitDefId);
      if (def.role === 'AD_CARRY' || def.role === 'AP_CARRY') {
        const edge = slot.position.q === 0 || slot.position.q === BOARD_COLS - 1;
        if (edge) score -= 2.5;
      }
    }
  }

  // Front-line units clustered together hold the line better.
  let frontAdjacency = 0;
  for (const [key, role] of byCell) {
    if (role !== 'TANK' && role !== 'BRUISER') continue;
    const [q, r] = key.split(',').map(Number);
    for (const [dq, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nb = byCell.get(`${q + dq},${r + dr}`);
      if (nb === 'TANK' || nb === 'BRUISER') frontAdjacency += 1;
    }
  }
  score += frontAdjacency * 0.4;

  // Supports want to sit next to a carry.
  for (const slot of layout) {
    const def = getUnitDef(units.get(slot.instanceId)!.unitDefId);
    if (def.role !== 'SUPPORT') continue;
    const [q, r] = [slot.position.q, slot.position.r];
    for (const [dq, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nb = byCell.get(`${q + dq},${r + dr}`);
      if (nb === 'AD_CARRY' || nb === 'AP_CARRY') { score += 0.8; break; }
    }
  }

  for (const slot of layout) {
    const unit = units.get(slot.instanceId)!, def = getUnitDef(unit.unitDefId);
    const carry = def.role === 'AD_CARRY' || def.role === 'AP_CARRY';
    for (const opponent of opponents) for (const enemy of opponent.board) {
      if (!enemy.position) continue;
      const ed = getUnitDef(enemy.unitDefId), column = 6 - enemy.position.q;
      const alignment = Math.max(0, 3 - Math.abs(slot.position.q - column));
      const threat = unitPower(enemy) / Math.max(1, opponents.length);
      if (carry && ed.attackRange >= 3) score -= alignment * threat * .12;
      if (def.role === 'TANK' && ed.attackRange >= 3) score += alignment * threat * .1;
    }
    if (carry && def.attackRange >= 3) {
      const front = layout.filter(other => getUnitDef(units.get(other.instanceId)!.unitDefId).role === 'TANK');
      if (front.some(other => Math.abs(other.position.q - slot.position.q) <= 1)) score += 1.3;
      for (const other of layout) if (other !== slot && Math.abs(other.position.q - slot.position.q) <= 1 && other.position.r === slot.position.r) score -= .65;
    }
  }
  for(const slot of layout) {
    const unit=units.get(slot.instanceId)!;
    const adjacent=layout.filter(other=>other!==slot && hexDistance(slot.position,other.position)===1).length;
    for(const effect of effects.get(unit.instanceId)??[]) {
      const value=Math.max(.5,effectUtility(unit,effect));
      switch(effect.trigger?.when) {
        case 'NO_ADJACENT_ALLIES':score+=adjacent===0?value*2:-value;break;
        case 'ADJACENT_ALLIES_AT_LEAST':score+=adjacent>=(effect.trigger.threshold??0)?value*2:-value;break;
        case 'IN_FRONT_ROWS':score+=slot.position.r<=1?value:0;break;
        case 'IN_BACK_ROWS':score+=slot.position.r>=2?value:0;break;
      }
      if(effect.target==='ALL_ALLIES' && effect.radius) score+=layout.filter(other=>(!effect.excludeSelf||other!==slot)&&hexDistance(slot.position,other.position)<=effect.radius!).length*value*.4;
    }
  }
  return score;
}

const selectionCache = new WeakMap<PlayerState, { key: string; units: UnitInstance[] }>();

/** Greedy team selection followed by swap search scores complete trait breakpoints. */
export function chooseFieldedUnits(player: PlayerState): UnitInstance[] {
  const key = `${player.augments.join(',')}:${JSON.stringify(player.augmentProgress)}:${player.seasonId}:${teamSizeLimit(player)}:${JSON.stringify(player.bonusTraits)}:${player.racePlan?.entryUnitDefId ?? ''}:` + [...player.board, ...player.bench].map(u => `${u.instanceId}/${u.unitDefId}/${u.star}/${u.items.join(',')}`).sort().join(';');
  const cached = selectionCache.get(player);
  if (cached?.key === key) return cached.units.slice();
  const all = [...player.board, ...player.bench].sort((a, b) => unitPower(b) - unitPower(a) || a.instanceId.localeCompare(b.instanceId));
  const limit = Math.min(teamSizeLimit(player), all.length);
  const scores=new Map<string,number>();
  const evaluate=(units:UnitInstance[])=>{const key=units.map(u=>u.instanceId).sort().join('|');let value=scores.get(key);if(value===undefined){value=lineupScore(player,units);scores.set(key,value);}return value;};
  let selected: UnitInstance[] = [];
  while (selected.length < limit) {
    let next:UnitInstance|undefined,best=-Infinity;
    for(const unit of all)if(!selected.includes(unit)){const value=evaluate([...selected,unit]);if(value>best || value===best && unit.instanceId.localeCompare(next!.instanceId)<0){best=value;next=unit;}}
    selected.push(next!);
  }
  let score = evaluate(selected);
  for (let pass = 0; pass < 2; pass++) for (const candidate of all.filter(u => !selected.includes(u))) {
    for (let i = 0; i < selected.length; i++) {
      if (selected.includes(candidate)) break;
      const next = selected.slice(); next[i] = candidate;
      const value = evaluate(next);
      if (value > score + .01) { selected = next; score = value; }
    }
  }
  selected = withRaceEntry(player, all, selected);
  selectionCache.set(player, { key, units: selected });
  return selected.slice();
}

/**
 * Forces the registered GⅠ entry onto the field.
 *
 * Race Plan effects only apply to a unit that actually races, so leaving the
 * entry on the bench switches the player's whole plan off for the round. The
 * lineup search does not know that — it only weighs raw power — so the entry is
 * swapped in afterwards, over the weakest unit it picked.
 */
function withRaceEntry(
  player: PlayerState, all: UnitInstance[], selected: UnitInstance[],
): UnitInstance[] {
  const wanted = player.racePlan?.entryUnitDefId;
  if (!wanted || !selected.length) return selected;
  if (selected.some((u) => u.unitDefId === wanted)) return selected;

  const entry = all
    .filter((u) => u.unitDefId === wanted)
    .sort((a, b) => unitPower(b) - unitPower(a) || a.instanceId.localeCompare(b.instanceId))[0];
  if (!entry) return selected;

  const weakest = selected.reduce((worst, u) => (unitPower(u) < unitPower(worst) ? u : worst));
  return selected.map((u) => (u === weakest ? entry : u));
}
function preferredRow(unit: UnitInstance): number {
  const def = getUnitDef(unit.unitDefId);
  return def.attackRange <= 1 && (def.role === 'AD_CARRY' || def.role === 'AP_CARRY') ? 1 : ROLE_ROW[def.role];
}

/**
 * Deterministic hill-climb over a bounded candidate set: start from the
 * role-ideal layout, then try swaps and keep improvements.
 */
export function planPlacement(player: PlayerState, spreadCarries: boolean, opponents: PublicBoard[] = []): Layout {
  const fielded = chooseFieldedUnits(player);
  const units = new Map(fielded.map((u) => [u.instanceId, u]));
  const counts=lineupTraits(player,fielded),effects=new Map<string,EffectDef[]>();
  for(const unit of fielded) {
    const def=getUnitDef(unit.unitDefId),traits=unitTraits(player,unit);
    const list=[...def.skill.effects.filter(e=>e.target==='ALL_ALLIES'&&e.radius),...unit.items.flatMap(id=>getItem(id).effects)];
    for(const id of player.augments) {
      const aug=getAugment(id);
      if(!augmentApplies(aug,{unitDefId:def.id,cost:def.cost,items:unit.items,traits},counts))continue;
      list.push(...augmentEffects(aug,player.augmentProgress??{},counts).filter(e=>!e.tag?.startsWith('TRAIT:')||traits.includes(e.tag.slice(6) as TraitId)),...(aug.skillUpgrade?.append??[]));
    }
    for(const [id,count] of counts) {
      const trait=getTrait(id),tier=activeTierIndex(trait,count);
      if(tier>=0)list.push(...trait.tiers[tier].effects.filter(e=>traits.includes(id)||e.target==='ALL_ALLIES'));
    }
    effects.set(unit.instanceId,list.filter(e=>['NO_ADJACENT_ALLIES','ADJACENT_ALLIES_AT_LEAST','IN_FRONT_ROWS','IN_BACK_ROWS'].includes(e.trigger?.when??'')||e.target==='ALL_ALLIES'&&e.radius));
  }
  if (!fielded.length) return [];

  const cells: HexPos[] = [];
  for (let r = 0; r < BOARD_ROWS_PER_SIDE; r += 1) {
    for (let q = 0; q < BOARD_COLS; q += 1) cells.push({ q, r });
  }
  // Middle columns first so formations grow outward from the centre.
  cells.sort((a, b) => a.r - b.r || Math.abs(a.q - 3) - Math.abs(b.q - 3) || a.q - b.q);

  const sorted = fielded.slice().sort((a, b) => {
    const ra = preferredRow(a);
    const rb = preferredRow(b);
    return ra - rb || a.instanceId.localeCompare(b.instanceId);
  });

  let best: Layout = sorted.map((u) => {
    const want = preferredRow(u);
    const idx = cells.findIndex((c) => c.r === want);
    const cell = cells.splice(idx >= 0 ? idx : 0, 1)[0];
    return { instanceId: u.instanceId, position: cell };
  });
  let bestScore = scoreLayout(best, units, spreadCarries, opponents, effects);

  let evaluated = 1;
  for (let i = 0; i < best.length && evaluated < MAX_CANDIDATES; i += 1) {
    for (let j = i + 1; j < best.length && evaluated < MAX_CANDIDATES; j += 1) {
      const candidate = best.map((s) => ({ ...s }));
      const tmp = candidate[i].position;
      candidate[i].position = candidate[j].position;
      candidate[j].position = tmp;
      evaluated += 1;
      const score = scoreLayout(candidate, units, spreadCarries, opponents, effects);
      if (score > bestScore) { best = candidate; bestScore = score; }
    }
  }
  for (let i = 0; i < best.length && evaluated < MAX_CANDIDATES; i++) {
    for (let q = 0; q < BOARD_COLS && evaluated < MAX_CANDIDATES; q++) {
      const r = preferredRow(units.get(best[i].instanceId)!);
      if (best.some(slot => slot.position.q === q && slot.position.r === r)) continue;
      const candidate = best.map(slot => ({ ...slot, position: { ...slot.position } }));
      candidate[i].position = { q, r }; evaluated++;
      const score = scoreLayout(candidate, units, spreadCarries, opponents, effects);
      if (score > bestScore + .01) { best = candidate; bestScore = score; }
    }
  }
  return best;
}

/** Writes the planned layout back onto the player: fielded on board, rest benched. */
export function applyPlacement(player: PlayerState, layout: Layout): void {
  const placed = new Map(layout.map((s) => [s.instanceId, s.position]));
  const all = [...player.board, ...player.bench];
  player.board = [];
  player.bench = [];
  for (const unit of all) {
    const pos = placed.get(unit.instanceId);
    if (pos) {
      unit.position = pos;
      player.board.push(unit);
    } else {
      unit.position = null;
      player.bench.push(unit);
    }
  }
}
