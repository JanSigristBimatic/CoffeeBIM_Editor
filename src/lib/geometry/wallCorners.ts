/**
 * Wall Corner Geometry Module
 *
 * Handles all corner/joint calculations for walls with different alignments.
 * This module solves the complex problem of connecting walls at corners
 * when they have different alignment sides (left/center/right).
 *
 * Key concepts:
 * - Each wall has an "alignment side" which is the reference edge
 * - At corners, we need to extend walls so their physical edges meet cleanly
 * - The extension amount depends on both walls' alignments and the corner angle
 */

import type { BimElement, WallAlignmentSide } from '@/types/bim';

// ============================================================================
// Types
// ============================================================================

/**
 * Represents which physical edge of a wall we're referring to.
 * Looking from start to end of wall:
 * - 'left': The edge on the left side
 * - 'right': The edge on the right side
 */
export type WallEdge = 'left' | 'right';

/**
 * The turn direction at a corner when following wall paths
 */
export type TurnDirection = 'left' | 'right' | 'straight' | 'back';

/**
 * Corner configuration describing how two walls meet
 */
export interface CornerConfig {
  /** ID of the first wall */
  wallAId: string;
  /** ID of the second wall */
  wallBId: string;
  /** Which end of wall A is at the corner */
  wallAEnd: 'start' | 'end';
  /** Which end of wall B is at the corner */
  wallBEnd: 'start' | 'end';
  /** Alignment of wall A */
  wallAAlignment: WallAlignmentSide;
  /** Alignment of wall B */
  wallBAlignment: WallAlignmentSide;
  /** Thickness of wall A */
  wallAThickness: number;
  /** Thickness of wall B */
  wallBThickness: number;
  /** Angle between walls in radians (0 = parallel, PI/2 = perpendicular) */
  cornerAngle: number;
  /** Turn direction when going from wall A to wall B */
  turnDirection: TurnDirection;
}

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
// Helper Functions
// ============================================================================

/**
 * Get the offset of each edge from the wall centerline based on alignment.
 * Returns [leftEdgeOffset, rightEdgeOffset] where:
 * - Negative offset = edge is on the "negative" side of centerline
 * - Positive offset = edge is on the "positive" side of centerline
 */
export function getEdgeOffsets(
  alignment: WallAlignmentSide,
  thickness: number
): { left: number; right: number } {
  switch (alignment) {
    case 'left':
      // Reference edge (left) at centerline, wall extends to the right
      return { left: 0, right: thickness };
    case 'center':
      // Wall centered on centerline
      return { left: -thickness / 2, right: thickness / 2 };
    case 'right':
      // Reference edge (right) at centerline, wall extends to the left
      return { left: -thickness, right: 0 };
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
  const dirA = wallAEnd === 'start'
    ? { x: -wallADirection.x, y: -wallADirection.y }  // Reverse if start meets
    : wallADirection;
  const dirB = wallBEnd === 'start'
    ? wallBDirection  // Keep if start (entering wall B)
    : { x: -wallBDirection.x, y: -wallBDirection.y };  // Reverse if end meets

  // Cross product Z component: dirA.x * dirB.y - dirA.y * dirB.x
  const cross = dirA.x * dirB.y - dirA.y * dirB.x;

  // Dot product for parallel/anti-parallel detection
  const dot = dirA.x * dirB.x + dirA.y * dirB.y;

  const epsilon = 0.001;

  if (Math.abs(cross) < epsilon) {
    // Walls are parallel or anti-parallel
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
  const dirA = wallAEnd === 'start'
    ? { x: -wallADirection.x, y: -wallADirection.y }
    : wallADirection;
  const dirB = wallBEnd === 'start'
    ? wallBDirection
    : { x: -wallBDirection.x, y: -wallBDirection.y };

  // Angle between the two direction vectors
  const dot = dirA.x * dirB.x + dirA.y * dirB.y;
  const angle = Math.acos(Math.max(-1, Math.min(1, dot)));

  return angle;
}

// ============================================================================
// Core Corner Calculation
// ============================================================================

/**
 * Calculate the extensions needed for both walls at a corner.
 * This is the main function that handles all alignment combinations.
 */
export function calculateCornerExtensions(config: CornerConfig): CornerSolution {
  const {
    wallAAlignment, wallBAlignment,
    wallAThickness, wallBThickness,
    cornerAngle, turnDirection
  } = config;

  // Get edge offsets for both walls
  const edgesA = getEdgeOffsets(wallAAlignment, wallAThickness);
  const edgesB = getEdgeOffsets(wallBAlignment, wallBThickness);

  // For a 90° corner (most common case), calculate extensions
  // based on which edges meet and which need to extend

  if (Math.abs(cornerAngle - Math.PI / 2) < 0.1) {
    // ~90° corner - use simplified perpendicular logic
    return calculatePerpendicularCorner(
      edgesA, edgesB,
      wallAThickness, wallBThickness,
      turnDirection,
      config.wallAEnd, config.wallBEnd
    );
  }

  // For other angles, use general miter calculation
  return calculateAngledCorner(
    edgesA, edgesB,
    wallAThickness, wallBThickness,
    cornerAngle, turnDirection,
    config.wallAEnd, config.wallBEnd
  );
}

/**
 * Calculate extensions for a ~90° perpendicular corner.
 *
 * SIMPLIFIED APPROACH:
 * - Only the OUTER edge extends (to cover the other wall)
 * - The INNER edge stays at 0 (no extension)
 * - This creates a clean diagonal miter cut
 *
 * Turn direction determines which edge is outer:
 * - Right turn at wall end: right edge is outer
 * - Left turn at wall end: left edge is outer
 * - At wall start: reversed
 */
function calculatePerpendicularCorner(
  edgesA: { left: number; right: number },
  edgesB: { left: number; right: number },
  _thicknessA: number,
  _thicknessB: number,
  turnDirection: TurnDirection,
  wallAEnd: 'start' | 'end',
  wallBEnd: 'start' | 'end'
): CornerSolution {
  const result: CornerSolution = {
    wallA: { leftEdge: 0, rightEdge: 0 },
    wallB: { leftEdge: 0, rightEdge: 0 }
  };

  // Handle parallel/anti-parallel walls (no corner)
  if (turnDirection === 'straight' || turnDirection === 'back') {
    return result;
  }

  // Determine which edge is outer for each wall
  const isWallAEnd = wallAEnd === 'end';
  const isRightTurn = turnDirection === 'right';
  const aOuterIsRight = isWallAEnd ? isRightTurn : !isRightTurn;

  const isWallBStart = wallBEnd === 'start';
  const bOuterIsRight = isWallBStart ? !isRightTurn : isRightTurn;

  // Get the other wall's offset at the outer edge (how far it extends from centerline)
  // This is how much THIS wall needs to extend to cover the OTHER wall
  const bOuterOffset = bOuterIsRight ? Math.abs(edgesB.right) : Math.abs(edgesB.left);
  const aOuterOffset = aOuterIsRight ? Math.abs(edgesA.right) : Math.abs(edgesA.left);

  // ONLY extend the outer edge - inner edge stays at 0
  if (aOuterIsRight) {
    result.wallA.rightEdge = bOuterOffset;
    result.wallA.leftEdge = 0;  // Inner edge: no extension
  } else {
    result.wallA.leftEdge = bOuterOffset;
    result.wallA.rightEdge = 0;  // Inner edge: no extension
  }

  if (bOuterIsRight) {
    result.wallB.rightEdge = aOuterOffset;
    result.wallB.leftEdge = 0;
  } else {
    result.wallB.leftEdge = aOuterOffset;
    result.wallB.rightEdge = 0;
  }

  return result;
}

/**
 * Calculate extensions for a non-90° angled corner.
 *
 * SIMPLIFIED APPROACH (same as perpendicular):
 * - Only the OUTER edge extends
 * - Extension is based on the other wall's thickness/offset
 * - No trigonometric scaling (keeps it simple and predictable)
 */
function calculateAngledCorner(
  edgesA: { left: number; right: number },
  edgesB: { left: number; right: number },
  _thicknessA: number,
  _thicknessB: number,
  _cornerAngle: number,
  turnDirection: TurnDirection,
  wallAEnd: 'start' | 'end',
  wallBEnd: 'start' | 'end'
): CornerSolution {
  const result: CornerSolution = {
    wallA: { leftEdge: 0, rightEdge: 0 },
    wallB: { leftEdge: 0, rightEdge: 0 }
  };

  // Handle parallel/anti-parallel walls
  if (turnDirection === 'straight' || turnDirection === 'back') {
    return result;
  }

  // Same logic as perpendicular - just extend outer edge
  const isWallAEnd = wallAEnd === 'end';
  const isRightTurn = turnDirection === 'right';
  const aOuterIsRight = isWallAEnd ? isRightTurn : !isRightTurn;

  const isWallBStart = wallBEnd === 'start';
  const bOuterIsRight = isWallBStart ? !isRightTurn : isRightTurn;

  // Get outer edge offsets
  const bOuterOffset = bOuterIsRight ? Math.abs(edgesB.right) : Math.abs(edgesB.left);
  const aOuterOffset = aOuterIsRight ? Math.abs(edgesA.right) : Math.abs(edgesA.left);

  // Only extend outer edge
  if (aOuterIsRight) {
    result.wallA.rightEdge = bOuterOffset;
  } else {
    result.wallA.leftEdge = bOuterOffset;
  }

  if (bOuterIsRight) {
    result.wallB.rightEdge = aOuterOffset;
  } else {
    result.wallB.leftEdge = aOuterOffset;
  }

  return result;
}

// ============================================================================
// Wall Analysis Functions
// ============================================================================

/**
 * Analyze all corners for a specific wall.
 * Returns the extensions needed for both ends of the wall.
 */
export function analyzeWallCorners(
  wall: BimElement,
  allWalls: BimElement[],
  tolerance: number = 0.05
): WallCornerAnalysis {
  const result: WallCornerAnalysis = {
    wallId: wall.id,
    startExtensions: { leftEdge: 0, rightEdge: 0 },
    endExtensions: { leftEdge: 0, rightEdge: 0 }
  };

  if (wall.type !== 'wall' || !wall.wallData) return result;

  const wallStart = wall.wallData.startPoint;
  const wallEnd = wall.wallData.endPoint;
  const wallDir = getWallDirection(wallStart, wallEnd);
  const wallAlignment = wall.wallData.alignmentSide || 'center';
  const wallThickness = wall.wallData.thickness || 0.2;

  // Find walls connecting at start
  for (const other of allWalls) {
    if (other.id === wall.id || other.type !== 'wall' || !other.wallData) continue;

    const otherStart = other.wallData.startPoint;
    const otherEnd = other.wallData.endPoint;
    const otherDir = getWallDirection(otherStart, otherEnd);
    const otherAlignment = other.wallData.alignmentSide || 'center';
    const otherThickness = other.wallData.thickness || 0.2;

    // Check start connections
    const distToOtherStart = distance(wallStart, otherStart);
    const distToOtherEnd = distance(wallStart, otherEnd);

    if (distToOtherStart < tolerance || distToOtherEnd < tolerance) {
      const otherEnd_ = distToOtherStart < tolerance ? 'start' : 'end';
      const turnDir = calculateTurnDirection(wallDir, otherDir, 'start', otherEnd_);
      const angle = calculateCornerAngle(wallDir, otherDir, 'start', otherEnd_);

      const config: CornerConfig = {
        wallAId: wall.id,
        wallBId: other.id,
        wallAEnd: 'start',
        wallBEnd: otherEnd_,
        wallAAlignment: wallAlignment,
        wallBAlignment: otherAlignment,
        wallAThickness: wallThickness,
        wallBThickness: otherThickness,
        cornerAngle: angle,
        turnDirection: turnDir
      };

      const solution = calculateCornerExtensions(config);

      // Accumulate extensions (in case multiple walls connect)
      result.startExtensions.leftEdge = Math.max(result.startExtensions.leftEdge, solution.wallA.leftEdge);
      result.startExtensions.rightEdge = Math.max(result.startExtensions.rightEdge, solution.wallA.rightEdge);
    }

    // Check end connections
    const distEndToOtherStart = distance(wallEnd, otherStart);
    const distEndToOtherEnd = distance(wallEnd, otherEnd);

    if (distEndToOtherStart < tolerance || distEndToOtherEnd < tolerance) {
      const otherEnd_ = distEndToOtherStart < tolerance ? 'start' : 'end';
      const turnDir = calculateTurnDirection(wallDir, otherDir, 'end', otherEnd_);
      const angle = calculateCornerAngle(wallDir, otherDir, 'end', otherEnd_);

      const config: CornerConfig = {
        wallAId: wall.id,
        wallBId: other.id,
        wallAEnd: 'end',
        wallBEnd: otherEnd_,
        wallAAlignment: wallAlignment,
        wallBAlignment: otherAlignment,
        wallAThickness: wallThickness,
        wallBThickness: otherThickness,
        cornerAngle: angle,
        turnDirection: turnDir
      };

      const solution = calculateCornerExtensions(config);

      result.endExtensions.leftEdge = Math.max(result.endExtensions.leftEdge, solution.wallA.leftEdge);
      result.endExtensions.rightEdge = Math.max(result.endExtensions.rightEdge, solution.wallA.rightEdge);
    }
  }

  return result;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get the direction vector of a wall (from start to end), normalized
 */
function getWallDirection(
  start: { x: number; y: number },
  end: { x: number; y: number }
): { x: number; y: number } {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.001) return { x: 1, y: 0 }; // Default direction for zero-length
  return { x: dx / len, y: dy / len };
}

/**
 * Calculate distance between two 2D points
 */
function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}
