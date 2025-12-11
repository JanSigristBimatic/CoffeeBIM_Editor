/**
 * OpenCascade.js Public API
 *
 * Provides a high-level interface to OCCT operations via Web Worker.
 * Implements lazy loading to minimize initial bundle size.
 *
 * Usage:
 *   import { initOpenCascade, booleanOperation, filletOperation } from '@/lib/opencascade';
 *
 *   await initOpenCascade();
 *   const result = await booleanOperation({ type: 'cut', objectId, toolId });
 */

import type {
  WorkerRequest,
  WorkerResponse,
  BoxParams,
  CylinderParams,
  ExtrusionParams,
  BooleanOperationParams,
  FilletParams,
  MeshData,
  OcctShapeHandle,
  ShapeCreationResult,
} from './types';
import { OcctOperationError, OcctInitError } from './types';

// ============================================================================
// Worker Management
// ============================================================================

let worker: Worker | null = null;
let isInitialized = false;
let initPromise: Promise<void> | null = null;
let messageId = 0;

const pendingRequests = new Map<
  number,
  {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }
>();

/**
 * Creates and initializes the OCCT Web Worker
 */
function createWorker(): Worker {
  // Dynamic import for code splitting
  const workerUrl = new URL('./worker.ts', import.meta.url);
  return new Worker(workerUrl, { type: 'module' });
}

/**
 * Handles messages from the worker
 */
function handleWorkerMessage(event: MessageEvent<WorkerResponse>): void {
  const { id, type, data, error, success } = event.data;

  const pending = pendingRequests.get(id);
  if (!pending) {
    console.warn('[OCCT] Received response for unknown request:', id);
    return;
  }

  pendingRequests.delete(id);

  if (type === 'error') {
    pending.reject(new OcctOperationError(error || 'Unknown error', 'worker'));
  } else if (type === 'init') {
    if (success) {
      pending.resolve(undefined);
    } else {
      pending.reject(new OcctInitError(error || 'Initialization failed'));
    }
  } else {
    pending.resolve(data);
  }
}

/**
 * Sends a request to the worker and returns a promise
 */
function sendRequest<T>(type: WorkerRequest['type'], payload?: unknown): Promise<T> {
  const w = worker;
  if (!w) {
    throw new OcctInitError('Worker not initialized. Call initOpenCascade() first.');
  }

  return new Promise((resolve, reject) => {
    const id = ++messageId;
    pendingRequests.set(id, {
      resolve: resolve as (value: unknown) => void,
      reject,
    });

    const request: WorkerRequest = { id, type, payload };
    w.postMessage(request);
  });
}

// ============================================================================
// Public API - Initialization
// ============================================================================

/**
 * Initializes the OpenCascade.js engine.
 * This downloads and compiles the WASM module (~30MB).
 * Safe to call multiple times - subsequent calls return immediately.
 *
 * @throws {OcctInitError} If initialization fails
 */
export async function initOpenCascade(): Promise<void> {
  if (isInitialized) {
    return;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      // Create worker
      worker = createWorker();
      worker.onmessage = handleWorkerMessage;
      worker.onerror = (error) => {
        console.error('[OCCT] Worker error:', error);
      };

      // Initialize OCCT in worker
      await sendRequest('init');
      isInitialized = true;
      console.log('[OCCT] OpenCascade.js initialized successfully');
    } catch (error) {
      // Clean up on failure
      worker?.terminate();
      worker = null;
      initPromise = null;
      throw error;
    }
  })();

  return initPromise;
}

/**
 * Returns whether OCCT is initialized
 */
export function isOcctReady(): boolean {
  return isInitialized;
}

/**
 * Terminates the worker and releases resources.
 * Can be called to free memory when OCCT is no longer needed.
 */
export function terminateOpenCascade(): void {
  if (worker) {
    worker.terminate();
    worker = null;
  }
  isInitialized = false;
  initPromise = null;
  pendingRequests.clear();
  console.log('[OCCT] OpenCascade.js terminated');
}

// ============================================================================
// Public API - Primitive Creation
// ============================================================================

/**
 * Creates a box primitive
 *
 * @param params Box parameters (width, depth, height, position)
 * @returns Shape handle and mesh data
 */
export async function createBox(params: BoxParams): Promise<ShapeCreationResult> {
  const result = await sendRequest<{ handle: OcctShapeHandle; mesh: MeshData }>('createBox', params);
  return result;
}

/**
 * Creates a cylinder primitive
 *
 * @param params Cylinder parameters (radius, height, position)
 * @returns Shape handle and mesh data
 */
export async function createCylinder(params: CylinderParams): Promise<ShapeCreationResult> {
  const result = await sendRequest<{ handle: OcctShapeHandle; mesh: MeshData }>('createCylinder', params);
  return result;
}

// ============================================================================
// Public API - Extrusion
// ============================================================================

/**
 * Creates a solid by extruding a 2D profile
 *
 * @param params Extrusion parameters (profile points, height, direction)
 * @returns Shape handle and mesh data
 */
export async function extrudeProfile(params: ExtrusionParams): Promise<ShapeCreationResult> {
  const result = await sendRequest<{ handle: OcctShapeHandle; mesh: MeshData }>('extrude', params);
  return result;
}

// ============================================================================
// Public API - Boolean Operations
// ============================================================================

/**
 * Performs a boolean operation between two shapes.
 *
 * Operations:
 * - 'cut': Result = Object - Tool (subtraction)
 * - 'fuse': Result = Object + Tool (union)
 * - 'common': Result = Object ∩ Tool (intersection)
 *
 * @param params Boolean operation parameters
 * @returns New shape handle and mesh data
 *
 * @example
 * // Create wall with door opening
 * const wallShape = await createBox({ width: 5, depth: 0.2, height: 3 });
 * const doorCutter = await createBox({ width: 0.9, depth: 0.3, height: 2.1, position: { x: 1, y: 0, z: 0 } });
 * const result = await booleanOperation({
 *   type: 'cut',
 *   objectId: wallShape.handle.id,
 *   toolId: doorCutter.handle.id,
 * });
 */
export async function booleanOperation(params: BooleanOperationParams): Promise<ShapeCreationResult> {
  const result = await sendRequest<{ handle: OcctShapeHandle; mesh: MeshData }>('boolean', params);
  return result;
}

// ============================================================================
// Public API - Fillet Operations
// ============================================================================

/**
 * Applies a fillet (rounded edge) to a shape.
 *
 * @param params Fillet parameters (shapeId, radius, optional edge indices)
 * @returns New shape handle and mesh data
 *
 * @example
 * // Round all edges of a box with 5cm radius
 * const box = await createBox({ width: 1, depth: 1, height: 1 });
 * const rounded = await filletOperation({
 *   shapeId: box.handle.id,
 *   radius: 0.05,
 * });
 */
export async function filletOperation(params: FilletParams): Promise<ShapeCreationResult> {
  const result = await sendRequest<{ handle: OcctShapeHandle; mesh: MeshData }>('fillet', params);
  return result;
}

// ============================================================================
// Public API - Mesh Operations
// ============================================================================

/**
 * Extracts mesh data from an existing shape.
 * Useful when you need to re-mesh with different parameters.
 *
 * @param shapeId The shape handle ID
 * @returns Triangulated mesh data for Three.js
 */
export async function getMesh(shapeId: string): Promise<MeshData> {
  const result = await sendRequest<MeshData>('getMesh', shapeId);
  return result;
}

// ============================================================================
// Public API - Memory Management
// ============================================================================

/**
 * Disposes a single shape from worker memory.
 * Call this when a shape is no longer needed.
 *
 * @param shapeId The shape handle ID to dispose
 * @returns true if shape was found and disposed
 */
export async function disposeShape(shapeId: string): Promise<boolean> {
  const result = await sendRequest<boolean>('dispose', shapeId);
  return result;
}

/**
 * Disposes all shapes from worker memory.
 * Use this for cleanup when switching projects or on unmount.
 */
export async function disposeAllShapes(): Promise<void> {
  await sendRequest('disposeAll');
}

// ============================================================================
// Re-exports
// ============================================================================

export type {
  OcctShapeHandle,
  MeshData,
  Vector3D,
  BoxParams,
  CylinderParams,
  ExtrusionParams,
  BooleanOperationParams,
  FilletParams,
  ShapeCreationResult,
} from './types';

export { OcctOperationError, OcctInitError } from './types';

// Mesh conversion utilities
export {
  meshDataToGeometry,
  meshDataToMesh,
  meshDataToEdges,
  updateMeshGeometry,
  validateMeshData,
  getMeshStats,
  mergeMeshData,
} from './meshConverter';

// BIM-specific geometry generators
export {
  generateWallMeshOCCT,
  cutOpeningInWall,
  isOcctWallGeometryAvailable,
} from './wallGeometry';

export {
  generateCounterMeshOCCT,
  generateFilletedCountertop,
  isOcctCounterGeometryAvailable,
} from './counterGeometry';
