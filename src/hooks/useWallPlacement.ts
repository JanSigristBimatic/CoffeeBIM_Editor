import { useCallback } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import { useToolStore, useProjectStore } from '@/store';
import { useElementStore } from '@/store';
import { createWall } from '@/bim/elements/Wall';
import { useSnap } from './useSnap';
import type { Point2D } from '@/types/geometry';

/**
 * Hook for handling wall placement interactions
 * Uses the centralized useSnap hook for snapping logic
 */
export function useWallPlacement() {
  const { activeTool, wallPlacement, setWallStartPoint, setWallPreviewEndPoint, resetWallPlacement } =
    useToolStore();
  const { addElement } = useElementStore();
  const { activeStoreyId } = useProjectStore();

  // Use centralized snap hook
  const { snapFromEvent } = useSnap();

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
   * Handle pointer down - start or complete wall placement
   */
  const handlePointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (activeTool !== 'wall') return;

      // Only respond to left click
      if (event.button !== 0) return;

      event.stopPropagation();

      const point = toPoint2D(event);

      if (!wallPlacement.startPoint) {
        // First click - set start point
        setWallStartPoint(point);
      } else {
        // Second click - create wall
        if (!activeStoreyId) {
          console.warn('No active storey selected');
          return;
        }

        try {
          const wall = createWall({
            startPoint: wallPlacement.startPoint,
            endPoint: point,
            storeyId: activeStoreyId,
          });

          addElement(wall);

          // Continue placing walls - use end point as new start point
          setWallStartPoint(point);
          setWallPreviewEndPoint(null);
        } catch (error) {
          console.warn('Could not create wall:', error);
          // Wall too short, reset
          resetWallPlacement();
        }
      }
    },
    [
      activeTool,
      wallPlacement.startPoint,
      activeStoreyId,
      toPoint2D,
      setWallStartPoint,
      setWallPreviewEndPoint,
      resetWallPlacement,
      addElement,
    ]
  );

  /**
   * Handle pointer move - update preview
   */
  const handlePointerMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (activeTool !== 'wall') return;
      if (!wallPlacement.startPoint) return;

      const point = toPoint2D(event);
      setWallPreviewEndPoint(point);
    },
    [activeTool, wallPlacement.startPoint, toPoint2D, setWallPreviewEndPoint]
  );

  /**
   * Cancel current wall placement
   */
  const cancelPlacement = useCallback(() => {
    resetWallPlacement();
  }, [resetWallPlacement]);

  return {
    handlePointerDown,
    handlePointerMove,
    cancelPlacement,
    isPlacing: wallPlacement.startPoint !== null,
    startPoint: wallPlacement.startPoint,
    previewEndPoint: wallPlacement.previewEndPoint,
  };
}
