import type { Point2D, Vector2D } from './geometry';
import type { DoorType, WindowType, CounterType, StairType, WallAlignmentSide } from './bim';

/**
 * Available tool types in the editor
 */
export type ToolType =
  | 'select'
  | 'wall'
  | 'door'
  | 'window'
  | 'column'
  | 'slab'
  | 'furniture'
  | 'counter'
  | 'stair'
  | 'asset'
  | 'space-detect'
  | 'space-draw'
  | 'measure'
  | 'pan'
  | 'orbit';

/**
 * View mode for the editor
 * - '2d': Only 2D CAD view
 * - '3d': Only 3D view
 * - 'split': Vertical split with 2D left, 3D right
 */
export type ViewMode = '2d' | '3d' | 'split';

/**
 * Wall placement parameters (configurable before placement)
 */
export interface WallPlacementParams {
  thickness: number;
  height: number;
  /** Which edge the reference line represents (left/center/right) */
  alignmentSide: WallAlignmentSide;
}

/**
 * State for wall placement tool
 */
export interface WallPlacementState {
  /** Current wall parameters */
  params: WallPlacementParams;
  startPoint: Point2D | null;
  previewEndPoint: Point2D | null;
  isPlacing: boolean;
}

/**
 * State for element placement tools (door, window, column)
 */
export interface ElementPlacementState {
  previewPosition: Point2D | null;
  hostWallId: string | null;
}

/**
 * Door placement parameters (configurable before placement)
 */
export interface DoorPlacementParams {
  doorType: DoorType;
  width: number;
  height: number;
  swingDirection: 'left' | 'right';
}

/**
 * State for door placement tool with preview
 */
export interface DoorPlacementState {
  /** Current door parameters */
  params: DoorPlacementParams;
  /** Preview position on wall (0-1) */
  previewPosition: number | null;
  /** Host wall ID for preview */
  hostWallId: string | null;
  /** Distance from left wall edge (meters) */
  distanceFromLeft: number | null;
  /** Distance from right wall edge (meters) */
  distanceFromRight: number | null;
  /** Whether position is valid for placement */
  isValidPosition: boolean;
}

/**
 * State for slab/floor plan placement (polygon drawing)
 */
export interface SlabPlacementState {
  /** Points already placed */
  points: Point2D[];
  /** Current cursor position for preview */
  previewPoint: Point2D | null;
  /** Whether we're actively drawing */
  isDrawing: boolean;
}

/**
 * State for the slab completion dialog
 */
export interface SlabCompletionDialogState {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** The pending slab outline points */
  pendingPoints: Point2D[];
}

/**
 * Window placement parameters (configurable before placement)
 */
export interface WindowPlacementParams {
  windowType: WindowType;
  width: number;
  height: number;
  sillHeight: number;
}

/**
 * State for window placement tool with preview
 */
export interface WindowPlacementState {
  /** Current window parameters */
  params: WindowPlacementParams;
  /** Preview position on wall (0-1) */
  previewPosition: number | null;
  /** Host wall ID for preview */
  hostWallId: string | null;
  /** Distance from left wall edge (meters) */
  distanceFromLeft: number | null;
  /** Distance from right wall edge (meters) */
  distanceFromRight: number | null;
  /** Whether position is valid for placement */
  isValidPosition: boolean;
}

/**
 * Column profile types
 */
export type ColumnProfileType = 'rectangular' | 'circular';

/**
 * Column placement parameters (configurable before placement)
 */
export interface ColumnPlacementParams {
  profileType: ColumnProfileType;
  width: number;
  depth: number;
  height: number;
}

/**
 * State for column placement tool with preview
 */
export interface ColumnPlacementState {
  /** Current column parameters */
  params: ColumnPlacementParams;
  /** Preview position in world coordinates */
  previewPosition: Point2D | null;
  /** Whether position is valid for placement */
  isValidPosition: boolean;
}

/**
 * Counter placement parameters (configurable before placement)
 */
export interface CounterPlacementParams {
  counterType: CounterType;
  depth: number;
  height: number;
  topThickness: number;
  overhang: number;
  kickHeight: number;
  kickRecess: number;
  hasFootrest: boolean;
  footrestHeight: number;
}

/**
 * State for counter placement tool (polyline drawing similar to slab)
 */
export interface CounterPlacementState {
  /** Current counter parameters */
  params: CounterPlacementParams;
  /** Points already placed (front line) */
  points: Point2D[];
  /** Current cursor position for preview */
  previewPoint: Point2D | null;
  /** Whether we're actively drawing */
  isDrawing: boolean;
}

/**
 * Asset placement parameters (configurable before placement)
 */
export interface AssetPlacementParams {
  /** Selected asset ID from catalog */
  assetId: string | null;
  /** Scale factor for the asset */
  scale: number;
  /** Y-axis rotation in degrees */
  rotation: number;
}

/**
 * State for asset placement tool with preview
 */
export interface AssetPlacementState {
  /** Current asset parameters */
  params: AssetPlacementParams;
  /** Preview position in world coordinates */
  previewPosition: Point2D | null;
  /** Whether position is valid for placement */
  isValidPosition: boolean;
}

/**
 * Cursor state based on active tool
 */
export type CursorStyle = 'default' | 'crosshair' | 'pointer' | 'grab' | 'grabbing' | 'not-allowed';

/**
 * State for distance input during line-based element placement
 * Allows user to type exact distance values instead of clicking
 */
export interface DistanceInputState {
  /** Whether distance input mode is active */
  active: boolean;
  /** Current input value as string (allows partial input like "3.") */
  value: string;
  /** Normalized direction vector for the distance */
  direction: Vector2D | null;
  /** Reference point (start point) for distance calculation */
  referencePoint: Point2D | null;
}

/**
 * State for space placement (polygon drawing mode)
 */
export interface SpacePlacementState {
  /** Points already placed for manual polygon drawing */
  points: Point2D[];
  /** Current cursor position for preview */
  previewPoint: Point2D | null;
  /** Whether we're actively drawing a polygon */
  isDrawing: boolean;
}

/**
 * Stair placement parameters (configurable before placement)
 */
export interface StairPlacementParams {
  /** Type of stair */
  stairType: StairType;
  /** Stair width in meters */
  width: number;
  /** Target storey ID (where stair leads to) */
  targetStoreyId: string | null;
  /** Whether to auto-create floor opening */
  createOpening: boolean;
}

/**
 * State for stair placement tool with preview
 * Two-click placement: first click = start position, second click = direction
 */
export interface StairPlacementState {
  /** Current stair parameters */
  params: StairPlacementParams;
  /** Start point (foot of stair) */
  startPoint: Point2D | null;
  /** Preview end point for direction */
  previewEndPoint: Point2D | null;
  /** Whether we're currently placing */
  isPlacing: boolean;
  /** Calculated rotation based on direction */
  rotation: number;
}
