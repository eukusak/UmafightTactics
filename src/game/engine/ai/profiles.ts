/** The 7 AI personalities (spec §26.1, §26.4). */
import type { AiProfileId } from '../state';

export type AiProfile = {
  id: AiProfileId;
  nameKo: string;
  /** Gold the AI refuses to spend below, protecting interest. */
  econFloor: number;
  /** Level the AI pushes toward before it starts rolling hard. */
  targetLevel: number;
  /** Gold above which rolling is allowed at the target level. */
  rollThreshold: number;
  /** Extra weight on units matching the AI's favoured role. */
  roleBias: Partial<Record<'TANK' | 'BRUISER' | 'AD_CARRY' | 'AP_CARRY' | 'SUPPORT', number>>;
  /** Extra weight on the AI's strongest active trait. */
  traitBias: number;
  /** How eagerly the AI buys XP. */
  levelAggression: number;
  /** Below this HP the AI starts spending its bank to survive. */
  panicHp: number;
};

export const AI_PROFILES: Record<AiProfileId, AiProfile> = {
  BALANCED: {
    id: 'BALANCED', nameKo: '균형형', econFloor: 30, targetLevel: 8, rollThreshold: 50,
    roleBias: {}, traitBias: 0.6, levelAggression: 1.0, panicHp: 55,
  },
  REROLL: {
    // Parks at level 6, where 1- and 2-cost shop odds are still 45%/33%, and
    // rolls down to a low bank there. Pushing it to level 7 drops 1-cost odds
    // to 19% and low-cost 3-stars stop happening entirely.
    id: 'REROLL', nameKo: '리롤형', econFloor: 34, targetLevel: 6, rollThreshold: 18,
    roleBias: {}, traitBias: 0.9, levelAggression: 0.7, panicHp: 45,
  },
  FAST_LEVEL: {
    id: 'FAST_LEVEL', nameKo: '고속 레벨업', econFloor: 50, targetLevel: 9, rollThreshold: 70,
    roleBias: {}, traitBias: 0.4, levelAggression: 1.8, panicHp: 40,
  },
  ECONOMY: {
    id: 'ECONOMY', nameKo: '경제형', econFloor: 30, targetLevel: 8, rollThreshold: 80,
    roleBias: {}, traitBias: 0.5, levelAggression: 0.9, panicHp: 35,
  },
  AD_FOCUS: {
    id: 'AD_FOCUS', nameKo: '물리 특화', econFloor: 30, targetLevel: 8, rollThreshold: 55,
    roleBias: { AD_CARRY: 1.4, BRUISER: 0.5 }, traitBias: 0.5, levelAggression: 1.0, panicHp: 50,
  },
  AP_FOCUS: {
    id: 'AP_FOCUS', nameKo: '마법 특화', econFloor: 30, targetLevel: 8, rollThreshold: 55,
    roleBias: { AP_CARRY: 1.4, SUPPORT: 0.5 }, traitBias: 0.5, levelAggression: 1.0, panicHp: 50,
  },
  TRAIT_FOCUS: {
    id: 'TRAIT_FOCUS', nameKo: '시너지 특화', econFloor: 35, targetLevel: 8, rollThreshold: 55,
    roleBias: {}, traitBias: 1.8, levelAggression: 0.9, panicHp: 50,
  },
};

export const AI_PROFILE_IDS: AiProfileId[] = [
  'BALANCED', 'REROLL', 'FAST_LEVEL', 'ECONOMY', 'AD_FOCUS', 'AP_FOCUS', 'TRAIT_FOCUS',
];
