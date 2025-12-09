import { create } from 'zustand';
import type {
  ToolType,
  WallPlacementState,
  WallPlacementParams,
  SlabPlacementState,
  SlabCompletionDialogState,
  DoorPlacementState,
  DoorPlacementParams,
  WindowPlacementState,
  WindowPlacementParams,
  ColumnPlacementState,
  ColumnPlacementParams,
  ColumnProfileType,
  CounterPlacementState,
  CounterPlacementParams,
  AssetPlacementState,
  AssetPlacementParams,
  SpacePlacementState,
  StairPlacementState,
  StairPlacementParams,
  CursorStyle,
  DistanceInputState,
} from '@/types/tools';
import type { Vector2D } from '@/types/geometry';
import type { Point2D } from '@/types/geometry';
import type { DoorType, DoorSwingSide, WindowType, CounterType, StairType, WallAlignmentSide } from '@/types/bim';
import {
  DEFAULT_DOOR_WIDTH,
  DEFAULT_DOOR_HEIGHT,
  DEFAULT_WINDOW_WIDTH,
  DEFAULT_DOUBLE_WINDOW_WIDTH,
  DEFAULT_FIXED_WINDOW_WIDTH,
  DEFAULT_WINDOW_HEIGHT,
  DEFAULT_WINDOW_SILL_HEIGHT,
  DEFAULT_COLUMN_WIDTH,
  DEFAULT_COLUMN_DEPTH,
  DEFAULT_WALL_HEIGHT,
  DEFAULT_WALL_THICKNESS,
  DEFAULT_WALL_ALIGNMENT,
  DEFAULT_COUNTER_DEPTH,
  DEFAULT_COUNTER_HEIGHT,
  DEFAULT_BAR_COUNTER_HEIGHT,
  DEFAULT_COUNTER_TOP_THICKNESS,
  DEFAULT_COUNTER_OVERHANG,
  DEFAULT_COUNTER_KICK_HEIGHT,
  DEFAULT_COUNTER_KICK_RECESS,
  DEFAULT_COUNTER_FOOTREST_HEIGHT,
  DEFAULT_STAIR_WIDTH,
} from '@/types/bim';

interface ToolState {
  activeTool: ToolType;
  /** Global cursor position for snap preview (independent of placement state) */
  cursorPosition: Point2D | null;
  /** Distance input state for line-based element placement */
  distanceInput: DistanceInputState;
  wallPlacement: WallPlacementState;
  slabPlacement: SlabPlacementState;
  slabCompletionDialog: SlabCompletionDialogState;
  doorPlacement: DoorPlacementState;
  windowPlacement: WindowPlacementState;
  columnPlacement: ColumnPlacementState;
  counterPlacement: CounterPlacementState;
  assetPlacement: AssetPlacementState;
  spacePlacement: SpacePlacementState;
  stairPlacement: StairPlacementState;
}

interface ToolActions {
  // Tool selection
  setActiveTool: (tool: ToolType) => void;

  // Cursor tracking (for snap preview)
  setCursorPosition: (point: Point2D | null) => void;

  // Distance input (for line-based elements)
  setDistanceInputActive: (active: boolean) => void;
  updateDistanceInputValue: (value: string) => void;
  setDistanceDirection: (direction: Vector2D | null) => void;
  setDistanceReferencePoint: (point: Point2D | null) => void;
  appendDistanceInputDigit: (digit: string) => void;
  clearDistanceInput: () => void;
  /** Get the target point based on current distance input and direction */
  getDistanceTargetPoint: () => Point2D | null;

  // Wall placement
  setWallParams: (params: Partial<WallPlacementParams>) => void;
  setWallThickness: (thickness: number) => void;
  setWallHeight: (height: number) => void;
  setWallAlignmentSide: (alignmentSide: WallAlignmentSide) => void;
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
  setDoorSwingSide: (swingSide: DoorSwingSide) => void;
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

  // Column placement
  setColumnParams: (params: Partial<ColumnPlacementParams>) => void;
  setColumnProfileType: (profileType: ColumnProfileType) => void;
  setColumnWidth: (width: number) => void;
  setColumnDepth: (depth: number) => void;
  setColumnHeight: (height: number) => void;
  setColumnPreview: (position: Point2D | null, isValid: boolean) => void;
  resetColumnPlacement: () => void;

  // Counter placement
  setCounterParams: (params: Partial<CounterPlacementParams>) => void;
  setCounterType: (counterType: CounterType) => void;
  setCounterDepth: (depth: number) => void;
  setCounterHeight: (height: number) => void;
  addCounterPoint: (point: Point2D) => void;
  setCounterPreviewPoint: (point: Point2D | null) => void;
  resetCounterPlacement: () => void;
  finishCounterPlacement: () => Point2D[];

  // Asset placement
  setAssetParams: (params: Partial<AssetPlacementParams>) => void;
  setSelectedAsset: (assetId: string | null) => void;
  setAssetScale: (scale: number) => void;
  setAssetRotation: (rotation: number) => void;
  setAssetPreview: (position: Point2D | null, isValid: boolean) => void;
  resetAssetPlacement: () => void;

  // Space placement (for manual polygon drawing)
  addSpacePoint: (point: Point2D) => void;
  setSpacePreviewPoint: (point: Point2D | null) => void;
  resetSpacePlacement: () => void;
  finishSpacePlacement: () => Point2D[];

  // Stair placement
  setStairParams: (params: Partial<StairPlacementParams>) => void;
  setStairType: (stairType: StairType) => void;
  setStairWidth: (width: number) => void;
  setStairTotalRise: (totalRise: number) => void;
  setStairTargetStorey: (storeyId: string | null) => void;
  setStairCreateOpening: (createOpening: boolean) => void;
  setStairStartPoint: (point: Point2D | null) => void;
  setStairPreviewEndPoint: (point: Point2D | null) => void;
  setStairRotation: (rotation: number) => void;
  resetStairPlacement: () => void;

  // Utility
  getCursorStyle: () => CursorStyle;
  cancelCurrentOperation: () => void;
}

const initialDistanceInput: DistanceInputState = {
  active: false,
  value: '',
  direction: null,
  referencePoint: null,
};

const initialWallPlacementParams: WallPlacementParams = {
  thickness: DEFAULT_WALL_THICKNESS,
  height: DEFAULT_WALL_HEIGHT,
  alignmentSide: DEFAULT_WALL_ALIGNMENT,
};

const initialWallPlacement: WallPlacementState = {
  params: initialWallPlacementParams,
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
  swingSide: 'inward',
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

const initialColumnPlacementParams: ColumnPlacementParams = {
  profileType: 'rectangular',
  width: DEFAULT_COLUMN_WIDTH,
  depth: DEFAULT_COLUMN_DEPTH,
  height: DEFAULT_WALL_HEIGHT,
};

const initialColumnPlacement: ColumnPlacementState = {
  params: initialColumnPlacementParams,
  previewPosition: null,
  isValidPosition: true, // Columns can be placed anywhere on the grid
};

/**
 * Get default height based on counter type
 */
function getDefaultCounterHeight(counterType: CounterType): number {
  switch (counterType) {
    case 'bar':
      return DEFAULT_BAR_COUNTER_HEIGHT;
    case 'standard':
    case 'service':
    default:
      return DEFAULT_COUNTER_HEIGHT;
  }
}

/**
 * Get default overhang based on counter type
 */
function getDefaultCounterOverhang(counterType: CounterType): number {
  switch (counterType) {
    case 'bar':
      return 0.3; // 30cm for bar seating
    case 'service':
      return 0; // No overhang for service counters
    default:
      return DEFAULT_COUNTER_OVERHANG;
  }
}

const initialCounterPlacementParams: CounterPlacementParams = {
  counterType: 'standard',
  depth: DEFAULT_COUNTER_DEPTH,
  height: DEFAULT_COUNTER_HEIGHT,
  topThickness: DEFAULT_COUNTER_TOP_THICKNESS,
  overhang: DEFAULT_COUNTER_OVERHANG,
  kickHeight: DEFAULT_COUNTER_KICK_HEIGHT,
  kickRecess: DEFAULT_COUNTER_KICK_RECESS,
  hasFootrest: false,
  footrestHeight: DEFAULT_COUNTER_FOOTREST_HEIGHT,
};

const initialCounterPlacement: CounterPlacementState = {
  params: initialCounterPlacementParams,
  points: [],
  previewPoint: null,
  isDrawing: false,
};

const initialAssetPlacementParams: AssetPlacementParams = {
  assetId: null,
  scale: 1.0,
  rotation: 0,
};

const initialAssetPlacement: AssetPlacementState = {
  params: initialAssetPlacementParams,
  previewPosition: null,
  isValidPosition: true,
};

const initialSpacePlacement: SpacePlacementState = {
  points: [],
  previewPoint: null,
  isDrawing: false,
};

const initialStairPlacementParams: StairPlacementParams = {
  stairType: 'straight',
  width: DEFAULT_STAIR_WIDTH,
  targetStoreyId: null,
  totalRise: 3.0, // Default 3m height
  createOpening: true,
};

const initialStairPlacement: StairPlacementState = {
  params: initialStairPlacementParams,
  startPoint: null,
  previewEndPoint: null,
  isPlacing: false,
  rotation: 0,
};

export const useToolStore = create<ToolState & ToolActions>((set, get) => ({
  activeTool: 'select',
  cursorPosition: null,
  distanceInput: initialDistanceInput,
  wallPlacement: initialWallPlacement,
  slabPlacement: initialSlabPlacement,
  slabCompletionDialog: initialSlabCompletionDialog,
  doorPlacement: initialDoorPlacement,
  windowPlacement: initialWindowPlacement,
  columnPlacement: initialColumnPlacement,
  counterPlacement: initialCounterPlacement,
  assetPlacement: initialAssetPlacement,
  spacePlacement: initialSpacePlacement,
  stairPlacement: initialStairPlacement,

  // Tool selection
  setActiveTool: (tool) =>
    set({
      activeTool: tool,
      cursorPosition: null,
      // Reset distance input and placement state when changing tools
      distanceInput: initialDistanceInput,
      wallPlacement: {
        ...initialWallPlacement,
        // Keep wall params when switching tools
        params: get().wallPlacement.params,
      },
      slabPlacement: initialSlabPlacement,
      spacePlacement: initialSpacePlacement,
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
      columnPlacement: {
        ...initialColumnPlacement,
        // Keep column params when switching tools
        params: get().columnPlacement.params,
      },
      counterPlacement: {
        ...initialCounterPlacement,
        // Keep counter params when switching tools
        params: get().counterPlacement.params,
      },
      assetPlacement: {
        ...initialAssetPlacement,
        // Keep asset params when switching tools
        params: get().assetPlacement.params,
      },
      stairPlacement: {
        ...initialStairPlacement,
        // Keep stair params when switching tools
        params: get().stairPlacement.params,
      },
    }),

  // Cursor tracking (for snap preview before first point is placed)
  setCursorPosition: (point) => set({ cursorPosition: point }),

  // Distance input actions
  setDistanceInputActive: (active) =>
    set((state) => ({
      distanceInput: {
        ...state.distanceInput,
        active,
      },
    })),

  updateDistanceInputValue: (value) =>
    set((state) => ({
      distanceInput: {
        ...state.distanceInput,
        value,
        active: value.length > 0,
      },
    })),

  setDistanceDirection: (direction) =>
    set((state) => ({
      distanceInput: {
        ...state.distanceInput,
        direction,
      },
    })),

  setDistanceReferencePoint: (point) =>
    set((state) => ({
      distanceInput: {
        ...state.distanceInput,
        referencePoint: point,
      },
    })),

  appendDistanceInputDigit: (digit) =>
    set((state) => {
      // Only allow valid input: digits, one decimal point
      const currentValue = state.distanceInput.value;

      // Prevent multiple decimal points
      if (digit === '.' && currentValue.includes('.')) {
        return state;
      }

      // Only allow digits and decimal point
      if (!/^[0-9.]$/.test(digit)) {
        return state;
      }

      const newValue = currentValue + digit;
      return {
        distanceInput: {
          ...state.distanceInput,
          value: newValue,
          active: true,
        },
      };
    }),

  clearDistanceInput: () => set({ distanceInput: initialDistanceInput }),

  getDistanceTargetPoint: () => {
    const { distanceInput } = get();
    const { value, direction, referencePoint } = distanceInput;

    if (!referencePoint || !direction || !value) {
      return null;
    }

    const distance = parseFloat(value);
    if (isNaN(distance) || distance <= 0) {
      return null;
    }

    return {
      x: referencePoint.x + direction.x * distance,
      y: referencePoint.y + direction.y * distance,
    };
  },

  // Wall placement
  setWallParams: (params) =>
    set((state) => ({
      wallPlacement: {
        ...state.wallPlacement,
        params: {
          ...state.wallPlacement.params,
          ...params,
        },
      },
    })),

  setWallThickness: (thickness) =>
    set((state) => ({
      wallPlacement: {
        ...state.wallPlacement,
        params: {
          ...state.wallPlacement.params,
          thickness,
        },
      },
    })),

  setWallHeight: (height) =>
    set((state) => ({
      wallPlacement: {
        ...state.wallPlacement,
        params: {
          ...state.wallPlacement.params,
          height,
        },
      },
    })),

  setWallAlignmentSide: (alignmentSide) =>
    set((state) => ({
      wallPlacement: {
        ...state.wallPlacement,
        params: {
          ...state.wallPlacement.params,
          alignmentSide,
        },
      },
    })),

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
    set((state) => ({
      wallPlacement: {
        ...initialWallPlacement,
        // Keep wall params when resetting
        params: state.wallPlacement.params,
      },
    })),

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

  setDoorSwingSide: (swingSide) =>
    set((state) => ({
      doorPlacement: {
        ...state.doorPlacement,
        params: {
          ...state.doorPlacement.params,
          swingSide,
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

  // Column placement
  setColumnParams: (params) =>
    set((state) => ({
      columnPlacement: {
        ...state.columnPlacement,
        params: {
          ...state.columnPlacement.params,
          ...params,
        },
      },
    })),

  setColumnProfileType: (profileType) =>
    set((state) => ({
      columnPlacement: {
        ...state.columnPlacement,
        params: {
          ...state.columnPlacement.params,
          profileType,
          // For circular columns, depth = width (diameter)
          depth: profileType === 'circular' ? state.columnPlacement.params.width : state.columnPlacement.params.depth,
        },
      },
    })),

  setColumnWidth: (width) =>
    set((state) => ({
      columnPlacement: {
        ...state.columnPlacement,
        params: {
          ...state.columnPlacement.params,
          width,
          // For circular columns, depth follows width
          depth: state.columnPlacement.params.profileType === 'circular' ? width : state.columnPlacement.params.depth,
        },
      },
    })),

  setColumnDepth: (depth) =>
    set((state) => ({
      columnPlacement: {
        ...state.columnPlacement,
        params: {
          ...state.columnPlacement.params,
          depth,
        },
      },
    })),

  setColumnHeight: (height) =>
    set((state) => ({
      columnPlacement: {
        ...state.columnPlacement,
        params: {
          ...state.columnPlacement.params,
          height,
        },
      },
    })),

  setColumnPreview: (position, isValid) =>
    set((state) => ({
      columnPlacement: {
        ...state.columnPlacement,
        previewPosition: position,
        isValidPosition: isValid,
      },
    })),

  resetColumnPlacement: () =>
    set((state) => ({
      columnPlacement: {
        ...initialColumnPlacement,
        // Keep column params
        params: state.columnPlacement.params,
      },
    })),

  // Counter placement
  setCounterParams: (params) =>
    set((state) => ({
      counterPlacement: {
        ...state.counterPlacement,
        params: {
          ...state.counterPlacement.params,
          ...params,
        },
      },
    })),

  setCounterType: (counterType) =>
    set((state) => ({
      counterPlacement: {
        ...state.counterPlacement,
        params: {
          ...state.counterPlacement.params,
          counterType,
          // Update type-specific defaults
          height: getDefaultCounterHeight(counterType),
          overhang: getDefaultCounterOverhang(counterType),
          hasFootrest: counterType === 'bar',
        },
      },
    })),

  setCounterDepth: (depth) =>
    set((state) => ({
      counterPlacement: {
        ...state.counterPlacement,
        params: {
          ...state.counterPlacement.params,
          depth,
        },
      },
    })),

  setCounterHeight: (height) =>
    set((state) => ({
      counterPlacement: {
        ...state.counterPlacement,
        params: {
          ...state.counterPlacement.params,
          height,
        },
      },
    })),

  addCounterPoint: (point) =>
    set((state) => ({
      counterPlacement: {
        ...state.counterPlacement,
        points: [...state.counterPlacement.points, point],
        isDrawing: true,
      },
    })),

  setCounterPreviewPoint: (point) =>
    set((state) => ({
      counterPlacement: {
        ...state.counterPlacement,
        previewPoint: point,
      },
    })),

  resetCounterPlacement: () =>
    set((state) => ({
      counterPlacement: {
        ...initialCounterPlacement,
        // Keep counter params
        params: state.counterPlacement.params,
      },
    })),

  finishCounterPlacement: () => {
    const { counterPlacement } = get();
    const points = [...counterPlacement.points];
    set((state) => ({
      counterPlacement: {
        ...initialCounterPlacement,
        params: state.counterPlacement.params,
      },
    }));
    return points;
  },

  // Asset placement
  setAssetParams: (params) =>
    set((state) => ({
      assetPlacement: {
        ...state.assetPlacement,
        params: {
          ...state.assetPlacement.params,
          ...params,
        },
      },
    })),

  setSelectedAsset: (assetId) =>
    set((state) => ({
      assetPlacement: {
        ...state.assetPlacement,
        params: {
          ...state.assetPlacement.params,
          assetId,
        },
      },
    })),

  setAssetScale: (scale) =>
    set((state) => ({
      assetPlacement: {
        ...state.assetPlacement,
        params: {
          ...state.assetPlacement.params,
          scale,
        },
      },
    })),

  setAssetRotation: (rotation) =>
    set((state) => ({
      assetPlacement: {
        ...state.assetPlacement,
        params: {
          ...state.assetPlacement.params,
          rotation,
        },
      },
    })),

  setAssetPreview: (position, isValid) =>
    set((state) => ({
      assetPlacement: {
        ...state.assetPlacement,
        previewPosition: position,
        isValidPosition: isValid,
      },
    })),

  resetAssetPlacement: () =>
    set((state) => ({
      assetPlacement: {
        ...initialAssetPlacement,
        // Keep asset params
        params: state.assetPlacement.params,
      },
    })),

  // Space placement (for manual polygon drawing)
  addSpacePoint: (point) =>
    set((state) => ({
      spacePlacement: {
        ...state.spacePlacement,
        points: [...state.spacePlacement.points, point],
        isDrawing: true,
      },
    })),

  setSpacePreviewPoint: (point) =>
    set((state) => ({
      spacePlacement: {
        ...state.spacePlacement,
        previewPoint: point,
      },
    })),

  resetSpacePlacement: () =>
    set({
      spacePlacement: initialSpacePlacement,
    }),

  finishSpacePlacement: () => {
    const { spacePlacement } = get();
    const points = [...spacePlacement.points];
    set({ spacePlacement: initialSpacePlacement });
    return points;
  },

  // Stair placement
  setStairParams: (params) =>
    set((state) => ({
      stairPlacement: {
        ...state.stairPlacement,
        params: {
          ...state.stairPlacement.params,
          ...params,
        },
      },
    })),

  setStairType: (stairType) =>
    set((state) => ({
      stairPlacement: {
        ...state.stairPlacement,
        params: {
          ...state.stairPlacement.params,
          stairType,
        },
      },
    })),

  setStairWidth: (width) =>
    set((state) => ({
      stairPlacement: {
        ...state.stairPlacement,
        params: {
          ...state.stairPlacement.params,
          width,
        },
      },
    })),

  setStairTotalRise: (totalRise) =>
    set((state) => ({
      stairPlacement: {
        ...state.stairPlacement,
        params: {
          ...state.stairPlacement.params,
          totalRise,
        },
      },
    })),

  setStairTargetStorey: (storeyId) =>
    set((state) => ({
      stairPlacement: {
        ...state.stairPlacement,
        params: {
          ...state.stairPlacement.params,
          targetStoreyId: storeyId,
        },
      },
    })),

  setStairCreateOpening: (createOpening) =>
    set((state) => ({
      stairPlacement: {
        ...state.stairPlacement,
        params: {
          ...state.stairPlacement.params,
          createOpening,
        },
      },
    })),

  setStairStartPoint: (point) =>
    set((state) => ({
      stairPlacement: {
        ...state.stairPlacement,
        startPoint: point,
        isPlacing: point !== null,
      },
    })),

  setStairPreviewEndPoint: (point) =>
    set((state) => ({
      stairPlacement: {
        ...state.stairPlacement,
        previewEndPoint: point,
      },
    })),

  setStairRotation: (rotation) =>
    set((state) => ({
      stairPlacement: {
        ...state.stairPlacement,
        rotation,
      },
    })),

  resetStairPlacement: () =>
    set((state) => ({
      stairPlacement: {
        ...initialStairPlacement,
        // Keep stair params
        params: state.stairPlacement.params,
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
      case 'counter':
      case 'asset':
      case 'space-detect':
      case 'space-draw':
      case 'stair':
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
    const { activeTool, doorPlacement, windowPlacement, columnPlacement, counterPlacement, assetPlacement, stairPlacement } = get();

    // Always clear distance input when cancelling
    set({ distanceInput: initialDistanceInput });

    if (activeTool === 'wall') {
      set((state) => ({
        wallPlacement: {
          ...initialWallPlacement,
          params: state.wallPlacement.params,
        },
      }));
    }
    if (activeTool === 'slab') {
      set({ slabPlacement: initialSlabPlacement });
    }
    if (activeTool === 'space-draw') {
      set({ spacePlacement: initialSpacePlacement });
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
    if (activeTool === 'column') {
      set({
        columnPlacement: {
          ...initialColumnPlacement,
          params: columnPlacement.params,
        },
      });
    }
    if (activeTool === 'counter') {
      set({
        counterPlacement: {
          ...initialCounterPlacement,
          params: counterPlacement.params,
        },
      });
    }
    if (activeTool === 'asset') {
      set({
        assetPlacement: {
          ...initialAssetPlacement,
          params: assetPlacement.params,
        },
      });
    }
    if (activeTool === 'stair') {
      set({
        stairPlacement: {
          ...initialStairPlacement,
          params: stairPlacement.params,
        },
      });
    }
  },
}));
