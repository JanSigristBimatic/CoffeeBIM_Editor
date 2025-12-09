import { useCallback, useMemo } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import { useToolStore, useProjectStore, useElementStore } from '@/store';
import {
  createDoor,
  createOpeningFromDoor,
  calculateDoorDistances,
} from '@/bim/elements/Door';
import { getPositionOnWall, calculateWallLength } from '@/bim/elements/Wall';
import type { BimElement } from '@/types/bim';
import type { Point2D } from '@/types/geometry';

// Minimum distance from wall edges (in normalized 0-1 position)
const MIN_EDGE_DISTANCE_RATIO = 0.02;
// Minimum absolute distance from wall edges (in meters)
const MIN_EDGE_DISTANCE_METERS = 0.05;

/**
 * Hook for handling door placement on walls
 * Click on a wall to place a door, with preview on hover
 */
export function useDoorPlacement() {
  const { activeTool, doorPlacement, setDoorPreview, resetDoorPlacement } = useToolStore();
  const { addElement, updateElement, getWallsForStorey, elements } = useElementStore();
  const { activeStoreyId } = useProjectStore();

  const { params } = doorPlacement;

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
   * Check if door can be placed at this position (not overlapping existing openings)
   */
  const canPlaceDoor = useCallback(
    (wall: BimElement, position: number, doorWidth: number): boolean => {
      if (!wall.wallData) return false;

      const wallLength = calculateWallLength(wall);
      const halfDoorWidth = doorWidth / 2;
      const doorStartNorm = position - halfDoorWidth / wallLength;
      const doorEndNorm = position + halfDoorWidth / wallLength;

      // Calculate actual distances
      const { distanceFromLeft, distanceFromRight } = calculateDoorDistances(
        position,
        doorWidth,
        wallLength
      );

      // Check bounds - both normalized and absolute
      if (
        doorStartNorm < MIN_EDGE_DISTANCE_RATIO ||
        doorEndNorm > 1 - MIN_EDGE_DISTANCE_RATIO ||
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
        if (doorStartNorm < openingEnd + buffer / wallLength && doorEndNorm > openingStart - buffer / wallLength) {
          return false; // Overlaps with existing opening
        }
      }

      return true;
    },
    []
  );

  /**
   * Handle click to place door
   */
  const handlePointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (activeTool !== 'door') return;
      if (event.button !== 0) return;

      event.stopPropagation();

      // Get click position in world coordinates (Z-up: XY is ground plane)
      const point: Point2D = {
        x: event.point.x,
        y: event.point.y,
      };

      // Find wall at this point
      const result = findWallAtPoint(point);
      if (!result) {
        console.log('No wall found at click position');
        return;
      }

      const { wall, position } = result;
      const wallLength = calculateWallLength(wall);

      // Check if we can place a door here
      if (!canPlaceDoor(wall, position, params.width)) {
        console.log('Cannot place door here - overlaps or too close to edge');
        return;
      }

      if (!activeStoreyId) {
        console.warn('No active storey selected');
        return;
      }

      // Create the door with current parameters
      try {
        const door = createDoor({
          hostWallId: wall.id,
          positionOnWall: position,
          wallLength,
          storeyId: activeStoreyId,
          doorType: params.doorType,
          width: params.width,
          height: params.height,
          swingDirection: params.swingDirection,
          swingSide: params.swingSide,
        });

        // Create opening for wall
        const opening = createOpeningFromDoor(door);

        if (opening && wall.wallData) {
          // Update wall with new opening
          updateElement(wall.id, {
            wallData: {
              ...wall.wallData,
              openings: [...wall.wallData.openings, opening],
            },
          });
        }

        // Add door to elements
        addElement(door);

        console.log('Door placed at position', position, 'on wall', wall.id);

        // Reset preview after placement
        resetDoorPlacement();
      } catch (error) {
        console.error('Could not create door:', error);
      }
    },
    [activeTool, findWallAtPoint, canPlaceDoor, activeStoreyId, params, addElement, updateElement, resetDoorPlacement]
  );

  /**
   * Handle pointer move for preview
   */
  const handlePointerMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (activeTool !== 'door') return;

      // Get pointer position in world coordinates (Z-up: XY is ground plane)
      const point: Point2D = {
        x: event.point.x,
        y: event.point.y,
      };

      // Find wall at this point
      const result = findWallAtPoint(point);

      if (!result) {
        // Clear preview when not over a wall
        setDoorPreview(null, null, null, null, false);
        return;
      }

      const { wall, position } = result;
      const wallLength = calculateWallLength(wall);

      // Calculate distances
      const { distanceFromLeft, distanceFromRight } = calculateDoorDistances(
        position,
        params.width,
        wallLength
      );

      // Check if position is valid
      const isValid = canPlaceDoor(wall, position, params.width);

      // Update preview state
      setDoorPreview(wall.id, position, distanceFromLeft, distanceFromRight, isValid);
    },
    [activeTool, findWallAtPoint, params.width, canPlaceDoor, setDoorPreview]
  );

  /**
   * Handle pointer leave - clear preview
   */
  const handlePointerLeave = useCallback(() => {
    if (activeTool !== 'door') return;
    setDoorPreview(null, null, null, null, false);
  }, [activeTool, setDoorPreview]);

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerLeave,
    walls,
  };
}
