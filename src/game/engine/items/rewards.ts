import type { MatchState, PlayerState, PendingGrant } from '../state';
import { ALL_ITEM_DEFS } from './item-defs';
import { addItemToStorage } from './inventory';

export const ITEM_REWARD_KINDS = [
  'COMPONENT_CHOICE',
  'COMPLETED_CHOICE',
  'EMBLEM_CHOICE',
  'RADIANT_CHOICE',
  'ARTIFACT_CHOICE',
] as const;
export type ItemRewardKind = (typeof ITEM_REWARD_KINDS)[number];
export const isItemReward = (
  grant: PendingGrant,
): grant is PendingGrant & { kind: ItemRewardKind } =>
  ITEM_REWARD_KINDS.some((kind) => kind === grant.kind);

/** Explicit catalog choices; reading them never advances RNG or rerolls a reward. */
export function itemRewardOptions(kind: ItemRewardKind): string[] {
  return ALL_ITEM_DEFS.filter((item) => {
    if (kind === 'COMPONENT_CHOICE') return item.isComponent;
    if (kind === 'EMBLEM_CHOICE') return !!item.grantsTrait;
    if (kind === 'ARTIFACT_CHOICE') return item.tier === 'ARTIFACT';
    if (kind === 'RADIANT_CHOICE') return item.tier === 'RADIANT';
    return !item.isComponent && !item.tier && !item.grantsTrait && !item.tactician;
  }).map((item) => item.id);
}

/** Shared by local play, AI and the authoritative online command handler. */
export function claimItemReward(
  state: MatchState,
  player: PlayerState,
  kind: ItemRewardKind,
  itemId: string,
): boolean {
  if (state.phase !== 'ROUND_PREP' || player.hp <= 0 || !itemRewardOptions(kind).includes(itemId))
    return false;
  const grant = player.pendingGrants.find((g) => g.kind === kind && g.count > 0);
  if (!grant || !addItemToStorage(state, player, itemId)) return false;
  grant.count -= 1;
  if (grant.count === 0) player.pendingGrants.splice(player.pendingGrants.indexOf(grant), 1);
  return true;
}
