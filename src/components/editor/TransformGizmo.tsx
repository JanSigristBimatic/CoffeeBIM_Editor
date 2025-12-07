import { useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { Plane, Raycaster, Vector2, Vector3 } from 'three';
import { useSelectionStore, useElementStore, useToolStore } from '@/store';
import type { BimElement } from '@/types/bim';
import type { ThreeEvent } from '@react-three/fiber';

interface SelectionTransformGizmoProps {
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

// This component is now deprecated - drag functionality is handled directly in useDragElement hook
export function SelectionTransformGizmo({ onDragStart, onDragEnd }: SelectionTransformGizmoProps) {
  // Keep props to avoid breaking existing code, but don't render anything
  void onDragStart;
  void onDragEnd;
  return null;
}

/**
 * Hook to enable drag-and-drop movement for BIM elements.
 * Use this hook in mesh components to allow dragging selected elements.
 */
export function useDragElement(element: BimElement) {
  const { updateElement } = useElementStore();
  const { isSelected, select } = useSelectionStore();
  const { activeTool } = useToolStore();
  const { camera, gl, controls } = useThree();

  const isDraggingRef = useRef(false);
  const dragStartPointRef = useRef<Vector3 | null>(null);
  const elementStartDataRef = useRef<BimElement | null>(null);

  const selected = isSelected(element.id);
  const canDrag = activeTool === 'select' && selected;

  // Ground plane for raycasting (Z = 0, Z-up coordinate system)
  const groundPlane = useRef(new Plane(new Vector3(0, 0, 1), 0)).current;
  const raycaster = useRef(new Raycaster()).current;

  // Helper to disable/enable orbit controls
  const setOrbitControlsEnabled = (enabled: boolean) => {
    if (controls && 'enabled' in controls) {
      (controls as { enabled: boolean }).enabled = enabled;
    }
  };

  const getWorldPoint = (event: ThreeEvent<PointerEvent>): Vector3 | null => {
    const rect = gl.domElement.getBoundingClientRect();
    const mouse = new Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(mouse, camera);
    const intersection = new Vector3();
    const hit = raycaster.ray.intersectPlane(groundPlane, intersection);
    return hit ? intersection : null;
  };

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    // Only handle left click
    if (event.button !== 0) return;

    // In select mode, first select the element
    if (activeTool === 'select') {
      event.stopPropagation();

      // If not selected, just select it
      if (!selected) {
        select(element.id);
        return;
      }

      // Already selected - start dragging
      const worldPoint = getWorldPoint(event);
      if (!worldPoint) return;

      isDraggingRef.current = true;
      dragStartPointRef.current = worldPoint.clone();
      elementStartDataRef.current = JSON.parse(JSON.stringify(element)); // Deep clone

      // Disable OrbitControls during drag
      setOrbitControlsEnabled(false);

      gl.domElement.style.cursor = 'grabbing';
      event.stopPropagation();

      // Capture pointer for drag
      (event.target as HTMLElement)?.setPointerCapture?.(event.pointerId);
    }
  };

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    if (!isDraggingRef.current || !dragStartPointRef.current || !elementStartDataRef.current) return;

    const worldPoint = getWorldPoint(event);
    if (!worldPoint) return;

    // Calculate delta (Z-up: XY is ground plane)
    const dx = worldPoint.x - dragStartPointRef.current.x;
    const dy = worldPoint.y - dragStartPointRef.current.y;

    // Apply movement based on element type
    const el = elementStartDataRef.current;

    if (el.type === 'wall' && el.wallData) {
      updateElement(el.id, {
        wallData: {
          ...element.wallData!,
          startPoint: {
            x: el.wallData.startPoint.x + dx,
            y: el.wallData.startPoint.y + dy,
          },
          endPoint: {
            x: el.wallData.endPoint.x + dx,
            y: el.wallData.endPoint.y + dy,
          },
        },
      });
    } else if (el.type === 'column') {
      updateElement(el.id, {
        placement: {
          ...element.placement,
          position: {
            x: el.placement.position.x + dx,
            y: el.placement.position.y + dy,
            z: el.placement.position.z,
          },
        },
      });
    } else if (el.type === 'furniture') {
      updateElement(el.id, {
        placement: {
          ...element.placement,
          position: {
            x: el.placement.position.x + dx,
            y: el.placement.position.y + dy,
            z: el.placement.position.z,
          },
        },
      });
    } else if (el.type === 'slab' && el.slabData) {
      const newOutline = el.slabData.outline.map((pt) => ({
        x: pt.x + dx,
        y: pt.y + dy,
      }));
      updateElement(el.id, {
        slabData: {
          ...element.slabData!,
          outline: newOutline,
        },
      });
    } else if (el.type === 'counter' && el.counterData) {
      const newPath = el.counterData.path.map((pt) => ({
        x: pt.x + dx,
        y: pt.y + dy,
      }));
      updateElement(el.id, {
        counterData: {
          ...element.counterData!,
          path: newPath,
        },
      });
    }

    event.stopPropagation();
  };

  const handlePointerUp = (event: ThreeEvent<PointerEvent>) => {
    if (!isDraggingRef.current) return;

    isDraggingRef.current = false;
    dragStartPointRef.current = null;
    elementStartDataRef.current = null;

    // Re-enable OrbitControls after drag
    setOrbitControlsEnabled(true);

    gl.domElement.style.cursor = 'auto';

    // Release pointer capture
    (event.target as HTMLElement)?.releasePointerCapture?.(event.pointerId);
  };

  return {
    selected,
    canDrag,
    isDragging: isDraggingRef.current,
    handlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
    },
  };
}
