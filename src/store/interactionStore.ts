import { create } from 'zustand';
import type { TraitId } from '../game/engine/types';

export type Inspection =
  | { kind: 'unit'; id: string; playerId: string }
  | { kind: 'combat'; id: string }
  | { kind: 'trait'; id: TraitId; playerId: string }
  | { kind: 'item'; id: string }
  | { kind: 'recap' };

/** Transient UI state; never serialized into a match or sent as a game command. */
export const useInteractionStore = create<{
  inspection: Inspection | null;
  hoveredUnit: string | null;
  draggedUnit: string | null;
  itemCombine: { source: string; target: string; resultId: string } | null;
  previewCombine: (preview: { source: string; target: string; resultId: string } | null) => void;
  inspect: (inspection: Inspection | null) => void;
  hover: (id: string | null) => void;
  drag: (id: string | null) => void;
  reset: () => void;
}>((set) => ({
  inspection: null, hoveredUnit: null, draggedUnit: null, itemCombine: null,
  previewCombine: (itemCombine) => set({ itemCombine }),
  inspect: (inspection) => set({ inspection }),
  hover: (hoveredUnit) => set({ hoveredUnit }),
  drag: (draggedUnit) => set({ draggedUnit }),
  reset: () => set({ inspection: null, hoveredUnit: null, draggedUnit: null, itemCombine: null }),
}));
