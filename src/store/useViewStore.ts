import { create } from 'zustand';
import type { ViewMode } from '@/types/tools';
import type { SnapSettings } from '@/types/geometry';
import type { Vector3 } from '@/types/geometry';
import type { DimensionSettings } from '@/types/dimensions';
import { DEFAULT_DIMENSION_SETTINGS } from '@/types/dimensions';

interface ViewState {
  viewMode: ViewMode; // '2d' | '3d' | 'split'
  showGrid: boolean;
  showAxes: boolean;
  gridSize: number; // Grid cell size in meters
  snapToGrid: boolean;
  snapSize: number; // Snap increment in meters
  snapSettings: SnapSettings;
  // Camera focus
  focusTarget: Vector3 | null;
  // Ghost storey visibility
  showStoreyAbove: boolean;
  showStoreyBelow: boolean;
  ghostOpacity: number; // 0-1, default 0.3
  // Split view ratio (only used when viewMode === 'split')
  splitRatio: number; // 0-1, position of splitter
  // 2D CAD specific
  cad2dZoom: number;
  cad2dPanX: number;
  cad2dPanY: number;
  // Zoom to extents trigger
  zoomToExtentsTrigger: number;
  // Dimensions
  showDimensions: boolean;
  dimensionSettings: DimensionSettings;
  // Spaces visibility
  showSpaces: boolean;
  showSpaceLabels: boolean;
}

interface ViewActions {
  setViewMode: (mode: ViewMode) => void;
  cycleViewMode: () => void; // Cycles through 2d → 3d → split → 2d
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
  // Ghost storey visibility
  setShowStoreyAbove: (show: boolean) => void;
  toggleStoreyAbove: () => void;
  setShowStoreyBelow: (show: boolean) => void;
  toggleStoreyBelow: () => void;
  setGhostOpacity: (opacity: number) => void;
  // Split view
  setSplitRatio: (ratio: number) => void;
  // 2D CAD navigation
  setCad2dZoom: (zoom: number) => void;
  setCad2dPan: (x: number, y: number) => void;
  zoomToExtents2d: () => void;
  // Zoom to extents trigger (for both 2D and 3D)
  zoomToExtentsTrigger: number; // Incremented to trigger zoom
  triggerZoomToExtents: () => void;
  // Dimensions
  setShowDimensions: (show: boolean) => void;
  toggleDimensions: () => void;
  setDimensionSettings: (settings: Partial<DimensionSettings>) => void;
  // Spaces visibility
  setShowSpaces: (show: boolean) => void;
  toggleSpaces: () => void;
  setShowSpaceLabels: (show: boolean) => void;
  toggleSpaceLabels: () => void;
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
  viewMode: 'split', // Default: vertical split with 2D left, 3D right
  showGrid: true,
  showAxes: true,
  gridSize: 0.1, // 10cm
  snapToGrid: true,
  snapSize: 0.1, // 10 cm
  snapSettings: defaultSnapSettings,
  focusTarget: null,
  // Ghost storey defaults
  showStoreyAbove: false,
  showStoreyBelow: true, // Default: show storey below for context
  ghostOpacity: 0.25,
  // Split view defaults
  splitRatio: 0.5, // 50/50 split
  // 2D CAD defaults
  cad2dZoom: 50, // pixels per meter
  cad2dPanX: 0,
  cad2dPanY: 0,
  // Zoom to extents trigger
  zoomToExtentsTrigger: 0,
  // Dimensions defaults
  showDimensions: true, // Show dimensions by default
  dimensionSettings: DEFAULT_DIMENSION_SETTINGS,
  // Spaces visibility defaults
  showSpaces: true, // Show spaces by default
  showSpaceLabels: true, // Show space labels by default

  setViewMode: (mode) => set({ viewMode: mode }),

  cycleViewMode: () =>
    set((state) => {
      const modes: ViewMode[] = ['2d', '3d', 'split'];
      const currentIndex = modes.indexOf(state.viewMode);
      const nextIndex = (currentIndex + 1) % modes.length;
      return { viewMode: modes[nextIndex] };
    }),

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

  // Ghost storey visibility
  setShowStoreyAbove: (show) => set({ showStoreyAbove: show }),
  toggleStoreyAbove: () =>
    set((state) => ({ showStoreyAbove: !state.showStoreyAbove })),
  setShowStoreyBelow: (show) => set({ showStoreyBelow: show }),
  toggleStoreyBelow: () =>
    set((state) => ({ showStoreyBelow: !state.showStoreyBelow })),
  setGhostOpacity: (opacity) => set({ ghostOpacity: Math.max(0, Math.min(1, opacity)) }),

  // Split view
  setSplitRatio: (ratio) => set({ splitRatio: Math.max(0.1, Math.min(0.9, ratio)) }),

  // 2D CAD navigation
  setCad2dZoom: (zoom) => set({ cad2dZoom: Math.max(1, Math.min(500, zoom)) }),

  setCad2dPan: (x, y) => set({ cad2dPanX: x, cad2dPanY: y }),

  zoomToExtents2d: () => {
    // This will be called from the Canvas2D component
    // It needs access to element bounds, so we just reset to defaults here
    set({ cad2dZoom: 50, cad2dPanX: 0, cad2dPanY: 0 });
  },

  triggerZoomToExtents: () =>
    set((state) => ({ zoomToExtentsTrigger: state.zoomToExtentsTrigger + 1 })),

  // Dimensions
  setShowDimensions: (show) => set({ showDimensions: show }),

  toggleDimensions: () =>
    set((state) => ({ showDimensions: !state.showDimensions })),

  setDimensionSettings: (settings) =>
    set((state) => ({
      dimensionSettings: { ...state.dimensionSettings, ...settings },
    })),

  // Spaces visibility
  setShowSpaces: (show) => set({ showSpaces: show }),
  toggleSpaces: () => set((state) => ({ showSpaces: !state.showSpaces })),
  setShowSpaceLabels: (show) => set({ showSpaceLabels: show }),
  toggleSpaceLabels: () => set((state) => ({ showSpaceLabels: !state.showSpaceLabels })),
}));
