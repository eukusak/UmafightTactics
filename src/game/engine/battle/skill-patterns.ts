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
      text = `안쪽으로 파고들며 직선 6칸의 최대 4명을 제칩니다. 4초 동안 방어력이 20% 무너지고 ${n(190)}의 물리 피해를 입습니다.`; break;
    case 'pursuit_flurry':
      effects.push(dash); pulses(hit(78, { damageType: 'PHYSICAL' }), 3); effects.push(buff('attackSpeed', .2));
      text = `한 상대에게 붙어 ${n(78)}의 물리 피해를 세 번 몰아치고, 4초 동안 공격속도가 +20% 오릅니다. 상대가 먼저 쓰러지면 남은 타격은 다음 상대를 찾아갑니다.`; break;
    case 'drain_arc':
      effects.push(dash, hit(165, { damageType: 'PHYSICAL', ...cone, leech: .25 }));
      text = `앞으로 밀고 들어가 부채꼴 3칸의 최대 4명에게 ${n(165)}의 물리 피해를 입히고, 실제로 깎은 체력의 25%를 회복합니다.`; break;
    case 'dash_feint':
      effects.push(shield(130), { ...dash, delay: .25 }, hit(230, { damageType: 'PHYSICAL', delay: .25 }), cc('SLOW', 2, { value: .3, delay: .25 }));
      text = `${n(130)}의 보호막을 두르고 0.25초 뒤 뛰어들어, 상대에게 ${n(230)}의 물리 피해를 입히고 2초 동안 발을 묶습니다.`; break;
    case 'trample_wave':
      effects.push(dash, hit(175, { damageType: 'PHYSICAL', ...area }), cc('STUN', .65, area));
      text = `뛰어든 자리 1칸 안의 최대 4명에게 ${n(175)}의 물리 피해를 입히고 0.65초 동안 기절시킵니다.`; break;
    case 'crossing_echo':
      effects.push(dash, hit(120, { damageType: 'PHYSICAL', ...line }), hit(85, { damageType: 'MAGIC', ...line, delay: .45 }));
      text = `직선상의 최대 4명을 ${n(120)}의 물리 피해로 밀어내고, 0.45초 뒤 같은 방향으로 ${n(85)}의 마법 파동을 흘려보냅니다.`; break;
    case 'chain_spark':
      effects.push(hit(115, { shape: 'CHAIN', range: 3, maxTargets: 4 }));
      text = `섬광이 3칸 안의 다음 상대로 최대 4명까지 옮겨붙으며 각각 ${n(115)}의 마법 피해를 입힙니다. 한 번 맞은 상대는 다시 타지 않습니다.`; break;
    case 'expanding_nova':
      [0, 1, 2].forEach((radius, i) => effects.push(hit(65, { radius, maxTargets: 4, delay: i * .35 })));
      text = `0.35초 간격으로 대상을 중심에 두고 0칸, 1칸, 2칸까지 번지는 폭발이 일어나, 한 번에 최대 4명씩 ${n(65)}의 마법 피해를 입힙니다.`; break;
    case 'comet_fall':
      effects.push(hit(250, { radius: 2, maxTargets: 5 }));
      text = `0.9초 동안 힘을 모은 뒤 가장 몰려 있는 지점 2칸 안의 최대 5명에게 ${n(250)}의 마법 피해를 내리꽂습니다. 모으는 도중 기절하면 무산됩니다.`; break;
    case 'orbital_beam':
      pulses(hit(58, line), 4, .35);
      text = `직선 6칸의 최대 4명을 향해 0.35초 간격으로 네 번 광선을 쏘아 매번 ${n(58)}의 마법 피해를 입힙니다. 쏘는 동안에는 기본 공격을 하지 못합니다.`; break;
    case 'twin_orbit':
      effects.push(hit(130, line), hit(65, { ...line, damageType: 'TRUE', delay: .5 }));
      text = `직선상의 최대 4명에게 ${n(130)}의 마법 피해를 주고, 0.5초 뒤 되돌아오는 파동이 ${n(65)}의 고정 피해를 더합니다.`; break;
    case 'cinder_field':
      pulses(hit(64, area), 3, .6); effects.push({ kind: 'WOUND', duration: 3, target, ...area });
      text = `대상 주변 1칸의 최대 4명에게 0.6초 간격으로 ${n(64)}의 마법 피해를 세 번 입히고, 3초 동안 회복량을 33% 줄입니다.`; break;
    case 'fan_volley':
      pulses(hit(112, { damageType: 'PHYSICAL', ...cone }), 2, .3);
      text = `앞쪽 부채꼴 3칸의 최대 4명을 0.3초 간격으로 두 번 훑으며 매번 ${n(112)}의 물리 피해를 입힙니다.`; break;
    case 'focus_three':
      [55, 80, 145].forEach((v, i) => effects.push(hit(v, { damageType: 'PHYSICAL', delay: i * p.pulseInterval })));
      text = `한 상대를 ${n(55)}, ${n(80)}, ${n(145)}의 물리 피해로 몰아붙입니다. 마지막 한 방에 힘이 실립니다.`; break;
    case 'split_barrage':
      pulses(hit(100, { target: 'NEAREST_ENEMY', shape: 'CHAIN', range: 4, maxTargets: 3 }), 2, .35);
      text = `가까운 상대부터 서로 다른 최대 3명에게 ${n(100)}의 마법 피해를 날리고, 0.35초 뒤 한 번 더 쏩니다.`; break;
    case 'seeking_bolt':
      effects.push(hit(230, { target: 'HIGHEST_AD_ENEMY', damageType: 'PHYSICAL' }), buff('attackDamage', -.15, 'HIGHEST_AD_ENEMY', { duration: 3 }));
      text = `가장 위협적인 상대를 노려 ${n(230)}의 물리 피해를 입히고 3초 동안 공격력을 15% 떨어뜨립니다.`; break;
    case 'carry_charge':
      effects.push(buff('attackSpeed', .45), buff('attackDamage', .2)); pulses(hit(75, { damageType: 'PHYSICAL' }), 2, .2);
      text = `4초 동안 공격속도가 +45%, 공격력이 +20% 올라가고, 장전한 두 발이 각각 ${n(75)}의 물리 피해를 입힙니다.`; break;
    case 'tempo_banner':
      effects.push(buff('attackSpeed', .3, 'ALL_ALLIES', nearby), { kind: 'MANA_ADD', value: 8, target: 'ALL_ALLIES', excludeSelf: true, ...nearby });
      text = `2칸 안의 아군 최대 4명의 공격속도를 4초 동안 +30% 끌어올리고, 자신을 뺀 아군은 마나를 8 회복합니다.`; break;
    case 'bulwark_circle':
      effects.push(shield(165, 'ALL_ALLIES', nearby), { kind: 'STAT_ADD', stat: 'armor', value: 20, duration: 4, refresh: true, target: 'ALL_ALLIES', ...nearby });
      text = `2칸 안의 아군 최대 4명에게 ${n(165)}의 보호막과 방어력 +20을 4초 동안 둘러 줍니다.`; break;
    case 'sanctuary':
      pulses({ kind: 'HEAL', value: n(55), target: 'ALL_ALLIES', ...nearby }, 3, .5);
      effects.push({ kind: 'CLEANSE', target: 'ALL_ALLIES', ...nearby });
      text = `2칸 안의 아군 최대 4명을 묶고 있던 방해 효과를 풀어 주고, 0.5초 간격으로 ${n(55)}씩 세 번 회복시킵니다.`; break;
    case 'command_pulse':
      effects.push(buff('attackSpeed', .45, 'HIGHEST_AD_ALLY'), shield(200, 'HIGHEST_AD_ALLY'));
      text = `가장 잘 때리는 아군 한 명에게 4초 동안 공격속도 +45%와 ${n(200)}의 보호막을 실어 줍니다.`; break;
    case 'retaliate_storm':
      pulses(hit(60, { target: 'ALL_ENEMIES', radius: 2, maxTargets: 4, leech: .15 }), 3, .4);
      effects.push(shield(120));
      text = `${n(120)}의 보호막을 두르고 주변 2칸의 최대 4명에게 0.4초 간격으로 ${n(60)}의 마법 피해를 세 번 흩뿌리며, 깎은 체력의 15%를 회복합니다.`; break;
    case 'bastion_growth':
      effects.push({ kind: 'STACKING_STAT', stat: 'hp', value: 70, maxStacks: 4 }, { kind: 'DAMAGE_REDUCTION', value: .18, duration: 4, target: 'SELF' }, shield(150));
      text = `쓸 때마다 최대 체력이 70씩 붙어 전투당 네 번까지 쌓이고, 4초 동안 받는 피해가 18% 줄며 ${n(150)}의 보호막이 생깁니다.`; break;
    case 'binding_line':
      effects.push(hit(130, line), cc('STUN', 1, line));
      text = `직선 6칸의 최대 4명에게 ${n(130)}의 마법 피해를 입히고 1초 동안 세워 둡니다.`; break;
    case 'disarm_cone':
      effects.push(hit(150, cone), cc('DISARM', 1.8, cone));
      text = `앞쪽 3칸의 최대 4명에게 ${n(150)}의 마법 피해를 입히고, 1.8초 동안 기본 공격을 막습니다. 스킬은 그대로 나갑니다.`; break;
    case 'silence_zone':
      effects.push(hit(130, area), cc('SILENCE', 2, area));
      text = `대상 주변 1칸의 최대 4명에게 ${n(130)}의 마법 피해를 입히고 2초 동안 침묵시킵니다. 기본 공격과 이동은 막지 않습니다.`; break;
    case 'delayed_prison':
      effects.push(hit(75, area), hit(95, { ...area, delay: .8 }), cc('STUN', 1.4, { ...area, delay: .8 }));
      text = `주변 1칸의 최대 4명에게 ${n(75)}의 마법 피해를 주고, 0.8초 뒤 ${n(95)}의 피해가 한 번 더 터지며 1.4초 동안 기절시킵니다.`; break;
    case 'draining_tether':
      effects.push(hit(175), { kind: 'MANA_DRAIN', value: 15, target }, buff('attackSpeed', -.25, target, { duration: 3 }));
      text = `상대에게 ${n(175)}의 마법 피해를 입히고 마나를 15 빼앗으며, 3초 동안 공격속도를 25% 떨어뜨립니다.`; break;
    case 'frost_front':
      effects.push(hit(110, { radius: 2, maxTargets: 4 }), cc('SLOW', 3, { radius: 2, maxTargets: 4, value: .3 }), cc('STUN', .6, { radius: 2, maxTargets: 4 }));
      text = `주변 2칸의 최대 4명에게 ${n(110)}의 마법 피해를 입히고 0.6초 기절시킨 뒤, 3초 동안 발을 묶습니다.`; break;
    case 'triage_echo':
      pulses({ kind: 'HEAL', value: n(100), target: 'LOWEST_HP_ALLY' }, 3, .45);
      text = `가장 위태로운 아군을 0.45초 간격으로 ${n(100)}씩 세 번 일으켜 세웁니다. 도중에 쓰러지면 다음으로 위태로운 아군에게 넘어갑니다.`; break;
    case 'rescue_barrier':
      effects.push({ kind: 'HEAL_MISSING_PCT', value: .25, target }, shield(185, target));
      text = `가장 위태로운 아군의 잃은 체력을 25% 되돌리고 4초 동안 ${n(185)}의 보호막을 씌웁니다.`; break;
    case 'relay_lantern':
      effects.push(shield(180, target, { shape: 'CHAIN', range: 3, maxTargets: 3 }));
      text = `가장 급한 아군부터 3칸 간격으로 최대 3명까지 이어 가며 각각 ${n(180)}의 보호막을 4초 동안 걸어 줍니다.`; break;
    case 'cleanse_hymn':
      effects.push({ kind: 'CLEANSE', target: 'LOWEST_HP_ALLIES', maxTargets: 3 }, { kind: 'HEAL', value: n(150), target: 'LOWEST_HP_ALLIES', maxTargets: 3 });
      text = `위태로운 아군 최대 3명을 붙잡고 있던 기절, 침묵, 무장 해제, 둔화, 도발을 전부 풀고 ${n(150)}을 회복시킵니다.`; break;
    case 'power_link':
      effects.push({ kind: 'HEAL', value: n(210), target }, buff('attackSpeed', .35, target), buff('abilityPower', .2, target));
      text = `가장 급한 아군을 ${n(210)} 회복시키고, 그 아군에게 4초 동안 공격속도 +35%와 주문력 +20%를 얹어 줍니다.`; break;
    case 'challenge_bastion':
      effects.push(shield(320), { kind: 'TAUNT', duration: 2, target: 'ALL_ENEMIES', radius: 2, maxTargets: 3 }, { kind: 'CC_IMMUNE', duration: 1.5, target: 'SELF' });
      text = `4초 동안 ${n(320)}의 보호막을 두르고 1.5초 동안 어떤 방해도 받지 않으며, 주변 2칸의 최대 3명을 2초 동안 자신에게 붙잡아 둡니다.`; break;
    case 'counter_surge':
      effects.push(shield(250), hit(145, { target: 'ALL_ENEMIES', radius: 2, maxTargets: 4, delay: .7, leech: .2 }));
      text = `${n(250)}의 보호막을 두르고 0.7초 뒤 주변 2칸의 최대 4명에게 ${n(145)}의 마법 피해로 되받아치며, 깎은 체력의 20%를 회복합니다.`; break;
    case 'iron_drain':
      effects.push({ kind: 'DAMAGE_REDUCTION', value: .2, duration: 4, target: 'SELF' });
      pulses(hit(75, { target: 'ALL_ENEMIES', radius: 1, maxTargets: 3, leech: .45 }), 3, .5);
      text = `4초 동안 받는 피해가 20% 줄고, 주변 1칸의 최대 3명에게서 ${n(75)}의 마법 피해를 세 번 빨아들여 깎은 체력의 45%를 회복합니다.`; break;
    case 'guardian_vow':
      effects.push(shield(210, 'ALL_ALLIES', { radius: 1, maxTargets: 3 }), { kind: 'TAUNT', duration: 1.5, target: 'ALL_ENEMIES', radius: 2, maxTargets: 3 });
      text = `주변 1칸의 아군 최대 3명에게 ${n(210)}의 보호막을 씌우고, 가까운 상대 최대 3명을 1.5초 동안 자신에게 붙잡아 둡니다.`; break;
    case 'isolation_strike':
      effects.push(hit(255, { damageType: 'PHYSICAL', isolatedMultiplier: 1.4 }));
      text = `가장 지쳐 있는 상대에게 ${n(255)}의 물리 피해를 꽂습니다. 그 상대가 1칸 안에 혼자 떨어져 있으면 피해가 40% 커집니다.`; break;
    case 'execution_refund':
      effects.push(hit(290, { damageType: 'PHYSICAL', onKillMana: 25 }));
      text = `가장 지쳐 있는 상대에게 ${n(290)}의 물리 피해를 꽂고, 그대로 넘어뜨리면 마나를 25 돌려받습니다.`; break;
    case 'giant_cutter':
      effects.push(hit(200, { damageType: 'PHYSICAL' }), { kind: 'DAMAGE_MAXHP_PCT', value: .045, damageType: 'PHYSICAL', target });
      text = `가장 지쳐 있는 상대에게 ${n(200)}에 더해 그 상대 최대 체력의 4.5%만큼 물리 피해를 입힙니다.`; break;
    case 'shadow_finish':
      effects.push({ kind: 'UNTARGETABLE', duration: .3, target: 'SELF' }, hit(280, { damageType: 'PHYSICAL', delay: .2 }), buff('attackSpeed', .3));
      text = `0.3초 동안 시야에서 사라졌다가 0.2초 뒤 가장 지쳐 있는 상대에게 ${n(280)}의 물리 피해로 나타나며, 4초 동안 공격속도가 +30% 오릅니다.`; break;
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
