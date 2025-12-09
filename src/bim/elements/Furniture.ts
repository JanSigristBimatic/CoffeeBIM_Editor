import { v4 as uuid } from 'uuid';
import type { BimElement, FurnitureData, ModelFormat } from '@/types/bim';
import { createDefaultAssetPropertySets } from '@/types/bim';

/**
 * Default furniture dimensions (used when model bounds can't be determined)
 */
export const DEFAULT_FURNITURE_WIDTH = 1.0; // meters
export const DEFAULT_FURNITURE_DEPTH = 1.0; // meters
export const DEFAULT_FURNITURE_HEIGHT = 1.0; // meters
export const DEFAULT_FURNITURE_SCALE = 1.0;

/**
 * Common furniture categories
 */
export type FurnitureCategory =
  | 'table'
  | 'chair'
  | 'sofa'
  | 'coffee-machine'
  | 'grinder'
  | 'refrigerator'
  | 'counter'
  | 'shelf'
  | 'cabinet'
  | 'appliance'
  | 'decoration'
  | 'other';

/**
 * Parameters for creating furniture from an imported 3D model
 */
export interface CreateFurnitureParams {
  name: string;
  category: FurnitureCategory | string;
  modelUrl: string;
  modelFormat: ModelFormat;
  originalFileName: string;
  position: { x: number; y: number; z: number };
  rotation?: number; // Z-axis rotation in radians (Z-up system)
  scale?: number;
  width?: number;
  depth?: number;
  height?: number;
  storeyId: string;
  /** Target dimensions from asset catalog - enables auto-scaling of 3D model */
  targetDimensions?: {
    width: number;
    depth: number;
    height: number;
  };
}

/**
 * Creates a furniture element from an imported 3D model
 */
export function createFurniture(params: CreateFurnitureParams): BimElement {
  const {
    name,
    category,
    modelUrl,
    modelFormat,
    originalFileName,
    position,
    rotation = 0,
    scale = DEFAULT_FURNITURE_SCALE,
    width = DEFAULT_FURNITURE_WIDTH,
    depth = DEFAULT_FURNITURE_DEPTH,
    height = DEFAULT_FURNITURE_HEIGHT,
    storeyId,
    targetDimensions,
  } = params;

  const id = uuid();

  // Create a simple bounding box profile for IFC export
  const hw = width / 2;
  const hd = depth / 2;
  const profile = [
    { x: -hw, y: -hd },
    { x: hw, y: -hd },
    { x: hw, y: hd },
    { x: -hw, y: hd },
  ];

  const furnitureData: FurnitureData = {
    category,
    modelUrl,
    modelFormat,
    originalFileName,
    width,
    depth,
    height,
    scale,
    targetDimensions,
  };

  // Create asset property sets with category from furniture
  const assetPsets = createDefaultAssetPropertySets(category, width, depth, height);

  // Add furniture-specific properties to Grunddaten
  const grunddatenPset = assetPsets.find((p) => p.name === 'Pset_Grunddaten');
  if (grunddatenPset) {
    grunddatenPset.properties.Beschreibung = `Importiert aus: ${originalFileName}`;
  }

  return {
    id,
    type: 'furniture',
    name,
    geometry: {
      profile,
      height,
      direction: { x: 0, y: 0, z: 1 }, // Extrude upward (Z-up)
    },
    placement: {
      position: { x: position.x, y: position.y, z: position.z },
      rotation: {
        // Z-up: rotation around Z-axis
        x: 0,
        y: 0,
        z: Math.sin(rotation / 2),
        w: Math.cos(rotation / 2),
      },
    },
    properties: assetPsets,
    parentId: storeyId,
    furnitureData,
  };
}

/**
 * Updates furniture dimensions (useful after loading model and calculating bounds)
 */
export function updateFurnitureDimensions(
  element: BimElement,
  dimensions: { width: number; depth: number; height: number }
): Partial<BimElement> {
  if (!element.furnitureData) return {};

  const { width, depth, height } = dimensions;
  const hw = width / 2;
  const hd = depth / 2;

  // Update Pset_Dimensionen if it exists
  const updatedProperties = element.properties.map((pset) =>
    pset.name === 'Pset_Dimensionen'
      ? {
          ...pset,
          properties: {
            ...pset.properties,
            Breite: width,
            Tiefe: depth,
            Hoehe: height,
          },
        }
      : pset
  );

  return {
    geometry: {
      ...element.geometry,
      profile: [
        { x: -hw, y: -hd },
        { x: hw, y: -hd },
        { x: hw, y: hd },
        { x: -hw, y: hd },
      ],
      height,
    },
    furnitureData: {
      ...element.furnitureData,
      width,
      depth,
      height,
    },
    properties: updatedProperties,
  };
}

/**
 * Updates furniture scale
 */
export function updateFurnitureScale(
  element: BimElement,
  scale: number
): Partial<BimElement> {
  if (!element.furnitureData) return {};

  return {
    furnitureData: {
      ...element.furnitureData,
      scale,
    },
  };
}

/**
 * Updates furniture position
 */
export function updateFurniturePosition(
  element: BimElement,
  position: { x: number; y: number; z: number }
): Partial<BimElement> {
  return {
    placement: {
      ...element.placement,
      position,
    },
  };
}

/**
 * Gets model format from file extension
 */
export function getModelFormatFromExtension(filename: string): ModelFormat | null {
  const ext = filename.toLowerCase().split('.').pop();
  switch (ext) {
    case 'glb':
      return 'glb';
    case 'gltf':
      return 'gltf';
    case 'obj':
      return 'obj';
    default:
      return null;
  }
}

/**
 * Checks if a file is a supported 3D model format
 */
export function isSupportedModelFormat(filename: string): boolean {
  return getModelFormatFromExtension(filename) !== null;
}
