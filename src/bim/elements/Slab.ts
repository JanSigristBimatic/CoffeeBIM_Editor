import { v4 as uuidv4 } from 'uuid';
import type { BimElement, SlabData, SlabOpening } from '@/types/bim';
import type { Point2D } from '@/types/geometry';

export const DEFAULT_SLAB_THICKNESS = 0.25; // 25cm

export interface CreateSlabParams {
  outline: Point2D[];
  storeyId: string;
  slabType?: 'floor' | 'ceiling';
  thickness?: number;
  elevation?: number; // Storey elevation (Z position)
  elevationOffset?: number; // Vertical offset from storey elevation
  name?: string;
}

/**
 * Creates a new slab (floor/ceiling) element from a polygon outline
 * Minimum 3 points required for a valid polygon
 */
export function createSlab(params: CreateSlabParams): BimElement {
  const {
    outline,
    storeyId,
    slabType = 'floor',
    thickness = DEFAULT_SLAB_THICKNESS,
    elevation = 0,
    elevationOffset = 0,
    name,
  } = params;

  if (outline.length < 3) {
    throw new Error('Slab outline must have at least 3 points');
  }

  // Calculate centroid for position
  const centroid = outline.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 }
  );
  centroid.x /= outline.length;
  centroid.y /= outline.length;

  // Generate name if not provided
  const elementName = name ?? `${slabType === 'floor' ? 'Boden' : 'Decke'} ${Date.now().toString(36).slice(-4).toUpperCase()}`;

  const slabData: SlabData = {
    slabType,
    thickness,
    outline: outline.map((p) => ({ ...p })), // Clone points
    elevationOffset,
  };

  return {
    id: uuidv4(),
    type: 'slab',
    name: elementName,
    geometry: {
      profile: outline.map((p) => ({ ...p })),
      height: thickness,
      direction: { x: 0, y: 0, z: 1 }, // Extrude upward (Z-up)
    },
    placement: {
      // Z-up coordinate system: 2D (x,y) → 3D (x, y, elevation)
      position: { x: centroid.x, y: centroid.y, z: elevation },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
    },
    properties: [
      {
        name: 'Pset_SlabCommon',
        properties: {
          SlabType: slabType,
          Thickness: thickness,
          Area: calculateArea(outline),
        },
      },
    ],
    parentId: storeyId,
    slabData,
  };
}

/**
 * Calculate the area of a polygon using the shoelace formula
 */
export function calculateSlabArea(points: Point2D[]): number {
  return calculateArea(points);
}

/**
 * Update slab dimensions (thickness, type, and/or elevation offset)
 */
export function updateSlabDimensions(
  slab: BimElement,
  updates: Partial<Pick<SlabData, 'thickness' | 'slabType' | 'elevationOffset'>>
): Partial<BimElement> {
  if (!slab.slabData) return {};

  const newSlabData = { ...slab.slabData, ...updates };

  return {
    slabData: newSlabData,
    geometry: {
      ...slab.geometry,
      height: newSlabData.thickness,
    },
    properties: slab.properties.map((ps) =>
      ps.name === 'Pset_SlabCommon'
        ? {
            ...ps,
            properties: {
              ...ps.properties,
              SlabType: newSlabData.slabType,
              Thickness: newSlabData.thickness,
              ElevationOffset: newSlabData.elevationOffset ?? 0,
            },
          }
        : ps
    ),
  };
}

/**
 * Calculate the area of a polygon using the shoelace formula (internal)
 */
function calculateArea(points: Point2D[]): number {
  let area = 0;
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const pi = points[i];
    const pj = points[j];
    if (pi && pj) {
      area += pi.x * pj.y;
      area -= pj.x * pi.y;
    }
  }

  return Math.abs(area / 2);
}

/**
 * Create a slab opening from a stair element
 * Uses the stair's opening outline calculation
 */
export function createSlabOpeningFromStair(
  stair: BimElement,
  openingOutline: Point2D[]
): SlabOpening {
  return {
    id: uuidv4(),
    type: 'stair',
    elementId: stair.id,
    outline: openingOutline.map((p) => ({ ...p })),
    description: `Treppenöffnung für ${stair.name}`,
  };
}

/**
 * Add an opening to a slab
 * Returns updated slab data
 */
export function addOpeningToSlab(
  slab: BimElement,
  opening: SlabOpening
): Partial<BimElement> {
  if (!slab.slabData) return {};

  const existingOpenings = slab.slabData.openings ?? [];

  // Check if opening for this element already exists
  const existingIndex = existingOpenings.findIndex(
    (o) => o.elementId === opening.elementId
  );

  let updatedOpenings: SlabOpening[];
  if (existingIndex >= 0) {
    // Update existing opening
    updatedOpenings = [...existingOpenings];
    updatedOpenings[existingIndex] = opening;
  } else {
    // Add new opening
    updatedOpenings = [...existingOpenings, opening];
  }

  return {
    slabData: {
      ...slab.slabData,
      openings: updatedOpenings,
    },
  };
}

/**
 * Remove an opening from a slab by element ID
 * Returns updated slab data
 */
export function removeOpeningFromSlab(
  slab: BimElement,
  elementId: string
): Partial<BimElement> {
  if (!slab.slabData?.openings) return {};

  const updatedOpenings = slab.slabData.openings.filter(
    (o) => o.elementId !== elementId
  );

  return {
    slabData: {
      ...slab.slabData,
      openings: updatedOpenings.length > 0 ? updatedOpenings : undefined,
    },
  };
}

/**
 * Check if a point is inside a polygon (ray casting algorithm)
 */
export function isPointInPolygon(point: Point2D, polygon: Point2D[]): boolean {
  let inside = false;
  const n = polygon.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const pi = polygon[i];
    const pj = polygon[j];
    if (!pi || !pj) continue;

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
 * Find slabs in a storey that contain the stair opening
 * Returns slabs whose outline contains the stair opening centroid
 */
export function findSlabsForStairOpening(
  slabs: BimElement[],
  storeyId: string,
  openingOutline: Point2D[]
): BimElement[] {
  // Calculate centroid of opening
  const centroid = openingOutline.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 }
  );
  centroid.x /= openingOutline.length;
  centroid.y /= openingOutline.length;

  // Find slabs in target storey that contain the opening centroid
  return slabs.filter((slab) => {
    if (slab.type !== 'slab' || slab.parentId !== storeyId) return false;
    if (!slab.slabData?.outline) return false;

    // Only floor slabs need stair openings (ceiling openings are handled differently)
    if (slab.slabData.slabType !== 'floor') return false;

    return isPointInPolygon(centroid, slab.slabData.outline);
  });
}
