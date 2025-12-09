import { useMemo, useRef } from 'react';
import { Mesh, Shape, Path, ExtrudeGeometry, MeshStandardMaterial, Euler, BufferGeometry, Float32BufferAttribute } from 'three';
import type { BimElement, Opening, WallAlignmentSide } from '@/types/bim';
import { useDragElement } from '../TransformGizmo';
import { calculateWallGeometry, analyzeWallCorners } from '@/lib/geometry';
import type { WallEndExtensions } from '@/lib/geometry';
import { useElementStore } from '@/store';

/**
 * Calculate profile Z-offset based on alignment side
 */
function getProfileOffset(alignmentSide: WallAlignmentSide, thickness: number): { min: number; max: number } {
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
 * Create wall geometry with proper miter cuts at corners.
 * Creates the wall in plan view (XZ plane) and extrudes by height.
 * Uses edge-specific extensions for clean corner joints.
 *
 * Coordinate system (looking from start to end of wall):
 * - X axis: along wall length (0 = start, length = end)
 * - Y axis: up (0 = floor, height = top)
 * - Z axis: across wall thickness
 *   - Positive Z (+) = LEFT edge of wall
 *   - Negative Z (-) = RIGHT edge of wall
 */
function createMiteredWallGeometry(
  length: number,
  height: number,
  _thickness: number,
  alignmentSide: WallAlignmentSide,
  startExtensions: WallEndExtensions,
  endExtensions: WallEndExtensions
): BufferGeometry {
  const offset = getProfileOffset(alignmentSide, _thickness);

  // Edge-specific extensions create actual miter cuts
  // Each corner of the wall profile can extend independently
  //
  // Plan view (looking down, Y is up):
  //
  //   v1(startLeft)--------v2(endLeft)     <- LEFT edge (z = offset.max)
  //        |                    |
  //   v0(startRight)------v3(endRight)     <- RIGHT edge (z = offset.min)
  //        ^                    ^
  //      START                 END
  //
  // For a clean miter joint at corners:
  // - The outer edge extends more
  // - The inner edge extends less
  // This creates an angled end face instead of perpendicular

  // X positions for each corner (negative = extend before start, positive = extend after end)
  const x0 = -startExtensions.rightEdge;  // Start, right edge
  const x1 = -startExtensions.leftEdge;   // Start, left edge
  const x2 = length + endExtensions.leftEdge;   // End, left edge
  const x3 = length + endExtensions.rightEdge;  // End, right edge

  // Z positions based on wall alignment
  const z0 = offset.min;  // Right edge (looking from start to end)
  const z1 = offset.max;  // Left edge

  // Vertices: [x, y, z] - y is up (height)
  // Bottom face (y=0)
  const v0 = [x0, 0, z0];      // Start, bottom, right edge
  const v1 = [x1, 0, z1];      // Start, bottom, left edge
  const v2 = [x2, 0, z1];      // End, bottom, left edge
  const v3 = [x3, 0, z0];      // End, bottom, right edge

  // Top face (y=height)
  const v4 = [x0, height, z0]; // Start, top, right edge
  const v5 = [x1, height, z1]; // Start, top, left edge
  const v6 = [x2, height, z1]; // End, top, left edge
  const v7 = [x3, height, z0]; // End, top, right edge

  // Create triangles for each face
  const positions: number[] = [];
  const normals: number[] = [];

  // Helper to add a quad (2 triangles)
  const addQuad = (
    a: number[], b: number[], c: number[], d: number[],
    nx: number, ny: number, nz: number
  ) => {
    // Triangle 1: a, b, c
    positions.push(...a, ...b, ...c);
    // Triangle 2: a, c, d
    positions.push(...a, ...c, ...d);
    // 6 normals (2 triangles × 3 vertices)
    for (let i = 0; i < 6; i++) {
      normals.push(nx, ny, nz);
    }
  };

  // Bottom face (y=0, normal down)
  addQuad(v0, v3, v2, v1, 0, -1, 0);

  // Top face (y=height, normal up)
  addQuad(v4, v5, v6, v7, 0, 1, 0);

  // Left face (z=offset.max, normal +Z)
  addQuad(v1, v2, v6, v5, 0, 0, 1);

  // Right face (z=offset.min, normal -Z)
  addQuad(v0, v4, v7, v3, 0, 0, -1);

  // Start face (mitered)
  // Calculate normal based on miter angle
  const startDx = x1 - x0;
  const startDz = z1 - z0;
  const startLen = Math.sqrt(startDx * startDx + startDz * startDz);
  const startNx = -startDz / startLen;  // Perpendicular to edge
  const startNz = startDx / startLen;
  addQuad(v0, v1, v5, v4, startNx, 0, startNz);

  // End face (mitered)
  const endDx = x3 - x2;
  const endDz = z0 - z1;
  const endLen = Math.sqrt(endDx * endDx + endDz * endDz);
  const endNx = endDz / endLen;
  const endNz = -endDx / endLen;
  addQuad(v2, v3, v7, v6, endNx, 0, endNz);

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));

  return geometry;
}

interface WallMeshProps {
  element: BimElement;
  selected: boolean;
  isGhost?: boolean;
  ghostOpacity?: number;
}

// Material colors
const WALL_COLOR = '#e0e0e0';
const WALL_COLOR_SELECTED = '#90caf9';
const GHOST_COLOR = '#9e9e9e';

/**
 * Create a hole path for an opening in the wall shape
 * Shape is in XY plane where X is wall length, Y is height
 */
function createOpeningHole(opening: Opening, wallLength: number, wallHeight: number): Path | null {
  const { position, width, height, sillHeight } = opening;

  // Calculate X position along wall (position is 0-1 along wall)
  const centerX = position * wallLength;
  const halfWidth = width / 2;

  // Opening bounds
  const left = centerX - halfWidth;
  const right = centerX + halfWidth;
  const bottom = sillHeight;
  const top = sillHeight + height;

  // Don't create holes that extend outside the wall
  if (left < 0 || right > wallLength || top > wallHeight) {
    console.warn('Opening extends outside wall bounds, skipping');
    return null;
  }

  // Create hole path (must be wound counter-clockwise for THREE.js)
  const hole = new Path();
  hole.moveTo(left, bottom);
  hole.lineTo(left, top);
  hole.lineTo(right, top);
  hole.lineTo(right, bottom);
  hole.closePath();

  return hole;
}

export function WallMesh({ element, selected, isGhost = false, ghostOpacity = 0.25 }: WallMeshProps) {
  const meshRef = useRef<Mesh>(null);
  const { handlers } = useDragElement(element);
  const { elements } = useElementStore();

  // Disable interaction for ghost elements
  const effectiveHandlers = isGhost ? {} : handlers;

  const { wallData } = element;

  // Get all walls for corner analysis (convert Map to array)
  const allWalls = useMemo(() => {
    return Array.from(elements.values()).filter(el => el.type === 'wall');
  }, [elements]);

  // Analyze corner connections for this wall using the new comprehensive module
  const cornerAnalysis = useMemo(() => {
    if (isGhost) {
      return {
        wallId: element.id,
        startExtensions: { leftEdge: 0, rightEdge: 0 },
        endExtensions: { leftEdge: 0, rightEdge: 0 }
      };
    }
    return analyzeWallCorners(element, allWalls);
  }, [element, allWalls, isGhost]);

  // Create geometry from wall data
  const geometry = useMemo(() => {
    if (!wallData) return null;

    const { startPoint, endPoint, thickness, height, openings, alignmentSide } = wallData;

    // Calculate wall geometry using centralized utility
    const wallGeo = calculateWallGeometry(startPoint, endPoint);

    if (wallGeo.length < 0.01) return null; // Skip very short walls
    const length = wallGeo.length;

    // For walls WITH openings: use simple extruded shape (can't do miters with holes easily)
    // For walls WITHOUT openings: use proper mitered geometry
    const hasOpenings = openings && openings.length > 0;

    if (hasOpenings) {
      // For walls with openings, use average of edge extensions
      // (simplified - proper mitered openings would need more complex geometry)
      const startExtension = Math.max(
        cornerAnalysis.startExtensions.leftEdge,
        cornerAnalysis.startExtensions.rightEdge
      );
      const endExtension = Math.max(
        cornerAnalysis.endExtensions.leftEdge,
        cornerAnalysis.endExtensions.rightEdge
      );

      // Create wall shape as front view (length x height in XY plane)
      // X is along wall length, Y is height
      const shape = new Shape();
      shape.moveTo(-startExtension, 0);
      shape.lineTo(length + endExtension, 0);
      shape.lineTo(length + endExtension, height);
      shape.lineTo(-startExtension, height);
      shape.closePath();

      // Add holes for openings (doors/windows)
      for (const opening of openings) {
        const hole = createOpeningHole(opening, length, height);
        if (hole) {
          shape.holes.push(hole);
        }
      }

      // Extrude by wall thickness
      const extrudeSettings = {
        steps: 1,
        depth: thickness,
        bevelEnabled: false,
      };

      const extrudeGeo = new ExtrudeGeometry(shape, extrudeSettings);

      // Position based on alignment (offset.min is where wall starts in local Z)
      const offset = getProfileOffset(alignmentSide, thickness);
      extrudeGeo.translate(0, 0, offset.min);

      return extrudeGeo;
    }

    // Use proper mitered geometry for walls without openings
    return createMiteredWallGeometry(
      length,
      height,
      thickness,
      alignmentSide,
      cornerAnalysis.startExtensions,
      cornerAnalysis.endExtensions
    );
  }, [wallData, cornerAnalysis]);

  // Create material
  const material = useMemo(() => {
    if (isGhost) {
      return new MeshStandardMaterial({
        color: GHOST_COLOR,
        roughness: 0.9,
        metalness: 0.0,
        transparent: true,
        opacity: ghostOpacity,
        depthWrite: false,
      });
    }
    return new MeshStandardMaterial({
      color: selected ? WALL_COLOR_SELECTED : WALL_COLOR,
      roughness: 0.8,
      metalness: 0.1,
    });
  }, [selected, isGhost, ghostOpacity]);

  // Calculate rotation from wall direction (Z-up system)
  const rotation = useMemo(() => {
    if (!wallData) return new Euler(0, 0, 0);
    const { angle } = calculateWallGeometry(wallData.startPoint, wallData.endPoint);
    // Wall is built in XY plane (X=length, Y=height), extruded along Z (thickness)
    // For Z-up: First rotate around world-Z for direction, then rotate +90° around X so Y (height) → Z (up)
    // Order 'ZXY' ensures angle is applied in world coordinates before the tilt
    return new Euler(Math.PI / 2, 0, angle, 'ZXY');
  }, [wallData]);

  if (!geometry || !wallData) return null;

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      position={[wallData.startPoint.x, wallData.startPoint.y, element.placement.position.z]}
      rotation={rotation}
      {...effectiveHandlers}
      castShadow={!isGhost}
      receiveShadow={!isGhost}
      renderOrder={isGhost ? -1 : 0}
    />
  );
}
