import { create } from 'zustand';

interface SelectionState {
  selectedIds: Set<string>;
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

  // Utility
  clearSelection: () => void;
  isSelected: (id: string) => boolean;
  getSelectedIds: () => string[];
  getSelectionCount: () => number;
}

export const useSelectionStore = create<SelectionState & SelectionActions>((set, get) => ({
  selectedIds: new Set(),

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

  // Utility
  clearSelection: () => set({ selectedIds: new Set() }),

  isSelected: (id) => get().selectedIds.has(id),

  getSelectedIds: () => Array.from(get().selectedIds),

  getSelectionCount: () => get().selectedIds.size,
}));
