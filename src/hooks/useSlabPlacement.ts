import { useCallback } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import { useToolStore, useProjectStore } from '@/store';
import { useSnap, SNAP_TOLERANCE } from './useSnap';
import { distance2D } from '@/lib/geometry/math';
import type { Point2D } from '@/types/geometry';

/** Distance to first point to auto-close polygon */
const CLOSE_DISTANCE = SNAP_TOLERANCE;

/**
 * Hook for handling slab (floor plan) placement interactions
 * Polygon drawing: click to add points, double-click or click near start to close
 */
export function useSlabPlacement() {
  const {
    activeTool,
    slabPlacement,
    addSlabPoint,
    setSlabPreviewPoint,
    resetSlabPlacement,
    openSlabCompletionDialog,
  } = useToolStore();
  const { activeStoreyId } = useProjectStore();
  const { snapFromEvent } = useSnap();

  /**
   * Check if a point is close to the first point (for closing the polygon)
   */
  const isCloseToStart = useCallback(
    (point: Point2D): boolean => {
      if (slabPlacement.points.length < 3) return false;
      const firstPoint = slabPlacement.points[0];
      if (!firstPoint) return false;
      return distance2D(point, firstPoint) < CLOSE_DISTANCE;
    },
    [slabPlacement.points]
  );

  /**
   * Finish the polygon and open completion dialog
   */
  const completeSlab = useCallback(() => {
    if (!activeStoreyId) {
      console.warn('No active storey selected');
      resetSlabPlacement();
      return;
    }

    const points = [...slabPlacement.points];

    if (points.length < 3) {
      console.warn('Need at least 3 points for a slab');
      resetSlabPlacement();
      return;
    }

    // Open dialog to ask about wall generation
    openSlabCompletionDialog(points);
  }, [activeStoreyId, slabPlacement.points, openSlabCompletionDialog, resetSlabPlacement]);

  /**
   * Handle pointer down - add point or close polygon
   */
  const handlePointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (activeTool !== 'slab') return;
      if (event.button !== 0) return;

      event.stopPropagation();

      const result = snapFromEvent(event);
      const point = result.point;

      // Check if we should close the polygon
      if (isCloseToStart(point)) {
        completeSlab();
        return;
      }

      // Add the point
      addSlabPoint(point);
    },
    [activeTool, snapFromEvent, isCloseToStart, completeSlab, addSlabPoint]
  );

  /**
   * Handle double click - finish polygon
   */
  const handleDoubleClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      if (activeTool !== 'slab') return;
      if (slabPlacement.points.length < 3) return;

      event.stopPropagation();
      completeSlab();
    },
    [activeTool, slabPlacement.points.length, completeSlab]
  );

  /**
   * Handle pointer move - update preview
   */
  const handlePointerMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (activeTool !== 'slab') return;
      if (slabPlacement.points.length === 0) return;

      const result = snapFromEvent(event);
      setSlabPreviewPoint(result.point);
    },
    [activeTool, slabPlacement.points.length, snapFromEvent, setSlabPreviewPoint]
  );

  /**
   * Cancel current placement
   */
  const cancelPlacement = useCallback(() => {
    resetSlabPlacement();
  }, [resetSlabPlacement]);

  return {
    handlePointerDown,
    handlePointerMove,
    handleDoubleClick,
    cancelPlacement,
    isDrawing: slabPlacement.isDrawing,
    points: slabPlacement.points,
    previewPoint: slabPlacement.previewPoint,
    pointCount: slabPlacement.points.length,
  };
}
