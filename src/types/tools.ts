import type { Point2D } from './geometry';
import type { DoorType, WindowType } from './bim';

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
  | 'pan'
  | 'orbit';

/**
 * View mode for the editor
 */
export type ViewMode = '2d' | '3d';

/**
 * State for wall placement tool
 */
export interface WallPlacementState {
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
 * Cursor state based on active tool
 */
export type CursorStyle = 'default' | 'crosshair' | 'pointer' | 'grab' | 'grabbing' | 'not-allowed';
