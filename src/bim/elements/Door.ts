import { v4 as uuidv4 } from 'uuid';
import type { BimElement, DoorData, DoorType, Opening } from '@/types/bim';
import {
  DEFAULT_DOOR_WIDTH,
  DEFAULT_DOUBLE_DOOR_WIDTH,
  DEFAULT_SLIDING_DOOR_WIDTH,
  DEFAULT_DOOR_HEIGHT,
} from '@/types/bim';

export { DEFAULT_DOOR_WIDTH, DEFAULT_DOOR_HEIGHT };

export interface CreateDoorParams {
  hostWallId: string;
  positionOnWall: number; // 0-1 position along wall centerline
  wallLength: number; // Length of host wall in meters
  storeyId: string;
  doorType?: DoorType;
  width?: number;
  height?: number;
  swingDirection?: 'left' | 'right';
  name?: string;
  /** Height from floor to bottom of door (default 0) */
  sillHeight?: number;
}

/**
 * Get default width for a door type
 */
export function getDefaultDoorWidth(doorType: DoorType): number {
  switch (doorType) {
    case 'single':
      return DEFAULT_DOOR_WIDTH;
    case 'double':
      return DEFAULT_DOUBLE_DOOR_WIDTH;
    case 'sliding':
      return DEFAULT_SLIDING_DOOR_WIDTH;
    default:
      return DEFAULT_DOOR_WIDTH;
  }
}

/**
 * Get operation type string for IFC based on door type
 */
function getOperationType(doorType: DoorType, swingDirection: 'left' | 'right'): string {
  switch (doorType) {
    case 'single':
      return swingDirection === 'left' ? 'single_swing_left' : 'single_swing_right';
    case 'double':
      return 'double_swing';
    case 'sliding':
      return 'sliding';
    default:
      return 'single_swing_left';
  }
}

/**
 * Get door type label for display
 */
export function getDoorTypeLabel(doorType: DoorType): string {
  switch (doorType) {
    case 'single':
      return 'Einfach';
    case 'double':
      return 'Doppel';
    case 'sliding':
      return 'Schiebe';
    default:
      return doorType;
  }
}

/**
 * Calculate distances from door center to wall edges
 */
export function calculateDoorDistances(
  positionOnWall: number,
  doorWidth: number,
  wallLength: number
): { distanceFromLeft: number; distanceFromRight: number } {
  const centerDistance = positionOnWall * wallLength;
  const halfWidth = doorWidth / 2;

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
  doorWidth: number,
  wallLength: number
): number {
  const centerDistance = distanceFromLeft + doorWidth / 2;
  return centerDistance / wallLength;
}

/**
 * Calculate position on wall from distance from right edge
 */
export function calculatePositionFromRightDistance(
  distanceFromRight: number,
  doorWidth: number,
  wallLength: number
): number {
  const centerDistance = wallLength - distanceFromRight - doorWidth / 2;
  return centerDistance / wallLength;
}

/**
 * Creates a new door element
 * Door is placed relative to its host wall
 */
export function createDoor(params: CreateDoorParams): BimElement {
  const {
    hostWallId,
    positionOnWall,
    wallLength,
    storeyId,
    doorType = 'single',
    width,
    height = DEFAULT_DOOR_HEIGHT,
    swingDirection = 'left',
    name,
    sillHeight = 0,
  } = params;

  // Use provided width or default for door type
  const doorWidth = width ?? getDefaultDoorWidth(doorType);

  // Validate position
  if (positionOnWall < 0 || positionOnWall > 1) {
    throw new Error('Door position must be between 0 and 1');
  }

  const id = uuidv4();
  const doorNumber = Date.now().toString().slice(-4);

  // Calculate distances
  const { distanceFromLeft, distanceFromRight } = calculateDoorDistances(
    positionOnWall,
    doorWidth,
    wallLength
  );

  const doorData: DoorData = {
    width: doorWidth,
    height,
    doorType,
    hostWallId,
    positionOnWall,
    swingDirection,
    distanceFromLeft,
    distanceFromRight,
    sillHeight,
  };

  return {
    id,
    type: 'door',
    name: name || `Tür ${doorNumber}`,
    geometry: {
      // Door profile (simplified rectangle for IFC export)
      profile: [
        { x: 0, y: 0 },
        { x: doorWidth, y: 0 },
        { x: doorWidth, y: height },
        { x: 0, y: height },
      ],
      height: 0.05, // Door thickness
      direction: { x: 0, y: 0, z: 1 },
    },
    placement: {
      // Position will be calculated relative to wall during rendering
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
    },
    properties: [
      {
        name: 'Pset_DoorCommon',
        properties: {
          IsExternal: false,
          FireRating: 'none',
          OperationType: getOperationType(doorType, swingDirection),
          DoorType: doorType,
        },
      },
    ],
    parentId: storeyId,
    doorData,
  };
}

/**
 * Creates an Opening object for a wall based on a door
 */
export function createOpeningFromDoor(door: BimElement): Opening | null {
  if (!door.doorData) return null;

  return {
    id: uuidv4(),
    type: 'door',
    elementId: door.id,
    position: door.doorData.positionOnWall,
    width: door.doorData.width,
    height: door.doorData.height,
    sillHeight: door.doorData.sillHeight,
  };
}

/**
 * Update an existing Opening to match door data
 */
export function updateOpeningFromDoor(opening: Opening, door: BimElement): Opening {
  if (!door.doorData) return opening;

  return {
    ...opening,
    position: door.doorData.positionOnWall,
    width: door.doorData.width,
    height: door.doorData.height,
    sillHeight: door.doorData.sillHeight,
  };
}

/**
 * Calculate the world position of a door given its host wall
 */
export function calculateDoorWorldPosition(
  door: BimElement,
  wall: BimElement
): { x: number; y: number; z: number; angle: number } | null {
  if (!door.doorData || !wall.wallData) return null;

  const { startPoint, endPoint } = wall.wallData;
  const { positionOnWall } = door.doorData;

  // Calculate position along wall
  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;

  const x = startPoint.x + dx * positionOnWall;
  const z = startPoint.y + dy * positionOnWall; // Note: 2D y maps to 3D z

  // Calculate wall angle
  const angle = Math.atan2(dy, dx);

  return { x, y: 0, z, angle };
}
