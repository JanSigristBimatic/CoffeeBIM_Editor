import { useEffect } from 'react';
import { useToolStore, useSelectionStore, useElementStore, useViewStore, usePdfUnderlayStore } from '@/store';
import type { ToolType } from '@/types/tools';

/**
 * Global keyboard shortcuts for the editor
 */
export function useKeyboardShortcuts() {
  const { setActiveTool, cancelCurrentOperation } = useToolStore();
  const { getSelectedIds, clearSelection } = useSelectionStore();
  const { removeElements } = useElementStore();
  const { toggleGrid, toggleViewMode } = useViewStore();
  const { isLoaded: hasPdf, toggleVisible: togglePdfVisible } = usePdfUnderlayStore();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't handle shortcuts when typing in input fields
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Get modifiers
      const ctrl = event.ctrlKey || event.metaKey;
      const shift = event.shiftKey;

      // Tool shortcuts (no modifiers) - German-friendly: A=Auswahl, W=Wand, T=Tür, F=Fenster, S=Säule, B=Boden
      if (!ctrl && !shift) {
        const toolShortcuts: Record<string, ToolType> = {
          a: 'select',    // Auswahl
          w: 'wall',      // Wand
          t: 'door',      // Tür
          f: 'window',    // Fenster
          s: 'column',    // Säule
          b: 'slab',      // Boden
        };

        const tool = toolShortcuts[event.key.toLowerCase()];
        if (tool) {
          event.preventDefault();
          setActiveTool(tool);
          return;
        }
      }

      // Escape - cancel current operation and return to select mode for door/window
      if (event.key === 'Escape') {
        event.preventDefault();
        const { activeTool } = useToolStore.getState();

        // For door and window tools, ESC returns to select mode
        if (activeTool === 'door' || activeTool === 'window') {
          setActiveTool('select');
          return;
        }

        // For other tools, cancel the current operation
        cancelCurrentOperation();
        clearSelection();
        return;
      }

      // Delete/Backspace - delete selected elements
      if (event.key === 'Delete' || event.key === 'Backspace') {
        const selectedIds = getSelectedIds();
        if (selectedIds.length > 0) {
          event.preventDefault();
          removeElements(selectedIds);
          clearSelection();
        }
        return;
      }

      // G - toggle grid
      if (event.key.toLowerCase() === 'g' && !ctrl) {
        event.preventDefault();
        toggleGrid();
        return;
      }

      // P - toggle PDF underlay visibility
      if (event.key.toLowerCase() === 'p' && !ctrl && hasPdf) {
        event.preventDefault();
        togglePdfVisible();
        return;
      }

      // Tab - toggle 2D/3D view
      if (event.key === 'Tab' && !ctrl) {
        event.preventDefault();
        toggleViewMode();
        return;
      }

      // Ctrl+A - select all (TODO: implement)
      // Ctrl+Z - undo (TODO: implement)
      // Ctrl+Y - redo (TODO: implement)
      // Ctrl+E - export (TODO: implement)
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    setActiveTool,
    cancelCurrentOperation,
    clearSelection,
    getSelectedIds,
    removeElements,
    toggleGrid,
    toggleViewMode,
    hasPdf,
    togglePdfVisible,
  ]);
}
