import { useCallback, useMemo } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import { useElementStore, useViewStore } from '@/store';
import {
  snapPointAdvanced,
  getSnapCandidates,
} from '@/lib/geometry/math';
import type { Point2D, LineSegment, SnapType } from '@/types/geometry';
import type { SnapCandidate } from '@/lib/geometry';

/** Snap tolerance for all snap types in meters */
export const SNAP_TOLERANCE = 0.3;

export interface SnapResult {
  point: Point2D;
  type: SnapType;
  sourceSegment?: LineSegment;
  referencePoint?: Point2D;
}

/**
 * Hook for snapping points to existing element features
 * Supports: endpoints, midpoints, perpendicular, nearest on line, grid
 */
export function useSnap() {
  const { elements } = useElementStore();
  const { snapToGrid: snapEnabled, snapSize, snapSettings } = useViewStore();

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
   * Get all wall segments for extended snapping (midpoint, perpendicular, nearest)
   */
  const wallSegments = useMemo(() => {
    const segments: LineSegment[] = [];

    elements.forEach((element) => {
      if (element.type === 'wall' && element.wallData) {
        segments.push({
          start: { ...element.wallData.startPoint },
          end: { ...element.wallData.endPoint },
        });
      }
    });

    return segments;
  }, [elements]);

  /**
   * Snap a 2D point using all enabled snap modes
   */
  const snap = useCallback(
    (point: Point2D, referencePoint?: Point2D): SnapResult => {
      return snapPointAdvanced(
        point,
        snapPoints,
        wallSegments,
        SNAP_TOLERANCE,
        snapSize,
        snapSettings,
        referencePoint
      );
    },
    [snapPoints, wallSegments, snapSize, snapSettings]
  );

  /**
   * Convert Three.js pointer event to snapped 2D point
   * Z-up coordinate system: XY is ground plane
   */
  const snapFromEvent = useCallback(
    (event: ThreeEvent<PointerEvent>, referencePoint?: Point2D): SnapResult => {
      const rawPoint: Point2D = {
        x: event.point.x,
        y: event.point.y, // Z-up: 3D (x, y) maps directly to 2D (x, y)
      };
      return snap(rawPoint, referencePoint);
    },
    [snap]
  );

  /**
   * Get all snap candidates near a point (for showing multiple indicators)
   */
  const getNearbyCandidates = useCallback(
    (point: Point2D): SnapCandidate[] => {
      return getSnapCandidates(
        point,
        snapPoints,
        wallSegments,
        SNAP_TOLERANCE,
        snapSettings
      );
    },
    [snapPoints, wallSegments, snapSettings]
  );

  /**
   * Get the best snap candidate for a point
   */
  const getBestSnapCandidate = useCallback(
    (point: Point2D, referencePoint?: Point2D): SnapResult | null => {
      const result = snap(point, referencePoint);
      if (result.type === 'none') return null;
      return result;
    },
    [snap]
  );

  /**
   * Check if a point is near any snap point (for visual indicators)
   * Returns the closest candidate with its type
   */
  const getNearestSnapPoint = useCallback(
    (point: Point2D): { point: Point2D; type: SnapType } | null => {
      const candidates = getNearbyCandidates(point);
      const firstCandidate = candidates[0];
      if (!firstCandidate) return null;
      return { point: firstCandidate.point, type: firstCandidate.type };
    },
    [getNearbyCandidates]
  );

  /**
   * Legacy function for backward compatibility
   */
  const getNearestSnapPointLegacy = useCallback(
    (point: Point2D): Point2D | null => {
      const result = getNearestSnapPoint(point);
      return result ? result.point : null;
    },
    [getNearestSnapPoint]
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
    getNearestSnapPointLegacy,
    getBestSnapCandidate,
    getNearbyCandidates,
    snapPoints,
    wallSegments,
    wallEndpoints,
    snapEnabled,
    snapSize,
    snapSettings,
    SNAP_TOLERANCE,
  };
}
