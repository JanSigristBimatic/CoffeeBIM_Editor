import type { BimElement, Opening } from '@/types/bim';

/**
 * Shared utility functions for openings (doors and windows)
 * Following DRY principle - used by both Door.ts and Window.ts
 */

/**
 * Calculate distances from opening center to wall edges
 */
export function calculateOpeningDistances(
  positionOnWall: number,
  openingWidth: number,
  wallLength: number
): { distanceFromLeft: number; distanceFromRight: number } {
  const centerDistance = positionOnWall * wallLength;
  const halfWidth = openingWidth / 2;

  return {
    distanceFromLeft: centerDistance - halfWidth,
    distanceFromRight: wallLength - centerDistance - halfWidth,
  };
}

/**
 * Calculate position on wall from distance from left edge
 */
export function calculatePositionFromLeftDistance(
  distanceFromLeft: number,
  openingWidth: number,
  wallLength: number
): number {
  const centerDistance = distanceFromLeft + openingWidth / 2;
  return centerDistance / wallLength;
}

/**
 * Calculate position on wall from distance from right edge
 */
export function calculatePositionFromRightDistance(
  distanceFromRight: number,
  openingWidth: number,
  wallLength: number
): number {
  const centerDistance = wallLength - distanceFromRight - openingWidth / 2;
  return centerDistance / wallLength;
}

/**
 * Calculate the world position of an opening given its host wall
 */
export function calculateOpeningWorldPosition(
  positionOnWall: number,
  wall: BimElement
): { x: number; y: number; z: number; angle: number } | null {
  if (!wall.wallData) return null;

  const { startPoint, endPoint } = wall.wallData;

  // Calculate position along wall
  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;

  const x = startPoint.x + dx * positionOnWall;
  const z = startPoint.y + dy * positionOnWall; // Note: 2D y maps to 3D z

  // Calculate wall angle
  const angle = Math.atan2(dy, dx);

  return { x, y: 0, z, angle };
}

/**
 * Generic function to update an Opening from element data
 */
export function updateOpeningFromElement(
  opening: Opening,
  element: BimElement
): Opening {
  if (element.type === 'door' && element.doorData) {
    return {
      ...opening,
      position: element.doorData.positionOnWall,
      width: element.doorData.width,
      height: element.doorData.height,
      sillHeight: element.doorData.sillHeight,
    };
  }

  if (element.type === 'window' && element.windowData) {
    return {
      ...opening,
      position: element.windowData.positionOnWall,
      width: element.windowData.width,
      height: element.windowData.height,
      sillHeight: element.windowData.sillHeight,
    };
  }

  return opening;
}

/**
 * Get host wall ID from element
 */
export function getHostWallId(element: BimElement): string | null {
  if (element.doorData) return element.doorData.hostWallId;
  if (element.windowData) return element.windowData.hostWallId;
  return null;
}
