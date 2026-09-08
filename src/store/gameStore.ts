/**
 * Zustand store: the only bridge between the pure engine and React.
 *
 * The store owns a RoundDirector and exposes commands. All game rules live in
 * the engine; this file only sequences commands and mirrors state for render.
 */
import { create } from 'zustand';
import { DEFAULT_SEED } from '../game/engine/constants';
import { createMatch, RoundDirector } from '../game/engine/rounds/director';
import type { BattleFrame, BattleSideInput } from '../game/engine/battle/engine';
import { buyUnit, sellUnit, rollShop, teamSizeLimit, benchCapacity, applyCombines } from '../game/engine/shop';
import { payReroll, buyXp } from '../game/engine/economy';
import { equipItem, equipTactician, removeItems } from '../game/engine/items/inventory';
import { getItem } from '../game/engine/items/item-defs';
import { saveToStorage, loadFromStorage, clearSave, hasSave, restoreDirector } from '../game/engine/save';
import { getUnitDef } from '../game/engine/roster';
import { activeTraitCounts } from '../game/engine/ai';
import type { MatchState, PlayerState, HexPos, UnitInstance } from '../game/engine/state';
import type { TraitId } from '../game/engine/types';

export type Screen =
  | 'BOOT' | 'TITLE' | 'MAIN_MENU' | 'MATCH_SETUP' | 'BATTLE' | 'DRAFT'
  | 'AUGMENT' | 'COLLECTION' | 'SETTINGS' | 'RESULT';

export type Settings = {
  battleSpeed: 1 | 2 | 4 | 10;
  showDamageNumbers: boolean;
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

type GameStore = {
  screen: Screen;
  director: RoundDirector | null;
  match: MatchState | null;
  /** Bumped on every mutation so React re-renders. */
  revision: number;
  battleFrames: BattleFrame[] | null;
  battleRunning: boolean;
  spectating: string | null;
  /** Unit selected by click, for click-to-place as an alternative to dragging. */
  selectedUnitId: string | null;
  settings: Settings;
  devMode: boolean;
  lastError: string | null;

  setScreen: (screen: Screen) => void;
  newMatch: (seed?: number, name?: string) => void;
  continueMatch: () => boolean;
  hasSavedMatch: () => boolean;
  abandonMatch: () => void;

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
  unequip: (unitInstanceId: string) => void;

  chooseAugment: (augmentId: string) => void;
  pickDraft: (optionIndex: number) => void;

  startBattle: () => void;
  finishBattle: () => void;
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
  director: null,
  match: null,
  revision: 0,
  battleFrames: null,
  battleRunning: false,
  spectating: null,
  selectedUnitId: null,
  settings: { battleSpeed: 1, showDamageNumbers: true, keybinds: { ...DEFAULT_KEYBINDS } },
  devMode: typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('dev') === '1',
  lastError: null,

  setScreen: (screen) => set({ screen }),

  newMatch: (seed = DEFAULT_SEED, name = '트레이너') => {
    const match = createMatch({ seed, humanName: name });
    const director = new RoundDirector(match);
    director.beginPrep();
    saveToStorage(director);
    set({ director, match, screen: 'BATTLE', battleFrames: null, spectating: null, revision: 0 });
  },

  continueMatch: () => {
    const result = loadFromStorage();
    if (!result.ok) {
      set({ lastError: result.reason === 'ROSTER_MISMATCH'
        ? '저장된 게임이 이전 버전의 로스터로 생성되어 이어할 수 없습니다.'
        : '저장된 게임이 없습니다.' });
      return false;
    }
    const director = restoreDirector(result.save);
    set({
      director,
      match: director.state,
      screen: director.state.phase === 'GAME_OVER' ? 'RESULT' : 'BATTLE',
      battleFrames: null,
      lastError: null,
      revision: 0,
    });
    return true;
  },

  hasSavedMatch: () => hasSave(),

  abandonMatch: () => {
    clearSave();
    set({ director: null, match: null, screen: 'MAIN_MENU', battleFrames: null });
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
    return activeTraitCounts(player);
  },

  buy: (slotIndex) => {
    const { director } = get();
    const player = get().human();
    if (!director || !player) return;
    const result = buyUnit(director.state, player, slotIndex);
    if (!result.ok) set({ lastError: buyErrorMessage(result.reason) });
    else set({ lastError: null });
    bump(set);
  },

  sell: (instanceId) => {
    const { director } = get();
    const player = get().human();
    if (!director || !player) return;
    const result = sellUnit(director.state, player, instanceId);
    if (!result.ok) set({ lastError: '아이템 보관함이 가득 차 판매할 수 없습니다.' });
    bump(set);
  },

  reroll: () => {
    const { director } = get();
    const player = get().human();
    if (!director || !player) return;
    if (!payReroll(player).ok) { set({ lastError: '골드가 부족합니다.' }); return; }
    player.shop = rollShop(player, director.state.pool, director.rngs.get('shop'));
    director.syncRng();
    bump(set);
  },

  buyExperience: () => {
    const player = get().human();
    if (!player) return;
    if (!buyXp(player).ok) set({ lastError: '골드가 부족하거나 이미 최대 레벨입니다.' });
    bump(set);
  },

  toggleLock: () => {
    const player = get().human();
    if (!player) return;
    player.shopLocked = !player.shopLocked;
    bump(set);
  },

  moveUnit: (instanceId, position) => {
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

  unequip: (unitInstanceId) => {
    const { director } = get();
    const player = get().human();
    if (!director || !player) return;
    if (!removeItems(director.state, player, unitInstanceId)) {
      set({ lastError: '아이템 보관함 공간이 부족합니다.' });
    }
    bump(set);
  },

  chooseAugment: (augmentId) => {
    const { director } = get();
    const player = get().human();
    if (!director || !player) return;
    director.chooseAugment(player.id, augmentId);
    saveToStorage(director);
    bump(set);
  },

  pickDraft: (optionIndex) => {
    const { director } = get();
    const player = get().human();
    if (!director || !player) return;
    if (!director.pickDraft(player.id, optionIndex)) {
      set({ lastError: '지금은 선택할 수 없습니다.' });
    }
    saveToStorage(director);
    bump(set);
  },

  startBattle: () => {
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
    director.resolveRound();
    saveToStorage(director);
    set({ battleFrames: director.lastHumanFrames, battleRunning: true });
    bump(set);
  },

  /** Called once playback finishes (or is skipped): advances to the next round. */
  finishBattle: () => {
    const { director } = get();
    if (!director) return;
    director.advance();
    saveToStorage(director);
    set({
      battleRunning: false,
      battleFrames: null,
      screen: director.isOver ? 'RESULT' : 'BATTLE',
      spectating: null,
    });
    bump(set);
  },

  spectate: (direction) => {
    const { match, spectating } = get();
    if (!match) return;
    const alive = match.players.filter((p) => p.eliminatedAtRound === null);
    if (alive.length <= 1) return;
    const currentId = spectating ?? match.players.find((p) => p.isHuman)?.id;
    const idx = alive.findIndex((p) => p.id === currentId);
    const next = alive[(idx + direction + alive.length) % alive.length];
    set({ spectating: next.isHuman ? null : next.id });
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

  setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
  setDevMode: (on) => set({ devMode: on }),

  devGrant: (action, payload) => {
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
    const { director } = get();
    if (director) saveToStorage(director);
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
    default: return '장착할 수 없습니다.';
  }
}

export const unitLabel = (unit: UnitInstance): string => getUnitDef(unit.unitDefId).nameKo;
export type { BattleSideInput };
