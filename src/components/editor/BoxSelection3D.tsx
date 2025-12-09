import { useCallback, useEffect, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { Box3, Vector3 } from 'three';
import { useSelectionStore, useToolStore, useElementStore, useProjectStore } from '@/store';
import type { BimElement } from '@/types/bim';

/**
 * 3D Box Selection Component
 * Renders an HTML overlay for box selection and performs frustum-based intersection
 */
export function BoxSelection3D() {
  const { camera, gl } = useThree();
  const {
    selectedIds,
    selectMultiple,
    addToSelection,
    startBoxSelect,
    updateBoxSelect,
    finishBoxSelect,
  } = useSelectionStore();
  const { activeTool } = useToolStore();
  const { getElementsByStorey } = useElementStore();
  const { activeStoreyId } = useProjectStore();

  const [screenStart, setScreenStart] = useState<{ x: number; y: number } | null>(null);
  const [screenCurrent, setScreenCurrent] = useState<{ x: number; y: number } | null>(null);
  const modifiersRef = useRef({ shift: false, ctrl: false });

  // Get element bounding box in world coordinates
  const getElementBoundingBox = useCallback((element: BimElement): Box3 | null => {
    const box = new Box3();

    if (element.type === 'wall' && element.wallData) {
      const { startPoint, endPoint, thickness, height } = element.wallData;
      const minX = Math.min(startPoint.x, endPoint.x) - thickness / 2;
      const maxX = Math.max(startPoint.x, endPoint.x) + thickness / 2;
      const minY = Math.min(startPoint.y, endPoint.y) - thickness / 2;
      const maxY = Math.max(startPoint.y, endPoint.y) + thickness / 2;
      box.set(new Vector3(minX, minY, 0), new Vector3(maxX, maxY, height));
      return box;
    }

    if (element.type === 'column' && element.columnData) {
      const { width, depth, height } = element.columnData;
      const pos = element.placement.position;
      box.set(
        new Vector3(pos.x - width / 2, pos.y - depth / 2, pos.z),
        new Vector3(pos.x + width / 2, pos.y + depth / 2, pos.z + height)
      );
      return box;
    }

    if (element.type === 'slab' && element.slabData) {
      const { outline, thickness } = element.slabData;
      if (outline.length === 0) return null;
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const pt of outline) {
        minX = Math.min(minX, pt.x);
        maxX = Math.max(maxX, pt.x);
        minY = Math.min(minY, pt.y);
        maxY = Math.max(maxY, pt.y);
      }
      const pos = element.placement.position;
      box.set(
        new Vector3(minX, minY, pos.z),
        new Vector3(maxX, maxY, pos.z + thickness)
      );
      return box;
    }

    if (element.type === 'space' && element.spaceData) {
      const { boundaryPolygon, netHeight } = element.spaceData;
      if (boundaryPolygon.length === 0) return null;
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const pt of boundaryPolygon) {
        minX = Math.min(minX, pt.x);
        maxX = Math.max(maxX, pt.x);
        minY = Math.min(minY, pt.y);
        maxY = Math.max(maxY, pt.y);
      }
      const height = netHeight ?? 3; // Default space height if not set
      box.set(new Vector3(minX, minY, 0), new Vector3(maxX, maxY, height));
      return box;
    }

    if (element.type === 'counter' && element.counterData) {
      const { path, depth, height } = element.counterData;
      if (path.length === 0) return null;
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const pt of path) {
        minX = Math.min(minX, pt.x - depth);
        maxX = Math.max(maxX, pt.x + depth);
        minY = Math.min(minY, pt.y - depth);
        maxY = Math.max(maxY, pt.y + depth);
      }
      box.set(new Vector3(minX, minY, 0), new Vector3(maxX, maxY, height));
      return box;
    }

    if (element.type === 'furniture') {
      const pos = element.placement.position;
      const size = 0.5; // Default furniture size estimate
      box.set(
        new Vector3(pos.x - size, pos.y - size, pos.z),
        new Vector3(pos.x + size, pos.y + size, pos.z + 1)
      );
      return box;
    }

    if (element.type === 'stair' && element.stairData) {
      const { width, totalRise, steps } = element.stairData;
      const pos = element.placement.position;
      const runLength = steps?.runLength ?? 3;
      box.set(
        new Vector3(pos.x, pos.y, pos.z),
        new Vector3(pos.x + width, pos.y + runLength, pos.z + totalRise)
      );
      return box;
    }

    return null;
  }, []);

  // Check if element is within screen rectangle (projected center test)
  const isElementInScreenRect = useCallback(
    (element: BimElement, x1: number, y1: number, x2: number, y2: number): boolean => {
      const box = getElementBoundingBox(element);
      if (!box) return false;

      // Get center of bounding box
      const center = new Vector3();
      box.getCenter(center);

      // Project center to screen
      const projected = center.clone().project(camera);
      const rect = gl.domElement.getBoundingClientRect();
      const screenX = ((projected.x + 1) / 2) * rect.width + rect.left;
      const screenY = ((-projected.y + 1) / 2) * rect.height + rect.top;

      // Check if projected center is within selection rectangle
      const minX = Math.min(x1, x2);
      const maxX = Math.max(x1, x2);
      const minY = Math.min(y1, y2);
      const maxY = Math.max(y1, y2);

      return screenX >= minX && screenX <= maxX && screenY >= minY && screenY <= maxY;
    },
    [camera, gl, getElementBoundingBox]
  );

  // Handle mouse down on canvas
  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      if (activeTool !== 'select') return;
      if (e.button !== 0) return; // Left click only

      setScreenStart({ x: e.clientX, y: e.clientY });
      setScreenCurrent({ x: e.clientX, y: e.clientY });
      modifiersRef.current = { shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey };
      startBoxSelect({ x: e.clientX, y: e.clientY });
    },
    [activeTool, startBoxSelect]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!screenStart || activeTool !== 'select') return;

      setScreenCurrent({ x: e.clientX, y: e.clientY });
      updateBoxSelect({ x: e.clientX, y: e.clientY });
    },
    [screenStart, activeTool, updateBoxSelect]
  );

  const handleMouseUp = useCallback(
    () => {
      if (!screenStart || !screenCurrent || activeTool !== 'select') {
        setScreenStart(null);
        setScreenCurrent(null);
        return;
      }

      const { shift, ctrl } = modifiersRef.current;

      // Check if it's a meaningful box (not just a click)
      const boxWidth = Math.abs(screenCurrent.x - screenStart.x);
      const boxHeight = Math.abs(screenCurrent.y - screenStart.y);

      if (boxWidth > 5 || boxHeight > 5) {
        // Get elements in current storey
        const elements = activeStoreyId ? getElementsByStorey(activeStoreyId) : [];

        // Find intersecting elements
        const intersectingIds: string[] = [];
        for (const element of elements) {
          if (isElementInScreenRect(element, screenStart.x, screenStart.y, screenCurrent.x, screenCurrent.y)) {
            intersectingIds.push(element.id);
          }
        }

        // Apply selection based on modifiers
        if (ctrl && intersectingIds.length > 0) {
          // Ctrl+Box: Remove from selection
          const currentIds = Array.from(selectedIds);
          const newIds = currentIds.filter((id) => !intersectingIds.includes(id));
          selectMultiple(newIds);
        } else if (shift && intersectingIds.length > 0) {
          // Shift+Box: Add to selection
          addToSelection(intersectingIds);
        } else if (intersectingIds.length > 0) {
          // Normal box: Replace selection
          selectMultiple(intersectingIds);
        }
        // Don't clear selection on empty box - that's handled by pointerMissed
      }

      finishBoxSelect();
      setScreenStart(null);
      setScreenCurrent(null);
    },
    [
      screenStart,
      screenCurrent,
      activeTool,
      activeStoreyId,
      getElementsByStorey,
      isElementInScreenRect,
      selectedIds,
      selectMultiple,
      addToSelection,
      finishBoxSelect,
    ]
  );

  // Attach event listeners to the canvas container
  useEffect(() => {
    const canvas = gl.domElement;

    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [gl, handleMouseDown, handleMouseMove, handleMouseUp]);

  return null; // This component doesn't render anything in Three.js scene
}

/**
 * HTML Overlay for box selection rectangle
 * Must be placed as sibling to Canvas3D, not inside it
 */
export function BoxSelectionOverlay() {
  const { boxSelect } = useSelectionStore();

  if (!boxSelect.isActive || !boxSelect.startPoint || !boxSelect.currentPoint) {
    return null;
  }

  const x = Math.min(boxSelect.startPoint.x, boxSelect.currentPoint.x);
  const y = Math.min(boxSelect.startPoint.y, boxSelect.currentPoint.y);
  const width = Math.abs(boxSelect.currentPoint.x - boxSelect.startPoint.x);
  const height = Math.abs(boxSelect.currentPoint.y - boxSelect.startPoint.y);

  return (
    <div
      className="absolute pointer-events-none border-2 border-dashed border-blue-500 bg-blue-500/10"
      style={{
        left: x,
        top: y,
        width,
        height,
      }}
    />
  );
}
