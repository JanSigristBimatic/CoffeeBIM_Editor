import { useMemo, useRef } from 'react';
import { Mesh, Shape, ExtrudeGeometry, MeshStandardMaterial, BufferGeometry, Euler } from 'three';
import type { BimElement } from '@/types/bim';
import { useDragElement } from '../TransformGizmo';

interface StairMeshProps {
  element: BimElement;
  selected: boolean;
  isGhost?: boolean;
  ghostOpacity?: number;
}

// Material colors
const STAIR_COLOR = '#c0c0c0';
const STAIR_COLOR_SELECTED = '#90caf9';
const GHOST_COLOR = '#9e9e9e';

// Stair slab thickness (the solid part under the steps)
const STAIR_SLAB_THICKNESS = 0.15; // 15cm typical concrete stair slab

/**
 * Create realistic stair geometry with:
 * - Stepped top surface (treads and risers)
 * - Smooth sloped bottom surface (like real concrete stairs)
 *
 * The side profile looks like this:
 *        ___
 *       |   |___
 *       |       |___
 *       |           |
 *       |____________\  <- smooth slope underneath
 *
 * Coordinate system (Z-up):
 * - X = run direction (forward)
 * - Y = width direction (left-right)
 * - Z = height direction (up)
 *
 * Shape is created in XY plane (where Y=width), extruded along Z (height profile)
 */
function createStairGeometry(
  stepCount: number,
  treadDepth: number,
  riserHeight: number,
  width: number
): BufferGeometry | null {
  if (stepCount < 1) return null;

  const halfWidth = width / 2;
  const totalRise = stepCount * riserHeight;
  const runLength = (stepCount - 1) * treadDepth;

  // Create side profile shape in XY plane (Shape's coordinate system)
  // We map: shape.X = our X (run direction), shape.Y = our Z (height)
  // This will be extruded along shape.Z, which becomes our Y (width) after rotation
  const sideProfile = new Shape();

  // Start at bottom-front corner
  sideProfile.moveTo(0, 0);

  // Draw the stepped top surface (treads and risers)
  for (let i = 0; i < stepCount; i++) {
    const stepX = i * treadDepth;
    const stepZ = (i + 1) * riserHeight;

    // Riser (vertical face going up)
    sideProfile.lineTo(stepX, stepZ);

    // Tread (horizontal face) - except for last step
    if (i < stepCount - 1) {
      sideProfile.lineTo(stepX + treadDepth, stepZ);
    }
  }

  // We're now at the top of the last step: (runLength, totalRise)
  // For the last step, we need to add a short tread at the top
  sideProfile.lineTo(runLength + treadDepth * 0.5, totalRise);

  // Now go down to the sloped underside
  // Back edge - go down from top to the sloped underside
  sideProfile.lineTo(runLength + treadDepth * 0.5, totalRise - STAIR_SLAB_THICKNESS);

  // Draw the sloped underside (diagonal line back to start)
  sideProfile.lineTo(0, -STAIR_SLAB_THICKNESS);

  // Close the shape back to start
  sideProfile.closePath();

  // Extrude along the width direction
  const extrudeSettings = {
    steps: 1,
    depth: width,
    bevelEnabled: false,
  };

  const geometry = new ExtrudeGeometry(sideProfile, extrudeSettings);

  // ExtrudeGeometry creates the shape at Z=0, extruded to Z=depth
  // We need to transform this to our Z-up coordinate system:
  // - Shape X (run) should stay as X
  // - Shape Y (height in profile) should become Z (up)
  // - Extrusion direction (Z) should become Y (width)

  // Rotation: rotateX(+90°) maps Y→Z (height up), Z→-Y (width)
  geometry.rotateX(Math.PI / 2);

  // After rotation, extrusion went from Y=0 to Y=-width, so translate by +halfWidth to center
  geometry.translate(0, halfWidth, 0);

  return geometry;
}

export function StairMesh({ element, selected, isGhost = false, ghostOpacity = 0.25 }: StairMeshProps) {
  const meshRef = useRef<Mesh>(null);
  const { handlers } = useDragElement(element);
  const effectiveHandlers = isGhost ? {} : handlers;

  const { stairData, placement } = element;

  // Create geometry from stair data
  const geometry = useMemo(() => {
    if (!stairData) return null;

    const { steps, width } = stairData;
    const { count, treadDepth, riserHeight } = steps;

    return createStairGeometry(count, treadDepth, riserHeight, width);
  }, [stairData]);

  // Create material
  const material = useMemo(() => {
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
      color: selected ? STAIR_COLOR_SELECTED : STAIR_COLOR,
      roughness: 0.7,
      metalness: 0.1,
    });
  }, [selected, isGhost, ghostOpacity]);

  // Calculate rotation from stair direction (Z-up system)
  const rotation = useMemo(() => {
    if (!stairData) return new Euler(0, 0, 0);
    // Stair geometry is built with X along run direction, Y is width, Z is up
    // Rotation is around Z axis in world coordinates
    return new Euler(0, 0, stairData.rotation);
  }, [stairData]);

  if (!geometry || !stairData) return null;

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      position={[placement.position.x, placement.position.y, placement.position.z]}
      rotation={rotation}
      {...effectiveHandlers}
      castShadow={!isGhost}
      receiveShadow={!isGhost}
      renderOrder={isGhost ? -1 : 0}
    />
  );
}

/**
 * Preview mesh for stair placement (simpler, semi-transparent)
 */
export function StairPreviewMesh({
  startPoint,
  endPoint,
  width,
  steps,
}: {
  startPoint: { x: number; y: number };
  endPoint: { x: number; y: number };
  width: number;
  steps: { count: number; treadDepth: number; riserHeight: number };
}) {
  // Calculate direction and rotation
  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;
  const rotation = Math.atan2(dy, dx);

  // Create geometry
  const geometry = useMemo(() => {
    return createStairGeometry(steps.count, steps.treadDepth, steps.riserHeight, width);
  }, [steps.count, steps.treadDepth, steps.riserHeight, width]);

  // Preview material (semi-transparent)
  const material = useMemo(() => {
    return new MeshStandardMaterial({
      color: '#4caf50',
      roughness: 0.8,
      metalness: 0.1,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
  }, []);

  if (!geometry) return null;

  return (
    <mesh
      geometry={geometry}
      material={material}
      position={[startPoint.x, startPoint.y, 0]}
      rotation={new Euler(0, 0, rotation)}
      renderOrder={100}
    />
  );
}
