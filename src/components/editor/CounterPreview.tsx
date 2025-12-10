import { useMemo } from 'react';
import * as THREE from 'three';
import { Line, Html } from '@react-three/drei';
import { useToolStore } from '@/store';
import { useStoreyElevation } from '@/hooks';
import type { Point2D } from '@/types/geometry';
import { offsetPath } from '@/lib/geometry/pathOffset';

/**
 * Create a closed polygon outline from front and back paths
 * Z-up: x, y are ground plane, z is storey elevation + offset
 */
function createOutlinePoints(frontPath: Point2D[], backPath: Point2D[], storeyElevation: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];

  // Front path (Z-up: x, y ground, z is storey elevation + offset)
  for (const p of frontPath) {
    points.push(new THREE.Vector3(p.x, p.y, storeyElevation + 0.01));
  }

  // Back path in reverse
  for (let i = backPath.length - 1; i >= 0; i--) {
    points.push(new THREE.Vector3(backPath[i]!.x, backPath[i]!.y, storeyElevation + 0.01));
  }

  // Close the loop
  if (frontPath.length > 0) {
    points.push(new THREE.Vector3(frontPath[0]!.x, frontPath[0]!.y, storeyElevation + 0.01));
  }

  return points;
}

/**
 * CounterPreview shows the counter path being drawn
 * Displays:
 * - Front line (customer side) in blue
 * - Back line (service side) in lighter blue
 * - Counter outline preview
 * - Point markers
 */
export function CounterPreview() {
  const { activeTool, counterPlacement, distanceInput } = useToolStore();
  const storeyElevation = useStoreyElevation();

  const preview = useMemo(() => {
    if (activeTool !== 'counter') return null;

    const { points, previewPoint, params } = counterPlacement;

    // Build the current path including preview point
    const currentPath = [...points];
    if (previewPoint) {
      currentPath.push(previewPoint);
    }

    if (currentPath.length === 0) return null;

    const { depth, overhang } = params;

    // Calculate paths
    const frontWithOverhang = currentPath.length >= 2
      ? offsetPath(currentPath, -overhang)
      : [];
    const backPath = currentPath.length >= 2
      ? offsetPath(currentPath, depth)
      : [];

    // Convert to 3D points (Z-up: x, y ground, z is storey elevation + offset)
    const frontLinePoints = currentPath.map(
      (p) => new THREE.Vector3(p.x, p.y, storeyElevation + 0.02)
    );

    const backLinePoints = backPath.map(
      (p) => new THREE.Vector3(p.x, p.y, storeyElevation + 0.02)
    );

    // Outline points (only if we have at least 2 points)
    const outlinePoints = currentPath.length >= 2
      ? createOutlinePoints(frontWithOverhang, backPath, storeyElevation)
      : [];

    // Point markers for placed points (Z-up)
    const pointMarkers = points.map((p) => (
      new THREE.Vector3(p.x, p.y, storeyElevation + 0.02)
    ));

    return {
      frontLinePoints,
      backLinePoints,
      outlinePoints,
      pointMarkers,
      previewPoint: previewPoint
        ? new THREE.Vector3(previewPoint.x, previewPoint.y, storeyElevation + 0.02)
        : null,
      storeyElevation,
    };
  }, [activeTool, counterPlacement, storeyElevation]);

  if (!preview) return null;

  return (
    <group>
      {/* Front line (customer side) - solid blue */}
      {preview.frontLinePoints.length >= 2 && (
        <Line
          points={preview.frontLinePoints}
          color="#3B82F6"
          lineWidth={3}
          dashed={false}
        />
      )}

      {/* Back line (service side) - dashed lighter blue */}
      {preview.backLinePoints.length >= 2 && (
        <Line
          points={preview.backLinePoints}
          color="#93C5FD"
          lineWidth={2}
          dashed
          dashSize={0.1}
          gapSize={0.05}
        />
      )}

      {/* Counter outline - very light transparent */}
      {preview.outlinePoints.length >= 4 && (
        <Line
          points={preview.outlinePoints}
          color="#60A5FA"
          lineWidth={1}
          dashed
          dashSize={0.05}
          gapSize={0.05}
        />
      )}

      {/* Point markers for placed points */}
      {preview.pointMarkers.map((pos, index) => (
        <mesh key={index} position={pos}>
          <sphereGeometry args={[0.05, 16, 16]} />
          <meshBasicMaterial color="#3B82F6" />
        </mesh>
      ))}

      {/* Preview point marker (current cursor position) */}
      {preview.previewPoint && (
        <mesh position={preview.previewPoint}>
          <sphereGeometry args={[0.04, 16, 16]} />
          <meshBasicMaterial color="#93C5FD" transparent opacity={0.7} />
        </mesh>
      )}

      {/* Helper text at first point (Z-up: z is storey elevation + offset) */}
      {preview.pointMarkers.length > 0 && preview.pointMarkers.length < 2 && (
        <group position={[preview.pointMarkers[0]!.x, preview.pointMarkers[0]!.y, preview.storeyElevation + 0.5]}>
          {/* Visual indicator that user should continue clicking */}
        </group>
      )}

      {/* Distance label for current segment */}
      {preview.pointMarkers.length > 0 && preview.previewPoint && (() => {
        const lastPoint = preview.pointMarkers[preview.pointMarkers.length - 1];
        if (!lastPoint) return null;

        const midX = (lastPoint.x + preview.previewPoint.x) / 2;
        const midY = (lastPoint.y + preview.previewPoint.y) / 2;
        const dx = preview.previewPoint.x - lastPoint.x;
        const dy = preview.previewPoint.y - lastPoint.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 0.1) return null;

        return (
          <Html
            position={[midX, midY, preview.storeyElevation + 0.1]}
            center
            zIndexRange={[40, 0]}
            style={{ pointerEvents: 'none' }}
          >
            <div
              style={{
                background: distanceInput.active ? '#3b82f6' : 'rgba(0, 0, 0, 0.75)',
                color: 'white',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '12px',
                fontFamily: 'monospace',
                whiteSpace: 'nowrap',
                border: distanceInput.active ? '1px solid #60a5fa' : 'none',
              }}
            >
              {distance.toFixed(2)} m
            </div>
          </Html>
        );
      })()}
    </group>
  );
}
