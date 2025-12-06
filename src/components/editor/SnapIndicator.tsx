import * as THREE from 'three';
import { useToolStore } from '@/store';
import { useMemo } from 'react';
import { useSnap } from '@/hooks/useSnap';

/**
 * Visual indicator showing when cursor is snapping to an existing element endpoint
 * Uses the centralized useSnap hook for snap detection
 */
export function SnapIndicator() {
  const { activeTool, wallPlacement } = useToolStore();
  const { getNearestSnapPoint, snapEnabled } = useSnap();

  // Get the current cursor position (preview end point during wall placement)
  const cursorPosition = wallPlacement.previewEndPoint;

  // Find if we're near a snap point
  const snapPoint = useMemo(() => {
    if (!cursorPosition || activeTool !== 'wall') return null;
    return getNearestSnapPoint(cursorPosition);
  }, [cursorPosition, activeTool, getNearestSnapPoint]);

  if (!snapPoint || !snapEnabled) return null;

  return (
    <group position={[snapPoint.x, 0.05, snapPoint.y]}>
      {/* Snap circle indicator */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.15, 0.2, 32]} />
        <meshBasicMaterial color="#00ff00" transparent opacity={0.8} side={THREE.DoubleSide} />
      </mesh>
      {/* Center dot */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.05, 16]} />
        <meshBasicMaterial color="#00ff00" />
      </mesh>
    </group>
  );
}
