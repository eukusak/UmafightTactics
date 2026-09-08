import type { StatusKind } from '../engine/types';

/** Only timed engine statuses belong here; stat modifiers are not inferred. */
export const STATUS_PRESENTATION: Record<StatusKind, { label: string; icon: string | null }> = {
  STUN: { label: '기절', icon: 'stun' },
  SILENCE: { label: '침묵', icon: 'silence' },
  TAUNT: { label: '도발', icon: 'taunt' },
  BURN: { label: '화상', icon: 'burn' },
  WOUND: { label: '치감', icon: 'wound' },
  DISARM: { label: '무장\n해제', icon: null },
  SLOW: { label: '둔화', icon: 'attack_speed_down' },
  UNTARGETABLE: { label: '대상불가', icon: 'untargetable' },
};
