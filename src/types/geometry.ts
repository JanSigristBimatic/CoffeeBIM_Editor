/**
 * 2D point in the XY plane
 */
export interface Point2D {
  x: number;
  y: number;
}

/**
 * 2D vector for direction/offset calculations
 */
export interface Vector2D {
  x: number;
  y: number;
}

/**
 * 3D vector
 */
export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

/**
 * 3D point (alias for Vector3 for semantic clarity)
 */
export type Point3D = Vector3;

/**
 * Quaternion for rotation
 */
export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

/**
 * 3D transformation
 */
export interface Transform {
  position: Vector3;
  rotation: Quaternion;
  scale?: Vector3;
}

/**
 * Axis-aligned bounding box
 */
export interface BoundingBox {
  min: Vector3;
  max: Vector3;
}

/**
 * Create a zero vector
 */
export const ZERO_VECTOR: Vector3 = { x: 0, y: 0, z: 0 };

/**
 * Create an identity quaternion (no rotation)
 */
export const IDENTITY_QUATERNION: Quaternion = { x: 0, y: 0, z: 0, w: 1 };

/**
 * Z-up coordinate system (BIM/IFC Standard)
 * - XY plane is horizontal (ground plane)
 * - Z axis is vertical (height)
 * - 2D points (x,y) map to 3D (x, y, 0) for ground-level positions
 */
export const UP_VECTOR: Vector3 = { x: 0, y: 0, z: 1 };

/**
 * Ground plane normal (Z-up)
 */
export const GROUND_PLANE_NORMAL: Vector3 = { x: 0, y: 0, z: 1 };

/**
 * Convert 2D point to 3D position on ground plane (Z-up)
 * @param point2D - 2D point in XY plane
 * @param elevation - Z elevation (default 0)
 */
export const point2Dto3D = (point2D: Point2D, elevation: number = 0): Vector3 => ({
  x: point2D.x,
  y: point2D.y,
  z: elevation,
});

/**
 * Convert 3D position to 2D point (project to XY plane)
 * @param point3D - 3D position
 */
export const point3Dto2D = (point3D: Vector3): Point2D => ({
  x: point3D.x,
  y: point3D.y,
});

/**
 * Line segment defined by two points
 */
export interface LineSegment {
  start: Point2D;
  end: Point2D;
}

/**
 * Snap types for visual indicators
 * - endpoint: Snap to line/wall endpoints (Symbol: Square)
 * - midpoint: Snap to midpoint of line/wall (Symbol: Triangle)
 * - perpendicular: Snap perpendicular to line (Symbol: Right angle)
 * - nearest: Snap to nearest point on line (Symbol: X)
 * - grid: Snap to grid intersection
 * - none: No snap active
 */
export type SnapType = 'endpoint' | 'midpoint' | 'perpendicular' | 'nearest' | 'grid' | 'none';

/**
 * Snap result with type information
 */
export interface SnapResult {
  point: Point2D;
  type: SnapType;
  /** The line segment this snap relates to (for perpendicular/midpoint/nearest) */
  sourceSegment?: LineSegment;
  /** The original reference point (for perpendicular calculation) */
  referencePoint?: Point2D;
}

/**
 * Snap settings for individual snap types
 */
export interface SnapSettings {
  enabled: boolean;
  endpoint: boolean;
  midpoint: boolean;
  perpendicular: boolean;
  nearest: boolean;
  grid: boolean;
  orthogonal: boolean;
}
