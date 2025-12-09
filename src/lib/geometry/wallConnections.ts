import type { Point2D } from '@/types/geometry';
import type { BimElement } from '@/types/bim';
import { distance2D, normalizeAngle } from './math';

/** Tolerance for considering points as connected (in meters) */
const CONNECTION_TOLERANCE = 0.05; // 5cm

/**
 * Miter data for a wall end
 */
export interface MiterData {
  /** The miter angle in radians (half the angle between walls) */
  angle: number;
  /** Extension needed at the inner edge */
  innerExtension: number;
  /** Extension needed at the outer edge */
  outerExtension: number;
  /** Whether this wall should extend at this corner (to avoid overlap) */
  shouldExtend: boolean;
  /** ID of the connected wall */
  connectedWallId: string;
}

/**
 * Information about wall connections at start and end points
 */
export interface WallConnectionInfo {
  /** Whether there's a connected wall at the start point */
  hasStartConnection: boolean;
  /** Whether there's a connected wall at the end point */
  hasEndConnection: boolean;
  /** IDs of walls connected at start */
  startConnections: string[];
  /** IDs of walls connected at end */
  endConnections: string[];
  /** Miter data for start connection */
  startMiter: MiterData | null;
  /** Miter data for end connection */
  endMiter: MiterData | null;
}

/**
 * Check if two points are close enough to be considered connected
 */
function pointsAreConnected(p1: Point2D, p2: Point2D, tolerance: number = CONNECTION_TOLERANCE): boolean {
  return distance2D(p1, p2) <= tolerance;
}

/**
 * Get the wall direction angle (from start to end)
 */
function getWallAngle(wall: BimElement): number {
  if (!wall.wallData) return 0;
  const { startPoint, endPoint } = wall.wallData;
  return Math.atan2(endPoint.y - startPoint.y, endPoint.x - startPoint.x);
}

/**
 * Calculate miter data for a corner joint between two walls
 * @param thisWallId - ID of this wall
 * @param thisWallAngle - Direction angle of this wall at the joint
 * @param otherWallId - ID of the other wall
 * @param otherWallAngle - Direction angle of the other wall at the joint
 * @param thickness - Wall thickness
 * @param isAtStart - Whether this is at the start or end of this wall
 */
function calculateMiter(
  thisWallId: string,
  thisWallAngle: number,
  otherWallId: string,
  otherWallAngle: number,
  thickness: number,
  isAtStart: boolean
): MiterData {
  // At start point, wall goes away from the joint
  // At end point, wall goes toward the joint
  // We need the outgoing direction from the joint for both walls
  const thisOutgoing = isAtStart ? thisWallAngle : thisWallAngle + Math.PI;

  // Calculate the angle between the two walls
  const angleDiff = normalizeAngle(otherWallAngle - thisOutgoing);

  // The miter angle is half the exterior angle
  const miterAngle = angleDiff / 2;

  // Calculate extensions based on miter angle
  // For a 90° corner, extension = thickness / 2
  // General formula: extension = thickness / (2 * tan(|angleDiff|/2))
  // But we cap it to avoid extreme values
  const halfAngle = Math.abs(angleDiff / 2);
  const tanHalf = Math.tan(halfAngle);

  let extension = 0;
  if (tanHalf > 0.1) { // Avoid division by very small numbers
    extension = thickness / (2 * tanHalf);
    // Cap extension to reasonable values (max 2x thickness)
    extension = Math.min(extension, thickness * 2);
  } else {
    // Nearly parallel walls - use simple extension
    extension = thickness;
  }

  // To avoid overlap at corners, only ONE wall should extend.
  // Use lexicographic comparison of wall IDs for consistent ordering.
  // The wall with the "smaller" ID extends at this corner.
  const shouldExtend = thisWallId < otherWallId;

  return {
    angle: miterAngle,
    innerExtension: extension,
    outerExtension: extension,
    shouldExtend,
    connectedWallId: otherWallId,
  };
}

/**
 * Find all wall connection information for a given wall
 * Checks both start and end points against all other walls' endpoints
 * Calculates miter angles for clean corner joints
 */
export function getWallConnections(
  wall: BimElement,
  allWalls: BimElement[],
  tolerance: number = CONNECTION_TOLERANCE
): WallConnectionInfo {
  const result: WallConnectionInfo = {
    hasStartConnection: false,
    hasEndConnection: false,
    startConnections: [],
    endConnections: [],
    startMiter: null,
    endMiter: null,
  };

  if (!wall.wallData) return result;

  const { startPoint, endPoint, thickness } = wall.wallData;
  const thisWallAngle = getWallAngle(wall);

  for (const otherWall of allWalls) {
    // Skip self
    if (otherWall.id === wall.id) continue;
    if (!otherWall.wallData) continue;

    const otherStart = otherWall.wallData.startPoint;
    const otherEnd = otherWall.wallData.endPoint;
    const otherWallAngle = getWallAngle(otherWall);

    // Check start point connections
    const startConnectsToOtherStart = pointsAreConnected(startPoint, otherStart, tolerance);
    const startConnectsToOtherEnd = pointsAreConnected(startPoint, otherEnd, tolerance);

    if (startConnectsToOtherStart || startConnectsToOtherEnd) {
      result.hasStartConnection = true;
      result.startConnections.push(otherWall.id);

      // Calculate miter for first connection only (for simplicity)
      if (!result.startMiter) {
        // Determine other wall's outgoing direction at the connection
        const otherOutgoing = startConnectsToOtherStart
          ? otherWallAngle  // Other wall starts here, goes in its direction
          : otherWallAngle + Math.PI;  // Other wall ends here, comes from opposite

        result.startMiter = calculateMiter(wall.id, thisWallAngle, otherWall.id, otherOutgoing, thickness, true);
      }
    }

    // Check end point connections
    const endConnectsToOtherStart = pointsAreConnected(endPoint, otherStart, tolerance);
    const endConnectsToOtherEnd = pointsAreConnected(endPoint, otherEnd, tolerance);

    if (endConnectsToOtherStart || endConnectsToOtherEnd) {
      result.hasEndConnection = true;
      result.endConnections.push(otherWall.id);

      // Calculate miter for first connection only (for simplicity)
      if (!result.endMiter) {
        const otherOutgoing = endConnectsToOtherStart
          ? otherWallAngle
          : otherWallAngle + Math.PI;

        result.endMiter = calculateMiter(wall.id, thisWallAngle, otherWall.id, otherOutgoing, thickness, false);
      }
    }
  }

  return result;
}

/**
 * Calculate the extension amount for a wall end based on connections
 * Returns half thickness if there's a connection, 0 otherwise
 */
export function calculateEndExtension(
  hasConnection: boolean,
  thickness: number
): number {
  return hasConnection ? thickness / 2 : 0;
}

/**
 * Get all walls from an element list
 */
export function getWallElements(elements: BimElement[]): BimElement[] {
  return elements.filter(el => el.type === 'wall' && el.wallData != null);
}
