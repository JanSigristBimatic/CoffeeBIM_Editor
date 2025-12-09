import { Canvas } from '@react-three/fiber';
import { OrbitControls, MapControls, GizmoHelper, GizmoViewport, Environment } from '@react-three/drei';
import { Suspense, useRef, useState, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
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
import { SpacePreview } from './SpacePreview';
import { StairPreview } from './StairPreview';
import { SnapIndicator } from './SnapIndicator';
import { PdfUnderlay } from './PdfUnderlay';
import { CameraController } from './CameraController';
import { MouseOrbitController } from './MouseOrbitController';
import { SelectionTransformGizmo } from './TransformGizmo';
import { useViewStore, useToolStore, useSelectionStore, useProjectStore } from '@/store';

// 2D Camera Setup Component - positions orthographic camera for top-down view
function Camera2D() {
  const { camera } = useThree();
  const { activeStoreyId, storeys } = useProjectStore();

  // Get storey elevation for camera position
  const activeStorey = storeys.find(s => s.id === activeStoreyId);
  const storeyElevation = activeStorey?.elevation ?? 0;

  useEffect(() => {
    // Position camera above the storey looking down
    const height = storeyElevation + 50; // 50m above storey
    camera.position.set(0, 0, height);
    camera.up.set(0, 1, 0); // Y is up in screen space for 2D
    camera.lookAt(0, 0, storeyElevation);
    camera.updateProjectionMatrix();
  }, [camera, storeyElevation]);

  return null;
}

export function Canvas3D() {
  const { showGrid, showAxes, viewMode } = useViewStore();
  const { activeTool } = useToolStore();
  const { clearSelection } = useSelectionStore();
  const controlsRef = useRef<OrbitControlsType>(null);
  const [isDragging, setIsDragging] = useState(false);

  const is2D = viewMode === '2d';

  // Disable orbit controls when placing elements or dragging
  const isPlacingElement = activeTool === 'wall' || activeTool === 'door' || activeTool === 'window' || activeTool === 'column' || activeTool === 'slab' || activeTool === 'counter' || activeTool === 'asset' || activeTool === 'space-detect' || activeTool === 'space-draw' || activeTool === 'stair' || activeTool === 'measure';
  const shouldDisableOrbit = isPlacingElement || isDragging;

  // Clear selection when clicking empty space (only in select mode)
  const handlePointerMissed = () => {
    if (activeTool === 'select') {
      clearSelection();
    }
  };

  return (
    <Canvas
      orthographic={is2D}
      camera={is2D ? {
        position: [0, 0, 50],
        zoom: 50,
        near: 0.1,
        far: 1000,
        up: [0, 1, 0], // Y-up for 2D screen coordinates
      } : {
        position: [10, 10, 10],
        fov: 50,
        near: 0.1,
        far: 1000,
        up: [0, 0, 1], // Z-up coordinate system (BIM/IFC standard)
      }}
      shadows={!is2D}
      onPointerMissed={handlePointerMissed}
    >
      <Suspense fallback={null}>
        {/* 2D Camera positioning */}
        {is2D && <Camera2D />}

        {/* Lighting - adjusted for view mode */}
        <ambientLight intensity={is2D ? 0.8 : 0.4} />
        {!is2D && (
          <>
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
          </>
        )}

        {/* Environment for better reflections (3D only) */}
        {!is2D && <Environment preset="city" background={false} />}

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

        {/* Space Preview during polygon drawing */}
        <SpacePreview />

        {/* Stair Preview during placement */}
        <StairPreview />

        {/* Snap indicator for endpoint snapping */}
        <SnapIndicator />

        {/* Ground plane for interactions and shadows */}
        <GroundPlane />

        {/* Transform gizmo for selected elements */}
        <SelectionTransformGizmo
          onDragStart={() => setIsDragging(true)}
          onDragEnd={() => setIsDragging(false)}
        />

        {/* Camera Controls - different for 2D/3D */}
        {is2D ? (
          <MapControls
            ref={controlsRef}
            makeDefault
            enableRotate={false}
            enableDamping
            dampingFactor={0.05}
            minZoom={5}
            maxZoom={500}
            screenSpacePanning
            enabled={!shouldDisableOrbit}
          />
        ) : (
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
        )}

        {/* Camera Controller for focus/zoom (3D only) */}
        {!is2D && <CameraController />}

        {/* Mouse-based orbit pivot (3D only) */}
        {!is2D && <MouseOrbitController />}

        {/* Orientation Gizmo (3D only) */}
        {!is2D && (
          <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
            <GizmoViewport axisColors={['#ff4444', '#44ff44', '#4444ff']} labelColor="white" />
          </GizmoHelper>
        )}
      </Suspense>
    </Canvas>
  );
}
