import { useMemo } from 'react';
import { Shape, ShapeGeometry, MeshBasicMaterial, DoubleSide } from 'three';
import type { DoorType, DoorSwingSide } from '@/types/bim';

interface DoorSwingArcProps {
  /** Width of the door leaf (radius of swing arc) */
  doorWidth: number;
  /** Door type: single, double, or sliding */
  doorType: DoorType;
  /** Swing direction for single doors */
  swingDirection: 'left' | 'right';
  /** Whether door swings inward or outward */
  swingSide?: DoorSwingSide;
  /** Whether the door is selected */
  selected?: boolean;
  /** Height offset from ground (Z-up coordinate system) */
  zOffset?: number;
}

// Arc colors
const ARC_COLOR = '#1e90ff'; // Blue
const ARC_COLOR_SELECTED = '#90caf9'; // Light blue
const ARC_OPACITY = 0.3;
const LINE_OPACITY = 0.6;

/**
 * Creates a quarter-circle arc shape for door swing visualization
 * Standard architectural floor plan convention
 */
function createArcShape(radius: number, startAngle: number, endAngle: number): Shape {
  const shape = new Shape();

  // Start at center
  shape.moveTo(0, 0);

  // Draw line to start of arc
  const startX = Math.cos(startAngle) * radius;
  const startY = Math.sin(startAngle) * radius;
  shape.lineTo(startX, startY);

  // Draw arc
  shape.absarc(0, 0, radius, startAngle, endAngle, false);

  // Close back to center
  shape.lineTo(0, 0);

  return shape;
}

/**
 * Creates arc outline points for the edge visualization
 */
function createArcOutline(
  radius: number,
  startAngle: number,
  endAngle: number,
  segments: number = 32
): Float32Array {
  const points: number[] = [];
  const angleStep = (endAngle - startAngle) / segments;

  // Start from door pivot
  points.push(0, 0, 0);

  // Arc points in XY plane (will be rotated by parent group's rotation={[-Math.PI/2, 0, 0]})
  // After rotation: (x, y, 0) becomes (x, 0, -y)
  for (let i = 0; i <= segments; i++) {
    const angle = startAngle + i * angleStep;
    points.push(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
  }

  // Back to pivot
  points.push(0, 0, 0);

  return new Float32Array(points);
}

/**
 * Door swing arc component
 * Displays the traditional quarter-circle arc showing door swing direction
 * as seen in architectural floor plans
 */
export function DoorSwingArc({
  doorWidth,
  doorType,
  swingDirection,
  swingSide = 'inward',
  selected = false,
  zOffset = 0.01,
}: DoorSwingArcProps) {
  const arcColor = selected ? ARC_COLOR_SELECTED : ARC_COLOR;

  // For outward swing, we flip the Y position of the arc (Z-up: Y is forward/backward)
  const yFlip = swingSide === 'outward' ? -1 : 1;

  // Create geometries based on door type
  const { leftArc, rightArc, leftOutline, rightOutline } = useMemo(() => {
    const halfWidth = doorWidth / 2;

    if (doorType === 'double') {
      // Double door: two arcs, pivots at outer edges, meeting in the middle
      // Left leaf: pivot at LEFT edge, arc swings forward and toward center (0° to 90°)
      // Right leaf: pivot at RIGHT edge, arc swings forward and toward center (90° to 180°)
      const leftShape = createArcShape(halfWidth, 0, Math.PI / 2);
      const rightShape = createArcShape(halfWidth, Math.PI / 2, Math.PI);

      return {
        leftArc: new ShapeGeometry(leftShape),
        rightArc: new ShapeGeometry(rightShape),
        leftOutline: createArcOutline(halfWidth, 0, Math.PI / 2),
        rightOutline: createArcOutline(halfWidth, Math.PI / 2, Math.PI),
      };
    } else {
      // Single door: one arc in swing direction
      // The arc radius is the full door width
      // Swing left: arc from 0° to 90° (door opens to left)
      // Swing right: arc from 90° to 180° (door opens to right)
      if (swingDirection === 'left') {
        const shape = createArcShape(doorWidth, Math.PI / 2, Math.PI);
        return {
          leftArc: new ShapeGeometry(shape),
          rightArc: null,
          leftOutline: createArcOutline(doorWidth, Math.PI / 2, Math.PI),
          rightOutline: null,
        };
      } else {
        const shape = createArcShape(doorWidth, 0, Math.PI / 2);
        return {
          leftArc: null,
          rightArc: new ShapeGeometry(shape),
          leftOutline: null,
          rightOutline: createArcOutline(doorWidth, 0, Math.PI / 2),
        };
      }
    }
  }, [doorWidth, doorType, swingDirection]);

  // Materials
  const arcMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        color: arcColor,
        transparent: true,
        opacity: ARC_OPACITY,
        side: DoubleSide,
        depthWrite: false,
      }),
    [arcColor]
  );

  // For sliding doors, we don't show a swing arc
  if (doorType === 'sliding') {
    return <SlidingDoorIndicator doorWidth={doorWidth} selected={selected} zOffset={zOffset} />;
  }

  const halfWidth = doorWidth / 2;

  // Z-up: Arc lies in XY plane, no rotation needed, scale Y for outward swing
  return (
    <group position={[0, 0, zOffset]} scale={[1, yFlip, 1]}>
      {/* Single door - one arc */}
      {doorType === 'single' && swingDirection === 'left' && leftArc && leftOutline && (
        <group position={[halfWidth, 0, 0]}>
          <mesh geometry={leftArc} material={arcMaterial} />
          <lineLoop>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" args={[leftOutline, 3]} />
            </bufferGeometry>
            <lineBasicMaterial color={arcColor} transparent opacity={LINE_OPACITY} depthTest={true} />
          </lineLoop>
        </group>
      )}

      {doorType === 'single' && swingDirection === 'right' && rightArc && rightOutline && (
        <group position={[-halfWidth, 0, 0]}>
          <mesh geometry={rightArc} material={arcMaterial} />
          <lineLoop>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" args={[rightOutline, 3]} />
            </bufferGeometry>
            <lineBasicMaterial color={arcColor} transparent opacity={LINE_OPACITY} depthTest={true} />
          </lineLoop>
        </group>
      )}

      {/* Double door - two arcs */}
      {doorType === 'double' && leftArc && rightArc && leftOutline && rightOutline && (
        <>
          {/* Left leaf - pivot at LEFT edge of door opening */}
          <group position={[-halfWidth, 0, 0]}>
            <mesh geometry={leftArc} material={arcMaterial} />
            <lineLoop>
              <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[leftOutline, 3]} />
              </bufferGeometry>
              <lineBasicMaterial color={arcColor} transparent opacity={LINE_OPACITY} depthTest={true} />
            </lineLoop>
          </group>

          {/* Right leaf - pivot at RIGHT edge of door opening */}
          <group position={[halfWidth, 0, 0]}>
            <mesh geometry={rightArc} material={arcMaterial} />
            <lineLoop>
              <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[rightOutline, 3]} />
              </bufferGeometry>
              <lineBasicMaterial color={arcColor} transparent opacity={LINE_OPACITY} depthTest={true} />
            </lineLoop>
          </group>
        </>
      )}
    </group>
  );
}

/**
 * Sliding door indicator - shows arrows or sliding direction
 * Z-up: Arrow lies in XY plane at height zOffset
 */
function SlidingDoorIndicator({
  doorWidth,
  selected,
  zOffset,
}: {
  doorWidth: number;
  selected: boolean;
  zOffset: number;
}) {
  const color = selected ? ARC_COLOR_SELECTED : ARC_COLOR;
  const halfWidth = doorWidth / 2;
  const arrowLength = doorWidth * 0.3;
  const arrowHead = 0.08;

  // Create arrow shape pointing right (sliding direction) in XY plane
  const arrowPoints = useMemo(() => {
    return new Float32Array([
      // Main line (in XY plane)
      -arrowLength / 2, 0, 0,
      arrowLength / 2, 0, 0,
      // Arrow head (pointing in Y direction for Z-up)
      arrowLength / 2 - arrowHead, arrowHead, 0,
      arrowLength / 2, 0, 0,
      arrowLength / 2 - arrowHead, -arrowHead, 0,
    ]);
  }, [arrowLength, arrowHead]);

  return (
    <group position={[0, halfWidth * 0.7, zOffset]}>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[arrowPoints, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={color} transparent opacity={LINE_OPACITY} />
      </lineSegments>
    </group>
  );
}
