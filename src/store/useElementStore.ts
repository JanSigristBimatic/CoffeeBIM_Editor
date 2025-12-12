import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { temporal } from 'zundo';
import type { BimElement, ElementType } from '@/types/bim';
import { updateOpeningFromElement, getHostWallId } from '@/bim/elements';
import { createIndexedDBStorage } from '@/lib/storage';
import { createLogger } from '@/lib/utils/logger';
import { setElementsHydrated } from '@/lib/storage/hydrationTracker';

const logger = createLogger('CoffeeBIM');

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

  // Transform operations
  moveElements: (ids: string[], delta: { x: number; y: number; z: number }) => void;

  // Queries
  getElement: (id: string) => BimElement | undefined;
  getElementsByType: (type: ElementType) => BimElement[];
  getElementsByStorey: (storeyId: string) => BimElement[];
  getAllElements: () => BimElement[];

  // Wall-specific
  getWallById: (id: string) => BimElement | undefined;
  getWallsForStorey: (storeyId: string) => BimElement[];

  // Space-specific
  getSpaceById: (id: string) => BimElement | undefined;
  getSpacesForStorey: (storeyId: string) => BimElement[];
  getAllSpaces: () => BimElement[];

  // Import
  importElements: (elements: BimElement[], replace?: boolean) => void;

  // Utility
  clearAll: () => void;
  clearStorey: (storeyId: string) => void;
}

// Typ für den serialisierten State (Map als Array)
interface SerializedElementState {
  elements: Array<[string, BimElement]>;
}

export const useElementStore = create<ElementState & ElementActions>()(
  temporal(
    persist(
      (set, get) => ({
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

      // Transform operations
      moveElements: (ids, delta) =>
        set((state) => {
          const newElements = new Map(state.elements);

          for (const id of ids) {
            const element = newElements.get(id);
            if (!element) continue;

            // Update position
            const newPosition = {
              x: element.placement.position.x + delta.x,
              y: element.placement.position.y + delta.y,
              z: element.placement.position.z + delta.z,
            };

            // Handle wall-specific updates (startPoint/endPoint)
            let wallData = element.wallData;
            if (wallData) {
              wallData = {
                ...wallData,
                startPoint: {
                  x: wallData.startPoint.x + delta.x,
                  y: wallData.startPoint.y + delta.y,
                },
                endPoint: {
                  x: wallData.endPoint.x + delta.x,
                  y: wallData.endPoint.y + delta.y,
                },
              };
            }

            newElements.set(id, {
              ...element,
              placement: {
                ...element.placement,
                position: newPosition,
              },
              ...(wallData && { wallData }),
            });
          }

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

      // Space-specific
      getSpaceById: (id) => {
        const element = get().elements.get(id);
        return element?.type === 'space' ? element : undefined;
      },

      getSpacesForStorey: (storeyId) =>
        Array.from(get().elements.values()).filter(
          (e) => e.type === 'space' && e.parentId === storeyId
        ),

      getAllSpaces: () =>
        Array.from(get().elements.values()).filter((e) => e.type === 'space'),

      // Import
      importElements: (elements, replace = true) =>
        set((state) => {
          if (replace) {
            return { elements: new Map(elements.map((e) => [e.id, e])) };
          }
          const newElements = new Map(state.elements);
          elements.forEach((e) => newElements.set(e.id, e));
          return { elements: newElements };
        }),

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
    }),
    {
      name: 'coffeebim-elements',
      storage: createIndexedDBStorage<SerializedElementState>(),
      // Konvertiere Map zu Array für Speicherung
      partialize: (state) => {
        const serialized = {
          elements: Array.from(state.elements.entries()),
        };
        logger.log('Speichere Elemente:', serialized.elements.length);
        return serialized;
      },
      // Konvertiere Array zuruck zu Map beim Laden
      merge: (persistedState, currentState) => {
        const persisted = persistedState as SerializedElementState | undefined;
        logger.log('Lade Elemente, persisted:', persisted);
        if (!persisted || !persisted.elements) {
          logger.log('Keine gespeicherten Elemente gefunden');
          return currentState;
        }
        logger.log('Geladene Elemente:', persisted.elements.length);
        return {
          ...currentState,
          elements: new Map(persisted.elements),
        };
      },
      onRehydrateStorage: () => {
        logger.log('Starte Hydration...');
        return (state, error) => {
          if (error) {
            logger.error('Hydration Fehler:', error);
          } else {
            logger.log('Hydration fertig, Elemente:', state?.elements?.size ?? 0);
          }
          // Markiere Element-Store als hydriert (auch bei Fehler, um nicht zu blockieren)
          setElementsHydrated();
        };
      },
    }
    ),
    {
      // Temporal middleware options
      limit: 100, // Max history entries
      equality: (pastState, currentState) => {
        // Compare elements Maps by size and content
        if (pastState.elements.size !== currentState.elements.size) return false;
        for (const [key, value] of pastState.elements) {
          const current = currentState.elements.get(key);
          if (!current || JSON.stringify(value) !== JSON.stringify(current)) {
            return false;
          }
        }
        return true;
      },
    }
  )
);
