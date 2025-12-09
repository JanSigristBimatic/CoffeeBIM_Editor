/**
 * Asset Catalog - Predefined GLB assets for placement in the editor
 *
 * Assets are organized by category and loaded from public/assets/
 */

export interface AssetItem {
  id: string;
  name: string;
  /** Path relative to public folder */
  path: string;
  /** Thumbnail path (optional) */
  thumbnail?: string;
  /** Default scale factor */
  defaultScale: number;
  /** Approximate dimensions in meters (for bounding box) */
  dimensions: {
    width: number;
    depth: number;
    height: number;
  };
}

export interface AssetCategory {
  id: string;
  name: string;
  icon: string;
  items: AssetItem[];
}

/**
 * Asset catalog with all predefined assets
 */
export const ASSET_CATALOG: AssetCategory[] = [
  {
    id: 'coffee-machines',
    name: 'Kaffeemaschinen',
    icon: '',
    items: [
      {
        id: 'la-marzocco-gross',
        name: 'La Marzocco Gross',
        path: '/assets/coffee-machines/la Marzocco gross.glb',
        defaultScale: 0.1,
        dimensions: { width: 1.0, depth: 0.6, height: 0.5 },
      },
      {
        id: 'la-marzocco-strada',
        name: 'La Marzocco Strada',
        path: '/assets/coffee-machines/la Marzocco Strada.glb',
        defaultScale: 0.3048,
        dimensions: { width: 0.8, depth: 0.6, height: 0.5 },
      },
    ],
  },
  {
    id: 'grinders',
    name: 'Kaffeemuhlen',
    icon: '',
    items: [
      {
        id: 'kaffeemuehle',
        name: 'Kaffeemuhle',
        path: '/assets/grinders/Kaffeemühle.glb',
        defaultScale: 0.0328,
        dimensions: { width: 0.2, depth: 0.35, height: 0.65 },
      },
    ],
  },
  {
    id: 'appliances',
    name: 'Gerate',
    icon: '',
    items: [
      {
        id: 'spuehlmaschine',
        name: 'Spuhlmaschine',
        path: '/assets/appliances/Spühlmaschiene.glb',
        defaultScale: 0.2,
        dimensions: { width: 0.6, depth: 0.6, height: 0.85 },
      },
      {
        id: 'kuehlschrank-gross',
        name: 'Kuhlschrank Gross',
        path: '/assets/appliances/Kühlschrank gross.glb',
        defaultScale: 0.1,
        dimensions: { width: 0.7, depth: 0.7, height: 2.0 },
      },
      {
        id: 'kuehlschrank-mittel',
        name: 'Kuhlschrank Mittel',
        path: '/assets/appliances/Kühlschrank mittel.glb',
        defaultScale: 0.00328,
        dimensions: { width: 0.6, depth: 0.6, height: 1.5 },
      },
    ],
  },
  {
    id: 'furniture',
    name: 'Mobel',
    icon: '',
    items: [
      {
        id: 'tisch',
        name: 'Tisch',
        path: '/assets/furniture/Tisch.glb',
        defaultScale: 0.7,
        dimensions: { width: 0.8, depth: 0.8, height: 0.75 },
      },
      {
        id: 'stuhl',
        name: 'Stuhl',
        path: '/assets/furniture/Stuhl.glb',
        defaultScale: 1.0,
        dimensions: { width: 0.45, depth: 0.5, height: 0.85 },
      },
      {
        id: 'barhocker',
        name: 'Barhocker',
        path: '/assets/furniture/Barhocker.glb',
        defaultScale: 0.01,
        dimensions: { width: 0.4, depth: 0.4, height: 0.75 },
      },
      {
        id: 'sofa',
        name: 'Sofa',
        path: '/assets/furniture/Sofa.glb',
        defaultScale: 1.0,
        dimensions: { width: 1.5, depth: 0.85, height: 0.85 },
      },
      {
        id: 'sofa-l',
        name: 'Sofa L-Form',
        path: '/assets/furniture/Sofa L.glb',
        defaultScale: 1.0,
        dimensions: { width: 2.5, depth: 2.0, height: 0.85 },
      },
      {
        id: 'regal',
        name: 'Regal',
        path: '/assets/furniture/Regal.glb',
        defaultScale: 1.0,
        dimensions: { width: 0.8, depth: 0.35, height: 1.8 },
      },
    ],
  },
  {
    id: 'lighting',
    name: 'Beleuchtung',
    icon: '',
    items: [
      {
        id: 'deckenlampe',
        name: 'Deckenlampe',
        path: '/assets/lighting/Deckenlampe.glb',
        defaultScale: 1.0,
        dimensions: { width: 0.4, depth: 0.4, height: 0.3 },
      },
    ],
  },
];

/**
 * Get all asset categories
 */
export function getAssetCategories(): AssetCategory[] {
  return ASSET_CATALOG;
}

/**
 * Get a specific category by ID
 */
export function getAssetCategory(categoryId: string): AssetCategory | undefined {
  return ASSET_CATALOG.find((cat) => cat.id === categoryId);
}

/**
 * Get a specific asset by ID
 */
export function getAssetById(assetId: string): AssetItem | undefined {
  for (const category of ASSET_CATALOG) {
    const item = category.items.find((item) => item.id === assetId);
    if (item) return item;
  }
  return undefined;
}

/**
 * Get the category for a specific asset
 */
export function getAssetCategoryForItem(assetId: string): AssetCategory | undefined {
  for (const category of ASSET_CATALOG) {
    if (category.items.some((item) => item.id === assetId)) {
      return category;
    }
  }
  return undefined;
}

/**
 * Map asset category to furniture category for BIM element
 */
export function mapAssetCategoryToFurnitureCategory(categoryId: string): string {
  switch (categoryId) {
    case 'coffee-machines':
      return 'coffee-machine';
    case 'grinders':
      return 'grinder';
    case 'appliances':
      return 'appliance';
    case 'furniture':
      return 'furniture';
    case 'lighting':
      return 'lighting';
    default:
      return 'other';
  }
}
