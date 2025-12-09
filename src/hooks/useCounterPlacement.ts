import { useCallback, useEffect } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import { useToolStore, useProjectStore, useElementStore } from '@/store';
import { useSnap } from './useSnap';
import { useDistanceInput } from './useDistanceInput';
import { createCounter } from '@/bim/elements/Counter';
import type { Point2D } from '@/types/geometry';

/**
 * Hook for handling counter (Theke) placement interactions
 * Polyline drawing: click to add points to the front line, right-click to finish
 * Minimum 2 points required for a valid counter
 * Supports distance input for precise segment lengths
 */
export function useCounterPlacement() {
  const {
    activeTool,
    counterPlacement,
    addCounterPoint,
    setCounterPreviewPoint,
    resetCounterPlacement,
    finishCounterPlacement,
    setCursorPosition,
  } = useToolStore();
  const { activeStoreyId, storeys } = useProjectStore();
  const { addElement } = useElementStore();
  const { snapFromEvent } = useSnap();

  // Get storey elevation for Z position
  const activeStorey = storeys.find(s => s.id === activeStoreyId);
  const storeyElevation = activeStorey?.elevation ?? 0;

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
   * Finish the counter and create the element
   */
  const completeCounter = useCallback(() => {
    if (!activeStoreyId) {
      console.warn('No active storey selected');
      resetCounterPlacement();
      return;
    }

    const points = finishCounterPlacement();

    if (points.length < 2) {
      console.warn('Need at least 2 points for a counter');
      return;
    }

    const { params } = counterPlacement;

    // Create the counter element
    const counter = createCounter({
      path: points,
      storeyId: activeStoreyId,
      elevation: storeyElevation,
      counterType: params.counterType,
      depth: params.depth,
      height: params.height,
      topThickness: params.topThickness,
      overhang: params.overhang,
      kickHeight: params.kickHeight,
      kickRecess: params.kickRecess,
      hasFootrest: params.hasFootrest,
      footrestHeight: params.footrestHeight,
    });

    addElement(counter);
  }, [activeStoreyId, storeyElevation, counterPlacement, finishCounterPlacement, resetCounterPlacement, addElement]);

  /**
   * Add a point to the counter path
   */
  const addPoint = useCallback(
    (point: Point2D) => {
      addCounterPoint(point);
      // Initialize distance input with the new point as reference
      initializeDistanceInput(point);
    },
    [addCounterPoint, initializeDistanceInput]
  );

  /**
   * Handle pointer down - add point to path
   */
  const handlePointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (activeTool !== 'counter') return;
      if (event.button !== 0) return;

      event.stopPropagation();

      // Use last point as reference for ortho constraint
      const lastPoint = counterPlacement.points[counterPlacement.points.length - 1];

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

      // Clear distance input and add the point
      clearDistanceInput();
      addPoint(point);
    },
    [
      activeTool,
      counterPlacement.points,
      isDistanceInputActive,
      snapFromEvent,
      addPoint,
      clearDistanceInput,
      getDistanceTargetPoint,
    ]
  );

  /**
   * Handle right click (context menu) - finish counter path
   */
  const handleContextMenu = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      if (activeTool !== 'counter') return;
      if (counterPlacement.points.length < 2) return;

      event.stopPropagation();
      // Prevent browser context menu
      event.nativeEvent.preventDefault();
      clearDistanceInput();
      completeCounter();
    },
    [activeTool, counterPlacement.points.length, completeCounter, clearDistanceInput]
  );

  /**
   * Handle pointer move - update preview point
   * Also updates cursor position for snap preview before first point
   * Updates direction for distance input
   */
  const handlePointerMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (activeTool !== 'counter') return;

      // Always update cursor position for snap indicator (even before first point)
      const cursorResult = snapFromEvent(event);
      setCursorPosition(cursorResult.point);

      // Use last point as reference for ortho constraint (if we have points)
      const lastPoint = counterPlacement.points[counterPlacement.points.length - 1];
      const result = snapFromEvent(event, lastPoint);

      // Update direction for distance input
      if (lastPoint) {
        updateDirection(lastPoint, result.point);
      }

      // If distance input is active, use the calculated target point for preview
      if (isDistanceInputActive) {
        const targetPoint = getDistanceTargetPoint();
        if (targetPoint) {
          setCounterPreviewPoint(targetPoint);
          return;
        }
      }

      setCounterPreviewPoint(result.point);
    },
    [
      activeTool,
      counterPlacement.points,
      isDistanceInputActive,
      snapFromEvent,
      setCounterPreviewPoint,
      setCursorPosition,
      updateDirection,
      getDistanceTargetPoint,
    ]
  );

  /**
   * Cancel current placement
   */
  const cancelPlacement = useCallback(() => {
    resetCounterPlacement();
    clearDistanceInput();
  }, [resetCounterPlacement, clearDistanceInput]);

  /**
   * Handle keyboard events for distance input
   */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (activeTool !== 'counter') return;
      if (counterPlacement.points.length === 0) return;

      const result = handleDistanceKeyDown(e);

      // If Enter was pressed and confirmed, add the point
      if (result.confirmed) {
        const targetPoint = getDistanceTargetPoint();
        if (targetPoint) {
          clearDistanceInput();
          addPoint(targetPoint);
        }
      }
    },
    [
      activeTool,
      counterPlacement.points.length,
      handleDistanceKeyDown,
      getDistanceTargetPoint,
      addPoint,
      clearDistanceInput,
    ]
  );

  // Register keyboard event listener for distance input
  useEffect(() => {
    if (activeTool !== 'counter') return;

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
    isDrawing: counterPlacement.isDrawing,
    points: counterPlacement.points,
    previewPoint: counterPlacement.previewPoint,
    pointCount: counterPlacement.points.length,
    params: counterPlacement.params,
    // Distance input state
    isDistanceInputActive,
    distanceInputValue,
  };
}
