import { v4 as uuidv4 } from 'uuid';
import type { BimElement, WallData } from '@/types/bim';
import type { Point2D } from '@/types/geometry';

export const DEFAULT_WALL_THICKNESS = 0.2; // meters
export const DEFAULT_WALL_HEIGHT = 3.0; // meters

export interface CreateWallParams {
  startPoint: Point2D;
  endPoint: Point2D;
  thickness?: number;
  height?: number;
  storeyId: string;
  name?: string;
}

/**
 * Creates a new wall element from start and end points
 */
export function createWall(params: CreateWallParams): BimElement {
  const {
    startPoint,
    endPoint,
    thickness = DEFAULT_WALL_THICKNESS,
    height = DEFAULT_WALL_HEIGHT,
    storeyId,
    name,
  } = params;

  // Calculate wall direction and length
  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;
  const length = Math.sqrt(dx * dx + dy * dy);

  // Don't create walls that are too short
  if (length < 0.1) {
    throw new Error('Wall is too short (minimum 0.1m)');
  }

  // Calculate perpendicular for thickness offset
  const halfThickness = thickness / 2;

  // Create rectangular profile for extrusion (in local coordinates)
  // Profile is in XY plane, will be extruded along Z
  const profile: Point2D[] = [
    { x: 0, y: -halfThickness },
    { x: length, y: -halfThickness },
    { x: length, y: halfThickness },
    { x: 0, y: halfThickness },
  ];

  // Calculate rotation angle (around Z-axis for Z-up system)
  const angle = Math.atan2(dy, dx);

  const wallData: WallData = {
    startPoint: { ...startPoint },
    endPoint: { ...endPoint },
    thickness,
    height,
    openings: [],
  };

  const id = uuidv4();
  const wallNumber = Date.now().toString().slice(-4);

  return {
    id,
    type: 'wall',
    name: name || `Wand ${wallNumber}`,
    geometry: {
      profile,
      height,
      direction: { x: 0, y: 0, z: 1 }, // Extrude upward (Z-up)
    },
    placement: {
      // Z-up coordinate system: 2D (x,y) → 3D (x, y, 0)
      position: { x: startPoint.x, y: startPoint.y, z: 0 },
      rotation: {
        // Rotation around Z-axis (quaternion)
        x: 0,
        y: 0,
        z: Math.sin(angle / 2),
        w: Math.cos(angle / 2),
      },
    },
    properties: [
      {
        name: 'Pset_WallCommon',
        properties: {
          IsExternal: false,
          LoadBearing: false,
        },
      },
    ],
    parentId: storeyId,
    wallData,
  };
}

/**
 * Calculate the length of a wall
 */
export function calculateWallLength(wall: BimElement): number {
  if (!wall.wallData) return 0;
  const { startPoint, endPoint } = wall.wallData;
  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Check if a point is near a wall (for opening placement)
 */
export function getPositionOnWall(
  wall: BimElement,
  point: Point2D,
  tolerance: number = 0.5
): number | null {
  if (!wall.wallData) return null;

  const { startPoint, endPoint } = wall.wallData;
  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;
  const length = Math.sqrt(dx * dx + dy * dy);

  if (length < 0.01) return null;

  // Vector from start to point
  const px = point.x - startPoint.x;
  const py = point.y - startPoint.y;

  // Project point onto wall line
  const t = (px * dx + py * dy) / (length * length);

  // Check if projection is within wall bounds
  if (t < 0 || t > 1) return null;

  // Calculate distance from point to wall line
  const projX = startPoint.x + t * dx;
  const projY = startPoint.y + t * dy;
  const distance = Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2);

  // Check if within tolerance
  if (distance > tolerance) return null;

  return t; // Return position along wall (0-1)
}

/**
 * Update wall dimensions (thickness and/or height)
 * Recalculates geometry profile when dimensions change
 */
export function updateWallDimensions(
  wall: BimElement,
  updates: Partial<Pick<WallData, 'thickness' | 'height'>>
): Partial<BimElement> {
  if (!wall.wallData) return {};

  const newWallData = { ...wall.wallData, ...updates };
  const { startPoint, endPoint } = newWallData;

  // Calculate wall length
  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;
  const length = Math.sqrt(dx * dx + dy * dy);

  // Recalculate profile with new thickness
  const halfThickness = newWallData.thickness / 2;
  const profile: Point2D[] = [
    { x: 0, y: -halfThickness },
    { x: length, y: -halfThickness },
    { x: length, y: halfThickness },
    { x: 0, y: halfThickness },
  ];

  return {
    wallData: newWallData,
    geometry: {
      ...wall.geometry,
      profile,
      height: newWallData.height,
    },
  };
}
