import { create } from 'zustand';
import type { ViewMode } from '@/types/tools';
import type { SnapSettings } from '@/types/geometry';
import type { Vector3 } from '@/types/geometry';

interface ViewState {
  viewMode: ViewMode;
  showGrid: boolean;
  showAxes: boolean;
  gridSize: number; // Grid cell size in meters
  snapToGrid: boolean;
  snapSize: number; // Snap increment in meters
  snapSettings: SnapSettings;
  // Camera focus
  focusTarget: Vector3 | null;
}

interface ViewActions {
  setViewMode: (mode: ViewMode) => void;
  toggleViewMode: () => void;
  setShowGrid: (show: boolean) => void;
  toggleGrid: () => void;
  setShowAxes: (show: boolean) => void;
  toggleAxes: () => void;
  setGridSize: (size: number) => void;
  setSnapToGrid: (snap: boolean) => void;
  toggleSnapToGrid: () => void;
  setSnapSize: (size: number) => void;
  // Snap settings
  setSnapSettings: (settings: Partial<SnapSettings>) => void;
  toggleSnapEndpoint: () => void;
  toggleSnapMidpoint: () => void;
  toggleSnapPerpendicular: () => void;
  toggleSnapNearest: () => void;
  toggleSnapGrid: () => void;
  toggleSnapOrthogonal: () => void;
  // Camera focus
  focusOnPosition: (target: Vector3) => void;
  clearFocusTarget: () => void;
}

const defaultSnapSettings: SnapSettings = {
  enabled: true,
  endpoint: true,
  midpoint: true,
  perpendicular: true,
  nearest: true,
  grid: true,
  orthogonal: false,
};

export const useViewStore = create<ViewState & ViewActions>((set) => ({
  viewMode: '3d',
  showGrid: true,
  showAxes: true,
  gridSize: 1, // 1 meter
  snapToGrid: true,
  snapSize: 0.1, // 10 cm
  snapSettings: defaultSnapSettings,
  focusTarget: null,

  setViewMode: (mode) => set({ viewMode: mode }),

  toggleViewMode: () =>
    set((state) => ({
      viewMode: state.viewMode === '2d' ? '3d' : '2d',
    })),

  setShowGrid: (show) => set({ showGrid: show }),

  toggleGrid: () =>
    set((state) => ({
      showGrid: !state.showGrid,
    })),

  setShowAxes: (show) => set({ showAxes: show }),

  toggleAxes: () =>
    set((state) => ({
      showAxes: !state.showAxes,
    })),

  setGridSize: (size) => set({ gridSize: size }),

  setSnapToGrid: (snap) => set({ snapToGrid: snap }),

  toggleSnapToGrid: () =>
    set((state) => ({
      snapToGrid: !state.snapToGrid,
      snapSettings: {
        ...state.snapSettings,
        enabled: !state.snapToGrid,
      },
    })),

  setSnapSize: (size) => set({ snapSize: size }),

  // Snap settings
  setSnapSettings: (settings) =>
    set((state) => ({
      snapSettings: { ...state.snapSettings, ...settings },
    })),

  toggleSnapEndpoint: () =>
    set((state) => ({
      snapSettings: { ...state.snapSettings, endpoint: !state.snapSettings.endpoint },
    })),

  toggleSnapMidpoint: () =>
    set((state) => ({
      snapSettings: { ...state.snapSettings, midpoint: !state.snapSettings.midpoint },
    })),

  toggleSnapPerpendicular: () =>
    set((state) => ({
      snapSettings: { ...state.snapSettings, perpendicular: !state.snapSettings.perpendicular },
    })),

  toggleSnapNearest: () =>
    set((state) => ({
      snapSettings: { ...state.snapSettings, nearest: !state.snapSettings.nearest },
    })),

  toggleSnapGrid: () =>
    set((state) => ({
      snapSettings: { ...state.snapSettings, grid: !state.snapSettings.grid },
    })),

  toggleSnapOrthogonal: () =>
    set((state) => ({
      snapSettings: { ...state.snapSettings, orthogonal: !state.snapSettings.orthogonal },
    })),

  // Camera focus
  focusOnPosition: (target) => set({ focusTarget: target }),
  clearFocusTarget: () => set({ focusTarget: null }),
}));
