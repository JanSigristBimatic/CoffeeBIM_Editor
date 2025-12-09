import * as THREE from 'three';
import { useToolStore } from '@/store';
import { useMemo } from 'react';
import { useSnap, useStoreyElevation } from '@/hooks';
import type { SnapType } from '@/types/geometry';

/** Snap indicator colors */
const SNAP_COLORS: Record<SnapType, string> = {
  endpoint: '#00ff00',     // Green - endpoints
  midpoint: '#ffaa00',     // Orange - midpoints
  perpendicular: '#00aaff', // Blue - perpendicular
  nearest: '#ff00ff',      // Magenta - nearest on line
  grid: '#888888',         // Gray - grid
  none: '#888888',         // Gray - fallback
};

const INDICATOR_SIZE = 0.15;
const INDICATOR_HEIGHT = 0.05;

/** Common material props to render on top of everything */
const OVERLAY_MATERIAL_PROPS = {
  depthTest: false,
  depthWrite: false,
} as const;

/**
 * Endpoint indicator: Square (Quadrat)
 */
function EndpointIndicator({ color }: { color: string }) {
  // Z-up: no rotation needed, geometry lies flat on XY plane by default
  return (
    <group>
      {/* Outer square */}
      <mesh renderOrder={999}>
        <ringGeometry args={[INDICATOR_SIZE * 0.7, INDICATOR_SIZE, 4]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} side={THREE.DoubleSide} {...OVERLAY_MATERIAL_PROPS} />
      </mesh>
      {/* Inner fill */}
      <mesh rotation={[0, 0, Math.PI / 4]} renderOrder={999}>
        <planeGeometry args={[INDICATOR_SIZE * 0.8, INDICATOR_SIZE * 0.8]} />
        <meshBasicMaterial color={color} transparent opacity={0.3} side={THREE.DoubleSide} {...OVERLAY_MATERIAL_PROPS} />
      </mesh>
    </group>
  );
}

/**
 * Midpoint indicator: Triangle (Dreieck)
 */
function MidpointIndicator({ color }: { color: string }) {
  const triangleShape = useMemo(() => {
    const shape = new THREE.Shape();
    const size = INDICATOR_SIZE;
    // Equilateral triangle pointing up (in XY plane for Z-up)
    shape.moveTo(0, size * 0.8);
    shape.lineTo(-size * 0.7, -size * 0.4);
    shape.lineTo(size * 0.7, -size * 0.4);
    shape.closePath();
    return shape;
  }, []);

  // Z-up: no rotation needed, shape lies flat on XY plane
  return (
    <group>
      {/* Filled triangle */}
      <mesh renderOrder={999}>
        <shapeGeometry args={[triangleShape]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} side={THREE.DoubleSide} {...OVERLAY_MATERIAL_PROPS} />
      </mesh>
    </group>
  );
}

/**
 * Perpendicular indicator: Right angle symbol (Lotrecht ⊥)
 */
function PerpendicularIndicator({ color }: { color: string }) {
  const size = INDICATOR_SIZE;
  const lineThickness = 0.02;

  // Z-up: Draw in XY plane, no rotation needed
  return (
    <group>
      {/* Vertical line (along Y) as thin box */}
      <mesh position={[0, 0, 0]} renderOrder={999}>
        <boxGeometry args={[lineThickness, size * 1.4, lineThickness]} />
        <meshBasicMaterial color={color} {...OVERLAY_MATERIAL_PROPS} />
      </mesh>
      {/* Horizontal line at bottom (along X) as thin box */}
      <mesh position={[0, -size * 0.7, 0]} renderOrder={999}>
        <boxGeometry args={[size, lineThickness, lineThickness]} />
        <meshBasicMaterial color={color} {...OVERLAY_MATERIAL_PROPS} />
      </mesh>
      {/* Small square at the corner */}
      <mesh position={[size * 0.15, -size * 0.55, 0]} renderOrder={999}>
        <planeGeometry args={[size * 0.2, size * 0.2]} />
        <meshBasicMaterial color={color} transparent opacity={0.5} side={THREE.DoubleSide} {...OVERLAY_MATERIAL_PROPS} />
      </mesh>
    </group>
  );
}

/**
 * Nearest (on line) indicator: X symbol
 */
function NearestIndicator({ color }: { color: string }) {
  const size = INDICATOR_SIZE;
  const lineThickness = 0.02;
  const diagLength = size * 1.2 * Math.SQRT2;

  // Z-up: Draw in XY plane, no rotation needed
  return (
    <group>
      {/* Diagonal line 1 (rotated box around Z) */}
      <mesh rotation={[0, 0, Math.PI / 4]} renderOrder={999}>
        <boxGeometry args={[lineThickness, diagLength, lineThickness]} />
        <meshBasicMaterial color={color} {...OVERLAY_MATERIAL_PROPS} />
      </mesh>
      {/* Diagonal line 2 (rotated box around Z) */}
      <mesh rotation={[0, 0, -Math.PI / 4]} renderOrder={999}>
        <boxGeometry args={[lineThickness, diagLength, lineThickness]} />
        <meshBasicMaterial color={color} {...OVERLAY_MATERIAL_PROPS} />
      </mesh>
      {/* Center circle */}
      <mesh renderOrder={999}>
        <circleGeometry args={[size * 0.15, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.5} {...OVERLAY_MATERIAL_PROPS} />
      </mesh>
    </group>
  );
}

/**
 * Grid indicator: Simple circle/dot
 */
function GridIndicator({ color }: { color: string }) {
  // Z-up: no rotation needed, geometry lies flat on XY plane
  return (
    <group>
      <mesh renderOrder={999}>
        <ringGeometry args={[INDICATOR_SIZE * 0.5, INDICATOR_SIZE * 0.7, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} side={THREE.DoubleSide} {...OVERLAY_MATERIAL_PROPS} />
      </mesh>
      <mesh renderOrder={999}>
        <circleGeometry args={[INDICATOR_SIZE * 0.3, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.4} {...OVERLAY_MATERIAL_PROPS} />
      </mesh>
    </group>
  );
}

/**
 * Render the appropriate indicator based on snap type
 */
function SnapSymbol({ type }: { type: SnapType }) {
  const color = SNAP_COLORS[type] || SNAP_COLORS.grid;

  switch (type) {
    case 'endpoint':
      return <EndpointIndicator color={color} />;
    case 'midpoint':
      return <MidpointIndicator color={color} />;
    case 'perpendicular':
      return <PerpendicularIndicator color={color} />;
    case 'nearest':
      return <NearestIndicator color={color} />;
    case 'grid':
      return <GridIndicator color={color} />;
    default:
      return null;
  }
}

/**
 * Visual indicator showing when cursor is snapping to an element feature
 * Shows different symbols based on snap type:
 * - Endpoint: Square
 * - Midpoint: Triangle
 * - Perpendicular: Right angle symbol
 * - Nearest: X
 *
 * Uses global cursorPosition for snap preview even before first point is placed
 */
export function SnapIndicator() {
  const { activeTool, cursorPosition } = useToolStore();
  const { getNearestSnapPoint, snapEnabled, snapSettings } = useSnap();
  const storeyElevation = useStoreyElevation();

  // Find if we're near a snap point using the global cursor position
  const snapInfo = useMemo(() => {
    if (!cursorPosition) return null;
    if (!['wall', 'slab', 'column', 'counter', 'space-draw'].includes(activeTool)) return null;
    return getNearestSnapPoint(cursorPosition);
  }, [cursorPosition, activeTool, getNearestSnapPoint]);

  if (!snapInfo || !snapEnabled || !snapSettings.enabled) return null;

  // Z-up: position is (x, y, z) where z is storey elevation + indicator height
  return (
    <group position={[snapInfo.point.x, snapInfo.point.y, storeyElevation + INDICATOR_HEIGHT]}>
      <SnapSymbol type={snapInfo.type} />
    </group>
  );
}
