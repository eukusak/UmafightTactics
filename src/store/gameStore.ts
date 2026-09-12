import { applyItemTool, type ItemTool, type ItemToolTarget } from '../game/engine/items/consumables';
import { configureAudio } from '../game/ui/audio';
import { claimItemReward, type ItemRewardKind } from '../game/engine/items/rewards';
import { setCarouselTarget } from '../game/engine/rounds/carousel';
import type { CarouselPoint } from '../game/engine/state';
import { playSound } from '../game/ui/audio';
/**
 * Zustand store: the only bridge between the pure engine and React.
 *
 * The store owns a RoundDirector and exposes commands. All game rules live in
 * the engine; this file only sequences commands and mirrors state for render.
 */
import { create } from 'zustand';
import { onlineBridge } from '../game/network/bridge';
import { DEFAULT_SEED } from '../game/engine/constants';
import type { SeasonId } from '../game/engine/seasons/catalog';
import { createMatch, RoundDirector } from '../game/engine/rounds/director';
import type { BattleFrame, BattleSideInput } from '../game/engine/battle/engine';
import { buyUnit, sellUnit, rollShop, teamSizeLimit, benchCapacity, applyCombines } from '../game/engine/shop';
import { payReroll, buyXp } from '../game/engine/economy';
import { combineStoredItems, equipItem, equipTactician } from '../game/engine/items/inventory';
import { getItem } from '../game/engine/items/item-defs';
import { saveToStorage, loadFromStorage, clearSave, hasSave, restoreDirector } from '../game/engine/save';
import { getUnitDef } from '../game/engine/roster';
import { activeTraitCounts } from '../game/engine/ai';
import type { MatchState, PlayerState, HexPos, UnitInstance } from '../game/engine/state';
import type { TraitId } from '../game/engine/types';

export type Screen =
  | 'BOOT' | 'TITLE' | 'MAIN_MENU' | 'MATCH_SETUP' | 'BATTLE' | 'DRAFT'
  | 'AUGMENT' | 'COLLECTION' | 'SETTINGS' | 'RESULT' | 'ONLINE' | 'MOTION';

export type Settings = {
  resolution: 'auto' | '1280x720' | '1600x900' | '1920x1080' | '2560x1440';
  musicVolume: number;
  effectsVolume: number;
  muted: boolean;
  battleSpeed: 1 | 2 | 4 | 10;
  showDamageNumbers: boolean;
  autoContinue: boolean;
  keybinds: Record<string, string>;
};

export const DEFAULT_KEYBINDS: Record<string, string> = {
  reroll: 'd',
  buyXp: 'f',
  sellHovered: 'e',
  toggleBench: 'w',
  ownBoard: ' ',
  prevPlayer: '1',
  nextPlayer: '3',
  battleInfo: 'Tab',
  settings: 'Escape',
};

const DEFAULT_SETTINGS: Settings = { resolution: 'auto', musicVolume: .45, effectsVolume: .65, muted: false, battleSpeed: 1, showDamageNumbers: true, autoContinue: true, keybinds: { ...DEFAULT_KEYBINDS } };
function readSettings(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem('uft-settings-v2') ?? '{}');
    const settings = { ...DEFAULT_SETTINGS, ...saved, keybinds: { ...DEFAULT_KEYBINDS, ...saved.keybinds } };
    if (!['auto', '1280x720', '1600x900', '1920x1080', '2560x1440'].includes(settings.resolution)) settings.resolution = 'auto';
    for (const key of ['musicVolume', 'effectsVolume'] as const) settings[key] = Number.isFinite(settings[key]) ? Math.max(0, Math.min(1, settings[key])) : DEFAULT_SETTINGS[key];
    return settings;
  } catch { return { ...DEFAULT_SETTINGS }; }
}

type GameStore = {
  screen: Screen;
  onlinePlayerId: string | null;
  onlineBattleId: string | null;
  onlineDeadline: number;
  onlineClockOffset: number;
  networkConnected: boolean;
  director: RoundDirector | null;
  match: MatchState | null;
  /** Bumped on every mutation so React re-renders. */
  revision: number;
  battleFrames: BattleFrame[] | null;
  scoutFrames: Record<string, BattleFrame[]>;
  viewedBattleFrames: () => BattleFrame[] | null;
  battleRunning: boolean;
  battleComplete: boolean;
  battleTime: number;
  prepRemaining: number | null;
  prepPaused: boolean;
  spectating: string | null;
  /** Unit selected by click, for click-to-place as an alternative to dragging. */
  selectedUnitId: string | null;
  settings: Settings;
  devMode: boolean;
  lastError: string | null;

  setScreen: (screen: Screen) => void;
  newMatch: (seed?: number, name?: string, seasonId?: SeasonId) => void;
  continueMatch: () => boolean;
  hasSavedMatch: () => boolean;
  abandonMatch: () => void;
  exitToMainMenu: () => void;

  human: () => PlayerState | null;
  viewedPlayer: () => PlayerState | null;
  traitCounts: () => Map<TraitId, number>;

  buy: (slotIndex: number) => void;
  sell: (instanceId: string) => void;
  reroll: () => void;
  buyExperience: () => void;
  toggleLock: () => void;
  moveUnit: (instanceId: string, position: HexPos | null) => void;
  equip: (unitInstanceId: string, itemInstanceId: string) => void;
  combineItems: (sourceId: string, targetId: string) => void;
  claimItemReward: (kind: ItemRewardKind, itemId: string) => void;
  unequip: (unitInstanceId: string) => void;
  useItemTool: (kind: ItemTool, target: ItemToolTarget) => void;

  chooseAugment: (augmentId: string) => void;
  pickDraft: (optionIndex: number) => void;
  moveCarousel: (target: CarouselPoint, option?: number | null) => void;
  tickCarousel: (delta: number) => void;

  startBattle: () => void;
  finishBattle: () => void;
  completeBattle: () => void;
  setBattleTime: (seconds: number) => void;
  setPrepClock: (remaining: number, paused?: boolean) => void;
  inspectPlayer: (id: string | null) => void;
  spectate: (direction: 1 | -1) => void;
  selectUnit: (instanceId: string | null) => void;
  placeSelected: (position: HexPos | null) => void;

  setSettings: (patch: Partial<Settings>) => void;
  setDevMode: (on: boolean) => void;
  devGrant: (action: string, payload?: string) => void;
  save: () => void;
};

const bump = (set: (fn: (s: GameStore) => Partial<GameStore>) => void) =>
  set((s) => ({ revision: s.revision + 1 }));

export const useGameStore = create<GameStore>((set, get) => ({
  screen: 'BOOT',
  onlinePlayerId: null, onlineBattleId: null, onlineDeadline: 0, onlineClockOffset: 0, networkConnected: false,
  director: null,
  match: null,
  revision: 0,
  battleFrames: null,
  scoutFrames: {},
  viewedBattleFrames: () => { const s = get(); return s.spectating ? (s.onlinePlayerId ? s.scoutFrames[s.spectating] ?? null : s.director?.playerFrames.get(s.spectating) ?? null) : s.battleFrames; },
  battleRunning: false,
  battleComplete: false,
  battleTime: 0,
  prepRemaining: null, prepPaused: false,
  spectating: null,
  selectedUnitId: null,
  settings: readSettings(),
  devMode: new URLSearchParams((globalThis as { location?: { search: string } }).location?.search ?? '').get('dev') === '1',
  lastError: null,

  setScreen: (screen) => set({ screen }),

  newMatch: (seed = DEFAULT_SEED, name = '트레이너', seasonId = 's1') => {
    if (get().onlinePlayerId) onlineBridge.leave?.();
    const match = createMatch({ seed, humanName: name, seasonId });
    const director = new RoundDirector(match, true);
    director.beginPrep();
    saveToStorage(director);
    set({ director, match, screen: 'BATTLE', battleFrames: null, battleRunning: false, battleComplete: false, battleTime: 0, prepRemaining: null, prepPaused: false, selectedUnitId: null, lastError: null, spectating: null, revision: 0 });
  },

  continueMatch: () => {
    if (get().onlinePlayerId) onlineBridge.leave?.();
    const result = loadFromStorage();
    if (!result.ok) {
      set({ lastError: result.reason === 'ROSTER_MISMATCH'
        ? '저장된 게임이 이전 버전의 로스터로 생성되어 이어할 수 없습니다.'
        : '저장된 게임이 없습니다.' });
      return false;
    }
    const director = restoreDirector(result.save, true);
    const eliminated = director.state.players.some(p => p.isHuman && p.eliminatedAtRound !== null);
    if (director.state.phase === 'ROUND_RESOLVE' && (!eliminated || director.state.players.filter(p => p.eliminatedAtRound === null).length <= 1)) director.advance();
    set({
      director,
      match: director.state,
      screen: director.isOver || eliminated ? 'RESULT' : 'BATTLE',
      battleFrames: null,
      battleRunning: false, battleComplete: false, battleTime: 0, prepRemaining: null, prepPaused: false, selectedUnitId: null, spectating: null,
      lastError: null,
      revision: 0,
    });
    return true;
  },

  hasSavedMatch: () => hasSave(),

  exitToMainMenu: () => {
    if (get().onlinePlayerId) return;
    const { director } = get();
    // Save an already resolved battle once; never persist a half-settled round.
    if (director?.hasPendingSettlement) director.settleRound();
    if (director && !saveToStorage(director)) {
      set({ lastError: '진행 상황을 저장하지 못했습니다. 저장 공간을 확인한 뒤 다시 시도해 주세요.' });
      return;
    }
    set({ director: null, match: null, screen: 'MAIN_MENU', battleFrames: null, scoutFrames: {},
      battleRunning: false, battleComplete: false, battleTime: 0, prepRemaining: null, prepPaused: false,
      selectedUnitId: null, spectating: null, lastError: null });
  },

  abandonMatch: () => {
    const online = !!get().onlinePlayerId;
    if (online) onlineBridge.leave?.();
    else clearSave();
    set({ director: null, match: null, screen: 'MAIN_MENU', battleFrames: null, battleRunning: false, battleComplete: false, battleTime: 0 });
  },

  human: () => get().match?.players.find((p) => p.isHuman) ?? null,

  viewedPlayer: () => {
    const { match, spectating } = get();
    if (!match) return null;
    if (spectating) return match.players.find((p) => p.id === spectating) ?? null;
    return match.players.find((p) => p.isHuman) ?? null;
  },

  traitCounts: () => {
    const player = get().viewedPlayer();
    if (!player) return new Map();
    return activeTraitCounts(player, player.board.filter(u => u.position !== null));
  },

  buy: (slotIndex) => {
    if (get().onlinePlayerId) { onlineBridge.send?.({ action: 'buy', slot: slotIndex }); return; }
    const { director } = get();
    const player = get().human();
    if (!director || !player) return;
    const result = buyUnit(director.state, player, slotIndex);
    if (!result.ok) set({ lastError: buyErrorMessage(result.reason) });
    else set({ lastError: null });
    bump(set);
  },

  sell: (instanceId) => {
    if (get().onlinePlayerId) { onlineBridge.send?.({ action: 'sell', unit: instanceId }); return; }
    if (get().battleRunning && get().human()?.board.some((u) => u.instanceId === instanceId)) { set({ lastError: '전투 중인 유닛은 종료 후 판매할 수 있습니다.' }); return; }
    const { director } = get();
    const player = get().human();
    if (!director || !player) return;
    const result = sellUnit(director.state, player, instanceId);
    if (!result.ok) set({ lastError: result.reason === 'NOT_FOUND' ? '판매할 기물이 없습니다.' : '아이템 보관함이 가득 차 판매할 수 없습니다.' });
    else set({ lastError: null, selectedUnitId: get().selectedUnitId === instanceId ? null : get().selectedUnitId });
    bump(set);
  },

  reroll: () => {
    if (get().onlinePlayerId) { onlineBridge.send?.({ action: 'reroll' }); return; }
    const { director } = get();
    const player = get().human();
    if (!director || !player) return;
    if (!payReroll(player).ok) { set({ lastError: '골드가 부족합니다.' }); return; }
    player.shop = rollShop(player, director.state.pool, director.rngs.get('shop'));
    director.syncRng();
    bump(set);
  },

  buyExperience: () => {
    if (get().onlinePlayerId) { onlineBridge.send?.({ action: 'xp' }); return; }
    const player = get().human();
    if (!player) return;
    if (!buyXp(player).ok) set({ lastError: '골드가 부족하거나 이미 최대 레벨입니다.' });
    else { set({ lastError: null }); playSound('level-up'); }
    bump(set);
  },

  toggleLock: () => {
    if (get().onlinePlayerId) { onlineBridge.send?.({ action: 'lock' }); return; }
    const player = get().human();
    if (!player) return;
    player.shopLocked = !player.shopLocked;
    bump(set);
  },

  moveUnit: (instanceId, position) => {
    if (get().onlinePlayerId) { onlineBridge.send?.({ action: 'move', unit: instanceId, position }); return; }
    if (get().battleRunning) { set({ lastError: '전투 종료 후 배치를 변경할 수 있습니다.' }); return; }
    if (position && (!Number.isInteger(position.q) || !Number.isInteger(position.r) || position.q < 0 || position.q > 6 || position.r < 0 || position.r > 3)) return;
    const { director } = get();
    const player = get().human();
    if (!director || !player) return;
    const unit = [...player.board, ...player.bench].find((u) => u.instanceId === instanceId);
    if (!unit) return;

    if (position === null) {
      // To bench.
      if (player.board.some((u) => u.instanceId === instanceId)) {
        if (player.bench.length >= benchCapacity(player)) {
          set({ lastError: '벤치가 가득 찼습니다.' });
          return;
        }
        player.board = player.board.filter((u) => u.instanceId !== instanceId);
        unit.position = null;
        player.bench.push(unit);
      }
      bump(set);
      return;
    }

    const occupant = player.board.find(
      (u) => u.position && u.position.q === position.q && u.position.r === position.r,
    );
    const wasOnBench = player.bench.some((u) => u.instanceId === instanceId);

    if (occupant && occupant.instanceId !== instanceId) {
      // Swap places rather than refusing the drop.
      if (wasOnBench) {
        player.bench = player.bench.filter((u) => u.instanceId !== instanceId);
        player.board = player.board.filter((u) => u.instanceId !== occupant.instanceId);
        occupant.position = null;
        player.bench.push(occupant);
        unit.position = position;
        player.board.push(unit);
      } else {
        occupant.position = unit.position;
        unit.position = position;
      }
      bump(set);
      return;
    }

    if (wasOnBench) {
      if (player.board.length >= teamSizeLimit(player)) {
        set({ lastError: `팀 최대 규모(${teamSizeLimit(player)})를 초과할 수 없습니다.` });
        return;
      }
      player.bench = player.bench.filter((u) => u.instanceId !== instanceId);
      player.board.push(unit);
    }
    unit.position = position;
    set({ lastError: null });
    bump(set);
  },

  equip: (unitInstanceId, itemInstanceId) => {
    if (get().onlinePlayerId) { onlineBridge.send?.({ action: 'equip', unit: unitInstanceId, item: itemInstanceId }); return; }
    if (get().battleRunning) { set({ lastError: '전투 종료 후 장착할 수 있습니다.' }); return; }
    const { director } = get();
    const player = get().human();
    if (!director || !player) return;
    const stored = player.items.find((i) => i.instanceId === itemInstanceId);
    if (stored && getItem(stored.itemId).tactician) {
      equipTactician(player, itemInstanceId);
      bump(set);
      return;
    }
    const result = equipItem(player, unitInstanceId, itemInstanceId, get().battleRunning);
    if (!result.ok) set({ lastError: equipErrorMessage(result.reason) });
    else set({ lastError: null });
    bump(set);
  },

  combineItems: (sourceId, targetId) => {
    if (get().onlinePlayerId) { onlineBridge.send?.({ action: 'combineItems', source: sourceId, target: targetId }); return; }
    const player = get().human();
    if (!player || get().match?.phase !== 'ROUND_PREP') return;
    const result = combineStoredItems(player, sourceId, targetId, get().battleRunning);
    set({ lastError: result.ok ? null : '조합할 수 없는 아이템입니다.' });
    bump(set);
  },

  claimItemReward: (kind, itemId) => {
    if (get().onlinePlayerId) { onlineBridge.send?.({ action: 'itemReward', kind, item: itemId }); return; }
    const state = get().match, player = get().human();
    if (!state || !player) return;
    const ok = claimItemReward(state, player, kind, itemId);
    set({ lastError: ok ? null : '보상을 받을 수 없습니다. 준비 단계와 보관함 공간을 확인하세요.' });
    bump(set);
  },

  unequip: unit => get().useItemTool('REMOVER', { unit }),
  useItemTool: (kind, target) => {
    if (get().onlinePlayerId) { onlineBridge.send?.({ action: 'itemTool', kind, target }); return; }
    const director = get().director, player = get().human();
    if (!director || !player || get().battleRunning) return;
    const ok = applyItemTool(director.state, player, kind, target, director.rngs.get('loot'));
    if (ok) director.syncRng();
    set({ lastError: ok ? null : '사용할 수 없습니다. 도구 수량, 대상 장비와 보관함 공간을 확인하세요.' });
    bump(set);
  },

  chooseAugment: (augmentId) => {
    if (get().onlinePlayerId) { onlineBridge.send?.({ action: 'augment', id: augmentId }); return; }
    const { director } = get();
    const player = get().human();
    if (!director || !player) return;
    director.chooseAugment(player.id, augmentId);
    saveToStorage(director);
    bump(set);
  },

  pickDraft: (optionIndex) => {
    if (get().onlinePlayerId) { onlineBridge.send?.({ action: 'draft', index: optionIndex }); return; }
    const { director } = get();
    const player = get().human();
    if (!director || !player) return;
    if (!director.pickDraft(player.id, optionIndex)) {
      set({ lastError: '지금은 선택할 수 없습니다.' });
    }
    saveToStorage(director);
    bump(set);
  },

  moveCarousel: (target, option = null) => {
    if (get().onlinePlayerId) { onlineBridge.send?.({ action: 'carouselMove', target, option }); return; }
    const state = get().match, player = get().human();
    if (state && player) { setCarouselTarget(state, player.id, target, option); bump(set); }
  },
  tickCarousel: delta => {
    if (get().onlinePlayerId) return;
    const director = get().director;
    if (!director?.state.draft?.carousel) return;
    const beforeSecond = Math.floor(director.state.draft.carousel.elapsed / 1000);
    director.advanceCarousel(delta);
    if (!director.state.draft || Math.floor(director.state.draft.carousel!.elapsed / 1000) !== beforeSecond) saveToStorage(director);
    bump(set);
  },

  startBattle: () => {
    if (get().onlinePlayerId) return;
    const { director } = get();
    const player = get().human();
    if (!director || !player || get().battleRunning || director.isOver) return;
    if (director.state.draft || director.state.augmentOffers.some((offer) => offer.playerId === player.id && offer.chosen === null)) return;

    applyCombines(director.state, player);
    // Fill only open team slots. Existing placements stay exactly where the player put them.
    while (player.bench.length && player.board.length < teamSizeLimit(player)) {
      const unit = player.bench.shift()!;
      const def = getUnitDef(unit.unitDefId);
      const rows = def.role === 'TANK' || def.role === 'BRUISER' ? [0, 1, 2, 3] : [3, 2, 1, 0];
      const position = rows.flatMap((r) => [3, 2, 4, 1, 5, 0, 6].map((q) => ({ q, r })))
        .find((cell) => !player.board.some((other) => other.position?.q === cell.q && other.position.r === cell.r));
      if (!position) { player.bench.unshift(unit); break; }
      unit.position = position;
      player.board.push(unit);
    }
    // Resolve now and play back the frames the resolution itself produced, so
    // the animation can never disagree with the result it leads to.
    saveToStorage(director); // Reload returns to a complete preparation checkpoint.
    director.resolveRound(true, true);
    set({ battleFrames: director.lastHumanFrames, battleRunning: true, battleComplete: false, battleTime: 0, prepRemaining: null, prepPaused: false, selectedUnitId: null, lastError: null });
    bump(set);
  },

  setPrepClock: (remaining, paused) => {
    const s = get();
    if (s.prepRemaining !== null && Math.floor(s.prepRemaining / 3) !== Math.floor(remaining / 3)) { s.director?.refreshAiPlacements(); bump(set); }
    set({ prepRemaining: Math.max(0, remaining), prepPaused: paused ?? s.prepPaused });
  },

  setBattleTime: (seconds) => {
    // A final animation tick after skipping must not rewind the retained report.
    if (get().battleRunning && !get().battleComplete) set({ battleTime: seconds });
  },

  completeBattle: () => {
    if (get().onlinePlayerId) return;
    const { director, battleRunning, battleComplete } = get();
    if (!director || !battleRunning || battleComplete) return;
    director.settleRound();
    saveToStorage(director);
    set({ battleComplete: true, battleTime: Math.max(get().battleTime, ...[...director.playerFrames.values()].map(frames => frames.at(-1)?.t ?? 0)) });
    bump(set);
  },

  /** Results are committed once; continuing advances exactly one round. */
  finishBattle: () => {
    if (get().onlinePlayerId) return;
    const { director } = get();
    if (!director || !get().battleRunning) return;
    get().completeBattle();
    const eliminated = get().human()?.eliminatedAtRound != null;
    // Once only one survivor remains, advance finalizes the winner as usual.
    if (!eliminated || director.state.players.filter(p => p.eliminatedAtRound === null).length <= 1) director.advance();
    saveToStorage(director);
    set({
      battleRunning: false,
      battleComplete: false,
      prepRemaining: null, prepPaused: false,
      screen: director.isOver || eliminated ? 'RESULT' : 'BATTLE',
      spectating: null,
    });
    bump(set);
  },

  inspectPlayer: (id) => {
    const player = get().match?.players.find((p) => p.id === id && p.eliminatedAtRound === null);
    const spectating = player && player.id !== get().human()?.id ? player.id : null;
    set({ spectating, selectedUnitId: null });
    if (get().onlinePlayerId) onlineBridge.watch?.(spectating);
  },

  spectate: (direction) => {
    const { match, spectating } = get();
    if (!match) return;
    const alive = match.players.filter((p) => p.eliminatedAtRound === null);
    if (alive.length <= 1) return;
    const currentId = spectating ?? match.players.find((p) => p.isHuman)?.id;
    const idx = alive.findIndex((p) => p.id === currentId);
    const next = alive[(idx + direction + alive.length) % alive.length];
    get().inspectPlayer(next.id);
  },

  selectUnit: (instanceId) => set((s) => ({
    selectedUnitId: s.selectedUnitId === instanceId ? null : instanceId,
  })),

  /** Places the click-selected unit, mirroring what a drag would do. */
  placeSelected: (position) => {
    const id = get().selectedUnitId;
    if (!id) return;
    get().moveUnit(id, position);
    set({ selectedUnitId: null });
  },

  setSettings: (patch) => {
    const settings = { ...get().settings, ...patch };
    for (const key of ['musicVolume', 'effectsVolume'] as const) settings[key] = Number.isFinite(settings[key]) ? Math.max(0, Math.min(1, settings[key])) : DEFAULT_SETTINGS[key];
    try { localStorage.setItem('uft-settings-v2', JSON.stringify(settings)); } catch { /* Settings still apply in memory. */ }
    configureAudio(settings); set({ settings });
  },
  setDevMode: (on) => set({ devMode: on }),

  devGrant: (action, payload) => {
    if (get().onlinePlayerId) return;
    if (get().battleRunning) return;
    const { director } = get();
    const player = get().human();
    if (!director || !player) return;
    const state = director.state;
    switch (action) {
      case 'gold10': player.gold += 10; break;
      case 'gold50': player.gold += 50; break;
      case 'xp20': player.xp += 0; buyXpTimes(player, 5); break;
      case 'hp1': player.hp = 1; break;
      case 'hp50': player.hp = 50; break;
      case 'hp100': player.hp = 100; break;
      case 'components':
        for (const id of ['winner_ribbon', 'reinforced_horseshoe', 'training_belt', 'tactics_notebook',
          'spurt_band', 'focus_drop', 'weather_cloak', 'race_glove', 'factor_badge', 'support_card']) {
          state.instanceCounter += 1;
          player.items.push({ instanceId: `i${state.instanceCounter}`, itemId: id });
        }
        break;
      case 'item':
        if (payload) {
          state.instanceCounter += 1;
          player.items.push({ instanceId: `i${state.instanceCounter}`, itemId: payload });
        }
        break;
      case 'unit':
        if (payload) {
          state.instanceCounter += 1;
          const unit: UnitInstance = {
            instanceId: `u${state.instanceCounter}`,
            unitDefId: payload,
            star: 1,
            sourceCopies: 1,
            items: [],
            position: null,
          };
          player.bench.push(unit);
        }
        break;
      case 'nextRound':
        director.resolveRound();
        director.advance();
        break;
      default: break;
    }
    bump(set);
  },

  save: () => {
    if (get().onlinePlayerId) return;
    const { director } = get();
    if (director && !director.hasPendingSettlement) saveToStorage(director);
  },
}));

function buyXpTimes(player: PlayerState, times: number): void {
  for (let i = 0; i < times; i += 1) {
    player.gold += 4;
    buyXp(player);
  }
}

function buyErrorMessage(reason: string): string {
  switch (reason) {
    case 'NOT_ENOUGH_GOLD': return '골드가 부족합니다.';
    case 'BENCH_FULL': return '벤치가 가득 찼습니다.';
    case 'POOL_EMPTY': return '해당 유닛의 공유 풀이 비었습니다.';
    default: return '구매할 수 없습니다.';
  }
}

function equipErrorMessage(reason: string): string {
  switch (reason) {
    case 'NO_SLOT': return '아이템 슬롯이 가득 찼습니다.';
    case 'ALREADY_HAS_TRAIT': return '이미 해당 특성을 가지고 있습니다.';
    case 'IN_BATTLE': return '전투 중에는 장착할 수 없습니다.';
    case 'UNIQUE': return '중복 장착할 수 없는 아이템입니다.';
    case 'UNIQUE_GROUP': return '이미 같은 계열 장비를 장착했습니다. 일반·찬란한 버전도 함께 장착할 수 없습니다.';
    default: return '장착할 수 없습니다.';
  }
}

export const unitLabel = (unit: UnitInstance): string => getUnitDef(unit.unitDefId).nameKo;
export type { BattleSideInput };
