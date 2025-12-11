/**
 * OpenCascade.js TypeScript Type Definitions
 *
 * Defines interfaces for OCCT operations used in CoffeeBIM Editor.
 * Based on opencascade.js API and Context7 documentation.
 */

import type { Point2D } from '@/types/geometry';

// ============================================================================
// Core Types
// ============================================================================

/**
 * Represents an OpenCascade shape (TopoDS_Shape wrapper)
 * The actual shape data is managed in the Web Worker
 */
export interface OcctShapeHandle {
  /** Unique identifier for shape tracking in worker */
  id: string;
  /** Shape type for debugging */
  type: 'solid' | 'shell' | 'face' | 'wire' | 'edge' | 'vertex' | 'compound';
}

/**
 * 3D Vector
 */
export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

/**
 * Triangulated mesh data for Three.js rendering
 */
export interface MeshData {
  vertices: Float32Array;
  indices: Uint32Array;
  normals: Float32Array;
}

// ============================================================================
// Operation Parameters
// ============================================================================

/**
 * Boolean operation types following OCCT naming
 */
export type BooleanOperationType = 'cut' | 'fuse' | 'common';

/**
 * Parameters for Boolean operations (BRepAlgoAPI_Cut/Fuse/Common)
 */
export interface BooleanOperationParams {
  /** Type of boolean operation */
  type: BooleanOperationType;
  /** Object shape (the shape being modified) */
  objectId: string;
  /** Tool shape (the shape used to modify) */
  toolId: string;
  /**
   * Fuzzy tolerance value for coincidence detection.
   * Should be significantly smaller than minimum geometry size.
   * Default: 0.001 (1mm)
   */
  fuzzyValue?: number;
}

/**
 * Parameters for Fillet operation (BRepFilletAPI_MakeFillet)
 */
export interface FilletParams {
  /** Shape to apply fillet to */
  shapeId: string;
  /** Fillet radius in meters */
  radius: number;
  /**
   * Specific edge indices to fillet.
   * If empty/undefined, all edges are filleted.
   */
  edgeIndices?: number[];
}

/**
 * Parameters for Chamfer operation (BRepFilletAPI_MakeChamfer)
 */
export interface ChamferParams {
  /** Shape to apply chamfer to */
  shapeId: string;
  /** Chamfer distance */
  distance: number;
  /** Specific edge indices to chamfer */
  edgeIndices?: number[];
}

/**
 * Parameters for profile extrusion (BRepPrimAPI_MakePrism)
 */
export interface ExtrusionParams {
  /** 2D profile points (closed polygon) */
  profile: Point2D[];
  /** Extrusion height/depth */
  height: number;
  /**
   * Extrusion direction vector.
   * Default: { x: 0, y: 0, z: 1 } (Z-up)
   */
  direction?: Vector3D;
  /**
   * Position offset for the extruded shape
   */
  position?: Vector3D;
}

/**
 * Parameters for creating a box primitive
 */
export interface BoxParams {
  /** Width (X dimension) */
  width: number;
  /** Depth (Y dimension) */
  depth: number;
  /** Height (Z dimension) */
  height: number;
  /** Position of the box origin */
  position?: Vector3D;
}

/**
 * Parameters for creating a cylinder primitive
 */
export interface CylinderParams {
  /** Cylinder radius */
  radius: number;
  /** Cylinder height */
  height: number;
  /** Position of the cylinder base center */
  position?: Vector3D;
}

// ============================================================================
// Worker Message Types
// ============================================================================

/**
 * Message types for worker communication
 */
export type WorkerMessageType =
  | 'init'
  | 'createBox'
  | 'createCylinder'
  | 'extrude'
  | 'boolean'
  | 'fillet'
  | 'chamfer'
  | 'getMesh'
  | 'dispose'
  | 'disposeAll';

/**
 * Request message to worker
 */
export interface WorkerRequest {
  id: number;
  type: WorkerMessageType;
  payload?: unknown;
}

/**
 * Response message from worker
 */
export interface WorkerResponse {
  id: number;
  type: 'result' | 'error' | 'init';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any; // Flexible type for various response shapes
  error?: string;
  success?: boolean;
}

// ============================================================================
// Result Types
// ============================================================================

/**
 * Result of a shape creation operation
 */
export interface ShapeCreationResult {
  handle: OcctShapeHandle;
  mesh: MeshData;
}

/**
 * Result of a boolean operation
 */
export interface BooleanOperationResult {
  handle: OcctShapeHandle;
  mesh: MeshData;
}

/**
 * Result of a fillet/chamfer operation
 */
export interface FilletResult {
  handle: OcctShapeHandle;
  mesh: MeshData;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * OpenCascade operation error
 */
export class OcctOperationError extends Error {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly details?: string
  ) {
    super(`OCCT ${operation} failed: ${message}`);
    this.name = 'OcctOperationError';
  }
}

/**
 * WebAssembly initialization error
 */
export class OcctInitError extends Error {
  constructor(message: string) {
    super(`OCCT initialization failed: ${message}`);
    this.name = 'OcctInitError';
  }
}
