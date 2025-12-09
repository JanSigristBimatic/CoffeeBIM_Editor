/**
 * Space Element Factory
 *
 * Creates IfcSpace-compatible BimElements from detected space data.
 */

import { v4 as uuidv4 } from 'uuid';
import type { BimElement, SpaceData, SpaceType, GastroSpaceCategory } from '@/types/bim';
import type { Point2D } from '@/types/geometry';
import { DEFAULT_SPACE_TYPE, DEFAULT_GASTRO_CATEGORY } from '@/types/bim';
import {
  type DetectedSpace,
  calculateCentroid,
  ensureCounterClockwise,
} from '@/bim/spaces/detection';

// ============================================================================
// Types
// ============================================================================

export interface CreateSpaceParams {
  /** Name for the space */
  name?: string;
  /** Detected space data from room detection algorithm */
  detectedSpace: DetectedSpace;
  /** Parent storey ID */
  storeyId: string;
  /** Storey elevation (Z position) */
  elevation?: number;
  /** Space height (typically storey height) */
  height?: number;
  /** IFC space type classification */
  spaceType?: SpaceType;
  /** Optional long/descriptive name */
  longName?: string;
  /** Gastro-specific room category */
  gastroCategory?: GastroSpaceCategory;
}

export interface CreateSpaceFromPolygonParams {
  /** Name for the space */
  name?: string;
  /** Boundary polygon (will be closed automatically) */
  boundaryPolygon: Point2D[];
  /** Wall IDs that bound this space (optional for manual creation) */
  boundingWallIds?: string[];
  /** Parent storey ID */
  storeyId: string;
  /** Storey elevation (Z position) */
  elevation?: number;
  /** Space height */
  height?: number;
  /** IFC space type */
  spaceType?: SpaceType;
  /** Long name */
  longName?: string;
  /** Gastro-specific room category */
  gastroCategory?: GastroSpaceCategory;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a space element from detected space data
 */
export function createSpace(params: CreateSpaceParams): BimElement {
  const {
    name,
    detectedSpace,
    storeyId,
    elevation = 0,
    height = 3.0,
    spaceType = DEFAULT_SPACE_TYPE,
    longName,
    gastroCategory = DEFAULT_GASTRO_CATEGORY,
  } = params;

  // Ensure polygon is counter-clockwise (IFC standard)
  const boundaryPolygon = ensureCounterClockwise(detectedSpace.boundaryPolygon);

  const spaceData: SpaceData = {
    boundaryPolygon,
    area: detectedSpace.area,
    perimeter: detectedSpace.perimeter,
    spaceType,
    longName,
    boundingWallIds: detectedSpace.boundingWallIds,
    autoDetected: true,
    gastroCategory,
  };

  const id = uuidv4();
  const spaceNumber = Date.now().toString().slice(-4);

  return {
    id,
    type: 'space',
    name: name || `Raum ${spaceNumber}`,
    geometry: {
      profile: boundaryPolygon,
      height,
      direction: { x: 0, y: 0, z: 1 }, // Extrude upward (Z-up)
    },
    placement: {
      // Position at centroid (for reference), but polygon defines actual bounds
      position: {
        x: detectedSpace.centroid.x,
        y: detectedSpace.centroid.y,
        z: elevation,
      },
      rotation: { x: 0, y: 0, z: 0, w: 1 }, // No rotation
    },
    properties: [
      {
        name: 'Pset_SpaceCommon',
        properties: {
          Reference: name || `Raum ${spaceNumber}`,
          IsExternal: spaceType === 'EXTERNAL',
          GrossPlannedArea: detectedSpace.area,
          NetPlannedArea: detectedSpace.area * 0.95, // ~5% for walls
        },
      },
      {
        name: 'Qto_SpaceBaseQuantities',
        properties: {
          GrossFloorArea: detectedSpace.area,
          GrossPerimeter: detectedSpace.perimeter,
          GrossVolume: detectedSpace.area * height,
          Height: height,
        },
      },
    ],
    parentId: storeyId,
    spaceData,
  };
}

/**
 * Create a space element from a manual polygon
 * Used when user draws a space manually or imports from another source
 */
export function createSpaceFromPolygon(params: CreateSpaceFromPolygonParams): BimElement {
  const {
    name,
    boundaryPolygon: inputPolygon,
    boundingWallIds = [],
    storeyId,
    elevation = 0,
    height = 3.0,
    spaceType = DEFAULT_SPACE_TYPE,
    longName,
    gastroCategory = DEFAULT_GASTRO_CATEGORY,
  } = params;

  // Ensure we have a valid polygon
  if (inputPolygon.length < 3) {
    throw new Error('Space polygon must have at least 3 points');
  }

  // Ensure counter-clockwise
  const boundaryPolygon = ensureCounterClockwise(inputPolygon);

  // Calculate metrics
  const area = calculatePolygonAreaLocal(boundaryPolygon);
  const perimeter = calculatePerimeterLocal(boundaryPolygon);
  const centroid = calculateCentroid(boundaryPolygon);

  const spaceData: SpaceData = {
    boundaryPolygon,
    area,
    perimeter,
    spaceType,
    longName,
    boundingWallIds,
    autoDetected: false,
    gastroCategory,
  };

  const id = uuidv4();
  const spaceNumber = Date.now().toString().slice(-4);

  return {
    id,
    type: 'space',
    name: name || `Raum ${spaceNumber}`,
    geometry: {
      profile: boundaryPolygon,
      height,
      direction: { x: 0, y: 0, z: 1 },
    },
    placement: {
      position: { x: centroid.x, y: centroid.y, z: elevation },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
    },
    properties: [
      {
        name: 'Pset_SpaceCommon',
        properties: {
          Reference: name || `Raum ${spaceNumber}`,
          IsExternal: spaceType === 'EXTERNAL',
          GrossPlannedArea: area,
          NetPlannedArea: area * 0.95,
        },
      },
      {
        name: 'Qto_SpaceBaseQuantities',
        properties: {
          GrossFloorArea: area,
          GrossPerimeter: perimeter,
          GrossVolume: area * height,
          Height: height,
        },
      },
    ],
    parentId: storeyId,
    spaceData,
  };
}

// ============================================================================
// Update Functions
// ============================================================================

/**
 * Update space properties
 */
export function updateSpaceProperties(
  space: BimElement,
  updates: Partial<Pick<SpaceData, 'spaceType' | 'longName' | 'gastroCategory'>>
): BimElement {
  if (!space.spaceData) {
    throw new Error('Element is not a space');
  }

  return {
    ...space,
    spaceData: {
      ...space.spaceData,
      ...updates,
    },
    properties: space.properties.map((pset) => {
      if (pset.name === 'Pset_SpaceCommon') {
        const updatedProps = { ...pset.properties };
        if (updates.spaceType !== undefined) {
          updatedProps.IsExternal = updates.spaceType === 'EXTERNAL';
        }
        if (updates.gastroCategory !== undefined) {
          updatedProps.ObjectType = updates.gastroCategory;
        }
        return { ...pset, properties: updatedProps };
      }
      return pset;
    }),
  };
}

/**
 * Rename a space
 */
export function renameSpace(space: BimElement, newName: string): BimElement {
  if (!space.spaceData) {
    throw new Error('Element is not a space');
  }

  return {
    ...space,
    name: newName,
    properties: space.properties.map((pset) => {
      if (pset.name === 'Pset_SpaceCommon') {
        return {
          ...pset,
          properties: {
            ...pset.properties,
            Reference: newName,
          },
        };
      }
      return pset;
    }),
  };
}

// ============================================================================
// Helper Functions (local to avoid circular imports)
// ============================================================================

function calculatePolygonAreaLocal(polygon: Point2D[]): number {
  if (polygon.length < 3) return 0;

  let area = 0;
  const n = polygon.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += polygon[i]!.x * polygon[j]!.y;
    area -= polygon[j]!.x * polygon[i]!.y;
  }

  return Math.abs(area) / 2;
}

function calculatePerimeterLocal(polygon: Point2D[]): number {
  if (polygon.length < 2) return 0;

  let perimeter = 0;
  const n = polygon.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const dx = polygon[j]!.x - polygon[i]!.x;
    const dy = polygon[j]!.y - polygon[i]!.y;
    perimeter += Math.sqrt(dx * dx + dy * dy);
  }

  return perimeter;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get the area of a space in square meters
 */
export function getSpaceArea(space: BimElement): number {
  return space.spaceData?.area ?? 0;
}

/**
 * Get the volume of a space in cubic meters
 */
export function getSpaceVolume(space: BimElement): number {
  if (!space.spaceData) return 0;
  return space.spaceData.area * space.geometry.height;
}

/**
 * Check if a space is external
 */
export function isExternalSpace(space: BimElement): boolean {
  return space.spaceData?.spaceType === 'EXTERNAL';
}
