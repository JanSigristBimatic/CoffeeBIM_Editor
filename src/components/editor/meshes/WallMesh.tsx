import { useMemo, useRef } from 'react';
import { Mesh, Shape, Path, ExtrudeGeometry, MeshStandardMaterial, Euler } from 'three';
import type { BimElement, Opening } from '@/types/bim';
import { useDragElement } from '../TransformGizmo';
import { calculateWallGeometry } from '@/lib/geometry';

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

  // Disable interaction for ghost elements
  const effectiveHandlers = isGhost ? {} : handlers;

  const { wallData } = element;

  // Create geometry from wall data
  const geometry = useMemo(() => {
    if (!wallData) return null;

    const { startPoint, endPoint, thickness, height, openings } = wallData;

    // Calculate wall geometry using centralized utility
    const wallGeo = calculateWallGeometry(startPoint, endPoint);

    if (wallGeo.length < 0.01) return null; // Skip very short walls
    const length = wallGeo.length;

    const halfThickness = thickness / 2;

    // Extend wall by half thickness at both ends for corner overlap
    const extension = halfThickness;

    // Create wall shape as front view (length x height in XY plane)
    // X is along wall length, Y is height
    const shape = new Shape();
    shape.moveTo(-extension, 0);
    shape.lineTo(length + extension, 0);
    shape.lineTo(length + extension, height);
    shape.lineTo(-extension, height);
    shape.closePath();

    // Add holes for openings (doors/windows)
    if (openings && openings.length > 0) {
      for (const opening of openings) {
        const hole = createOpeningHole(opening, length, height);
        if (hole) {
          shape.holes.push(hole);
        }
      }
    }

    // Extrude by wall thickness
    const extrudeSettings = {
      steps: 1,
      depth: thickness,
      bevelEnabled: false,
    };

    const extrudeGeo = new ExtrudeGeometry(shape, extrudeSettings);

    // Center the geometry on thickness (so wall centerline is at Z=0 in local space)
    extrudeGeo.translate(0, 0, -halfThickness);

    return extrudeGeo;
  }, [wallData]);

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
