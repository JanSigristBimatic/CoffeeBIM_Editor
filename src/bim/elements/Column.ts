import { v4 as uuidv4 } from 'uuid';
import type { BimElement, ColumnData } from '@/types/bim';
import { DEFAULT_COLUMN_WIDTH, DEFAULT_COLUMN_DEPTH, DEFAULT_WALL_HEIGHT } from '@/types/bim';
import type { Point2D } from '@/types/geometry';

export { DEFAULT_COLUMN_WIDTH, DEFAULT_COLUMN_DEPTH };

/**
 * Column profile types
 */
export type ColumnProfileType = 'rectangular' | 'circular';

export interface CreateColumnParams {
  position: Point2D;
  storeyId: string;
  profileType?: ColumnProfileType;
  width?: number;
  depth?: number;
  height?: number;
  name?: string;
}

/**
 * Get column profile type label for display
 */
export function getColumnProfileLabel(profileType: ColumnProfileType): string {
  switch (profileType) {
    case 'rectangular':
      return 'Rechteckig';
    case 'circular':
      return 'Rund';
    default:
      return profileType;
  }
}

/**
 * Creates a rectangular profile for column extrusion
 */
function createRectangularProfile(width: number, depth: number): Point2D[] {
  const hw = width / 2;
  const hd = depth / 2;
  return [
    { x: -hw, y: -hd },
    { x: hw, y: -hd },
    { x: hw, y: hd },
    { x: -hw, y: hd },
  ];
}

/**
 * Creates a circular profile approximation for column extrusion
 * Uses 16 segments for smooth appearance
 */
function createCircularProfile(diameter: number): Point2D[] {
  const radius = diameter / 2;
  const segments = 16;
  const points: Point2D[] = [];

  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    points.push({
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    });
  }

  return points;
}

/**
 * Creates a new column element
 */
export function createColumn(params: CreateColumnParams): BimElement {
  const {
    position,
    storeyId,
    profileType = 'rectangular',
    width = DEFAULT_COLUMN_WIDTH,
    depth = DEFAULT_COLUMN_DEPTH,
    height = DEFAULT_WALL_HEIGHT,
    name,
  } = params;

  const id = uuidv4();
  const columnNumber = Date.now().toString().slice(-4);

  // Create profile based on type
  const profile =
    profileType === 'circular'
      ? createCircularProfile(width) // For circular, width = diameter
      : createRectangularProfile(width, depth);

  const columnData: ColumnData = {
    profileType,
    width,
    depth: profileType === 'circular' ? width : depth, // Circular columns use width as diameter
    height,
  };

  return {
    id,
    type: 'column',
    name: name || `Säule ${columnNumber}`,
    geometry: {
      profile,
      height,
      direction: { x: 0, y: 0, z: 1 }, // Extrude upward (Z-up)
    },
    placement: {
      // Z-up coordinate system: 2D (x,y) → 3D (x, y, 0)
      position: { x: position.x, y: position.y, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
    },
    properties: [
      {
        name: 'Pset_ColumnCommon',
        properties: {
          IsExternal: false,
          LoadBearing: true,
        },
      },
    ],
    parentId: storeyId,
    columnData,
  };
}

/**
 * Update column dimensions
 */
export function updateColumnDimensions(
  column: BimElement,
  updates: Partial<Pick<ColumnData, 'width' | 'depth' | 'height' | 'profileType'>>
): Partial<BimElement> {
  if (!column.columnData) return {};

  const newColumnData = { ...column.columnData, ...updates };

  // Regenerate profile if dimensions changed
  const profile =
    newColumnData.profileType === 'circular'
      ? createCircularProfile(newColumnData.width)
      : createRectangularProfile(newColumnData.width, newColumnData.depth);

  return {
    columnData: newColumnData,
    geometry: {
      ...column.geometry,
      profile,
      height: newColumnData.height,
    },
  };
}
