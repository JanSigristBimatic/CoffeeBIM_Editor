/**
 * 2D point in the XY plane
 */
export interface Point2D {
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
 * Create a unit vector pointing up (Z-up convention for IFC)
 */
export const UP_VECTOR: Vector3 = { x: 0, y: 0, z: 1 };
