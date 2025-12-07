import * as WebIFC from 'web-ifc';
import type { BimElement, ProjectInfo, SiteInfo, BuildingInfo, StoreyInfo } from '@/types/bim';
import { offsetPath, createCounterPolygon } from '@/lib/geometry/pathOffset';

/**
 * IFC Exporter using web-ifc
 * Creates IFC 2x3 files from BIM elements
 */
export class IfcExporter {
  private ifcApi: WebIFC.IfcAPI;
  private modelId: number = 0;
  private expressIdCounter: number = 1;

  // Store IFC entity IDs for relationships
  private projectId: number = 0;
  private siteId: number = 0;
  private buildingId: number = 0;
  private storeyIds: Map<string, number> = new Map();
  private wallIds: Map<string, number> = new Map();
  private doorIds: Map<string, number> = new Map();
  private windowIds: Map<string, number> = new Map();
  private openingIds: Map<string, number> = new Map();
  private columnIds: Map<string, number> = new Map();
  private counterIds: Map<string, number> = new Map();
  private furnitureIds: Map<string, number> = new Map();

  constructor() {
    this.ifcApi = new WebIFC.IfcAPI();
  }

  /**
   * Initialize the IFC API
   */
  async init(): Promise<void> {
    // Set path to WASM file in public folder
    this.ifcApi.SetWasmPath('/');
    await this.ifcApi.Init();
  }

  /**
   * Export project to IFC file
   */
  async export(
    project: ProjectInfo,
    site: SiteInfo,
    building: BuildingInfo,
    storeys: StoreyInfo[],
    elements: BimElement[]
  ): Promise<Uint8Array> {
    // Create new model
    this.modelId = this.ifcApi.CreateModel({ schema: WebIFC.Schemas.IFC2X3 });
    this.expressIdCounter = 1;

    // Reset ID maps
    this.storeyIds.clear();
    this.wallIds.clear();
    this.doorIds.clear();
    this.windowIds.clear();
    this.openingIds.clear();
    this.columnIds.clear();
    this.counterIds.clear();
    this.furnitureIds.clear();

    // Create IFC hierarchy
    this.createOwnerHistory();
    this.createUnits();
    this.createGeometricContext();
    this.createProject(project);
    this.createSite(site);
    this.createBuilding(building);

    // Create storeys
    for (const storey of storeys) {
      this.createStorey(storey);
    }

    // Create spatial structure
    this.createSpatialStructure(storeys);

    // Export walls first (doors need wall references)
    const walls = elements.filter((e) => e.type === 'wall');
    for (const wall of walls) {
      this.createWall(wall, storeys);
    }

    // Export doors with openings
    const doors = elements.filter((e) => e.type === 'door');
    for (const door of doors) {
      this.createDoor(door, elements, storeys);
    }

    // Export windows with openings
    const windows = elements.filter((e) => e.type === 'window');
    for (const window of windows) {
      this.createWindow(window, elements, storeys);
    }

    // Export slabs
    const slabs = elements.filter((e) => e.type === 'slab');
    for (const slab of slabs) {
      this.createSlab(slab, storeys);
    }

    // Export columns
    const columns = elements.filter((e) => e.type === 'column');
    for (const column of columns) {
      this.createColumn(column, storeys);
    }

    // Export counters
    const counters = elements.filter((e) => e.type === 'counter');
    for (const counter of counters) {
      this.createCounter(counter, storeys);
    }

    // Export furniture
    const furniture = elements.filter((e) => e.type === 'furniture');
    for (const item of furniture) {
      this.createFurniture(item, storeys);
    }

    // Get IFC data
    const ifcData = this.ifcApi.SaveModel(this.modelId);

    // Close model
    this.ifcApi.CloseModel(this.modelId);

    return ifcData;
  }

  private getNextId(): number {
    return this.expressIdCounter++;
  }

  private createOwnerHistory(): number {
    const personId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: personId,
      type: WebIFC.IFCPERSON,
      Identification: null,
      FamilyName: { type: 1, value: 'User' },
      GivenName: { type: 1, value: 'CoffeeBIM' },
      MiddleNames: null,
      PrefixTitles: null,
      SuffixTitles: null,
      Roles: null,
      Addresses: null,
    });

    const orgId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: orgId,
      type: WebIFC.IFCORGANIZATION,
      Identification: null,
      Name: { type: 1, value: 'CoffeeBIM Editor' },
      Description: null,
      Roles: null,
      Addresses: null,
    });

    const personOrgId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: personOrgId,
      type: WebIFC.IFCPERSONANDORGANIZATION,
      ThePerson: { type: 5, value: personId },
      TheOrganization: { type: 5, value: orgId },
      Roles: null,
    });

    const appId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: appId,
      type: WebIFC.IFCAPPLICATION,
      ApplicationDeveloper: { type: 5, value: orgId },
      Version: { type: 1, value: '0.1.0' },
      ApplicationFullName: { type: 1, value: 'CoffeeBIM Editor' },
      ApplicationIdentifier: { type: 1, value: 'CoffeeBIM' },
    });

    const ownerHistoryId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: ownerHistoryId,
      type: WebIFC.IFCOWNERHISTORY,
      OwningUser: { type: 5, value: personOrgId },
      OwningApplication: { type: 5, value: appId },
      State: null,
      ChangeAction: { type: 3, value: 'NOCHANGE' },
      LastModifiedDate: null,
      LastModifyingUser: null,
      LastModifyingApplication: null,
      CreationDate: { type: 4, value: Math.floor(Date.now() / 1000) },
    });

    return ownerHistoryId;
  }

  private createUnits(): number {
    // Length unit - meters
    const lengthUnitId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: lengthUnitId,
      type: WebIFC.IFCSIUNIT,
      Dimensions: null,
      UnitType: { type: 3, value: 'LENGTHUNIT' },
      Prefix: null,
      Name: { type: 3, value: 'METRE' },
    });

    // Area unit - square meters
    const areaUnitId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: areaUnitId,
      type: WebIFC.IFCSIUNIT,
      Dimensions: null,
      UnitType: { type: 3, value: 'AREAUNIT' },
      Prefix: null,
      Name: { type: 3, value: 'SQUARE_METRE' },
    });

    // Volume unit - cubic meters
    const volumeUnitId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: volumeUnitId,
      type: WebIFC.IFCSIUNIT,
      Dimensions: null,
      UnitType: { type: 3, value: 'VOLUMEUNIT' },
      Prefix: null,
      Name: { type: 3, value: 'CUBIC_METRE' },
    });

    // Plane angle unit - radians
    const angleUnitId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: angleUnitId,
      type: WebIFC.IFCSIUNIT,
      Dimensions: null,
      UnitType: { type: 3, value: 'PLANEANGLEUNIT' },
      Prefix: null,
      Name: { type: 3, value: 'RADIAN' },
    });

    const unitAssignmentId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: unitAssignmentId,
      type: WebIFC.IFCUNITASSIGNMENT,
      Units: [
        { type: 5, value: lengthUnitId },
        { type: 5, value: areaUnitId },
        { type: 5, value: volumeUnitId },
        { type: 5, value: angleUnitId },
      ],
    });

    return unitAssignmentId;
  }

  private geometricContextId: number = 0;

  private createGeometricContext(): number {
    // World coordinate system
    const originId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: originId,
      type: WebIFC.IFCCARTESIANPOINT,
      Coordinates: [{ type: 4, value: 0 }, { type: 4, value: 0 }, { type: 4, value: 0 }],
    });

    const axisId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: axisId,
      type: WebIFC.IFCDIRECTION,
      DirectionRatios: [{ type: 4, value: 0 }, { type: 4, value: 0 }, { type: 4, value: 1 }],
    });

    const refDirId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: refDirId,
      type: WebIFC.IFCDIRECTION,
      DirectionRatios: [{ type: 4, value: 1 }, { type: 4, value: 0 }, { type: 4, value: 0 }],
    });

    const worldCoordSystemId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: worldCoordSystemId,
      type: WebIFC.IFCAXIS2PLACEMENT3D,
      Location: { type: 5, value: originId },
      Axis: { type: 5, value: axisId },
      RefDirection: { type: 5, value: refDirId },
    });

    this.geometricContextId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: this.geometricContextId,
      type: WebIFC.IFCGEOMETRICREPRESENTATIONCONTEXT,
      ContextIdentifier: { type: 1, value: 'Model' },
      ContextType: { type: 1, value: '3D' },
      CoordinateSpaceDimension: { type: 4, value: 3 },
      Precision: { type: 4, value: 0.00001 },
      WorldCoordinateSystem: { type: 5, value: worldCoordSystemId },
      TrueNorth: null,
    });

    return this.geometricContextId;
  }

  private createProject(project: ProjectInfo): void {
    this.projectId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: this.projectId,
      type: WebIFC.IFCPROJECT,
      GlobalId: { type: 1, value: this.generateGuid() },
      OwnerHistory: null,
      Name: { type: 1, value: project.name },
      Description: project.description ? { type: 1, value: project.description } : null,
      ObjectType: null,
      LongName: null,
      Phase: null,
      RepresentationContexts: [{ type: 5, value: this.geometricContextId }],
      UnitsInContext: null,
    });
  }

  private createSite(site: SiteInfo): void {
    const placementId = this.createLocalPlacement(null, 0, 0, 0);

    this.siteId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: this.siteId,
      type: WebIFC.IFCSITE,
      GlobalId: { type: 1, value: this.generateGuid() },
      OwnerHistory: null,
      Name: { type: 1, value: site.name },
      Description: null,
      ObjectType: null,
      ObjectPlacement: { type: 5, value: placementId },
      Representation: null,
      LongName: null,
      CompositionType: { type: 3, value: 'ELEMENT' },
      RefLatitude: null,
      RefLongitude: null,
      RefElevation: null,
      LandTitleNumber: null,
      SiteAddress: null,
    });
  }

  private createBuilding(building: BuildingInfo): void {
    const placementId = this.createLocalPlacement(null, 0, 0, 0);

    this.buildingId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: this.buildingId,
      type: WebIFC.IFCBUILDING,
      GlobalId: { type: 1, value: this.generateGuid() },
      OwnerHistory: null,
      Name: { type: 1, value: building.name },
      Description: null,
      ObjectType: null,
      ObjectPlacement: { type: 5, value: placementId },
      Representation: null,
      LongName: null,
      CompositionType: { type: 3, value: 'ELEMENT' },
      ElevationOfRefHeight: null,
      ElevationOfTerrain: null,
      BuildingAddress: null,
    });
  }

  private createStorey(storey: StoreyInfo): void {
    const placementId = this.createLocalPlacement(null, 0, 0, storey.elevation);

    const storeyIfcId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: storeyIfcId,
      type: WebIFC.IFCBUILDINGSTOREY,
      GlobalId: { type: 1, value: this.generateGuid() },
      OwnerHistory: null,
      Name: { type: 1, value: storey.name },
      Description: null,
      ObjectType: null,
      ObjectPlacement: { type: 5, value: placementId },
      Representation: null,
      LongName: null,
      CompositionType: { type: 3, value: 'ELEMENT' },
      Elevation: { type: 4, value: storey.elevation },
    });

    this.storeyIds.set(storey.id, storeyIfcId);
  }

  private createSpatialStructure(storeys: StoreyInfo[]): void {
    // Project -> Site
    const relProjectSiteId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: relProjectSiteId,
      type: WebIFC.IFCRELAGGREGATES,
      GlobalId: { type: 1, value: this.generateGuid() },
      OwnerHistory: null,
      Name: null,
      Description: null,
      RelatingObject: { type: 5, value: this.projectId },
      RelatedObjects: [{ type: 5, value: this.siteId }],
    });

    // Site -> Building
    const relSiteBuildingId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: relSiteBuildingId,
      type: WebIFC.IFCRELAGGREGATES,
      GlobalId: { type: 1, value: this.generateGuid() },
      OwnerHistory: null,
      Name: null,
      Description: null,
      RelatingObject: { type: 5, value: this.siteId },
      RelatedObjects: [{ type: 5, value: this.buildingId }],
    });

    // Building -> Storeys
    if (storeys.length > 0) {
      const storeyRefs = storeys.map((s) => ({
        type: 5,
        value: this.storeyIds.get(s.id)!,
      }));

      const relBuildingStoreysId = this.getNextId();
      this.ifcApi.WriteLine(this.modelId, {
        expressID: relBuildingStoreysId,
        type: WebIFC.IFCRELAGGREGATES,
        GlobalId: { type: 1, value: this.generateGuid() },
        OwnerHistory: null,
        Name: null,
        Description: null,
        RelatingObject: { type: 5, value: this.buildingId },
        RelatedObjects: storeyRefs,
      });
    }
  }

  private createWall(wall: BimElement, storeys: StoreyInfo[]): void {
    if (!wall.wallData) return;

    const { startPoint, endPoint, thickness, height } = wall.wallData;

    // Find storey
    const storey = storeys.find((s) => s.id === wall.parentId);
    const storeyIfcId = storey ? this.storeyIds.get(storey.id) : null;

    // Calculate wall direction and length
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const wallLength = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    // Create placement at wall start
    const placementId = this.createLocalPlacement(null, startPoint.x, startPoint.y, storey?.elevation ?? 0, angle);

    // Create wall profile (rectangle in local XY plane)
    // Offset by wallLength/2 so profile starts at origin instead of being centered
    const profileId = this.createRectangleProfile(wallLength, thickness, wallLength / 2, 0);

    // Create extruded solid
    const solidId = this.createExtrudedSolid(profileId, height);

    // Create shape representation
    const shapeRepId = this.createShapeRepresentation(solidId, 'Body', 'SweptSolid');

    // Create product representation
    const productRepId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: productRepId,
      type: WebIFC.IFCPRODUCTDEFINITIONSHAPE,
      Name: null,
      Description: null,
      Representations: [{ type: 5, value: shapeRepId }],
    });

    // Create wall
    const wallIfcId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: wallIfcId,
      type: WebIFC.IFCWALLSTANDARDCASE,
      GlobalId: { type: 1, value: this.generateGuid() },
      OwnerHistory: null,
      Name: { type: 1, value: wall.name },
      Description: null,
      ObjectType: null,
      ObjectPlacement: { type: 5, value: placementId },
      Representation: { type: 5, value: productRepId },
      Tag: null,
    });

    this.wallIds.set(wall.id, wallIfcId);

    // Create property sets
    this.createPropertySets(wall, wallIfcId);

    // Assign to storey
    if (storeyIfcId) {
      this.createContainedInSpatialStructure(wallIfcId, storeyIfcId);
    }
  }

  private createDoor(door: BimElement, allElements: BimElement[], storeys: StoreyInfo[]): void {
    if (!door.doorData) return;

    const { width, height, hostWallId, positionOnWall, sillHeight } = door.doorData;

    // Find host wall
    const hostWall = allElements.find((e) => e.id === hostWallId);
    if (!hostWall?.wallData) return;

    const wallIfcId = this.wallIds.get(hostWallId);
    if (!wallIfcId) return;

    // Find storey
    const storey = storeys.find((s) => s.id === door.parentId);
    const storeyIfcId = storey ? this.storeyIds.get(storey.id) : null;

    // Calculate door position in wall local coordinates
    const { startPoint, endPoint, thickness } = hostWall.wallData;
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const wallLength = Math.sqrt(dx * dx + dy * dy);
    const wallAngle = Math.atan2(dy, dx);

    // Door center position along wall
    const doorCenterDistance = positionOnWall * wallLength;

    // Door world position
    const doorX = startPoint.x + (dx / wallLength) * doorCenterDistance;
    const doorY = startPoint.y + (dy / wallLength) * doorCenterDistance;

    // Create opening in wall (include sillHeight for vertical offset)
    const baseElevation = storey?.elevation ?? 0;
    const openingPlacementId = this.createLocalPlacement(
      null,
      doorX,
      doorY,
      baseElevation + sillHeight,
      wallAngle
    );

    // Opening profile (rectangular hole)
    const openingProfileId = this.createRectangleProfile(width, thickness * 1.1); // Slightly larger than wall
    const openingSolidId = this.createExtrudedSolid(openingProfileId, height);
    const openingShapeRepId = this.createShapeRepresentation(openingSolidId, 'Body', 'SweptSolid');

    const openingProductRepId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: openingProductRepId,
      type: WebIFC.IFCPRODUCTDEFINITIONSHAPE,
      Name: null,
      Description: null,
      Representations: [{ type: 5, value: openingShapeRepId }],
    });

    // Create opening element
    const openingId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: openingId,
      type: WebIFC.IFCOPENINGELEMENT,
      GlobalId: { type: 1, value: this.generateGuid() },
      OwnerHistory: null,
      Name: { type: 1, value: `Opening for ${door.name}` },
      Description: null,
      ObjectType: null,
      ObjectPlacement: { type: 5, value: openingPlacementId },
      Representation: { type: 5, value: openingProductRepId },
      Tag: null,
      PredefinedType: { type: 3, value: 'OPENING' },
    });

    this.openingIds.set(door.id, openingId);

    // Create IfcRelVoidsElement (wall has opening)
    const relVoidsId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: relVoidsId,
      type: WebIFC.IFCRELVOIDSELEMENT,
      GlobalId: { type: 1, value: this.generateGuid() },
      OwnerHistory: null,
      Name: null,
      Description: null,
      RelatingBuildingElement: { type: 5, value: wallIfcId },
      RelatedOpeningElement: { type: 5, value: openingId },
    });

    // Create door element
    const doorPlacementId = this.createLocalPlacement(
      null,
      doorX,
      doorY,
      baseElevation + sillHeight,
      wallAngle
    );

    // Simple door geometry (thin box)
    const doorProfileId = this.createRectangleProfile(width, 0.05);
    const doorSolidId = this.createExtrudedSolid(doorProfileId, height);
    const doorShapeRepId = this.createShapeRepresentation(doorSolidId, 'Body', 'SweptSolid');

    const doorProductRepId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: doorProductRepId,
      type: WebIFC.IFCPRODUCTDEFINITIONSHAPE,
      Name: null,
      Description: null,
      Representations: [{ type: 5, value: doorShapeRepId }],
    });

    const doorIfcId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: doorIfcId,
      type: WebIFC.IFCDOOR,
      GlobalId: { type: 1, value: this.generateGuid() },
      OwnerHistory: null,
      Name: { type: 1, value: door.name },
      Description: null,
      ObjectType: null,
      ObjectPlacement: { type: 5, value: doorPlacementId },
      Representation: { type: 5, value: doorProductRepId },
      Tag: null,
      OverallHeight: { type: 4, value: height },
      OverallWidth: { type: 4, value: width },
    });

    this.doorIds.set(door.id, doorIfcId);

    // Create property sets
    this.createPropertySets(door, doorIfcId);

    // Create IfcRelFillsElement (door fills opening)
    const relFillsId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: relFillsId,
      type: WebIFC.IFCRELFILLSELEMENT,
      GlobalId: { type: 1, value: this.generateGuid() },
      OwnerHistory: null,
      Name: null,
      Description: null,
      RelatingOpeningElement: { type: 5, value: openingId },
      RelatedBuildingElement: { type: 5, value: doorIfcId },
    });

    // Assign to storey
    if (storeyIfcId) {
      this.createContainedInSpatialStructure(doorIfcId, storeyIfcId);
    }
  }

  private createWindow(window: BimElement, allElements: BimElement[], storeys: StoreyInfo[]): void {
    if (!window.windowData) return;

    const { width, height, hostWallId, positionOnWall, sillHeight } = window.windowData;

    // Find host wall
    const hostWall = allElements.find((e) => e.id === hostWallId);
    if (!hostWall?.wallData) return;

    const wallIfcId = this.wallIds.get(hostWallId);
    if (!wallIfcId) return;

    // Find storey
    const storey = storeys.find((s) => s.id === window.parentId);
    const storeyIfcId = storey ? this.storeyIds.get(storey.id) : null;

    // Calculate window position in wall local coordinates
    const { startPoint, endPoint, thickness } = hostWall.wallData;
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const wallLength = Math.sqrt(dx * dx + dy * dy);
    const wallAngle = Math.atan2(dy, dx);

    // Window center position along wall
    const windowCenterDistance = positionOnWall * wallLength;

    // Window world position
    const windowX = startPoint.x + (dx / wallLength) * windowCenterDistance;
    const windowY = startPoint.y + (dy / wallLength) * windowCenterDistance;

    // Create opening in wall (include sillHeight for vertical offset)
    const baseElevation = storey?.elevation ?? 0;
    const openingPlacementId = this.createLocalPlacement(
      null,
      windowX,
      windowY,
      baseElevation + sillHeight,
      wallAngle
    );

    // Opening profile (rectangular hole)
    const openingProfileId = this.createRectangleProfile(width, thickness * 1.1); // Slightly larger than wall
    const openingSolidId = this.createExtrudedSolid(openingProfileId, height);
    const openingShapeRepId = this.createShapeRepresentation(openingSolidId, 'Body', 'SweptSolid');

    const openingProductRepId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: openingProductRepId,
      type: WebIFC.IFCPRODUCTDEFINITIONSHAPE,
      Name: null,
      Description: null,
      Representations: [{ type: 5, value: openingShapeRepId }],
    });

    // Create opening element
    const openingId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: openingId,
      type: WebIFC.IFCOPENINGELEMENT,
      GlobalId: { type: 1, value: this.generateGuid() },
      OwnerHistory: null,
      Name: { type: 1, value: `Opening for ${window.name}` },
      Description: null,
      ObjectType: null,
      ObjectPlacement: { type: 5, value: openingPlacementId },
      Representation: { type: 5, value: openingProductRepId },
      Tag: null,
      PredefinedType: { type: 3, value: 'OPENING' },
    });

    this.openingIds.set(window.id, openingId);

    // Create IfcRelVoidsElement (wall has opening)
    const relVoidsId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: relVoidsId,
      type: WebIFC.IFCRELVOIDSELEMENT,
      GlobalId: { type: 1, value: this.generateGuid() },
      OwnerHistory: null,
      Name: null,
      Description: null,
      RelatingBuildingElement: { type: 5, value: wallIfcId },
      RelatedOpeningElement: { type: 5, value: openingId },
    });

    // Create window element
    const windowPlacementId = this.createLocalPlacement(
      null,
      windowX,
      windowY,
      baseElevation + sillHeight,
      wallAngle
    );

    // Simple window geometry (thin box)
    const windowProfileId = this.createRectangleProfile(width, 0.05);
    const windowSolidId = this.createExtrudedSolid(windowProfileId, height);
    const windowShapeRepId = this.createShapeRepresentation(windowSolidId, 'Body', 'SweptSolid');

    const windowProductRepId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: windowProductRepId,
      type: WebIFC.IFCPRODUCTDEFINITIONSHAPE,
      Name: null,
      Description: null,
      Representations: [{ type: 5, value: windowShapeRepId }],
    });

    const windowIfcId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: windowIfcId,
      type: WebIFC.IFCWINDOW,
      GlobalId: { type: 1, value: this.generateGuid() },
      OwnerHistory: null,
      Name: { type: 1, value: window.name },
      Description: null,
      ObjectType: null,
      ObjectPlacement: { type: 5, value: windowPlacementId },
      Representation: { type: 5, value: windowProductRepId },
      Tag: null,
      OverallHeight: { type: 4, value: height },
      OverallWidth: { type: 4, value: width },
    });

    this.windowIds.set(window.id, windowIfcId);

    // Create property sets
    this.createPropertySets(window, windowIfcId);

    // Create IfcRelFillsElement (window fills opening)
    const relFillsId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: relFillsId,
      type: WebIFC.IFCRELFILLSELEMENT,
      GlobalId: { type: 1, value: this.generateGuid() },
      OwnerHistory: null,
      Name: null,
      Description: null,
      RelatingOpeningElement: { type: 5, value: openingId },
      RelatedBuildingElement: { type: 5, value: windowIfcId },
    });

    // Assign to storey
    if (storeyIfcId) {
      this.createContainedInSpatialStructure(windowIfcId, storeyIfcId);
    }
  }

  private createSlab(slab: BimElement, storeys: StoreyInfo[]): void {
    if (!slab.slabData) return;

    const { thickness, outline } = slab.slabData;

    // Find storey
    const storey = storeys.find((s) => s.id === slab.parentId);
    const storeyIfcId = storey ? this.storeyIds.get(storey.id) : null;

    // Create placement
    const placementId = this.createLocalPlacement(null, 0, 0, storey?.elevation ?? 0);

    // Create arbitrary closed profile from outline
    const profileId = this.createArbitraryProfile(outline);

    // Create extruded solid
    const solidId = this.createExtrudedSolid(profileId, thickness);

    // Create shape representation
    const shapeRepId = this.createShapeRepresentation(solidId, 'Body', 'SweptSolid');

    // Create product representation
    const productRepId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: productRepId,
      type: WebIFC.IFCPRODUCTDEFINITIONSHAPE,
      Name: null,
      Description: null,
      Representations: [{ type: 5, value: shapeRepId }],
    });

    // Create slab
    const slabIfcId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: slabIfcId,
      type: WebIFC.IFCSLAB,
      GlobalId: { type: 1, value: this.generateGuid() },
      OwnerHistory: null,
      Name: { type: 1, value: slab.name },
      Description: null,
      ObjectType: null,
      ObjectPlacement: { type: 5, value: placementId },
      Representation: { type: 5, value: productRepId },
      Tag: null,
      PredefinedType: { type: 3, value: 'FLOOR' },
    });

    // Create property sets
    this.createPropertySets(slab, slabIfcId);

    // Assign to storey
    if (storeyIfcId) {
      this.createContainedInSpatialStructure(slabIfcId, storeyIfcId);
    }
  }

  private createColumn(column: BimElement, storeys: StoreyInfo[]): void {
    if (!column.columnData) return;

    const { profileType, width, depth, height } = column.columnData;

    // Find storey
    const storey = storeys.find((s) => s.id === column.parentId);
    const storeyIfcId = storey ? this.storeyIds.get(storey.id) : null;

    // Position from placement (Z-up: x, y are horizontal, z is vertical)
    const posX = column.placement.position.x;
    const posY = column.placement.position.y; // Z-up: direct mapping
    const posZ = storey?.elevation ?? 0;

    // Create placement at column position
    const placementId = this.createLocalPlacement(null, posX, posY, posZ);

    // Create profile based on type
    let profileId: number;
    if (profileType === 'circular') {
      profileId = this.createCircleProfile(width / 2); // radius = width/2
    } else {
      profileId = this.createRectangleProfile(width, depth);
    }

    // Create extruded solid
    const solidId = this.createExtrudedSolid(profileId, height);

    // Create shape representation
    const shapeRepId = this.createShapeRepresentation(solidId, 'Body', 'SweptSolid');

    // Create product representation
    const productRepId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: productRepId,
      type: WebIFC.IFCPRODUCTDEFINITIONSHAPE,
      Name: null,
      Description: null,
      Representations: [{ type: 5, value: shapeRepId }],
    });

    // Create column
    const columnIfcId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: columnIfcId,
      type: WebIFC.IFCCOLUMN,
      GlobalId: { type: 1, value: this.generateGuid() },
      OwnerHistory: null,
      Name: { type: 1, value: column.name },
      Description: null,
      ObjectType: null,
      ObjectPlacement: { type: 5, value: placementId },
      Representation: { type: 5, value: productRepId },
      Tag: null,
    });

    this.columnIds.set(column.id, columnIfcId);

    // Create property sets
    this.createPropertySets(column, columnIfcId);

    // Assign to storey
    if (storeyIfcId) {
      this.createContainedInSpatialStructure(columnIfcId, storeyIfcId);
    }
  }

  private createCounter(counter: BimElement, storeys: StoreyInfo[]): void {
    if (!counter.counterData) return;

    const {
      path,
      depth,
      height,
      topThickness,
      overhang,
      kickHeight,
      kickRecess,
      hasFootrest,
      footrestHeight,
    } = counter.counterData;

    if (path.length < 2) return;

    // Find storey
    const storey = storeys.find((s) => s.id === counter.parentId);
    const storeyIfcId = storey ? this.storeyIds.get(storey.id) : null;
    const storeyElevation = storey?.elevation ?? 0;

    // Calculate the various paths needed for counter sections
    const frontPath = path;
    const backPath = offsetPath(path, depth);
    const frontWithOverhang = offsetPath(path, -overhang);
    const backWithKick = offsetPath(path, depth - kickRecess);

    // Collect all solid IDs for the shape representation
    const solidIds: number[] = [];

    // 1. Kick/base section (from floor to kick height)
    if (kickHeight > 0 && kickRecess > 0) {
      const kickOutline = createCounterPolygon(frontPath, backWithKick);
      if (kickOutline.length >= 3) {
        const kickProfileId = this.createArbitraryProfile(kickOutline);
        const kickSolidId = this.createExtrudedSolidAtHeight(kickProfileId, kickHeight, storeyElevation);
        solidIds.push(kickSolidId);
      }
    }

    // 2. Main body section (from kick height to below countertop)
    const mainBodyHeight = height - topThickness - kickHeight;
    if (mainBodyHeight > 0) {
      const mainOutline = createCounterPolygon(frontPath, backPath);
      if (mainOutline.length >= 3) {
        const mainProfileId = this.createArbitraryProfile(mainOutline);
        const mainSolidId = this.createExtrudedSolidAtHeight(
          mainProfileId,
          mainBodyHeight,
          storeyElevation + kickHeight
        );
        solidIds.push(mainSolidId);
      }
    }

    // 3. Countertop (with overhang)
    if (topThickness > 0) {
      const topOutline = createCounterPolygon(frontWithOverhang, backPath);
      if (topOutline.length >= 3) {
        const topProfileId = this.createArbitraryProfile(topOutline);
        const topSolidId = this.createExtrudedSolidAtHeight(
          topProfileId,
          topThickness,
          storeyElevation + height - topThickness
        );
        solidIds.push(topSolidId);
      }
    }

    // 4. Optional footrest bar
    if (hasFootrest && footrestHeight > 0) {
      const footrestFront = offsetPath(path, 0.02);
      const footrestBack = offsetPath(path, 0.05);
      const footrestOutline = createCounterPolygon(footrestFront, footrestBack);
      if (footrestOutline.length >= 3) {
        const footrestProfileId = this.createArbitraryProfile(footrestOutline);
        const footrestSolidId = this.createExtrudedSolidAtHeight(
          footrestProfileId,
          0.03, // 3cm thick bar
          storeyElevation + footrestHeight
        );
        solidIds.push(footrestSolidId);
      }
    }

    if (solidIds.length === 0) return;

    // Create placement at origin (geometry already includes positions)
    const placementId = this.createLocalPlacement(null, 0, 0, 0);

    // Create shape representation with all solids
    const shapeRepId = this.createMultiSolidShapeRepresentation(solidIds);

    // Create product representation
    const productRepId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: productRepId,
      type: WebIFC.IFCPRODUCTDEFINITIONSHAPE,
      Name: null,
      Description: null,
      Representations: [{ type: 5, value: shapeRepId }],
    });

    // Create counter as IfcBuildingElementProxy (generic building element)
    // IFC 2x3 doesn't have a specific counter type, so we use proxy
    const counterIfcId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: counterIfcId,
      type: WebIFC.IFCBUILDINGELEMENTPROXY,
      GlobalId: { type: 1, value: this.generateGuid() },
      OwnerHistory: null,
      Name: { type: 1, value: counter.name },
      Description: { type: 1, value: 'Counter/Theke' },
      ObjectType: { type: 1, value: 'Counter' },
      ObjectPlacement: { type: 5, value: placementId },
      Representation: { type: 5, value: productRepId },
      Tag: null,
      CompositionType: null,
    });

    this.counterIds.set(counter.id, counterIfcId);

    // Create property sets
    this.createPropertySets(counter, counterIfcId);

    // Assign to storey
    if (storeyIfcId) {
      this.createContainedInSpatialStructure(counterIfcId, storeyIfcId);
    }
  }

  private createFurniture(furniture: BimElement, storeys: StoreyInfo[]): void {
    if (!furniture.furnitureData) return;

    const { width, depth, height, meshData } = furniture.furnitureData;

    // Find storey
    const storey = storeys.find((s) => s.id === furniture.parentId);
    const storeyIfcId = storey ? this.storeyIds.get(storey.id) : null;

    // Position from placement (Z-up: x, y are horizontal, z is vertical)
    const posX = furniture.placement.position.x;
    const posY = furniture.placement.position.y; // Z-up: direct mapping
    const posZ = (storey?.elevation ?? 0) + furniture.placement.position.z;

    // Calculate rotation from quaternion (Z-axis rotation for Z-up)
    const q = furniture.placement.rotation;
    const rotationZ = Math.atan2(2 * (q.w * q.z + q.x * q.y), 1 - 2 * (q.y * q.y + q.z * q.z));

    // Create placement at furniture position
    const placementId = this.createLocalPlacement(null, posX, posY, posZ, rotationZ);

    let shapeRepId: number;

    // Use mesh data if available, otherwise fall back to bounding box
    if (meshData && meshData.vertices.length > 0 && meshData.indices.length > 0) {
      // Create FacetedBrep from mesh data
      const brepId = this.createFacetedBrep(meshData.vertices, meshData.indices);
      shapeRepId = this.createShapeRepresentation(brepId, 'Body', 'Brep');
    } else {
      // Fallback: Create rectangular profile for bounding box
      const profileId = this.createRectangleProfile(width, depth);
      const solidId = this.createExtrudedSolid(profileId, height);
      shapeRepId = this.createShapeRepresentation(solidId, 'Body', 'SweptSolid');
    }

    // Create product representation
    const productRepId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: productRepId,
      type: WebIFC.IFCPRODUCTDEFINITIONSHAPE,
      Name: null,
      Description: null,
      Representations: [{ type: 5, value: shapeRepId }],
    });

    // Create furniture as IfcFurnishingElement
    const furnitureIfcId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: furnitureIfcId,
      type: WebIFC.IFCFURNISHINGELEMENT,
      GlobalId: { type: 1, value: this.generateGuid() },
      OwnerHistory: null,
      Name: { type: 1, value: furniture.name },
      Description: furniture.furnitureData.category
        ? { type: 1, value: furniture.furnitureData.category }
        : null,
      ObjectType: furniture.furnitureData.category
        ? { type: 1, value: furniture.furnitureData.category }
        : null,
      ObjectPlacement: { type: 5, value: placementId },
      Representation: { type: 5, value: productRepId },
      Tag: null,
    });

    this.furnitureIds.set(furniture.id, furnitureIfcId);

    // Create property sets
    this.createPropertySets(furniture, furnitureIfcId);

    // Assign to storey
    if (storeyIfcId) {
      this.createContainedInSpatialStructure(furnitureIfcId, storeyIfcId);
    }
  }

  // Helper methods

  private createLocalPlacement(
    relativeTo: number | null,
    x: number,
    y: number,
    z: number,
    rotationZ: number = 0
  ): number {
    const originId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: originId,
      type: WebIFC.IFCCARTESIANPOINT,
      Coordinates: [{ type: 4, value: x }, { type: 4, value: y }, { type: 4, value: z }],
    });

    const axisId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: axisId,
      type: WebIFC.IFCDIRECTION,
      DirectionRatios: [{ type: 4, value: 0 }, { type: 4, value: 0 }, { type: 4, value: 1 }],
    });

    const refDirId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: refDirId,
      type: WebIFC.IFCDIRECTION,
      DirectionRatios: [
        { type: 4, value: Math.cos(rotationZ) },
        { type: 4, value: Math.sin(rotationZ) },
        { type: 4, value: 0 },
      ],
    });

    const axis2PlacementId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: axis2PlacementId,
      type: WebIFC.IFCAXIS2PLACEMENT3D,
      Location: { type: 5, value: originId },
      Axis: { type: 5, value: axisId },
      RefDirection: { type: 5, value: refDirId },
    });

    const localPlacementId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: localPlacementId,
      type: WebIFC.IFCLOCALPLACEMENT,
      PlacementRelTo: relativeTo ? { type: 5, value: relativeTo } : null,
      RelativePlacement: { type: 5, value: axis2PlacementId },
    });

    return localPlacementId;
  }

  private createRectangleProfile(width: number, depth: number, offsetX: number = 0, offsetY: number = 0): number {
    // Create 2D placement for profile position (to offset from center)
    let positionId: number | null = null;

    if (offsetX !== 0 || offsetY !== 0) {
      const pointId = this.getNextId();
      this.ifcApi.WriteLine(this.modelId, {
        expressID: pointId,
        type: WebIFC.IFCCARTESIANPOINT,
        Coordinates: [{ type: 4, value: offsetX }, { type: 4, value: offsetY }],
      });

      positionId = this.getNextId();
      this.ifcApi.WriteLine(this.modelId, {
        expressID: positionId,
        type: WebIFC.IFCAXIS2PLACEMENT2D,
        Location: { type: 5, value: pointId },
        RefDirection: null,
      });
    }

    const profileId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: profileId,
      type: WebIFC.IFCRECTANGLEPROFILEDEF,
      ProfileType: { type: 3, value: 'AREA' },
      ProfileName: null,
      Position: positionId ? { type: 5, value: positionId } : null,
      XDim: { type: 4, value: width },
      YDim: { type: 4, value: depth },
    });
    return profileId;
  }

  private createCircleProfile(radius: number): number {
    const profileId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: profileId,
      type: WebIFC.IFCCIRCLEPROFILEDEF,
      ProfileType: { type: 3, value: 'AREA' },
      ProfileName: null,
      Position: null,
      Radius: { type: 4, value: radius },
    });
    return profileId;
  }

  /**
   * Create an IfcFacetedBrep from triangulated mesh data
   * @param vertices Flat array of vertex coordinates [x1,y1,z1, x2,y2,z2, ...]
   * @param indices Flat array of triangle indices [v1,v2,v3, v4,v5,v6, ...]
   */
  private createFacetedBrep(vertices: number[], indices: number[]): number {
    // Create all unique vertices as IfcCartesianPoints
    const numVertices = vertices.length / 3;
    const vertexIds: number[] = [];

    for (let i = 0; i < numVertices; i++) {
      // Input vertices are in Y-up coordinate system (from GLB/GLTF/OBJ)
      const xIn = vertices[i * 3] ?? 0;
      const yIn = vertices[i * 3 + 1] ?? 0; // Y is up in source
      const zIn = vertices[i * 3 + 2] ?? 0;

      // Convert Y-up to Z-up for IFC:
      // X stays the same
      // Y (up in source) becomes Z (up in IFC)
      // Z (forward in source) becomes Y (forward in IFC)
      const xIfc = xIn;
      const yIfc = zIn;
      const zIfc = yIn;

      const pointId = this.getNextId();
      this.ifcApi.WriteLine(this.modelId, {
        expressID: pointId,
        type: WebIFC.IFCCARTESIANPOINT,
        Coordinates: [
          { type: 4, value: xIfc },
          { type: 4, value: yIfc },
          { type: 4, value: zIfc },
        ],
      });
      vertexIds.push(pointId);
    }

    // Create faces from triangles
    const faceIds: number[] = [];
    const numTriangles = indices.length / 3;

    for (let i = 0; i < numTriangles; i++) {
      const i0 = indices[i * 3] ?? 0;
      const i1 = indices[i * 3 + 1] ?? 0;
      const i2 = indices[i * 3 + 2] ?? 0;

      // Get vertex IDs for this triangle
      const v0 = vertexIds[i0];
      const v1 = vertexIds[i1];
      const v2 = vertexIds[i2];

      if (v0 === undefined || v1 === undefined || v2 === undefined) {
        continue; // Skip invalid triangles
      }

      // Create IfcPolyLoop with 3 vertices
      const polyLoopId = this.getNextId();
      this.ifcApi.WriteLine(this.modelId, {
        expressID: polyLoopId,
        type: WebIFC.IFCPOLYLOOP,
        Polygon: [
          { type: 5, value: v0 },
          { type: 5, value: v1 },
          { type: 5, value: v2 },
        ],
      });

      // Create IfcFaceOuterBound
      const faceOuterBoundId = this.getNextId();
      this.ifcApi.WriteLine(this.modelId, {
        expressID: faceOuterBoundId,
        type: WebIFC.IFCFACEOUTERBOUND,
        Bound: { type: 5, value: polyLoopId },
        Orientation: { type: 3, value: true },
      });

      // Create IfcFace
      const faceId = this.getNextId();
      this.ifcApi.WriteLine(this.modelId, {
        expressID: faceId,
        type: WebIFC.IFCFACE,
        Bounds: [{ type: 5, value: faceOuterBoundId }],
      });

      faceIds.push(faceId);
    }

    // Create IfcClosedShell
    const closedShellId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: closedShellId,
      type: WebIFC.IFCCLOSEDSHELL,
      CfsFaces: faceIds.map((id) => ({ type: 5, value: id })),
    });

    // Create IfcFacetedBrep
    const brepId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: brepId,
      type: WebIFC.IFCFACETEDBREP,
      Outer: { type: 5, value: closedShellId },
    });

    return brepId;
  }

  private createArbitraryProfile(points: { x: number; y: number }[]): number {
    // Create polyline from points
    const pointIds = points.map((p) => {
      const pointId = this.getNextId();
      this.ifcApi.WriteLine(this.modelId, {
        expressID: pointId,
        type: WebIFC.IFCCARTESIANPOINT,
        Coordinates: [{ type: 4, value: p.x }, { type: 4, value: p.y }],
      });
      return pointId;
    });

    // Close the polyline
    pointIds.push(pointIds[0]!);

    const polylineId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: polylineId,
      type: WebIFC.IFCPOLYLINE,
      Points: pointIds.map((id) => ({ type: 5, value: id })),
    });

    const profileId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: profileId,
      type: WebIFC.IFCARBITRARYCLOSEDPROFILEDEF,
      ProfileType: { type: 3, value: 'AREA' },
      ProfileName: null,
      OuterCurve: { type: 5, value: polylineId },
    });

    return profileId;
  }

  private createExtrudedSolid(profileId: number, height: number): number {
    // Extrusion direction (Z-up)
    const directionId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: directionId,
      type: WebIFC.IFCDIRECTION,
      DirectionRatios: [{ type: 4, value: 0 }, { type: 4, value: 0 }, { type: 4, value: 1 }],
    });

    // Position for extrusion (origin)
    const originId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: originId,
      type: WebIFC.IFCCARTESIANPOINT,
      Coordinates: [{ type: 4, value: 0 }, { type: 4, value: 0 }],
    });

    const positionId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: positionId,
      type: WebIFC.IFCAXIS2PLACEMENT3D,
      Location: { type: 5, value: originId },
      Axis: null,
      RefDirection: null,
    });

    const solidId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: solidId,
      type: WebIFC.IFCEXTRUDEDAREASOLID,
      SweptArea: { type: 5, value: profileId },
      Position: { type: 5, value: positionId },
      ExtrudedDirection: { type: 5, value: directionId },
      Depth: { type: 4, value: height },
    });

    return solidId;
  }

  /**
   * Create an extruded solid at a specific Z height
   */
  private createExtrudedSolidAtHeight(profileId: number, height: number, zOffset: number): number {
    // Extrusion direction (Z-up)
    const directionId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: directionId,
      type: WebIFC.IFCDIRECTION,
      DirectionRatios: [{ type: 4, value: 0 }, { type: 4, value: 0 }, { type: 4, value: 1 }],
    });

    // Position for extrusion at Z offset
    const originId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: originId,
      type: WebIFC.IFCCARTESIANPOINT,
      Coordinates: [{ type: 4, value: 0 }, { type: 4, value: 0 }, { type: 4, value: zOffset }],
    });

    const positionId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: positionId,
      type: WebIFC.IFCAXIS2PLACEMENT3D,
      Location: { type: 5, value: originId },
      Axis: null,
      RefDirection: null,
    });

    const solidId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: solidId,
      type: WebIFC.IFCEXTRUDEDAREASOLID,
      SweptArea: { type: 5, value: profileId },
      Position: { type: 5, value: positionId },
      ExtrudedDirection: { type: 5, value: directionId },
      Depth: { type: 4, value: height },
    });

    return solidId;
  }

  /**
   * Create shape representation with multiple solid items
   */
  private createMultiSolidShapeRepresentation(solidIds: number[]): number {
    const repId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: repId,
      type: WebIFC.IFCSHAPEREPRESENTATION,
      ContextOfItems: { type: 5, value: this.geometricContextId },
      RepresentationIdentifier: { type: 1, value: 'Body' },
      RepresentationType: { type: 1, value: 'SweptSolid' },
      Items: solidIds.map((id) => ({ type: 5, value: id })),
    });
    return repId;
  }

  private createShapeRepresentation(
    itemId: number,
    identifier: string,
    type: string
  ): number {
    const repId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: repId,
      type: WebIFC.IFCSHAPEREPRESENTATION,
      ContextOfItems: { type: 5, value: this.geometricContextId },
      RepresentationIdentifier: { type: 1, value: identifier },
      RepresentationType: { type: 1, value: type },
      Items: [{ type: 5, value: itemId }],
    });
    return repId;
  }

  private createContainedInSpatialStructure(elementId: number, storeyId: number): void {
    const relContainedId = this.getNextId();
    this.ifcApi.WriteLine(this.modelId, {
      expressID: relContainedId,
      type: WebIFC.IFCRELCONTAINEDINSPATIALSTRUCTURE,
      GlobalId: { type: 1, value: this.generateGuid() },
      OwnerHistory: null,
      Name: null,
      Description: null,
      RelatedElements: [{ type: 5, value: elementId }],
      RelatingStructure: { type: 5, value: storeyId },
    });
  }

  private generateGuid(): string {
    // Generate IFC-compatible GUID (22 characters, base64-like)
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';
    let guid = '';
    for (let i = 0; i < 22; i++) {
      guid += chars[Math.floor(Math.random() * 64)];
    }
    return guid;
  }

  /**
   * Convert a property value to a string for IFC export
   * Returns null if the value cannot be converted
   */
  private convertToIfcString(value: unknown): string | null {
    if (value === null || value === undefined) return null;

    const valueType = typeof value;

    if (valueType === 'string') {
      const str = value as string;
      // Skip empty strings
      if (str.trim() === '') return null;
      return str;
    }

    if (valueType === 'number') {
      const num = value as number;
      // Skip NaN and Infinity
      if (!Number.isFinite(num)) return null;
      return String(num);
    }

    if (valueType === 'boolean') {
      return value ? 'true' : 'false';
    }

    // Skip objects, arrays, functions, symbols, etc.
    return null;
  }

  /**
   * Create IFC property sets and link them to an element
   * @param element The BIM element with property sets
   * @param elementIfcId The IFC entity ID of the element
   */
  private createPropertySets(element: BimElement, elementIfcId: number): void {
    if (!element.properties || element.properties.length === 0) return;

    for (const pset of element.properties) {
      // Skip if pset or pset.name is invalid
      if (!pset || !pset.name || typeof pset.name !== 'string') continue;
      if (!pset.properties || typeof pset.properties !== 'object') continue;

      const psetName = String(pset.name).trim();
      if (psetName === '') continue;

      const propertyIds: number[] = [];

      // Create IfcPropertySingleValue for each property
      for (const [key, value] of Object.entries(pset.properties)) {
        // Validate key
        if (!key || typeof key !== 'string') continue;
        const keyStr = String(key).trim();
        if (keyStr === '') continue;

        // Convert value to string
        const valueStr = this.convertToIfcString(value);
        if (valueStr === null) continue;

        try {
          const propertyId = this.getNextId();

          this.ifcApi.WriteLine(this.modelId, {
            expressID: propertyId,
            type: WebIFC.IFCPROPERTYSINGLEVALUE,
            Name: { type: 1, value: keyStr },
            Description: null,
            NominalValue: { type: 1, value: valueStr },
            Unit: null,
          });
          propertyIds.push(propertyId);
        } catch (err) {
          console.warn(`[IFC Export] Skipping property "${keyStr}": ${err}`);
        }
      }

      if (propertyIds.length === 0) continue;

      try {
        // Create IfcPropertySet
        const psetId = this.getNextId();
        this.ifcApi.WriteLine(this.modelId, {
          expressID: psetId,
          type: WebIFC.IFCPROPERTYSET,
          GlobalId: { type: 1, value: this.generateGuid() },
          OwnerHistory: null,
          Name: { type: 1, value: psetName },
          Description: null,
          HasProperties: propertyIds.map((id) => ({ type: 5, value: id })),
        });

        // Create IfcRelDefinesByProperties to link property set to element
        const relDefinesId = this.getNextId();
        this.ifcApi.WriteLine(this.modelId, {
          expressID: relDefinesId,
          type: WebIFC.IFCRELDEFINESBYPROPERTIES,
          GlobalId: { type: 1, value: this.generateGuid() },
          OwnerHistory: null,
          Name: null,
          Description: null,
          RelatedObjects: [{ type: 5, value: elementIfcId }],
          RelatingPropertyDefinition: { type: 5, value: psetId },
        });
      } catch (err) {
        console.warn(`[IFC Export] Skipping property set "${psetName}": ${err}`);
      }
    }
  }
}

/**
 * Export project to IFC file and trigger download
 */
export async function exportToIfc(
  project: ProjectInfo,
  site: SiteInfo,
  building: BuildingInfo,
  storeys: StoreyInfo[],
  elements: BimElement[]
): Promise<void> {
  const exporter = new IfcExporter();
  await exporter.init();

  const ifcData = await exporter.export(project, site, building, storeys, elements);

  // Create blob and download
  const blob = new Blob([new Uint8Array(ifcData)], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `${project.name.replace(/[^a-zA-Z0-9]/g, '_')}.ifc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
