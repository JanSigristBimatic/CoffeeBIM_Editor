import { useEffect } from 'react';
import { useToolStore, useSelectionStore, useElementStore, useViewStore, usePdfUnderlayStore, useMeasurementStore } from '@/store';
import type { ToolType } from '@/types/tools';
import { useHistory } from './useHistory';

/**
 * Global keyboard shortcuts for the editor
 */
export function useKeyboardShortcuts() {
  const { setActiveTool, cancelCurrentOperation } = useToolStore();
  const { getSelectedIds, clearSelection } = useSelectionStore();
  const { removeElements, moveElements } = useElementStore();
  const { toggleGrid, cycleViewMode, toggleSnapOrthogonal, toggleDimensions, snapSize } = useViewStore();
  const { isLoaded: hasPdf, toggleVisible: togglePdfVisible } = usePdfUnderlayStore();
  const { selectedMeasurementId, removeSelectedMeasurement, cancelPlacement } = useMeasurementStore();
  const { undo, redo, canUndo, canRedo } = useHistory();

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

      // Tool shortcuts (no modifiers) - German-friendly: A=Auswahl, W=Wand, T=Tür, F=Fenster, S=Säule, B=Boden, K=Theke, R=Raum, M=Messen
      if (!ctrl && !shift) {
        const toolShortcuts: Record<string, ToolType> = {
          a: 'select',       // Auswahl
          w: 'wall',         // Wand
          t: 'door',         // Tür
          f: 'window',       // Fenster
          s: 'column',       // Säule
          b: 'slab',         // Boden
          k: 'counter',      // Theke/Tresen
          r: 'space-detect', // Raum erkennen
          m: 'measure',      // Messen
        };

        const tool = toolShortcuts[event.key.toLowerCase()];
        if (tool) {
          event.preventDefault();
          setActiveTool(tool);
          return;
        }
      }

      // Shift+R - Raum zeichnen (manual polygon)
      if (!ctrl && shift && event.key.toLowerCase() === 'r') {
        event.preventDefault();
        setActiveTool('space-draw');
        return;
      }

      // Shift+S - Treppe (stair)
      if (!ctrl && shift && event.key.toLowerCase() === 's') {
        event.preventDefault();
        setActiveTool('stair');
        return;
      }

      // Escape - cancel current operation and return to select mode
      if (event.key === 'Escape') {
        event.preventDefault();
        const { activeTool } = useToolStore.getState();

        // Cancel measurement placement if active
        if (activeTool === 'measure') {
          cancelPlacement();
        }

        // If not already in select mode, cancel operation and switch to select
        if (activeTool !== 'select') {
          cancelCurrentOperation();
          setActiveTool('select');
        }
        clearSelection();
        return;
      }

      // Delete/Backspace - delete selected elements or measurements
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();

        // First check for selected measurement
        if (selectedMeasurementId) {
          removeSelectedMeasurement();
          return;
        }

        // Then check for selected elements
        const selectedIds = getSelectedIds();
        if (selectedIds.length > 0) {
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

      // O - toggle orthogonal mode
      if (event.key.toLowerCase() === 'o' && !ctrl) {
        event.preventDefault();
        toggleSnapOrthogonal();
        return;
      }

      // D - toggle dimensions
      if (event.key.toLowerCase() === 'd' && !ctrl) {
        event.preventDefault();
        toggleDimensions();
        return;
      }

      // P - toggle PDF underlay visibility
      if (event.key.toLowerCase() === 'p' && !ctrl && hasPdf) {
        event.preventDefault();
        togglePdfVisible();
        return;
      }

      // Tab or V - cycle view mode (2D → 3D → Split)
      if ((event.key === 'Tab' || event.key.toLowerCase() === 'v') && !ctrl) {
        event.preventDefault();
        cycleViewMode();
        return;
      }

      // Arrow keys - move selected elements
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        const selectedIds = getSelectedIds();
        if (selectedIds.length > 0) {
          event.preventDefault();

          // Shift = larger steps (10x), otherwise use snap size
          const step = shift ? snapSize * 10 : snapSize;

          // Map arrow keys to X/Y movement (Z-up coordinate system)
          const delta = { x: 0, y: 0, z: 0 };
          switch (event.key) {
            case 'ArrowUp':
              delta.y = step;
              break;
            case 'ArrowDown':
              delta.y = -step;
              break;
            case 'ArrowLeft':
              delta.x = -step;
              break;
            case 'ArrowRight':
              delta.x = step;
              break;
          }

          moveElements(selectedIds, delta);
          return;
        }
      }

      // Ctrl+Z - undo
      if (ctrl && !shift && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (canUndo) {
          undo();
        }
        return;
      }

      // Ctrl+Y or Ctrl+Shift+Z - redo
      if ((ctrl && event.key.toLowerCase() === 'y') || (ctrl && shift && event.key.toLowerCase() === 'z')) {
        event.preventDefault();
        if (canRedo) {
          redo();
        }
        return;
      }

      // Ctrl+A - select all (TODO: implement)
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
    moveElements,
    toggleGrid,
    cycleViewMode,
    toggleSnapOrthogonal,
    toggleDimensions,
    snapSize,
    hasPdf,
    togglePdfVisible,
    selectedMeasurementId,
    removeSelectedMeasurement,
    cancelPlacement,
    undo,
    redo,
    canUndo,
    canRedo,
  ]);
}
