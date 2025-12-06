import { create } from 'zustand';
import type { BimElement, ElementType } from '@/types/bim';
import { updateOpeningFromElement, getHostWallId } from '@/bim/elements';

interface ElementState {
  elements: Map<string, BimElement>;
}

interface ElementActions {
  // CRUD operations
  addElement: (element: BimElement) => void;
  addElements: (elements: BimElement[]) => void;
  updateElement: (id: string, updates: Partial<BimElement>) => void;
  removeElement: (id: string) => void;
  removeElements: (ids: string[]) => void;

  // Queries
  getElement: (id: string) => BimElement | undefined;
  getElementsByType: (type: ElementType) => BimElement[];
  getElementsByStorey: (storeyId: string) => BimElement[];
  getAllElements: () => BimElement[];

  // Wall-specific
  getWallById: (id: string) => BimElement | undefined;
  getWallsForStorey: (storeyId: string) => BimElement[];

  // Utility
  clearAll: () => void;
  clearStorey: (storeyId: string) => void;
}

export const useElementStore = create<ElementState & ElementActions>((set, get) => ({
  elements: new Map(),

  // CRUD operations
  addElement: (element) =>
    set((state) => {
      const newElements = new Map(state.elements);
      newElements.set(element.id, element);
      return { elements: newElements };
    }),

  addElements: (elements) =>
    set((state) => {
      const newElements = new Map(state.elements);
      elements.forEach((element) => {
        newElements.set(element.id, element);
      });
      return { elements: newElements };
    }),

  updateElement: (id, updates) =>
    set((state) => {
      const element = state.elements.get(id);
      if (!element) return state;

      const newElements = new Map(state.elements);
      const updatedElement = { ...element, ...updates };
      newElements.set(id, updatedElement);

      // If this is a door or window, also update the host wall's opening
      const hostWallId = getHostWallId(updatedElement);
      if (hostWallId) {
        const hostWall = newElements.get(hostWallId);
        if (hostWall?.wallData) {
          const openingIndex = hostWall.wallData.openings.findIndex(
            (o) => o.elementId === id
          );
          if (openingIndex >= 0) {
            const updatedOpenings = [...hostWall.wallData.openings];
            updatedOpenings[openingIndex] = updateOpeningFromElement(
              updatedOpenings[openingIndex]!,
              updatedElement
            );
            newElements.set(hostWall.id, {
              ...hostWall,
              wallData: {
                ...hostWall.wallData,
                openings: updatedOpenings,
              },
            });
          }
        }
      }

      return { elements: newElements };
    }),

  removeElement: (id) =>
    set((state) => {
      const newElements = new Map(state.elements);
      newElements.delete(id);
      return { elements: newElements };
    }),

  removeElements: (ids) =>
    set((state) => {
      const newElements = new Map(state.elements);
      ids.forEach((id) => newElements.delete(id));
      return { elements: newElements };
    }),

  // Queries
  getElement: (id) => get().elements.get(id),

  getElementsByType: (type) =>
    Array.from(get().elements.values()).filter((e) => e.type === type),

  getElementsByStorey: (storeyId) =>
    Array.from(get().elements.values()).filter((e) => e.parentId === storeyId),

  getAllElements: () => Array.from(get().elements.values()),

  // Wall-specific
  getWallById: (id) => {
    const element = get().elements.get(id);
    return element?.type === 'wall' ? element : undefined;
  },

  getWallsForStorey: (storeyId) =>
    Array.from(get().elements.values()).filter(
      (e) => e.type === 'wall' && e.parentId === storeyId
    ),

  // Utility
  clearAll: () => set({ elements: new Map() }),

  clearStorey: (storeyId) =>
    set((state) => {
      const newElements = new Map(state.elements);
      for (const [id, element] of newElements) {
        if (element.parentId === storeyId) {
          newElements.delete(id);
        }
      }
      return { elements: newElements };
    }),
}));
