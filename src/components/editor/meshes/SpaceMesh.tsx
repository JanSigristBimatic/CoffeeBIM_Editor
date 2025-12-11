import { useMemo, useRef } from 'react';
import { Mesh, Shape, ExtrudeGeometry, MeshStandardMaterial, EdgesGeometry, LineBasicMaterial } from 'three';
import { Html } from '@react-three/drei';
import type { BimElement } from '@/types/bim';
import { GASTRO_SPACE_COLORS, GASTRO_SPACE_LABELS } from '@/types/bim';
import { useDragElement } from '../TransformGizmo';

interface SpaceMeshProps {
  element: BimElement;
  selected: boolean;
  visible?: boolean;
  opacity?: number;
  showLabel?: boolean;
}

// Fallback colors based on IFC space type
const SPACE_COLOR_INTERNAL = '#87CEEB'; // Light blue
const SPACE_COLOR_EXTERNAL = '#90EE90'; // Light green
const SPACE_COLOR_NOTDEFINED = '#D3D3D3'; // Light gray
const SPACE_COLOR_SELECTED = '#FFA500'; // Orange
const EDGE_COLOR = '#333333';
const EDGE_COLOR_SELECTED = '#FF6600';

/**
 * SpaceMesh - Renders a room/space as a semi-transparent extruded volume
 *
 * Spaces are rendered with:
 * - Semi-transparent fill showing the room volume
 * - Outline edges for visibility in both 2D and 3D views
 * - Color coding based on space type (internal/external)
 */
export function SpaceMesh({
  element,
  selected,
  visible = true,
  opacity = 0.3,
  showLabel = true,
}: SpaceMeshProps) {
  const meshRef = useRef<Mesh>(null);
  const { handlers } = useDragElement(element);

  const { spaceData } = element;

  // Get color based on gastro category (priority) or space type (fallback)
  const baseColor = useMemo(() => {
    if (selected) return SPACE_COLOR_SELECTED;

    // Priority: Use gastro category color if set
    if (spaceData?.gastroCategory && spaceData.gastroCategory !== 'SONSTIGES') {
      return GASTRO_SPACE_COLORS[spaceData.gastroCategory];
    }

    // Fallback: Use IFC space type color
    switch (spaceData?.spaceType) {
      case 'EXTERNAL':
        return SPACE_COLOR_EXTERNAL;
      case 'INTERNAL':
        return SPACE_COLOR_INTERNAL;
      default:
        return SPACE_COLOR_NOTDEFINED;
    }
  }, [spaceData?.gastroCategory, spaceData?.spaceType, selected]);

  // Create geometry from boundary polygon
  const geometry = useMemo(() => {
    if (!spaceData?.boundaryPolygon || spaceData.boundaryPolygon.length < 3) {
      return null;
    }

    const { boundaryPolygon } = spaceData;
    const height = element.geometry.height;

    // Create shape from polygon points
    // Z-up coordinate system: XY plane is horizontal
    const shape = new Shape();
    const firstPoint = boundaryPolygon[0];
    if (!firstPoint) return null;

    shape.moveTo(firstPoint.x, firstPoint.y);
    for (let i = 1; i < boundaryPolygon.length; i++) {
      const pt = boundaryPolygon[i];
      if (pt) {
        shape.lineTo(pt.x, pt.y);
      }
    }
    shape.closePath();

    // Extrude upward along +Z
    const extrudeSettings = {
      steps: 1,
      depth: height,
      bevelEnabled: false,
    };

    return new ExtrudeGeometry(shape, extrudeSettings);
  }, [spaceData, element.geometry.height]);

  // Create edges geometry for outline
  const edgesGeometry = useMemo(() => {
    if (!geometry) return null;
    return new EdgesGeometry(geometry, 15); // 15 degree threshold
  }, [geometry]);

  // Create material for the fill
  const fillMaterial = useMemo(() => {
    return new MeshStandardMaterial({
      color: baseColor,
      roughness: 0.9,
      metalness: 0.0,
      transparent: true,
      opacity: selected ? opacity + 0.2 : opacity,
      depthWrite: false, // Prevent z-fighting with floor
      side: 2, // DoubleSide
    });
  }, [baseColor, opacity, selected]);

  // Create material for edges
  const edgeMaterial = useMemo(() => {
    return new LineBasicMaterial({
      color: selected ? EDGE_COLOR_SELECTED : EDGE_COLOR,
      linewidth: selected ? 2 : 1,
    });
  }, [selected]);

  if (!visible || !geometry || !spaceData) return null;

  // Position at storey elevation
  const elevation = element.placement.position.z;

  return (
    <group position={[0, 0, elevation]}>
      {/* Space volume (semi-transparent fill) */}
      <mesh
        ref={meshRef}
        geometry={geometry}
        material={fillMaterial}
        {...handlers}
        renderOrder={-1} // Render behind other elements
      />

      {/* Space outline (always visible) */}
      {edgesGeometry && (
        <lineSegments geometry={edgesGeometry} material={edgeMaterial} />
      )}

      {/* Space label (conditionally visible, positioned at floor level) */}
      {showLabel && <SpaceLabel element={element} selected={selected} showArea={true} />}
    </group>
  );
}

/**
 * SpaceLabel - Renders a label at the centroid of a space
 * Shows room name and area in 2D view
 */
export function SpaceLabel({
  element,
  selected,
  showArea = true,
}: {
  element: BimElement;
  selected: boolean;
  showArea?: boolean;
}) {
  const { spaceData } = element;

  // Calculate centroid from boundary polygon - must be before any early returns
  const centroid = useMemo(() => {
    if (!spaceData?.boundaryPolygon || spaceData.boundaryPolygon.length < 3) {
      return { x: 0, y: 0 };
    }
    const polygon = spaceData.boundaryPolygon;
    let cx = 0;
    let cy = 0;
    for (const p of polygon) {
      cx += p.x;
      cy += p.y;
    }
    return { x: cx / polygon.length, y: cy / polygon.length };
  }, [spaceData?.boundaryPolygon]);

  if (!spaceData || !spaceData.boundaryPolygon || spaceData.boundaryPolygon.length < 3) {
    return null;
  }

  // Format area to 1 decimal place
  const areaText = spaceData.area
    ? `${spaceData.area.toFixed(1)} m²`
    : '';

  // Get gastro category label
  const categoryLabel = spaceData.gastroCategory && spaceData.gastroCategory !== 'SONSTIGES'
    ? GASTRO_SPACE_LABELS[spaceData.gastroCategory]
    : null;

  const textColor = selected ? '#FF6600' : '#333333';

  // Position at centroid, slightly above ground
  // Note: parent group already handles elevation
  // Using occlude={false} ensures label is always visible
  return (
    <Html
      position={[centroid.x, centroid.y, 0.1]}
      center
      occlude={false}
      zIndexRange={[40, 0]}
      style={{
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          textAlign: 'center',
          fontSize: '14px',
          fontWeight: 600,
          color: textColor,
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          padding: '6px 12px',
          borderRadius: '4px',
          border: `2px solid ${selected ? '#FF6600' : '#666'}`,
          whiteSpace: 'nowrap',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        }}
      >
        <div>{element.name}</div>
        {categoryLabel && (
          <div style={{ fontSize: '10px', fontWeight: 500, color: '#666', marginTop: '1px' }}>{categoryLabel}</div>
        )}
        {showArea && areaText && (
          <div style={{ fontSize: '11px', fontWeight: 'normal', color: '#555', marginTop: '2px' }}>{areaText}</div>
        )}
      </div>
    </Html>
  );
}
