import { useMemo } from 'react';
import { useViewStore, useProjectStore } from '@/store';
import * as THREE from 'three';

export function Grid() {
  const { gridSize } = useViewStore();
  const { activeStoreyId, storeys } = useProjectStore();

  // Get storey elevation for grid position
  const activeStorey = storeys.find(s => s.id === activeStoreyId);
  const storeyElevation = activeStorey?.elevation ?? 0;

  // Create grid lines in XY plane (Z-up coordinate system)
  const gridLines = useMemo(() => {
    const size = 50; // Half-size of grid
    const divisions = Math.floor((size * 2) / gridSize);
    const majorDivisions = 10; // Major line every 10 cells

    const vertices: number[] = [];
    const colors: number[] = [];

    const minorColor = new THREE.Color('#6e6e6e');
    const majorColor = new THREE.Color('#9d4b4b');

    // Grid lines parallel to X axis (varying Y)
    for (let i = -divisions / 2; i <= divisions / 2; i++) {
      const y = i * gridSize;
      const isMajor = i % majorDivisions === 0;
      const color = isMajor ? majorColor : minorColor;

      vertices.push(-size, y, 0, size, y, 0);
      colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
    }

    // Grid lines parallel to Y axis (varying X)
    for (let i = -divisions / 2; i <= divisions / 2; i++) {
      const x = i * gridSize;
      const isMajor = i % majorDivisions === 0;
      const color = isMajor ? majorColor : minorColor;

      vertices.push(x, -size, 0, x, size, 0);
      colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
    }

    return { vertices: new Float32Array(vertices), colors: new Float32Array(colors) };
  }, [gridSize]);

  return (
    <group position={[0, 0, storeyElevation]}>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            array={gridLines.vertices}
            count={gridLines.vertices.length / 3}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            array={gridLines.colors}
            count={gridLines.colors.length / 3}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial vertexColors transparent opacity={0.5} />
      </lineSegments>
    </group>
  );
}
