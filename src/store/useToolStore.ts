import { create } from 'zustand';
import type {
  ToolType,
  WallPlacementState,
  SlabPlacementState,
  SlabCompletionDialogState,
  DoorPlacementState,
  DoorPlacementParams,
  WindowPlacementState,
  WindowPlacementParams,
  CursorStyle,
} from '@/types/tools';
import type { Point2D } from '@/types/geometry';
import type { DoorType, WindowType } from '@/types/bim';
import {
  DEFAULT_DOOR_WIDTH,
  DEFAULT_DOOR_HEIGHT,
  DEFAULT_WINDOW_WIDTH,
  DEFAULT_DOUBLE_WINDOW_WIDTH,
  DEFAULT_FIXED_WINDOW_WIDTH,
  DEFAULT_WINDOW_HEIGHT,
  DEFAULT_WINDOW_SILL_HEIGHT,
} from '@/types/bim';

interface ToolState {
  activeTool: ToolType;
  wallPlacement: WallPlacementState;
  slabPlacement: SlabPlacementState;
  slabCompletionDialog: SlabCompletionDialogState;
  doorPlacement: DoorPlacementState;
  windowPlacement: WindowPlacementState;
}

interface ToolActions {
  // Tool selection
  setActiveTool: (tool: ToolType) => void;

  // Wall placement
  setWallStartPoint: (point: Point2D | null) => void;
  setWallPreviewEndPoint: (point: Point2D | null) => void;
  setWallIsPlacing: (isPlacing: boolean) => void;
  resetWallPlacement: () => void;

  // Slab placement
  addSlabPoint: (point: Point2D) => void;
  setSlabPreviewPoint: (point: Point2D | null) => void;
  resetSlabPlacement: () => void;
  finishSlabPlacement: () => Point2D[];

  // Slab completion dialog
  openSlabCompletionDialog: (points: Point2D[]) => void;
  closeSlabCompletionDialog: () => void;
  getSlabCompletionPoints: () => Point2D[];

  // Door placement
  setDoorParams: (params: Partial<DoorPlacementParams>) => void;
  setDoorType: (doorType: DoorType) => void;
  setDoorWidth: (width: number) => void;
  setDoorHeight: (height: number) => void;
  setDoorSwingDirection: (direction: 'left' | 'right') => void;
  setDoorPreview: (
    hostWallId: string | null,
    position: number | null,
    distanceFromLeft: number | null,
    distanceFromRight: number | null,
    isValid: boolean
  ) => void;
  resetDoorPlacement: () => void;

  // Window placement
  setWindowParams: (params: Partial<WindowPlacementParams>) => void;
  setWindowType: (windowType: WindowType) => void;
  setWindowWidth: (width: number) => void;
  setWindowHeight: (height: number) => void;
  setWindowSillHeight: (sillHeight: number) => void;
  setWindowPreview: (
    hostWallId: string | null,
    position: number | null,
    distanceFromLeft: number | null,
    distanceFromRight: number | null,
    isValid: boolean
  ) => void;
  resetWindowPlacement: () => void;

  // Utility
  getCursorStyle: () => CursorStyle;
  cancelCurrentOperation: () => void;
}

const initialWallPlacement: WallPlacementState = {
  startPoint: null,
  previewEndPoint: null,
  isPlacing: false,
};

const initialSlabPlacement: SlabPlacementState = {
  points: [],
  previewPoint: null,
  isDrawing: false,
};

const initialSlabCompletionDialog: SlabCompletionDialogState = {
  isOpen: false,
  pendingPoints: [],
};

const initialDoorPlacementParams: DoorPlacementParams = {
  doorType: 'single',
  width: DEFAULT_DOOR_WIDTH,
  height: DEFAULT_DOOR_HEIGHT,
  swingDirection: 'left',
};

const initialDoorPlacement: DoorPlacementState = {
  params: initialDoorPlacementParams,
  previewPosition: null,
  hostWallId: null,
  distanceFromLeft: null,
  distanceFromRight: null,
  isValidPosition: false,
};

const initialWindowPlacementParams: WindowPlacementParams = {
  windowType: 'single',
  width: DEFAULT_WINDOW_WIDTH,
  height: DEFAULT_WINDOW_HEIGHT,
  sillHeight: DEFAULT_WINDOW_SILL_HEIGHT,
};

/**
 * Get default window width for a given window type
 */
function getDefaultWindowWidth(windowType: WindowType): number {
  switch (windowType) {
    case 'single':
      return DEFAULT_WINDOW_WIDTH;
    case 'double':
      return DEFAULT_DOUBLE_WINDOW_WIDTH;
    case 'fixed':
      return DEFAULT_FIXED_WINDOW_WIDTH;
    default:
      return DEFAULT_WINDOW_WIDTH;
  }
}

const initialWindowPlacement: WindowPlacementState = {
  params: initialWindowPlacementParams,
  previewPosition: null,
  hostWallId: null,
  distanceFromLeft: null,
  distanceFromRight: null,
  isValidPosition: false,
};

export const useToolStore = create<ToolState & ToolActions>((set, get) => ({
  activeTool: 'select',
  wallPlacement: initialWallPlacement,
  slabPlacement: initialSlabPlacement,
  slabCompletionDialog: initialSlabCompletionDialog,
  doorPlacement: initialDoorPlacement,
  windowPlacement: initialWindowPlacement,

  // Tool selection
  setActiveTool: (tool) =>
    set({
      activeTool: tool,
      // Reset placement state when changing tools
      wallPlacement: initialWallPlacement,
      slabPlacement: initialSlabPlacement,
      doorPlacement: {
        ...initialDoorPlacement,
        // Keep door params when switching tools
        params: get().doorPlacement.params,
      },
      windowPlacement: {
        ...initialWindowPlacement,
        // Keep window params when switching tools
        params: get().windowPlacement.params,
      },
    }),

  // Wall placement
  setWallStartPoint: (point) =>
    set((state) => ({
      wallPlacement: {
        ...state.wallPlacement,
        startPoint: point,
        isPlacing: point !== null,
      },
    })),

  setWallPreviewEndPoint: (point) =>
    set((state) => ({
      wallPlacement: {
        ...state.wallPlacement,
        previewEndPoint: point,
      },
    })),

  setWallIsPlacing: (isPlacing) =>
    set((state) => ({
      wallPlacement: {
        ...state.wallPlacement,
        isPlacing,
      },
    })),

  resetWallPlacement: () =>
    set({
      wallPlacement: initialWallPlacement,
    }),

  // Slab placement
  addSlabPoint: (point) =>
    set((state) => ({
      slabPlacement: {
        ...state.slabPlacement,
        points: [...state.slabPlacement.points, point],
        isDrawing: true,
      },
    })),

  setSlabPreviewPoint: (point) =>
    set((state) => ({
      slabPlacement: {
        ...state.slabPlacement,
        previewPoint: point,
      },
    })),

  resetSlabPlacement: () =>
    set({
      slabPlacement: initialSlabPlacement,
    }),

  finishSlabPlacement: () => {
    const { slabPlacement } = get();
    const points = [...slabPlacement.points];
    set({ slabPlacement: initialSlabPlacement });
    return points;
  },

  // Slab completion dialog
  openSlabCompletionDialog: (points) =>
    set({
      slabCompletionDialog: {
        isOpen: true,
        pendingPoints: [...points],
      },
      slabPlacement: initialSlabPlacement,
    }),

  closeSlabCompletionDialog: () =>
    set({
      slabCompletionDialog: initialSlabCompletionDialog,
    }),

  getSlabCompletionPoints: () => {
    return [...get().slabCompletionDialog.pendingPoints];
  },

  // Door placement
  setDoorParams: (params) =>
    set((state) => ({
      doorPlacement: {
        ...state.doorPlacement,
        params: {
          ...state.doorPlacement.params,
          ...params,
        },
      },
    })),

  setDoorType: (doorType) =>
    set((state) => ({
      doorPlacement: {
        ...state.doorPlacement,
        params: {
          ...state.doorPlacement.params,
          doorType,
        },
      },
    })),

  setDoorWidth: (width) =>
    set((state) => ({
      doorPlacement: {
        ...state.doorPlacement,
        params: {
          ...state.doorPlacement.params,
          width,
        },
      },
    })),

  setDoorHeight: (height) =>
    set((state) => ({
      doorPlacement: {
        ...state.doorPlacement,
        params: {
          ...state.doorPlacement.params,
          height,
        },
      },
    })),

  setDoorSwingDirection: (direction) =>
    set((state) => ({
      doorPlacement: {
        ...state.doorPlacement,
        params: {
          ...state.doorPlacement.params,
          swingDirection: direction,
        },
      },
    })),

  setDoorPreview: (hostWallId, position, distanceFromLeft, distanceFromRight, isValid) =>
    set((state) => ({
      doorPlacement: {
        ...state.doorPlacement,
        hostWallId,
        previewPosition: position,
        distanceFromLeft,
        distanceFromRight,
        isValidPosition: isValid,
      },
    })),

  resetDoorPlacement: () =>
    set((state) => ({
      doorPlacement: {
        ...initialDoorPlacement,
        // Keep door params
        params: state.doorPlacement.params,
      },
    })),

  // Window placement
  setWindowParams: (params) =>
    set((state) => ({
      windowPlacement: {
        ...state.windowPlacement,
        params: {
          ...state.windowPlacement.params,
          ...params,
        },
      },
    })),

  setWindowType: (windowType) =>
    set((state) => ({
      windowPlacement: {
        ...state.windowPlacement,
        params: {
          ...state.windowPlacement.params,
          windowType,
          // Update width to default for this type
          width: getDefaultWindowWidth(windowType),
        },
      },
    })),

  setWindowWidth: (width) =>
    set((state) => ({
      windowPlacement: {
        ...state.windowPlacement,
        params: {
          ...state.windowPlacement.params,
          width,
        },
      },
    })),

  setWindowHeight: (height) =>
    set((state) => ({
      windowPlacement: {
        ...state.windowPlacement,
        params: {
          ...state.windowPlacement.params,
          height,
        },
      },
    })),

  setWindowSillHeight: (sillHeight) =>
    set((state) => ({
      windowPlacement: {
        ...state.windowPlacement,
        params: {
          ...state.windowPlacement.params,
          sillHeight,
        },
      },
    })),

  setWindowPreview: (hostWallId, position, distanceFromLeft, distanceFromRight, isValid) =>
    set((state) => ({
      windowPlacement: {
        ...state.windowPlacement,
        hostWallId,
        previewPosition: position,
        distanceFromLeft,
        distanceFromRight,
        isValidPosition: isValid,
      },
    })),

  resetWindowPlacement: () =>
    set((state) => ({
      windowPlacement: {
        ...initialWindowPlacement,
        // Keep window params
        params: state.windowPlacement.params,
      },
    })),

  // Utility
  getCursorStyle: () => {
    const { activeTool } = get();

    switch (activeTool) {
      case 'select':
        return 'default';
      case 'wall':
      case 'door':
      case 'window':
      case 'column':
      case 'slab':
        return 'crosshair';
      case 'pan':
        return 'grab';
      case 'orbit':
        return 'grab';
      default:
        return 'default';
    }
  },

  cancelCurrentOperation: () => {
    const { activeTool, doorPlacement, windowPlacement } = get();

    if (activeTool === 'wall') {
      set({ wallPlacement: initialWallPlacement });
    }
    if (activeTool === 'slab') {
      set({ slabPlacement: initialSlabPlacement });
    }
    if (activeTool === 'door') {
      set({
        doorPlacement: {
          ...initialDoorPlacement,
          params: doorPlacement.params,
        },
      });
    }
    if (activeTool === 'window') {
      set({
        windowPlacement: {
          ...initialWindowPlacement,
          params: windowPlacement.params,
        },
      });
    }
  },
}));
