/**
 * Wall Corner Geometry Module - True Miter Algorithm
 *
 * Handles wall corner/joint calculations using line-line intersection
 * for mathematically correct miter cuts like in Revit.
 *
 * Key concepts:
 * - Each wall edge is treated as a parametric line
 * - Corner points are found by intersecting edge lines
 * - Extensions can be positive (extend) or negative (shorten)
 * - Works for any corner angle, not just 90°
 */

import type { BimElement, WallAlignmentSide } from '@/types/bim';
import type { Point2D } from '@/types/geometry';

// ============================================================================
// Types
// ============================================================================

/**
 * A 2D line in parametric form: P = point + t * direction
 */
interface Line2D {
  point: Point2D;
  direction: { x: number; y: number };
}

/**
 * The turn direction at a corner when following wall paths
 */
export type TurnDirection = 'left' | 'right' | 'straight' | 'back';

/**
 * Extension values for a single wall end at a corner.
 * Positive values extend the wall, negative values shorten it.
 */
export interface WallEndExtensions {
  /** Extension for the left edge (looking from start to end) */
  leftEdge: number;
  /** Extension for the right edge (looking from start to end) */
  rightEdge: number;
}

/**
 * Corner configuration describing how two walls meet
 */
export interface CornerConfig {
  wallAId: string;
  wallBId: string;
  wallAEnd: 'start' | 'end';
  wallBEnd: 'start' | 'end';
  wallAAlignment: WallAlignmentSide;
  wallBAlignment: WallAlignmentSide;
  wallAThickness: number;
  wallBThickness: number;
  cornerAngle: number;
  turnDirection: TurnDirection;
}

/**
 * Complete corner solution with extensions for both walls
 */
export interface CornerSolution {
  wallA: WallEndExtensions;
  wallB: WallEndExtensions;
}

/**
 * Result of analyzing a wall's connections
 */
export interface WallCornerAnalysis {
  wallId: string;
  startExtensions: WallEndExtensions;
  endExtensions: WallEndExtensions;
}

// ============================================================================
// Core Geometry Functions
// ============================================================================

/**
 * Calculate line-line intersection point.
 * Uses parametric form: P = point + t * direction
 * Returns null if lines are parallel.
 */
function lineLineIntersection(line1: Line2D, line2: Line2D): Point2D | null {
  const dx = line2.point.x - line1.point.x;
  const dy = line2.point.y - line1.point.y;

  // Cross product of directions (determinant)
  const cross =
    line1.direction.x * line2.direction.y -
    line1.direction.y * line2.direction.x;

  // Lines are parallel if cross product is near zero
  if (Math.abs(cross) < 0.0001) {
    return null;
  }

  // Solve for parameter t1 on line1
  const t1 = (dx * line2.direction.y - dy * line2.direction.x) / cross;

  return {
    x: line1.point.x + t1 * line1.direction.x,
    y: line1.point.y + t1 * line1.direction.y,
  };
}

/**
 * Get the offset of each edge from the wall centerline based on alignment.
 * Looking from start to end:
 * - left: offset in positive normal direction
 * - right: offset in negative normal direction
 */
export function getEdgeOffsets(
  alignment: WallAlignmentSide,
  thickness: number
): { left: number; right: number } {
  switch (alignment) {
    case 'left':
      // Reference edge (left) at centerline, wall extends to the right
      return { left: 0, right: -thickness };
    case 'center':
      // Wall centered on centerline
      return { left: thickness / 2, right: -thickness / 2 };
    case 'right':
      // Reference edge (right) at centerline, wall extends to the left
      return { left: thickness, right: 0 };
  }
}

/**
 * Calculate the turn direction when transitioning from wall A to wall B.
 * Uses cross product to determine if it's a left or right turn.
 */
export function calculateTurnDirection(
  wallADirection: { x: number; y: number },
  wallBDirection: { x: number; y: number },
  wallAEnd: 'start' | 'end',
  wallBEnd: 'start' | 'end'
): TurnDirection {
  // Adjust directions based on which ends meet
  // We want the direction "into" the corner for wall A
  // and the direction "out of" the corner for wall B
  const dirA =
    wallAEnd === 'start'
      ? { x: -wallADirection.x, y: -wallADirection.y }
      : wallADirection;
  const dirB =
    wallBEnd === 'start'
      ? wallBDirection
      : { x: -wallBDirection.x, y: -wallBDirection.y };

  // Cross product Z component
  const cross = dirA.x * dirB.y - dirA.y * dirB.x;

  // Dot product for parallel detection
  const dot = dirA.x * dirB.x + dirA.y * dirB.y;

  const epsilon = 0.001;

  if (Math.abs(cross) < epsilon) {
    return dot > 0 ? 'straight' : 'back';
  }

  return cross > 0 ? 'left' : 'right';
}

/**
 * Calculate the angle between two walls at a corner.
 * Returns angle in radians (0 to PI).
 */
export function calculateCornerAngle(
  wallADirection: { x: number; y: number },
  wallBDirection: { x: number; y: number },
  wallAEnd: 'start' | 'end',
  wallBEnd: 'start' | 'end'
): number {
  // Adjust directions so they point "into" the corner
  const dirA =
    wallAEnd === 'start'
      ? { x: -wallADirection.x, y: -wallADirection.y }
      : wallADirection;
  const dirB =
    wallBEnd === 'start'
      ? wallBDirection
      : { x: -wallBDirection.x, y: -wallBDirection.y };

  const dot = dirA.x * dirB.x + dirA.y * dirB.y;
  return Math.acos(Math.max(-1, Math.min(1, dot)));
}

// ============================================================================
// True Miter Corner Calculation
// ============================================================================

/**
 * Maximum extension factor relative to wall thickness.
 * Prevents extreme extensions at very acute angles.
 */
const MAX_EXTENSION_FACTOR = 3;

/**
 * Minimum angle (in radians) for miter calculation.
 * Below this angle, we skip miter to avoid extreme extensions.
 * ~15 degrees = 0.26 radians
 */
const MIN_MITER_ANGLE = 0.26;

/**
 * Clamp a value between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Calculate true miter extensions using line-line intersection.
 *
 * This is the core algorithm that makes wall corners work like Revit:
 * 1. Create edge lines for each wall at the meeting point
 * 2. Find where corresponding edges intersect
 * 3. Calculate the signed distance from original edge to intersection
 *
 * The key insight: inner edges get NEGATIVE extensions (they shorten),
 * while outer edges get POSITIVE extensions (they lengthen).
 */
function calculateTrueMiterExtensions(
  meetingPoint: Point2D,
  wallADir: { x: number; y: number },
  wallBDir: { x: number; y: number },
  wallAEnd: 'start' | 'end',
  wallBEnd: 'start' | 'end',
  wallAAlignment: WallAlignmentSide,
  wallBAlignment: WallAlignmentSide,
  wallAThickness: number,
  wallBThickness: number,
  turnDirection: TurnDirection
): CornerSolution {
  const result: CornerSolution = {
    wallA: { leftEdge: 0, rightEdge: 0 },
    wallB: { leftEdge: 0, rightEdge: 0 },
  };

  // No miter needed for parallel walls
  if (turnDirection === 'straight' || turnDirection === 'back') {
    return result;
  }

  // Calculate angle between walls to check for very acute angles
  const dot = wallADir.x * wallBDir.x + wallADir.y * wallBDir.y;
  const angle = Math.acos(clamp(dot, -1, 1));

  // Skip miter for very acute angles (< ~15°) - would produce extreme extensions
  if (angle < MIN_MITER_ANGLE || angle > Math.PI - MIN_MITER_ANGLE) {
    return result;
  }

  // Maximum allowed extension based on wall thickness
  const maxExtension = Math.max(wallAThickness, wallBThickness) * MAX_EXTENSION_FACTOR;

  // Calculate perpendicular normals (pointing LEFT when looking from start to end)
  const normalA = { x: -wallADir.y, y: wallADir.x };
  const normalB = { x: -wallBDir.y, y: wallBDir.x };

  // Get edge offsets based on alignment
  const offsetsA = getEdgeOffsets(wallAAlignment, wallAThickness);
  const offsetsB = getEdgeOffsets(wallBAlignment, wallBThickness);

  // Adjust wall direction based on which end meets
  // For wall A: if END meets, direction points INTO corner
  // For wall A: if START meets, direction points AWAY from corner
  const effectiveDirA =
    wallAEnd === 'end'
      ? wallADir
      : { x: -wallADir.x, y: -wallADir.y };
  const effectiveDirB =
    wallBEnd === 'start'
      ? wallBDir
      : { x: -wallBDir.x, y: -wallBDir.y };

  // Create edge lines for Wall A at meeting point
  const leftEdgeA: Line2D = {
    point: {
      x: meetingPoint.x + normalA.x * offsetsA.left,
      y: meetingPoint.y + normalA.y * offsetsA.left,
    },
    direction: wallADir,
  };
  const rightEdgeA: Line2D = {
    point: {
      x: meetingPoint.x + normalA.x * offsetsA.right,
      y: meetingPoint.y + normalA.y * offsetsA.right,
    },
    direction: wallADir,
  };

  // Create edge lines for Wall B at meeting point
  const leftEdgeB: Line2D = {
    point: {
      x: meetingPoint.x + normalB.x * offsetsB.left,
      y: meetingPoint.y + normalB.y * offsetsB.left,
    },
    direction: wallBDir,
  };
  const rightEdgeB: Line2D = {
    point: {
      x: meetingPoint.x + normalB.x * offsetsB.right,
      y: meetingPoint.y + normalB.y * offsetsB.right,
    },
    direction: wallBDir,
  };

  // Determine which edges are outer/inner based on turn direction and which ends meet
  const isRightTurn = turnDirection === 'right';

  // For wall A: which edge is on the outer side of the corner?
  // At wall A's END with a right turn: right edge is outer
  // At wall A's START with a right turn: left edge is outer (flipped)
  const flipA = wallAEnd === 'start';
  const aOuterIsRight = flipA ? !isRightTurn : isRightTurn;

  // For wall B: which edge is on the outer side of the corner?
  // At wall B's START with a right turn: left edge is outer
  // At wall B's END with a right turn: right edge is outer (flipped)
  const flipB = wallBEnd === 'end';
  const bOuterIsRight = flipB ? isRightTurn : !isRightTurn;

  // Find intersection points by intersecting corresponding edges
  // Outer corner: where both outer edges meet
  // Inner corner: where both inner edges meet
  let outerIntersection: Point2D | null;
  let innerIntersection: Point2D | null;

  const aOuterEdge = aOuterIsRight ? rightEdgeA : leftEdgeA;
  const aInnerEdge = aOuterIsRight ? leftEdgeA : rightEdgeA;
  const bOuterEdge = bOuterIsRight ? rightEdgeB : leftEdgeB;
  const bInnerEdge = bOuterIsRight ? leftEdgeB : rightEdgeB;

  outerIntersection = lineLineIntersection(aOuterEdge, bOuterEdge);
  innerIntersection = lineLineIntersection(aInnerEdge, bInnerEdge);

  // Helper: calculate signed extension from edge point to intersection
  // Positive = extend in wall direction, Negative = shorten
  const calcExtension = (
    intersection: Point2D | null,
    edgePoint: Point2D,
    direction: { x: number; y: number }
  ): number => {
    if (!intersection) return 0;
    const dx = intersection.x - edgePoint.x;
    const dy = intersection.y - edgePoint.y;
    // Dot product gives signed distance along direction
    return dx * direction.x + dy * direction.y;
  };

  // Calculate extensions for Wall A
  if (aOuterIsRight) {
    result.wallA.rightEdge = calcExtension(
      outerIntersection,
      rightEdgeA.point,
      effectiveDirA
    );
    result.wallA.leftEdge = calcExtension(
      innerIntersection,
      leftEdgeA.point,
      effectiveDirA
    );
  } else {
    result.wallA.leftEdge = calcExtension(
      outerIntersection,
      leftEdgeA.point,
      effectiveDirA
    );
    result.wallA.rightEdge = calcExtension(
      innerIntersection,
      rightEdgeA.point,
      effectiveDirA
    );
  }

  // Calculate extensions for Wall B
  if (bOuterIsRight) {
    result.wallB.rightEdge = calcExtension(
      outerIntersection,
      rightEdgeB.point,
      effectiveDirB
    );
    result.wallB.leftEdge = calcExtension(
      innerIntersection,
      leftEdgeB.point,
      effectiveDirB
    );
  } else {
    result.wallB.leftEdge = calcExtension(
      outerIntersection,
      leftEdgeB.point,
      effectiveDirB
    );
    result.wallB.rightEdge = calcExtension(
      innerIntersection,
      rightEdgeB.point,
      effectiveDirB
    );
  }

  // Clamp all extensions to prevent extreme values at acute angles
  result.wallA.leftEdge = clamp(result.wallA.leftEdge, -maxExtension, maxExtension);
  result.wallA.rightEdge = clamp(result.wallA.rightEdge, -maxExtension, maxExtension);
  result.wallB.leftEdge = clamp(result.wallB.leftEdge, -maxExtension, maxExtension);
  result.wallB.rightEdge = clamp(result.wallB.rightEdge, -maxExtension, maxExtension);

  return result;
}

/**
 * Calculate the extensions needed for both walls at a corner.
 * Main entry point that dispatches to the true miter algorithm.
 */
export function calculateCornerExtensions(_config: CornerConfig): CornerSolution {
  // For now, we need the wall directions - we'll get them from the analysis function
  // This function is kept for API compatibility but the real work is in analyzeWallCorners
  return {
    wallA: { leftEdge: 0, rightEdge: 0 },
    wallB: { leftEdge: 0, rightEdge: 0 },
  };
}

// ============================================================================
// Wall Analysis Functions
// ============================================================================

/**
 * Get the direction vector of a wall (from start to end), normalized
 */
function getWallDirection(
  start: Point2D,
  end: Point2D
): { x: number; y: number } {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.001) return { x: 1, y: 0 };
  return { x: dx / len, y: dy / len };
}

/**
 * Calculate distance between two 2D points
 */
function distance(a: Point2D, b: Point2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Analyze all corners for a specific wall.
 * Returns the extensions needed for both ends of the wall.
 *
 * This function finds all walls connecting to this wall's endpoints
 * and calculates the true miter extensions for clean corner joints.
 */
export function analyzeWallCorners(
  wall: BimElement,
  allWalls: BimElement[],
  tolerance: number = 0.05
): WallCornerAnalysis {
  const result: WallCornerAnalysis = {
    wallId: wall.id,
    startExtensions: { leftEdge: 0, rightEdge: 0 },
    endExtensions: { leftEdge: 0, rightEdge: 0 },
  };

  if (wall.type !== 'wall' || !wall.wallData) return result;

  const wallStart = wall.wallData.startPoint;
  const wallEnd = wall.wallData.endPoint;
  const wallDir = getWallDirection(wallStart, wallEnd);
  const wallAlignment = wall.wallData.alignmentSide || 'center';
  const wallThickness = wall.wallData.thickness || 0.2;

  // Check each other wall for connections
  for (const other of allWalls) {
    if (other.id === wall.id || other.type !== 'wall' || !other.wallData)
      continue;

    const otherStart = other.wallData.startPoint;
    const otherEnd = other.wallData.endPoint;
    const otherDir = getWallDirection(otherStart, otherEnd);
    const otherAlignment = other.wallData.alignmentSide || 'center';
    const otherThickness = other.wallData.thickness || 0.2;

    // Check connections at THIS wall's START point
    const distStartToOtherStart = distance(wallStart, otherStart);
    const distStartToOtherEnd = distance(wallStart, otherEnd);

    if (distStartToOtherStart < tolerance || distStartToOtherEnd < tolerance) {
      const otherEndType: 'start' | 'end' =
        distStartToOtherStart < tolerance ? 'start' : 'end';
      const meetingPoint =
        otherEndType === 'start' ? otherStart : otherEnd;

      const turnDir = calculateTurnDirection(
        wallDir,
        otherDir,
        'start',
        otherEndType
      );

      const solution = calculateTrueMiterExtensions(
        meetingPoint,
        wallDir,
        otherDir,
        'start',
        otherEndType,
        wallAlignment,
        otherAlignment,
        wallThickness,
        otherThickness,
        turnDir
      );

      // Accumulate extensions (use max absolute value to handle multiple connections)
      result.startExtensions.leftEdge =
        Math.abs(solution.wallA.leftEdge) >
        Math.abs(result.startExtensions.leftEdge)
          ? solution.wallA.leftEdge
          : result.startExtensions.leftEdge;
      result.startExtensions.rightEdge =
        Math.abs(solution.wallA.rightEdge) >
        Math.abs(result.startExtensions.rightEdge)
          ? solution.wallA.rightEdge
          : result.startExtensions.rightEdge;
    }

    // Check connections at THIS wall's END point
    const distEndToOtherStart = distance(wallEnd, otherStart);
    const distEndToOtherEnd = distance(wallEnd, otherEnd);

    if (distEndToOtherStart < tolerance || distEndToOtherEnd < tolerance) {
      const otherEndType: 'start' | 'end' =
        distEndToOtherStart < tolerance ? 'start' : 'end';
      const meetingPoint =
        otherEndType === 'start' ? otherStart : otherEnd;

      const turnDir = calculateTurnDirection(
        wallDir,
        otherDir,
        'end',
        otherEndType
      );

      const solution = calculateTrueMiterExtensions(
        meetingPoint,
        wallDir,
        otherDir,
        'end',
        otherEndType,
        wallAlignment,
        otherAlignment,
        wallThickness,
        otherThickness,
        turnDir
      );

      // Accumulate extensions
      result.endExtensions.leftEdge =
        Math.abs(solution.wallA.leftEdge) >
        Math.abs(result.endExtensions.leftEdge)
          ? solution.wallA.leftEdge
          : result.endExtensions.leftEdge;
      result.endExtensions.rightEdge =
        Math.abs(solution.wallA.rightEdge) >
        Math.abs(result.endExtensions.rightEdge)
          ? solution.wallA.rightEdge
          : result.endExtensions.rightEdge;
    }
  }

  return result;
}

/**
 * Calculate corner vertices for a wall with miter extensions.
 * Returns the 4 corner points of the wall profile in world coordinates.
 *
 * This is useful for 2D rendering where we need actual vertex positions
 * rather than extension distances.
 */
export function calculateWallCornerVertices(
  wall: BimElement,
  allWalls: BimElement[]
): { startLeft: Point2D; startRight: Point2D; endLeft: Point2D; endRight: Point2D } | null {
  if (!wall.wallData) return null;

  const { startPoint, endPoint, thickness, alignmentSide } = wall.wallData;
  const alignment = alignmentSide || 'center';

  // Get wall direction and normal
  const dir = getWallDirection(startPoint, endPoint);
  const normal = { x: -dir.y, y: dir.x }; // Left-pointing normal

  // Get edge offsets
  const offsets = getEdgeOffsets(alignment, thickness);

  // Base corner positions (without miter)
  const baseStartLeft = {
    x: startPoint.x + normal.x * offsets.left,
    y: startPoint.y + normal.y * offsets.left,
  };
  const baseStartRight = {
    x: startPoint.x + normal.x * offsets.right,
    y: startPoint.y + normal.y * offsets.right,
  };
  const baseEndLeft = {
    x: endPoint.x + normal.x * offsets.left,
    y: endPoint.y + normal.y * offsets.left,
  };
  const baseEndRight = {
    x: endPoint.x + normal.x * offsets.right,
    y: endPoint.y + normal.y * offsets.right,
  };

  // Get corner analysis for miter extensions
  const analysis = analyzeWallCorners(wall, allWalls);

  // Apply extensions to get final corner positions
  // Start extensions move in NEGATIVE wall direction (towards start)
  // End extensions move in POSITIVE wall direction (towards end)
  return {
    startLeft: {
      x: baseStartLeft.x - dir.x * analysis.startExtensions.leftEdge,
      y: baseStartLeft.y - dir.y * analysis.startExtensions.leftEdge,
    },
    startRight: {
      x: baseStartRight.x - dir.x * analysis.startExtensions.rightEdge,
      y: baseStartRight.y - dir.y * analysis.startExtensions.rightEdge,
    },
    endLeft: {
      x: baseEndLeft.x + dir.x * analysis.endExtensions.leftEdge,
      y: baseEndLeft.y + dir.y * analysis.endExtensions.leftEdge,
    },
    endRight: {
      x: baseEndRight.x + dir.x * analysis.endExtensions.rightEdge,
      y: baseEndRight.y + dir.y * analysis.endExtensions.rightEdge,
    },
  };
}
