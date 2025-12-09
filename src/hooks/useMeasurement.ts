import { useCallback } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import { useToolStore, useMeasurementStore } from '@/store';
import { useSnap } from './useSnap';
import type { Point3D } from '@/types/geometry';

/**
 * Hook for handling measurement tool interactions
 * Two-click placement: first click = start, second click = end
 * Uses snap system for precise point placement
 */
export function useMeasurement() {
  const { activeTool } = useToolStore();
  const {
    placementState,
    measurements,
    selectedMeasurementId,
    startPlacement,
    updatePreview,
    completePlacement,
    cancelPlacement,
    selectMeasurement,
    removeMeasurement,
    removeSelectedMeasurement,
    clearMeasurements,
  } = useMeasurementStore();

  // Use centralized snap hook
  const { snapFromEvent } = useSnap();

  /**
   * Convert Three.js intersection point to snapped 3D point
   */
  const toPoint3D = useCallback(
    (event: ThreeEvent<PointerEvent>): Point3D => {
      const result = snapFromEvent(event);
      // Get Z from intersection
      const z = event.point?.z ?? 0;
      return {
        x: result.point.x,
        y: result.point.y,
        z,
      };
    },
    [snapFromEvent]
  );

  /**
   * Handle pointer down - start or complete measurement
   */
  const handlePointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (activeTool !== 'measure') return;

      // Only respond to left click
      if (event.button !== 0) return;

      event.stopPropagation();

      const point = toPoint3D(event);

      if (!placementState.isPlacing) {
        // First click - set start point
        startPlacement(point);
      } else {
        // Second click - complete measurement
        completePlacement(point);
      }
    },
    [activeTool, placementState.isPlacing, toPoint3D, startPlacement, completePlacement]
  );

  /**
   * Handle pointer move - update preview
   */
  const handlePointerMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (activeTool !== 'measure') return;
      if (!placementState.isPlacing) return;

      const point = toPoint3D(event);
      updatePreview(point);
    },
    [activeTool, placementState.isPlacing, toPoint3D, updatePreview]
  );

  /**
   * Handle click on measurement (for selection/deletion)
   */
  const handleMeasurementClick = useCallback(
    (measurementId: string, event?: ThreeEvent<MouseEvent>) => {
      if (event) {
        event.stopPropagation();
      }
      selectMeasurement(measurementId);
    },
    [selectMeasurement]
  );

  /**
   * Handle right-click to cancel placement
   */
  const handleContextMenu = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      if (activeTool !== 'measure') return;

      event.nativeEvent.preventDefault();
      event.stopPropagation();

      if (placementState.isPlacing) {
        cancelPlacement();
      }
    },
    [activeTool, placementState.isPlacing, cancelPlacement]
  );

  /**
   * Calculate preview measurement values
   */
  const getPreviewMeasurement = useCallback(() => {
    if (!placementState.isPlacing || !placementState.startPoint || !placementState.previewEndPoint) {
      return null;
    }

    const start = placementState.startPoint;
    const end = placementState.previewEndPoint;
    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;
    const deltaZ = end.z - start.z;
    const totalDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ);

    return {
      startPoint: start,
      endPoint: end,
      deltaX,
      deltaY,
      deltaZ,
      totalDistance,
    };
  }, [placementState]);

  return {
    // Event handlers
    handlePointerDown,
    handlePointerMove,
    handleContextMenu,
    handleMeasurementClick,
    // State
    isPlacing: placementState.isPlacing,
    startPoint: placementState.startPoint,
    previewEndPoint: placementState.previewEndPoint,
    measurements,
    selectedMeasurementId,
    // Preview data
    getPreviewMeasurement,
    // Actions
    cancelPlacement,
    removeMeasurement,
    removeSelectedMeasurement,
    clearMeasurements,
    selectMeasurement,
  };
}
