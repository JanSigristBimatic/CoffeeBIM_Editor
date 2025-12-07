import type { Point2D, LineSegment, SnapType, SnapResult, SnapSettings, Vector3 } from '@/types/geometry';
import type { BimElement } from '@/types/bim';

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

// ============================================================================
// Extended Snap Geometry Functions
// ============================================================================

/**
 * Calculate the midpoint of a line segment
 */
export function getMidpoint(segment: LineSegment): Point2D {
  return {
    x: (segment.start.x + segment.end.x) / 2,
    y: (segment.start.y + segment.end.y) / 2,
  };
}

/**
 * Calculate the length of a line segment
 */
export function getSegmentLength(segment: LineSegment): number {
  return distance2D(segment.start, segment.end);
}

/**
 * Get the direction vector of a line segment (normalized)
 */
export function getSegmentDirection(segment: LineSegment): Point2D {
  const length = getSegmentLength(segment);
  if (length === 0) return { x: 1, y: 0 };
  return {
    x: (segment.end.x - segment.start.x) / length,
    y: (segment.end.y - segment.start.y) / length,
  };
}

/**
 * Find the nearest point on a line segment from a given point
 * Returns the projected point (clamped to segment) and the parameter t (0-1)
 */
export function nearestPointOnSegment(
  point: Point2D,
  segment: LineSegment
): { point: Point2D; t: number; distance: number } {
  const dx = segment.end.x - segment.start.x;
  const dy = segment.end.y - segment.start.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    // Segment is a point
    return {
      point: { ...segment.start },
      t: 0,
      distance: distance2D(point, segment.start),
    };
  }

  // Calculate the parameter t (unclamped)
  const t = ((point.x - segment.start.x) * dx + (point.y - segment.start.y) * dy) / lengthSquared;

  // Clamp t to [0, 1] to stay on the segment
  const tClamped = clamp(t, 0, 1);

  const nearestPoint: Point2D = {
    x: segment.start.x + tClamped * dx,
    y: segment.start.y + tClamped * dy,
  };

  return {
    point: nearestPoint,
    t: tClamped,
    distance: distance2D(point, nearestPoint),
  };
}

/**
 * Find the perpendicular foot from a reference point to a line segment
 * Only returns a result if the perpendicular foot falls within the segment
 */
export function perpendicularToSegment(
  point: Point2D,
  segment: LineSegment
): { point: Point2D; distance: number } | null {
  const dx = segment.end.x - segment.start.x;
  const dy = segment.end.y - segment.start.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) return null;

  // Calculate the parameter t (unclamped)
  const t = ((point.x - segment.start.x) * dx + (point.y - segment.start.y) * dy) / lengthSquared;

  // Only return if perpendicular foot is on the segment (not at endpoints)
  if (t <= 0.01 || t >= 0.99) return null;

  const perpPoint: Point2D = {
    x: segment.start.x + t * dx,
    y: segment.start.y + t * dy,
  };

  return {
    point: perpPoint,
    distance: distance2D(point, perpPoint),
  };
}

/**
 * Apply orthogonal constraint to a point relative to a reference point
 * Constrains the point to be exactly horizontal or vertical from the reference
 * Returns the constrained point and which axis is being used
 */
export function applyOrthogonalConstraint(
  point: Point2D,
  referencePoint: Point2D
): { point: Point2D; axis: 'horizontal' | 'vertical' } {
  const dx = Math.abs(point.x - referencePoint.x);
  const dy = Math.abs(point.y - referencePoint.y);

  // Choose the axis with the larger delta - constrain to that axis
  if (dx >= dy) {
    // Horizontal constraint - keep x, match y to reference
    return { point: { x: point.x, y: referencePoint.y }, axis: 'horizontal' };
  } else {
    // Vertical constraint - keep y, match x to reference
    return { point: { x: referencePoint.x, y: point.y }, axis: 'vertical' };
  }
}

/**
 * Find the best coordinate snap along an axis
 * For horizontal movement: snap X coordinates
 * For vertical movement: snap Y coordinates
 */
function findAxisAlignedSnap(
  constrainedPoint: Point2D,
  referencePoint: Point2D,
  axis: 'horizontal' | 'vertical',
  endpoints: Point2D[],
  snapTolerance: number
): Point2D | null {
  let bestSnap: Point2D | null = null;
  let minDistance = snapTolerance;

  for (const endpoint of endpoints) {
    if (axis === 'horizontal') {
      // Snap X coordinate while keeping Y fixed (from ortho constraint)
      const dist = Math.abs(constrainedPoint.x - endpoint.x);
      if (dist < minDistance) {
        minDistance = dist;
        bestSnap = { x: endpoint.x, y: referencePoint.y };
      }
    } else {
      // Snap Y coordinate while keeping X fixed (from ortho constraint)
      const dist = Math.abs(constrainedPoint.y - endpoint.y);
      if (dist < minDistance) {
        minDistance = dist;
        bestSnap = { x: referencePoint.x, y: endpoint.y };
      }
    }
  }

  return bestSnap;
}

/**
 * Extended snap function that supports all snap types
 */
export function snapPointAdvanced(
  point: Point2D,
  endpoints: Point2D[],
  segments: LineSegment[],
  snapTolerance: number,
  gridSize: number,
  settings: SnapSettings,
  referencePoint?: Point2D
): SnapResult {
  if (!settings.enabled) {
    return { point, type: 'none' };
  }

  // Handle orthogonal mode separately
  if (settings.orthogonal && referencePoint) {
    const orthoResult = applyOrthogonalConstraint(point, referencePoint);
    const constrainedPoint = orthoResult.point;

    // In ortho mode: snap coordinates along the movement axis
    // This allows snapping to endpoint X/Y coordinates while staying orthogonal
    if (settings.endpoint) {
      const axisSnap = findAxisAlignedSnap(
        constrainedPoint,
        referencePoint,
        orthoResult.axis,
        endpoints,
        snapTolerance
      );
      if (axisSnap) {
        return { point: axisSnap, type: 'endpoint' };
      }
    }

    // Also check midpoints for axis-aligned snap
    if (settings.midpoint) {
      const midpoints = segments.map(getMidpoint);
      const axisSnap = findAxisAlignedSnap(
        constrainedPoint,
        referencePoint,
        orthoResult.axis,
        midpoints,
        snapTolerance
      );
      if (axisSnap) {
        return { point: axisSnap, type: 'midpoint' };
      }
    }

    // Fallback to grid in ortho mode
    if (settings.grid) {
      const gridPoint = snapPointToGrid(constrainedPoint, gridSize);
      // Snap only the relevant axis to grid
      if (orthoResult.axis === 'horizontal') {
        return { point: { x: gridPoint.x, y: referencePoint.y }, type: 'grid' };
      } else {
        return { point: { x: referencePoint.x, y: gridPoint.y }, type: 'grid' };
      }
    }

    return { point: constrainedPoint, type: 'none' };
  }

  // Non-ortho mode: regular snapping
  let bestSnap: SnapResult = { point, type: 'none' };
  let minDistance = snapTolerance;

  // 1. Check endpoints (highest priority)
  if (settings.endpoint) {
    for (const endpoint of endpoints) {
      const dist = distance2D(point, endpoint);
      if (dist < minDistance) {
        minDistance = dist;
        bestSnap = { point: { ...endpoint }, type: 'endpoint' };
      }
    }
  }

  // 2. Check midpoints
  if (settings.midpoint) {
    for (const segment of segments) {
      const midpoint = getMidpoint(segment);
      const dist = distance2D(point, midpoint);
      if (dist < minDistance) {
        minDistance = dist;
        bestSnap = { point: midpoint, type: 'midpoint', sourceSegment: segment };
      }
    }
  }

  // 3. Check perpendicular (requires a reference point, e.g., wall start point)
  if (settings.perpendicular && referencePoint) {
    for (const segment of segments) {
      const perp = perpendicularToSegment(referencePoint, segment);
      if (perp) {
        const dist = distance2D(point, perp.point);
        if (dist < minDistance) {
          minDistance = dist;
          bestSnap = {
            point: perp.point,
            type: 'perpendicular',
            sourceSegment: segment,
            referencePoint
          };
        }
      }
    }
  }

  // 4. Check nearest point on line
  if (settings.nearest) {
    for (const segment of segments) {
      const nearest = nearestPointOnSegment(point, segment);
      // Only snap if not at endpoints (those are handled separately)
      if (nearest.t > 0.01 && nearest.t < 0.99 && nearest.distance < minDistance) {
        minDistance = nearest.distance;
        bestSnap = { point: nearest.point, type: 'nearest', sourceSegment: segment };
      }
    }
  }

  // 5. Fallback to grid if no other snap found
  if (bestSnap.type === 'none' && settings.grid) {
    return {
      point: snapPointToGrid(point, gridSize),
      type: 'grid',
    };
  }

  return bestSnap;
}

/**
 * Get all potential snap candidates from a point
 * Returns candidates sorted by distance
 */
export interface SnapCandidate {
  point: Point2D;
  type: SnapType;
  distance: number;
  sourceSegment?: LineSegment;
}

export function getSnapCandidates(
  point: Point2D,
  endpoints: Point2D[],
  segments: LineSegment[],
  snapTolerance: number,
  settings: SnapSettings
): SnapCandidate[] {
  const candidates: SnapCandidate[] = [];

  if (!settings.enabled) return candidates;

  // Endpoints
  if (settings.endpoint) {
    for (const endpoint of endpoints) {
      const dist = distance2D(point, endpoint);
      if (dist < snapTolerance) {
        candidates.push({ point: { ...endpoint }, type: 'endpoint', distance: dist });
      }
    }
  }

  // Midpoints
  if (settings.midpoint) {
    for (const segment of segments) {
      const midpoint = getMidpoint(segment);
      const dist = distance2D(point, midpoint);
      if (dist < snapTolerance) {
        candidates.push({ point: midpoint, type: 'midpoint', distance: dist, sourceSegment: segment });
      }
    }
  }

  // Nearest points on segments
  if (settings.nearest) {
    for (const segment of segments) {
      const nearest = nearestPointOnSegment(point, segment);
      if (nearest.t > 0.01 && nearest.t < 0.99 && nearest.distance < snapTolerance) {
        candidates.push({
          point: nearest.point,
          type: 'nearest',
          distance: nearest.distance,
          sourceSegment: segment
        });
      }
    }
  }

  // Sort by distance
  return candidates.sort((a, b) => a.distance - b.distance);
}

/**
 * Calculate the center position of a BIM element
 * Used for camera focus/zoom functionality
 */
export function getElementCenter(element: BimElement): Vector3 {
  const pos = element.placement.position;

  // For walls, calculate center from start and end points
  if (element.wallData) {
    const { startPoint, endPoint, height } = element.wallData;
    return {
      x: (startPoint.x + endPoint.x) / 2,
      y: pos.y + height / 2, // Y is up in Three.js
      z: (startPoint.y + endPoint.y) / 2, // Z is the other horizontal axis
    };
  }

  // For doors and windows, use placement position + half height
  if (element.doorData) {
    return {
      x: pos.x,
      y: pos.y + element.doorData.height / 2,
      z: pos.z,
    };
  }

  if (element.windowData) {
    return {
      x: pos.x,
      y: pos.y + element.windowData.sillHeight + element.windowData.height / 2,
      z: pos.z,
    };
  }

  // For columns, use placement + half height
  if (element.columnData) {
    return {
      x: pos.x,
      y: pos.y + element.columnData.height / 2,
      z: pos.z,
    };
  }

  // For slabs, use center of outline
  if (element.slabData && element.slabData.outline.length > 0) {
    const outline = element.slabData.outline;
    const centerX = outline.reduce((sum, p) => sum + p.x, 0) / outline.length;
    const centerZ = outline.reduce((sum, p) => sum + p.y, 0) / outline.length;
    return {
      x: centerX,
      y: pos.y + element.slabData.thickness / 2,
      z: centerZ,
    };
  }

  // For furniture, use placement + half height
  if (element.furnitureData) {
    return {
      x: pos.x,
      y: pos.y + element.furnitureData.height / 2,
      z: pos.z,
    };
  }

  // Default: use geometry height
  return {
    x: pos.x,
    y: pos.y + element.geometry.height / 2,
    z: pos.z,
  };
}
