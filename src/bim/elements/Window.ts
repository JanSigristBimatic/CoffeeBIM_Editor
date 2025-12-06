import { v4 as uuidv4 } from 'uuid';
import type { BimElement, WindowData, Opening, WindowType } from '@/types/bim';
import {
  DEFAULT_WINDOW_WIDTH,
  DEFAULT_WINDOW_HEIGHT,
  DEFAULT_WINDOW_SILL_HEIGHT,
} from '@/types/bim';
import {
  calculateOpeningDistances,
  calculatePositionFromLeftDistance as calcPositionFromLeft,
  calculatePositionFromRightDistance as calcPositionFromRight,
  calculateOpeningWorldPosition,
} from './OpeningCalculations';

export { DEFAULT_WINDOW_WIDTH, DEFAULT_WINDOW_HEIGHT, DEFAULT_WINDOW_SILL_HEIGHT };

export interface CreateWindowParams {
  hostWallId: string;
  positionOnWall: number; // 0-1 position along wall centerline
  wallLength: number; // Length of host wall in meters
  storeyId: string;
  windowType?: WindowType;
  width?: number;
  height?: number;
  sillHeight?: number;
  name?: string;
}

/**
 * Get window type label for display
 */
export function getWindowTypeLabel(windowType: WindowType): string {
  switch (windowType) {
    case 'single':
      return 'Einflügelig';
    case 'double':
      return 'Zweiflügelig';
    case 'fixed':
      return 'Festverglasung';
    default:
      return windowType;
  }
}

/**
 * Calculate distances from window center to wall edges
 * Re-exports shared function with window-specific name
 */
export function calculateWindowDistances(
  positionOnWall: number,
  windowWidth: number,
  wallLength: number
): { distanceFromLeft: number; distanceFromRight: number } {
  return calculateOpeningDistances(positionOnWall, windowWidth, wallLength);
}

/**
 * Calculate position on wall from distance from left edge
 */
export function calculatePositionFromLeftDistance(
  distanceFromLeft: number,
  windowWidth: number,
  wallLength: number
): number {
  return calcPositionFromLeft(distanceFromLeft, windowWidth, wallLength);
}

/**
 * Calculate position on wall from distance from right edge
 */
export function calculatePositionFromRightDistance(
  distanceFromRight: number,
  windowWidth: number,
  wallLength: number
): number {
  return calcPositionFromRight(distanceFromRight, windowWidth, wallLength);
}

/**
 * Creates a new window element
 * Window is placed relative to its host wall
 */
export function createWindow(params: CreateWindowParams): BimElement {
  const {
    hostWallId,
    positionOnWall,
    wallLength,
    storeyId,
    width = DEFAULT_WINDOW_WIDTH,
    height = DEFAULT_WINDOW_HEIGHT,
    sillHeight = DEFAULT_WINDOW_SILL_HEIGHT,
    name,
  } = params;

  // Validate position
  if (positionOnWall < 0 || positionOnWall > 1) {
    throw new Error('Window position must be between 0 and 1');
  }

  const id = uuidv4();
  const windowNumber = Date.now().toString().slice(-4);

  // Calculate distances
  const { distanceFromLeft, distanceFromRight } = calculateWindowDistances(
    positionOnWall,
    width,
    wallLength
  );

  const windowData: WindowData = {
    width,
    height,
    sillHeight,
    windowType: params.windowType || 'single',
    hostWallId,
    positionOnWall,
    distanceFromLeft,
    distanceFromRight,
  };

  return {
    id,
    type: 'window',
    name: name || `Fenster ${windowNumber}`,
    geometry: {
      // Window profile (simplified rectangle for IFC export)
      profile: [
        { x: 0, y: 0 },
        { x: width, y: 0 },
        { x: width, y: height },
        { x: 0, y: height },
      ],
      height: 0.05, // Window thickness
      direction: { x: 0, y: 0, z: 1 },
    },
    placement: {
      // Position will be calculated relative to wall during rendering
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
    },
    properties: [
      {
        name: 'Pset_WindowCommon',
        properties: {
          IsExternal: true,
          FireRating: 'none',
          GlazingAreaFraction: 0.8,
        },
      },
    ],
    parentId: storeyId,
    windowData,
  };
}

/**
 * Creates an Opening object for a wall based on a window
 */
export function createOpeningFromWindow(window: BimElement): Opening | null {
  if (!window.windowData) return null;

  return {
    id: uuidv4(),
    type: 'window',
    elementId: window.id,
    position: window.windowData.positionOnWall,
    width: window.windowData.width,
    height: window.windowData.height,
    sillHeight: window.windowData.sillHeight,
  };
}

/**
 * Update an existing Opening to match window data
 */
export function updateOpeningFromWindow(opening: Opening, window: BimElement): Opening {
  if (!window.windowData) return opening;

  return {
    ...opening,
    position: window.windowData.positionOnWall,
    width: window.windowData.width,
    height: window.windowData.height,
    sillHeight: window.windowData.sillHeight,
  };
}

/**
 * Calculate the world position of a window given its host wall
 */
export function calculateWindowWorldPosition(
  window: BimElement,
  wall: BimElement
): { x: number; y: number; z: number; angle: number } | null {
  if (!window.windowData) return null;
  return calculateOpeningWorldPosition(window.windowData.positionOnWall, wall);
}
