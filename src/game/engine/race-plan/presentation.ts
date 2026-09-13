/**
 * Korean copy for Race Plan nodes and offer reasons.
 *
 * Effect text is generated from the EffectDef itself rather than written by
 * hand next to it. A hand-written line drifts the moment a number is tuned;
 * this cannot, which matters for a system whose whole pitch is "here is exactly
 * what you are choosing".
 */
import type { BattleStats, EffectDef, TriggerDef } from '../types';
import { findRacePlanNode } from './defs';
import { RACE_PHASE_LABEL, type FinishingCategory, type OfferReasonPayload, type RacePlanCategory, type RacePlanNode } from './types';

export const CATEGORY_LABEL: Record<RacePlanCategory, string> = {
  HIGH_PACE: '하이 페이스',
  LEAD_CONTROL: '선두 유지',
  MIDDLE_PACE: '미들 페이스',
  SLOW_PACE: '슬로 페이스',
  PASSING: '추월 전개',
  LAST_3F: '라스트 3F',
  GUTS: '근성 승부',
  TRACK: '마장 적응',
  PACE_READ: '페이스 판단',
  GAMBLE: '승부수 전개',
};

export const CATEGORY_COLOR: Record<RacePlanCategory, string> = {
  HIGH_PACE: '#a53c31',
  LEAD_CONTROL: '#3f785d',
  MIDDLE_PACE: '#1e4938',
  SLOW_PACE: '#a98b4b',
  PASSING: '#3d6679',
  LAST_3F: '#e8c86a',
  GUTS: '#a53c31',
  TRACK: '#765844',
  PACE_READ: '#4a6b8a',
  GAMBLE: '#7d3f6b',
};

export const FINISHING_LABEL: Record<FinishingCategory, string> = {
  FRONTRUN: '선행', SUSTAIN: '지구력', BURST: '종반 폭발', SPELL: '스킬 회전',
  TEMPO: '템포', AMPLIFY: '증폭', PASSING: '추월', SUPPORT: '보조', CRIT: '치명타',
  ENCORE: '재각', CONVERSION: '각력 전환',
};

export const FINISHING_COLOR: Record<FinishingCategory, string> = {
  FRONTRUN: '#a53c31', SUSTAIN: '#3f785d', BURST: '#e8c86a', SPELL: '#3d6679',
  TEMPO: '#1e4938', AMPLIFY: '#a98b4b', PASSING: '#3d6679', SUPPORT: '#3f785d', CRIT: '#e8c86a',
  ENCORE: '#e8c86a', CONVERSION: '#7d3f6b',
};

const STAT_LABEL: Partial<Record<keyof BattleStats, string>> = {
  attackDamage: '공격력', abilityPower: '주문력', attackSpeed: '공격속도',
  armor: '방어력', magicResist: '마법 저항력', hp: '최대 체력',
  critChance: '치명타 확률', critMultiplier: '치명타 피해',
  moveSpeedHexPerSec: '이동속도', startMana: '시작 마나', maxMana: '최대 마나',
  attackRange: '사거리',
};

const pct = (v: number): string => `${Math.round(v * 1000) / 10}%`;

function triggerLabel(trigger: TriggerDef | undefined): string {
  if (!trigger) return '';
  switch (trigger.when) {
    case 'COMBAT_START': return '전투 시작 시';
    case 'ON_RACE_PHASE': {
      const phase = trigger.phase ? RACE_PHASE_LABEL[trigger.phase] : '';
      const gate = trigger.hpAbove !== undefined ? `(체력 ${pct(trigger.hpAbove)} 이상)`
        : trigger.hpBelow !== undefined ? `(체력 ${pct(trigger.hpBelow)} 미만)` : '';
      return `${phase} 진입 시${gate}`;
    }
    case 'ON_TARGET_CHANGED': return '대상을 바꿀 때';
    case 'ON_ATTACK': return '기본 공격 시';
    case 'ON_NTH_ATTACK': return `기본 공격 ${trigger.threshold ?? 0}회마다`;
    case 'ON_SAME_TARGET_NTH_ATTACK': return `같은 대상 ${trigger.threshold ?? 0}회 공격 시`;
    case 'ON_BASIC_HIT_TAKEN': return `기본 공격에 ${trigger.threshold ?? 1}회 피격마다`;
    case 'ON_HIT_TAKEN': return '피격 시';
    case 'ON_CAST': return '스킬 사용 시';
    case 'ON_KILL': return '처치 시';
    case 'ON_TAKEDOWN_ASSIST': return '처치 관여 시';
    case 'ON_CC_APPLIED': return '방해 효과 적중 시';
    case 'HP_BELOW': return `체력 ${pct(trigger.threshold ?? 0)} 미만일 때`;
    case 'HP_ABOVE': return `체력 ${pct(trigger.threshold ?? 0)} 이상일 때`;
    case 'TARGET_HP_BELOW': return `대상 체력 ${pct(trigger.threshold ?? 0)} 이하일 때`;
    case 'EVERY_SECONDS': return `${trigger.threshold ?? 1}초마다`;
    case 'AFTER_SECONDS': return `${trigger.threshold ?? 0}초 이후`;
    case 'ADJACENT_ALLIES_AT_LEAST': return '인접 아군이 있을 때';
    case 'NO_ADJACENT_ALLIES': return '인접 아군이 없을 때';
    default: return '';
  }
}

function magnitude(effect: EffectDef): string {
  const value = effect.value ?? 0;
  const stat = effect.stat ? STAT_LABEL[effect.stat] ?? effect.stat : '';
  switch (effect.kind) {
    case 'STAT_MUL': return `${stat} ${value >= 0 ? '+' : ''}${pct(value)}`;
    case 'STAT_ADD': return `${stat} ${value >= 0 ? '+' : ''}${Math.round(value)}`;
    case 'STACKING_STAT': {
      const each = effect.tag === 'PCT' ? pct(value) : `${Math.round(value)}`;
      return `${stat} +${each}(최대 ${effect.maxStacks ?? 1}중첩)`;
    }
    case 'DAMAGE_AMP': return `피해 증폭 ${value >= 0 ? '+' : ''}${pct(value)}`;
    case 'SKILL_DAMAGE_AMP': return `스킬 피해 +${pct(value)}`;
    case 'DAMAGE_REDUCTION': return value >= 0 ? `받는 피해 ${pct(value)} 감소` : `받는 피해 ${pct(-value)} 증가`;
    case 'OMNIVAMP': return `모든 피해 흡혈 +${pct(value)}`;
    case 'HEAL_MAXHP_PCT': return `최대 체력 ${pct(value)} 회복`;
    case 'SHIELD_MAXHP_PCT': return `최대 체력 ${pct(value)} 보호막`;
    case 'SHIELD_FLAT': return `${Math.round(value)} 보호막`;
    case 'MANA_ADD': return `마나 +${Math.round(value)}`;
    case 'ON_HIT_MANA': return `기본 공격마다 마나 +${Math.round(value)}`;
    case 'SUNDER_ARMOR_PCT': return `대상 방어력 ${pct(value)} 감소`;
    case 'SHRED_MR_PCT': return `대상 마법 저항력 ${pct(value)} 감소`;
    case 'CRIT_CHANCE_ADD': return `치명타 확률 +${pct(value)}`;
    case 'CRIT_DAMAGE_ADD': return `치명타 피해 +${pct(value)}`;
    case 'CC_RESIST': return `방해 효과 ${pct(value)} 저항`;
    case 'SURVIVE_LETHAL': return `치명적 피해를 받으면 ${value}초 동안 체력 1로 생존`;
    case 'SPLASH_ON_HIT': return `기본 공격이 주변에 ${pct(value)} 피해`;
    default: return `${effect.kind} ${value}`;
  }
}

/** One human line per effect, always carrying the real number. */
export function describeEffects(node: RacePlanNode): string[] {
  const lines = node.effects.map((effect) => {
    const when = triggerLabel(effect.trigger);
    const what = magnitude(effect);
    const duration = effect.duration ? `, ${effect.duration}초` : '';
    const once = effect.oncePerCombat ? ' (전투당 1회)' : '';
    return `${when ? `${when} ` : ''}${what}${duration}${once}`.trim();
  });

  if (node.resource) {
    const r = node.resource;
    const gains = [
      r.gainPerSeconds ? `${r.gainPerSeconds}초마다 +1` : '',
      r.gainOnAttack ? `기본 공격마다 +${r.gainOnAttack}` : '',
      r.gainOnCast ? `스킬 사용마다 +${r.gainOnCast}` : '',
      r.gainOnHitTaken ? `피격마다 +${r.gainOnHitTaken}` : '',
    ].filter(Boolean).join(' · ');
    lines.push(`${r.label}: ${gains} (최대 ${r.max})`);
    const per = r.perStack.map(magnitude).join(', ');
    lines.push(
      r.payoutPhase
        ? `${RACE_PHASE_LABEL[r.payoutPhase]} 진입 시 ${r.label} 1당 ${per}${r.consume ? ' (소모)' : ''}`
        : `${r.label} 1당 ${per}`,
    );
  }
  if (node.id === 'FM_STAYER') lines.push('라스트 3F 진입 시 지구력 1당 공격력·주문력 +2%');
  if (node.id === 'RP_TRACK_GOING' || node.id === 'EV_TRACK_ADAPT') {
    lines.push('이번 라운드 마장 상태에 따라 총량이 같은 다른 보너스');
  }
  if (node.id === 'FM_RACE_READ') {
    lines.push('4코너에서 적이 더 많으면 방어력·마법 저항력 +20, 받는 피해 8% 감소');
    lines.push('그 외에는 피해 증폭 +12%. 선택된 쪽이 전투 종료까지 유지됩니다.');
  }
  return lines;
}

export const REASON_COPY: Record<string, { mark: '◎' | '○' | '△'; text: (n?: number, text?: string) => string }> = {
  ITEM_AS_HIGH: { mark: '◎', text: (n) => `공격속도 계열 장비 ${n ?? 0}개와 호응합니다.` },
  ITEM_AD_HIGH: { mark: '◎', text: (n) => `공격력 계열 장비 ${n ?? 0}개와 호응합니다.` },
  ITEM_AP_HIGH: { mark: '◎', text: (n) => `주문력 계열 장비 ${n ?? 0}개와 호응합니다.` },
  ITEM_TANK_HIGH: { mark: '○', text: () => '방어 장비 중심 편성과 맞습니다.' },
  ITEM_MANA_HIGH: { mark: '○', text: () => '마나 장비와 호응합니다.' },
  FAST_COMBAT: { mark: '○', text: (n) => `최근 전투 평균 ${n ?? 0}초 — 승부가 일찍 납니다.` },
  LONG_COMBAT: { mark: '◎', text: (n) => `최근 전투 평균 ${n ?? 0}초 — 종반까지 이어집니다.` },
  OVERTIME_OFTEN: { mark: '◎', text: () => '최근 전투가 자주 극한 승부로 갑니다.' },
  EARLY_FRONTLINE_COLLAPSE: { mark: '△', text: () => '전열이 중반에 먼저 무너지고 있습니다.' },
  ENEMY_TANK_WALL: { mark: '△', text: () => '4코너에서 상대 전열이 아직 두껍습니다.' },
  CARRY_CAST_LATE: { mark: '△', text: () => '승부마의 첫 스킬이 늦게 나옵니다.' },
  LOW_LEVEL_REROLL: { mark: '○', text: () => '저코스트 3성 운영과 호응합니다.' },
  HIGH_ECONOMY: { mark: '○', text: (n) => `보유 골드 ${n ?? 0} — 고코스트 전환 여지가 큽니다.` },
  WIN_STREAK: { mark: '○', text: () => '연승 중입니다.' },
  LOSS_STREAK: { mark: '△', text: () => '연패 중이라 이번 라운드 손실이 큽니다.' },
  STYLE_NIGE: { mark: '○', text: (n) => `도주 각질 기물 ${n ?? 0}명과 호응합니다.` },
  STYLE_SENKO: { mark: '○', text: (n) => `선행 각질 기물 ${n ?? 0}명과 호응합니다.` },
  STYLE_SASHI: { mark: '○', text: (n) => `선입 각질 기물 ${n ?? 0}명과 호응합니다.` },
  STYLE_OIKOMI: { mark: '○', text: (n) => `추입 각질 기물 ${n ?? 0}명과 호응합니다.` },
  DISTANCE_SPRINT: { mark: '○', text: (n) => `단거리 적성 기물 ${n ?? 0}명과 호응합니다.` },
  DISTANCE_MILE: { mark: '○', text: (n) => `마일 적성 기물 ${n ?? 0}명과 호응합니다.` },
  DISTANCE_MIDDLE: { mark: '○', text: (n) => `중거리 적성 기물 ${n ?? 0}명과 호응합니다.` },
  DISTANCE_LONG: { mark: '○', text: (n) => `장거리 적성 기물 ${n ?? 0}명과 호응합니다.` },
  SURFACE_TURF: { mark: '○', text: (n) => `잔디 적성 기물 ${n ?? 0}명과 호응합니다.` },
  SURFACE_DIRT: { mark: '○', text: (n) => `더트 적성 기물 ${n ?? 0}명과 호응합니다.` },
  COURSE_AFFINITY: { mark: '△', text: (_n, text) => `${text ?? ''} 코스 적성이 있습니다.` },
  G1_THEME_MATCH: { mark: '◎', text: (_n, text) => `이번 GⅠ ${text ?? ''}의 조건과 맞습니다.` },
  TRAIT_ACTIVE: { mark: '○', text: () => '활성 시너지와 호응합니다.' },
  CARRY_READY: { mark: '◎', text: () => '승부마 후보가 이미 준비되어 있습니다.' },
  PIVOT_ROOM: { mark: '○', text: () => '특정 기물에 묶이지 않는 전개입니다.' },
  NODE_TIMING: { mark: '○', text: (_n, text) => `힘이 실리는 구간: ${text ?? ''}` },
  PACE_HIGH: { mark: '△', text: () => '오늘은 하이페이스라 앞선 말이 직선에서 무너집니다' },
  PACE_SLOW: { mark: '△', text: () => '오늘은 슬로우페이스라 앞에 선 말이 그대로 끌고 들어갑니다' },
  GOING_SOFT: { mark: '△', text: () => '마장이 무거워 버티는 쪽이 남습니다' },
  GOING_FIRM: { mark: '○', text: () => '마장이 단단해 시계가 빠릅니다' },
  CLAUSE_ACTIVE: { mark: '○', text: (_n, text) => `이번 개최 특례: ${text ?? ''}` },
};

export function reasonText(payload: OfferReasonPayload): { mark: string; text: string } {
  const copy = REASON_COPY[payload.reason];
  if (!copy) return { mark: '○', text: payload.reason };
  return { mark: copy.mark, text: copy.text(payload.n, payload.text) };
}

export function nodeLabel(id: string | undefined): string {
  return (id && findRacePlanNode(id)?.nameKo) ?? '';
}
