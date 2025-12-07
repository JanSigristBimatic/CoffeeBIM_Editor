import { useMemo, useRef } from 'react';
import { Mesh, Shape, ExtrudeGeometry, MeshStandardMaterial } from 'three';
import type { BimElement } from '@/types/bim';
import { useDragElement } from '../TransformGizmo';

interface SlabMeshProps {
  element: BimElement;
  selected: boolean;
}

// Material colors
const SLAB_COLOR = '#d4d4d8'; // Zinc-300
const SLAB_COLOR_SELECTED = '#93c5fd'; // Blue-300

export function SlabMesh({ element, selected }: SlabMeshProps) {
  const meshRef = useRef<Mesh>(null);
  const { handlers } = useDragElement(element);

  const { slabData } = element;

  // Create geometry from slab outline
  const geometry = useMemo(() => {
    if (!slabData || !slabData.outline || slabData.outline.length < 3) {
      return null;
    }

    const { outline, thickness } = slabData;

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

    // Extrude downward (into the floor) along -Z
    const extrudeSettings = {
      steps: 1,
      depth: thickness,
      bevelEnabled: false,
    };

    const geo = new ExtrudeGeometry(shape, extrudeSettings);

    // Move geometry down so top surface is at Z=0
    geo.translate(0, 0, -thickness);

    return geo;
  }, [slabData]);

  // Create material
  const material = useMemo(() => {
    return new MeshStandardMaterial({
      color: selected ? SLAB_COLOR_SELECTED : SLAB_COLOR,
      roughness: 0.9,
      metalness: 0.0,
    });
  }, [selected]);

  if (!geometry || !slabData) return null;

  // Z-up: XY plane is horizontal, no rotation needed
  // Geometry is already translated so top surface is at Z=0
  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      position={[0, 0, 0]}
      rotation={[0, 0, 0]}
      {...handlers}
      receiveShadow
    />
  );
}
