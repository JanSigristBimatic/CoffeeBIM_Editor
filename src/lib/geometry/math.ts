import type { Point2D } from '@/types/geometry';

/**
 * Snap a value to a grid
 */
export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

/**
 * Snap a 2D point to a grid
 */
export function snapPointToGrid(point: Point2D, gridSize: number): Point2D {
  return {
    x: snapToGrid(point.x, gridSize),
    y: snapToGrid(point.y, gridSize),
  };
}

/**
 * Calculate distance between two 2D points
 */
export function distance2D(a: Point2D, b: Point2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Linear interpolation
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Convert degrees to radians
 */
export function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Convert radians to degrees
 */
export function radToDeg(radians: number): number {
  return (radians * 180) / Math.PI;
}

/**
 * Find the nearest point from a list within a tolerance
 * Returns the nearest point or null if none within tolerance
 */
export function findNearestPoint(
  point: Point2D,
  candidates: Point2D[],
  tolerance: number
): Point2D | null {
  let nearest: Point2D | null = null;
  let minDistance = tolerance;

  for (const candidate of candidates) {
    const dist = distance2D(point, candidate);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = candidate;
    }
  }

  return nearest;
}

/**
 * Snap a point to the nearest candidate point, or to grid if no candidate is close enough
 */
export function snapPoint(
  point: Point2D,
  candidates: Point2D[],
  snapTolerance: number,
  gridSize: number,
  snapToGridEnabled: boolean
): { point: Point2D; snappedTo: 'point' | 'grid' | 'none' } {
  // First try to snap to existing points
  const nearestPoint = findNearestPoint(point, candidates, snapTolerance);
  if (nearestPoint) {
    return { point: { ...nearestPoint }, snappedTo: 'point' };
  }

  // Then snap to grid if enabled
  if (snapToGridEnabled) {
    return {
      point: snapPointToGrid(point, gridSize),
      snappedTo: 'grid',
    };
  }

  return { point, snappedTo: 'none' };
}

/**
 * Calculate the angle between two points (in radians)
 */
export function angleBetweenPoints(from: Point2D, to: Point2D): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

/**
 * Normalize an angle to be between -PI and PI
 */
export function normalizeAngle(angle: number): number {
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle < -Math.PI) angle += 2 * Math.PI;
  return angle;
}

/**
 * Check if two angles are approximately equal (within tolerance)
 */
export function anglesEqual(a: number, b: number, tolerance: number = 0.01): boolean {
  return Math.abs(normalizeAngle(a - b)) < tolerance;
}
