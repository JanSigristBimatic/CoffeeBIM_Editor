import { create } from 'zustand';
import type { Point3D } from '@/types/geometry';

/**
 * A single measurement between two points
 */
export interface Measurement {
  id: string;
  startPoint: Point3D;
  endPoint: Point3D;
  /** Delta along X axis (red) */
  deltaX: number;
  /** Delta along Y axis (green) */
  deltaY: number;
  /** Delta along Z axis (blue) */
  deltaZ: number;
  /** Total distance (cyan) */
  totalDistance: number;
  /** Creation timestamp */
  createdAt: number;
}

/**
 * State for active measurement placement
 */
export interface MeasurementPlacementState {
  /** First point of measurement (null if not placing) */
  startPoint: Point3D | null;
  /** Preview end point (follows cursor) */
  previewEndPoint: Point3D | null;
  /** Whether we're actively placing a measurement */
  isPlacing: boolean;
}

interface MeasurementState {
  /** All completed measurements */
  measurements: Measurement[];
  /** Current placement state */
  placementState: MeasurementPlacementState;
  /** Selected measurement ID for deletion */
  selectedMeasurementId: string | null;
}

interface MeasurementActions {
  /** Add a completed measurement */
  addMeasurement: (startPoint: Point3D, endPoint: Point3D) => string;
  /** Remove a measurement by ID */
  removeMeasurement: (id: string) => void;
  /** Remove selected measurement */
  removeSelectedMeasurement: () => void;
  /** Clear all measurements */
  clearMeasurements: () => void;
  /** Select a measurement */
  selectMeasurement: (id: string | null) => void;
  /** Start placing a new measurement */
  startPlacement: (startPoint: Point3D) => void;
  /** Update preview end point during placement */
  updatePreview: (endPoint: Point3D) => void;
  /** Complete the placement (creates measurement) */
  completePlacement: (endPoint: Point3D) => string | null;
  /** Cancel current placement */
  cancelPlacement: () => void;
}

/**
 * Calculate measurement values from two points
 */
function calculateMeasurement(startPoint: Point3D, endPoint: Point3D): Omit<Measurement, 'id' | 'createdAt'> {
  const deltaX = endPoint.x - startPoint.x;
  const deltaY = endPoint.y - startPoint.y;
  const deltaZ = endPoint.z - startPoint.z;
  const totalDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ);

  return {
    startPoint,
    endPoint,
    deltaX,
    deltaY,
    deltaZ,
    totalDistance,
  };
}

/**
 * Generate a unique ID for measurements
 */
function generateId(): string {
  return `meas_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

const initialPlacementState: MeasurementPlacementState = {
  startPoint: null,
  previewEndPoint: null,
  isPlacing: false,
};

export const useMeasurementStore = create<MeasurementState & MeasurementActions>((set, get) => ({
  measurements: [],
  placementState: initialPlacementState,
  selectedMeasurementId: null,

  addMeasurement: (startPoint, endPoint) => {
    const id = generateId();
    const measurement: Measurement = {
      id,
      ...calculateMeasurement(startPoint, endPoint),
      createdAt: Date.now(),
    };

    set((state) => ({
      measurements: [...state.measurements, measurement],
    }));

    return id;
  },

  removeMeasurement: (id) => {
    set((state) => ({
      measurements: state.measurements.filter((m) => m.id !== id),
      selectedMeasurementId: state.selectedMeasurementId === id ? null : state.selectedMeasurementId,
    }));
  },

  removeSelectedMeasurement: () => {
    const { selectedMeasurementId } = get();
    if (selectedMeasurementId) {
      get().removeMeasurement(selectedMeasurementId);
    }
  },

  clearMeasurements: () => {
    set({
      measurements: [],
      selectedMeasurementId: null,
    });
  },

  selectMeasurement: (id) => {
    set({ selectedMeasurementId: id });
  },

  startPlacement: (startPoint) => {
    set({
      placementState: {
        startPoint,
        previewEndPoint: startPoint,
        isPlacing: true,
      },
      selectedMeasurementId: null,
    });
  },

  updatePreview: (endPoint) => {
    set((state) => ({
      placementState: {
        ...state.placementState,
        previewEndPoint: endPoint,
      },
    }));
  },

  completePlacement: (endPoint) => {
    const { placementState } = get();
    if (!placementState.isPlacing || !placementState.startPoint) {
      return null;
    }

    // Don't create measurement if points are the same
    const start = placementState.startPoint;
    const dx = endPoint.x - start.x;
    const dy = endPoint.y - start.y;
    const dz = endPoint.z - start.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (distance < 0.001) {
      // Less than 1mm, cancel
      get().cancelPlacement();
      return null;
    }

    const id = get().addMeasurement(start, endPoint);

    set({
      placementState: initialPlacementState,
    });

    return id;
  },

  cancelPlacement: () => {
    set({
      placementState: initialPlacementState,
    });
  },
}));
