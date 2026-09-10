/** Core domain types shared by the pure engine, the data builder and the UI. */

export type Cost = 1 | 2 | 3 | 4 | 5;
export type Star = 1 | 2 | 3;
export type Role = 'TANK' | 'BRUISER' | 'AD_CARRY' | 'AP_CARRY' | 'SUPPORT';
export type DamageType = 'PHYSICAL' | 'MAGIC' | 'TRUE' | 'NONE';
export type AttackRange = 1 | 2 | 3 | 4;

export type RunStyle = 'nige' | 'senko' | 'sashi' | 'oikomi';
export type DistanceTrait = 'sprinter' | 'miler' | 'middle' | 'stayer';
export type SurfaceTrait = 'dirt_champion' | 'all_rounder';
export type HistoryTrait =
  | 'golden_generation'
  | 'famous_house'
  | 'international'
  | 'unbeaten'
  | 'comeback'
  | 'triple_crown'
  | 'era_star'
  | 'classic_legend'
  | 'heisei_dynasty'
  | 'reiwa_elite'
  | 'queen'
  | 'emperor'
  | 'record_breaker'
  | 'iron_horse';
export type TraitId = RunStyle | DistanceTrait | SurfaceTrait | HistoryTrait | `${import('./seasons/catalog').SeasonId}_${string}`;

/** Mutable combat stats. Everything the EffectSystem is allowed to touch. */
export type BattleStats = {
  hp: number;
  attackDamage: number;
  abilityPower: number;
  armor: number;
  magicResist: number;
  attackSpeed: number;
  attackRange: AttackRange;
  moveSpeedHexPerSec: number;
  critChance: number;
  critMultiplier: number;
  startMana: number;
  maxMana: number;
};

export type SkillTemplate =
  | 'DASH_LINE'
  | 'AOE_BURST'
  | 'SINGLE_EXECUTE'
  | 'SHIELD_TAUNT'
  | 'HEAL_BUFF'
  | 'BACKLINE_DIVE'
  | 'MULTI_SHOT'
  | 'CONE'
  | 'AURA'
  | 'CONTROL'
  | 'RAMP'
  | 'SUMMON';

export type TargetRule =
  | 'CURRENT_TARGET'
  | 'NEAREST_ENEMY'
  | 'LOWEST_HP_ENEMY'
  | 'LOWEST_HP_PCT_ENEMY'
  | 'HIGHEST_HP_ENEMY'
  | 'FARTHEST_ENEMY'
  | 'LARGEST_ENEMY_CLUSTER'
  | 'LOWEST_HP_ALLY'
  | 'SELF'
  | 'ALL_ALLIES'
  | 'ALL_ENEMIES';

/**
 * One declarative effect. The EffectSystem interprets these; there is no
 * per-item or per-skill switch anywhere in the battle engine (spec §42).
 */
export type EffectDef = {
  kind: EffectKind;
  /** Coefficients for item procs; these never use the character's star skill multiplier. */
  scaling?: { attackDamage?: number; abilityPower?: number; armor?: number; selfMaxHp?: number; targetCurrentHp?: number; targetMissingHp?: number; cap?: number };
  /** Refresh this binding's timed stat modifier instead of adding another copy. */
  refresh?: boolean;
  /** Event cooldown is independent for each victim. */
  perTargetCooldown?: boolean;
  /** Exclude the holder (support gear cannot bounce back to itself). */
  excludeSelf?: boolean;
  /** Stat touched by STAT_ADD / STAT_MUL / stat-shaped effects. */
  stat?: keyof BattleStats;
  /** Primary magnitude. Percentages are fractions (0.25 == 25%). */
  value?: number;
  /** Magnitude scaling per bonus star, when the effect belongs to a skill. */
  perStar?: number[];
  /** Seconds. 0 / undefined == permanent for the battle. */
  duration?: number;
  /** Seconds between ticks for periodic effects. */
  interval?: number;
  /** Delay after the skill's first release, in seconds (skills only). */
  delay?: number;
  /** Stack ceiling for stacking effects. */
  maxStacks?: number;
  /** Radius in hexes for area effects. */
  radius?: number;
  /** Who the effect lands on. */
  target?: TargetRule;
  /** Trigger gate; the effect only applies while/when this holds. */
  trigger?: TriggerDef;
  damageType?: DamageType;
  /** Status applied by CC / status effects. */
  status?: StatusKind;
  /** Free-form tag used by a few bookkeeping effects (e.g. shield source id). */
  tag?: string;
  /** Once-per-combat gate. */
  oncePerCombat?: boolean;
};

export type EffectKind =
  | 'PROC_DAMAGE'
  | 'SPELLBLADE'
  | 'STAT_ADD'
  | 'STAT_MUL'
  | 'DAMAGE'
  | 'DAMAGE_MAXHP_PCT'
  | 'HEAL'
  | 'HEAL_MAXHP_PCT'
  | 'HEAL_MISSING_PCT'
  | 'SHIELD_MAXHP_PCT'
  | 'SHIELD_FLAT'
  | 'MANA_ADD'
  | 'MANA_MAX_ADD'
  | 'DAMAGE_AMP'
  | 'DAMAGE_REDUCTION'
  | 'OMNIVAMP'
  | 'CRIT_DAMAGE_ADD'
  | 'CRIT_CHANCE_ADD'
  | 'SKILL_DAMAGE_AMP'
  | 'SKILLS_CAN_CRIT'
  | 'SUNDER_ARMOR_PCT'
  | 'SHRED_MR_PCT'
  | 'BURN'
  | 'WOUND'
  | 'APPLY_STATUS'
  | 'CC_RESIST'
  | 'CC_IMMUNE'
  | 'UNTARGETABLE'
  | 'EXECUTE_THRESHOLD'
  | 'REVIVE'
  | 'SURVIVE_LETHAL'
  | 'HEAL_SHIELD_AMP'
  | 'SHIELD_DAMAGE_AMP'
  | 'ATTACK_SPEED_CAP_ADD'
  | 'STACKING_STAT'
  | 'ON_HIT_DAMAGE'
  | 'ON_HIT_MANA'
  | 'SPLASH_ON_HIT'
  | 'MANA_LOCK'
  | 'TAUNT'
  | 'DASH'
  | 'SUMMON';

export type StatusKind =
  | 'STUN'
  | 'SILENCE'
  | 'TAUNT'
  | 'BURN'
  | 'WOUND'
  | 'DISARM'
  | 'SLOW'
  | 'UNTARGETABLE';

export type TriggerDef = {
  when:
    | 'ALWAYS'
    | 'COMBAT_START'
    | 'ON_ATTACK'
    | 'ON_SAME_TARGET_NTH_ATTACK'
    | 'ON_BASIC_HIT_TAKEN'
    | 'ON_SKILL_HIT'
    | 'ON_CC_APPLIED'
    | 'ON_SUPPORT_SKILL'
    | 'ON_NTH_ATTACK'
    | 'ON_HIT_TAKEN'
    | 'ON_CAST'
    | 'ON_KILL'
    | 'ON_TAKEDOWN_ASSIST'
    | 'HP_BELOW'
    | 'HP_ABOVE'
    | 'TARGET_HP_BELOW'
    | 'AFTER_SECONDS'
    | 'EVERY_SECONDS'
    | 'ON_DEATH'
    | 'ADJACENT_ALLIES_AT_LEAST'
    | 'NO_ADJACENT_ALLIES'
    | 'IN_FRONT_ROWS'
    | 'IN_BACK_ROWS';
  /** Threshold for HP_BELOW / AFTER_SECONDS / ON_NTH_ATTACK / adjacency counts. */
  threshold?: number;
};

export type SkillDef = {
  id: string;
  displayName: string;
  template: SkillTemplate;
  baseValues: number[];
  starMultipliers: number[];
  damageType: DamageType;
  targetRule: TargetRule;
  manaCost: number;
  effects: EffectDef[];
  vfxKey: string;
  description: string;
  /** Shared by simulation, motion playback and the preview. */
  choreography?: { windup: number; recovery: number; pulseInterval: number; color: string; variant: string };
};

export type UnitDef = {
  id: string;
  horseId: string;
  nameKo: string;
  nameJa: string;
  nameEn: string;
  cost: Cost;
  role: Role;
  activeS1: boolean;
  uftRating: number;
  hp: number;
  attackDamage: number;
  abilityPower: number;
  armor: number;
  magicResist: number;
  attackSpeed: number;
  attackRange: AttackRange;
  moveSpeedHexPerSec: number;
  critChance: number;
  critMultiplier: number;
  startMana: number;
  maxMana: number;
  traits: TraitId[];
  skillId: string;
  skill: SkillDef;
  source: {
    powerIndex: number;
    stats: { speed: number; stamina: number; power: number; guts: number; intelligence: number };
    birthYear: number;
    signatureId: string;
    signatureName: string;
    archetype: string;
    primaryStyle: RunStyle;
    bestDistance: DistanceTrait;
    dataConfidence: string;
    historySummary: { starts: number; wins: number; mainWin: string | null; gradeWins: Record<string, number> };
    /** Reference-only mirrors of UmaRogue fields. Never used for cost (spec §7.1). */
    legacyTier: number;
    legacyStarterCost: number;
  };
};

export type TraitTier = {
  count: number;
  effects: EffectDef[];
  description: string;
};

export type TraitDef = {
  id: TraitId;
  name: string;
  category: 'STYLE' | 'DISTANCE' | 'SURFACE' | 'HISTORY' | 'SEASON';
  /** Breakpoint unit counts, ascending. */
  thresholds: number[];
  tiers: TraitTier[];
  emblemItemId: string | null;
  description: string;
};

export type ItemTag = 'DAMAGE' | 'TANK' | 'MANA' | 'UTILITY' | 'EMBLEM' | 'TACTICIAN';

export type ItemDef = {
  tier?: 'ARTIFACT' | 'RADIANT';
  /** Special editions reuse the base icon with an explicit tier badge. */
  iconId?: string;
  /** Mutually exclusive item family, including normal/radiant editions. */
  uniqueGroup?: string;
  id: string;
  name: string;
  /** null for the 10 base components. */
  components: [string, string] | null;
  isComponent: boolean;
  stats: Partial<BattleStats>;
  /** Percentage stat grants, applied multiplicatively (0.10 == +10%). */
  pctStats?: Partial<Record<keyof BattleStats, number>>;
  tags: ItemTag[];
  unique?: boolean;
  /** Grants a trait (emblem items). */
  grantsTrait?: TraitId;
  /** Tactician items sit in the player's tactician slots, not on a unit. */
  tactician?: boolean;
  /** Item slots consumed on the holder (default 1; 변칙 작전 글러브 uses 3). */
  slotCost: number;
  effects: EffectDef[];
  description: string;
};

export type AugmentGrade = 'S' | 'G' | 'P';

export type AugmentDef = {
  id: string;
  grade: AugmentGrade;
  name: string;
  description: string;
  /** Effects granted to every unit the player owns. */
  teamEffects: EffectDef[];
  /** Non-combat hooks resolved by the economy / round systems. */
  economy?: {
    instantGold?: number;
    instantXp?: number;
    maxInterestDelta?: number;
    baseIncomeDelta?: number;
    freeRefreshPerRound?: number;
    cheapRerollCount?: number;
    cheapRerollCost?: number;
    sellLossReduction?: number;
    streakShift?: number;
    benchSlots?: number;
    itemSlots?: number;
    shopSlots?: number;
    teamSizeBonus?: number;
    levelXpDiscount?: number;
    playerDamageReduction?: number;
    shopOddsShiftHighCost?: number;
    shopOddsLevel10FiveCost?: number;
    duplicateWeightLowCost?: number;
    pairHunterWeight?: number;
  };
  /** One-shot grants handed out the moment the augment is picked. */
  grants?: {
    components?: number;
    componentChoice?: number;
    completedChoice?: number;
    radiantChoice?: number;
    removers?: number;
    reforgers?: number;
    emblemChoice?: number;
    tacticianCrown?: number;
    unitOfTrait?: TraitId;
    cloneMaxCost?: Cost;
    randomLegacyEmblem?: boolean;
    traitPlusOne?: 'DISTANCE_BEST' | 'SURFACE_BEST';
    secondaryTraitPick?: boolean;
  };
};

export type ArtManifestEntry = {
  id: string;
  nameKo: string;
  activeS1: boolean;
  cost: Cost;
  portrait: string;
  battleSheet: string;
  cutinRequired: boolean;
};

export type ArtManifest = {
  version: 1;
  generatedAt: string;
  characters: ArtManifestEntry[];
  items: string[];
  traits: string[];
  augments: string[];
  status: string[];
  vfx: string[];
  starVfx: string[];
  pve: string[];
  boards: string[];
  ui: string[];
  banners: string[];
};
