import { useCallback, useMemo } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import { useToolStore, useProjectStore, useElementStore } from '@/store';
import {
  createWindow,
  createOpeningFromWindow,
  calculateWindowDistances,
} from '@/bim/elements/Window';
import { getPositionOnWall, calculateWallLength } from '@/bim/elements/Wall';
import type { BimElement } from '@/types/bim';
import type { Point2D } from '@/types/geometry';

// Minimum distance from wall edges (in normalized 0-1 position)
const MIN_EDGE_DISTANCE_RATIO = 0.02;
// Minimum absolute distance from wall edges (in meters)
const MIN_EDGE_DISTANCE_METERS = 0.05;

/**
 * Hook for handling window placement on walls
 * Click on a wall to place a window, with preview on hover
 */
export function useWindowPlacement() {
  const { activeTool, windowPlacement, setWindowPreview, resetWindowPlacement } = useToolStore();
  const { addElement, updateElement, getWallsForStorey, elements } = useElementStore();
  const { activeStoreyId } = useProjectStore();

  const { params } = windowPlacement;

  // Get all walls in current storey
  // We subscribe to `elements` to trigger re-renders when elements change
  const walls = useMemo(() => {
    if (!activeStoreyId) return [];
    return getWallsForStorey(activeStoreyId);
  }, [elements, activeStoreyId, getWallsForStorey]);

  /**
   * Find which wall was clicked and where along it
   */
  const findWallAtPoint = useCallback(
    (point: Point2D): { wall: BimElement; position: number } | null => {
      for (const wall of walls) {
        const position = getPositionOnWall(wall, point, 0.5);
        if (position !== null) {
          return { wall, position };
        }
      }
      return null;
    },
    [walls]
  );

  /**
   * Check if window can be placed at this position (not overlapping existing openings)
   */
  const canPlaceWindow = useCallback(
    (wall: BimElement, position: number, windowWidth: number): boolean => {
      if (!wall.wallData) return false;

      const wallLength = calculateWallLength(wall);
      const halfWindowWidth = windowWidth / 2;
      const windowStartNorm = position - halfWindowWidth / wallLength;
      const windowEndNorm = position + halfWindowWidth / wallLength;

      // Calculate actual distances
      const { distanceFromLeft, distanceFromRight } = calculateWindowDistances(
        position,
        windowWidth,
        wallLength
      );

      // Check bounds - both normalized and absolute
      if (
        windowStartNorm < MIN_EDGE_DISTANCE_RATIO ||
        windowEndNorm > 1 - MIN_EDGE_DISTANCE_RATIO ||
        distanceFromLeft < MIN_EDGE_DISTANCE_METERS ||
        distanceFromRight < MIN_EDGE_DISTANCE_METERS
      ) {
        return false; // Too close to wall ends
      }

      // Check for overlapping openings
      for (const opening of wall.wallData.openings) {
        const openingHalfWidth = opening.width / 2 / wallLength;
        const openingStart = opening.position - openingHalfWidth;
        const openingEnd = opening.position + openingHalfWidth;

        // Check for overlap (with small buffer)
        const buffer = 0.02; // 2cm buffer between openings
        if (windowStartNorm < openingEnd + buffer / wallLength && windowEndNorm > openingStart - buffer / wallLength) {
          return false; // Overlaps with existing opening
        }
      }

      return true;
    },
    []
  );

  /**
   * Handle click to place window
   */
  const handlePointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (activeTool !== 'window') return;
      if (event.button !== 0) return;

      event.stopPropagation();

      // Get click position in world coordinates
      const point: Point2D = {
        x: event.point.x,
        y: event.point.z, // 3D z maps to 2D y
      };

      // Find wall at this point
      const result = findWallAtPoint(point);
      if (!result) {
        console.log('No wall found at click position');
        return;
      }

      const { wall, position } = result;
      const wallLength = calculateWallLength(wall);

      // Check if we can place a window here
      if (!canPlaceWindow(wall, position, params.width)) {
        console.log('Cannot place window here - overlaps or too close to edge');
        return;
      }

      if (!activeStoreyId) {
        console.warn('No active storey selected');
        return;
      }

      // Create the window with current parameters
      try {
        const window = createWindow({
          hostWallId: wall.id,
          positionOnWall: position,
          wallLength,
          storeyId: activeStoreyId,
          windowType: params.windowType,
          width: params.width,
          height: params.height,
          sillHeight: params.sillHeight,
        });

        // Create opening for wall
        const opening = createOpeningFromWindow(window);

        if (opening && wall.wallData) {
          // Update wall with new opening
          updateElement(wall.id, {
            wallData: {
              ...wall.wallData,
              openings: [...wall.wallData.openings, opening],
            },
          });
        }

        // Add window to elements
        addElement(window);

        console.log('Window placed at position', position, 'on wall', wall.id);

        // Reset preview after placement
        resetWindowPlacement();
      } catch (error) {
        console.error('Could not create window:', error);
      }
    },
    [activeTool, findWallAtPoint, canPlaceWindow, activeStoreyId, params, addElement, updateElement, resetWindowPlacement]
  );

  /**
   * Handle pointer move for preview
   */
  const handlePointerMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (activeTool !== 'window') return;

      // Get pointer position in world coordinates
      const point: Point2D = {
        x: event.point.x,
        y: event.point.z, // 3D z maps to 2D y
      };

      // Find wall at this point
      const result = findWallAtPoint(point);

      if (!result) {
        // Clear preview when not over a wall
        setWindowPreview(null, null, null, null, false);
        return;
      }

      const { wall, position } = result;
      const wallLength = calculateWallLength(wall);

      // Calculate distances
      const { distanceFromLeft, distanceFromRight } = calculateWindowDistances(
        position,
        params.width,
        wallLength
      );

      // Check if position is valid
      const isValid = canPlaceWindow(wall, position, params.width);

      // Update preview state
      setWindowPreview(wall.id, position, distanceFromLeft, distanceFromRight, isValid);
    },
    [activeTool, findWallAtPoint, params.width, canPlaceWindow, setWindowPreview]
  );

  /**
   * Handle pointer leave - clear preview
   */
  const handlePointerLeave = useCallback(() => {
    if (activeTool !== 'window') return;
    setWindowPreview(null, null, null, null, false);
  }, [activeTool, setWindowPreview]);

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerLeave,
    walls,
  };
}
