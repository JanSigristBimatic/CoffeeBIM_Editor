import { v4 as uuidv4 } from 'uuid';
import type { BimElement, WallData, WallAlignmentSide } from '@/types/bim';
import { DEFAULT_WALL_ALIGNMENT } from '@/types/bim';
import type { Point2D } from '@/types/geometry';
import { calculateWallGeometry } from '@/lib/geometry';

// Re-export for convenience
export { DEFAULT_WALL_ALIGNMENT };

export const DEFAULT_WALL_THICKNESS = 0.2; // meters
export const DEFAULT_WALL_HEIGHT = 3.0; // meters

export interface CreateWallParams {
  startPoint: Point2D;
  endPoint: Point2D;
  thickness?: number;
  height?: number;
  storeyId: string;
  elevation?: number; // Storey elevation (Z position)
  name?: string;
  /** Which edge the reference line represents (left/center/right) */
  alignmentSide?: WallAlignmentSide;
}

/**
 * Calculate profile Y-offset based on alignment side
 * - 'left': Wall extends to the right (positive Y in local coords) → offset = 0 to thickness
 * - 'center': Wall centered on reference line → offset = -halfThickness to +halfThickness
 * - 'right': Wall extends to the left (negative Y in local coords) → offset = -thickness to 0
 */
function getProfileOffset(alignmentSide: WallAlignmentSide, thickness: number): { min: number; max: number } {
  const halfThickness = thickness / 2;

  switch (alignmentSide) {
    case 'left':
      // Reference line is left edge, wall extends to the right
      return { min: 0, max: thickness };
    case 'right':
      // Reference line is right edge, wall extends to the left
      return { min: -thickness, max: 0 };
    case 'center':
    default:
      // Reference line is center (traditional)
      return { min: -halfThickness, max: halfThickness };
  }
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
    elevation = 0,
    name,
    alignmentSide = DEFAULT_WALL_ALIGNMENT,
  } = params;

  // Calculate wall geometry using centralized utility
  const wallGeometry = calculateWallGeometry(startPoint, endPoint);

  // Don't create walls that are too short
  if (wallGeometry.length < 0.1) {
    throw new Error('Wall is too short (minimum 0.1m)');
  }

  // Calculate profile offset based on alignment
  const offset = getProfileOffset(alignmentSide, thickness);

  // Create rectangular profile for extrusion (in local coordinates)
  // Profile is in XY plane, will be extruded along Z
  // Y-offset determined by alignment side
  const profile: Point2D[] = [
    { x: 0, y: offset.min },
    { x: wallGeometry.length, y: offset.min },
    { x: wallGeometry.length, y: offset.max },
    { x: 0, y: offset.max },
  ];

  const wallData: WallData = {
    startPoint: { ...startPoint },
    endPoint: { ...endPoint },
    thickness,
    height,
    openings: [],
    alignmentSide,
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
      // Z-up coordinate system: 2D (x,y) → 3D (x, y, elevation)
      position: { x: startPoint.x, y: startPoint.y, z: elevation },
      rotation: {
        // Rotation around Z-axis (quaternion)
        x: 0,
        y: 0,
        z: Math.sin(wallGeometry.angle / 2),
        w: Math.cos(wallGeometry.angle / 2),
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
  return calculateWallGeometry(startPoint, endPoint).length;
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
  const geo = calculateWallGeometry(startPoint, endPoint);

  if (geo.length < 0.01) return null;

  // Vector from start to point
  const px = point.x - startPoint.x;
  const py = point.y - startPoint.y;

  // Project point onto wall line
  const t = (px * geo.dx + py * geo.dy) / (geo.length * geo.length);

  // Check if projection is within wall bounds
  if (t < 0 || t > 1) return null;

  // Calculate distance from point to wall line
  const projX = startPoint.x + t * geo.dx;
  const projY = startPoint.y + t * geo.dy;
  const distance = Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2);

  // Check if within tolerance
  if (distance > tolerance) return null;

  return t; // Return position along wall (0-1)
}

/**
 * Update wall dimensions (thickness, height, and/or alignment)
 * Recalculates geometry profile when dimensions change
 */
export function updateWallDimensions(
  wall: BimElement,
  updates: Partial<Pick<WallData, 'thickness' | 'height' | 'alignmentSide'>>
): Partial<BimElement> {
  if (!wall.wallData) return {};

  const newWallData = { ...wall.wallData, ...updates };
  const { startPoint, endPoint } = newWallData;

  // Calculate wall length using centralized utility
  const { length } = calculateWallGeometry(startPoint, endPoint);

  // Recalculate profile with new thickness and alignment
  const offset = getProfileOffset(newWallData.alignmentSide, newWallData.thickness);
  const profile: Point2D[] = [
    { x: 0, y: offset.min },
    { x: length, y: offset.min },
    { x: length, y: offset.max },
    { x: 0, y: offset.max },
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

/**
 * Update wall alignment side
 * Convenience function for changing just the alignment
 */
export function updateWallAlignment(
  wall: BimElement,
  alignmentSide: WallAlignmentSide
): Partial<BimElement> {
  return updateWallDimensions(wall, { alignmentSide });
}
