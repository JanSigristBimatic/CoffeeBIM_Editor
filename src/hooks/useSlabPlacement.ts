import { useCallback, useEffect } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import { useToolStore, useProjectStore } from '@/store';
import { useSnap, SNAP_TOLERANCE } from './useSnap';
import { useDistanceInput } from './useDistanceInput';
import { distance2D } from '@/lib/geometry/math';
import type { Point2D } from '@/types/geometry';

/** Distance to first point to auto-close polygon */
const CLOSE_DISTANCE = SNAP_TOLERANCE;

/**
 * Hook for handling slab (floor plan) placement interactions
 * Polygon drawing: click to add points, double-click or click near start to close
 * Supports distance input for precise segment lengths
 */
export function useSlabPlacement() {
  const {
    activeTool,
    slabPlacement,
    addSlabPoint,
    setSlabPreviewPoint,
    resetSlabPlacement,
    openSlabCompletionDialog,
    setCursorPosition,
  } = useToolStore();
  const { activeStoreyId } = useProjectStore();
  const { snapFromEvent } = useSnap();

  // Use distance input hook
  const {
    isActive: isDistanceInputActive,
    inputValue: distanceInputValue,
    initializeDistanceInput,
    updateDirection,
    handleKeyDown: handleDistanceKeyDown,
    clearDistanceInput,
    getDistanceTargetPoint,
  } = useDistanceInput();

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
   * Add a point to the slab polygon
   */
  const addPoint = useCallback(
    (point: Point2D) => {
      addSlabPoint(point);
      // Initialize distance input with the new point as reference
      initializeDistanceInput(point);
    },
    [addSlabPoint, initializeDistanceInput]
  );

  /**
   * Handle pointer down - add point or close polygon
   */
  const handlePointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (activeTool !== 'slab') return;
      if (event.button !== 0) return;

      event.stopPropagation();

      // Use last point as reference for ortho constraint
      const lastPoint = slabPlacement.points[slabPlacement.points.length - 1];

      // Determine the point to add
      let point: Point2D;
      if (isDistanceInputActive && lastPoint) {
        const targetPoint = getDistanceTargetPoint();
        if (targetPoint) {
          point = targetPoint;
        } else {
          const result = snapFromEvent(event, lastPoint);
          point = result.point;
        }
      } else {
        const result = snapFromEvent(event, lastPoint);
        point = result.point;
      }

      // Check if we should close the polygon
      if (isCloseToStart(point)) {
        clearDistanceInput();
        completeSlab();
        return;
      }

      // Clear distance input and add the point
      clearDistanceInput();
      addPoint(point);
    },
    [
      activeTool,
      slabPlacement.points,
      isDistanceInputActive,
      snapFromEvent,
      isCloseToStart,
      completeSlab,
      addPoint,
      clearDistanceInput,
      getDistanceTargetPoint,
    ]
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
   * Handle right click (context menu) - close polygon if enough points
   */
  const handleContextMenu = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      if (activeTool !== 'slab') return;
      if (slabPlacement.points.length < 3) return;

      event.stopPropagation();
      // Prevent browser context menu
      event.nativeEvent.preventDefault();
      clearDistanceInput();
      completeSlab();
    },
    [activeTool, slabPlacement.points.length, completeSlab, clearDistanceInput]
  );

  /**
   * Handle pointer move - update preview
   * Also updates cursor position for snap preview before first point
   * Updates direction for distance input
   */
  const handlePointerMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (activeTool !== 'slab') return;

      // Always update cursor position for snap indicator (even before first point)
      const cursorResult = snapFromEvent(event);
      setCursorPosition(cursorResult.point);

      // Only update preview point if we have points
      if (slabPlacement.points.length > 0) {
        // Use last point as reference for ortho constraint
        const lastPoint = slabPlacement.points[slabPlacement.points.length - 1];
        const result = snapFromEvent(event, lastPoint);

        // Update direction for distance input
        if (lastPoint) {
          updateDirection(lastPoint, result.point);
        }

        // If distance input is active, use the calculated target point for preview
        if (isDistanceInputActive) {
          const targetPoint = getDistanceTargetPoint();
          if (targetPoint) {
            setSlabPreviewPoint(targetPoint);
            return;
          }
        }

        setSlabPreviewPoint(result.point);
      }
    },
    [
      activeTool,
      slabPlacement.points,
      isDistanceInputActive,
      snapFromEvent,
      setSlabPreviewPoint,
      setCursorPosition,
      updateDirection,
      getDistanceTargetPoint,
    ]
  );

  /**
   * Cancel current placement
   */
  const cancelPlacement = useCallback(() => {
    resetSlabPlacement();
    clearDistanceInput();
  }, [resetSlabPlacement, clearDistanceInput]);

  /**
   * Handle keyboard events for distance input
   */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (activeTool !== 'slab') return;
      if (slabPlacement.points.length === 0) return;

      const result = handleDistanceKeyDown(e);

      // If Enter was pressed and confirmed, add the point
      if (result.confirmed) {
        const targetPoint = getDistanceTargetPoint();
        if (targetPoint) {
          // Check if we should close the polygon
          if (isCloseToStart(targetPoint)) {
            clearDistanceInput();
            completeSlab();
          } else {
            clearDistanceInput();
            addPoint(targetPoint);
          }
        }
      }
    },
    [
      activeTool,
      slabPlacement.points.length,
      handleDistanceKeyDown,
      getDistanceTargetPoint,
      isCloseToStart,
      completeSlab,
      addPoint,
      clearDistanceInput,
    ]
  );

  // Register keyboard event listener for distance input
  useEffect(() => {
    if (activeTool !== 'slab') return;

    const onKeyDown = (e: KeyboardEvent) => {
      // Don't handle if typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      handleKeyDown(e);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeTool, handleKeyDown]);

  return {
    handlePointerDown,
    handlePointerMove,
    handleDoubleClick,
    handleContextMenu,
    cancelPlacement,
    isDrawing: slabPlacement.isDrawing,
    points: slabPlacement.points,
    previewPoint: slabPlacement.previewPoint,
    pointCount: slabPlacement.points.length,
    // Distance input state
    isDistanceInputActive,
    distanceInputValue,
  };
}
