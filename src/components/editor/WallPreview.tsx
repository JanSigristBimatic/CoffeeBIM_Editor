import { useMemo } from 'react';
import * as THREE from 'three';
import { useToolStore } from '@/store';
import { DEFAULT_WALL_THICKNESS, DEFAULT_WALL_HEIGHT } from '@/bim/elements/Wall';

/**
 * Preview mesh shown during wall placement
 * Shows a semi-transparent wall from start point to current cursor position
 */
export function WallPreview() {
  const { activeTool, wallPlacement } = useToolStore();
  const { startPoint, previewEndPoint } = wallPlacement;

  // Only show preview when placing a wall and we have both points
  const isVisible = activeTool === 'wall' && startPoint !== null && previewEndPoint !== null;

  const geometry = useMemo(() => {
    if (!startPoint || !previewEndPoint) return null;

    // Calculate wall direction and length
    const dx = previewEndPoint.x - startPoint.x;
    const dy = previewEndPoint.y - startPoint.y;
    const length = Math.sqrt(dx * dx + dy * dy);

    // Don't show preview for very short walls
    if (length < 0.05) return null;

    const halfThickness = DEFAULT_WALL_THICKNESS / 2;

    // Create 2D profile for extrusion
    const shape = new THREE.Shape();
    shape.moveTo(0, -halfThickness);
    shape.lineTo(length, -halfThickness);
    shape.lineTo(length, halfThickness);
    shape.lineTo(0, halfThickness);
    shape.closePath();

    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth: DEFAULT_WALL_HEIGHT,
      bevelEnabled: false,
    };

    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
  }, [startPoint, previewEndPoint]);

  // Calculate position and rotation
  const transform = useMemo(() => {
    if (!startPoint || !previewEndPoint) return null;

    const dx = previewEndPoint.x - startPoint.x;
    const dy = previewEndPoint.y - startPoint.y;
    // Negate angle because Three.js Y rotation is opposite to our 2D coordinate system
    const angle = -Math.atan2(dy, dx);

    return {
      position: new THREE.Vector3(startPoint.x, 0, startPoint.y),
      // Use 'YXZ' order: first rotate around Y (direction in XZ plane), then around X (stand up)
      rotation: new THREE.Euler(-Math.PI / 2, angle, 0, 'YXZ'),
    };
  }, [startPoint, previewEndPoint]);

  if (!isVisible || !geometry || !transform) return null;

  return (
    <mesh
      geometry={geometry}
      position={transform.position}
      rotation={transform.rotation}
    >
      <meshStandardMaterial
        color="#4a9eff"
        transparent
        opacity={0.5}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
