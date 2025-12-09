import type { Point2D, Vector3 } from './geometry';

/**
 * Dimension types supported by the editor
 */
export type DimensionType =
  | 'wall-length'    // Wandlänge
  | 'wall-height'    // Wandhöhe
  | 'storey-height'  // Geschosshöhe
  | 'space-area'     // Raumfläche
  | 'space-height';  // Raumhöhe

/**
 * A dimension annotation in the model
 */
export interface Dimension {
  /** Unique identifier */
  id: string;

  /** Type of dimension */
  type: DimensionType;

  /** Reference to the measured element */
  elementId: string;

  /** Calculated numeric value */
  value: number;

  /** Unit of measurement */
  unit: 'm' | 'm²';

  /** Formatted display text */
  displayText: string;

  /** Position for 2D rendering (Canvas2D) */
  position2D: {
    /** World coordinate X */
    x: number;
    /** World coordinate Y */
    y: number;
    /** Offset distance from element */
    offset: number;
    /** Rotation in radians */
    rotation: number;
  };

  /** Position for 3D rendering (Billboard sprite) */
  position3D: Vector3;

  /** Start and end points of the dimension line (for linear dimensions) */
  measureLine?: {
    start: Point2D;
    end: Point2D;
  };
}

/**
 * Display unit for dimensions
 */
export type DimensionUnit = 'm' | 'cm' | 'mm';

/**
 * Dimension display settings
 */
export interface DimensionSettings {
  /** Display unit */
  unit: DimensionUnit;
  /** Decimal precision */
  precision: number;
  /** Font size in pixels (2D) */
  fontSize2D: number;
  /** Font size in meters (3D) */
  fontSize3D: number;
  /** Offset distance from element in meters */
  offsetDistance: number;
  /** Color for dimension lines and text */
  color: string;
}

/**
 * Default dimension settings
 */
export const DEFAULT_DIMENSION_SETTINGS: DimensionSettings = {
  unit: 'm',
  precision: 2,
  fontSize2D: 12,
  fontSize3D: 0.15,
  offsetDistance: 0.4,
  color: '#0066cc',
};

/**
 * Dimension colors
 */
export const DIMENSION_COLORS = {
  primary: '#0066cc',
  line: '#666666',
  background: 'rgba(255, 255, 255, 0.85)',
} as const;
