import { useMemo, useRef } from 'react';
import { Mesh, Shape, ExtrudeGeometry, MeshStandardMaterial } from 'three';
import { useSelectionStore } from '@/store';
import type { BimElement } from '@/types/bim';

interface SlabMeshProps {
  element: BimElement;
  selected: boolean;
}

// Material colors
const SLAB_COLOR = '#d4d4d8'; // Zinc-300
const SLAB_COLOR_SELECTED = '#93c5fd'; // Blue-300

export function SlabMesh({ element, selected }: SlabMeshProps) {
  const meshRef = useRef<Mesh>(null);
  const { select } = useSelectionStore();

  const { slabData } = element;

  // Create geometry from slab outline
  const geometry = useMemo(() => {
    if (!slabData || !slabData.outline || slabData.outline.length < 3) {
      return null;
    }

    const { outline, thickness } = slabData;

    // Create shape from outline points
    // Note: We negate Y because the shape is in XY plane,
    // and after rotation -90° around X, Y becomes -Z.
    // By negating, we get the correct world Z coordinate.
    const shape = new Shape();
    const firstPoint = outline[0];
    if (!firstPoint) return null;

    shape.moveTo(firstPoint.x, -firstPoint.y);
    for (let i = 1; i < outline.length; i++) {
      const pt = outline[i];
      if (pt) {
        shape.lineTo(pt.x, -pt.y);
      }
    }
    shape.closePath();

    // Extrude downward (into the floor)
    const extrudeSettings = {
      steps: 1,
      depth: thickness,
      bevelEnabled: false,
    };

    const geo = new ExtrudeGeometry(shape, extrudeSettings);

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

  // Handle click
  const handleClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    select(element.id);
  };

  if (!geometry || !slabData) return null;

  // Position: rotate to lie flat, then position at floor level
  // Shape is in XY plane, we rotate it to XZ plane (flat on ground)
  // Move down by thickness so top surface is at Y=0
  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      position={[0, -slabData.thickness, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      onClick={handleClick}
      receiveShadow
    />
  );
}
