import { Line, Text } from '@react-three/drei';

// Dimension line colors
const DIMENSION_LINE_COLOR = '#60a5fa'; // Blue
const DIMENSION_TEXT_COLOR = '#ffffff';

export interface DimensionLineProps {
  /** Start point [x, y, z] */
  start: [number, number, number];
  /** End point [x, y, z] */
  end: [number, number, number];
  /** Distance value in meters */
  distance: number;
  /** Optional: Override line color */
  color?: string;
  /** Optional: Override text color */
  textColor?: string;
  /** Optional: Line width (default 2) */
  lineWidth?: number;
  /** Optional: Show dashed line (default true) */
  dashed?: boolean;
  /** Optional: Text offset above line (default 0.15) */
  textOffset?: number;
  /** Optional: Font size (default 0.12) */
  fontSize?: number;
  /** Optional: Render order for depth sorting (default 1000) */
  renderOrder?: number;
  /** Optional: Hide if distance below threshold in meters (default 0.01) */
  minDistance?: number;
}

/**
 * Reusable dimension line with measurement text
 * Shows distance between two 3D points with end caps and centered label
 */
export function DimensionLine({
  start,
  end,
  distance,
  color = DIMENSION_LINE_COLOR,
  textColor = DIMENSION_TEXT_COLOR,
  lineWidth = 2,
  dashed = true,
  textOffset = 0.15,
  fontSize = 0.12,
  renderOrder = 1000,
  minDistance = 0.01,
}: DimensionLineProps) {
  // Don't render if distance is too small
  if (distance < minDistance) return null;

  // Calculate midpoint for text
  const midX = (start[0] + end[0]) / 2;
  const midY = (start[1] + end[1]) / 2;
  const midZ = (start[2] + end[2]) / 2;

  // Calculate angle for text rotation (in XY plane for Z-up)
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const angle = Math.atan2(dy, dx);

  // Format distance for display
  const distanceText = formatDistance(distance);

  return (
    <group renderOrder={renderOrder}>
      {/* Main dimension line */}
      <Line
        points={[start, end]}
        color={color}
        lineWidth={lineWidth}
        dashed={dashed}
        dashSize={0.1}
        gapSize={0.05}
        depthTest={false}
        renderOrder={renderOrder}
      />

      {/* End caps */}
      <EndCap position={start} angle={angle} color={color} renderOrder={renderOrder} />
      <EndCap position={end} angle={angle} color={color} renderOrder={renderOrder} />

      {/* Distance text (Z-up: text lies in XY plane, offset above line along Z) */}
      <Text
        position={[midX, midY, midZ + textOffset]}
        rotation={[0, 0, -angle]}
        fontSize={fontSize}
        color={textColor}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.01}
        outlineColor="#000000"
        renderOrder={renderOrder + 1}
        depthOffset={-1}
      >
        {distanceText}
      </Text>
    </group>
  );
}

interface EndCapProps {
  position: [number, number, number];
  angle: number;
  color: string;
  renderOrder: number;
}

/**
 * Small perpendicular mark at dimension line ends
 * Z-up: perpendicular in XY plane
 */
function EndCap({ position, angle, color, renderOrder }: EndCapProps) {
  const [x, y, z] = position;
  const capLength = 0.08;

  // Perpendicular to line direction (Z-up: in XY plane)
  const perpX = -Math.sin(angle) * capLength;
  const perpY = Math.cos(angle) * capLength;

  return (
    <Line
      points={[
        [x - perpX, y - perpY, z],
        [x + perpX, y + perpY, z],
      ]}
      color={color}
      lineWidth={2}
      depthTest={false}
      renderOrder={renderOrder}
    />
  );
}

/**
 * Format distance for display (meters or centimeters)
 */
export function formatDistance(meters: number): string {
  if (meters >= 1) {
    return `${meters.toFixed(2)}m`;
  }
  return `${Math.round(meters * 100)}cm`;
}
