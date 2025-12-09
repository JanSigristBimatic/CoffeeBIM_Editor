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
 * Get the gross floor area of a space in square meters (Bruttofläche)
 */
export function getSpaceArea(space: BimElement): number {
  return space.spaceData?.area ?? 0;
}

/**
 * Get the net floor area of a space in square meters (Nettofläche)
 * Returns calculated netFloorArea if available, otherwise falls back to gross area
 */
export function getSpaceNetArea(space: BimElement): number {
  if (!space.spaceData) return 0;
  return space.spaceData.netFloorArea ?? space.spaceData.area;
}

/**
 * Get the volume of a space in cubic meters
 */
export function getSpaceVolume(space: BimElement): number {
  if (!space.spaceData) return 0;
  return space.spaceData.area * space.geometry.height;
}

/**
 * Get the net volume of a space in cubic meters (based on net floor area)
 */
export function getSpaceNetVolume(space: BimElement): number {
  if (!space.spaceData) return 0;
  const netArea = space.spaceData.netFloorArea ?? space.spaceData.area;
  return netArea * space.geometry.height;
}

/**
 * Check if a space is external
 */
export function isExternalSpace(space: BimElement): boolean {
  return space.spaceData?.spaceType === 'EXTERNAL';
}

// ============================================================================
// Net Floor Area Calculation
// ============================================================================

/**
 * Check if a point is inside a polygon using ray casting algorithm
 */
function isPointInPolygon(point: Point2D, polygon: Point2D[]): boolean {
  const n = polygon.length;
  let inside = false;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const pi = polygon[i]!;
    const pj = polygon[j]!;

    if (
      pi.y > point.y !== pj.y > point.y &&
      point.x < ((pj.x - pi.x) * (point.y - pi.y)) / (pj.y - pi.y) + pi.x
    ) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Calculate the footprint area of a column
 */
function getColumnFootprint(element: BimElement): number {
  if (!element.columnData) return 0;

  const { profileType, width, depth } = element.columnData;

  if (profileType === 'circular') {
    // Circular column: area = π * r²
    const radius = width / 2;
    return Math.PI * radius * radius;
  }

  // Rectangular column: area = width * depth
  return width * depth;
}

/**
 * Calculate the footprint area of a counter
 * Counter footprint is the full path area (path × depth)
 */
function getCounterFootprint(element: BimElement): number {
  if (!element.counterData) return 0;

  const { path, depth, overhang } = element.counterData;

  // Calculate path length
  let pathLength = 0;
  for (let i = 1; i < path.length; i++) {
    const dx = path[i]!.x - path[i - 1]!.x;
    const dy = path[i]!.y - path[i - 1]!.y;
    pathLength += Math.sqrt(dx * dx + dy * dy);
  }

  // Total depth including overhang
  const totalDepth = depth + overhang;

  return pathLength * totalDepth;
}

/**
 * Calculate net floor area by subtracting columns and counters from gross area
 *
 * @param space - The space element to calculate net area for
 * @param allElements - All elements on the same storey
 * @returns Net floor area in square meters
 */
export function calculateNetFloorArea(
  space: BimElement,
  allElements: BimElement[]
): number {
  if (!space.spaceData) return 0;

  const grossArea = space.spaceData.area;
  const spacePolygon = space.spaceData.boundaryPolygon;
  const storeyId = space.parentId;

  let deductedArea = 0;

  // Find columns and counters on the same storey
  for (const element of allElements) {
    // Skip if not on the same storey
    if (element.parentId !== storeyId) continue;

    // Check columns
    if (element.type === 'column' && element.columnData) {
      const columnCenter = element.placement.position;
      const point2D = { x: columnCenter.x, y: columnCenter.y };

      if (isPointInPolygon(point2D, spacePolygon)) {
        deductedArea += getColumnFootprint(element);
      }
    }

    // Check counters
    if (element.type === 'counter' && element.counterData) {
      // Use counter centroid (first point of path as approximation)
      const firstPathPoint = element.counterData.path[0];
      if (firstPathPoint && isPointInPolygon(firstPathPoint, spacePolygon)) {
        deductedArea += getCounterFootprint(element);
      }
    }
  }

  // Net area = Gross area - deducted elements
  const netArea = Math.max(0, grossArea - deductedArea);

  return netArea;
}

/**
 * Update a space element with recalculated net floor area
 *
 * @param space - The space element to update
 * @param allElements - All elements on the same storey for calculation
 * @returns Updated space element with netFloorArea
 */
export function updateSpaceNetFloorArea(
  space: BimElement,
  allElements: BimElement[]
): BimElement {
  if (!space.spaceData) {
    throw new Error('Element is not a space');
  }

  const netFloorArea = calculateNetFloorArea(space, allElements);

  return {
    ...space,
    spaceData: {
      ...space.spaceData,
      netFloorArea,
    },
    properties: space.properties.map((pset) => {
      if (pset.name === 'Pset_SpaceCommon') {
        return {
          ...pset,
          properties: {
            ...pset.properties,
            NetPlannedArea: netFloorArea,
          },
        };
      }
      if (pset.name === 'Qto_SpaceBaseQuantities') {
        return {
          ...pset,
          properties: {
            ...pset.properties,
            NetFloorArea: netFloorArea,
            NetVolume: netFloorArea * space.geometry.height,
          },
        };
      }
      return pset;
    }),
  };
}

/**
 * Recalculate net floor area for all spaces on a storey
 *
 * @param spaces - Array of space elements to update
 * @param allElements - All elements on the storey
 * @returns Array of updated space elements
 */
export function recalculateAllSpacesNetArea(
  spaces: BimElement[],
  allElements: BimElement[]
): BimElement[] {
  return spaces.map((space) => updateSpaceNetFloorArea(space, allElements));
}
