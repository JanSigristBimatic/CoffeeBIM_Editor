import { useMemo, useRef, useEffect } from 'react';
import { Mesh, Shape, ExtrudeGeometry, MeshStandardMaterial, CylinderGeometry } from 'three';
import type { BimElement } from '@/types/bim';
import { useDragElement } from '../TransformGizmo';

interface ColumnMeshProps {
  element: BimElement;
  selected: boolean;
  isGhost?: boolean;
  ghostOpacity?: number;
}

// Material colors
const COLUMN_COLOR = '#b0b0b0';
const COLUMN_COLOR_SELECTED = '#90caf9';
const GHOST_COLOR = '#9e9e9e';

export function ColumnMesh({ element, selected, isGhost = false, ghostOpacity = 0.25 }: ColumnMeshProps) {
  const meshRef = useRef<Mesh>(null);
  const { handlers } = useDragElement(element);
  const effectiveHandlers = isGhost ? {} : handlers;

  // Disable raycasting for ghost elements so they don't block clicks on active storey
  useEffect(() => {
    if (meshRef.current && isGhost) {
      meshRef.current.raycast = () => {};
    }
  }, [isGhost]);

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
      color: selected ? COLUMN_COLOR_SELECTED : COLUMN_COLOR,
      roughness: 0.7,
      metalness: 0.2,
    });
  }, [selected, isGhost, ghostOpacity]);

  if (!geometry || !columnData) return null;

  // Z-up: Calculate Z position - cylinder is centered, extrude is at bottom
  const zOffset = columnData.profileType === 'circular' ? columnData.height / 2 : 0;

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      position={[placement.position.x, placement.position.y, placement.position.z + zOffset]}
      {...effectiveHandlers}
      castShadow={!isGhost}
      receiveShadow={!isGhost}
      renderOrder={isGhost ? -1 : 0}
    />
  );
}
