import { useMemo } from 'react';
import * as THREE from 'three';
import { Line, Html } from '@react-three/drei';
import { useToolStore } from '@/store';
import { useStoreyElevation } from '@/hooks';

const PREVIEW_COLOR = '#3b82f6'; // Blue
const POINT_COLOR = '#22c55e'; // Green
const CLOSE_COLOR = '#ef4444'; // Red (when about to close)

/**
 * Visual preview during slab polygon drawing
 * Shows placed points, connecting lines, and preview line to cursor
 * Includes distance label for the current segment
 */
export function SlabPreview() {
  const { activeTool, slabPlacement, distanceInput } = useToolStore();
  const storeyElevation = useStoreyElevation();

  const { points, previewPoint } = slabPlacement;

  // All hooks must be called before any conditional returns
  // Build line points (convert 2D to 3D, Z-up with storey elevation)
  const linePoints: [number, number, number][] = useMemo(() => {
    const pts: [number, number, number][] = points.map((p) => [p.x, p.y, storeyElevation + 0.02]);

    // Add preview point if available
    if (previewPoint) {
      pts.push([previewPoint.x, previewPoint.y, storeyElevation + 0.02]);
    }

    return pts;
  }, [points, previewPoint, storeyElevation]);

  // Check if close to start point (for visual feedback)
  const isNearStart = useMemo(() => {
    if (points.length < 3 || !previewPoint) return false;
    const firstPoint = points[0];
    if (!firstPoint) return false;
    const dx = previewPoint.x - firstPoint.x;
    const dy = previewPoint.y - firstPoint.y;
    return Math.sqrt(dx * dx + dy * dy) < 0.3;
  }, [points, previewPoint]);

  // Closed polygon preview (when we have 3+ points, Z-up with storey elevation)
  const closingLine: [number, number, number][] | null = useMemo(() => {
    if (points.length < 2) return null;
    const lastPoint = points[points.length - 1];
    const firstPoint = points[0];
    if (!lastPoint || !firstPoint) return null;
    return [
      [lastPoint.x, lastPoint.y, storeyElevation + 0.02],
      [firstPoint.x, firstPoint.y, storeyElevation + 0.02],
    ];
  }, [points, storeyElevation]);

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

      {/* Point markers (Z-up: on storey elevation) */}
      {points.map((point, index) => (
        <mesh
          key={index}
          position={[point.x, point.y, storeyElevation + 0.03]}
        >
          <circleGeometry args={[index === 0 ? 0.12 : 0.08, 16]} />
          <meshBasicMaterial
            color={index === 0 && isNearStart ? CLOSE_COLOR : POINT_COLOR}
          />
        </mesh>
      ))}

      {/* Preview point marker (Z-up: on storey elevation) */}
      {previewPoint && (
        <mesh
          position={[previewPoint.x, previewPoint.y, storeyElevation + 0.03]}
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
        <SlabFillPreview points={points} storeyElevation={storeyElevation} />
      )}

      {/* Distance label for current segment */}
      {points.length > 0 && previewPoint && (() => {
        const lastPoint = points[points.length - 1];
        if (!lastPoint) return null;

        const midX = (lastPoint.x + previewPoint.x) / 2;
        const midY = (lastPoint.y + previewPoint.y) / 2;
        const dx = previewPoint.x - lastPoint.x;
        const dy = previewPoint.y - lastPoint.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 0.1) return null;

        return (
          <Html
            position={[midX, midY, storeyElevation + 0.1]}
            center
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

/**
 * Semi-transparent fill for the slab preview
 */
function SlabFillPreview({ points, storeyElevation }: { points: { x: number; y: number }[]; storeyElevation: number }) {
  const geometry = useMemo(() => {
    const firstPoint = points[0];
    if (!firstPoint) return null;

    // Z-up: Shape lies in XY plane, no rotation needed
    const shape = new THREE.Shape();
    shape.moveTo(firstPoint.x, firstPoint.y);
    for (let i = 1; i < points.length; i++) {
      const pt = points[i];
      if (pt) {
        shape.lineTo(pt.x, pt.y);
      }
    }
    shape.closePath();

    return new THREE.ShapeGeometry(shape);
  }, [points]);

  if (!geometry) return null;

  return (
    <mesh geometry={geometry} position={[0, 0, storeyElevation + 0.01]}>
      <meshBasicMaterial
        color="#3b82f6"
        transparent
        opacity={0.2}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
