import { useMemo, useRef } from 'react';
import { BoxGeometry, MeshStandardMaterial, Group, Euler } from 'three';
import { useElementStore } from '@/store';
import type { BimElement } from '@/types/bim';
import { DoorSwingArc } from './DoorSwingArc';
import { useDragElement } from '../TransformGizmo';

interface DoorMeshProps {
  element: BimElement;
  selected: boolean;
  isGhost?: boolean;
  ghostOpacity?: number;
}

// Material colors
const FRAME_COLOR = '#8B4513'; // Brown (wood)
const PANEL_COLOR = '#A0522D'; // Sienna (wood panel)
const FRAME_COLOR_SELECTED = '#90caf9';
const GHOST_COLOR = '#9e9e9e';

const FRAME_WIDTH = 0.05; // Frame thickness
const FRAME_DEPTH = 0.04; // Frame depth
const PANEL_THICKNESS = 0.04; // Door panel thickness

export function DoorMesh({ element, selected, isGhost = false, ghostOpacity = 0.25 }: DoorMeshProps) {
  const groupRef = useRef<Group>(null);
  const { getElement, elements } = useElementStore();
  const { handlers } = useDragElement(element);
  const effectiveHandlers = isGhost ? {} : handlers;

  const { doorData } = element;

  // Find host wall
  // We subscribe to `elements` to trigger re-renders when elements change
  const hostWall = useMemo(() => {
    if (!doorData) return null;
    return getElement(doorData.hostWallId) ?? null;
  }, [doorData, elements, getElement]);

  // Calculate world position and rotation from host wall (Z-up)
  const transform = useMemo(() => {
    if (!doorData || !hostWall?.wallData) return null;

    const { startPoint, endPoint, thickness } = hostWall.wallData;
    const { positionOnWall, height } = doorData;

    // Calculate wall direction and length
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const wallLength = Math.sqrt(dx * dx + dy * dy);

    // Z-up: Position along wall in XY plane
    const x = startPoint.x + dx * positionOnWall;
    const y = startPoint.y + dy * positionOnWall;

    // Wall angle
    const angle = Math.atan2(dy, dx);

    return {
      position: { x, y, z: height / 2 },
      angle,
      wallThickness: thickness,
      wallLength,
    };
  }, [doorData, hostWall]);

  // Create frame geometry (4 pieces)
  const frameGeometries = useMemo(() => {
    if (!doorData) return null;

    const { width, height } = doorData;

    return {
      // Left vertical frame
      left: new BoxGeometry(FRAME_WIDTH, height, FRAME_DEPTH),
      // Right vertical frame
      right: new BoxGeometry(FRAME_WIDTH, height, FRAME_DEPTH),
      // Top horizontal frame
      top: new BoxGeometry(width + FRAME_WIDTH * 2, FRAME_WIDTH, FRAME_DEPTH),
    };
  }, [doorData]);

  // Create door panel geometry
  const panelGeometry = useMemo(() => {
    if (!doorData) return null;
    const { width, height } = doorData;
    // Panel is slightly smaller than frame opening
    return new BoxGeometry(width - 0.02, height - 0.02, PANEL_THICKNESS);
  }, [doorData]);

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
      roughness: 0.7,
      metalness: 0.1,
    });
  }, [selected, isGhost, ghostOpacity]);

  const panelMaterial = useMemo(() => {
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
      color: selected ? FRAME_COLOR_SELECTED : PANEL_COLOR,
      roughness: 0.8,
      metalness: 0.0,
    });
  }, [selected, isGhost, ghostOpacity]);

  if (!doorData || !transform || !frameGeometries || !panelGeometry) return null;

  const { width, height } = doorData;
  const hw = width / 2;

  // Z-up: Door is rotated to stand up, then rotated around Z for wall direction
  // Frame geometries are created in XY plane (X=width, Y=height)
  // Rotate +90° around X so Y (height) → Z (up), then rotate around Z for wall angle
  return (
    <>
      {/* Door frame and panel group (rotated to stand up) */}
      <group
        ref={groupRef}
        position={[transform.position.x, transform.position.y, hostWall?.placement.position.z ?? 0]}
        rotation={new Euler(Math.PI / 2, 0, transform.angle, 'ZXY')}
        {...effectiveHandlers}
        renderOrder={isGhost ? -1 : 0}
      >
        {/* Left frame - in local coords: X is along wall, Y is height (becomes Z after rotation) */}
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

        {/* Door panel (slightly offset to show it's a door) */}
        <mesh
          geometry={panelGeometry}
          material={panelMaterial}
          position={[0, height / 2, PANEL_THICKNESS / 2]}
          castShadow={!isGhost}
        />
      </group>

      {/* Door swing arc - separate group with only Z rotation (lies flat on ground) */}
      {/* Hide swing arc for ghost elements */}
      {!isGhost && (
        <group
          position={[transform.position.x, transform.position.y, hostWall?.placement.position.z ?? 0]}
          rotation={new Euler(0, 0, transform.angle)}
        >
          <DoorSwingArc
            doorWidth={width}
            doorType={doorData.doorType}
            swingDirection={doorData.swingDirection}
            swingSide={doorData.swingSide}
            selected={selected}
            zOffset={0.02}
          />
        </group>
      )}
    </>
  );
}
