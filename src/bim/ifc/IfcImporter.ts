import * as WebIFC from 'web-ifc';
import { v4 as uuidv4 } from 'uuid';
import type {
  BimElement,
  ProjectInfo,
  SiteInfo,
  BuildingInfo,
  StoreyInfo,
  PropertySet,
  WallData,
  DoorData,
  WindowData,
  ColumnData,
  SlabData,
  FurnitureData,
  MeshData,
  Opening,
} from '@/types/bim';
import {
  DEFAULT_WALL_HEIGHT,
  DEFAULT_WALL_THICKNESS,
  DEFAULT_WALL_ALIGNMENT,
  DEFAULT_DOOR_HEIGHT,
  DEFAULT_WINDOW_HEIGHT,
  DEFAULT_WINDOW_SILL_HEIGHT,
  DEFAULT_STOREY_HEIGHT,
} from '@/types/bim';
import type { Point2D, Vector3, Quaternion } from '@/types/geometry';
import { IDENTITY_QUATERNION } from '@/types/geometry';

/**
 * Result of an IFC import operation
 */
export interface ImportResult {
  project: ProjectInfo;
  site: SiteInfo;
  building: BuildingInfo;
  storeys: StoreyInfo[];
  elements: BimElement[];
  warnings: string[];
  stats: {
    wallsImported: number;
    doorsImported: number;
    windowsImported: number;
    columnsImported: number;
    slabsImported: number;
    furnitureImported: number;
    elementsSkipped: number;
  };
}

/**
 * Coordinate system options
 */
export type CoordinateSystem = 'z-up' | 'y-up';

/**
 * Import options
 */
export interface ImportOptions {
  /** Import walls */
  importWalls?: boolean;
  /** Import doors */
  importDoors?: boolean;
  /** Import windows */
  importWindows?: boolean;
  /** Import columns */
  importColumns?: boolean;
  /** Import slabs */
  importSlabs?: boolean;
  /** Import furniture */
  importFurniture?: boolean;
  /** Import property sets */
  importPropertySets?: boolean;
  /** Coordinate system of the IFC file (default: z-up) */
  coordinateSystem?: CoordinateSystem;
}

const DEFAULT_OPTIONS: ImportOptions = {
  importWalls: true,
  importDoors: true,
  importWindows: true,
  importColumns: true,
  importSlabs: true,
  importFurniture: true,
  importPropertySets: true,
  coordinateSystem: 'z-up',
};

/**
 * Internal mapping from IFC Express IDs to internal UUIDs
 */
interface IdMapping {
  storeys: Map<number, string>;
  walls: Map<number, string>;
  elements: Map<number, string>;
}

/**
 * IFC Importer using web-ifc
 * Parses IFC files and converts them to internal BIM model
 */
export class IfcImporter {
  private ifcApi: WebIFC.IfcAPI;
  private modelId: number = 0;
  private idMapping: IdMapping = {
    storeys: new Map(),
    walls: new Map(),
    elements: new Map(),
  };
  private warnings: string[] = [];
  private coordinateSystem: CoordinateSystem = 'z-up';

  constructor() {
    this.ifcApi = new WebIFC.IfcAPI();
  }

  /**
   * Transform coordinates from Y-up to Z-up if needed
   * Y-up: X=right, Y=up, Z=forward
   * Z-up: X=right, Y=forward, Z=up
   */
  private transformCoords(x: number, y: number, z: number): { x: number; y: number; z: number } {
    if (this.coordinateSystem === 'y-up') {
      // Swap Y and Z: Y becomes Z (height), Z becomes Y (depth)
      return { x, y: z, z: y };
    }
    return { x, y, z };
  }

  /**
   * Initialize the IFC API
   */
  async init(): Promise<void> {
    this.ifcApi.SetWasmPath('/');
    await this.ifcApi.Init();
  }

  /**
   * Import an IFC file
   */
  async import(data: Uint8Array, options: ImportOptions = {}): Promise<ImportResult> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    this.warnings = [];
    this.coordinateSystem = opts.coordinateSystem || 'z-up';
    this.idMapping = {
      storeys: new Map(),
      walls: new Map(),
      elements: new Map(),
    };

    // Open the model
    this.modelId = this.ifcApi.OpenModel(data, {
      COORDINATE_TO_ORIGIN: false,
    });

    if (this.modelId === -1) {
      throw new Error('Failed to open IFC file');
    }

    try {
      // Parse hierarchy
      const project = this.parseProject();
      const site = this.parseSite();
      const building = this.parseBuilding(site.id);
      const storeys = this.parseStoreys(building.id);

      // Parse elements
      const elements: BimElement[] = [];
      const stats = {
        wallsImported: 0,
        doorsImported: 0,
        windowsImported: 0,
        columnsImported: 0,
        slabsImported: 0,
        furnitureImported: 0,
        elementsSkipped: 0,
      };

      // Parse walls first (doors/windows need wall references)
      if (opts.importWalls) {
        const walls = this.parseWalls(storeys, opts.importPropertySets ?? true);
        elements.push(...walls);
        stats.wallsImported = walls.length;
      }

      // Parse doors
      if (opts.importDoors) {
        const doors = this.parseDoors(storeys, elements, opts.importPropertySets ?? true);
        elements.push(...doors);
        stats.doorsImported = doors.length;
      }

      // Parse windows
      if (opts.importWindows) {
        const windows = this.parseWindows(storeys, elements, opts.importPropertySets ?? true);
        elements.push(...windows);
        stats.windowsImported = windows.length;
      }

      // Parse columns
      if (opts.importColumns) {
        const columns = this.parseColumns(storeys, opts.importPropertySets ?? true);
        elements.push(...columns);
        stats.columnsImported = columns.length;
      }

      // Parse slabs
      if (opts.importSlabs) {
        const slabs = this.parseSlabs(storeys, opts.importPropertySets ?? true);
        elements.push(...slabs);
        stats.slabsImported = slabs.length;
      }

      // Parse furniture
      if (opts.importFurniture) {
        const furniture = this.parseFurniture(storeys, opts.importPropertySets ?? true);
        elements.push(...furniture);
        stats.furnitureImported = furniture.length;
      }

      return {
        project,
        site,
        building,
        storeys,
        elements,
        warnings: this.warnings,
        stats,
      };
    } finally {
      // Always close the model
      this.ifcApi.CloseModel(this.modelId);
    }
  }

  // ============================================
  // Hierarchy Parsing
  // ============================================

  private parseProject(): ProjectInfo {
    const projectIds = this.ifcApi.GetLineIDsWithType(this.modelId, WebIFC.IFCPROJECT);

    if (projectIds.size() === 0) {
      this.warnings.push('No IfcProject found, using defaults');
      return {
        id: uuidv4(),
        name: 'Imported Project',
        description: '',
      };
    }

    const project = this.ifcApi.GetLine(this.modelId, projectIds.get(0));

    return {
      id: uuidv4(),
      name: this.getStringValue(project.Name) || 'Imported Project',
      description: this.getStringValue(project.Description) || '',
    };
  }

  private parseSite(): SiteInfo {
    const siteIds = this.ifcApi.GetLineIDsWithType(this.modelId, WebIFC.IFCSITE);

    if (siteIds.size() === 0) {
      this.warnings.push('No IfcSite found, using defaults');
      return {
        id: uuidv4(),
        name: 'Site',
        address: '',
      };
    }

    const site = this.ifcApi.GetLine(this.modelId, siteIds.get(0));

    return {
      id: uuidv4(),
      name: this.getStringValue(site.Name) || 'Site',
      address: '',
      latitude: this.parseLatLong(site.RefLatitude),
      longitude: this.parseLatLong(site.RefLongitude),
      elevation: this.getNumberValue(site.RefElevation),
    };
  }

  private parseBuilding(siteId: string): BuildingInfo {
    const buildingIds = this.ifcApi.GetLineIDsWithType(this.modelId, WebIFC.IFCBUILDING);

    if (buildingIds.size() === 0) {
      this.warnings.push('No IfcBuilding found, using defaults');
      return {
        id: uuidv4(),
        name: 'Building',
        siteId,
      };
    }

    const building = this.ifcApi.GetLine(this.modelId, buildingIds.get(0));

    return {
      id: uuidv4(),
      name: this.getStringValue(building.Name) || 'Building',
      siteId,
    };
  }

  private parseStoreys(buildingId: string): StoreyInfo[] {
    const storeyIds = this.ifcApi.GetLineIDsWithType(this.modelId, WebIFC.IFCBUILDINGSTOREY);
    const storeys: StoreyInfo[] = [];

    if (storeyIds.size() === 0) {
      this.warnings.push('No IfcBuildingStorey found, creating default');
      const defaultStorey: StoreyInfo = {
        id: uuidv4(),
        name: 'Ground Floor',
        buildingId,
        elevation: 0,
        height: DEFAULT_STOREY_HEIGHT,
      };
      return [defaultStorey];
    }

    for (let i = 0; i < storeyIds.size(); i++) {
      const expressId = storeyIds.get(i);
      const storey = this.ifcApi.GetLine(this.modelId, expressId);

      const id = uuidv4();
      this.idMapping.storeys.set(expressId, id);

      storeys.push({
        id,
        name: this.getStringValue(storey.Name) || `Storey ${i + 1}`,
        buildingId,
        elevation: this.getNumberValue(storey.Elevation) || 0,
        height: DEFAULT_STOREY_HEIGHT,
      });
    }

    // Sort by elevation
    storeys.sort((a, b) => a.elevation - b.elevation);

    // Calculate heights based on elevation differences
    for (let i = 0; i < storeys.length - 1; i++) {
      const current = storeys[i]!;
      const next = storeys[i + 1]!;
      current.height = next.elevation - current.elevation;
    }

    return storeys;
  }

  // ============================================
  // Element Parsing
  // ============================================

  private parseWalls(storeys: StoreyInfo[], importPsets: boolean): BimElement[] {
    const walls: BimElement[] = [];

    // Get both IfcWall and IfcWallStandardCase
    const wallTypes = [WebIFC.IFCWALL, WebIFC.IFCWALLSTANDARDCASE];

    for (const wallType of wallTypes) {
      const wallIds = this.ifcApi.GetLineIDsWithType(this.modelId, wallType);

      for (let i = 0; i < wallIds.size(); i++) {
        const expressId = wallIds.get(i);

        try {
          const wall = this.parseWall(expressId, storeys, importPsets);
          if (wall) {
            walls.push(wall);
            this.idMapping.walls.set(expressId, wall.id);
            this.idMapping.elements.set(expressId, wall.id);
          }
        } catch (err) {
          this.warnings.push(`Failed to parse wall #${expressId}: ${err}`);
        }
      }
    }

    return walls;
  }

  private parseWall(expressId: number, storeys: StoreyInfo[], importPsets: boolean): BimElement | null {
    const ifcWall = this.ifcApi.GetLine(this.modelId, expressId);
    const id = uuidv4();

    // Get placement
    const placement = this.getPlacement(ifcWall.ObjectPlacement?.value);

    // Try to extract wall geometry
    const wallGeom = this.extractWallGeometry(expressId, placement);

    if (!wallGeom) {
      this.warnings.push(`Could not extract geometry for wall #${expressId}`);
      return null;
    }

    // Find parent storey
    const parentId = this.findParentStorey(expressId, storeys);

    const wallData: WallData = {
      startPoint: wallGeom.startPoint,
      endPoint: wallGeom.endPoint,
      thickness: wallGeom.thickness,
      height: wallGeom.height,
      openings: [],
      alignmentSide: DEFAULT_WALL_ALIGNMENT,
    };

    const element: BimElement = {
      id,
      type: 'wall',
      name: this.getStringValue(ifcWall.Name) || `Wall ${expressId}`,
      geometry: {
        profile: [],
        height: wallGeom.height,
        direction: { x: 0, y: 0, z: 1 },
      },
      placement: {
        position: { x: 0, y: 0, z: 0 },
        rotation: IDENTITY_QUATERNION,
      },
      properties: importPsets ? this.getPropertySets(expressId) : [],
      parentId,
      wallData,
    };

    return element;
  }

  private extractWallGeometry(
    expressId: number,
    placement: { position: Vector3; rotation: number }
  ): { startPoint: Point2D; endPoint: Point2D; thickness: number; height: number } | null {
    try {
      const ifcWall = this.ifcApi.GetLine(this.modelId, expressId);

      // Try to get geometry from representation
      if (ifcWall.Representation?.value) {
        const rep = this.ifcApi.GetLine(this.modelId, ifcWall.Representation.value);

        for (const repRef of rep.Representations || []) {
          const shapeRep = this.ifcApi.GetLine(this.modelId, repRef.value);

          // Look for SweptSolid representation
          if (shapeRep.RepresentationType?.value === 'SweptSolid') {
            for (const itemRef of shapeRep.Items || []) {
              const item = this.ifcApi.GetLine(this.modelId, itemRef.value);

              if (item.type === WebIFC.IFCEXTRUDEDAREASOLID) {
                return this.extractFromExtrudedSolid(item, placement);
              }
            }
          }
        }
      }

      // Fallback: Use mesh bounding box
      return this.extractWallFromMesh(expressId, placement);
    } catch {
      return this.extractWallFromMesh(expressId, placement);
    }
  }

  private extractFromExtrudedSolid(
    solid: { Depth?: { value?: number }; SweptArea?: { value?: number } },
    placement: { position: Vector3; rotation: number }
  ): { startPoint: Point2D; endPoint: Point2D; thickness: number; height: number } | null {
    try {
      const height = this.getNumberValue(solid.Depth) || DEFAULT_WALL_HEIGHT;

      // Get the profile
      if (solid.SweptArea?.value) {
        const profile = this.ifcApi.GetLine(this.modelId, solid.SweptArea.value);

        if (profile.type === WebIFC.IFCRECTANGLEPROFILEDEF) {
          const width = this.getNumberValue(profile.XDim) || 1;
          const thickness = this.getNumberValue(profile.YDim) || DEFAULT_WALL_THICKNESS;

          // Calculate start and end points based on placement and rotation
          const cos = Math.cos(placement.rotation);
          const sin = Math.sin(placement.rotation);

          const halfWidth = width / 2;

          const startPoint: Point2D = {
            x: placement.position.x - halfWidth * cos,
            y: placement.position.y - halfWidth * sin,
          };

          const endPoint: Point2D = {
            x: placement.position.x + halfWidth * cos,
            y: placement.position.y + halfWidth * sin,
          };

          return { startPoint, endPoint, thickness, height };
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  private extractWallFromMesh(
    expressId: number,
    _placement: { position: Vector3; rotation: number }
  ): { startPoint: Point2D; endPoint: Point2D; thickness: number; height: number } | null {
    try {
      const mesh = this.ifcApi.GetFlatMesh(this.modelId, expressId);

      if (mesh.geometries.size() === 0) {
        return null;
      }

      // Calculate bounding box from all geometries
      let minX = Infinity,
        maxX = -Infinity;
      let minY = Infinity,
        maxY = -Infinity;
      let minZ = Infinity,
        maxZ = -Infinity;

      for (let i = 0; i < mesh.geometries.size(); i++) {
        const pg = mesh.geometries.get(i);
        const geom = this.ifcApi.GetGeometry(this.modelId, pg.geometryExpressID);

        const vertices = this.ifcApi.GetVertexArray(
          geom.GetVertexData(),
          geom.GetVertexDataSize()
        ) as Float32Array;

        // Apply transformation
        const t = pg.flatTransformation;

        // vertices are [x,y,z,nx,ny,nz, x,y,z,nx,ny,nz, ...]
        for (let v = 0; v < vertices.length; v += 6) {
          const x = vertices[v] ?? 0;
          const y = vertices[v + 1] ?? 0;
          const z = vertices[v + 2] ?? 0;

          // Apply 4x4 transformation matrix (with null-safety)
          let tx = (t[0] ?? 1) * x + (t[4] ?? 0) * y + (t[8] ?? 0) * z + (t[12] ?? 0);
          let ty = (t[1] ?? 0) * x + (t[5] ?? 1) * y + (t[9] ?? 0) * z + (t[13] ?? 0);
          let tz = (t[2] ?? 0) * x + (t[6] ?? 0) * y + (t[10] ?? 1) * z + (t[14] ?? 0);

          // Apply coordinate system transformation
          const transformed = this.transformCoords(tx, ty, tz);
          tx = transformed.x;
          ty = transformed.y;
          tz = transformed.z;

          minX = Math.min(minX, tx);
          maxX = Math.max(maxX, tx);
          minY = Math.min(minY, ty);
          maxY = Math.max(maxY, ty);
          minZ = Math.min(minZ, tz);
          maxZ = Math.max(maxZ, tz);
        }

        geom.delete();
      }

      // Determine wall orientation from bounding box
      // After transformation: X/Y are horizontal plane, Z is vertical (height)
      const dx = maxX - minX;
      const dy = maxY - minY;
      const dz = maxZ - minZ;

      let startPoint: Point2D;
      let endPoint: Point2D;
      let thickness: number;

      // Wall is longer in X direction
      if (dx > dy) {
        startPoint = { x: minX, y: (minY + maxY) / 2 };
        endPoint = { x: maxX, y: (minY + maxY) / 2 };
        thickness = dy;
      } else {
        startPoint = { x: (minX + maxX) / 2, y: minY };
        endPoint = { x: (minX + maxX) / 2, y: maxY };
        thickness = dx;
      }

      const height = dz;

      // Ensure minimum thickness
      if (thickness < 0.05) {
        thickness = DEFAULT_WALL_THICKNESS;
      }

      return { startPoint, endPoint, thickness, height };
    } catch {
      return null;
    }
  }

  private parseDoors(storeys: StoreyInfo[], walls: BimElement[], importPsets: boolean): BimElement[] {
    const doors: BimElement[] = [];
    const doorIds = this.ifcApi.GetLineIDsWithType(this.modelId, WebIFC.IFCDOOR);

    for (let i = 0; i < doorIds.size(); i++) {
      const expressId = doorIds.get(i);

      try {
        const door = this.parseDoor(expressId, storeys, walls, importPsets);
        if (door) {
          doors.push(door);
          this.idMapping.elements.set(expressId, door.id);
        }
      } catch (err) {
        this.warnings.push(`Failed to parse door #${expressId}: ${err}`);
      }
    }

    return doors;
  }

  private parseDoor(
    expressId: number,
    storeys: StoreyInfo[],
    walls: BimElement[],
    importPsets: boolean
  ): BimElement | null {
    const ifcDoor = this.ifcApi.GetLine(this.modelId, expressId);
    const id = uuidv4();

    // Get dimensions
    const width = this.getNumberValue(ifcDoor.OverallWidth) || 0.9;
    const height = this.getNumberValue(ifcDoor.OverallHeight) || DEFAULT_DOOR_HEIGHT;

    // Find host wall via IfcRelFillsElement -> IfcRelVoidsElement
    const hostWallInfo = this.findHostWall(expressId, walls);

    if (!hostWallInfo) {
      this.warnings.push(`Door #${expressId} has no host wall, skipping`);
      return null;
    }

    // Get placement
    const placement = this.getPlacement(ifcDoor.ObjectPlacement?.value);

    // Calculate position on wall - prefer mesh-based calculation for accuracy
    let positionOnWall = this.calculatePositionOnWallFromMesh(
      expressId,
      hostWallInfo.wall.wallData!
    );

    // Fallback to placement-based if mesh gives default value
    if (positionOnWall === 0.5) {
      const placementPos = this.calculatePositionOnWall(
        placement.position,
        hostWallInfo.wall.wallData!
      );
      if (placementPos !== 0.5) {
        positionOnWall = placementPos;
      }
    }

    // Find parent storey
    const parentId = this.findParentStorey(expressId, storeys) || hostWallInfo.wall.parentId;

    const doorData: DoorData = {
      width,
      height,
      doorType: 'single',
      hostWallId: hostWallInfo.wall.id,
      positionOnWall,
      swingDirection: 'left',
      swingSide: 'inward',
      distanceFromLeft: 0,
      distanceFromRight: 0,
      sillHeight: 0,
    };

    // Add opening to host wall
    const opening: Opening = {
      id: uuidv4(),
      type: 'door',
      elementId: id,
      position: positionOnWall,
      width,
      height,
      sillHeight: 0,
    };
    hostWallInfo.wall.wallData!.openings.push(opening);

    const element: BimElement = {
      id,
      type: 'door',
      name: this.getStringValue(ifcDoor.Name) || `Door ${expressId}`,
      geometry: {
        profile: [],
        height,
        direction: { x: 0, y: 0, z: 1 },
      },
      placement: {
        position: placement.position,
        rotation: this.rotationToQuaternion(placement.rotation),
      },
      properties: importPsets ? this.getPropertySets(expressId) : [],
      parentId,
      doorData,
    };

    return element;
  }

  private parseWindows(storeys: StoreyInfo[], walls: BimElement[], importPsets: boolean): BimElement[] {
    const windows: BimElement[] = [];
    const windowIds = this.ifcApi.GetLineIDsWithType(this.modelId, WebIFC.IFCWINDOW);

    for (let i = 0; i < windowIds.size(); i++) {
      const expressId = windowIds.get(i);

      try {
        const window = this.parseWindow(expressId, storeys, walls, importPsets);
        if (window) {
          windows.push(window);
          this.idMapping.elements.set(expressId, window.id);
        }
      } catch (err) {
        this.warnings.push(`Failed to parse window #${expressId}: ${err}`);
      }
    }

    return windows;
  }

  private parseWindow(
    expressId: number,
    storeys: StoreyInfo[],
    walls: BimElement[],
    importPsets: boolean
  ): BimElement | null {
    const ifcWindow = this.ifcApi.GetLine(this.modelId, expressId);
    const id = uuidv4();

    // Get dimensions
    const width = this.getNumberValue(ifcWindow.OverallWidth) || 1.2;
    const height = this.getNumberValue(ifcWindow.OverallHeight) || DEFAULT_WINDOW_HEIGHT;

    // Find host wall
    const hostWallInfo = this.findHostWall(expressId, walls);

    if (!hostWallInfo) {
      this.warnings.push(`Window #${expressId} has no host wall, skipping`);
      return null;
    }

    // Get placement
    const placement = this.getPlacement(ifcWindow.ObjectPlacement?.value);

    // Calculate position on wall and sill height
    const positionOnWall = this.calculatePositionOnWall(
      placement.position,
      hostWallInfo.wall.wallData!
    );

    // Estimate sill height from Z position
    const storey = storeys.find((s) => s.id === hostWallInfo.wall.parentId);
    const sillHeight = Math.max(0, placement.position.z - (storey?.elevation || 0));

    // Find parent storey
    const parentId = this.findParentStorey(expressId, storeys) || hostWallInfo.wall.parentId;

    const windowData: WindowData = {
      width,
      height,
      sillHeight: sillHeight || DEFAULT_WINDOW_SILL_HEIGHT,
      windowType: 'single',
      hostWallId: hostWallInfo.wall.id,
      positionOnWall,
      distanceFromLeft: 0,
      distanceFromRight: 0,
    };

    // Add opening to host wall
    const opening: Opening = {
      id: uuidv4(),
      type: 'window',
      elementId: id,
      position: positionOnWall,
      width,
      height,
      sillHeight: windowData.sillHeight,
    };
    hostWallInfo.wall.wallData!.openings.push(opening);

    const element: BimElement = {
      id,
      type: 'window',
      name: this.getStringValue(ifcWindow.Name) || `Window ${expressId}`,
      geometry: {
        profile: [],
        height,
        direction: { x: 0, y: 0, z: 1 },
      },
      placement: {
        position: placement.position,
        rotation: this.rotationToQuaternion(placement.rotation),
      },
      properties: importPsets ? this.getPropertySets(expressId) : [],
      parentId,
      windowData,
    };

    return element;
  }

  private parseColumns(storeys: StoreyInfo[], importPsets: boolean): BimElement[] {
    const columns: BimElement[] = [];
    const columnIds = this.ifcApi.GetLineIDsWithType(this.modelId, WebIFC.IFCCOLUMN);

    for (let i = 0; i < columnIds.size(); i++) {
      const expressId = columnIds.get(i);

      try {
        const column = this.parseColumn(expressId, storeys, importPsets);
        if (column) {
          columns.push(column);
          this.idMapping.elements.set(expressId, column.id);
        }
      } catch (err) {
        this.warnings.push(`Failed to parse column #${expressId}: ${err}`);
      }
    }

    return columns;
  }

  private parseColumn(expressId: number, storeys: StoreyInfo[], importPsets: boolean): BimElement | null {
    const ifcColumn = this.ifcApi.GetLine(this.modelId, expressId);
    const id = uuidv4();

    // Get placement
    const placement = this.getPlacement(ifcColumn.ObjectPlacement?.value);

    // Extract column geometry
    const columnGeom = this.extractColumnGeometry(expressId);

    // Find parent storey
    const parentId = this.findParentStorey(expressId, storeys);

    const columnData: ColumnData = {
      profileType: columnGeom?.profileType || 'rectangular',
      width: columnGeom?.width || 0.3,
      depth: columnGeom?.depth || 0.3,
      height: columnGeom?.height || DEFAULT_STOREY_HEIGHT,
    };

    const element: BimElement = {
      id,
      type: 'column',
      name: this.getStringValue(ifcColumn.Name) || `Column ${expressId}`,
      geometry: {
        profile: [],
        height: columnData.height,
        direction: { x: 0, y: 0, z: 1 },
      },
      placement: {
        position: placement.position,
        rotation: this.rotationToQuaternion(placement.rotation),
      },
      properties: importPsets ? this.getPropertySets(expressId) : [],
      parentId,
      columnData,
    };

    return element;
  }

  private extractColumnGeometry(expressId: number): {
    profileType: 'rectangular' | 'circular';
    width: number;
    depth: number;
    height: number;
  } | null {
    try {
      const ifcColumn = this.ifcApi.GetLine(this.modelId, expressId);

      if (ifcColumn.Representation?.value) {
        const rep = this.ifcApi.GetLine(this.modelId, ifcColumn.Representation.value);

        for (const repRef of rep.Representations || []) {
          const shapeRep = this.ifcApi.GetLine(this.modelId, repRef.value);

          if (shapeRep.RepresentationType?.value === 'SweptSolid') {
            for (const itemRef of shapeRep.Items || []) {
              const item = this.ifcApi.GetLine(this.modelId, itemRef.value);

              if (item.type === WebIFC.IFCEXTRUDEDAREASOLID) {
                const height = this.getNumberValue(item.Depth) || DEFAULT_STOREY_HEIGHT;

                if (item.SweptArea?.value) {
                  const profile = this.ifcApi.GetLine(this.modelId, item.SweptArea.value);

                  if (profile.type === WebIFC.IFCRECTANGLEPROFILEDEF) {
                    return {
                      profileType: 'rectangular',
                      width: this.getNumberValue(profile.XDim) || 0.3,
                      depth: this.getNumberValue(profile.YDim) || 0.3,
                      height,
                    };
                  } else if (profile.type === WebIFC.IFCCIRCLEPROFILEDEF) {
                    const radius = this.getNumberValue(profile.Radius) || 0.15;
                    return {
                      profileType: 'circular',
                      width: radius * 2,
                      depth: radius * 2,
                      height,
                    };
                  }
                }
              }
            }
          }
        }
      }

      // Fallback to bounding box
      return this.extractColumnFromMesh(expressId);
    } catch {
      return null;
    }
  }

  private extractColumnFromMesh(expressId: number): {
    profileType: 'rectangular' | 'circular';
    width: number;
    depth: number;
    height: number;
  } | null {
    try {
      const mesh = this.ifcApi.GetFlatMesh(this.modelId, expressId);

      if (mesh.geometries.size() === 0) {
        return null;
      }

      const bbox = this.calculateBoundingBox(mesh);

      return {
        profileType: 'rectangular',
        width: bbox.maxX - bbox.minX,
        depth: bbox.maxY - bbox.minY,
        height: bbox.maxZ - bbox.minZ,
      };
    } catch {
      return null;
    }
  }

  private parseSlabs(storeys: StoreyInfo[], importPsets: boolean): BimElement[] {
    const slabs: BimElement[] = [];
    const slabIds = this.ifcApi.GetLineIDsWithType(this.modelId, WebIFC.IFCSLAB);

    for (let i = 0; i < slabIds.size(); i++) {
      const expressId = slabIds.get(i);

      try {
        const slab = this.parseSlab(expressId, storeys, importPsets);
        if (slab) {
          slabs.push(slab);
          this.idMapping.elements.set(expressId, slab.id);
        }
      } catch (err) {
        this.warnings.push(`Failed to parse slab #${expressId}: ${err}`);
      }
    }

    return slabs;
  }

  private parseSlab(expressId: number, storeys: StoreyInfo[], importPsets: boolean): BimElement | null {
    const ifcSlab = this.ifcApi.GetLine(this.modelId, expressId);
    const id = uuidv4();

    // Get placement
    const placement = this.getPlacement(ifcSlab.ObjectPlacement?.value);

    // Extract slab geometry
    const slabGeom = this.extractSlabGeometry(expressId);

    if (!slabGeom) {
      this.warnings.push(`Could not extract geometry for slab #${expressId}`);
      return null;
    }

    // Find parent storey
    const parentId = this.findParentStorey(expressId, storeys);

    // Determine slab type
    const predefinedType = this.getStringValue(ifcSlab.PredefinedType) || 'FLOOR';
    const slabType: 'floor' | 'ceiling' = predefinedType === 'ROOF' ? 'ceiling' : 'floor';

    const slabData: SlabData = {
      slabType,
      thickness: slabGeom.thickness,
      outline: slabGeom.outline,
    };

    const element: BimElement = {
      id,
      type: 'slab',
      name: this.getStringValue(ifcSlab.Name) || `Slab ${expressId}`,
      geometry: {
        profile: slabGeom.outline,
        height: slabGeom.thickness,
        direction: { x: 0, y: 0, z: 1 },
      },
      placement: {
        position: placement.position,
        rotation: this.rotationToQuaternion(placement.rotation),
      },
      properties: importPsets ? this.getPropertySets(expressId) : [],
      parentId,
      slabData,
    };

    return element;
  }

  private extractSlabGeometry(expressId: number): { outline: Point2D[]; thickness: number } | null {
    try {
      const mesh = this.ifcApi.GetFlatMesh(this.modelId, expressId);

      if (mesh.geometries.size() === 0) {
        return null;
      }

      const bbox = this.calculateBoundingBox(mesh);

      // Create rectangular outline from bounding box
      const outline: Point2D[] = [
        { x: bbox.minX, y: bbox.minY },
        { x: bbox.maxX, y: bbox.minY },
        { x: bbox.maxX, y: bbox.maxY },
        { x: bbox.minX, y: bbox.maxY },
      ];

      const thickness = bbox.maxZ - bbox.minZ;

      return { outline, thickness: Math.max(thickness, 0.1) };
    } catch {
      return null;
    }
  }

  private parseFurniture(storeys: StoreyInfo[], importPsets: boolean): BimElement[] {
    const furniture: BimElement[] = [];

    // Get IfcFurnishingElement, IfcFurniture, and IfcElectricalAppliance
    const furnitureTypes = [
      WebIFC.IFCFURNISHINGELEMENT,
      WebIFC.IFCFURNITURE,
      WebIFC.IFCELECTRICAPPLIANCE,
    ];

    for (const furnitureType of furnitureTypes) {
      const furnitureIds = this.ifcApi.GetLineIDsWithType(this.modelId, furnitureType);

      for (let i = 0; i < furnitureIds.size(); i++) {
        const expressId = furnitureIds.get(i);

        try {
          const item = this.parseFurnitureItem(expressId, storeys, importPsets);
          if (item) {
            furniture.push(item);
            this.idMapping.elements.set(expressId, item.id);
          }
        } catch (err) {
          this.warnings.push(`Failed to parse furniture #${expressId}: ${err}`);
        }
      }
    }

    // Also check for IfcBuildingElementProxy (may contain counters)
    const proxyIds = this.ifcApi.GetLineIDsWithType(this.modelId, WebIFC.IFCBUILDINGELEMENTPROXY);

    for (let i = 0; i < proxyIds.size(); i++) {
      const expressId = proxyIds.get(i);

      try {
        const proxy = this.ifcApi.GetLine(this.modelId, expressId);
        const objectType = this.getStringValue(proxy.ObjectType) || '';

        // Only import as furniture if it looks like furniture/counter
        if (
          objectType.toLowerCase().includes('counter') ||
          objectType.toLowerCase().includes('furniture') ||
          objectType.toLowerCase().includes('theke')
        ) {
          const item = this.parseFurnitureItem(expressId, storeys, importPsets);
          if (item) {
            furniture.push(item);
            this.idMapping.elements.set(expressId, item.id);
          }
        }
      } catch {
        // Silently skip non-furniture proxies
      }
    }

    return furniture;
  }

  private parseFurnitureItem(
    expressId: number,
    storeys: StoreyInfo[],
    importPsets: boolean
  ): BimElement | null {
    const ifcFurniture = this.ifcApi.GetLine(this.modelId, expressId);
    const id = uuidv4();

    // Get placement
    const placement = this.getPlacement(ifcFurniture.ObjectPlacement?.value);

    // Extract mesh geometry
    const meshData = this.extractMeshData(expressId);

    if (!meshData) {
      this.warnings.push(`Could not extract geometry for furniture #${expressId}`);
      return null;
    }

    // Calculate bounding box for dimensions
    const bbox = this.calculateBoundingBoxFromMeshData(meshData);

    // Find parent storey
    const parentId = this.findParentStorey(expressId, storeys);

    // Get category from ObjectType or Description
    const category =
      this.getStringValue(ifcFurniture.ObjectType) ||
      this.getStringValue(ifcFurniture.Description) ||
      'Furniture';

    const furnitureData: FurnitureData = {
      category,
      width: bbox.maxX - bbox.minX,
      depth: bbox.maxY - bbox.minY,
      height: bbox.maxZ - bbox.minZ,
      scale: 1,
      meshData,
    };

    const element: BimElement = {
      id,
      type: 'furniture',
      name: this.getStringValue(ifcFurniture.Name) || `Furniture ${expressId}`,
      geometry: {
        profile: [],
        height: furnitureData.height,
        direction: { x: 0, y: 0, z: 1 },
      },
      placement: {
        position: placement.position,
        rotation: this.rotationToQuaternion(placement.rotation),
      },
      properties: importPsets ? this.getPropertySets(expressId) : [],
      parentId,
      furnitureData,
    };

    return element;
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Get world placement by recursively accumulating the placement hierarchy.
   * IFC uses nested IfcLocalPlacement with PlacementRelTo references that
   * need to be followed up to the root.
   */
  private getPlacement(placementId: number | undefined): { position: Vector3; rotation: number } {
    const defaultPlacement = { position: { x: 0, y: 0, z: 0 }, rotation: 0 };

    if (!placementId) {
      return defaultPlacement;
    }

    try {
      // Recursively accumulate placement hierarchy
      return this.accumulatePlacement(placementId, new Set());
    } catch {
      return defaultPlacement;
    }
  }

  /**
   * Recursively accumulate placement transformations up the hierarchy
   */
  private accumulatePlacement(
    placementId: number,
    visited: Set<number>
  ): { position: Vector3; rotation: number } {
    // Prevent infinite loops
    if (visited.has(placementId)) {
      return { position: { x: 0, y: 0, z: 0 }, rotation: 0 };
    }
    visited.add(placementId);

    const placement = this.ifcApi.GetLine(this.modelId, placementId);

    if (placement.type !== WebIFC.IFCLOCALPLACEMENT) {
      return { position: { x: 0, y: 0, z: 0 }, rotation: 0 };
    }

    // Get the relative placement (IfcAxis2Placement3D or IfcAxis2Placement2D)
    let localPosition: Vector3 = { x: 0, y: 0, z: 0 };
    let localRotation = 0;

    if (placement.RelativePlacement?.value) {
      const axis2Placement = this.ifcApi.GetLine(this.modelId, placement.RelativePlacement.value);

      // Get location
      if (axis2Placement.Location?.value) {
        const location = this.ifcApi.GetLine(this.modelId, axis2Placement.Location.value);
        const coords = location.Coordinates || [];

        localPosition = {
          x: this.getNumberValue(coords[0]) || 0,
          y: this.getNumberValue(coords[1]) || 0,
          z: this.getNumberValue(coords[2]) || 0,
        };
      }

      // Get rotation from RefDirection (X-axis direction)
      if (axis2Placement.RefDirection?.value) {
        const refDir = this.ifcApi.GetLine(this.modelId, axis2Placement.RefDirection.value);
        const ratios = refDir.DirectionRatios || [];

        const dx = this.getNumberValue(ratios[0]) || 1;
        const dy = this.getNumberValue(ratios[1]) || 0;

        localRotation = Math.atan2(dy, dx);
      }
    }

    // If there's a parent placement, recursively get it and combine
    if (placement.PlacementRelTo?.value) {
      const parentPlacement = this.accumulatePlacement(placement.PlacementRelTo.value, visited);

      // Transform local position by parent rotation
      const cos = Math.cos(parentPlacement.rotation);
      const sin = Math.sin(parentPlacement.rotation);

      const rotatedX = localPosition.x * cos - localPosition.y * sin;
      const rotatedY = localPosition.x * sin + localPosition.y * cos;

      // Combine positions (parent + rotated local)
      const worldPosition: Vector3 = {
        x: parentPlacement.position.x + rotatedX,
        y: parentPlacement.position.y + rotatedY,
        z: parentPlacement.position.z + localPosition.z,
      };

      // Combine rotations
      const worldRotation = parentPlacement.rotation + localRotation;

      return { position: worldPosition, rotation: worldRotation };
    }

    // No parent, return local placement directly
    return { position: localPosition, rotation: localRotation };
  }

  private findParentStorey(expressId: number, storeys: StoreyInfo[]): string | null {
    try {
      // Look through IfcRelContainedInSpatialStructure
      const relIds = this.ifcApi.GetLineIDsWithType(
        this.modelId,
        WebIFC.IFCRELCONTAINEDINSPATIALSTRUCTURE
      );

      for (let i = 0; i < relIds.size(); i++) {
        const rel = this.ifcApi.GetLine(this.modelId, relIds.get(i));

        // Check if this element is in RelatedElements
        const relatedElements = rel.RelatedElements || [];
        const isContained = relatedElements.some(
          (ref: { value: number }) => ref.value === expressId
        );

        if (isContained && rel.RelatingStructure?.value) {
          const structureId = rel.RelatingStructure.value;
          const mappedId = this.idMapping.storeys.get(structureId);

          if (mappedId) {
            return mappedId;
          }
        }
      }
    } catch {
      // Return null on error
    }

    // Default to first storey
    return storeys[0]?.id || null;
  }

  private findHostWall(
    openingElementId: number,
    walls: BimElement[]
  ): { wall: BimElement; openingId: number } | null {
    try {
      // Find IfcRelFillsElement where this door/window fills an opening
      const fillsIds = this.ifcApi.GetLineIDsWithType(this.modelId, WebIFC.IFCRELFILLSELEMENT);

      for (let i = 0; i < fillsIds.size(); i++) {
        const fills = this.ifcApi.GetLine(this.modelId, fillsIds.get(i));

        if (fills.RelatedBuildingElement?.value === openingElementId) {
          const openingId = fills.RelatingOpeningElement?.value;

          if (openingId) {
            // Find IfcRelVoidsElement where this opening voids a wall
            const voidsIds = this.ifcApi.GetLineIDsWithType(this.modelId, WebIFC.IFCRELVOIDSELEMENT);

            for (let j = 0; j < voidsIds.size(); j++) {
              const voids = this.ifcApi.GetLine(this.modelId, voidsIds.get(j));

              if (voids.RelatedOpeningElement?.value === openingId) {
                const wallExpressId = voids.RelatingBuildingElement?.value;
                const wallUuid = this.idMapping.walls.get(wallExpressId);

                if (wallUuid) {
                  const wall = walls.find((w) => w.id === wallUuid);
                  if (wall) {
                    return { wall, openingId };
                  }
                }
              }
            }
          }
        }
      }
    } catch {
      // Return null on error
    }

    return null;
  }

  private calculatePositionOnWall(position: Vector3, wallData: WallData): number {
    const { startPoint, endPoint } = wallData;

    const wallDx = endPoint.x - startPoint.x;
    const wallDy = endPoint.y - startPoint.y;
    const wallLength = Math.sqrt(wallDx * wallDx + wallDy * wallDy);

    if (wallLength === 0) {
      return 0.5;
    }

    // Project position onto wall line
    const dx = position.x - startPoint.x;
    const dy = position.y - startPoint.y;

    const dot = dx * wallDx + dy * wallDy;
    const t = dot / (wallLength * wallLength);

    // Clamp to [0, 1] but also handle edge cases
    // If position is way outside wall bounds, center it
    if (t < -1 || t > 2) {
      this.warnings.push(`Opening position (${t.toFixed(2)}) far outside wall, centering at 0.5`);
      return 0.5;
    }

    return Math.max(0.1, Math.min(0.9, t)); // Keep some margin from edges
  }

  /**
   * Calculate position on wall using mesh bounding box
   */
  private calculatePositionOnWallFromMesh(expressId: number, wallData: WallData): number {
    try {
      const mesh = this.ifcApi.GetFlatMesh(this.modelId, expressId);
      if (mesh.geometries.size() === 0) {
        return 0.5;
      }

      // Get bounding box of the door/window mesh
      const bbox = this.calculateBoundingBox(mesh);
      const centerX = (bbox.minX + bbox.maxX) / 2;
      const centerY = (bbox.minY + bbox.maxY) / 2;

      // Project onto wall
      const { startPoint, endPoint } = wallData;
      const wallDx = endPoint.x - startPoint.x;
      const wallDy = endPoint.y - startPoint.y;
      const wallLength = Math.sqrt(wallDx * wallDx + wallDy * wallDy);

      if (wallLength === 0) {
        return 0.5;
      }

      const dx = centerX - startPoint.x;
      const dy = centerY - startPoint.y;
      const dot = dx * wallDx + dy * wallDy;
      const t = dot / (wallLength * wallLength);

      return Math.max(0.1, Math.min(0.9, t));
    } catch {
      return 0.5;
    }
  }

  private getPropertySets(expressId: number): PropertySet[] {
    const psets: PropertySet[] = [];

    try {
      const relIds = this.ifcApi.GetLineIDsWithType(
        this.modelId,
        WebIFC.IFCRELDEFINESBYPROPERTIES
      );

      for (let i = 0; i < relIds.size(); i++) {
        const rel = this.ifcApi.GetLine(this.modelId, relIds.get(i));

        const relatedObjects = rel.RelatedObjects || [];
        const isRelated = relatedObjects.some(
          (ref: { value: number }) => ref.value === expressId
        );

        if (isRelated && rel.RelatingPropertyDefinition?.value) {
          const psetDef = this.ifcApi.GetLine(this.modelId, rel.RelatingPropertyDefinition.value);

          if (psetDef.type === WebIFC.IFCPROPERTYSET) {
            const properties: Record<string, string | number | boolean | null> = {};

            for (const propRef of psetDef.HasProperties || []) {
              const prop = this.ifcApi.GetLine(this.modelId, propRef.value);

              if (prop.NominalValue) {
                const value = prop.NominalValue.value;
                const name = this.getStringValue(prop.Name);

                if (name) {
                  properties[name] = value;
                }
              }
            }

            const psetName = this.getStringValue(psetDef.Name) || 'PropertySet';
            psets.push({ name: psetName, properties });
          }
        }
      }
    } catch {
      // Return empty array on error
    }

    return psets;
  }

  private extractMeshData(expressId: number): MeshData | null {
    try {
      const mesh = this.ifcApi.GetFlatMesh(this.modelId, expressId);

      if (mesh.geometries.size() === 0) {
        return null;
      }

      const allVertices: number[] = [];
      const allIndices: number[] = [];
      let indexOffset = 0;

      for (let i = 0; i < mesh.geometries.size(); i++) {
        const pg = mesh.geometries.get(i);
        const geom = this.ifcApi.GetGeometry(this.modelId, pg.geometryExpressID);

        const vertices = this.ifcApi.GetVertexArray(
          geom.GetVertexData(),
          geom.GetVertexDataSize()
        ) as Float32Array;

        const indices = this.ifcApi.GetIndexArray(
          geom.GetIndexData(),
          geom.GetIndexDataSize()
        ) as Uint32Array;

        const transform = pg.flatTransformation;

        // Transform vertices and add to result
        // vertices are [x,y,z,nx,ny,nz, x,y,z,nx,ny,nz, ...]
        for (let v = 0; v < vertices.length; v += 6) {
          const x = vertices[v] ?? 0;
          const y = vertices[v + 1] ?? 0;
          const z = vertices[v + 2] ?? 0;

          // Apply transformation (with null-safety)
          const tx = (transform[0] ?? 1) * x + (transform[4] ?? 0) * y + (transform[8] ?? 0) * z + (transform[12] ?? 0);
          const ty = (transform[1] ?? 0) * x + (transform[5] ?? 1) * y + (transform[9] ?? 0) * z + (transform[13] ?? 0);
          const tz = (transform[2] ?? 0) * x + (transform[6] ?? 0) * y + (transform[10] ?? 1) * z + (transform[14] ?? 0);

          // Apply coordinate system transformation
          const transformed = this.transformCoords(tx, ty, tz);

          allVertices.push(transformed.x, transformed.y, transformed.z);
        }

        // Add indices with offset
        for (let idx = 0; idx < indices.length; idx++) {
          allIndices.push((indices[idx] ?? 0) + indexOffset);
        }

        indexOffset += vertices.length / 6;
        geom.delete();
      }

      return {
        vertices: allVertices,
        indices: allIndices,
      };
    } catch {
      return null;
    }
  }

  private calculateBoundingBox(mesh: WebIFC.FlatMesh): {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
  } {
    let minX = Infinity,
      maxX = -Infinity;
    let minY = Infinity,
      maxY = -Infinity;
    let minZ = Infinity,
      maxZ = -Infinity;

    for (let i = 0; i < mesh.geometries.size(); i++) {
      const pg = mesh.geometries.get(i);
      const geom = this.ifcApi.GetGeometry(this.modelId, pg.geometryExpressID);

      const vertices = this.ifcApi.GetVertexArray(
        geom.GetVertexData(),
        geom.GetVertexDataSize()
      ) as Float32Array;

      const t = pg.flatTransformation;

      for (let v = 0; v < vertices.length; v += 6) {
        const x = vertices[v] ?? 0;
        const y = vertices[v + 1] ?? 0;
        const z = vertices[v + 2] ?? 0;

        // Apply transformation (with null-safety)
        let tx = (t[0] ?? 1) * x + (t[4] ?? 0) * y + (t[8] ?? 0) * z + (t[12] ?? 0);
        let ty = (t[1] ?? 0) * x + (t[5] ?? 1) * y + (t[9] ?? 0) * z + (t[13] ?? 0);
        let tz = (t[2] ?? 0) * x + (t[6] ?? 0) * y + (t[10] ?? 1) * z + (t[14] ?? 0);

        // Apply coordinate system transformation
        const transformed = this.transformCoords(tx, ty, tz);
        tx = transformed.x;
        ty = transformed.y;
        tz = transformed.z;

        minX = Math.min(minX, tx);
        maxX = Math.max(maxX, tx);
        minY = Math.min(minY, ty);
        maxY = Math.max(maxY, ty);
        minZ = Math.min(minZ, tz);
        maxZ = Math.max(maxZ, tz);
      }

      geom.delete();
    }

    return { minX, maxX, minY, maxY, minZ, maxZ };
  }

  private calculateBoundingBoxFromMeshData(meshData: MeshData): {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
  } {
    let minX = Infinity,
      maxX = -Infinity;
    let minY = Infinity,
      maxY = -Infinity;
    let minZ = Infinity,
      maxZ = -Infinity;

    for (let i = 0; i < meshData.vertices.length; i += 3) {
      const x = meshData.vertices[i] ?? 0;
      const y = meshData.vertices[i + 1] ?? 0;
      const z = meshData.vertices[i + 2] ?? 0;

      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    }

    return { minX, maxX, minY, maxY, minZ, maxZ };
  }

  private rotationToQuaternion(rotation: number): Quaternion {
    // Rotation around Z axis
    const halfAngle = rotation / 2;
    return {
      x: 0,
      y: 0,
      z: Math.sin(halfAngle),
      w: Math.cos(halfAngle),
    };
  }

  private getStringValue(value: unknown): string | undefined {
    if (!value) return undefined;
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value !== null && 'value' in value) return String((value as { value: unknown }).value);
    return undefined;
  }

  private getNumberValue(value: unknown): number | undefined {
    if (value === null || value === undefined) return undefined;
    if (typeof value === 'number') return value;
    if (typeof value === 'object' && value !== null && 'value' in value) {
      const num = Number((value as { value: unknown }).value);
      return isNaN(num) ? undefined : num;
    }
    return undefined;
  }

  private parseLatLong(value: unknown): number | undefined {
    if (!value || !Array.isArray(value)) return undefined;

    // IFC lat/long is stored as [degrees, minutes, seconds, fraction]
    const degrees = this.getNumberValue(value[0]) || 0;
    const minutes = (this.getNumberValue(value[1]) || 0) / 60;
    const seconds = (this.getNumberValue(value[2]) || 0) / 3600;

    return degrees + minutes + seconds;
  }
}
