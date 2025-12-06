import { v4 as uuidv4 } from 'uuid';
import type { BimElement, SlabData } from '@/types/bim';
import type { Point2D } from '@/types/geometry';

export const DEFAULT_SLAB_THICKNESS = 0.25; // 25cm

export interface CreateSlabParams {
  outline: Point2D[];
  storeyId: string;
  slabType?: 'floor' | 'ceiling';
  thickness?: number;
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
  };

  return {
    id: uuidv4(),
    type: 'slab',
    name: elementName,
    geometry: {
      profile: outline.map((p) => ({ ...p })),
      height: thickness,
      direction: { x: 0, y: 0, z: 1 },
    },
    placement: {
      position: { x: centroid.x, y: 0, z: centroid.y },
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
