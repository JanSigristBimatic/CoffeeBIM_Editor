import { create } from 'zustand';
import type { ViewMode } from '@/types/tools';

interface ViewState {
  viewMode: ViewMode;
  showGrid: boolean;
  showAxes: boolean;
  gridSize: number; // Grid cell size in meters
  snapToGrid: boolean;
  snapSize: number; // Snap increment in meters
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
}

export const useViewStore = create<ViewState & ViewActions>((set) => ({
  viewMode: '3d',
  showGrid: true,
  showAxes: true,
  gridSize: 1, // 1 meter
  snapToGrid: true,
  snapSize: 0.1, // 10 cm

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
    })),

  setSnapSize: (size) => set({ snapSize: size }),
}));
