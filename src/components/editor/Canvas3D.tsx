import { Canvas } from '@react-three/fiber';
import { OrbitControls, GizmoHelper, GizmoViewport, Environment } from '@react-three/drei';
import { Suspense, useRef } from 'react';
import type { OrbitControls as OrbitControlsType } from 'three-stdlib';
import { Grid } from './Grid';
import { SceneElements } from './SceneElements';
import { GroundPlane } from './GroundPlane';
import { WallPreview } from './WallPreview';
import { SlabPreview } from './SlabPreview';
import { DoorPreview } from './DoorPreview';
import { WindowPreview } from './WindowPreview';
import { SnapIndicator } from './SnapIndicator';
import { PdfUnderlay } from './PdfUnderlay';
import { useViewStore, useToolStore } from '@/store';

export function Canvas3D() {
  const { showGrid, showAxes } = useViewStore();
  const { activeTool } = useToolStore();
  const controlsRef = useRef<OrbitControlsType>(null);

  // Disable orbit controls when placing elements
  const isPlacingElement = activeTool === 'wall' || activeTool === 'door' || activeTool === 'window' || activeTool === 'column' || activeTool === 'slab';

  return (
    <Canvas
      camera={{
        position: [10, 10, 10],
        fov: 50,
        near: 0.1,
        far: 1000,
      }}
      shadows
      onPointerMissed={() => {
        // Deselect when clicking empty space
        // Will be implemented with selection store
      }}
    >
      <Suspense fallback={null}>
        {/* Lighting */}
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[10, 20, 10]}
          intensity={1}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-far={50}
          shadow-camera-left={-20}
          shadow-camera-right={20}
          shadow-camera-top={20}
          shadow-camera-bottom={-20}
        />
        <directionalLight position={[-10, 10, -10]} intensity={0.3} />

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

        {/* Snap indicator for endpoint snapping */}
        <SnapIndicator />

        {/* Ground plane for interactions and shadows */}
        <GroundPlane />

        {/* Camera Controls */}
        <OrbitControls
          ref={controlsRef}
          makeDefault
          minPolarAngle={0}
          maxPolarAngle={Math.PI / 2.1}
          enableDamping
          dampingFactor={0.05}
          minDistance={1}
          maxDistance={100}
          enabled={!isPlacingElement}
        />

        {/* Orientation Gizmo */}
        <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
          <GizmoViewport axisColors={['#ff4444', '#44ff44', '#4444ff']} labelColor="white" />
        </GizmoHelper>
      </Suspense>
    </Canvas>
  );
}
