import { useCallback, useMemo } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import { useElementStore, useViewStore } from '@/store';
import { snapPoint as snapPointUtil, findNearestPoint } from '@/lib/geometry/math';
import type { Point2D } from '@/types/geometry';

/** Snap tolerance for endpoints in meters */
export const SNAP_TOLERANCE = 0.3;

export interface SnapResult {
  point: Point2D;
  snappedTo: 'point' | 'grid' | 'none';
  snappedToPoint: Point2D | null;
}

/**
 * Hook for snapping points to existing element endpoints or grid
 * Reusable across all placement tools (walls, doors, columns, etc.)
 */
export function useSnap() {
  const { elements } = useElementStore();
  const { snapToGrid: snapEnabled, snapSize } = useViewStore();

  /**
   * Get all snappable endpoints from existing elements
   */
  const snapPoints = useMemo(() => {
    const points: Point2D[] = [];

    elements.forEach((element) => {
      // Wall endpoints
      if (element.type === 'wall' && element.wallData) {
        points.push({ ...element.wallData.startPoint });
        points.push({ ...element.wallData.endPoint });
      }

      // Column centers
      if (element.type === 'column' && element.placement) {
        points.push({
          x: element.placement.position.x,
          y: element.placement.position.y,
        });
      }

      // Door/Window positions (along walls)
      if ((element.type === 'door' || element.type === 'window') && element.placement) {
        points.push({
          x: element.placement.position.x,
          y: element.placement.position.y,
        });
      }
    });

    return points;
  }, [elements]);

  /**
   * Snap a 2D point to existing endpoints or grid
   */
  const snap = useCallback(
    (point: Point2D): SnapResult => {
      const result = snapPointUtil(
        point,
        snapPoints,
        SNAP_TOLERANCE,
        snapSize,
        snapEnabled
      );

      return {
        point: result.point,
        snappedTo: result.snappedTo,
        snappedToPoint: result.snappedTo === 'point' ? result.point : null,
      };
    },
    [snapPoints, snapEnabled, snapSize]
  );

  /**
   * Convert Three.js pointer event to snapped 2D point
   * Three.js uses Y-up, we work in XZ plane
   */
  const snapFromEvent = useCallback(
    (event: ThreeEvent<PointerEvent>): SnapResult => {
      const rawPoint: Point2D = {
        x: event.point.x,
        y: event.point.z, // Three.js Z becomes our Y
      };
      return snap(rawPoint);
    },
    [snap]
  );

  /**
   * Check if a point is near any snap point (for visual indicators)
   */
  const getNearestSnapPoint = useCallback(
    (point: Point2D): Point2D | null => {
      return findNearestPoint(point, snapPoints, SNAP_TOLERANCE);
    },
    [snapPoints]
  );

  /**
   * Get all wall endpoints specifically (for wall connection logic)
   */
  const wallEndpoints = useMemo(() => {
    const points: Point2D[] = [];
    elements.forEach((element) => {
      if (element.type === 'wall' && element.wallData) {
        points.push({ ...element.wallData.startPoint });
        points.push({ ...element.wallData.endPoint });
      }
    });
    return points;
  }, [elements]);

  return {
    snap,
    snapFromEvent,
    getNearestSnapPoint,
    snapPoints,
    wallEndpoints,
    snapEnabled,
    snapSize,
    SNAP_TOLERANCE,
  };
}
