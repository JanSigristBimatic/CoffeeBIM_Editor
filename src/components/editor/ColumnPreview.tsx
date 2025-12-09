import { useMemo } from 'react';
import { Shape, ExtrudeGeometry, CylinderGeometry } from 'three';
import { useToolStore } from '@/store';
import { useStoreyElevation } from '@/hooks';
import { usePreviewMaterial, getPreviewColor } from '@/components/three';

/**
 * Shows a preview of the column being placed
 * Supports both rectangular and circular profiles
 */
export function ColumnPreview() {
  const { activeTool, columnPlacement } = useToolStore();
  const storeyElevation = useStoreyElevation();

  const { params, previewPosition, isValidPosition } = columnPlacement;

  // Create column preview geometry (Z-up)
  const geometry = useMemo(() => {
    if (params.profileType === 'circular') {
      // Circular column using CylinderGeometry, rotated to stand along Z
      const radius = params.width / 2;
      const geo = new CylinderGeometry(radius, radius, params.height, 16);
      geo.rotateX(Math.PI / 2); // Rotate so cylinder stands along Z
      return geo;
    } else {
      // Rectangular column using ExtrudeGeometry
      const hw = params.width / 2;
      const hd = params.depth / 2;

      const shape = new Shape();
      shape.moveTo(-hw, -hd);
      shape.lineTo(hw, -hd);
      shape.lineTo(hw, hd);
      shape.lineTo(-hw, hd);
      shape.closePath();

      const extrudeSettings = {
        steps: 1,
        depth: params.height,
        bevelEnabled: false,
      };

      // Z-up: extrude is along Z, which is what we want - no rotation needed
      return new ExtrudeGeometry(shape, extrudeSettings);
    }
  }, [params.profileType, params.width, params.depth, params.height]);

  // Preview material using reusable hook
  const previewMaterial = usePreviewMaterial({ isValid: isValidPosition });

  // Don't render if not in column mode or no preview position
  if (activeTool !== 'column' || !previewPosition) {
    return null;
  }

  // Z-up: Calculate Z offset - cylinder is centered after rotation, extrude is at bottom
  const zOffset = params.profileType === 'circular' ? params.height / 2 : 0;

  return (
    <group renderOrder={999}>
      {/* Column preview mesh (Z-up: x, y on ground, z is storey elevation + height offset) */}
      <mesh
        position={[previewPosition.x, previewPosition.y, storeyElevation + zOffset]}
        geometry={geometry}
        material={previewMaterial}
        renderOrder={999}
      />

      {/* Column outline */}
      <lineSegments
        position={[previewPosition.x, previewPosition.y, storeyElevation + zOffset]}
        renderOrder={1000}
      >
        <edgesGeometry args={[geometry]} />
        <lineBasicMaterial color={getPreviewColor(isValidPosition)} depthTest={false} />
      </lineSegments>

      {/* Ground marker (Z-up: no rotation needed for ring in XY plane) */}
      <mesh
        position={[previewPosition.x, previewPosition.y, storeyElevation + 0.01]}
        renderOrder={1001}
      >
        <ringGeometry args={[params.width * 0.6, params.width * 0.7, 32]} />
        <meshBasicMaterial
          color={getPreviewColor(isValidPosition)}
          transparent
          opacity={0.5}
          depthTest={false}
        />
      </mesh>
    </group>
  );
}
