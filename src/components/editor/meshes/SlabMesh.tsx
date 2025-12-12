import { useMemo, useRef, useEffect } from 'react';
import { Mesh, Shape, Path, ExtrudeGeometry, MeshStandardMaterial } from 'three';
import type { BimElement, SlabOpening } from '@/types/bim';
import { useDragElement } from '../TransformGizmo';

interface SlabMeshProps {
  element: BimElement;
  selected: boolean;
  isGhost?: boolean;
  ghostOpacity?: number;
}

// Material colors
const SLAB_COLOR = '#d4d4d8'; // Zinc-300
const SLAB_COLOR_SELECTED = '#93c5fd'; // Blue-300
const GHOST_COLOR = '#9e9e9e';

/**
 * Create a Path (hole) from a slab opening outline
 */
function createHoleFromOpening(opening: SlabOpening): Path | null {
  if (!opening.outline || opening.outline.length < 3) return null;

  const hole = new Path();
  const firstPoint = opening.outline[0];
  if (!firstPoint) return null;

  hole.moveTo(firstPoint.x, firstPoint.y);
  for (let i = 1; i < opening.outline.length; i++) {
    const pt = opening.outline[i];
    if (pt) {
      hole.lineTo(pt.x, pt.y);
    }
  }
  hole.closePath();

  return hole;
}

export function SlabMesh({ element, selected, isGhost = false, ghostOpacity = 0.25 }: SlabMeshProps) {
  const meshRef = useRef<Mesh>(null);
  const { handlers } = useDragElement(element);
  const effectiveHandlers = isGhost ? {} : handlers;

  // Disable raycasting for ghost elements so they don't block clicks on active storey
  useEffect(() => {
    if (meshRef.current && isGhost) {
      meshRef.current.raycast = () => {};
    }
  }, [isGhost]);

  const { slabData } = element;

  // Create geometry from slab outline
  const geometry = useMemo(() => {
    if (!slabData || !slabData.outline || slabData.outline.length < 3) {
      return null;
    }

    const { outline, thickness, slabType, openings } = slabData;

    // Create shape from outline points
    // Z-up: XY plane is horizontal, shape lies flat at Z=0
    const shape = new Shape();
    const firstPoint = outline[0];
    if (!firstPoint) return null;

    shape.moveTo(firstPoint.x, firstPoint.y);
    for (let i = 1; i < outline.length; i++) {
      const pt = outline[i];
      if (pt) {
        shape.lineTo(pt.x, pt.y);
      }
    }
    shape.closePath();

    // Add holes for openings (stair voids, shafts, etc.)
    if (openings && openings.length > 0) {
      for (const opening of openings) {
        const hole = createHoleFromOpening(opening);
        if (hole) {
          shape.holes.push(hole);
        }
      }
    }

    // Extrude along Z axis
    const extrudeSettings = {
      steps: 1,
      depth: thickness,
      bevelEnabled: false,
    };

    const geo = new ExtrudeGeometry(shape, extrudeSettings);

    // Floor: extrude downward (top surface at storey elevation)
    // Ceiling: extrude upward (bottom surface at storey elevation)
    if (slabType === 'ceiling') {
      // Ceiling: geometry already extrudes in +Z, no translation needed
      // Bottom surface is at Z=0 (storey elevation)
    } else {
      // Floor (default): move geometry down so top surface is at Z=0
      geo.translate(0, 0, -thickness);
    }

    return geo;
  }, [slabData]);

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
      color: selected ? SLAB_COLOR_SELECTED : SLAB_COLOR,
      roughness: 0.9,
      metalness: 0.0,
    });
  }, [selected, isGhost, ghostOpacity]);

  if (!geometry || !slabData) return null;

  // Calculate final Z position including elevation offset
  const elevationOffset = slabData.elevationOffset ?? 0;
  const finalZ = element.placement.position.z + elevationOffset;

  // Z-up: XY plane is horizontal, no rotation needed
  // Geometry is already translated so top surface is at Z=0
  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      position={[0, 0, finalZ]}
      rotation={[0, 0, 0]}
      {...effectiveHandlers}
      receiveShadow={!isGhost}
      renderOrder={isGhost ? -1 : 0}
    />
  );
}
