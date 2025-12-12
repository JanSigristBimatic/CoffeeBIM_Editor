import type { Point2D, Vector3, Quaternion } from './geometry';

/**
 * Element types supported by the editor
 */
export type ElementType = 'wall' | 'door' | 'window' | 'column' | 'slab' | 'furniture' | 'counter' | 'space' | 'stair';

/**
 * IFC-compatible property set
 */
export interface PropertySet {
  name: string;
  properties: Record<string, string | number | boolean | null>;
}

// ============================================
// IFC Electric Appliance Types (IFC2x3)
// https://standards.buildingsmart.org/IFC/RELEASE/IFC2x3/TC1/HTML/ifcelectricaldomain/lexical/ifcelectricappliancetypeenum.htm
// ============================================

/**
 * IfcElectricApplianceTypeEnum - IFC standard enumeration for electric appliances
 */
export type IfcElectricApplianceTypeEnum =
  | 'COMPUTER'
  | 'DIRECTWATERHEATER'
  | 'DISHWASHER'
  | 'ELECTRICCOOKER'
  | 'ELECTRICHEATER'
  | 'FACSIMILE'
  | 'FREESTANDINGFAN'
  | 'FREEZER'
  | 'FRIDGE_FREEZER'
  | 'HANDDRYER'
  | 'INDIRECTWATERHEATER'
  | 'MICROWAVE'
  | 'PHOTOCOPIER'
  | 'PRINTER'
  | 'RADIANTHEATER'
  | 'REFRIGERATOR'
  | 'SCANNER'
  | 'TELEPHONE'
  | 'TUMBLEDRYER'
  | 'TV'
  | 'VENDINGMACHINE'
  | 'WASHINGMACHINE'
  | 'WATERCOOLER'
  | 'WATERHEATER'
  | 'USERDEFINED'
  | 'NOTDEFINED';

/**
 * German labels for IFC Electric Appliance Types
 */
export const IFC_ELECTRIC_APPLIANCE_LABELS: Record<IfcElectricApplianceTypeEnum, string> = {
  COMPUTER: 'Computer',
  DIRECTWATERHEATER: 'Direkter Wassererhitzer',
  DISHWASHER: 'Geschirrspüler',
  ELECTRICCOOKER: 'Elektroherd',
  ELECTRICHEATER: 'Elektroheizung',
  FACSIMILE: 'Faxgerät',
  FREESTANDINGFAN: 'Standventilator',
  FREEZER: 'Tiefkühler',
  FRIDGE_FREEZER: 'Kühl-Gefrierkombination',
  HANDDRYER: 'Händetrockner',
  INDIRECTWATERHEATER: 'Indirekter Wassererhitzer',
  MICROWAVE: 'Mikrowelle',
  PHOTOCOPIER: 'Kopierer',
  PRINTER: 'Drucker',
  RADIANTHEATER: 'Strahlungsheizung',
  REFRIGERATOR: 'Kühlschrank',
  SCANNER: 'Scanner',
  TELEPHONE: 'Telefon',
  TUMBLEDRYER: 'Wäschetrockner',
  TV: 'Fernseher',
  VENDINGMACHINE: 'Verkaufsautomat',
  WASHINGMACHINE: 'Waschmaschine',
  WATERCOOLER: 'Wasserkühler',
  WATERHEATER: 'Wassererhitzer',
  USERDEFINED: 'Benutzerdefiniert',
  NOTDEFINED: 'Nicht definiert',
};

/**
 * Extended types for coffee/gastronomy equipment (USERDEFINED subtypes)
 */
export type CoffeeEquipmentType =
  | 'ESPRESSOMACHINE'
  | 'COFFEEGRINDER'
  | 'COFFEEBREWER'
  | 'MILKFROTHER'
  | 'COFFEEROASTER'
  | 'WATERFILTRATION'
  | 'ICEMACHINE'
  | 'BLENDER'
  | 'TOASTER'
  | 'CONTACTGRILL'
  | 'DISPLAYCASE'
  | 'CASHREGISTER';

/**
 * German labels for Coffee/Gastronomy Equipment Types
 */
export const COFFEE_EQUIPMENT_LABELS: Record<CoffeeEquipmentType, string> = {
  ESPRESSOMACHINE: 'Espressomaschine',
  COFFEEGRINDER: 'Kaffeemühle',
  COFFEEBREWER: 'Filterkaffeemaschine',
  MILKFROTHER: 'Milchaufschäumer',
  COFFEEROASTER: 'Kaffeeröster',
  WATERFILTRATION: 'Wasserfilteranlage',
  ICEMACHINE: 'Eismaschine',
  BLENDER: 'Mixer/Blender',
  TOASTER: 'Toaster',
  CONTACTGRILL: 'Kontaktgrill',
  DISPLAYCASE: 'Vitrine/Auslage',
  CASHREGISTER: 'Kasse/POS',
};

// ============================================
// Asset Property Sets (Psets)
// ============================================

/**
 * Pset_Grunddaten - Basic asset information
 */
export interface PsetGrunddaten {
  /** Manufacturer / Hersteller */
  Hersteller: string;
  /** Type / Model designation */
  Typ: string;
  /** Serial number */
  Seriennummer: string;
  /** Category (e.g., Kaffeemaschine, Möbel, Kühlgerät) */
  Kategorie: string;
  /** IFC Electric Appliance Type (for electrical equipment) */
  IfcElectricApplianceType: IfcElectricApplianceTypeEnum | '';
  /** Coffee/Gastronomy specific type (when IfcElectricApplianceType is USERDEFINED) */
  CoffeeEquipmentType: CoffeeEquipmentType | '';
  /** Description */
  Beschreibung: string;
}

/**
 * Pset_KaufdatenGarantie - Purchase and warranty information
 */
export interface PsetKaufdatenGarantie {
  /** Purchase date (ISO date string) */
  Kaufdatum: string | null;
  /** Purchase price in CHF */
  Kaufpreis: number | null;
  /** Warranty expiration date (ISO date string) */
  GarantieBis: string | null;
  /** Supplier / Vendor */
  Lieferant: string;
  /** Condition: 'neu' | 'gebraucht' | 'aufbereitet' */
  Zustand: 'neu' | 'gebraucht' | 'aufbereitet' | string;
}

/**
 * Pset_TechnischeDaten - Technical specifications
 */
export interface PsetTechnischeDaten {
  /** Power consumption in Watts */
  Stromverbrauch: number | null;
  /** Energy efficiency class (A+++ to G) */
  Energieeffizienz: string;
  /** Operating temperature range (e.g., "5-35°C") */
  Betriebstemperatur: string;
  /** Utilization / Load capacity (e.g., "200 Tassen/Tag") */
  Auslastung: string;
}

/**
 * Pset_Dimensionen - Physical dimensions
 */
export interface PsetDimensionen {
  /** Width in meters */
  Breite: number;
  /** Depth in meters */
  Tiefe: number;
  /** Height in meters */
  Hoehe: number;
  /** Weight in kg (optional) */
  Gewicht: number | null;
}

/**
 * Default values for Grunddaten
 */
export const DEFAULT_PSET_GRUNDDATEN: PsetGrunddaten = {
  Hersteller: '',
  Typ: '',
  Seriennummer: '',
  Kategorie: '',
  IfcElectricApplianceType: '',
  CoffeeEquipmentType: '',
  Beschreibung: '',
};

/**
 * Default values for Kaufdaten & Garantie
 */
export const DEFAULT_PSET_KAUFDATEN: PsetKaufdatenGarantie = {
  Kaufdatum: null,
  Kaufpreis: null,
  GarantieBis: null,
  Lieferant: '',
  Zustand: 'neu',
};

/**
 * Default values for Technische Daten
 */
export const DEFAULT_PSET_TECHNISCHE_DATEN: PsetTechnischeDaten = {
  Stromverbrauch: null,
  Energieeffizienz: '',
  Betriebstemperatur: '',
  Auslastung: '',
};

/**
 * Creates default Dimensionen Pset from element dimensions
 */
export function createDefaultPsetDimensionen(
  width: number,
  depth: number,
  height: number
): PsetDimensionen {
  return {
    Breite: width,
    Tiefe: depth,
    Hoehe: height,
    Gewicht: null,
  };
}

/**
 * Creates all default asset property sets
 */
export function createDefaultAssetPropertySets(
  category: string,
  width: number,
  depth: number,
  height: number
): PropertySet[] {
  return [
    {
      name: 'Pset_Grunddaten',
      properties: {
        ...DEFAULT_PSET_GRUNDDATEN,
        Kategorie: category,
      } as PropertySet['properties'],
    },
    {
      name: 'Pset_KaufdatenGarantie',
      properties: { ...DEFAULT_PSET_KAUFDATEN } as PropertySet['properties'],
    },
    {
      name: 'Pset_TechnischeDaten',
      properties: { ...DEFAULT_PSET_TECHNISCHE_DATEN } as PropertySet['properties'],
    },
    {
      name: 'Pset_Dimensionen',
      properties: { ...createDefaultPsetDimensionen(width, depth, height) } as PropertySet['properties'],
    },
  ];
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
 * Wall alignment side - defines which edge of the wall the reference line represents
 * - 'left': Reference line is on the left side (looking from start to end)
 * - 'center': Reference line is the centerline (traditional)
 * - 'right': Reference line is on the right side (looking from start to end)
 */
export type WallAlignmentSide = 'left' | 'center' | 'right';

/**
 * German labels for Wall Alignment Sides
 */
export const WALL_ALIGNMENT_LABELS: Record<WallAlignmentSide, string> = {
  left: 'Links (Innenkante)',
  center: 'Mitte',
  right: 'Rechts (Aussenkante)',
};

/**
 * Wall-specific data
 */
export interface WallData {
  startPoint: Point2D;
  endPoint: Point2D;
  thickness: number;
  height: number;
  openings: Opening[];
  /** Which edge the reference line (startPoint/endPoint) represents */
  alignmentSide: WallAlignmentSide;
}

/**
 * Door types
 */
export type DoorType = 'single' | 'double' | 'sliding';

/**
 * Door swing side - inward or outward
 */
export type DoorSwingSide = 'inward' | 'outward';

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
  /** Whether door swings inward or outward */
  swingSide: DoorSwingSide;
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
 * Opening in a slab (for stairs, shafts, etc.)
 */
export interface SlabOpening {
  id: string;
  type: 'stair' | 'shaft' | 'other';
  /** Reference to the element that created this opening (e.g., stair ID) */
  elementId: string;
  /** Polygon outline of the opening in world coordinates */
  outline: Point2D[];
  /** Description for IFC export */
  description?: string;
}

/**
 * Slab-specific data (floors and ceilings)
 */
export interface SlabData {
  slabType: 'floor' | 'ceiling';
  thickness: number;
  outline: Point2D[];
  /** Vertical offset from storey elevation (positive = up, negative = down) */
  elevationOffset?: number;
  /** Openings in the slab (stair voids, shafts, etc.) */
  openings?: SlabOpening[];
}

/**
 * Supported 3D model formats for furniture import
 */
export type ModelFormat = 'glb' | 'gltf' | 'obj';

/**
 * Triangulated mesh data for IFC export
 * Stores vertices and face indices for IfcFacetedBrep export
 */
export interface MeshData {
  /** Flat array of vertex coordinates [x1,y1,z1, x2,y2,z2, ...] */
  vertices: number[];
  /** Face indices as triangles [v1,v2,v3, v4,v5,v6, ...] */
  indices: number[];
}

/**
 * Furniture-specific data
 */
export interface FurnitureData {
  category: string; // e.g., 'table', 'chair', 'coffee-machine'
  modelUrl?: string; // Blob URL or path to 3D file
  modelFormat?: ModelFormat; // Format of the 3D model
  originalFileName?: string; // Original file name for display
  width: number;
  depth: number;
  height: number;
  scale: number; // Uniform scale factor (default 1)
  /** Target dimensions from asset catalog (in meters) for auto-scaling */
  targetDimensions?: {
    width: number;
    depth: number;
    height: number;
  };
  /** Extracted mesh geometry for IFC export */
  meshData?: MeshData;
}

/**
 * Counter types (Theken-Typen)
 */
export type CounterType = 'standard' | 'bar' | 'service';

/**
 * Counter-specific data (Theken/Tresen)
 * The path represents the FRONT LINE (customer side).
 * The counter extends backwards (into service area) from this line.
 */
export interface CounterData {
  /** Front line path (customer side) - minimum 2 points */
  path: Point2D[];
  /** Counter depth from front to back (typically 60-80cm) */
  depth: number;
  /** Counter height (90cm standard, 110cm bar height) */
  height: number;
  /** Thickness of the countertop surface (2-5cm) */
  topThickness: number;
  /** Overhang beyond front line for customer seating (0-30cm) */
  overhang: number;
  /** Height of the kick/toe space at bottom (10-15cm) */
  kickHeight: number;
  /** Recess depth of kick space (5-10cm) */
  kickRecess: number;
  /** Type of counter affecting default dimensions */
  counterType: CounterType;
  /** Whether to include a footrest bar (typically for bar counters) */
  hasFootrest: boolean;
  /** Footrest height from floor (typically 20-25cm) */
  footrestHeight: number;
}

/**
 * Stair type enumeration
 */
export type StairType = 'straight' | 'l-shape' | 'u-shape';

/**
 * Calculated step dimensions based on total rise
 */
export interface StepCalculation {
  /** Number of risers (steps) */
  count: number;
  /** Riser height in meters (Steigung) */
  riserHeight: number;
  /** Tread depth in meters (Auftritt) */
  treadDepth: number;
  /** Total run length in meters (Lauflange) */
  runLength: number;
}

/**
 * Stair-specific data (IfcStair)
 */
export interface StairData {
  /** Type of stair */
  stairType: StairType;

  /** Stair width in meters (0.8 - 1.5m typical) */
  width: number;

  /** Total rise from bottom to top storey in meters */
  totalRise: number;

  /** ID of the bottom storey (where stair starts) */
  bottomStoreyId: string;

  /** ID of the top storey (where stair ends) */
  topStoreyId: string;

  /** Calculated step dimensions */
  steps: StepCalculation;

  /** Rotation angle in radians (direction of travel) */
  rotation: number;

  /** Whether to auto-create floor opening in top storey */
  createOpening: boolean;

  /** ID of the created opening element (if any) */
  openingId?: string;
}

/**
 * IFC Space type enumeration
 */
export type SpaceType = 'INTERNAL' | 'EXTERNAL' | 'NOTDEFINED';

/**
 * Gastro-spezifische Raumkategorien
 * Wird in IfcSpace.ObjectType gespeichert
 */
export type GastroSpaceCategory =
  | 'GASTRAUM'      // Gästebereich, Sitzplätze
  | 'BAR'           // Theken-/Barbereich
  | 'KUECHE'        // Küche, Zubereitung
  | 'LAGER'         // Lagerraum
  | 'SANITAER'      // WC, Waschraum
  | 'PERSONAL'      // Personalraum, Büro
  | 'EINGANG'       // Eingangsbereich, Windfang
  | 'TERRASSE'      // Aussensitzbereich
  | 'TECHNIK'       // Technikraum, Heizung
  | 'SONSTIGES';    // Nicht kategorisiert

/**
 * German labels for Gastro Space Categories
 */
export const GASTRO_SPACE_LABELS: Record<GastroSpaceCategory, string> = {
  GASTRAUM: 'Gastraum',
  BAR: 'Bar / Theke',
  KUECHE: 'Küche',
  LAGER: 'Lager',
  SANITAER: 'Sanitär / WC',
  PERSONAL: 'Personal / Büro',
  EINGANG: 'Eingang',
  TERRASSE: 'Terrasse',
  TECHNIK: 'Technik',
  SONSTIGES: 'Sonstiges',
};

/**
 * Colors for 3D visualization of Gastro Space Categories
 */
export const GASTRO_SPACE_COLORS: Record<GastroSpaceCategory, string> = {
  GASTRAUM: '#87CEEB',  // Hellblau - Gästebereich
  BAR: '#DDA0DD',       // Pflaume - Bar/Theke
  KUECHE: '#FFE4B5',    // Moccasin - Küche
  LAGER: '#D2B48C',     // Tan - Lager
  SANITAER: '#ADD8E6',  // Hellblau - Sanitär
  PERSONAL: '#98FB98',  // Hellgrün - Personal
  EINGANG: '#F5DEB3',   // Weizen - Eingang
  TERRASSE: '#90EE90',  // Hellgrün - Terrasse (Aussen)
  TECHNIK: '#A9A9A9',   // Dunkelgrau - Technik
  SONSTIGES: '#D3D3D3', // Hellgrau - Sonstiges
};

/**
 * Space-specific data (IfcSpace)
 * Represents a bounded area within a building storey
 */
export interface SpaceData {
  /** Closed boundary polygon defining the space outline (floor plan) */
  boundaryPolygon: Point2D[];

  /** Calculated gross floor area in square meters (Bruttofläche) */
  area: number;

  /** Calculated net floor area in square meters (Nettofläche) - excludes columns and counters */
  netFloorArea?: number;

  /** Calculated perimeter in meters */
  perimeter: number;

  /** IFC space type classification */
  spaceType: SpaceType;

  /** Optional long/descriptive name (e.g., "Hauptgastraum mit Theke") */
  longName?: string;

  /** IDs of walls that bound this space */
  boundingWallIds: string[];

  /** Optional floor finish height offset */
  floorFinishHeight?: number;

  /** Optional net/clear height of the space */
  netHeight?: number;

  /** Whether this space was auto-detected or manually created */
  autoDetected: boolean;

  /** Gastro-specific room category (stored in IfcSpace.ObjectType) */
  gastroCategory?: GastroSpaceCategory;
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
  counterData?: CounterData;
  spaceData?: SpaceData;
  stairData?: StairData;
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
export const DEFAULT_WALL_ALIGNMENT: WallAlignmentSide = 'left'; // Default to left edge for precise room boundaries

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

// Counter defaults
export const DEFAULT_COUNTER_DEPTH = 0.6; // 60cm standard depth
export const DEFAULT_COUNTER_HEIGHT = 0.9; // 90cm standard height
export const DEFAULT_BAR_COUNTER_HEIGHT = 1.1; // 110cm bar height
export const DEFAULT_COUNTER_TOP_THICKNESS = 0.04; // 4cm
export const DEFAULT_COUNTER_OVERHANG = 0.1; // 10cm overhang
export const DEFAULT_COUNTER_KICK_HEIGHT = 0.1; // 10cm
export const DEFAULT_COUNTER_KICK_RECESS = 0.05; // 5cm
export const DEFAULT_COUNTER_FOOTREST_HEIGHT = 0.2; // 20cm

// Space defaults
export const DEFAULT_SPACE_TYPE: SpaceType = 'INTERNAL';
export const DEFAULT_GASTRO_CATEGORY: GastroSpaceCategory = 'SONSTIGES';
/** Tolerance for connecting wall endpoints (in meters) */
export const SPACE_DETECTION_TOLERANCE = 0.05; // 5cm

// Stair defaults (DIN 18065 compliant)
export const DEFAULT_STAIR_WIDTH = 1.0; // 1m standard width
export const DEFAULT_STAIR_RISER_HEIGHT = 0.175; // 17.5cm ideal riser
export const DEFAULT_STAIR_TREAD_DEPTH = 0.28; // 28cm ideal tread
/** Schrittmassregel: 2h + a = 59-65cm (ideal: 63cm) */
export const STAIR_STEP_SIZE_RULE = 0.63; // 63cm
export const MIN_STAIR_RISER = 0.14; // 14cm minimum
export const MAX_STAIR_RISER = 0.21; // 21cm maximum
export const MIN_STAIR_TREAD = 0.21; // 21cm minimum
export const MAX_STAIR_TREAD = 0.37; // 37cm maximum
