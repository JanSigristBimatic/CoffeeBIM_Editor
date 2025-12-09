import { useCallback, useMemo } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import { useToolStore, useProjectStore, useElementStore } from '@/store';
import { createStair, calculateSteps } from '@/bim/elements/Stair';
import { useSnap } from './useSnap';
import type { Point2D } from '@/types/geometry';

/**
 * Hook for handling stair placement interactions
 * Two-click placement: first click = start position, second click = direction
 */
export function useStairPlacement() {
  const {
    activeTool,
    stairPlacement,
    setStairStartPoint,
    setStairPreviewEndPoint,
    setStairRotation,
    resetStairPlacement,
    setCursorPosition,
  } = useToolStore();

  const { addElement } = useElementStore();
  const { activeStoreyId, storeys } = useProjectStore();

  // Use centralized snap hook
  const { snapFromEvent } = useSnap();

  // Get active storey info
  const activeStorey = useMemo(() => {
    return storeys.find((s) => s.id === activeStoreyId);
  }, [storeys, activeStoreyId]);

  // Get target storey from params (user-selected) or fallback to next storey
  const targetStorey = useMemo(() => {
    // First try to use user-selected target storey
    if (stairPlacement.params.targetStoreyId) {
      return storeys.find((s) => s.id === stairPlacement.params.targetStoreyId) ?? null;
    }

    // Fallback: find next storey above
    if (!activeStorey) return null;

    const sortedStoreys = [...storeys].sort((a, b) => a.elevation - b.elevation);
    const activeIndex = sortedStoreys.findIndex((s) => s.id === activeStoreyId);

    if (activeIndex >= 0 && activeIndex < sortedStoreys.length - 1) {
      return sortedStoreys[activeIndex + 1];
    }

    // If no storey above, try storey below
    if (activeIndex > 0) {
      return sortedStoreys[activeIndex - 1];
    }

    return null;
  }, [storeys, activeStoreyId, activeStorey, stairPlacement.params.targetStoreyId]);

  // Determine if stair goes up or down
  const isGoingUp = useMemo(() => {
    if (!activeStorey || !targetStorey) return true;
    return targetStorey.elevation > activeStorey.elevation;
  }, [activeStorey, targetStorey]);

  // Calculate total rise between storeys (always positive)
  const totalRise = useMemo(() => {
    if (!activeStorey || !targetStorey) return 3.0; // Default 3m if no target
    return Math.abs(targetStorey.elevation - activeStorey.elevation);
  }, [activeStorey, targetStorey]);

  // Calculate preview steps based on total rise
  const previewSteps = useMemo(() => {
    return calculateSteps(totalRise);
  }, [totalRise]);

  /**
   * Convert Three.js intersection point to snapped 2D point
   */
  const toPoint2D = useCallback(
    (event: ThreeEvent<PointerEvent>): Point2D => {
      const result = snapFromEvent(event);
      return result.point;
    },
    [snapFromEvent]
  );

  /**
   * Calculate rotation angle from direction vector
   */
  const calculateRotation = useCallback((start: Point2D, end: Point2D): number => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    return Math.atan2(dy, dx);
  }, []);

  /**
   * Create a stair at the specified position and direction
   * Handles both upward and downward stairs
   */
  const createStairElement = useCallback(
    (startPoint: Point2D, rotation: number) => {
      if (!activeStoreyId || !activeStorey || !targetStorey) {
        console.warn('No active or target storey selected');
        return false;
      }

      // Determine bottom and top storey based on direction
      // For stairs going UP: active = bottom, target = top
      // For stairs going DOWN: target = bottom, active = top
      const bottomStoreyId = isGoingUp ? activeStoreyId : targetStorey.id;
      const topStoreyId = isGoingUp ? targetStorey.id : activeStoreyId;
      const bottomElevation = isGoingUp ? activeStorey.elevation : targetStorey.elevation;

      try {
        const stair = createStair({
          position: startPoint,
          rotation,
          width: stairPlacement.params.width,
          totalRise,
          bottomStoreyId,
          topStoreyId,
          bottomElevation,
          stairType: stairPlacement.params.stairType,
          createOpening: stairPlacement.params.createOpening,
        });

        addElement(stair);
        return true;
      } catch (error) {
        console.warn('Could not create stair:', error);
        return false;
      }
    },
    [activeStoreyId, activeStorey, targetStorey, isGoingUp, totalRise, stairPlacement.params, addElement]
  );

  /**
   * Handle pointer down - start or complete stair placement
   */
  const handlePointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (activeTool !== 'stair') return;

      // Only respond to left click
      if (event.button !== 0) return;

      event.stopPropagation();

      if (!stairPlacement.startPoint) {
        // First click - set start point
        const point = toPoint2D(event);
        setStairStartPoint(point);
      } else {
        // Second click - create stair with current rotation
        if (createStairElement(stairPlacement.startPoint, stairPlacement.rotation)) {
          // Reset for next placement
          resetStairPlacement();
        }
      }
    },
    [
      activeTool,
      stairPlacement.startPoint,
      stairPlacement.rotation,
      toPoint2D,
      setStairStartPoint,
      createStairElement,
      resetStairPlacement,
    ]
  );

  /**
   * Handle pointer move - update preview
   */
  const handlePointerMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (activeTool !== 'stair') return;

      // Always update cursor position for snap indicator
      const cursorPoint = toPoint2D(event);
      setCursorPosition(cursorPoint);

      // Only update preview if we have a start point
      if (stairPlacement.startPoint) {
        setStairPreviewEndPoint(cursorPoint);

        // Calculate and update rotation
        const rotation = calculateRotation(stairPlacement.startPoint, cursorPoint);
        setStairRotation(rotation);
      }
    },
    [
      activeTool,
      stairPlacement.startPoint,
      toPoint2D,
      setCursorPosition,
      setStairPreviewEndPoint,
      calculateRotation,
      setStairRotation,
    ]
  );

  /**
   * Cancel current stair placement
   */
  const cancelPlacement = useCallback(() => {
    resetStairPlacement();
  }, [resetStairPlacement]);

  return {
    handlePointerDown,
    handlePointerMove,
    cancelPlacement,
    isPlacing: stairPlacement.startPoint !== null,
    startPoint: stairPlacement.startPoint,
    previewEndPoint: stairPlacement.previewEndPoint,
    rotation: stairPlacement.rotation,
    params: stairPlacement.params,
    previewSteps,
    totalRise,
    isGoingUp,
    targetStoreyName: targetStorey?.name || 'Kein Ziel',
  };
}
