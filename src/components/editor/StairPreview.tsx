import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { MeshStandardMaterial, BufferGeometry, Shape, ExtrudeGeometry, Euler } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { useStairPlacement } from '@/hooks';
import { useProjectStore } from '@/store';

// Step tread thickness (the horizontal part you step on)
const TREAD_THICKNESS = 0.04;

/**
 * Create geometry for a single step
 */
function createStepGeometry(
  stepIndex: number,
  treadDepth: number,
  riserHeight: number,
  width: number,
  totalSteps: number
): BufferGeometry {
  const halfWidth = width / 2;
  const stepStartX = stepIndex * treadDepth;
  const stepBottomZ = stepIndex * riserHeight;

  const shape = new Shape();
  const hasTread = stepIndex < totalSteps - 1;

  if (hasTread) {
    shape.moveTo(stepStartX, -halfWidth);
    shape.lineTo(stepStartX, halfWidth);
    shape.lineTo(stepStartX + treadDepth, halfWidth);
    shape.lineTo(stepStartX + treadDepth, -halfWidth);
    shape.closePath();

    const extrudeSettings = {
      steps: 1,
      depth: riserHeight + TREAD_THICKNESS,
      bevelEnabled: false,
    };

    const geo = new ExtrudeGeometry(shape, extrudeSettings);
    geo.translate(0, 0, stepBottomZ);
    return geo;
  } else {
    shape.moveTo(stepStartX, -halfWidth);
    shape.lineTo(stepStartX, halfWidth);
    shape.lineTo(stepStartX + TREAD_THICKNESS, halfWidth);
    shape.lineTo(stepStartX + TREAD_THICKNESS, -halfWidth);
    shape.closePath();

    const extrudeSettings = {
      steps: 1,
      depth: riserHeight,
      bevelEnabled: false,
    };

    const geo = new ExtrudeGeometry(shape, extrudeSettings);
    geo.translate(0, 0, stepBottomZ);
    return geo;
  }
}

/**
 * Create the complete stair geometry by merging all steps
 */
function createStairGeometry(
  stepCount: number,
  treadDepth: number,
  riserHeight: number,
  width: number
): BufferGeometry | null {
  if (stepCount < 1) return null;

  const stepGeometries: BufferGeometry[] = [];

  for (let i = 0; i < stepCount; i++) {
    const stepGeo = createStepGeometry(i, treadDepth, riserHeight, width, stepCount);
    stepGeometries.push(stepGeo);
  }

  const mergedGeometry = mergeGeometries(stepGeometries);
  stepGeometries.forEach((geo) => geo.dispose());

  return mergedGeometry;
}

/**
 * Preview component for stair placement
 * Shows the stair shape while placing with a direction indicator line
 */
export function StairPreview() {
  const {
    isPlacing,
    startPoint,
    previewEndPoint,
    rotation,
    params,
    previewSteps,
  } = useStairPlacement();

  const { activeStoreyId, storeys } = useProjectStore();
  const activeStorey = storeys.find((s) => s.id === activeStoreyId);
  const elevation = activeStorey?.elevation ?? 0;

  // Create preview geometry
  const geometry = useMemo(() => {
    if (!isPlacing || !startPoint) return null;
    return createStairGeometry(
      previewSteps.count,
      previewSteps.treadDepth,
      previewSteps.riserHeight,
      params.width
    );
  }, [isPlacing, startPoint, previewSteps, params.width]);

  // Preview material (semi-transparent green)
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

  // Direction indicator line points
  const linePoints = useMemo(() => {
    if (!startPoint || !previewEndPoint) return null;
    return [
      [startPoint.x, startPoint.y, elevation + 0.01] as [number, number, number],
      [previewEndPoint.x, previewEndPoint.y, elevation + 0.01] as [number, number, number],
    ];
  }, [startPoint, previewEndPoint, elevation]);

  if (!isPlacing || !startPoint || !geometry) return null;

  return (
    <group name="stair-preview">
      {/* Stair mesh preview */}
      <mesh
        geometry={geometry}
        material={material}
        position={[startPoint.x, startPoint.y, elevation]}
        rotation={new Euler(0, 0, rotation)}
        renderOrder={100}
      />

      {/* Direction indicator line */}
      {linePoints && (
        <Line
          points={linePoints}
          color="#2196f3"
          lineWidth={2}
          dashed
          dashSize={0.1}
          gapSize={0.05}
        />
      )}

      {/* Start point indicator */}
      <mesh position={[startPoint.x, startPoint.y, elevation + 0.02]}>
        <circleGeometry args={[0.1, 16]} />
        <meshBasicMaterial color="#4caf50" transparent opacity={0.8} />
      </mesh>

      {/* End point indicator */}
      {previewEndPoint && (
        <mesh position={[previewEndPoint.x, previewEndPoint.y, elevation + 0.02]}>
          <circleGeometry args={[0.08, 16]} />
          <meshBasicMaterial color="#2196f3" transparent opacity={0.8} />
        </mesh>
      )}
    </group>
  );
}
