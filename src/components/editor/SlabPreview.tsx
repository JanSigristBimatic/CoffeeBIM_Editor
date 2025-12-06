import { useMemo } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import { useToolStore } from '@/store';

const PREVIEW_COLOR = '#3b82f6'; // Blue
const POINT_COLOR = '#22c55e'; // Green
const CLOSE_COLOR = '#ef4444'; // Red (when about to close)

/**
 * Visual preview during slab polygon drawing
 * Shows placed points, connecting lines, and preview line to cursor
 */
export function SlabPreview() {
  const { activeTool, slabPlacement } = useToolStore();

  const { points, previewPoint } = slabPlacement;

  // All hooks must be called before any conditional returns
  // Build line points (convert 2D to 3D)
  const linePoints: [number, number, number][] = useMemo(() => {
    const pts: [number, number, number][] = points.map((p) => [p.x, 0.02, p.y]);

    // Add preview point if available
    if (previewPoint) {
      pts.push([previewPoint.x, 0.02, previewPoint.y]);
    }

    return pts;
  }, [points, previewPoint]);

  // Check if close to start point (for visual feedback)
  const isNearStart = useMemo(() => {
    if (points.length < 3 || !previewPoint) return false;
    const firstPoint = points[0];
    if (!firstPoint) return false;
    const dx = previewPoint.x - firstPoint.x;
    const dy = previewPoint.y - firstPoint.y;
    return Math.sqrt(dx * dx + dy * dy) < 0.3;
  }, [points, previewPoint]);

  // Closed polygon preview (when we have 3+ points)
  const closingLine: [number, number, number][] | null = useMemo(() => {
    if (points.length < 2) return null;
    const lastPoint = points[points.length - 1];
    const firstPoint = points[0];
    if (!lastPoint || !firstPoint) return null;
    return [
      [lastPoint.x, 0.02, lastPoint.y],
      [firstPoint.x, 0.02, firstPoint.y],
    ];
  }, [points]);

  // Don't show if not in slab mode or no points (after all hooks)
  if (activeTool !== 'slab') return null;
  if (points.length === 0 && !previewPoint) return null;

  return (
    <group>
      {/* Main outline */}
      {linePoints.length >= 2 && (
        <Line
          points={linePoints}
          color={PREVIEW_COLOR}
          lineWidth={2}
          dashed={false}
        />
      )}

      {/* Closing line (dashed) - shows how polygon would close */}
      {closingLine && !isNearStart && (
        <Line
          points={closingLine}
          color={PREVIEW_COLOR}
          lineWidth={1}
          dashed
          dashScale={10}
          dashSize={0.1}
          gapSize={0.1}
        />
      )}

      {/* Point markers */}
      {points.map((point, index) => (
        <mesh
          key={index}
          position={[point.x, 0.03, point.y]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <circleGeometry args={[index === 0 ? 0.12 : 0.08, 16]} />
          <meshBasicMaterial
            color={index === 0 && isNearStart ? CLOSE_COLOR : POINT_COLOR}
          />
        </mesh>
      ))}

      {/* Preview point marker */}
      {previewPoint && (
        <mesh
          position={[previewPoint.x, 0.03, previewPoint.y]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.06, 0.1, 16]} />
          <meshBasicMaterial
            color={isNearStart ? CLOSE_COLOR : PREVIEW_COLOR}
            transparent
            opacity={0.8}
          />
        </mesh>
      )}

      {/* Filled preview polygon (semi-transparent) */}
      {points.length >= 3 && (
        <SlabFillPreview points={points} />
      )}
    </group>
  );
}

/**
 * Semi-transparent fill for the slab preview
 */
function SlabFillPreview({ points }: { points: { x: number; y: number }[] }) {
  const geometry = useMemo(() => {
    const firstPoint = points[0];
    if (!firstPoint) return null;

    // Negate Y to correct for coordinate transform after rotation
    const shape = new THREE.Shape();
    shape.moveTo(firstPoint.x, -firstPoint.y);
    for (let i = 1; i < points.length; i++) {
      const pt = points[i];
      if (pt) {
        shape.lineTo(pt.x, -pt.y);
      }
    }
    shape.closePath();

    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(-Math.PI / 2);
    return geo;
  }, [points]);

  if (!geometry) return null;

  return (
    <mesh geometry={geometry} position={[0, 0.01, 0]}>
      <meshBasicMaterial
        color="#3b82f6"
        transparent
        opacity={0.2}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
