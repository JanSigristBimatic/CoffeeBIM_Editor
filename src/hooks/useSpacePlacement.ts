import { useCallback, useEffect } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import { useToolStore, useProjectStore, useElementStore } from '@/store';
import { useSnap, SNAP_TOLERANCE } from './useSnap';
import { useDistanceInput } from './useDistanceInput';
import { detectSpaceAtPoint } from '@/bim/spaces';
import { createSpace, createSpaceFromPolygon } from '@/bim/elements';
import { distance2D } from '@/lib/geometry/math';
import type { Point2D } from '@/types/geometry';

/** Distance to first point to auto-close polygon */
const CLOSE_DISTANCE = SNAP_TOLERANCE;

/**
 * Hook for handling space (room) placement interactions
 *
 * Two modes:
 * - space-detect: Click inside a closed wall area to detect and create a space
 * - space-draw: Draw a polygon manually to create a space
 */
export function useSpacePlacement() {
  const {
    activeTool,
    spacePlacement,
    addSpacePoint,
    setSpacePreviewPoint,
    resetSpacePlacement,
    setCursorPosition,
  } = useToolStore();
  const { activeStoreyId, storeys } = useProjectStore();
  const { getElementsByType, addElement } = useElementStore();
  const { snapFromEvent } = useSnap();

  // Get current storey info
  const activeStorey = storeys.find((s) => s.id === activeStoreyId);
  const storeyElevation = activeStorey?.elevation ?? 0;
  const storeyHeight = activeStorey?.height ?? 3.0;

  // Use distance input hook for polygon drawing mode
  const {
    isActive: isDistanceInputActive,
    inputValue: distanceInputValue,
    initializeDistanceInput,
    updateDirection,
    handleKeyDown: handleDistanceKeyDown,
    clearDistanceInput,
    getDistanceTargetPoint,
  } = useDistanceInput();

  /**
   * Check if a point is close to the first point (for closing the polygon in draw mode)
   */
  const isCloseToStart = useCallback(
    (point: Point2D): boolean => {
      if (spacePlacement.points.length < 3) return false;
      const firstPoint = spacePlacement.points[0];
      if (!firstPoint) return false;
      return distance2D(point, firstPoint) < CLOSE_DISTANCE;
    },
    [spacePlacement.points]
  );

  /**
   * Handle space detection mode - click to detect space at point
   */
  const handleDetectClick = useCallback(
    (point: Point2D) => {
      if (!activeStoreyId) {
        console.warn('No active storey selected');
        return;
      }

      // Get walls for current storey
      const allWalls = getElementsByType('wall');
      const storeyWalls = allWalls.filter((w) => w.parentId === activeStoreyId);

      if (storeyWalls.length < 3) {
        alert('Mindestens 3 Wände benötigt, um einen Raum zu erkennen.');
        return;
      }

      // Detect space at clicked point
      const detectedSpace = detectSpaceAtPoint(point, storeyWalls);

      if (!detectedSpace) {
        alert('Kein geschlossener Raum an dieser Position gefunden.');
        return;
      }

      // Check if a space already exists with the same bounding walls
      const existingSpaces = getElementsByType('space');
      const sameWallsSpace = existingSpaces.find((s) => {
        if (!s.spaceData) return false;
        const existingWallIds = new Set(s.spaceData.boundingWallIds);
        const newWallIds = new Set(detectedSpace.boundingWallIds);
        if (existingWallIds.size !== newWallIds.size) return false;
        for (const id of existingWallIds) {
          if (!newWallIds.has(id)) return false;
        }
        return true;
      });

      if (sameWallsSpace) {
        alert('Dieser Raum existiert bereits.');
        return;
      }

      // Create the space element
      const spaceElement = createSpace({
        detectedSpace,
        storeyId: activeStoreyId,
        elevation: storeyElevation,
        height: storeyHeight,
      });

      addElement(spaceElement);
    },
    [activeStoreyId, storeyElevation, storeyHeight, getElementsByType, addElement]
  );

  /**
   * Complete manual polygon drawing and create space
   */
  const completePolygon = useCallback(() => {
    if (!activeStoreyId) {
      console.warn('No active storey selected');
      resetSpacePlacement();
      return;
    }

    const points = [...spacePlacement.points];

    if (points.length < 3) {
      console.warn('Need at least 3 points for a space');
      resetSpacePlacement();
      return;
    }

    // Get nearby walls (optional - for reference)
    const allWalls = getElementsByType('wall');
    const storeyWalls = allWalls.filter((w) => w.parentId === activeStoreyId);

    // Find walls that are close to the polygon boundary
    const boundingWallIds: string[] = [];
    for (const wall of storeyWalls) {
      if (!wall.wallData) continue;
      // Simple check: if wall endpoints are near any polygon point
      const { startPoint, endPoint } = wall.wallData;
      for (const p of points) {
        if (distance2D(startPoint, p) < 0.5 || distance2D(endPoint, p) < 0.5) {
          boundingWallIds.push(wall.id);
          break;
        }
      }
    }

    // Create the space element from polygon
    const spaceElement = createSpaceFromPolygon({
      boundaryPolygon: points,
      boundingWallIds,
      storeyId: activeStoreyId,
      elevation: storeyElevation,
      height: storeyHeight,
    });

    addElement(spaceElement);
    resetSpacePlacement();
  }, [
    activeStoreyId,
    storeyElevation,
    storeyHeight,
    spacePlacement.points,
    getElementsByType,
    addElement,
    resetSpacePlacement,
  ]);

  /**
   * Add a point to the space polygon (draw mode)
   */
  const addPoint = useCallback(
    (point: Point2D) => {
      addSpacePoint(point);
      // Initialize distance input with the new point as reference
      initializeDistanceInput(point);
    },
    [addSpacePoint, initializeDistanceInput]
  );

  /**
   * Handle pointer down - different behavior per mode
   */
  const handlePointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (activeTool !== 'space-detect' && activeTool !== 'space-draw') return;
      if (event.button !== 0) return;

      event.stopPropagation();

      // Get clicked point
      const lastPoint = spacePlacement.points[spacePlacement.points.length - 1];

      let point: Point2D;
      if (activeTool === 'space-draw' && isDistanceInputActive && lastPoint) {
        const targetPoint = getDistanceTargetPoint();
        if (targetPoint) {
          point = targetPoint;
        } else {
          const result = snapFromEvent(event, lastPoint);
          point = result.point;
        }
      } else {
        const result = snapFromEvent(event, lastPoint);
        point = result.point;
      }

      // Mode-specific handling
      if (activeTool === 'space-detect') {
        // Single click to detect space
        handleDetectClick(point);
      } else if (activeTool === 'space-draw') {
        // Check if we should close the polygon
        if (isCloseToStart(point)) {
          clearDistanceInput();
          completePolygon();
          return;
        }

        // Add point to polygon
        clearDistanceInput();
        addPoint(point);
      }
    },
    [
      activeTool,
      spacePlacement.points,
      isDistanceInputActive,
      snapFromEvent,
      handleDetectClick,
      isCloseToStart,
      completePolygon,
      addPoint,
      clearDistanceInput,
      getDistanceTargetPoint,
    ]
  );

  /**
   * Handle double click - finish polygon (draw mode only)
   */
  const handleDoubleClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      if (activeTool !== 'space-draw') return;
      if (spacePlacement.points.length < 3) return;

      event.stopPropagation();
      completePolygon();
    },
    [activeTool, spacePlacement.points.length, completePolygon]
  );

  /**
   * Handle pointer move - update preview
   */
  const handlePointerMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (activeTool !== 'space-detect' && activeTool !== 'space-draw') return;

      // Always update cursor position for snap indicator
      const cursorResult = snapFromEvent(event);
      setCursorPosition(cursorResult.point);

      // Only update preview for draw mode
      if (activeTool === 'space-draw' && spacePlacement.points.length > 0) {
        const lastPoint = spacePlacement.points[spacePlacement.points.length - 1];
        const result = snapFromEvent(event, lastPoint);

        // Update direction for distance input
        if (lastPoint) {
          updateDirection(lastPoint, result.point);
        }

        // If distance input is active, use the calculated target point for preview
        if (isDistanceInputActive) {
          const targetPoint = getDistanceTargetPoint();
          if (targetPoint) {
            setSpacePreviewPoint(targetPoint);
            return;
          }
        }

        setSpacePreviewPoint(result.point);
      }
    },
    [
      activeTool,
      spacePlacement.points,
      isDistanceInputActive,
      snapFromEvent,
      setSpacePreviewPoint,
      setCursorPosition,
      updateDirection,
      getDistanceTargetPoint,
    ]
  );

  /**
   * Cancel current placement
   */
  const cancelPlacement = useCallback(() => {
    resetSpacePlacement();
    clearDistanceInput();
  }, [resetSpacePlacement, clearDistanceInput]);

  /**
   * Handle keyboard events for distance input (draw mode)
   */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (activeTool !== 'space-draw') return;
      if (spacePlacement.points.length === 0) return;

      const result = handleDistanceKeyDown(e);

      // If Enter was pressed and confirmed, add the point
      if (result.confirmed) {
        const targetPoint = getDistanceTargetPoint();
        if (targetPoint) {
          // Check if we should close the polygon
          if (isCloseToStart(targetPoint)) {
            clearDistanceInput();
            completePolygon();
          } else {
            clearDistanceInput();
            addPoint(targetPoint);
          }
        }
      }
    },
    [
      activeTool,
      spacePlacement.points.length,
      handleDistanceKeyDown,
      getDistanceTargetPoint,
      isCloseToStart,
      completePolygon,
      addPoint,
      clearDistanceInput,
    ]
  );

  // Register keyboard event listener for distance input
  useEffect(() => {
    if (activeTool !== 'space-draw') return;

    const onKeyDown = (e: KeyboardEvent) => {
      // Don't handle if typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      handleKeyDown(e);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeTool, handleKeyDown]);

  return {
    handlePointerDown,
    handlePointerMove,
    handleDoubleClick,
    cancelPlacement,
    isDrawing: spacePlacement.isDrawing,
    points: spacePlacement.points,
    previewPoint: spacePlacement.previewPoint,
    pointCount: spacePlacement.points.length,
    // Distance input state (for draw mode)
    isDistanceInputActive,
    distanceInputValue,
    // Mode info
    isDetectMode: activeTool === 'space-detect',
    isDrawMode: activeTool === 'space-draw',
  };
}
