import { useWallPlacement } from '@/hooks/useWallPlacement';
import { useSlabPlacement } from '@/hooks/useSlabPlacement';
import { useDoorPlacement } from '@/hooks/useDoorPlacement';
import { useWindowPlacement } from '@/hooks/useWindowPlacement';
import { useToolStore } from '@/store';
import type { ThreeEvent } from '@react-three/fiber';

/**
 * Invisible ground plane that captures pointer events for element placement
 */
export function GroundPlane() {
  const { activeTool } = useToolStore();
  const wallPlacement = useWallPlacement();
  const slabPlacement = useSlabPlacement();
  const doorPlacement = useDoorPlacement();
  const windowPlacement = useWindowPlacement();

  // Only show interactive plane when placing elements
  const isPlacing =
    activeTool === 'wall' ||
    activeTool === 'door' ||
    activeTool === 'window' ||
    activeTool === 'column' ||
    activeTool === 'slab';

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
    }
  };

  const handleDoubleClick = (event: ThreeEvent<MouseEvent>) => {
    if (activeTool === 'slab') {
      slabPlacement.handleDoubleClick(event);
    }
  };

  const handlePointerLeave = () => {
    if (activeTool === 'door') {
      doorPlacement.handlePointerLeave();
    } else if (activeTool === 'window') {
      windowPlacement.handlePointerLeave();
    }
  };

  return (
    <group>
      {/* Shadow receiving plane - always visible */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, 0]}
        receiveShadow
      >
        <planeGeometry args={[100, 100]} />
        <shadowMaterial transparent opacity={0.2} />
      </mesh>

      {/* Interactive plane for element placement */}
      {isPlacing && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0, 0]}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
          onDoubleClick={handleDoubleClick}
        >
          <planeGeometry args={[100, 100]} />
          <meshBasicMaterial visible={false} />
        </mesh>
      )}
    </group>
  );
}
