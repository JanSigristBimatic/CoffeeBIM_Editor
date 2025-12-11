/**
 * OCCT-based Wall Geometry Generator
 *
 * Uses OpenCascade.js boolean operations to create wall geometry
 * with proper openings for doors and windows.
 *
 * Advantages over manual 2D shape extrusion:
 * - Clean boolean cuts for openings
 * - Proper miter cuts at corners
 * - Better handling of complex wall intersections
 */

import type { Opening, WallAlignmentSide } from '@/types/bim';
import type { Point2D } from '@/types/geometry';
import type { MeshData, Vector3D, ShapeCreationResult } from './types';
import {
  isOcctReady,
  createBox,
  extrudeProfile,
  booleanOperation,
  disposeShape,
} from './index';
import type { WallEndExtensions } from '@/lib/geometry';

interface WallGeometryParams {
  /** Wall length in meters */
  length: number;
  /** Wall height in meters */
  height: number;
  /** Wall thickness in meters */
  thickness: number;
  /** Wall alignment (left, center, right) */
  alignmentSide: WallAlignmentSide;
  /** Openings (doors, windows) in the wall */
  openings?: Opening[];
  /** Miter extensions at start */
  startExtensions?: WallEndExtensions;
  /** Miter extensions at end */
  endExtensions?: WallEndExtensions;
}

/**
 * Calculate profile Z-offset based on alignment side
 */
function getProfileOffset(
  alignmentSide: WallAlignmentSide,
  thickness: number
): { min: number; max: number } {
  const halfThickness = thickness / 2;

  switch (alignmentSide) {
    case 'left':
      return { min: 0, max: thickness };
    case 'right':
      return { min: -thickness, max: 0 };
    case 'center':
    default:
      return { min: -halfThickness, max: halfThickness };
  }
}

/**
 * Creates wall profile points with miter cuts
 */
function createWallProfile(
  length: number,
  thickness: number,
  alignmentSide: WallAlignmentSide,
  startExtensions: WallEndExtensions,
  endExtensions: WallEndExtensions
): Point2D[] {
  const offset = getProfileOffset(alignmentSide, thickness);

  // X positions for each corner
  const x0 = -startExtensions.rightEdge; // Start, right edge
  const x1 = -startExtensions.leftEdge; // Start, left edge
  const x2 = length + endExtensions.leftEdge; // End, left edge
  const x3 = length + endExtensions.rightEdge; // End, right edge

  // Z positions based on wall alignment (stored as Y in 2D profile)
  const z0 = offset.min; // Right edge
  const z1 = offset.max; // Left edge

  // Profile in XZ plane (Z is up when looking from above)
  // Winding counter-clockwise for proper normals
  return [
    { x: x0, y: z0 }, // Start, right edge
    { x: x3, y: z0 }, // End, right edge
    { x: x2, y: z1 }, // End, left edge
    { x: x1, y: z1 }, // Start, left edge
  ];
}

/**
 * Creates opening cutter box parameters
 */
function createOpeningCutter(
  opening: Opening,
  wallLength: number,
  wallThickness: number,
  alignmentSide: WallAlignmentSide
): { width: number; depth: number; height: number; position: Vector3D } {
  const { position: relPos, width, height, sillHeight } = opening;
  const offset = getProfileOffset(alignmentSide, wallThickness);

  // Calculate X position along wall (position is 0-1 along wall)
  const centerX = relPos * wallLength;
  const halfWidth = width / 2;

  // Opening position
  const x = centerX - halfWidth;
  const y = sillHeight;
  const z = offset.min - 0.01; // Extend slightly beyond wall faces

  // Depth includes extra to ensure clean cut
  const depth = wallThickness + 0.02;

  return {
    width,
    depth,
    height,
    position: { x, y, z },
  };
}

/**
 * Generates wall mesh using OCCT boolean operations
 *
 * @param params Wall geometry parameters
 * @returns MeshData for Three.js rendering, or null if OCCT not ready
 *
 * @example
 * const mesh = await generateWallMeshOCCT({
 *   length: 5,
 *   height: 3,
 *   thickness: 0.2,
 *   alignmentSide: 'center',
 *   openings: [
 *     { position: 0.5, width: 0.9, height: 2.1, sillHeight: 0, type: 'door' }
 *   ],
 * });
 */
export async function generateWallMeshOCCT(
  params: WallGeometryParams
): Promise<MeshData | null> {
  if (!isOcctReady()) {
    console.warn('[OCCT WallGeometry] OpenCascade not ready');
    return null;
  }

  const {
    length,
    height,
    thickness,
    alignmentSide,
    openings = [],
    startExtensions = { leftEdge: 0, rightEdge: 0 },
    endExtensions = { leftEdge: 0, rightEdge: 0 },
  } = params;

  const shapesToDispose: string[] = [];

  try {
    // Create wall profile with miter cuts
    const profile = createWallProfile(
      length,
      thickness,
      alignmentSide,
      startExtensions,
      endExtensions
    );

    // Extrude wall profile
    const wallResult = await extrudeProfile({
      profile,
      height,
      direction: { x: 0, y: 1, z: 0 }, // Extrude up (Y is height in local space)
      position: { x: 0, y: 0, z: 0 },
    });

    if (!wallResult) {
      console.error('[OCCT WallGeometry] Failed to extrude wall profile');
      return null;
    }

    shapesToDispose.push(wallResult.handle.id);
    let currentShape = wallResult;

    // Cut openings using boolean operations
    for (const opening of openings) {
      const cutterParams = createOpeningCutter(
        opening,
        length,
        thickness,
        alignmentSide
      );

      // Create cutter box
      const cutterResult = await createBox(cutterParams);
      if (!cutterResult) {
        console.warn('[OCCT WallGeometry] Failed to create opening cutter');
        continue;
      }
      shapesToDispose.push(cutterResult.handle.id);

      // Perform boolean cut
      const cutResult = await booleanOperation({
        type: 'cut',
        objectId: currentShape.handle.id,
        toolId: cutterResult.handle.id,
        fuzzyValue: 0.001,
      });

      if (cutResult) {
        shapesToDispose.push(cutResult.handle.id);
        currentShape = cutResult;
      } else {
        console.warn('[OCCT WallGeometry] Boolean cut failed for opening');
      }
    }

    // Return final mesh
    return currentShape.mesh;
  } catch (error) {
    console.error('[OCCT WallGeometry] Error generating wall:', error);
    return null;
  } finally {
    // Clean up intermediate shapes
    for (const shapeId of shapesToDispose) {
      try {
        await disposeShape(shapeId);
      } catch {
        // Ignore disposal errors
      }
    }
  }
}

/**
 * Generates wall geometry with a single opening
 * Simplified version for quick door/window cuts
 */
export async function cutOpeningInWall(
  wallShapeId: string,
  opening: Opening,
  wallLength: number,
  wallThickness: number,
  alignmentSide: WallAlignmentSide
): Promise<ShapeCreationResult | null> {
  if (!isOcctReady()) return null;

  const cutterParams = createOpeningCutter(
    opening,
    wallLength,
    wallThickness,
    alignmentSide
  );

  const cutterResult = await createBox(cutterParams);
  if (!cutterResult) return null;

  try {
    const result = await booleanOperation({
      type: 'cut',
      objectId: wallShapeId,
      toolId: cutterResult.handle.id,
      fuzzyValue: 0.001,
    });

    return result;
  } finally {
    await disposeShape(cutterResult.handle.id);
  }
}

/**
 * Check if OCCT wall geometry is available
 */
export function isOcctWallGeometryAvailable(): boolean {
  return isOcctReady();
}
