/**
 * Dimension calculation utilities
 * Generates automatic dimensions for BIM elements
 */

import type { Point2D, Vector3 } from '@/types/geometry';
import type { BimElement, WallData } from '@/types/bim';
import type { Dimension, DimensionSettings } from '@/types/dimensions';
import { DEFAULT_DIMENSION_SETTINGS } from '@/types/dimensions';

/**
 * Calculate the length of a wall
 */
export function calculateWallLength(wall: WallData): number {
  const dx = wall.endPoint.x - wall.startPoint.x;
  const dy = wall.endPoint.y - wall.startPoint.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate the area of a polygon using the Shoelace formula
 * Works for any simple (non-self-intersecting) polygon
 */
export function calculatePolygonArea(points: Point2D[]): number {
  if (points.length < 3) return 0;

  let area = 0;
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const pi = points[i]!;
    const pj = points[j]!;
    area += pi.x * pj.y;
    area -= pj.x * pi.y;
  }

  return Math.abs(area / 2);
}

/**
 * Calculate the perimeter of a polygon
 */
export function calculatePolygonPerimeter(points: Point2D[]): number {
  if (points.length < 2) return 0;

  let perimeter = 0;
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const pi = points[i]!;
    const pj = points[j]!;
    const dx = pj.x - pi.x;
    const dy = pj.y - pi.y;
    perimeter += Math.sqrt(dx * dx + dy * dy);
  }

  return perimeter;
}

/**
 * Calculate the centroid (center of mass) of a polygon
 */
export function calculatePolygonCentroid(points: Point2D[]): Point2D {
  if (points.length === 0) return { x: 0, y: 0 };

  let cx = 0;
  let cy = 0;

  for (const p of points) {
    cx += p.x;
    cy += p.y;
  }

  return {
    x: cx / points.length,
    y: cy / points.length,
  };
}

/**
 * Calculate dimension position for a wall
 * Places the dimension centered along the wall, offset perpendicular
 */
export function calculateWallDimensionPosition(
  wall: WallData,
  offsetDistance: number,
  storeyElevation: number = 0
): {
  position2D: Dimension['position2D'];
  position3D: Vector3;
  measureLine: NonNullable<Dimension['measureLine']>;
} {
  const { startPoint, endPoint, height } = wall;

  // Midpoint of wall
  const midX = (startPoint.x + endPoint.x) / 2;
  const midY = (startPoint.y + endPoint.y) / 2;

  // Direction vector along wall
  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;
  const length = Math.sqrt(dx * dx + dy * dy);

  if (length === 0) {
    return {
      position2D: { x: midX, y: midY, offset: 0, rotation: 0 },
      position3D: { x: midX, y: midY, z: storeyElevation + height / 2 },
      measureLine: { start: startPoint, end: endPoint },
    };
  }

  // Normal vector (perpendicular, pointing "outward")
  const nx = -dy / length;
  const ny = dx / length;

  // Rotation angle of the wall
  const rotation = Math.atan2(dy, dx);

  return {
    position2D: {
      x: midX + nx * offsetDistance,
      y: midY + ny * offsetDistance,
      offset: offsetDistance,
      rotation,
    },
    position3D: {
      x: midX + nx * offsetDistance,
      y: midY + ny * offsetDistance,
      z: storeyElevation + height / 2,
    },
    measureLine: {
      start: startPoint,
      end: endPoint,
    },
  };
}

/**
 * Format a dimension value for display
 */
export function formatDimensionValue(
  value: number,
  unit: 'm' | 'm²',
  precision: number
): string {
  return `${value.toFixed(precision)} ${unit}`;
}

/**
 * Generate a wall length dimension
 */
export function generateWallLengthDimension(
  element: BimElement,
  settings: DimensionSettings = DEFAULT_DIMENSION_SETTINGS
): Dimension | null {
  if (!element.wallData) return null;

  const length = calculateWallLength(element.wallData);
  // Use element's Z position as storey elevation
  const storeyElevation = element.placement.position.z;
  const pos = calculateWallDimensionPosition(element.wallData, settings.offsetDistance, storeyElevation);

  return {
    id: `dim-${element.id}-length`,
    type: 'wall-length',
    elementId: element.id,
    value: length,
    unit: 'm',
    displayText: formatDimensionValue(length, 'm', settings.precision),
    position2D: pos.position2D,
    position3D: pos.position3D,
    measureLine: pos.measureLine,
  };
}

/**
 * Generate a space area dimension
 */
export function generateSpaceAreaDimension(
  element: BimElement,
  _settings: DimensionSettings = DEFAULT_DIMENSION_SETTINGS
): Dimension | null {
  if (!element.spaceData) return null;

  const { area, boundaryPolygon } = element.spaceData;
  const centroid = calculatePolygonCentroid(boundaryPolygon);
  // Use element's Z position as storey elevation
  const storeyElevation = element.placement.position.z;

  return {
    id: `dim-${element.id}-area`,
    type: 'space-area',
    elementId: element.id,
    value: area,
    unit: 'm²',
    // Use 1 decimal for area values
    displayText: formatDimensionValue(area, 'm²', 1),
    position2D: {
      x: centroid.x,
      y: centroid.y,
      offset: 0,
      rotation: 0,
    },
    position3D: {
      x: centroid.x,
      y: centroid.y,
      z: storeyElevation + 0.1, // Slightly above floor level at storey elevation
    },
  };
}

/**
 * Generate all dimensions for a single element
 */
export function generateElementDimensions(
  element: BimElement,
  settings: DimensionSettings = DEFAULT_DIMENSION_SETTINGS
): Dimension[] {
  const dimensions: Dimension[] = [];

  // Wall dimensions
  if (element.type === 'wall' && element.wallData) {
    const lengthDim = generateWallLengthDimension(element, settings);
    if (lengthDim) dimensions.push(lengthDim);
  }

  // Space dimensions are NOT generated here - SpaceMesh already renders its own
  // area label via SpaceLabel component to avoid duplication

  return dimensions;
}

/**
 * Generate dimensions for multiple elements
 */
export function generateAllDimensions(
  elements: BimElement[],
  settings: DimensionSettings = DEFAULT_DIMENSION_SETTINGS
): Dimension[] {
  const allDimensions: Dimension[] = [];

  for (const element of elements) {
    const dims = generateElementDimensions(element, settings);
    allDimensions.push(...dims);
  }

  return allDimensions;
}

/**
 * Calculate the offset line points for dimension rendering
 * Returns the start and end points of the dimension line with offset applied
 */
export function calculateDimensionLinePoints(
  measureLine: NonNullable<Dimension['measureLine']>,
  offset: number
): { start: Point2D; end: Point2D } {
  const { start, end } = measureLine;

  // Direction vector
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.sqrt(dx * dx + dy * dy);

  if (length === 0) {
    return { start, end };
  }

  // Normal vector (perpendicular)
  const nx = -dy / length;
  const ny = dx / length;

  return {
    start: {
      x: start.x + nx * offset,
      y: start.y + ny * offset,
    },
    end: {
      x: end.x + nx * offset,
      y: end.y + ny * offset,
    },
  };
}

/**
 * Normalize angle for readable text orientation
 * Ensures text is not upside-down
 */
export function normalizeTextRotation(angleDeg: number): number {
  // Normalize to -180 to 180
  let normalized = angleDeg;
  while (normalized > 180) normalized -= 360;
  while (normalized < -180) normalized += 360;

  // Flip if text would be upside-down
  if (normalized > 90) return normalized - 180;
  if (normalized < -90) return normalized + 180;

  return normalized;
}
