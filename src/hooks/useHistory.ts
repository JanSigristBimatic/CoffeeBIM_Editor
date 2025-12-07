import { useElementStore } from '@/store/useElementStore';
import { useCallback, useRef, useSyncExternalStore } from 'react';

// Cached snapshot to avoid infinite loops with useSyncExternalStore
// The snapshot must be referentially stable when values don't change
interface HistorySnapshot {
  pastLength: number;
  futureLength: number;
}

/**
 * Hook to access undo/redo functionality for element history
 *
 * Uses the temporal middleware from zundo which attaches a temporal
 * store to the main store.
 */
export function useHistory() {
  const temporalStore = useElementStore.temporal;
  const snapshotRef = useRef<HistorySnapshot>({ pastLength: 0, futureLength: 0 });

  // Subscribe to temporal store to get reactive updates
  const subscribe = useCallback(
    (callback: () => void) => temporalStore.subscribe(callback),
    [temporalStore]
  );

  const getSnapshot = useCallback((): HistorySnapshot => {
    const pastLength = temporalStore.getState().pastStates.length;
    const futureLength = temporalStore.getState().futureStates.length;

    // Only return a new object if values actually changed
    if (
      snapshotRef.current.pastLength !== pastLength ||
      snapshotRef.current.futureLength !== futureLength
    ) {
      snapshotRef.current = { pastLength, futureLength };
    }

    return snapshotRef.current;
  }, [temporalStore]);

  const { pastLength, futureLength } = useSyncExternalStore(subscribe, getSnapshot);

  const undo = useCallback(() => {
    temporalStore.getState().undo();
  }, [temporalStore]);

  const redo = useCallback(() => {
    temporalStore.getState().redo();
  }, [temporalStore]);

  const clearHistory = useCallback(() => {
    temporalStore.getState().clear();
  }, [temporalStore]);

  return {
    /** Undo the last element change */
    undo,
    /** Redo the last undone change */
    redo,
    /** Check if undo is available */
    canUndo: pastLength > 0,
    /** Check if redo is available */
    canRedo: futureLength > 0,
    /** Number of steps that can be undone */
    undoCount: pastLength,
    /** Number of steps that can be redone */
    redoCount: futureLength,
    /** Clear all history */
    clearHistory,
  };
}
