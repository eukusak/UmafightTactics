import type { Cost, EffectDef, Role, TraitDef, TraitId, UnitDef } from '../types';

export const SEASON_IDS = ['s1', 's2', 's3', 's4', 's5'] as const;
export type SeasonId = typeof SEASON_IDS[number];
export const DEFAULT_SEASON: SeasonId = 's1';
export const SEASON_COST_COUNTS: Record<Cost, number> = { 1: 14, 2: 14, 3: 13, 4: 11, 5: 8 };
export const isSeasonId = (value: unknown): value is SeasonId => SEASON_IDS.includes(value as SeasonId);

type Theme = { id: SeasonId; name: string; subtitle: string; color: string; focus: TraitId[] };
export const SEASON_THEMES: Theme[] = [
  { id: 's1', name: '트윙클 개막전', subtitle: '속공과 기본기, 첫 번째 스타들의 무대', color: '#f5c76a', focus: ['nige', 'sprinter'] },
  { id: 's2', name: '별빛 오케스트라', subtitle: '마나와 스킬 연계로 완성하는 협주곡', color: '#ad9bff', focus: ['middle', 'queen'] },
  { id: 's3', name: '와일드 프런티어', subtitle: '회복과 강인함으로 끝까지 버티는 레이스', color: '#72d6ad', focus: ['dirt_champion', 'stayer'] },
  { id: 's4', name: '네온 스프린트', subtitle: '치명타와 추격으로 승부를 가르는 질주', color: '#68d7ff', focus: ['sashi', 'miler'] },
  { id: 's5', name: '크라운 피날레', subtitle: '성장과 역전, 왕관을 향한 마지막 승부', color: '#ff9daf', focus: ['comeback', 'oikomi'] },
];

const stat = (kind: 'STAT_ADD' | 'STAT_MUL', key: EffectDef['stat'], value: number): EffectDef => ({ kind, stat: key, value });
const onStart = (kind: EffectDef['kind'], value: number, duration?: number): EffectDef => ({ kind, value, duration, trigger: { when: 'COMBAT_START' } });
const onCast = (kind: EffectDef['kind'], value: number, duration?: number): EffectDef => ({ kind, value, duration, trigger: { when: 'ON_CAST' } });
type TraitRecipe = [string, string, (tier: number) => EffectDef[], (tier: number) => string];
// Each seasonal faction has 15 members and three reachable breakpoints.
// Effects belong to faction members only; shared historical traits still apply.
const recipes: Record<SeasonId, TraitRecipe[]> = {
  s1: [
    ['pace', '페이스메이커', t => [stat('STAT_MUL', 'attackSpeed', .06 * t), stat('STAT_MUL', 'moveSpeedHexPerSec', .08 * t)], t => `공격속도 +${6*t}%, 이동속도 +${8*t}%`],
    ['banner', '개막 기수', t => [onStart('SHIELD_MAXHP_PCT', .08 * t, 8)], t => `전투 시작 시 8초 동안 최대 체력 ${8*t}% 보호막`],
    ['spark', '샛별', t => [stat('STAT_ADD', 'startMana', 8 * t), stat('STAT_ADD', 'abilityPower', 5 * t)], t => `시작 마나 +${8*t}, 주문력 +${5*t}`],
    ['team', '원팀', t => [stat('STAT_ADD', 'armor', 8 * t), stat('STAT_ADD', 'magicResist', 8 * t)], t => `방어력·마법 저항력 +${8*t}`],
  ],
  s2: [
    ['rhythm', '리듬 메이커', t => [{ kind: 'ON_HIT_MANA', value: t, trigger: { when: 'ON_ATTACK' } }], t => `기본 공격 적중 시 추가 마나 ${t}`],
    ['aria', '별빛 아리아', t => [{ kind: 'SKILL_DAMAGE_AMP', value: .07 * t }], t => `스킬 피해 +${7*t}%`],
    ['encore', '앙코르', t => [onCast('HEAL_MAXHP_PCT', .025 * t)], t => `스킬 사용 시 자신의 최대 체력 ${2.5*t}% 회복`],
    ['harmony', '하모니', t => [onCast('SHIELD_MAXHP_PCT', .04 * t, 3)], t => `스킬 사용 시 3초 동안 자신의 최대 체력 ${4*t}% 보호막`],
  ],
  s3: [
    ['trail', '개척단', t => [stat('STAT_MUL', 'hp', .08 * t)], t => `최대 체력 +${8*t}%`],
    ['spring', '오아시스', t => [{ kind: 'HEAL_MAXHP_PCT', value: .03 * t, trigger: { when: 'EVERY_SECONDS', threshold: 5 } }], t => `5초마다 자신의 최대 체력 ${3*t}% 회복`],
    ['fang', '야생의 송곳니', t => [{ kind: 'OMNIVAMP', value: .04 * t }, stat('STAT_MUL', 'attackDamage', .04 * t)], t => `모든 피해 흡혈 +${4*t}%, 공격력 +${4*t}%`],
    ['stone', '바위 수호자', t => [{ kind: 'DAMAGE_REDUCTION', value: .04 * t }, onStart('CC_IMMUNE', 0, 2 * t)], t => `받는 피해 ${4*t}% 감소, 시작 ${2*t}초 방해 효과 면역`],
  ],
  s4: [
    ['pulse', '네온 펄스', t => [{ kind: 'ON_HIT_DAMAGE', value: 10 * t, damageType: 'MAGIC', trigger: { when: 'ON_ATTACK' } }], t => `기본 공격에 마법 피해 ${10*t} 추가`],
    ['chrome', '크롬 에이스', t => [{ kind: 'CRIT_CHANCE_ADD', value: .05 * t }, { kind: 'CRIT_DAMAGE_ADD', value: .08 * t }], t => `치명타 확률 +${5*t}%, 치명타 피해 +${8*t}%`],
    ['nitro', '니트로', t => [{ ...stat('STAT_MUL', 'attackSpeed', .12 * t), duration: 6, trigger: { when: 'COMBAT_START' } }], t => `전투 시작 6초 동안 공격속도 +${12*t}%`],
    ['chase', '추격자', t => [{ kind: 'DAMAGE_AMP', value: .08 * t, trigger: { when: 'TARGET_HP_BELOW', threshold: .5 } }], t => `체력이 절반 미만인 대상에게 피해 +${8*t}%`],
  ],
  s5: [
    ['crown', '왕관의 계승자', t => [stat('STAT_MUL', 'attackDamage', .05 * t), stat('STAT_ADD', 'abilityPower', 7 * t)], t => `공격력 +${5*t}%, 주문력 +${7*t}`],
    ['vow', '불굴의 맹세', t => [{ kind: 'SHIELD_MAXHP_PCT', value: .08 * t, duration: 5, oncePerCombat: true, trigger: { when: 'HP_BELOW', threshold: .4 } }], t => `체력 40% 미만일 때 한 번, 5초 동안 최대 체력 ${8*t}% 보호막`],
    ['legacy', '영광의 유산', t => [{ kind: 'HEAL_MAXHP_PCT', value: .06 * t, trigger: { when: 'ON_TAKEDOWN_ASSIST' } }], t => `처치 관여 시 자신의 최대 체력 ${6*t}% 회복`],
    ['finale', '피날레', t => [{ ...stat('STAT_MUL', 'attackSpeed', .08 * t), oncePerCombat: true, trigger: { when: 'EVERY_SECONDS', threshold: 10 } }, { kind: 'DAMAGE_AMP', value: .04 * t, trigger: { when: 'AFTER_SECONDS', threshold: 10 } }], t => `전투 10초 후 공격속도 +${8*t}%, 피해 +${4*t}%`],
  ],
};

export const SEASON_TRAIT_DEFS: TraitDef[] = SEASON_IDS.flatMap(season => recipes[season].map(([key, name, effects, description]) => ({
  id: `${season}_${key}` as TraitId, name, category: 'SEASON', thresholds: [3, 5, 7], emblemItemId: null,
  description: `${SEASON_THEMES.find(s => s.id === season)!.name} 전용 · 해당 특성 기물에게 적용 · 서로 다른 기물 3/5/7명`,
  tiers: [3, 5, 7].map((count, i) => ({ count, effects: effects(i + 1).map(e => ({ ...e, target: e.kind === 'ON_HIT_DAMAGE' ? 'CURRENT_TARGET' : 'SELF' })), description: description(i + 1) })),
})));

export type SeasonDef = Theme & { unitIds: string[]; traits: TraitDef[]; unitTraits: Record<string, TraitId> };

/** Pure, stable allocation shared by the data builder and runtime. No global selected season. */
export function buildSeasons(units: UnitDef[], firstSeasonIds: string[]): SeasonDef[] {
  const appearances = new Map<string, number>();
  const compareId = (a: UnitDef, b: UnitDef): number => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  return SEASON_THEMES.map((theme, seasonIndex) => {
    const chosen: UnitDef[] = [];
    const roles = new Map<Role, number>();
    const traitCounts = new Map<TraitId, number>();
    const traitLoad = (unit: UnitDef): number => unit.traits.reduce((sum, trait) => sum
      + (traitCounts.get(trait) ?? 0) * (['sprinter', 'miler', 'middle', 'stayer', 'dirt_champion', 'all_rounder'].includes(trait) ? .5 : .15), 0);
    if (seasonIndex === 0) chosen.push(...firstSeasonIds.map(id => units.find(u => u.id === id)!));
    else for (const cost of [1, 2, 3, 4, 5] as Cost[]) {
      const candidates = units.filter(u => u.cost === cost);
      // Reserve an equal share of unseen units for each remaining season.
      // Taking every unseen unit immediately clumps the many middle-distance
      // reserves into S2 and erases meaningful composition choices there.
      const newQuota = Math.ceil(candidates.filter(u => !appearances.has(u.id)).length / (SEASON_THEMES.length - seasonIndex));
      for (let n = 0; n < SEASON_COST_COUNTS[cost]; n++) {
        const needsNew = n < newQuota;
        const eligible = candidates.filter(u => appearances.has(u.id) !== needsNew);
        // Draw common reserve traits earlier so the final season is not forced to take all of them.
        const reservePressure = (u: UnitDef): number => needsNew ? u.traits.reduce((sum, t) => sum + eligible.filter(v => v.traits.includes(t)).length, 0) * .15 : 0;
        const score = (u: UnitDef): number => (roles.get(u.role) ?? 0) * .5 + traitLoad(u) - reservePressure(u)
          + (appearances.get(u.id) ?? 0) * .35 - u.traits.filter(t => theme.focus.includes(t)).length * .2;
        eligible.sort((a, b) => score(a) - score(b) || compareId(a, b));
        const unit = eligible[0];
        if (!unit) throw new Error(`Cannot fill ${theme.id} cost ${cost} roster`);
        candidates.splice(candidates.indexOf(unit), 1);
        chosen.push(unit);
        roles.set(unit.role, (roles.get(unit.role) ?? 0) + 1);
        for (const trait of unit.traits) traitCounts.set(trait, (traitCounts.get(trait) ?? 0) + 1);
      }
    }
    for (const unit of chosen) appearances.set(unit.id, (appearances.get(unit.id) ?? 0) + 1);
    const traits = SEASON_TRAIT_DEFS.filter(t => t.id.startsWith(`${theme.id}_`));
    const groups: UnitDef[][] = traits.map(() => []);
    // Distribute costs and roles across factions so each can field a complete team.
    const unitTraits: Record<string, TraitId> = {};
    for (const unit of [...chosen].sort((a, b) => a.cost - b.cost || a.role.localeCompare(b.role) || compareId(a, b))) {
      const index = groups.map((g, i) => ({ i, size: g.length, role: g.filter(u => u.role === unit.role).length, cost: g.filter(u => u.cost === unit.cost).length }))
        .sort((a, b) => a.size - b.size || a.role - b.role || a.cost - b.cost || ((a.i + seasonIndex) % 4) - ((b.i + seasonIndex) % 4))[0].i;
      groups[index].push(unit);
      unitTraits[unit.id] = traits[index].id;
    }
    return { ...theme, unitIds: chosen.map(u => u.id), traits, unitTraits };
  });
}
