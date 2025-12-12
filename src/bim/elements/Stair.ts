import { v4 as uuidv4 } from 'uuid';
import type { BimElement, StairData, StepCalculation, StairType } from '@/types/bim';
import type { Point2D } from '@/types/geometry';
import {
  DEFAULT_STAIR_WIDTH,
  DEFAULT_STAIR_RISER_HEIGHT,
  STAIR_STEP_SIZE_RULE,
} from '@/types/bim';

// Re-export StairType for consumers of this module
export type { StairType } from '@/types/bim';

/**
 * Calculate step dimensions based on total rise (DIN 18065 compliant)
 * Uses the Schrittmassregel: 2h + a = 63cm
 */
export function calculateSteps(totalRise: number): StepCalculation {
  // Target riser height around 17-18cm
  const idealRiser = DEFAULT_STAIR_RISER_HEIGHT;
  const stepCount = Math.round(totalRise / idealRiser);

  // Actual riser height
  const riserHeight = totalRise / stepCount;

  // Schrittmassregel: a = 63 - 2h
  const treadDepth = STAIR_STEP_SIZE_RULE - 2 * riserHeight;

  // Run length: (n-1) treads (last step lands on top floor)
  const runLength = (stepCount - 1) * treadDepth;

  return {
    count: stepCount,
    riserHeight,
    treadDepth,
    runLength,
  };
}

export interface CreateStairParams {
  /** Start position (foot of stair) */
  position: Point2D;
  /** Rotation angle in radians (direction of travel) */
  rotation: number;
  /** Stair width */
  width?: number;
  /** Total rise (height difference between storeys) */
  totalRise: number;
  /** Bottom storey ID */
  bottomStoreyId: string;
  /** Top storey ID */
  topStoreyId: string;
  /** Bottom storey elevation */
  bottomElevation?: number;
  /** Stair type */
  stairType?: StairType;
  /** Whether to create floor opening */
  createOpening?: boolean;
  /** Custom name */
  name?: string;
}

/**
 * Creates a new stair element
 */
export function createStair(params: CreateStairParams): BimElement {
  const {
    position,
    rotation,
    width = DEFAULT_STAIR_WIDTH,
    totalRise,
    bottomStoreyId,
    topStoreyId,
    bottomElevation = 0,
    stairType = 'straight',
    createOpening = true,
    name,
  } = params;

  // Calculate steps
  const steps = calculateSteps(totalRise);

  // Create profile for the stair outline (simple rectangle for now)
  // Profile is in local XY plane
  const halfWidth = width / 2;
  const profile: Point2D[] = [
    { x: 0, y: -halfWidth },
    { x: steps.runLength, y: -halfWidth },
    { x: steps.runLength, y: halfWidth },
    { x: 0, y: halfWidth },
  ];

  const stairData: StairData = {
    stairType,
    width,
    totalRise,
    bottomStoreyId,
    topStoreyId,
    steps,
    rotation,
    createOpening,
  };

  const id = uuidv4();
  const stairNumber = Date.now().toString().slice(-4);

  return {
    id,
    type: 'stair',
    name: name || `Treppe ${stairNumber}`,
    geometry: {
      profile,
      height: totalRise,
      direction: { x: 0, y: 0, z: 1 },
    },
    placement: {
      position: { x: position.x, y: position.y, z: bottomElevation },
      rotation: {
        // Rotation around Z-axis (quaternion)
        x: 0,
        y: 0,
        z: Math.sin(rotation / 2),
        w: Math.cos(rotation / 2),
      },
    },
    properties: [
      {
        name: 'Pset_StairCommon',
        properties: {
          NumberOfRisers: steps.count,
          RiserHeight: steps.riserHeight,
          TreadLength: steps.treadDepth,
          IsExternal: false,
        },
      },
    ],
    parentId: bottomStoreyId,
    stairData,
  };
}

/**
 * Update stair when storey heights change
 */
export function updateStairForStoreyChange(
  stair: BimElement,
  newTotalRise: number
): Partial<BimElement> {
  if (!stair.stairData) return {};

  const steps = calculateSteps(newTotalRise);
  const halfWidth = stair.stairData.width / 2;

  const profile: Point2D[] = [
    { x: 0, y: -halfWidth },
    { x: steps.runLength, y: -halfWidth },
    { x: steps.runLength, y: halfWidth },
    { x: 0, y: halfWidth },
  ];

  return {
    stairData: {
      ...stair.stairData,
      totalRise: newTotalRise,
      steps,
    },
    geometry: {
      ...stair.geometry,
      profile,
      height: newTotalRise,
    },
    properties: [
      {
        name: 'Pset_StairCommon',
        properties: {
          NumberOfRisers: steps.count,
          RiserHeight: steps.riserHeight,
          TreadLength: steps.treadDepth,
          IsExternal: false,
        },
      },
    ],
  };
}

/**
 * Get stair run length (horizontal distance)
 */
export function getStairRunLength(stair: BimElement): number {
  return stair.stairData?.steps.runLength ?? 0;
}

/**
 * Update stair dimensions (width, type, etc.)
 */
export function updateStairDimensions(
  stair: BimElement,
  changes: {
    width?: number;
    stairType?: StairType;
  }
): Partial<BimElement> {
  if (!stair.stairData) return {};

  const newWidth = changes.width ?? stair.stairData.width;
  const newStairType = changes.stairType ?? stair.stairData.stairType;

  // Recalculate profile with new width
  const halfWidth = newWidth / 2;
  const profile: Point2D[] = [
    { x: 0, y: -halfWidth },
    { x: stair.stairData.steps.runLength, y: -halfWidth },
    { x: stair.stairData.steps.runLength, y: halfWidth },
    { x: 0, y: halfWidth },
  ];

  return {
    stairData: {
      ...stair.stairData,
      width: newWidth,
      stairType: newStairType,
    },
    geometry: {
      ...stair.geometry,
      profile,
    },
  };
}

/**
 * Get stair type label
 */
export function getStairTypeLabel(type: StairType): string {
  switch (type) {
    case 'straight':
      return 'Gerade';
    case 'l-shape':
      return 'L-Form';
    case 'u-shape':
      return 'U-Form';
    default:
      return type;
  }
}

/**
 * Get the outline for floor opening (in world coordinates)
 * Returns the polygon that should be cut from the top storey's floor
 *
 * Calculation: As you walk up the stair, your head gets closer to the ceiling.
 * The opening must start where the remaining headroom falls below 2.0m.
 *
 * At horizontal position X along the stair:
 * - Your feet are at height: X × (riserHeight / treadDepth)
 * - Headroom = totalRise - feet_height
 * - Opening starts when: totalRise - X × slope < requiredHeadroom
 * - Solving for X: X > (totalRise - requiredHeadroom) / slope
 */
export function getStairOpeningOutline(stair: BimElement): Point2D[] {
  if (!stair.stairData) return [];

  const { steps, width, rotation, totalRise } = stair.stairData;
  const { position } = stair.placement;

  // Required headroom (DIN 18065: minimum 2.0m)
  const requiredHeadroom = 2.0;

  // Stair slope = rise / run = riserHeight / treadDepth
  const slope = steps.riserHeight / steps.treadDepth;

  // Opening starts where: totalRise - X × slope < requiredHeadroom
  // => X > (totalRise - requiredHeadroom) / slope
  const openingStartCalc = (totalRise - requiredHeadroom) / slope;

  // Opening must start at least at position 0 (can't be negative)
  // Add small margin before the calculated point for safety
  const openingStart = Math.max(0, openingStartCalc - 0.1);

  // Opening extends to end of stair + margin for landing
  const openingEnd = steps.runLength + 0.3;

  // Width: stair width + margins for handrails/finishing (10cm each side)
  const halfWidth = width / 2 + 0.1;

  // Local coordinates (relative to stair start point)
  const localOutline: Point2D[] = [
    { x: openingStart, y: -halfWidth },
    { x: openingEnd, y: -halfWidth },
    { x: openingEnd, y: halfWidth },
    { x: openingStart, y: halfWidth },
  ];

  // Transform to world coordinates
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);

  return localOutline.map((p) => ({
    x: position.x + p.x * cos - p.y * sin,
    y: position.y + p.x * sin + p.y * cos,
  }));
}
