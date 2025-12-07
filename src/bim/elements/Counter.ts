import { v4 as uuidv4 } from 'uuid';
import type { BimElement, CounterData, CounterType, PropertySet } from '@/types/bim';
import type { Point2D } from '@/types/geometry';
import {
  DEFAULT_COUNTER_DEPTH,
  DEFAULT_COUNTER_HEIGHT,
  DEFAULT_BAR_COUNTER_HEIGHT,
  DEFAULT_COUNTER_TOP_THICKNESS,
  DEFAULT_COUNTER_OVERHANG,
  DEFAULT_COUNTER_KICK_HEIGHT,
  DEFAULT_COUNTER_KICK_RECESS,
  DEFAULT_COUNTER_FOOTREST_HEIGHT,
  createDefaultAssetPropertySets,
} from '@/types/bim';
import { offsetPath, createCounterPolygon, calculatePathLength } from '@/lib/geometry/pathOffset';

export interface CreateCounterParams {
  /** Front line path (customer side) - minimum 2 points */
  path: Point2D[];
  storeyId: string;
  counterType?: CounterType;
  depth?: number;
  height?: number;
  topThickness?: number;
  overhang?: number;
  kickHeight?: number;
  kickRecess?: number;
  hasFootrest?: boolean;
  footrestHeight?: number;
  name?: string;
}

/**
 * Get default height based on counter type
 */
function getDefaultHeight(counterType: CounterType): number {
  switch (counterType) {
    case 'bar':
      return DEFAULT_BAR_COUNTER_HEIGHT;
    case 'standard':
    case 'service':
    default:
      return DEFAULT_COUNTER_HEIGHT;
  }
}

/**
 * Get default overhang based on counter type
 * Bar counters typically have more overhang for seating
 */
function getDefaultOverhang(counterType: CounterType): number {
  switch (counterType) {
    case 'bar':
      return 0.3; // 30cm for bar seating
    case 'standard':
      return DEFAULT_COUNTER_OVERHANG;
    case 'service':
      return 0; // No overhang for service counters
    default:
      return DEFAULT_COUNTER_OVERHANG;
  }
}

/**
 * Calculate the outline polygon for the counter using shared offset function
 */
function calculateCounterOutline(path: Point2D[], depth: number): Point2D[] {
  if (path.length < 2) return [];

  const backPath = offsetPath(path, depth);
  return createCounterPolygon(path, backPath);
}

/**
 * Creates a new counter element from a front-line path
 * The path represents the customer-facing edge.
 * Counter extends backwards (into service area) by depth.
 */
export function createCounter(params: CreateCounterParams): BimElement {
  const {
    path,
    storeyId,
    counterType = 'standard',
    depth = DEFAULT_COUNTER_DEPTH,
    height,
    topThickness = DEFAULT_COUNTER_TOP_THICKNESS,
    overhang,
    kickHeight = DEFAULT_COUNTER_KICK_HEIGHT,
    kickRecess = DEFAULT_COUNTER_KICK_RECESS,
    hasFootrest = counterType === 'bar',
    footrestHeight = DEFAULT_COUNTER_FOOTREST_HEIGHT,
    name,
  } = params;

  if (path.length < 2) {
    throw new Error('Counter path must have at least 2 points');
  }

  // Use type-specific defaults if not provided
  const finalHeight = height ?? getDefaultHeight(counterType);
  const finalOverhang = overhang ?? getDefaultOverhang(counterType);

  // Calculate outline polygon
  const outline = calculateCounterOutline(path, depth);

  // Generate name based on type
  const typeNames: Record<CounterType, string> = {
    standard: 'Theke',
    bar: 'Bar-Theke',
    service: 'Service-Theke',
  };
  const elementName = name ?? `${typeNames[counterType]} ${Date.now().toString(36).slice(-4).toUpperCase()}`;

  const counterData: CounterData = {
    path: path.map((p) => ({ ...p })),
    depth,
    height: finalHeight,
    topThickness,
    overhang: finalOverhang,
    kickHeight,
    kickRecess,
    counterType,
    hasFootrest,
    footrestHeight,
  };

  const pathLength = calculatePathLength(path);

  // Map counter type to German category name
  const categoryNames: Record<CounterType, string> = {
    standard: 'Theke',
    bar: 'Bar-Theke',
    service: 'Service-Theke',
  };

  // Create asset property sets
  const assetPsets = createDefaultAssetPropertySets(
    categoryNames[counterType],
    pathLength, // Use path length as "width"
    depth,
    finalHeight
  );

  // Add counter-specific Pset
  const counterPset: PropertySet = {
    name: 'Pset_CounterCommon',
    properties: {
      CounterType: counterType,
      Depth: depth,
      Height: finalHeight,
      TopThickness: topThickness,
      Overhang: finalOverhang,
      Length: pathLength,
      HasFootrest: hasFootrest,
    },
  };

  return {
    id: uuidv4(),
    type: 'counter',
    name: elementName,
    geometry: {
      profile: outline,
      height: finalHeight,
      direction: { x: 0, y: 0, z: 1 },
    },
    placement: {
      // Position at origin - counter uses world coordinates directly from path
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
    },
    properties: [counterPset, ...assetPsets],
    parentId: storeyId,
    counterData,
  };
}

/**
 * Update counter dimensions after placement
 */
export function updateCounterDimensions(
  counter: BimElement,
  updates: Partial<
    Pick<
      CounterData,
      | 'depth'
      | 'height'
      | 'topThickness'
      | 'overhang'
      | 'kickHeight'
      | 'kickRecess'
      | 'counterType'
      | 'hasFootrest'
      | 'footrestHeight'
    >
  >
): Partial<BimElement> {
  if (!counter.counterData) return {};

  const newCounterData = { ...counter.counterData, ...updates };

  // If counter type changed, update type-specific defaults
  if (updates.counterType && updates.counterType !== counter.counterData.counterType) {
    if (updates.height === undefined) {
      newCounterData.height = getDefaultHeight(updates.counterType);
    }
    if (updates.overhang === undefined) {
      newCounterData.overhang = getDefaultOverhang(updates.counterType);
    }
    if (updates.hasFootrest === undefined) {
      newCounterData.hasFootrest = updates.counterType === 'bar';
    }
  }

  // Recalculate outline if depth changed
  const newOutline =
    updates.depth !== undefined
      ? calculateCounterOutline(newCounterData.path, newCounterData.depth)
      : counter.geometry.profile;

  const pathLength = calculatePathLength(newCounterData.path);

  return {
    counterData: newCounterData,
    geometry: {
      ...counter.geometry,
      profile: newOutline,
      height: newCounterData.height,
    },
    properties: counter.properties.map((ps) => {
      if (ps.name === 'Pset_CounterCommon') {
        return {
          ...ps,
          properties: {
            ...ps.properties,
            CounterType: newCounterData.counterType,
            Depth: newCounterData.depth,
            Height: newCounterData.height,
            TopThickness: newCounterData.topThickness,
            Overhang: newCounterData.overhang,
            HasFootrest: newCounterData.hasFootrest,
            Length: pathLength,
          },
        };
      }
      if (ps.name === 'Pset_Dimensionen') {
        return {
          ...ps,
          properties: {
            ...ps.properties,
            Breite: pathLength,
            Tiefe: newCounterData.depth,
            Hoehe: newCounterData.height,
          },
        };
      }
      return ps;
    }),
  };
}

/**
 * Calculate the surface area of the countertop
 */
export function calculateCounterArea(path: Point2D[], depth: number, overhang: number): number {
  const totalDepth = depth + overhang;
  const length = calculatePathLength(path);
  return length * totalDepth;
}

/**
 * Calculate approximate volume (simplified as length * depth * height)
 */
export function calculateCounterVolume(counterData: CounterData): number {
  const length = calculatePathLength(counterData.path);
  // Simplified volume calculation
  return length * counterData.depth * counterData.height;
}
