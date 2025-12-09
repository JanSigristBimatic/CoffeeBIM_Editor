import { useWallPlacement } from '@/hooks/useWallPlacement';
import { useSlabPlacement } from '@/hooks/useSlabPlacement';
import { useDoorPlacement } from '@/hooks/useDoorPlacement';
import { useWindowPlacement } from '@/hooks/useWindowPlacement';
import { useColumnPlacement } from '@/hooks/useColumnPlacement';
import { useCounterPlacement } from '@/hooks/useCounterPlacement';
import { useAssetPlacement } from '@/hooks/useAssetPlacement';
import { useSpacePlacement } from '@/hooks/useSpacePlacement';
import { useStairPlacement } from '@/hooks/useStairPlacement';
import { useMeasurement } from '@/hooks/useMeasurement';
import { useToolStore, useProjectStore } from '@/store';
import type { ThreeEvent } from '@react-three/fiber';

/**
 * Invisible ground plane that captures pointer events for element placement
 */
export function GroundPlane() {
  const { activeTool } = useToolStore();
  const { activeStoreyId, storeys } = useProjectStore();
  const wallPlacement = useWallPlacement();
  const slabPlacement = useSlabPlacement();
  const doorPlacement = useDoorPlacement();
  const windowPlacement = useWindowPlacement();
  const columnPlacement = useColumnPlacement();
  const counterPlacement = useCounterPlacement();
  const assetPlacement = useAssetPlacement();
  const spacePlacement = useSpacePlacement();
  const stairPlacement = useStairPlacement();
  const measurePlacement = useMeasurement();

  // Get storey elevation for plane position
  const activeStorey = storeys.find(s => s.id === activeStoreyId);
  const storeyElevation = activeStorey?.elevation ?? 0;

  // Only show interactive plane when placing elements
  const isPlacing =
    activeTool === 'wall' ||
    activeTool === 'door' ||
    activeTool === 'window' ||
    activeTool === 'column' ||
    activeTool === 'slab' ||
    activeTool === 'counter' ||
    activeTool === 'asset' ||
    activeTool === 'space-detect' ||
    activeTool === 'space-draw' ||
    activeTool === 'stair' ||
    activeTool === 'measure';

  // Route events based on active tool
  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (activeTool === 'wall') {
      wallPlacement.handlePointerDown(event);
    } else if (activeTool === 'slab') {
      slabPlacement.handlePointerDown(event);
    } else if (activeTool === 'door') {
      doorPlacement.handlePointerDown(event);
    } else if (activeTool === 'window') {
      windowPlacement.handlePointerDown(event);
    } else if (activeTool === 'column') {
      columnPlacement.handlePointerDown(event);
    } else if (activeTool === 'counter') {
      counterPlacement.handlePointerDown(event);
    } else if (activeTool === 'asset') {
      assetPlacement.handlePointerDown(event);
    } else if (activeTool === 'space-detect' || activeTool === 'space-draw') {
      spacePlacement.handlePointerDown(event);
    } else if (activeTool === 'stair') {
      stairPlacement.handlePointerDown(event);
    } else if (activeTool === 'measure') {
      measurePlacement.handlePointerDown(event);
    }
  };

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    if (activeTool === 'wall') {
      wallPlacement.handlePointerMove(event);
    } else if (activeTool === 'slab') {
      slabPlacement.handlePointerMove(event);
    } else if (activeTool === 'door') {
      doorPlacement.handlePointerMove(event);
    } else if (activeTool === 'window') {
      windowPlacement.handlePointerMove(event);
    } else if (activeTool === 'column') {
      columnPlacement.handlePointerMove(event);
    } else if (activeTool === 'counter') {
      counterPlacement.handlePointerMove(event);
    } else if (activeTool === 'asset') {
      assetPlacement.handlePointerMove(event);
    } else if (activeTool === 'space-draw') {
      spacePlacement.handlePointerMove(event);
    } else if (activeTool === 'stair') {
      stairPlacement.handlePointerMove(event);
    } else if (activeTool === 'measure') {
      measurePlacement.handlePointerMove(event);
    }
  };

  const handleDoubleClick = (event: ThreeEvent<MouseEvent>) => {
    if (activeTool === 'slab') {
      slabPlacement.handleDoubleClick(event);
    } else if (activeTool === 'space-draw') {
      spacePlacement.handleDoubleClick(event);
    }
  };

  const handleContextMenu = (event: ThreeEvent<MouseEvent>) => {
    if (activeTool === 'counter') {
      counterPlacement.handleContextMenu(event);
    } else if (activeTool === 'measure') {
      measurePlacement.handleContextMenu(event);
    }
  };

  const handlePointerLeave = () => {
    if (activeTool === 'door') {
      doorPlacement.handlePointerLeave();
    } else if (activeTool === 'window') {
      windowPlacement.handlePointerLeave();
    } else if (activeTool === 'column') {
      columnPlacement.handlePointerLeave();
    } else if (activeTool === 'asset') {
      assetPlacement.handlePointerLeave();
    }
  };

  return (
    <group>
      {/* Shadow receiving plane - always visible (Z-up: XY plane is horizontal) */}
      <mesh
        rotation={[0, 0, 0]}
        position={[0, 0, storeyElevation - 0.01]}
        receiveShadow
      >
        <planeGeometry args={[100, 100]} />
        <shadowMaterial transparent opacity={0.2} />
      </mesh>

      {/* Interactive plane for element placement (Z-up: XY plane) */}
      {isPlacing && (
        <mesh
          rotation={[0, 0, 0]}
          position={[0, 0, storeyElevation]}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
          onDoubleClick={handleDoubleClick}
          onContextMenu={handleContextMenu}
        >
          <planeGeometry args={[100, 100]} />
          <meshBasicMaterial visible={false} />
        </mesh>
      )}
    </group>
  );
}
