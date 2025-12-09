import { useCallback } from 'react';
import { useSelectionStore, useToolStore, useElementStore, useProjectStore } from '@/store';

/**
 * Modifier keys used during selection
 */
interface SelectionModifiers {
  shift: boolean;
  ctrl: boolean;
}

/**
 * Shared element selection logic for 2D and 3D views.
 *
 * Provides consistent selection behavior:
 * - Click: Replace selection with clicked element
 * - Shift+Click: Toggle element in selection (add/remove)
 * - Ctrl+Click: Remove from selection
 * - Ctrl+A: Select all elements in current storey
 */
export function useElementSelection() {
  const { activeTool } = useToolStore();
  const { activeStoreyId } = useProjectStore();
  const { getElementsByStorey } = useElementStore();
  const {
    select,
    toggleSelection,
    addToSelection,
    removeFromSelection,
    selectMultiple,
    clearSelection,
    isSelected,
    getSelectedIds,
    getSelectionCount,
  } = useSelectionStore();

  /**
   * Handle element selection with modifier key support
   */
  const handleElementSelect = useCallback(
    (elementId: string, modifiers: SelectionModifiers) => {
      if (activeTool !== 'select') return;

      const { shift, ctrl } = modifiers;

      if (ctrl && !shift) {
        // Ctrl+Click: Remove from selection
        removeFromSelection([elementId]);
      } else if (shift) {
        // Shift+Click: Toggle in selection
        toggleSelection(elementId);
      } else {
        // Normal click: Replace selection
        select(elementId);
      }
    },
    [activeTool, select, toggleSelection, removeFromSelection]
  );

  /**
   * Select all elements in the current storey
   */
  const selectAll = useCallback(() => {
    if (!activeStoreyId) return;

    const elements = getElementsByStorey(activeStoreyId);
    const ids = elements.map((e) => e.id);
    selectMultiple(ids);
  }, [activeStoreyId, getElementsByStorey, selectMultiple]);

  /**
   * Select elements within a rectangular region
   * @param elementIds - IDs of elements that intersect the selection box
   * @param modifiers - Keyboard modifiers
   */
  const handleBoxSelect = useCallback(
    (elementIds: string[], modifiers: SelectionModifiers) => {
      if (activeTool !== 'select') return;

      const { shift, ctrl } = modifiers;

      if (elementIds.length === 0) {
        if (!shift && !ctrl) {
          clearSelection();
        }
        return;
      }

      if (ctrl) {
        // Ctrl+Box: Remove from selection
        removeFromSelection(elementIds);
      } else if (shift) {
        // Shift+Box: Add to selection
        addToSelection(elementIds);
      } else {
        // Normal box: Replace selection
        selectMultiple(elementIds);
      }
    },
    [activeTool, selectMultiple, addToSelection, removeFromSelection, clearSelection]
  );

  /**
   * Handle click on empty space
   */
  const handleEmptyClick = useCallback(
    (modifiers: SelectionModifiers) => {
      if (activeTool !== 'select') return;

      // Don't clear selection if shift is held
      if (!modifiers.shift && !modifiers.ctrl) {
        clearSelection();
      }
    },
    [activeTool, clearSelection]
  );

  return {
    handleElementSelect,
    handleBoxSelect,
    handleEmptyClick,
    selectAll,
    isSelected,
    getSelectedIds,
    getSelectionCount,
    clearSelection,
  };
}
