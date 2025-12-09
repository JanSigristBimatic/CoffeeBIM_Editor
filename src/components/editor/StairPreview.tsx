import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { MeshStandardMaterial, Shape, ExtrudeGeometry, Euler, BufferGeometry } from 'three';
import { useStairPlacement } from '@/hooks';
import { useProjectStore } from '@/store';

// Stair slab thickness (matching StairMesh.tsx)
const STAIR_SLAB_THICKNESS = 0.15;

/**
 * Create stair geometry matching StairMesh.tsx:
 * - Stepped top surface (treads and risers)
 * - Smooth sloped bottom surface
 *
 * Coordinate system (Z-up):
 * - X = run direction (forward)
 * - Y = width direction (left-right)
 * - Z = height direction (up)
 */
function createStairGeometry(
  stepCount: number,
  treadDepth: number,
  riserHeight: number,
  width: number
): BufferGeometry | null {
  if (stepCount < 1) return null;

  const halfWidth = width / 2;
  const totalRise = stepCount * riserHeight;
  const runLength = (stepCount - 1) * treadDepth;

  // Create side profile shape in XY plane (Shape's coordinate system)
  // We map: shape.X = our X (run direction), shape.Y = our Z (height)
  const sideProfile = new Shape();

  // Start at bottom-front corner
  sideProfile.moveTo(0, 0);

  // Draw the stepped top surface (treads and risers)
  for (let i = 0; i < stepCount; i++) {
    const stepX = i * treadDepth;
    const stepZ = (i + 1) * riserHeight;

    // Riser (vertical face going up)
    sideProfile.lineTo(stepX, stepZ);

    // Tread (horizontal face) - except for last step
    if (i < stepCount - 1) {
      sideProfile.lineTo(stepX + treadDepth, stepZ);
    }
  }

  // Top of last step - add short landing
  sideProfile.lineTo(runLength + treadDepth * 0.5, totalRise);

  // Go down to sloped underside
  sideProfile.lineTo(runLength + treadDepth * 0.5, totalRise - STAIR_SLAB_THICKNESS);

  // Draw the sloped underside (back to start)
  sideProfile.lineTo(0, -STAIR_SLAB_THICKNESS);

  // Close the shape
  sideProfile.closePath();

  // Extrude along the width direction
  const extrudeSettings = {
    steps: 1,
    depth: width,
    bevelEnabled: false,
  };

  const geometry = new ExtrudeGeometry(sideProfile, extrudeSettings);

  // Transform to Z-up coordinate system:
  // rotateX(+90°) maps Y→Z (height up), Z→-Y (width)
  geometry.rotateX(Math.PI / 2);

  // Center along width (Y axis)
  geometry.translate(0, halfWidth, 0);

  return geometry;
}

/**
 * Preview component for stair placement
 * Shows the stair shape while placing with a direction indicator line
 */
export function StairPreview() {
  const {
    isPlacing,
    startPoint,
    previewEndPoint,
    rotation,
    params,
    previewSteps,
  } = useStairPlacement();

  const { activeStoreyId, storeys } = useProjectStore();
  const activeStorey = storeys.find((s) => s.id === activeStoreyId);
  const elevation = activeStorey?.elevation ?? 0;

  // Create preview geometry
  const geometry = useMemo(() => {
    if (!isPlacing || !startPoint) return null;
    return createStairGeometry(
      previewSteps.count,
      previewSteps.treadDepth,
      previewSteps.riserHeight,
      params.width
    );
  }, [isPlacing, startPoint, previewSteps, params.width]);

  // Preview material (semi-transparent green)
  const material = useMemo(() => {
    return new MeshStandardMaterial({
      color: '#4caf50',
      roughness: 0.8,
      metalness: 0.1,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
  }, []);

  // Direction indicator line points
  const linePoints = useMemo(() => {
    if (!startPoint || !previewEndPoint) return null;
    return [
      [startPoint.x, startPoint.y, elevation + 0.01] as [number, number, number],
      [previewEndPoint.x, previewEndPoint.y, elevation + 0.01] as [number, number, number],
    ];
  }, [startPoint, previewEndPoint, elevation]);

  if (!isPlacing || !startPoint || !geometry) return null;

  return (
    <group name="stair-preview">
      {/* Stair mesh preview */}
      <mesh
        geometry={geometry}
        material={material}
        position={[startPoint.x, startPoint.y, elevation]}
        rotation={new Euler(0, 0, rotation)}
        renderOrder={100}
      />

      {/* Direction indicator line */}
      {linePoints && (
        <Line
          points={linePoints}
          color="#2196f3"
          lineWidth={2}
          dashed
          dashSize={0.1}
          gapSize={0.05}
        />
      )}

      {/* Start point indicator */}
      <mesh position={[startPoint.x, startPoint.y, elevation + 0.02]}>
        <circleGeometry args={[0.1, 16]} />
        <meshBasicMaterial color="#4caf50" transparent opacity={0.8} />
      </mesh>

      {/* End point indicator */}
      {previewEndPoint && (
        <mesh position={[previewEndPoint.x, previewEndPoint.y, elevation + 0.02]}>
          <circleGeometry args={[0.08, 16]} />
          <meshBasicMaterial color="#2196f3" transparent opacity={0.8} />
        </mesh>
      )}
    </group>
  );
}
