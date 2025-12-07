import { Canvas } from '@react-three/fiber';
import { OrbitControls, GizmoHelper, GizmoViewport, Environment } from '@react-three/drei';
import { Suspense, useRef, useState } from 'react';
import type { OrbitControls as OrbitControlsType } from 'three-stdlib';
import { Grid } from './Grid';
import { SceneElements } from './SceneElements';
import { GroundPlane } from './GroundPlane';
import { WallPreview } from './WallPreview';
import { SlabPreview } from './SlabPreview';
import { DoorPreview } from './DoorPreview';
import { WindowPreview } from './WindowPreview';
import { ColumnPreview } from './ColumnPreview';
import { CounterPreview } from './CounterPreview';
import { AssetPreviewWrapper } from './AssetPreviewWrapper';
import { SnapIndicator } from './SnapIndicator';
import { PdfUnderlay } from './PdfUnderlay';
import { CameraController } from './CameraController';
import { SelectionTransformGizmo } from './TransformGizmo';
import { useViewStore, useToolStore, useSelectionStore } from '@/store';

export function Canvas3D() {
  const { showGrid, showAxes } = useViewStore();
  const { activeTool } = useToolStore();
  const { clearSelection } = useSelectionStore();
  const controlsRef = useRef<OrbitControlsType>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Disable orbit controls when placing elements or dragging
  const isPlacingElement = activeTool === 'wall' || activeTool === 'door' || activeTool === 'window' || activeTool === 'column' || activeTool === 'slab' || activeTool === 'counter' || activeTool === 'asset';
  const shouldDisableOrbit = isPlacingElement || isDragging;

  // Clear selection when clicking empty space (only in select mode)
  const handlePointerMissed = () => {
    if (activeTool === 'select') {
      clearSelection();
    }
  };

  return (
    <Canvas
      camera={{
        position: [10, 10, 10],
        fov: 50,
        near: 0.1,
        far: 1000,
        up: [0, 0, 1], // Z-up coordinate system (BIM/IFC standard)
      }}
      shadows
      onPointerMissed={handlePointerMissed}
    >
      <Suspense fallback={null}>
        {/* Lighting - Z-up: sun from above-front */}
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[10, 10, 20]}
          intensity={1}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-far={50}
          shadow-camera-left={-20}
          shadow-camera-right={20}
          shadow-camera-top={20}
          shadow-camera-bottom={-20}
        />
        <directionalLight position={[-10, -10, 10]} intensity={0.3} />

        {/* Environment for better reflections */}
        <Environment preset="city" background={false} />

        {/* Grid */}
        {showGrid && <Grid />}

        {/* Axes Helper */}
        {showAxes && <axesHelper args={[5]} />}

        {/* PDF Underlay (below everything) */}
        <PdfUnderlay />

        {/* BIM Elements */}
        <SceneElements />

        {/* Wall Preview during placement */}
        <WallPreview />

        {/* Slab Preview during polygon drawing */}
        <SlabPreview />

        {/* Door Preview during placement */}
        <DoorPreview />

        {/* Window Preview during placement */}
        <WindowPreview />

        {/* Column Preview during placement */}
        <ColumnPreview />

        {/* Counter Preview during placement */}
        <CounterPreview />

        {/* Asset Preview during placement */}
        <AssetPreviewWrapper />

        {/* Snap indicator for endpoint snapping */}
        <SnapIndicator />

        {/* Ground plane for interactions and shadows */}
        <GroundPlane />

        {/* Transform gizmo for selected elements */}
        <SelectionTransformGizmo
          onDragStart={() => setIsDragging(true)}
          onDragEnd={() => setIsDragging(false)}
        />

        {/* Camera Controls - Z-up */}
        <OrbitControls
          ref={controlsRef}
          makeDefault
          minPolarAngle={0}
          maxPolarAngle={Math.PI / 2.1}
          enableDamping
          dampingFactor={0.05}
          minDistance={1}
          maxDistance={100}
          enabled={!shouldDisableOrbit}
        />

        {/* Camera Controller for focus/zoom */}
        <CameraController />

        {/* Orientation Gizmo */}
        <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
          <GizmoViewport axisColors={['#ff4444', '#44ff44', '#4444ff']} labelColor="white" />
        </GizmoHelper>
      </Suspense>
    </Canvas>
  );
}
