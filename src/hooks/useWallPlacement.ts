import { useCallback, useEffect } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import { useToolStore, useProjectStore } from '@/store';
import { useElementStore } from '@/store';
import { createWall } from '@/bim/elements/Wall';
import { useSnap } from './useSnap';
import { useDistanceInput } from './useDistanceInput';
import type { Point2D } from '@/types/geometry';

/**
 * Hook for handling wall placement interactions
 * Uses the centralized useSnap hook for snapping logic
 * Supports distance input for precise wall lengths
 */
export function useWallPlacement() {
  const { activeTool, wallPlacement, setWallStartPoint, setWallPreviewEndPoint, resetWallPlacement, setCursorPosition } =
    useToolStore();
  const { addElement } = useElementStore();
  const { activeStoreyId } = useProjectStore();

  // Use centralized snap hook
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
   * Convert Three.js intersection point to snapped 2D point
   * Uses the wall start point as reference for perpendicular snapping
   */
  const toPoint2D = useCallback(
    (event: ThreeEvent<PointerEvent>, referencePoint?: Point2D): Point2D => {
      const result = snapFromEvent(event, referencePoint);
      return result.point;
    },
    [snapFromEvent]
  );

  // Get storey elevation for Z position
  const { storeys } = useProjectStore();
  const activeStorey = storeys.find(s => s.id === activeStoreyId);
  const storeyElevation = activeStorey?.elevation ?? 0;

  /**
   * Create a wall from start point to end point
   * Uses the thickness, height, and alignment from wall placement params
   */
  const createWallSegment = useCallback(
    (startPoint: Point2D, endPoint: Point2D) => {
      if (!activeStoreyId) {
        console.warn('No active storey selected');
        return false;
      }

      try {
        const wall = createWall({
          startPoint,
          endPoint,
          thickness: wallPlacement.params.thickness,
          height: wallPlacement.params.height,
          alignmentSide: wallPlacement.params.alignmentSide,
          storeyId: activeStoreyId,
          elevation: storeyElevation,
        });

        addElement(wall);
        return true;
      } catch (error) {
        console.warn('Could not create wall:', error);
        return false;
      }
    },
    [activeStoreyId, storeyElevation, addElement, wallPlacement.params.thickness, wallPlacement.params.height, wallPlacement.params.alignmentSide]
  );

  /**
   * Handle pointer down - start or complete wall placement
   */
  const handlePointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (activeTool !== 'wall') return;

      // Only respond to left click
      if (event.button !== 0) return;

      event.stopPropagation();

      if (!wallPlacement.startPoint) {
        // First click - set start point (no reference needed)
        const point = toPoint2D(event);
        setWallStartPoint(point);
        // Initialize distance input with the start point
        initializeDistanceInput(point);
      } else {
        // Second click - create wall
        // If distance input is active, use the calculated target point
        let endPoint: Point2D;
        if (isDistanceInputActive) {
          const targetPoint = getDistanceTargetPoint();
          if (targetPoint) {
            endPoint = targetPoint;
          } else {
            // Fallback to cursor position
            endPoint = toPoint2D(event, wallPlacement.startPoint);
          }
        } else {
          // Use cursor position with snapping
          endPoint = toPoint2D(event, wallPlacement.startPoint);
        }

        if (createWallSegment(wallPlacement.startPoint, endPoint)) {
          // Continue placing walls - use end point as new start point
          setWallStartPoint(endPoint);
          setWallPreviewEndPoint(null);
          // Re-initialize distance input with new start point
          clearDistanceInput();
          initializeDistanceInput(endPoint);
        } else {
          // Wall too short, reset
          resetWallPlacement();
          clearDistanceInput();
        }
      }
    },
    [
      activeTool,
      wallPlacement.startPoint,
      isDistanceInputActive,
      toPoint2D,
      setWallStartPoint,
      setWallPreviewEndPoint,
      resetWallPlacement,
      createWallSegment,
      initializeDistanceInput,
      clearDistanceInput,
      getDistanceTargetPoint,
    ]
  );

  /**
   * Handle pointer move - update preview
   * Passes start point as reference for perpendicular snapping
   * Also updates cursor position for snap preview before first point
   * Updates direction for distance input
   */
  const handlePointerMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (activeTool !== 'wall') return;

      // Always update cursor position for snap indicator (even before first point)
      const cursorPoint = toPoint2D(event);
      setCursorPosition(cursorPoint);

      // Only update preview end point if we have a start point
      if (wallPlacement.startPoint) {
        // Pass start point as reference for perpendicular snapping
        const snappedPoint = toPoint2D(event, wallPlacement.startPoint);

        // Update direction for distance input (based on cursor position)
        updateDirection(wallPlacement.startPoint, snappedPoint);

        // If distance input is active, use the calculated target point for preview
        if (isDistanceInputActive) {
          const targetPoint = getDistanceTargetPoint();
          if (targetPoint) {
            setWallPreviewEndPoint(targetPoint);
            return;
          }
        }

        // Default: use snapped cursor position
        setWallPreviewEndPoint(snappedPoint);
      }
    },
    [
      activeTool,
      wallPlacement.startPoint,
      isDistanceInputActive,
      toPoint2D,
      setWallPreviewEndPoint,
      setCursorPosition,
      updateDirection,
      getDistanceTargetPoint,
    ]
  );

  /**
   * Handle right click (context menu) - finish wall chain
   */
  const handleContextMenu = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      if (activeTool !== 'wall') return;
      if (!wallPlacement.startPoint) return;

      event.stopPropagation();
      // Prevent browser context menu
      event.nativeEvent.preventDefault();
      clearDistanceInput();
      resetWallPlacement();
    },
    [activeTool, wallPlacement.startPoint, resetWallPlacement, clearDistanceInput]
  );

  /**
   * Cancel current wall placement
   */
  const cancelPlacement = useCallback(() => {
    resetWallPlacement();
    clearDistanceInput();
  }, [resetWallPlacement, clearDistanceInput]);

  /**
   * Handle keyboard events for distance input
   * Should be called from a global keyboard handler
   */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (activeTool !== 'wall') return;
      if (!wallPlacement.startPoint) return;

      const result = handleDistanceKeyDown(e);

      // If Enter was pressed and confirmed, create the wall
      if (result.confirmed) {
        const targetPoint = getDistanceTargetPoint();
        if (targetPoint && wallPlacement.startPoint) {
          if (createWallSegment(wallPlacement.startPoint, targetPoint)) {
            // Continue placing walls
            setWallStartPoint(targetPoint);
            setWallPreviewEndPoint(null);
            clearDistanceInput();
            initializeDistanceInput(targetPoint);
          } else {
            // Wall too short
            resetWallPlacement();
            clearDistanceInput();
          }
        }
      }
    },
    [
      activeTool,
      wallPlacement.startPoint,
      handleDistanceKeyDown,
      getDistanceTargetPoint,
      createWallSegment,
      setWallStartPoint,
      setWallPreviewEndPoint,
      clearDistanceInput,
      initializeDistanceInput,
      resetWallPlacement,
    ]
  );

  // Register keyboard event listener for distance input
  useEffect(() => {
    if (activeTool !== 'wall') return;

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
    handleContextMenu,
    cancelPlacement,
    isPlacing: wallPlacement.startPoint !== null,
    startPoint: wallPlacement.startPoint,
    previewEndPoint: wallPlacement.previewEndPoint,
    // Distance input state
    isDistanceInputActive,
    distanceInputValue,
  };
}
