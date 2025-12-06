import type { Point2D, Vector3, Quaternion } from './geometry';

/**
 * Element types supported by the editor
 */
export type ElementType = 'wall' | 'door' | 'window' | 'column' | 'slab' | 'furniture';

/**
 * IFC-compatible property set
 */
export interface PropertySet {
  name: string;
  properties: Record<string, string | number | boolean>;
}

/**
 * Opening in a wall (for doors and windows)
 */
export interface Opening {
  id: string;
  type: 'door' | 'window';
  elementId: string; // Reference to door/window element
  position: number; // Distance along wall (0-1)
  width: number;
  height: number;
  sillHeight: number; // Height from floor (0 for doors)
}

/**
 * Wall-specific data
 */
export interface WallData {
  startPoint: Point2D;
  endPoint: Point2D;
  thickness: number;
  height: number;
  openings: Opening[];
}

/**
 * Door types
 */
export type DoorType = 'single' | 'double' | 'sliding';

/**
 * Door-specific data
 */
export interface DoorData {
  width: number;
  height: number;
  doorType: DoorType;
  hostWallId: string;
  positionOnWall: number; // 0-1 position along wall
  swingDirection: 'left' | 'right';
  /** Distance from left wall edge in meters */
  distanceFromLeft: number;
  /** Distance from right wall edge in meters */
  distanceFromRight: number;
  /** Height from floor to bottom of door (default 0 for doors, > 0 for high windows) */
  sillHeight: number;
}

/**
 * Window types
 */
export type WindowType = 'single' | 'double' | 'fixed';

/**
 * Window-specific data
 */
export interface WindowData {
  width: number;
  height: number;
  sillHeight: number;
  windowType: WindowType;
  hostWallId: string;
  positionOnWall: number; // 0-1 position along wall
  /** Distance from left wall edge in meters */
  distanceFromLeft: number;
  /** Distance from right wall edge in meters */
  distanceFromRight: number;
}

/**
 * Column-specific data
 */
export interface ColumnData {
  profileType: 'rectangular' | 'circular';
  width: number;
  depth: number;
  height: number;
}

/**
 * Slab-specific data (floors and ceilings)
 */
export interface SlabData {
  slabType: 'floor' | 'ceiling';
  thickness: number;
  outline: Point2D[];
}

/**
 * Furniture-specific data
 */
export interface FurnitureData {
  category: string; // e.g., 'table', 'chair', 'coffee-machine'
  modelPath?: string; // Path to OBJ file
  width: number;
  depth: number;
  height: number;
}

/**
 * Core BIM element interface
 * All elements in the model share this structure
 */
export interface BimElement {
  /** Unique identifier (UUID) */
  id: string;

  /** Element type */
  type: ElementType;

  /** User-friendly name */
  name: string;

  /** Geometry definition for extrusion */
  geometry: {
    /** 2D profile for extrusion */
    profile: Point2D[];
    /** Extrusion height */
    height: number;
    /** Extrusion direction (usually Z-up) */
    direction: Vector3;
  };

  /** World placement */
  placement: {
    position: Vector3;
    rotation: Quaternion;
  };

  /** IFC-compatible property sets */
  properties: PropertySet[];

  /** Reference to parent storey */
  parentId: string | null;

  /** Type-specific data */
  wallData?: WallData;
  doorData?: DoorData;
  windowData?: WindowData;
  columnData?: ColumnData;
  slabData?: SlabData;
  furnitureData?: FurnitureData;
}

// ============================================
// IFC Hierarchy Types
// ============================================

/**
 * Project information (IfcProject)
 */
export interface ProjectInfo {
  id: string;
  name: string;
  description: string;
}

/**
 * Site information (IfcSite)
 */
export interface SiteInfo {
  id: string;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  elevation?: number;
}

/**
 * Building information (IfcBuilding)
 */
export interface BuildingInfo {
  id: string;
  name: string;
  siteId: string;
}

/**
 * Building storey information (IfcBuildingStorey)
 */
export interface StoreyInfo {
  id: string;
  name: string;
  buildingId: string;
  elevation: number; // Height from ground (meters)
  height: number; // Storey height (meters)
}

// ============================================
// Default Values
// ============================================

export const DEFAULT_WALL_THICKNESS = 0.2; // meters
export const DEFAULT_WALL_HEIGHT = 3.0; // meters

export const DEFAULT_DOOR_WIDTH = 0.9; // meters (single door)
export const DEFAULT_DOUBLE_DOOR_WIDTH = 1.8; // meters (double door)
export const DEFAULT_SLIDING_DOOR_WIDTH = 1.2; // meters (sliding door)
export const DEFAULT_DOOR_HEIGHT = 2.1; // meters

export const DEFAULT_WINDOW_WIDTH = 1.2; // meters (single window)
export const DEFAULT_DOUBLE_WINDOW_WIDTH = 2.0; // meters (double window)
export const DEFAULT_FIXED_WINDOW_WIDTH = 1.5; // meters (fixed window)
export const DEFAULT_WINDOW_HEIGHT = 1.2; // meters
export const DEFAULT_WINDOW_SILL_HEIGHT = 0.9; // meters

export const DEFAULT_COLUMN_WIDTH = 0.3; // meters
export const DEFAULT_COLUMN_DEPTH = 0.3; // meters

export const DEFAULT_STOREY_HEIGHT = 3.0; // meters
