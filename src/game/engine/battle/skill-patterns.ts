/** Tactical kits inspired by the supplied TFT sets, adapted to UFT battle scale. */
import type { Cost, EffectDef, SkillDef, SkillTemplate, TargetRule } from '../types';
import { COST_SKILL_UTILITY } from '../constants';
import profiles from '../../../data/manual/skill-profiles.json';
import evidence from '../../../data/manual/race-evidence.json';

export const PATTERN_LABELS: Record<string, string> = {
  breach_line: '관통 돌파', pursuit_flurry: '추격 연타', drain_arc: '흡수 휩쓸기', dash_feint: '유인 돌진', trample_wave: '충격 질주', crossing_echo: '교차 파동',
  chain_spark: '연쇄 섬광', expanding_nova: '확장 폭발', comet_fall: '집중 유성', orbital_beam: '지속 광선', twin_orbit: '왕복 궤도', cinder_field: '잔불 지대',
  fan_volley: '부채 연사', focus_three: '삼단 결정타', split_barrage: '분산 포격', seeking_bolt: '주력 저격', carry_charge: '가속 장전',
  tempo_banner: '진군 박자', bulwark_circle: '방벽 원진', sanctuary: '회복 성역', command_pulse: '에이스 지휘', retaliate_storm: '반격 폭풍', bastion_growth: '지구력 축적',
  binding_line: '관통 구속', disarm_cone: '무장 해제', silence_zone: '침묵 지대', delayed_prison: '지연 봉쇄', draining_tether: '마나 구속', frost_front: '서리 전선',
  triage_echo: '삼중 회복', rescue_barrier: '구원 방벽', relay_lantern: '연결 등불', cleanse_hymn: '정화 선율', power_link: '전력 연결',
  challenge_bastion: '결투 방벽', counter_surge: '방벽 반격', iron_drain: '흡수 요새', guardian_vow: '수호 서약',
  isolation_strike: '고립 결정타', execution_refund: '마무리 순환', giant_cutter: '거인 절단', shadow_finish: '잔상 마무리',
};

type Profile = typeof profiles.units.special_week;
const roster = profiles.units as Record<string, Profile>;
const races = evidence.units as Record<string, { name: string; representative: { race_date: string; race_name: string; finish_rank: number } }>;

export const authoredBodyFamily = (id: string): SkillTemplate | undefined => roster[id]?.bodyFamily as SkillTemplate | undefined;

export function buildTacticalSkill(unitId: string, base: SkillDef, cost: Cost = 1): SkillDef {
  const p = roster[unitId];
  if (!p) throw new Error(`Missing authored skill: ${unitId}`);
  if (p.bodyFamily !== base.template || p.primaryTarget !== base.targetRule) throw new Error(`${unitId}: reviewed body contract changed`);
  const pattern = p.pattern, target = base.targetRule;
  const scale = base.baseValues[0] / 180 * p.powerScale;
  const n = (v: number) => Math.round(v * scale);
  const effects: EffectDef[] = [];
  const hit = (v: number, extra: Partial<EffectDef> = {}): EffectDef => ({ kind: 'DAMAGE', value: n(v), damageType: 'MAGIC', target, ...extra });
  const shield = (v: number, who: TargetRule = 'SELF', extra: Partial<EffectDef> = {}): EffectDef => ({ kind: 'SHIELD_FLAT', value: n(v), duration: 4, target: who, ...extra });
  const utility = (value: number): number => value > 0 ? Math.round(value * COST_SKILL_UTILITY[cost] * 1000) / 1000 : value;
  const buff = (stat: NonNullable<EffectDef['stat']>, value: number, who: TargetRule = 'SELF', extra: Partial<EffectDef> = {}): EffectDef => ({ kind: 'STAT_MUL', stat, value: utility(value), duration: 4, refresh: true, target: who, ...extra });
  const cc = (status: NonNullable<EffectDef['status']>, duration: number, extra: Partial<EffectDef> = {}): EffectDef => ({ kind: 'APPLY_STATUS', status, duration, target, ...extra });
  const pulses = (effect: EffectDef, count: number, gap = p.pulseInterval) => { for (let i = 0; i < count; i++) effects.push({ ...effect, delay: (effect.delay ?? 0) + i * gap }); };
  const line = { shape: 'LINE', range: 6, maxTargets: 4 } as const;
  const cone = { shape: 'CONE', range: 3, maxTargets: 4 } as const;
  const area = { radius: 1, maxTargets: 4 } as const;
  const nearby = { radius: 2, maxTargets: 4 } as const;
  const dash: EffectDef = { kind: 'DASH', value: 3, target };
  let text = '';
  switch (pattern) {
    case 'breach_line':
      effects.push(dash, { kind: 'SUNDER_ARMOR_PCT', value: .2, duration: 4, target, ...line }, hit(190, { damageType: 'PHYSICAL', ...line }));
      text = `돌진 후 직선 6칸의 최대 4명에게 방어력 20% 감소(4초)와 ${n(190)} 물리 피해.`; break;
    case 'pursuit_flurry':
      effects.push(dash); pulses(hit(78, { damageType: 'PHYSICAL' }), 3); effects.push(buff('attackSpeed', .2));
      text = `돌진 후 한 적에게 ${n(78)} 물리 피해를 3회, 4초간 공격속도 +20%. 대상 사망 시 남은 타격은 재탐색.`; break;
    case 'drain_arc':
      effects.push(dash, hit(165, { damageType: 'PHYSICAL', ...cone, leech: .25 }));
      text = `돌진 후 전방 3칸 부채꼴의 최대 4명에게 ${n(165)} 물리 피해. 실제 체력 피해의 25% 회복.`; break;
    case 'dash_feint':
      effects.push(shield(130), { ...dash, delay: .25 }, hit(230, { damageType: 'PHYSICAL', delay: .25 }), cc('SLOW', 2, { value: .3, delay: .25 }));
      text = `${n(130)} 보호막을 얻고 0.25초 뒤 돌진. 대상에게 ${n(230)} 물리 피해와 2초 둔화.`; break;
    case 'trample_wave':
      effects.push(dash, hit(175, { damageType: 'PHYSICAL', ...area }), cc('STUN', .65, area));
      text = `돌진 지점 주변 1칸 최대 4명에게 ${n(175)} 물리 피해와 0.65초 기절.`; break;
    case 'crossing_echo':
      effects.push(dash, hit(120, { damageType: 'PHYSICAL', ...line }), hit(85, { damageType: 'MAGIC', ...line, delay: .45 }));
      text = `돌진 후 직선 최대 4명에게 ${n(120)} 물리 피해, 0.45초 뒤 같은 방향으로 ${n(85)} 마법 파동.`; break;
    case 'chain_spark':
      effects.push(hit(115, { shape: 'CHAIN', range: 3, maxTargets: 4 }));
      text = `섬광이 대상에서 3칸 내 다음 적으로 최대 4명까지 이어지며 각각 ${n(115)} 마법 피해. 같은 적을 재타격하지 않음.`; break;
    case 'expanding_nova':
      [0, 1, 2].forEach((radius, i) => effects.push(hit(65, { radius, maxTargets: 4, delay: i * .35 })));
      text = `0.35초 간격으로 대상 중심 0·1·2칸으로 확장하는 폭발. 타격마다 최대 4명에게 ${n(65)} 마법 피해.`; break;
    case 'comet_fall':
      effects.push(hit(250, { radius: 2, maxTargets: 5 }));
      text = `0.9초 집중 후 밀집 지점 2칸 내 최대 5명에게 ${n(250)} 마법 피해. 집중 중 기절하면 취소.`; break;
    case 'orbital_beam':
      pulses(hit(58, line), 4, .35);
      text = `직선 6칸 최대 4명을 향해 0.35초 간격으로 4회 광선. 매회 ${n(58)} 마법 피해, 시전 중 일반 공격 불가.`; break;
    case 'twin_orbit':
      effects.push(hit(130, line), hit(65, { ...line, damageType: 'TRUE', delay: .5 }));
      text = `직선 최대 4명에게 ${n(130)} 마법 피해 후 0.5초 뒤 ${n(65)} 고정 피해의 귀환 파동.`; break;
    case 'cinder_field':
      pulses(hit(64, area), 3, .6); effects.push({ kind: 'WOUND', duration: 3, target, ...area });
      text = `대상 주변 1칸 최대 4명에게 0.6초 간격으로 ${n(64)} 마법 피해 3회와 3초간 회복 감소 33%.`; break;
    case 'fan_volley':
      pulses(hit(112, { damageType: 'PHYSICAL', ...cone }), 2, .3);
      text = `전방 3칸 부채꼴 최대 4명에게 ${n(112)} 물리 피해를 0.3초 간격으로 2회.`; break;
    case 'focus_three':
      [55, 80, 145].forEach((v, i) => effects.push(hit(v, { damageType: 'PHYSICAL', delay: i * p.pulseInterval })));
      text = `한 적에게 ${n(55)} → ${n(80)} → ${n(145)} 물리 피해. 마지막 타격에 위력이 집중됨.`; break;
    case 'split_barrage':
      pulses(hit(100, { target: 'NEAREST_ENEMY', shape: 'CHAIN', range: 4, maxTargets: 3 }), 2, .35);
      text = `가까운 적에서 시작해 서로 다른 최대 3명에게 ${n(100)} 마법 피해. 0.35초 뒤 한 번 더 발사.`; break;
    case 'seeking_bolt':
      effects.push(hit(230, { target: 'HIGHEST_AD_ENEMY', damageType: 'PHYSICAL' }), buff('attackDamage', -.15, 'HIGHEST_AD_ENEMY', { duration: 3 }));
      text = `공격력이 가장 높은 적을 저격해 ${n(230)} 물리 피해와 공격력 15% 감소(3초).`; break;
    case 'carry_charge':
      effects.push(buff('attackSpeed', .45), buff('attackDamage', .2)); pulses(hit(75, { damageType: 'PHYSICAL' }), 2, .2);
      text = `4초간 공격속도 +45%, 공격력 +20%. 장전 타격으로 ${n(75)} 물리 피해를 2회.`; break;
    case 'tempo_banner':
      effects.push(buff('attackSpeed', .3, 'ALL_ALLIES', nearby), { kind: 'MANA_ADD', value: 8, target: 'ALL_ALLIES', excludeSelf: true, ...nearby });
      text = `2칸 내 최대 4명의 아군에게 4초간 공격속도 +30%. 자신 외 대상은 마나 8 회복.`; break;
    case 'bulwark_circle':
      effects.push(shield(165, 'ALL_ALLIES', nearby), { kind: 'STAT_ADD', stat: 'armor', value: 20, duration: 4, refresh: true, target: 'ALL_ALLIES', ...nearby });
      text = `2칸 내 최대 4명의 아군에게 ${n(165)} 보호막과 방어력 +20을 4초간 부여.`; break;
    case 'sanctuary':
      pulses({ kind: 'HEAL', value: n(55), target: 'ALL_ALLIES', ...nearby }, 3, .5);
      effects.push({ kind: 'CLEANSE', target: 'ALL_ALLIES', ...nearby });
      text = `2칸 내 최대 4명 아군의 제어 효과를 해제하고, 0.5초 간격으로 ${n(55)}씩 3회 회복.`; break;
    case 'command_pulse':
      effects.push(buff('attackSpeed', .45, 'HIGHEST_AD_ALLY'), shield(200, 'HIGHEST_AD_ALLY'));
      text = `공격력이 가장 높은 아군 1명에게 4초간 공격속도 +45%와 ${n(200)} 보호막.`; break;
    case 'retaliate_storm':
      pulses(hit(60, { target: 'ALL_ENEMIES', radius: 2, maxTargets: 4, leech: .15 }), 3, .4);
      effects.push(shield(120));
      text = `${n(120)} 보호막을 얻고 주변 2칸 최대 4명에게 0.4초 간격으로 ${n(60)} 마법 피해 3회. 체력 피해의 15% 회복.`; break;
    case 'bastion_growth':
      effects.push({ kind: 'STACKING_STAT', stat: 'hp', value: 70, maxStacks: 4 }, { kind: 'DAMAGE_REDUCTION', value: .18, duration: 4, target: 'SELF' }, shield(150));
      text = `시전마다 최대 체력 +70(전투당 최대 4중첩). 4초간 받는 피해 18% 감소와 ${n(150)} 보호막.`; break;
    case 'binding_line':
      effects.push(hit(130, line), cc('STUN', 1, line));
      text = `직선 6칸 최대 4명에게 ${n(130)} 마법 피해와 1초 기절.`; break;
    case 'disarm_cone':
      effects.push(hit(150, cone), cc('DISARM', 1.8, cone));
      text = `전방 3칸 최대 4명에게 ${n(150)} 마법 피해. 1.8초간 일반 공격 봉쇄, 스킬은 사용 가능.`; break;
    case 'silence_zone':
      effects.push(hit(130, area), cc('SILENCE', 2, area));
      text = `대상 주변 1칸 최대 4명에게 ${n(130)} 마법 피해와 2초 침묵. 일반 공격과 이동은 가능.`; break;
    case 'delayed_prison':
      effects.push(hit(75, area), hit(95, { ...area, delay: .8 }), cc('STUN', 1.4, { ...area, delay: .8 }));
      text = `주변 1칸 최대 4명에게 ${n(75)} 마법 피해, 0.8초 뒤 ${n(95)} 추가 피해와 1.4초 기절.`; break;
    case 'draining_tether':
      effects.push(hit(175), { kind: 'MANA_DRAIN', value: 15, target }, buff('attackSpeed', -.25, target, { duration: 3 }));
      text = `대상에게 ${n(175)} 마법 피해, 현재 마나 15 제거, 3초간 공격속도 25% 감소.`; break;
    case 'frost_front':
      effects.push(hit(110, { radius: 2, maxTargets: 4 }), cc('SLOW', 3, { radius: 2, maxTargets: 4, value: .3 }), cc('STUN', .6, { radius: 2, maxTargets: 4 }));
      text = `주변 2칸 최대 4명에게 ${n(110)} 마법 피해, 0.6초 기절과 3초 둔화.`; break;
    case 'triage_echo':
      pulses({ kind: 'HEAL', value: n(100), target: 'LOWEST_HP_ALLY' }, 3, .45);
      text = `처음 선택한 체력 비율이 가장 낮은 아군에게 ${n(100)}씩 0.45초 간격으로 3회 회복. 사망하면 새 대상 선택.`; break;
    case 'rescue_barrier':
      effects.push({ kind: 'HEAL_MISSING_PCT', value: .25, target }, shield(185, target));
      text = `체력 비율이 가장 낮은 아군의 잃은 체력 25%를 회복하고 ${n(185)} 보호막(4초).`; break;
    case 'relay_lantern':
      effects.push(shield(180, target, { shape: 'CHAIN', range: 3, maxTargets: 3 }));
      text = `가장 위급한 아군부터 3칸 간격으로 최대 3명에게 각각 ${n(180)} 보호막(4초)을 연결.`; break;
    case 'cleanse_hymn':
      effects.push({ kind: 'CLEANSE', target: 'LOWEST_HP_ALLIES', maxTargets: 3 }, { kind: 'HEAL', value: n(150), target: 'LOWEST_HP_ALLIES', maxTargets: 3 });
      text = `체력 비율이 낮은 아군 최대 3명의 기절·침묵·무장해제·둔화·도발을 해제하고 ${n(150)} 회복.`; break;
    case 'power_link':
      effects.push({ kind: 'HEAL', value: n(210), target }, buff('attackSpeed', .35, target), buff('abilityPower', .2, target));
      text = `가장 위급한 아군을 ${n(210)} 회복. 같은 아군에게 4초간 공격속도 +35%, 주문력 +20%.`; break;
    case 'challenge_bastion':
      effects.push(shield(320), { kind: 'TAUNT', duration: 2, target: 'ALL_ENEMIES', radius: 2, maxTargets: 3 }, { kind: 'CC_IMMUNE', duration: 1.5, target: 'SELF' });
      text = `${n(320)} 보호막(4초), 1.5초 제어 면역. 주변 2칸 최대 3명을 2초 도발.`; break;
    case 'counter_surge':
      effects.push(shield(250), hit(145, { target: 'ALL_ENEMIES', radius: 2, maxTargets: 4, delay: .7, leech: .2 }));
      text = `${n(250)} 보호막을 얻고 0.7초 뒤 주변 2칸 최대 4명에게 ${n(145)} 마법 피해. 체력 피해의 20% 회복.`; break;
    case 'iron_drain':
      effects.push({ kind: 'DAMAGE_REDUCTION', value: .2, duration: 4, target: 'SELF' });
      pulses(hit(75, { target: 'ALL_ENEMIES', radius: 1, maxTargets: 3, leech: .45 }), 3, .5);
      text = `4초간 받는 피해 20% 감소. 주변 1칸 최대 3명에게 ${n(75)} 마법 피해 3회, 체력 피해의 45% 회복.`; break;
    case 'guardian_vow':
      effects.push(shield(210, 'ALL_ALLIES', { radius: 1, maxTargets: 3 }), { kind: 'TAUNT', duration: 1.5, target: 'ALL_ENEMIES', radius: 2, maxTargets: 3 });
      text = `주변 1칸 최대 3명 아군에게 ${n(210)} 보호막. 주변 적 최대 3명을 1.5초 도발.`; break;
    case 'isolation_strike':
      effects.push(hit(255, { damageType: 'PHYSICAL', isolatedMultiplier: 1.4 }));
      text = `체력 비율이 가장 낮은 적에게 ${n(255)} 물리 피해. 대상 1칸 내 다른 적이 없으면 피해 40% 증가.`; break;
    case 'execution_refund':
      effects.push(hit(290, { damageType: 'PHYSICAL', onKillMana: 25 }));
      text = `체력 비율이 가장 낮은 적에게 ${n(290)} 물리 피해. 이 타격으로 처치하면 마나 25 회복.`; break;
    case 'giant_cutter':
      effects.push(hit(200, { damageType: 'PHYSICAL' }), { kind: 'DAMAGE_MAXHP_PCT', value: .045, damageType: 'PHYSICAL', target });
      text = `체력 비율이 가장 낮은 적에게 ${n(200)} + 대상 최대 체력 4.5%의 물리 피해.`; break;
    case 'shadow_finish':
      effects.push({ kind: 'UNTARGETABLE', duration: .3, target: 'SELF' }, hit(280, { damageType: 'PHYSICAL', delay: .2 }), buff('attackSpeed', .3));
      text = `0.3초간 대상 지정 불가. 0.2초 뒤 최저 체력 비율 적에게 ${n(280)} 물리 피해. 4초간 공격속도 +30%.`; break;
    default: throw new Error(`Unknown tactical kit: ${pattern}`);
  }
  const race = races[unitId].representative;
  // All explicit +N% entries describe the positive STAT_MUL buffs above.
  // Damage percentages, debuffs and control durations retain their authored values.
  text = text.replace(/\+(\d+(?:\.\d+)?)%/g, (_, value: string) => `+${Math.round(utility(Number(value) / 100) * 1000) / 10}%`);
  const title = `${race.race_date.slice(0, 4)} ${race.race_name}`;
  return { ...base, effects, displayName: `${races[unitId].name} · ${PATTERN_LABELS[pattern]} (${title})`,
    description: `[${PATTERN_LABELS[pattern]}] ${text} 근거: ${title} ${race.finish_rank}위.`,
    choreography: { windup: p.windup, recovery: .3, pulseInterval: p.pulseInterval, color: p.color, variant: pattern,
      accent: p.accent, emblem: p.emblem, label: PATTERN_LABELS[pattern], motion: ['orbital_beam','cinder_field','iron_drain','retaliate_storm'].includes(pattern) ? 'CHANNEL' : effects.filter(e => e.kind === 'DAMAGE').length > 1 ? 'PULSE' : 'STRIKE' },
    template: p.bodyFamily as SkillTemplate,
  };
}
