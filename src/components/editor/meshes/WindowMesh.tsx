import { useMemo, useRef } from 'react';
import { BoxGeometry, MeshStandardMaterial, MeshPhysicalMaterial, Group, Euler } from 'three';
import { useElementStore } from '@/store';
import type { BimElement } from '@/types/bim';
import { useDragElement } from '../TransformGizmo';

interface WindowMeshProps {
  element: BimElement;
  selected: boolean;
  isGhost?: boolean;
  ghostOpacity?: number;
}

// Material colors
const FRAME_COLOR = '#FFFFFF'; // White frame
const FRAME_COLOR_SELECTED = '#90caf9';
const GHOST_COLOR = '#9e9e9e';

const FRAME_WIDTH = 0.05; // Frame thickness
const FRAME_DEPTH = 0.06; // Frame depth
const GLASS_THICKNESS = 0.01; // Glass thickness

export function WindowMesh({ element, selected, isGhost = false, ghostOpacity = 0.25 }: WindowMeshProps) {
  const groupRef = useRef<Group>(null);
  const { getElement, elements } = useElementStore();
  const { handlers } = useDragElement(element);
  const effectiveHandlers = isGhost ? {} : handlers;

  const { windowData } = element;

  // Find host wall
  const hostWall = useMemo(() => {
    if (!windowData) return null;
    return getElement(windowData.hostWallId) ?? null;
  }, [windowData, elements, getElement]);

  // Calculate world position and rotation from host wall (Z-up)
  const transform = useMemo(() => {
    if (!windowData || !hostWall?.wallData) return null;

    const { startPoint, endPoint, thickness } = hostWall.wallData;
    const { positionOnWall, sillHeight } = windowData;

    // Calculate wall direction and length
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;

    // Z-up: Position along wall in XY plane
    const x = startPoint.x + dx * positionOnWall;
    const y = startPoint.y + dy * positionOnWall;

    // Wall angle
    const angle = Math.atan2(dy, dx);

    // Include wall's storey elevation
    const wallElevation = hostWall.placement.position.z;

    return {
      position: { x, y, z: wallElevation + sillHeight },
      angle,
      wallThickness: thickness,
    };
  }, [windowData, hostWall]);

  // Create frame geometry (4 pieces)
  const frameGeometries = useMemo(() => {
    if (!windowData) return null;

    const { width, height } = windowData;

    return {
      // Left vertical frame
      left: new BoxGeometry(FRAME_WIDTH, height, FRAME_DEPTH),
      // Right vertical frame
      right: new BoxGeometry(FRAME_WIDTH, height, FRAME_DEPTH),
      // Top horizontal frame
      top: new BoxGeometry(width + FRAME_WIDTH * 2, FRAME_WIDTH, FRAME_DEPTH),
      // Bottom horizontal frame (sill)
      bottom: new BoxGeometry(width + FRAME_WIDTH * 2, FRAME_WIDTH, FRAME_DEPTH),
    };
  }, [windowData]);

  // Create glass geometry
  const glassGeometry = useMemo(() => {
    if (!windowData) return null;
    const { width, height } = windowData;
    // Glass fills the frame opening
    return new BoxGeometry(width - 0.02, height - 0.02, GLASS_THICKNESS);
  }, [windowData]);

  // Materials
  const frameMaterial = useMemo(() => {
    if (isGhost) {
      return new MeshStandardMaterial({
        color: GHOST_COLOR,
        roughness: 0.9,
        metalness: 0.0,
        transparent: true,
        opacity: ghostOpacity,
        depthWrite: false,
      });
    }
    return new MeshStandardMaterial({
      color: selected ? FRAME_COLOR_SELECTED : FRAME_COLOR,
      roughness: 0.3,
      metalness: 0.1,
    });
  }, [selected, isGhost, ghostOpacity]);

  const glassMaterial = useMemo(() => {
    if (isGhost) {
      return new MeshStandardMaterial({
        color: GHOST_COLOR,
        roughness: 0.9,
        metalness: 0.0,
        transparent: true,
        opacity: ghostOpacity * 0.5,
        depthWrite: false,
      });
    }
    return new MeshPhysicalMaterial({
      color: '#88ccff',
      metalness: 0,
      roughness: 0,
      transmission: 0.9, // Glass transparency
      thickness: 0.01,
      transparent: true,
      opacity: 0.3,
    });
  }, [isGhost, ghostOpacity]);

  if (!windowData || !transform || !frameGeometries || !glassGeometry) return null;

  const { width, height } = windowData;
  const hw = width / 2;

  // Z-up: Window is rotated to stand up, then rotated around Z for wall direction
  return (
    <group
      ref={groupRef}
      position={[transform.position.x, transform.position.y, transform.position.z]}
      rotation={new Euler(Math.PI / 2, 0, transform.angle, 'ZXY')}
      {...effectiveHandlers}
      renderOrder={isGhost ? -1 : 0}
    >
      {/* Left frame */}
      <mesh
        geometry={frameGeometries.left}
        material={frameMaterial}
        position={[-hw - FRAME_WIDTH / 2, height / 2, 0]}
        castShadow={!isGhost}
      />

      {/* Right frame */}
      <mesh
        geometry={frameGeometries.right}
        material={frameMaterial}
        position={[hw + FRAME_WIDTH / 2, height / 2, 0]}
        castShadow={!isGhost}
      />

      {/* Top frame */}
      <mesh
        geometry={frameGeometries.top}
        material={frameMaterial}
        position={[0, height + FRAME_WIDTH / 2, 0]}
        castShadow={!isGhost}
      />

      {/* Bottom frame (sill) */}
      <mesh
        geometry={frameGeometries.bottom}
        material={frameMaterial}
        position={[0, -FRAME_WIDTH / 2, 0]}
        castShadow={!isGhost}
      />

      {/* Glass pane */}
      <mesh
        geometry={glassGeometry}
        material={glassMaterial}
        position={[0, height / 2, 0]}
      />
    </group>
  );
}
