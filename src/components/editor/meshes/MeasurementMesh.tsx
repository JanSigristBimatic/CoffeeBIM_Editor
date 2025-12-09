import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Line, Html, Sphere } from '@react-three/drei';
import { ThreeEvent } from '@react-three/fiber';
import type { Measurement } from '@/store/useMeasurementStore';
import type { Point3D } from '@/types/geometry';

// Colors for measurement visualization
const COLORS = {
  X: '#FF3333', // Red for X axis
  Y: '#33FF33', // Green for Y axis
  Z: '#3333FF', // Blue for Z axis
  TOTAL: '#00FFFF', // Cyan for total distance
  SELECTED: '#FF6600', // Orange for selected
  POINT: '#FFFFFF', // White for points
  POINT_SELECTED: '#FF6600', // Orange for selected points
};

interface MeasurementMeshProps {
  measurement: Measurement;
  selected?: boolean;
  onClick?: (id: string, event: ThreeEvent<MouseEvent>) => void;
}

/**
 * Format distance for display
 */
function formatDistance(distance: number): string {
  const absDistance = Math.abs(distance);
  if (absDistance < 0.01) {
    // Less than 1cm, show mm
    return `${(absDistance * 1000).toFixed(0)} mm`;
  } else if (absDistance < 1) {
    // Less than 1m, show cm
    return `${(absDistance * 100).toFixed(1)} cm`;
  } else {
    // Show meters
    return `${absDistance.toFixed(2)} m`;
  }
}

/**
 * MeasurementMesh - Renders a single measurement with axis-colored lines
 *
 * Visualization:
 * - Red line: X delta
 * - Green line: Y delta
 * - Blue line: Z delta
 * - Cyan dashed line: Total distance
 * - White spheres: Start and end points
 */
export function MeasurementMesh({ measurement, selected = false, onClick }: MeasurementMeshProps) {
  const groupRef = useRef<THREE.Group>(null);

  const { startPoint, endPoint, deltaX, deltaY, deltaZ, totalDistance } = measurement;

  // Calculate intermediate points for axis lines
  const points = useMemo(() => {
    const p0 = startPoint; // Start
    const p1: Point3D = { x: endPoint.x, y: startPoint.y, z: startPoint.z }; // After X
    const p2: Point3D = { x: endPoint.x, y: endPoint.y, z: startPoint.z }; // After Y
    const p3 = endPoint; // End (after Z)

    return { p0, p1, p2, p3 };
  }, [startPoint, endPoint]);

  // Midpoints for labels
  const midpoints = useMemo(() => {
    const { p0, p1, p2, p3 } = points;
    return {
      xMid: { x: (p0.x + p1.x) / 2, y: p0.y, z: p0.z },
      yMid: { x: p1.x, y: (p1.y + p2.y) / 2, z: p1.z },
      zMid: { x: p2.x, y: p2.y, z: (p2.z + p3.z) / 2 },
      totalMid: {
        x: (p0.x + p3.x) / 2,
        y: (p0.y + p3.y) / 2,
        z: (p0.z + p3.z) / 2,
      },
    };
  }, [points]);

  // Handler for clicking on the measurement
  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    if (onClick) {
      onClick(measurement.id, event);
    }
  };

  const lineWidth = selected ? 3 : 2;
  const pointSize = selected ? 0.06 : 0.04;

  return (
    <group ref={groupRef} onClick={handleClick}>
      {/* Start point sphere */}
      <Sphere args={[pointSize, 16, 16]} position={[startPoint.x, startPoint.y, startPoint.z]}>
        <meshBasicMaterial color={selected ? COLORS.POINT_SELECTED : COLORS.POINT} />
      </Sphere>

      {/* End point sphere */}
      <Sphere args={[pointSize, 16, 16]} position={[endPoint.x, endPoint.y, endPoint.z]}>
        <meshBasicMaterial color={selected ? COLORS.POINT_SELECTED : COLORS.POINT} />
      </Sphere>

      {/* X axis line (Red) */}
      {Math.abs(deltaX) > 0.001 && (
        <>
          <Line
            points={[
              [points.p0.x, points.p0.y, points.p0.z],
              [points.p1.x, points.p1.y, points.p1.z],
            ]}
            color={COLORS.X}
            lineWidth={lineWidth}
          />
          <DistanceLabel
            position={midpoints.xMid}
            text={formatDistance(deltaX)}
            color={COLORS.X}
            axis="X"
          />
        </>
      )}

      {/* Y axis line (Green) */}
      {Math.abs(deltaY) > 0.001 && (
        <>
          <Line
            points={[
              [points.p1.x, points.p1.y, points.p1.z],
              [points.p2.x, points.p2.y, points.p2.z],
            ]}
            color={COLORS.Y}
            lineWidth={lineWidth}
          />
          <DistanceLabel
            position={midpoints.yMid}
            text={formatDistance(deltaY)}
            color={COLORS.Y}
            axis="Y"
          />
        </>
      )}

      {/* Z axis line (Blue) */}
      {Math.abs(deltaZ) > 0.001 && (
        <>
          <Line
            points={[
              [points.p2.x, points.p2.y, points.p2.z],
              [points.p3.x, points.p3.y, points.p3.z],
            ]}
            color={COLORS.Z}
            lineWidth={lineWidth}
          />
          <DistanceLabel
            position={midpoints.zMid}
            text={formatDistance(deltaZ)}
            color={COLORS.Z}
            axis="Z"
          />
        </>
      )}

      {/* Total distance line (Cyan, dashed) */}
      <Line
        points={[
          [startPoint.x, startPoint.y, startPoint.z],
          [endPoint.x, endPoint.y, endPoint.z],
        ]}
        color={selected ? COLORS.SELECTED : COLORS.TOTAL}
        lineWidth={lineWidth}
        dashed
        dashSize={0.1}
        gapSize={0.05}
      />
      <DistanceLabel
        position={midpoints.totalMid}
        text={formatDistance(totalDistance)}
        color={selected ? COLORS.SELECTED : COLORS.TOTAL}
        isTotal
      />
    </group>
  );
}

interface DistanceLabelProps {
  position: Point3D;
  text: string;
  color: string;
  axis?: 'X' | 'Y' | 'Z';
  isTotal?: boolean;
}

/**
 * DistanceLabel - Billboard label for distance display
 */
function DistanceLabel({ position, text, color, axis, isTotal = false }: DistanceLabelProps) {
  return (
    <Html
      position={[position.x, position.y, position.z]}
      center
      occlude={false}
      style={{
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          textAlign: 'center',
          fontSize: isTotal ? '13px' : '11px',
          fontWeight: isTotal ? 700 : 600,
          fontFamily: 'monospace',
          color: '#FFFFFF',
          backgroundColor: color,
          padding: isTotal ? '4px 8px' : '2px 6px',
          borderRadius: '3px',
          whiteSpace: 'nowrap',
          boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
        }}
      >
        {axis && <span style={{ opacity: 0.8 }}>{axis}: </span>}
        {text}
      </div>
    </Html>
  );
}

interface PreviewMeasurementProps {
  startPoint: Point3D;
  endPoint: Point3D;
}

/**
 * PreviewMeasurement - Renders measurement preview during placement
 * Uses same visual style but with slightly reduced opacity
 */
export function PreviewMeasurement({ startPoint, endPoint }: PreviewMeasurementProps) {
  const deltaX = endPoint.x - startPoint.x;
  const deltaY = endPoint.y - startPoint.y;
  const deltaZ = endPoint.z - startPoint.z;
  const totalDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ);

  // Calculate intermediate points for axis lines
  const points = useMemo(() => {
    const p0 = startPoint;
    const p1: Point3D = { x: endPoint.x, y: startPoint.y, z: startPoint.z };
    const p2: Point3D = { x: endPoint.x, y: endPoint.y, z: startPoint.z };
    const p3 = endPoint;
    return { p0, p1, p2, p3 };
  }, [startPoint, endPoint]);

  // Midpoints for labels
  const midpoints = useMemo(() => {
    const { p0, p1, p2, p3 } = points;
    return {
      xMid: { x: (p0.x + p1.x) / 2, y: p0.y, z: p0.z },
      yMid: { x: p1.x, y: (p1.y + p2.y) / 2, z: p1.z },
      zMid: { x: p2.x, y: p2.y, z: (p2.z + p3.z) / 2 },
      totalMid: {
        x: (p0.x + p3.x) / 2,
        y: (p0.y + p3.y) / 2,
        z: (p0.z + p3.z) / 2,
      },
    };
  }, [points]);

  if (totalDistance < 0.001) return null;

  return (
    <group>
      {/* Start point */}
      <Sphere args={[0.05, 16, 16]} position={[startPoint.x, startPoint.y, startPoint.z]}>
        <meshBasicMaterial color={COLORS.POINT} transparent opacity={0.8} />
      </Sphere>

      {/* End point (follows cursor) */}
      <Sphere args={[0.05, 16, 16]} position={[endPoint.x, endPoint.y, endPoint.z]}>
        <meshBasicMaterial color={COLORS.TOTAL} transparent opacity={0.8} />
      </Sphere>

      {/* X axis line (Red) */}
      {Math.abs(deltaX) > 0.001 && (
        <>
          <Line
            points={[
              [points.p0.x, points.p0.y, points.p0.z],
              [points.p1.x, points.p1.y, points.p1.z],
            ]}
            color={COLORS.X}
            lineWidth={2}
            transparent
            opacity={0.8}
          />
          <DistanceLabel position={midpoints.xMid} text={formatDistance(deltaX)} color={COLORS.X} axis="X" />
        </>
      )}

      {/* Y axis line (Green) */}
      {Math.abs(deltaY) > 0.001 && (
        <>
          <Line
            points={[
              [points.p1.x, points.p1.y, points.p1.z],
              [points.p2.x, points.p2.y, points.p2.z],
            ]}
            color={COLORS.Y}
            lineWidth={2}
            transparent
            opacity={0.8}
          />
          <DistanceLabel position={midpoints.yMid} text={formatDistance(deltaY)} color={COLORS.Y} axis="Y" />
        </>
      )}

      {/* Z axis line (Blue) */}
      {Math.abs(deltaZ) > 0.001 && (
        <>
          <Line
            points={[
              [points.p2.x, points.p2.y, points.p2.z],
              [points.p3.x, points.p3.y, points.p3.z],
            ]}
            color={COLORS.Z}
            lineWidth={2}
            transparent
            opacity={0.8}
          />
          <DistanceLabel position={midpoints.zMid} text={formatDistance(deltaZ)} color={COLORS.Z} axis="Z" />
        </>
      )}

      {/* Total distance line (Cyan) */}
      <Line
        points={[
          [startPoint.x, startPoint.y, startPoint.z],
          [endPoint.x, endPoint.y, endPoint.z],
        ]}
        color={COLORS.TOTAL}
        lineWidth={2}
        dashed
        dashSize={0.1}
        gapSize={0.05}
        transparent
        opacity={0.8}
      />
      <DistanceLabel position={midpoints.totalMid} text={formatDistance(totalDistance)} color={COLORS.TOTAL} isTotal />
    </group>
  );
}
