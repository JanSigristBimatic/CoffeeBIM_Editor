import { useCallback } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { useToolStore, useProjectStore, useElementStore } from '@/store';
import { createColumn } from '@/bim/elements/Column';
import type { Point2D } from '@/types/geometry';

// Grid snap size in meters
const GRID_SNAP = 0.1;

/**
 * Snap a value to the nearest grid point
 */
function snapToGrid(value: number): number {
  return Math.round(value / GRID_SNAP) * GRID_SNAP;
}

/**
 * Hook for handling column placement
 * Single click to place a column at the grid position
 */
export function useColumnPlacement() {
  const { activeTool, columnPlacement, setColumnPreview, resetColumnPlacement, setCursorPosition } = useToolStore();
  const { addElement } = useElementStore();
  const { activeStoreyId, storeys } = useProjectStore();

  const { params } = columnPlacement;

  // Get storey elevation for Z position
  const activeStorey = storeys.find(s => s.id === activeStoreyId);
  const storeyElevation = activeStorey?.elevation ?? 0;

  /**
   * Handle click to place column
   */
  const handlePointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (activeTool !== 'column') return;
      if (event.button !== 0) return;

      event.stopPropagation();

      // Get click position in world coordinates and snap to grid (Z-up: XY is ground)
      const position: Point2D = {
        x: snapToGrid(event.point.x),
        y: snapToGrid(event.point.y), // Z-up: 3D y maps directly to 2D y
      };

      if (!activeStoreyId) {
        console.warn('No active storey selected');
        return;
      }

      // Create the column with current parameters
      try {
        const column = createColumn({
          position,
          storeyId: activeStoreyId,
          elevation: storeyElevation,
          profileType: params.profileType,
          width: params.width,
          depth: params.depth,
          height: params.height,
        });

        // Add column to elements
        addElement(column);

        console.log('Column placed at position', position);

        // Reset preview after placement (but keep params)
        resetColumnPlacement();
      } catch (error) {
        console.error('Could not create column:', error);
      }
    },
    [activeTool, activeStoreyId, storeyElevation, params, addElement, resetColumnPlacement]
  );

  /**
   * Handle pointer move for preview
   * Also updates cursor position for snap indicator
   */
  const handlePointerMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (activeTool !== 'column') return;

      // Get pointer position in world coordinates and snap to grid (Z-up: XY is ground)
      const position: Point2D = {
        x: snapToGrid(event.point.x),
        y: snapToGrid(event.point.y), // Z-up: 3D y maps directly to 2D y
      };

      // Update cursor position for snap indicator
      setCursorPosition(position);

      // Columns can be placed anywhere on the grid, so always valid
      setColumnPreview(position, true);
    },
    [activeTool, setColumnPreview, setCursorPosition]
  );

  /**
   * Handle pointer leave - clear preview
   */
  const handlePointerLeave = useCallback(() => {
    if (activeTool !== 'column') return;
    setColumnPreview(null, false);
  }, [activeTool, setColumnPreview]);

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerLeave,
  };
}
