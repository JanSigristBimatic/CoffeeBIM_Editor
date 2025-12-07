import { useMemo, useRef } from 'react';
import { Mesh, Shape, ExtrudeGeometry, MeshStandardMaterial, CylinderGeometry } from 'three';
import type { BimElement } from '@/types/bim';
import { useDragElement } from '../TransformGizmo';

interface ColumnMeshProps {
  element: BimElement;
  selected: boolean;
}

// Material colors
const COLUMN_COLOR = '#b0b0b0';
const COLUMN_COLOR_SELECTED = '#90caf9';

export function ColumnMesh({ element, selected }: ColumnMeshProps) {
  const meshRef = useRef<Mesh>(null);
  const { handlers } = useDragElement(element);

  const { columnData, placement } = element;

  // Create geometry from column data (Z-up)
  const geometry = useMemo(() => {
    if (!columnData) return null;

    const { profileType, width, depth, height } = columnData;

    if (profileType === 'circular') {
      // Circular column using CylinderGeometry
      // CylinderGeometry extends along Y by default, rotate to stand along Z
      const radius = width / 2;
      const geo = new CylinderGeometry(radius, radius, height, 16);
      geo.rotateX(Math.PI / 2); // Rotate so cylinder stands along Z
      return geo;
    } else {
      // Rectangular column using ExtrudeGeometry
      // Shape in XY, extrude along Z (default) - perfect for Z-up
      const hw = width / 2;
      const hd = depth / 2;

      const shape = new Shape();
      shape.moveTo(-hw, -hd);
      shape.lineTo(hw, -hd);
      shape.lineTo(hw, hd);
      shape.lineTo(-hw, hd);
      shape.closePath();

      const extrudeSettings = {
        steps: 1,
        depth: height,
        bevelEnabled: false,
      };

      const geo = new ExtrudeGeometry(shape, extrudeSettings);
      // Z-up: extrude is already along Z, no rotation needed

      return geo;
    }
  }, [columnData]);

  // Create material
  const material = useMemo(() => {
    return new MeshStandardMaterial({
      color: selected ? COLUMN_COLOR_SELECTED : COLUMN_COLOR,
      roughness: 0.7,
      metalness: 0.2,
    });
  }, [selected]);

  if (!geometry || !columnData) return null;

  // Z-up: Calculate Z position - cylinder is centered, extrude is at bottom
  const zOffset = columnData.profileType === 'circular' ? columnData.height / 2 : 0;

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      position={[placement.position.x, placement.position.y, zOffset]}
      {...handlers}
      castShadow
      receiveShadow
    />
  );
}
