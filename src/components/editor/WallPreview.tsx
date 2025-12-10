import { useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { useToolStore } from '@/store';
import { useStoreyElevation } from '@/hooks';
import type { WallAlignmentSide } from '@/types/bim';

/**
 * Calculate profile Y-offset based on alignment side (same as in Wall.ts)
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
 * Preview mesh shown during wall placement
 * Shows a semi-transparent wall from start point to current cursor position
 * Includes a distance label at the midpoint
 * Uses the thickness, height, and alignment from wall placement params
 */
export function WallPreview() {
  const { activeTool, wallPlacement, distanceInput } = useToolStore();
  const { startPoint, previewEndPoint, params } = wallPlacement;
  const storeyElevation = useStoreyElevation();

  // Use params from wall placement for preview
  const thickness = params.thickness;
  const height = params.height;
  const alignmentSide = params.alignmentSide;

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

    // Get profile offset based on alignment
    const offset = getProfileOffset(alignmentSide, thickness);

    // Create 2D profile for extrusion (X=length, Y=height)
    // This matches WallMesh shape construction for consistency
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(length, 0);
    shape.lineTo(length, height);
    shape.lineTo(0, height);
    shape.closePath();

    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth: thickness,
      bevelEnabled: false,
    };

    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    // Position based on alignment (offset.min is where wall starts in local Y/Z)
    geo.translate(0, 0, offset.min);

    return geo;
  }, [startPoint, previewEndPoint, thickness, height, alignmentSide]);

  // Calculate position and rotation (Z-up coordinate system)
  const transform = useMemo(() => {
    if (!startPoint || !previewEndPoint) return null;

    const dx = previewEndPoint.x - startPoint.x;
    const dy = previewEndPoint.y - startPoint.y;
    const angle = Math.atan2(dy, dx);

    return {
      // Z-up: (x, y, storeyElevation) for position on active storey
      position: new THREE.Vector3(startPoint.x, startPoint.y, storeyElevation),
      // Z-up: First rotate around world-Z for direction, then rotate +90° around X so Y (height) → Z (up)
      // Order 'ZXY' ensures angle is applied in world coordinates before the tilt
      rotation: new THREE.Euler(Math.PI / 2, 0, angle, 'ZXY'),
    };
  }, [startPoint, previewEndPoint, storeyElevation]);

  // Calculate distance and midpoint for label
  const labelData = useMemo(() => {
    if (!startPoint || !previewEndPoint) return null;

    const dx = previewEndPoint.x - startPoint.x;
    const dy = previewEndPoint.y - startPoint.y;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length < 0.05) return null;

    return {
      distance: length,
      midpoint: {
        x: (startPoint.x + previewEndPoint.x) / 2,
        y: (startPoint.y + previewEndPoint.y) / 2,
      },
    };
  }, [startPoint, previewEndPoint]);

  if (!isVisible || !geometry || !transform) return null;

  return (
    <>
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

      {/* Distance label at midpoint */}
      {labelData && (
        <Html
          position={[labelData.midpoint.x, labelData.midpoint.y, storeyElevation + height + 0.3]}
          center
          zIndexRange={[40, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <div
            className={`px-2 py-1 rounded text-xs font-mono font-semibold shadow-lg whitespace-nowrap ${
              distanceInput.active
                ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                : 'bg-slate-900/90 text-white'
            }`}
          >
            {labelData.distance.toFixed(2)} m
          </div>
        </Html>
      )}
    </>
  );
}
