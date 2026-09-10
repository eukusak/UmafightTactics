import { SEASON_IDS, type SeasonId } from '../engine/seasons/catalog';
import { z } from 'zod';
import { ITEM_REWARD_KINDS } from '../engine/items/rewards';
import type { MatchState } from '../engine/state';
import type { BattleFrame } from '../engine/battle/engine';

const id = z.string().min(1).max(80);
const cell = z.object({ q: z.number().int().min(0).max(6), r: z.number().int().min(0).max(3) }).strict();
export const commandSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('itemReward'), kind: z.enum(ITEM_REWARD_KINDS), item: id }).strict(),
  z.object({ action: z.literal('buy'), slot: z.number().int().min(0).max(8) }).strict(),
  z.object({ action: z.literal('sell'), unit: id }).strict(),
  z.object({ action: z.literal('reroll') }).strict(),
  z.object({ action: z.literal('xp') }).strict(),
  z.object({ action: z.literal('lock') }).strict(),
  z.object({ action: z.literal('move'), unit: id, position: cell.nullable() }).strict(),
  z.object({ action: z.literal('equip'), unit: id, item: id }).strict(),
  z.object({ action: z.literal('combineItems'), source: id, target: id }).strict(),
  z.object({ action: z.literal('augment'), id }).strict(),
  z.object({ action: z.literal('carouselMove'), target: z.object({ x: z.number().finite().min(0).max(1100), y: z.number().finite().min(0).max(650) }).strict(), option: z.number().int().min(0).max(15).nullable() }).strict(),
  z.object({ action: z.literal('draft'), index: z.number().int().min(0).max(15) }).strict(),
]);
export type OnlineCommand = z.infer<typeof commandSchema>;
const name = z.string().trim().min(1).max(20);
const code = z.string().regex(/^[A-Z2-9]{6}$/);
export const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('create'), name, seasonId: z.enum(SEASON_IDS).optional() }).strict(),
  z.object({ type: z.literal('join'), name, code }).strict(),
  z.object({ type: z.literal('resume'), code, token: z.string().min(32).max(80) }).strict(),
  z.object({ type: z.literal('ready'), ready: z.boolean() }).strict(),
  z.object({ type: z.literal('start'), fillAi: z.boolean() }).strict(),
  z.object({ type: z.literal('addAi') }).strict(),
  z.object({ type: z.literal('removeAi'), id }).strict(),
  z.object({ type: z.literal('leave') }).strict(),
  z.object({ type: z.literal('command'), seq: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), round: z.string().max(16), command: commandSchema }).strict(),
]);
export type ClientMessage = z.infer<typeof clientMessageSchema>;
export type RoomView = { seasonId: SeasonId; code: string; hostId: string; started: boolean; seats: Array<{ id: string; name: string; ready: boolean; connected: boolean; ai?: boolean }>; deadline: number; serverNow: number };
export type ServerMessage =
  | { type: 'welcome'; code: string; token: string; playerId: string; lastSeq: number }
  | { type: 'room'; room: RoomView }
  | { type: 'state'; match: MatchState; playerId: string; deadline: number; serverNow: number; battleId: string | null; battleTime: number; settled: boolean }
  | { type: 'frames'; battleId: string; frames: BattleFrame[]; time: number; reset: boolean }
  | { type: 'ack'; seq: number; sound?: 'level-up' }
  | { type: 'error'; message: string };
