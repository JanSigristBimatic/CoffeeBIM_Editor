import { create } from 'zustand';
import type { Point2D } from '@/types/geometry';

/**
 * Box selection state for rectangular selection in 2D/3D views
 */
interface BoxSelectState {
  isActive: boolean;
  startPoint: Point2D | null;
  currentPoint: Point2D | null;
}

interface SelectionState {
  selectedIds: Set<string>;
  boxSelect: BoxSelectState;
}

interface SelectionActions {
  // Single selection
  select: (id: string) => void;
  deselect: (id: string) => void;
  toggleSelection: (id: string) => void;

  // Multi selection
  selectMultiple: (ids: string[]) => void;
  addToSelection: (ids: string[]) => void;
  removeFromSelection: (ids: string[]) => void;

  // Box selection
  startBoxSelect: (point: Point2D) => void;
  updateBoxSelect: (point: Point2D) => void;
  finishBoxSelect: () => void;
  cancelBoxSelect: () => void;

  // Utility
  clearSelection: () => void;
  isSelected: (id: string) => boolean;
  getSelectedIds: () => string[];
  getSelectionCount: () => number;
  getBoxSelectBounds: () => { min: Point2D; max: Point2D } | null;
}

const INITIAL_BOX_SELECT: BoxSelectState = {
  isActive: false,
  startPoint: null,
  currentPoint: null,
};

export const useSelectionStore = create<SelectionState & SelectionActions>((set, get) => ({
  selectedIds: new Set(),
  boxSelect: INITIAL_BOX_SELECT,

  // Single selection
  select: (id) =>
    set({
      selectedIds: new Set([id]),
    }),

  deselect: (id) =>
    set((state) => {
      const newSelection = new Set(state.selectedIds);
      newSelection.delete(id);
      return { selectedIds: newSelection };
    }),

  toggleSelection: (id) =>
    set((state) => {
      const newSelection = new Set(state.selectedIds);
      if (newSelection.has(id)) {
        newSelection.delete(id);
      } else {
        newSelection.add(id);
      }
      return { selectedIds: newSelection };
    }),

  // Multi selection
  selectMultiple: (ids) =>
    set({
      selectedIds: new Set(ids),
    }),

  addToSelection: (ids) =>
    set((state) => {
      const newSelection = new Set(state.selectedIds);
      ids.forEach((id) => newSelection.add(id));
      return { selectedIds: newSelection };
    }),

  removeFromSelection: (ids) =>
    set((state) => {
      const newSelection = new Set(state.selectedIds);
      ids.forEach((id) => newSelection.delete(id));
      return { selectedIds: newSelection };
    }),

  // Box selection
  startBoxSelect: (point) =>
    set({
      boxSelect: {
        isActive: true,
        startPoint: point,
        currentPoint: point,
      },
    }),

  updateBoxSelect: (point) =>
    set((state) => ({
      boxSelect: {
        ...state.boxSelect,
        currentPoint: point,
      },
    })),

  finishBoxSelect: () =>
    set({
      boxSelect: INITIAL_BOX_SELECT,
    }),

  cancelBoxSelect: () =>
    set({
      boxSelect: INITIAL_BOX_SELECT,
    }),

  // Utility
  clearSelection: () => set({ selectedIds: new Set() }),

  isSelected: (id) => get().selectedIds.has(id),

  getSelectedIds: () => Array.from(get().selectedIds),

  getSelectionCount: () => get().selectedIds.size,

  getBoxSelectBounds: () => {
    const { boxSelect } = get();
    if (!boxSelect.isActive || !boxSelect.startPoint || !boxSelect.currentPoint) {
      return null;
    }
    return {
      min: {
        x: Math.min(boxSelect.startPoint.x, boxSelect.currentPoint.x),
        y: Math.min(boxSelect.startPoint.y, boxSelect.currentPoint.y),
      },
      max: {
        x: Math.max(boxSelect.startPoint.x, boxSelect.currentPoint.x),
        y: Math.max(boxSelect.startPoint.y, boxSelect.currentPoint.y),
      },
    };
  },
}));
