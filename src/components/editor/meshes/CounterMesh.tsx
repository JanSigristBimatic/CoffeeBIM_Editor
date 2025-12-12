import { useMemo, useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import type { BimElement } from '@/types/bim';
import type { Point2D } from '@/types/geometry';
import { offsetPath } from '@/lib/geometry/pathOffset';
import { useDragElement } from '../TransformGizmo';
import { useSettingsStore } from '@/store';
import { useOpenCascade } from '@/hooks';
import { generateCounterMeshOCCT, meshDataToGeometry } from '@/lib/opencascade';

interface CounterMeshProps {
  element: BimElement;
  isSelected?: boolean;
  isHovered?: boolean;
  onClick?: () => void;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
  isGhost?: boolean;
  ghostOpacity?: number;
}

/**
 * Create a closed polygon from front and back paths
 * Z-up: XY plane is horizontal, shape lies flat at Z=0
 */
function createPolygonShape(frontPath: Point2D[], backPath: Point2D[]): THREE.Shape {
  const shape = new THREE.Shape();

  if (frontPath.length === 0) return shape;

  // Z-up: Start at front path, no negation needed
  shape.moveTo(frontPath[0]!.x, frontPath[0]!.y);

  // Draw front path
  for (let i = 1; i < frontPath.length; i++) {
    shape.lineTo(frontPath[i]!.x, frontPath[i]!.y);
  }

  // Draw back path in reverse
  for (let i = backPath.length - 1; i >= 0; i--) {
    shape.lineTo(backPath[i]!.x, backPath[i]!.y);
  }

  // Close the shape
  shape.closePath();

  return shape;
}

/**
 * CounterMesh renders a counter (Theke) as 3D geometry
 * The counter consists of:
 * - Main body with kick recess
 * - Countertop with overhang
 * - Optional footrest bar
 */
const GHOST_COLOR = '#9e9e9e';

export function CounterMesh({
  element,
  isSelected = false,
  isHovered = false,
  isGhost = false,
  ghostOpacity = 0.25,
}: CounterMeshProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { handlers } = useDragElement(element);
  const effectiveHandlers = isGhost ? {} : handlers;

  // OCCT integration for filleted countertops
  const { useOpenCascade: occtEnabled } = useSettingsStore();
  const { isReady: occtReady } = useOpenCascade();
  const [occtGeometry, setOcctGeometry] = useState<THREE.BufferGeometry | null>(null);

  // Disable raycasting for ghost elements so they don't block clicks on active storey
  useEffect(() => {
    if (groupRef.current && isGhost) {
      groupRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.raycast = () => {};
        }
      });
    }
  }, [isGhost]);

  const counterData = element.counterData;

  // Generate OCCT geometry for filleted countertop (async)
  useEffect(() => {
    if (!occtEnabled || !occtReady || !counterData || isGhost) {
      setOcctGeometry(null);
      return;
    }

    const { path, depth, height, topThickness, overhang, kickHeight, kickRecess } = counterData;

    if (path.length < 2) {
      setOcctGeometry(null);
      return;
    }

    let cancelled = false;

    const generateOcctGeometry = async () => {
      try {
        console.log('[CounterMesh] Generating OCCT geometry with fillets...');
        const meshData = await generateCounterMeshOCCT({
          path,
          depth,
          height,
          topThickness,
          overhang,
          kickHeight,
          kickRecess,
          addFillets: true,
          filletRadius: 0.005, // 5mm fillet radius
        });

        if (!cancelled && meshData) {
          const geo = meshDataToGeometry(meshData);
          setOcctGeometry(geo);
          console.log('[CounterMesh] OCCT geometry with fillets generated successfully');
        }
      } catch (error) {
        console.warn('[CounterMesh] OCCT geometry generation failed, using fallback:', error);
        if (!cancelled) {
          setOcctGeometry(null);
        }
      }
    };

    generateOcctGeometry();

    return () => {
      cancelled = true;
    };
  }, [occtEnabled, occtReady, counterData, isGhost]);

  const meshes = useMemo(() => {
    if (!counterData) return null;

    const {
      path,
      depth,
      height,
      topThickness,
      overhang,
      kickHeight,
      kickRecess,
      hasFootrest,
      footrestHeight,
    } = counterData;

    if (path.length < 2) return null;

    const meshConfigs: Array<{
      shape: THREE.Shape;
      height: number;
      zOffset: number;
      color: string;
    }> = [];

    // Calculate the various paths needed
    // Front path with overhang (customer side extends forward)
    const frontWithOverhang = offsetPath(path, -overhang);
    // Back path (service side)
    const backPath = offsetPath(path, depth);
    // Front path for kick (same as original path - no overhang at bottom)
    const frontPath = path;
    // Back path with kick recess
    const backWithKick = offsetPath(path, depth - kickRecess);

    // 1. Kick/base section (from floor to kick height)
    if (kickHeight > 0 && kickRecess > 0) {
      const kickShape = createPolygonShape(frontPath, backWithKick);
      meshConfigs.push({
        shape: kickShape,
        height: kickHeight,
        zOffset: 0,
        color: '#6B7280', // Gray for base
      });
    }

    // 2. Main body section (from kick height to below countertop)
    const mainBodyHeight = height - topThickness - kickHeight;
    if (mainBodyHeight > 0) {
      const mainShape = createPolygonShape(frontPath, backPath);
      meshConfigs.push({
        shape: mainShape,
        height: mainBodyHeight,
        zOffset: kickHeight,
        color: '#9CA3AF', // Lighter gray for body
      });
    }

    // 3. Countertop (with overhang)
    if (topThickness > 0) {
      const topShape = createPolygonShape(frontWithOverhang, backPath);
      meshConfigs.push({
        shape: topShape,
        height: topThickness,
        zOffset: height - topThickness,
        color: '#374151', // Dark gray for countertop
      });
    }

    // 4. Optional footrest bar
    if (hasFootrest && footrestHeight > 0) {
      // Footrest is a bar running along the front, slightly inset
      const footrestFront = offsetPath(path, 0.02); // Slightly behind front
      const footrestBack = offsetPath(path, 0.05); // Small depth
      const footrestShape = createPolygonShape(footrestFront, footrestBack);
      meshConfigs.push({
        shape: footrestShape,
        height: 0.03, // 3cm thick bar
        zOffset: footrestHeight,
        color: '#1F2937', // Very dark for metal bar
      });
    }

    return meshConfigs;
  }, [counterData]);

  if (!meshes && !occtGeometry) return null;

  // Calculate color based on selection/hover/ghost state
  const getColor = (baseColor: string): string => {
    if (isGhost) return GHOST_COLOR;
    if (isSelected) return '#3B82F6'; // Blue for selected
    if (isHovered) return '#60A5FA'; // Lighter blue for hovered
    return baseColor;
  };

  // Get storey elevation from element placement
  const baseZ = element.placement.position.z;

  // Use OCCT geometry when available (single mesh with filleted edges)
  if (occtGeometry) {
    return (
      <group ref={groupRef} {...effectiveHandlers} renderOrder={isGhost ? -1 : 0}>
        <mesh
          geometry={occtGeometry}
          position={[0, 0, baseZ]}
          castShadow={!isGhost}
          receiveShadow={!isGhost}
        >
          <meshStandardMaterial
            color={getColor('#374151')}
            roughness={isGhost ? 0.9 : 0.7}
            metalness={isGhost ? 0.0 : 0.1}
            transparent={isGhost}
            opacity={isGhost ? ghostOpacity : 1}
            depthWrite={!isGhost}
          />
        </mesh>
      </group>
    );
  }

  // Fallback: traditional multi-mesh rendering
  if (!meshes) return null;

  return (
    <group ref={groupRef} {...effectiveHandlers} renderOrder={isGhost ? -1 : 0}>
      {meshes.map((config, index) => (
        <mesh
          key={index}
          position={[0, 0, baseZ + config.zOffset]}
          rotation={[0, 0, 0]}
          castShadow={!isGhost}
          receiveShadow={!isGhost}
        >
          <extrudeGeometry
            args={[
              config.shape,
              {
                depth: config.height,
                bevelEnabled: false,
              },
            ]}
          />
          <meshStandardMaterial
            color={getColor(config.color)}
            roughness={isGhost ? 0.9 : 0.7}
            metalness={isGhost ? 0.0 : 0.1}
            transparent={isGhost}
            opacity={isGhost ? ghostOpacity : 1}
            depthWrite={!isGhost}
          />
        </mesh>
      ))}
    </group>
  );
}
