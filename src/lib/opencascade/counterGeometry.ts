/**
 * OCCT-based Counter Geometry Generator
 *
 * Uses OpenCascade.js to create counter geometry with:
 * - Rounded edges on countertop (fillets)
 * - Clean boolean operations for complex shapes
 * - Proper corner treatments
 */

import type { Point2D } from '@/types/geometry';
import type { MeshData, ShapeCreationResult } from './types';
import {
  isOcctReady,
  extrudeProfile,
  filletOperation,
  disposeShape,
} from './index';

interface CounterGeometryParams {
  /** Counter path (centerline or front edge) */
  path: Point2D[];
  /** Counter depth (front to back) */
  depth: number;
  /** Total counter height */
  height: number;
  /** Countertop thickness */
  topThickness: number;
  /** Countertop overhang past front */
  overhang: number;
  /** Kick plate height */
  kickHeight: number;
  /** Kick plate recess */
  kickRecess: number;
  /** Whether to add fillets to countertop edges */
  addFillets?: boolean;
  /** Fillet radius for top edges (default: 5mm) */
  filletRadius?: number;
}

/**
 * Offset a path by a given distance
 * Positive distance moves outward (left of path direction)
 */
function offsetPath(path: Point2D[], distance: number): Point2D[] {
  if (path.length < 2) return path;

  const result: Point2D[] = [];

  for (let i = 0; i < path.length; i++) {
    const curr = path[i]!;
    const prev = path[i > 0 ? i - 1 : 0]!;
    const next = path[i < path.length - 1 ? i + 1 : path.length - 1]!;

    // Calculate tangent direction at this point
    let dx = 0;
    let dy = 0;

    if (i === 0) {
      // First point: use direction to next
      dx = next.x - curr.x;
      dy = next.y - curr.y;
    } else if (i === path.length - 1) {
      // Last point: use direction from prev
      dx = curr.x - prev.x;
      dy = curr.y - prev.y;
    } else {
      // Middle point: average of incoming and outgoing
      dx = (next.x - prev.x) / 2;
      dy = (next.y - prev.y) / 2;
    }

    // Normalize
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.0001) {
      result.push({ x: curr.x, y: curr.y });
      continue;
    }

    dx /= len;
    dy /= len;

    // Perpendicular direction (90° counter-clockwise)
    const perpX = -dy;
    const perpY = dx;

    // Offset point
    result.push({
      x: curr.x + perpX * distance,
      y: curr.y + perpY * distance,
    });
  }

  return result;
}

/**
 * Create closed polygon from front and back paths
 */
function createClosedProfile(frontPath: Point2D[], backPath: Point2D[]): Point2D[] {
  if (frontPath.length === 0) return [];

  const profile: Point2D[] = [];

  // Add front path
  for (const p of frontPath) {
    profile.push({ x: p.x, y: p.y });
  }

  // Add back path in reverse
  for (let i = backPath.length - 1; i >= 0; i--) {
    const p = backPath[i]!;
    profile.push({ x: p.x, y: p.y });
  }

  return profile;
}

/**
 * Generates counter mesh using OCCT with optional fillets
 *
 * @param params Counter geometry parameters
 * @returns MeshData for Three.js rendering, or null if OCCT not ready
 *
 * @example
 * const mesh = await generateCounterMeshOCCT({
 *   path: [{ x: 0, y: 0 }, { x: 3, y: 0 }],
 *   depth: 0.6,
 *   height: 1.1,
 *   topThickness: 0.04,
 *   overhang: 0.05,
 *   kickHeight: 0.1,
 *   kickRecess: 0.08,
 *   addFillets: true,
 *   filletRadius: 0.005,
 * });
 */
export async function generateCounterMeshOCCT(
  params: CounterGeometryParams
): Promise<MeshData | null> {
  if (!isOcctReady()) {
    console.warn('[OCCT CounterGeometry] OpenCascade not ready');
    return null;
  }

  const {
    path,
    depth,
    height,
    topThickness,
    overhang,
    kickHeight,
    kickRecess,
    addFillets = true,
    filletRadius = 0.005, // 5mm default
  } = params;

  if (path.length < 2) {
    console.warn('[OCCT CounterGeometry] Path must have at least 2 points');
    return null;
  }

  const shapesToDispose: string[] = [];

  try {
    const meshes: ShapeCreationResult[] = [];

    // Calculate various offset paths
    const frontWithOverhang = offsetPath(path, -overhang);
    const backPath = offsetPath(path, depth);
    const frontPath = path;
    const backWithKick = offsetPath(path, depth - kickRecess);

    // 1. Kick/base section
    if (kickHeight > 0 && kickRecess > 0) {
      const kickProfile = createClosedProfile(frontPath, backWithKick);

      const kickResult = await extrudeProfile({
        profile: kickProfile,
        height: kickHeight,
        direction: { x: 0, y: 0, z: 1 }, // Z-up
        position: { x: 0, y: 0, z: 0 },
      });

      if (kickResult) {
        shapesToDispose.push(kickResult.handle.id);
        meshes.push(kickResult);
      }
    }

    // 2. Main body section
    const mainBodyHeight = height - topThickness - kickHeight;
    if (mainBodyHeight > 0) {
      const mainProfile = createClosedProfile(frontPath, backPath);

      const mainResult = await extrudeProfile({
        profile: mainProfile,
        height: mainBodyHeight,
        direction: { x: 0, y: 0, z: 1 },
        position: { x: 0, y: 0, z: kickHeight },
      });

      if (mainResult) {
        shapesToDispose.push(mainResult.handle.id);
        meshes.push(mainResult);
      }
    }

    // 3. Countertop with optional fillets
    if (topThickness > 0) {
      const topProfile = createClosedProfile(frontWithOverhang, backPath);

      let topResult = await extrudeProfile({
        profile: topProfile,
        height: topThickness,
        direction: { x: 0, y: 0, z: 1 },
        position: { x: 0, y: 0, z: height - topThickness },
      });

      if (topResult) {
        shapesToDispose.push(topResult.handle.id);

        // Apply fillet to top edges
        if (addFillets && filletRadius > 0) {
          try {
            const filletedTop = await filletOperation({
              shapeId: topResult.handle.id,
              radius: filletRadius,
              // Fillet all edges - OCCT will skip edges that are too small
            });

            if (filletedTop) {
              shapesToDispose.push(filletedTop.handle.id);
              topResult = filletedTop;
            }
          } catch (error) {
            console.warn(
              '[OCCT CounterGeometry] Fillet operation failed, using sharp edges:',
              error
            );
            // Continue with unfilleted top
          }
        }

        meshes.push(topResult);
      }
    }

    // If no meshes were created, return null
    if (meshes.length === 0) {
      return null;
    }

    // For now, return just the countertop mesh (most important)
    // In a full implementation, we would merge all meshes
    const lastMesh = meshes[meshes.length - 1]!;
    return lastMesh.mesh;
  } catch (error) {
    console.error('[OCCT CounterGeometry] Error generating counter:', error);
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
 * Generates just the countertop with filleted edges
 *
 * @param profile Closed countertop profile
 * @param thickness Countertop thickness
 * @param filletRadius Fillet radius for edges
 * @returns MeshData or null
 */
export async function generateFilletedCountertop(
  profile: Point2D[],
  thickness: number,
  filletRadius: number
): Promise<MeshData | null> {
  if (!isOcctReady()) return null;
  if (profile.length < 3) return null;

  try {
    const extruded = await extrudeProfile({
      profile,
      height: thickness,
      direction: { x: 0, y: 0, z: 1 },
      position: { x: 0, y: 0, z: 0 },
    });

    if (!extruded) return null;

    // Apply fillet
    const filleted = await filletOperation({
      shapeId: extruded.handle.id,
      radius: filletRadius,
    });

    // Clean up original shape
    await disposeShape(extruded.handle.id);

    if (filleted) {
      const mesh = filleted.mesh;
      await disposeShape(filleted.handle.id);
      return mesh;
    }

    return null;
  } catch (error) {
    console.error('[OCCT CounterGeometry] Fillet countertop failed:', error);
    return null;
  }
}

/**
 * Check if OCCT counter geometry is available
 */
export function isOcctCounterGeometryAvailable(): boolean {
  return isOcctReady();
}
