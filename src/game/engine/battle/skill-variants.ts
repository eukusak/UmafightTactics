/** Authored tactical specializations. Keep the reviewed body-action family. */
import type { EffectDef, SkillDef, SkillTemplate } from '../types';

const groups = {
  dash_guard: 'tamamo_cross winning_ticket still_in_love neo_universe chrono_genesis rose_kingdom efforia',
  dash_scorch: 'gold_ship inari_one sweep_tosho copano_rickey orfevre gran_alegria',
  burst_echo: 'silence_suzuka taiki_shuttle mihono_bourbon curren_chan transcend aston_machan',
  burst_flame: 'daiwa_scarlet smart_falcon believe forever_young verxina',
  volley_pierce: 'narita_brian daiichi_ruby satono_crown almond_eye',
  volley_siphon: 'agnes_digital agnes_tachyon seeking_the_pearl bubble_gum_fellow',
  aura_sustain: 'mejiro_mcqueen hishi_akebono yukino_bijin meisho_doto mejiro_ardan cesario fusaichi_pandora espoir_city',
  aura_rally: 'maruzensky sakura_bakushin_o daitaku_helios twin_turbo kitasan_black tap_dance_city rhein_kraft calstone_light_o titleholder',
  control_silence: 'air_shakur mr_cb nice_nature matikanetannhauser sirius_symboli tanino_gimlet sounds_of_earth air_messiah loves_only_you',
  control_frost: 'eishin_flash gold_city super_creek biko_pegasus mejiro_bright sakura_laurel cheval_grand win_variation red_desire marche_lorraine',
  heal_regen: 'matikanefukukitaru ikuno_dictus yamanin_zephyr wonder_acute',
  heal_rescue: 'el_condor_pasa king_halo dantsu_flame curren_bouquetdor',
  shield_rebound: 'tm_opera_o air_groove marvelous_sunday',
  shield_resolve: 'rice_shower stay_gold rulership',
  execute_siphon: 'hishi_miracle buena_vista',
  execute_giant: 'durandal',
} as const;
const authored = new Map(Object.entries(groups).flatMap(([variant, ids]) => ids.split(' ').map(id => [id, variant] as const)));
const defaults: Record<SkillTemplate, string> = {
  DASH_LINE: 'dash_break', AOE_BURST: 'burst_shred', MULTI_SHOT: 'volley_focus',
  AURA: 'aura_guard', CONTROL: 'control_bind', HEAL_BUFF: 'heal_barrier',
  SHIELD_TAUNT: 'shield_fortress', SINGLE_EXECUTE: 'execute_break',
  BACKLINE_DIVE: 'dive', CONE: 'cone', RAMP: 'ramp', SUMMON: 'summon',
};
const family: Record<SkillTemplate, string> = {
  DASH_LINE: 'dash', AOE_BURST: 'burst', MULTI_SHOT: 'volley', AURA: 'aura',
  CONTROL: 'control', HEAL_BUFF: 'heal', SHIELD_TAUNT: 'shield', SINGLE_EXECUTE: 'execute',
  BACKLINE_DIVE: 'dive', CONE: 'cone', RAMP: 'ramp', SUMMON: 'summon',
};

export function specializeSkill(unitId: string, skill: SkillDef): SkillDef {
  const variant = authored.get(unitId) ?? defaults[skill.template];
  if (!variant.startsWith(family[skill.template])) throw new Error(`${unitId}: specialization does not match reviewed motion`);
  const effects: EffectDef[] = skill.effects.map(e => ({ ...e }));
  const damage = effects.find(e => e.kind === 'DAMAGE');
  const target = skill.targetRule;
  const area = damage?.radius;
  let text = '', color = '#b9ddff';
  const add = (...extra: EffectDef[]): void => { effects.push(...extra); };
  switch (variant) {
    case 'dash_break':
      effects.splice(1, 0, { kind: 'SUNDER_ARMOR_PCT', value: .2, duration: 4, target, radius: area });
      text = '돌파 직전에 범위 내 적의 방어력을 4초간 20% 감소.'; color = '#ffcc74'; break;
    case 'dash_guard':
      add({ kind: 'SHIELD_MAXHP_PCT', value: .12, duration: 3, target: 'SELF' });
      text = '돌파 직후 최대 체력 12% 보호막을 3초간 획득.'; color = '#8ed9ff'; break;
    case 'dash_scorch':
      add({ kind: 'BURN', value: .01, duration: 3, target, radius: area });
      text = '돌파한 적을 3초간 불태워 초당 최대 체력 1%의 고정피해.'; color = '#ff9b76'; break;
    case 'burst_echo':
      if (damage) {
        damage.value = Math.round((damage.value ?? 0) * .5);
        add({ ...damage, delay: .4 });
      }
      text = '기본 폭발 피해를 절반씩 나누어 최초 방출과 0.4초 뒤 두 번 발생.'; color = '#d2b5ff'; break;
    case 'burst_flame':
      add({ kind: 'BURN', value: .01, duration: 3, target, radius: area }, { kind: 'WOUND', duration: 3, target, radius: area });
      text = '폭발 후 3초간 초당 최대 체력 1%의 고정피해와 회복 감소 33%.'; color = '#ffa17e'; break;
    case 'burst_shred':
      effects.unshift({ kind: 'SHRED_MR_PCT', value: .2, duration: 4, target, radius: area });
      text = '폭발 직전에 범위 내 적의 마법 저항력을 4초간 20% 감소.'; color = '#bba2ff'; break;
    case 'volley_pierce':
      effects.unshift({ kind: 'SUNDER_ARMOR_PCT', value: .2, duration: 4, target });
      text = '첫 발 직전에 대상의 방어력을 4초간 20% 감소.'; color = '#ffe09c'; break;
    case 'volley_siphon':
      add({ kind: 'HEAL_MAXHP_PCT', value: .08, target: 'SELF', delay: 2 / 6 });
      text = '세 번째 발사 때 자신의 최대 체력 8% 회복.'; color = '#96eacb'; break;
    case 'volley_focus':
      add({ kind: 'STAT_MUL', stat: 'attackSpeed', value: .2, duration: 3, target: 'SELF', delay: 2 / 6 });
      text = '세 번째 발사 후 3초간 공격속도 +20%.'; color = '#ffcf8c'; break;
    case 'aura_sustain':
      for (const delay of [0, .3, .6]) add({ kind: 'HEAL_MAXHP_PCT', value: .02, target: 'ALL_ALLIES', delay });
      text = '오라 방출 후 0.3초 간격으로 아군 전체의 최대 체력 2%씩 세 번 회복.'; color = '#97efd0'; break;
    case 'aura_rally':
      add({ kind: 'STAT_MUL', stat: 'moveSpeedHexPerSec', value: .25, duration: 4, target: 'ALL_ALLIES' });
      text = '아군 전체가 4초간 이동속도 +25%.'; color = '#ffe69d'; break;
    case 'aura_guard':
      add({ kind: 'SHIELD_MAXHP_PCT', value: .08, duration: 4, target: 'ALL_ALLIES' });
      text = '아군 전체가 최대 체력 8% 보호막을 4초간 획득.'; color = '#a9dfff'; break;
    case 'control_silence':
      for (const e of effects) if (e.status === 'STUN') { e.status = 'SILENCE'; e.duration = 2.5; }
      text = '기절 대신 2.5초 침묵: 이동과 기본 공격은 가능하지만 스킬 시전을 차단.'; color = '#d4adff'; break;
    case 'control_frost':
      for (const e of effects) if (e.status === 'STUN') e.duration = .75;
      add({ kind: 'STAT_MUL', stat: 'attackSpeed', value: -.2, duration: 3, target, radius: area });
      text = '기절 시간을 0.75초로 줄이고 적의 공격속도를 3초간 20% 감소.'; color = '#a1e7ff'; break;
    case 'control_bind':
      add({ kind: 'STAT_MUL', stat: 'moveSpeedHexPerSec', value: -.25, duration: 3, target, radius: area });
      text = '기절과 함께 적의 이동속도를 3초간 25% 감소.'; color = '#cab4ff'; break;
    case 'heal_regen': {
      const heal = effects.find(e => e.kind === 'HEAL');
      if (heal) { heal.value = Math.round((heal.value ?? 0) / 3); add({ ...heal, delay: .3 }, { ...heal, delay: .6 }); }
      text = '기본 회복을 3등분해 0.3초 간격으로 전달. 최초로 선택한 아군을 계속 지원.'; color = '#97efd0'; break;
    }
    case 'heal_rescue':
      add({ kind: 'HEAL_MISSING_PCT', value: .12, target: 'LOWEST_HP_ALLY' });
      text = '선택한 아군의 잃은 체력 12%를 추가 회복.'; color = '#baffbc'; break;
    case 'heal_barrier':
      add({ kind: 'SHIELD_MAXHP_PCT', value: .12, duration: 4, target: 'LOWEST_HP_ALLY' });
      text = '회복받은 아군에게 최대 체력 12% 보호막을 4초간 부여.'; color = '#a9e8f5'; break;
    case 'shield_rebound':
      add({ kind: 'DAMAGE_MAXHP_PCT', value: .04, damageType: 'MAGIC', target: 'ALL_ENEMIES', radius: 2 });
      text = '방벽을 펼치며 2칸 내 적에게 대상 최대 체력 4%의 마법피해.'; color = '#ffcc96'; break;
    case 'shield_resolve':
      add({ kind: 'HEAL_MISSING_PCT', value: .18, target: 'SELF' });
      text = '방벽을 펼치며 자신의 잃은 체력 18% 회복.'; color = '#b5efd1'; break;
    case 'shield_fortress':
      add({ kind: 'CC_IMMUNE', duration: 2, target: 'SELF' });
      text = '방벽 방출 후 2초간 군중 제어 면역.'; color = '#a2d9ff'; break;
    case 'execute_siphon':
      add({ kind: 'HEAL_MAXHP_PCT', value: .1, target: 'SELF' });
      text = '결정타 방출 때 자신의 최대 체력 10% 회복.'; color = '#f4aaca'; break;
    case 'execute_giant':
      effects.unshift({ kind: 'DAMAGE_MAXHP_PCT', value: .04, damageType: 'PHYSICAL', target });
      text = '결정타 전에 대상 최대 체력 4%의 물리피해 추가.'; color = '#ffbf92'; break;
    case 'execute_break':
      effects.unshift({ kind: 'SUNDER_ARMOR_PCT', value: .25, duration: 4, target });
      text = '결정타 전에 대상의 방어력을 4초간 25% 감소.'; color = '#f3d697'; break;
  }
  const description = variant === 'control_silence' ? skill.description.replace('1.5초간 기절시킨다.', '2.5초간 침묵시킨다.')
    : variant === 'control_frost' ? skill.description.replace('1.5초간 기절시킨다.', '0.75초간 기절시킨다.') : skill.description;
  return { ...skill, effects, description: `${description} ${text}`.trim(),
    choreography: { windup: skill.template === 'MULTI_SHOT' ? 0 : 2 / 6, recovery: 1 / 3,
      pulseInterval: 1 / 6, color, variant } };
}
