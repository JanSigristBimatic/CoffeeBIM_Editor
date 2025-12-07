import { useMemo, useRef } from 'react';
import { Mesh, Shape, Path, ExtrudeGeometry, MeshStandardMaterial, Euler } from 'three';
import type { BimElement, Opening } from '@/types/bim';
import { useDragElement } from '../TransformGizmo';

interface WallMeshProps {
  element: BimElement;
  selected: boolean;
}

// Material colors
const WALL_COLOR = '#e0e0e0';
const WALL_COLOR_SELECTED = '#90caf9';

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

export function WallMesh({ element, selected }: WallMeshProps) {
  const meshRef = useRef<Mesh>(null);
  const { handlers } = useDragElement(element);

  const { wallData } = element;

  // Create geometry from wall data
  const geometry = useMemo(() => {
    if (!wallData) return null;

    const { startPoint, endPoint, thickness, height, openings } = wallData;

    // Calculate wall direction and length
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length < 0.01) return null; // Skip very short walls

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

    const geo = new ExtrudeGeometry(shape, extrudeSettings);

    // Center the geometry on thickness (so wall centerline is at Z=0 in local space)
    geo.translate(0, 0, -halfThickness);

    return geo;
  }, [wallData]);

  // Create material
  const material = useMemo(() => {
    return new MeshStandardMaterial({
      color: selected ? WALL_COLOR_SELECTED : WALL_COLOR,
      roughness: 0.8,
      metalness: 0.1,
    });
  }, [selected]);

  // Calculate rotation from wall direction (Z-up system)
  const rotation = useMemo(() => {
    if (!wallData) return new Euler(0, 0, 0);
    const dx = wallData.endPoint.x - wallData.startPoint.x;
    const dy = wallData.endPoint.y - wallData.startPoint.y;
    const angle = Math.atan2(dy, dx);
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
      position={[wallData.startPoint.x, wallData.startPoint.y, 0]}
      rotation={rotation}
      {...handlers}
      castShadow
      receiveShadow
    />
  );
}
