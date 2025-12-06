import * as WebIFC from 'web-ifc';
import type { BimElement, ProjectInfo, SiteInfo, BuildingInfo, StoreyInfo } from '@/types/bim';

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

    // Assign to storey
    if (storeyIfcId) {
      this.createContainedInSpatialStructure(slabIfcId, storeyIfcId);
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
