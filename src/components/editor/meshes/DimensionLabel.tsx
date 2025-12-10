import { useMemo } from 'react';
import { Html } from '@react-three/drei';
import type { Dimension } from '@/types/dimensions';
import { DIMENSION_COLORS } from '@/types/dimensions';

interface DimensionLabelProps {
  dimension: Dimension;
  visible?: boolean;
}

/**
 * DimensionLabel - Renders a dimension annotation in 3D space
 * Uses Html from drei for billboard-style rendering that always faces the camera
 */
export function DimensionLabel({ dimension, visible = true }: DimensionLabelProps) {
  const { position3D, displayText, type } = dimension;

  // Style based on dimension type - must be before any early returns
  const style = useMemo(() => {
    const isArea = type === 'space-area';

    return {
      fontSize: isArea ? '14px' : '12px',
      fontWeight: isArea ? 700 : 600,
      padding: isArea ? '6px 12px' : '4px 8px',
    };
  }, [type]);

  if (!visible) return null;

  // Position in Z-up coordinate system (project uses Z-up directly)
  const position: [number, number, number] = [
    position3D.x,
    position3D.y,
    position3D.z,
  ];

  return (
    <Html
      position={position}
      center
      zIndexRange={[40, 0]}
      sprite
      transform
      distanceFactor={8}
      style={{
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          textAlign: 'center',
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          color: DIMENSION_COLORS.primary,
          backgroundColor: DIMENSION_COLORS.background,
          padding: style.padding,
          borderRadius: '4px',
          border: `1px solid ${DIMENSION_COLORS.primary}`,
          whiteSpace: 'nowrap',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        {displayText}
      </div>
    </Html>
  );
}

interface DimensionLineProps {
  dimension: Dimension;
  visible?: boolean;
}

/**
 * DimensionLine3D - Renders a dimension line in 3D space
 * For linear dimensions (wall length, etc.)
 */
export function DimensionLine3D({ dimension, visible = true }: DimensionLineProps) {
  if (!visible || !dimension.measureLine) return null;

  const { measureLine, position2D } = dimension;
  const { start, end } = measureLine;

  // Calculate offset points
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.sqrt(dx * dx + dy * dy);

  if (length === 0) return null;

  // Normal vector for offset
  const nx = -dy / length;
  const ny = dx / length;
  const offset = position2D.offset;

  // Offset line points
  const offsetStart = {
    x: start.x + nx * offset,
    y: start.y + ny * offset,
  };
  const offsetEnd = {
    x: end.x + nx * offset,
    y: end.y + ny * offset,
  };

  // Z height for the dimension line (mid-height of wall)
  const z = dimension.position3D.z;

  return (
    <group>
      {/* Extension lines - Z-up coordinate system */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={2}
            array={new Float32Array([
              start.x, start.y, z,
              offsetStart.x, offsetStart.y, z,
            ])}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color={DIMENSION_COLORS.line} linewidth={1} />
      </line>
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={2}
            array={new Float32Array([
              end.x, end.y, z,
              offsetEnd.x, offsetEnd.y, z,
            ])}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color={DIMENSION_COLORS.line} linewidth={1} />
      </line>

      {/* Main dimension line */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={2}
            array={new Float32Array([
              offsetStart.x, offsetStart.y, z,
              offsetEnd.x, offsetEnd.y, z,
            ])}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color={DIMENSION_COLORS.primary} linewidth={2} />
      </line>

      {/* Label */}
      <DimensionLabel dimension={dimension} visible={visible} />
    </group>
  );
}
