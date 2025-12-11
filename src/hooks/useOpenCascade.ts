/**
 * React Hook for OpenCascade.js Operations
 *
 * Provides lazy initialization, loading states, and OCCT operations.
 * Integrates with useSettingsStore for feature flag management.
 *
 * Usage:
 *   const { isReady, isLoading, error, booleanOp, filletOp, extrude } = useOpenCascade();
 *
 *   if (isReady) {
 *     const result = await booleanOp({ type: 'cut', objectId, toolId });
 *   }
 */

import { useCallback, useEffect, useRef } from 'react';
import { useSettingsStore } from '@/store/useSettingsStore';
import {
  initOpenCascade,
  terminateOpenCascade,
  isOcctReady,
  booleanOperation,
  filletOperation,
  extrudeProfile,
  createBox,
  createCylinder,
  getMesh,
  disposeShape,
  disposeAllShapes,
} from '@/lib/opencascade';
import type {
  BoxParams,
  CylinderParams,
  ExtrusionParams,
  BooleanOperationParams,
  FilletParams,
  ShapeCreationResult,
  MeshData,
} from '@/lib/opencascade';

interface UseOpenCascadeReturn {
  /** Whether OCCT feature is enabled in settings */
  isEnabled: boolean;
  /** Whether OCCT is fully initialized and ready */
  isReady: boolean;
  /** Whether OCCT is currently loading */
  isLoading: boolean;
  /** Error message if initialization failed */
  error: string | null;

  // Operations (only call when isReady is true)
  /** Create a box primitive */
  createBox: (params: BoxParams) => Promise<ShapeCreationResult | null>;
  /** Create a cylinder primitive */
  createCylinder: (params: CylinderParams) => Promise<ShapeCreationResult | null>;
  /** Extrude a 2D profile into a solid */
  extrude: (params: ExtrusionParams) => Promise<ShapeCreationResult | null>;
  /** Perform boolean operation (cut, fuse, common) */
  booleanOp: (params: BooleanOperationParams) => Promise<ShapeCreationResult | null>;
  /** Apply fillet to edges */
  filletOp: (params: FilletParams) => Promise<ShapeCreationResult | null>;
  /** Get mesh data from existing shape */
  getMesh: (shapeId: string) => Promise<MeshData | null>;
  /** Dispose a single shape */
  disposeShape: (shapeId: string) => Promise<boolean>;
  /** Dispose all shapes */
  disposeAll: () => Promise<void>;

  // Manual control
  /** Manually initialize OCCT (usually automatic) */
  initialize: () => Promise<void>;
  /** Manually terminate OCCT */
  terminate: () => void;
}

/**
 * Hook for OpenCascade.js operations with automatic initialization
 *
 * @param autoInit - Whether to auto-initialize when enabled (default: true)
 */
export function useOpenCascade(autoInit = true): UseOpenCascadeReturn {
  const { useOpenCascade: isEnabled, occtLoadState, occtError, setOcctLoadState } = useSettingsStore();

  const initializingRef = useRef(false);

  // Derive states from store
  const isReady = occtLoadState === 'ready';
  const isLoading = occtLoadState === 'loading';

  /**
   * Initialize OCCT engine
   */
  const initialize = useCallback(async () => {
    // Prevent duplicate initialization
    if (initializingRef.current || isOcctReady()) {
      if (isOcctReady()) {
        setOcctLoadState('ready');
      }
      return;
    }

    initializingRef.current = true;
    setOcctLoadState('loading');

    try {
      await initOpenCascade();
      setOcctLoadState('ready');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[useOpenCascade] Initialization failed:', message);
      setOcctLoadState('error', message);
    } finally {
      initializingRef.current = false;
    }
  }, [setOcctLoadState]);

  /**
   * Terminate OCCT engine
   */
  const terminate = useCallback(() => {
    terminateOpenCascade();
    setOcctLoadState('idle');
  }, [setOcctLoadState]);

  // Auto-initialize when enabled
  useEffect(() => {
    if (autoInit && isEnabled && occtLoadState === 'idle') {
      initialize();
    }
  }, [autoInit, isEnabled, occtLoadState, initialize]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Don't terminate on unmount - other components might use it
      // terminateOpenCascade();
    };
  }, []);

  // ============================================================================
  // Wrapped Operations (with null safety)
  // ============================================================================

  const safeCreateBox = useCallback(
    async (params: BoxParams): Promise<ShapeCreationResult | null> => {
      if (!isReady) {
        console.warn('[useOpenCascade] OCCT not ready for createBox');
        return null;
      }
      try {
        return await createBox(params);
      } catch (err) {
        console.error('[useOpenCascade] createBox failed:', err);
        return null;
      }
    },
    [isReady]
  );

  const safeCreateCylinder = useCallback(
    async (params: CylinderParams): Promise<ShapeCreationResult | null> => {
      if (!isReady) {
        console.warn('[useOpenCascade] OCCT not ready for createCylinder');
        return null;
      }
      try {
        return await createCylinder(params);
      } catch (err) {
        console.error('[useOpenCascade] createCylinder failed:', err);
        return null;
      }
    },
    [isReady]
  );

  const safeExtrude = useCallback(
    async (params: ExtrusionParams): Promise<ShapeCreationResult | null> => {
      if (!isReady) {
        console.warn('[useOpenCascade] OCCT not ready for extrude');
        return null;
      }
      try {
        return await extrudeProfile(params);
      } catch (err) {
        console.error('[useOpenCascade] extrude failed:', err);
        return null;
      }
    },
    [isReady]
  );

  const safeBooleanOp = useCallback(
    async (params: BooleanOperationParams): Promise<ShapeCreationResult | null> => {
      if (!isReady) {
        console.warn('[useOpenCascade] OCCT not ready for boolean operation');
        return null;
      }
      try {
        return await booleanOperation(params);
      } catch (err) {
        console.error('[useOpenCascade] Boolean operation failed:', err);
        return null;
      }
    },
    [isReady]
  );

  const safeFilletOp = useCallback(
    async (params: FilletParams): Promise<ShapeCreationResult | null> => {
      if (!isReady) {
        console.warn('[useOpenCascade] OCCT not ready for fillet operation');
        return null;
      }
      try {
        return await filletOperation(params);
      } catch (err) {
        console.error('[useOpenCascade] Fillet operation failed:', err);
        return null;
      }
    },
    [isReady]
  );

  const safeGetMesh = useCallback(
    async (shapeId: string): Promise<MeshData | null> => {
      if (!isReady) {
        console.warn('[useOpenCascade] OCCT not ready for getMesh');
        return null;
      }
      try {
        return await getMesh(shapeId);
      } catch (err) {
        console.error('[useOpenCascade] getMesh failed:', err);
        return null;
      }
    },
    [isReady]
  );

  const safeDisposeShape = useCallback(
    async (shapeId: string): Promise<boolean> => {
      if (!isReady) return false;
      try {
        return await disposeShape(shapeId);
      } catch (err) {
        console.error('[useOpenCascade] disposeShape failed:', err);
        return false;
      }
    },
    [isReady]
  );

  const safeDisposeAll = useCallback(async (): Promise<void> => {
    if (!isReady) return;
    try {
      await disposeAllShapes();
    } catch (err) {
      console.error('[useOpenCascade] disposeAll failed:', err);
    }
  }, [isReady]);

  return {
    isEnabled,
    isReady,
    isLoading,
    error: occtError,

    createBox: safeCreateBox,
    createCylinder: safeCreateCylinder,
    extrude: safeExtrude,
    booleanOp: safeBooleanOp,
    filletOp: safeFilletOp,
    getMesh: safeGetMesh,
    disposeShape: safeDisposeShape,
    disposeAll: safeDisposeAll,

    initialize,
    terminate,
  };
}
