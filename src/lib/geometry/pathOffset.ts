import type { Point2D } from '@/types/geometry';

/**
 * Calculate intersection point of two lines
 * Line 1: passes through p1 with direction d1
 * Line 2: passes through p2 with direction d2
 * Returns null if lines are parallel
 */
function lineLineIntersection(
  p1: Point2D,
  d1: Point2D,
  p2: Point2D,
  d2: Point2D
): Point2D | null {
  // Solve: p1 + t * d1 = p2 + s * d2
  // Using cross product method
  const cross = d1.x * d2.y - d1.y * d2.x;

  // Lines are parallel if cross product is near zero
  if (Math.abs(cross) < 1e-10) {
    return null;
  }

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;

  const t = (dx * d2.y - dy * d2.x) / cross;

  return {
    x: p1.x + t * d1.x,
    y: p1.y + t * d1.y,
  };
}

/**
 * Calculate offset points for a polyline path
 * Uses proper miter joins - offset lines are extended/trimmed to meet at corners
 *
 * For counters: positive offset = backward (service side)
 *               negative offset = forward (customer side/overhang)
 */
export function offsetPath(path: Point2D[], offset: number): Point2D[] {
  if (path.length < 2) return [];
  if (offset === 0) return path.map(p => ({ ...p }));

  const result: Point2D[] = [];

  // Pre-calculate all segment directions and perpendiculars
  const segments: Array<{ dir: Point2D; perp: Point2D }> = [];
  for (let i = 0; i < path.length - 1; i++) {
    const from = path[i]!;
    const to = path[i + 1]!;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.sqrt(dx * dx + dy * dy);

    if (len === 0) {
      segments.push({ dir: { x: 1, y: 0 }, perp: { x: 0, y: 1 } });
    } else {
      segments.push({
        dir: { x: dx / len, y: dy / len },
        perp: { x: -dy / len, y: dx / len },
      });
    }
  }

  for (let i = 0; i < path.length; i++) {
    const current = path[i]!;

    if (i === 0) {
      // First point: offset perpendicular to first segment
      const perp = segments[0]!.perp;
      result.push({
        x: current.x + perp.x * offset,
        y: current.y + perp.y * offset,
      });
    } else if (i === path.length - 1) {
      // Last point: offset perpendicular to last segment
      const perp = segments[segments.length - 1]!.perp;
      result.push({
        x: current.x + perp.x * offset,
        y: current.y + perp.y * offset,
      });
    } else {
      // Middle point: find intersection of the two offset lines
      const seg1 = segments[i - 1]!;
      const seg2 = segments[i]!;

      // Offset line 1: from previous segment, offset by perp1
      // Point on line 1: current + perp1 * offset
      // Direction of line 1: seg1.dir
      const p1: Point2D = {
        x: current.x + seg1.perp.x * offset,
        y: current.y + seg1.perp.y * offset,
      };

      // Offset line 2: from next segment, offset by perp2
      // Point on line 2: current + perp2 * offset
      // Direction of line 2: seg2.dir
      const p2: Point2D = {
        x: current.x + seg2.perp.x * offset,
        y: current.y + seg2.perp.y * offset,
      };

      // Find intersection
      const intersection = lineLineIntersection(p1, seg1.dir, p2, seg2.dir);

      if (intersection) {
        // Check if miter is too long (very sharp angle)
        const miterDx = intersection.x - current.x;
        const miterDy = intersection.y - current.y;
        const miterLen = Math.sqrt(miterDx * miterDx + miterDy * miterDy);

        // Limit miter length to 4x the offset to prevent extreme spikes
        if (miterLen > Math.abs(offset) * 4) {
          // Fall back to bevel join for very sharp angles
          result.push(p1);
          result.push(p2);
        } else {
          result.push(intersection);
        }
      } else {
        // Lines are parallel (segments are collinear) - just use offset point
        result.push(p1);
      }
    }
  }

  return result;
}

/**
 * Create a closed polygon shape from front and back paths
 * Properly handles the corner geometry for consistent width
 */
export function createCounterPolygon(
  frontPath: Point2D[],
  backPath: Point2D[]
): Point2D[] {
  if (frontPath.length < 2 || backPath.length < 2) return [];

  const polygon: Point2D[] = [];

  // Add front path
  for (const p of frontPath) {
    polygon.push({ x: p.x, y: p.y });
  }

  // Add back path in reverse
  for (let i = backPath.length - 1; i >= 0; i--) {
    polygon.push({ x: backPath[i]!.x, y: backPath[i]!.y });
  }

  return polygon;
}

/**
 * Calculate total length of a path
 */
export function calculatePathLength(path: Point2D[]): number {
  let length = 0;
  for (let i = 1; i < path.length; i++) {
    const prev = path[i - 1]!;
    const curr = path[i]!;
    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    length += Math.sqrt(dx * dx + dy * dy);
  }
  return length;
}
