import type { SkillDef } from '../engine/types';

const labels: Record<string, string> = {
  dash_break: '방어 돌파', dash_guard: '수호 돌진', dash_scorch: '화염 돌진',
  burst_echo: '연쇄 폭발', burst_flame: '화염 폭발', burst_shred: '마력 파쇄',
  volley_focus: '집중 연사', volley_pierce: '관통 연사', volley_siphon: '회복 연사',
  aura_guard: '수호 오라', aura_sustain: '회복 파동', aura_rally: '진군 오라',
  control_bind: '진로 구속', control_frost: '냉기 압박', control_silence: '침묵 명령',
  heal_barrier: '회복 방벽', heal_rescue: '긴급 회복', heal_regen: '연속 회복',
  shield_fortress: '불굴 방벽', shield_resolve: '재생 방벽', shield_rebound: '반격 방벽',
  execute_break: '파쇄 결정타', execute_siphon: '회복 결정타', execute_giant: '거인 결정타',
};

export const skillLabel = (skill: SkillDef): string => skill.choreography?.label ?? labels[skill.choreography?.variant ?? ''] ?? '스킬';
