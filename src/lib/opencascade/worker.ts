/**
 * OpenCascade.js Web Worker
 *
 * Runs OCCT operations off the main thread to prevent UI blocking.
 * Handles shape creation, boolean operations, fillets, and mesh extraction.
 *
 * Based on Context7 documentation for BRepAlgoAPI and BRepFilletAPI.
 */

/// <reference lib="webworker" />

import initOpenCascade from 'opencascade.js';
import type {
  WorkerRequest,
  WorkerResponse,
  BoxParams,
  CylinderParams,
  ExtrusionParams,
  BooleanOperationParams,
  FilletParams,
  MeshData,
  OcctShapeHandle,
} from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OC = any; // OpenCascade instance type

let oc: OC | null = null;
const shapes = new Map<string, unknown>(); // TopoDS_Shape storage
let shapeCounter = 0;

// ============================================================================
// Initialization
// ============================================================================

async function initialize(): Promise<void> {
  if (oc) return;

  try {
    oc = await initOpenCascade();
    console.log('[OCCT Worker] OpenCascade.js initialized successfully');
  } catch (error) {
    console.error('[OCCT Worker] Failed to initialize:', error);
    throw error;
  }
}

// ============================================================================
// Shape Storage
// ============================================================================

function generateShapeId(): string {
  return `shape_${++shapeCounter}_${Date.now()}`;
}

function storeShape(shape: unknown, type: OcctShapeHandle['type']): OcctShapeHandle {
  const id = generateShapeId();
  shapes.set(id, shape);
  return { id, type };
}

function getShape(id: string): unknown {
  const shape = shapes.get(id);
  if (!shape) {
    throw new Error(`Shape not found: ${id}`);
  }
  return shape;
}

function disposeShape(id: string): boolean {
  return shapes.delete(id);
}

function disposeAllShapes(): void {
  shapes.clear();
  shapeCounter = 0;
}

// ============================================================================
// Primitive Creation
// ============================================================================

function createBox(params: BoxParams): OcctShapeHandle {
  const { width, depth, height, position = { x: 0, y: 0, z: 0 } } = params;

  // Create box at origin
  const box = new oc.BRepPrimAPI_MakeBox_2(width, depth, height);
  let shape = box.Shape();

  // Apply position transform if needed
  if (position.x !== 0 || position.y !== 0 || position.z !== 0) {
    const trsf = new oc.gp_Trsf_1();
    trsf.SetTranslation_1(new oc.gp_Vec_4(position.x, position.y, position.z));
    const transform = new oc.BRepBuilderAPI_Transform_2(shape, trsf, true);
    shape = transform.Shape();
  }

  return storeShape(shape, 'solid');
}

function createCylinder(params: CylinderParams): OcctShapeHandle {
  const { radius, height, position = { x: 0, y: 0, z: 0 } } = params;

  const cylinder = new oc.BRepPrimAPI_MakeCylinder_1(radius, height);
  let shape = cylinder.Shape();

  // Apply position transform if needed
  if (position.x !== 0 || position.y !== 0 || position.z !== 0) {
    const trsf = new oc.gp_Trsf_1();
    trsf.SetTranslation_1(new oc.gp_Vec_4(position.x, position.y, position.z));
    const transform = new oc.BRepBuilderAPI_Transform_2(shape, trsf, true);
    shape = transform.Shape();
  }

  return storeShape(shape, 'solid');
}

// ============================================================================
// Extrusion
// ============================================================================

function extrudeProfile(params: ExtrusionParams): OcctShapeHandle {
  const {
    profile,
    height,
    direction = { x: 0, y: 0, z: 1 },
    position = { x: 0, y: 0, z: 0 },
  } = params;

  if (profile.length < 3) {
    throw new Error('Profile must have at least 3 points');
  }

  // Create wire from profile points
  const wireBuilder = new oc.BRepBuilderAPI_MakeWire_1();

  for (let i = 0; i < profile.length; i++) {
    const p1 = profile[i]!;
    const p2 = profile[(i + 1) % profile.length]!;

    const point1 = new oc.gp_Pnt_3(p1.x + position.x, p1.y + position.y, position.z);
    const point2 = new oc.gp_Pnt_3(p2.x + position.x, p2.y + position.y, position.z);

    const edge = new oc.BRepBuilderAPI_MakeEdge_3(point1, point2);
    wireBuilder.Add_1(edge.Edge());
  }

  const wire = wireBuilder.Wire();

  // Create face from wire
  const face = new oc.BRepBuilderAPI_MakeFace_15(wire, true);

  // Create extrusion direction vector
  const extrusionVec = new oc.gp_Vec_4(
    direction.x * height,
    direction.y * height,
    direction.z * height
  );

  // Extrude the face
  const prism = new oc.BRepPrimAPI_MakePrism_1(face.Face(), extrusionVec, false, true);

  return storeShape(prism.Shape(), 'solid');
}

// ============================================================================
// Boolean Operations (Context7: BRepAlgoAPI_Cut/Fuse/Common)
// ============================================================================

function performBoolean(params: BooleanOperationParams): OcctShapeHandle {
  const { type, objectId, toolId, fuzzyValue = 0.001 } = params;

  const objectShape = getShape(objectId);
  const toolShape = getShape(toolId);

  // Create progress range (required parameter, no default in JS bindings)
  const progressRange = new oc.Message_ProgressRange_1();

  let builder;
  switch (type) {
    case 'cut':
      // BRepAlgoAPI_Cut: Result = Object - Tool
      builder = new oc.BRepAlgoAPI_Cut_3(objectShape, toolShape, progressRange);
      break;
    case 'fuse':
      // BRepAlgoAPI_Fuse: Result = Object + Tool
      builder = new oc.BRepAlgoAPI_Fuse_3(objectShape, toolShape, progressRange);
      break;
    case 'common':
      // BRepAlgoAPI_Common: Result = Object intersection Tool
      builder = new oc.BRepAlgoAPI_Common_3(objectShape, toolShape, progressRange);
      break;
    default:
      throw new Error(`Unknown boolean operation: ${type}`);
  }

  // Set fuzzy tolerance (Context7: prevents geometry collapse)
  builder.SetFuzzyValue(fuzzyValue);

  // Execute the operation
  builder.Build(progressRange);

  // Check for errors
  if (builder.HasErrors()) {
    throw new Error(`Boolean ${type} operation failed`);
  }

  return storeShape(builder.Shape(), 'solid');
}

// ============================================================================
// Fillet Operation (Context7: BRepFilletAPI_MakeFillet)
// ============================================================================

function performFillet(params: FilletParams): OcctShapeHandle {
  const { shapeId, radius, edgeIndices } = params;

  const shape = getShape(shapeId);

  // Create fillet maker
  const fillet = new oc.BRepFilletAPI_MakeFillet(
    shape,
    oc.ChFi3d_FilletShape.ChFi3d_Rational
  );

  // Explore edges
  const explorer = new oc.TopExp_Explorer_2(
    shape,
    oc.TopAbs_ShapeEnum.TopAbs_EDGE,
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE
  );

  let edgeIndex = 0;
  while (explorer.More()) {
    // Add fillet to all edges or specific ones
    if (!edgeIndices || edgeIndices.length === 0 || edgeIndices.includes(edgeIndex)) {
      const edge = oc.TopoDS.Edge_1(explorer.Current());
      fillet.Add_2(radius, edge);
    }
    explorer.Next();
    edgeIndex++;
  }

  // Build the filleted shape
  fillet.Build(new oc.Message_ProgressRange_1());

  if (!fillet.IsDone()) {
    throw new Error('Fillet operation failed');
  }

  return storeShape(fillet.Shape(), 'solid');
}

// ============================================================================
// Mesh Extraction
// ============================================================================

function extractMesh(shapeId: string): MeshData {
  const shape = getShape(shapeId);

  // Triangulate the shape with reasonable tolerance
  const linearDeflection = 0.1; // 100mm linear tolerance
  const angularDeflection = 0.5; // ~28 degrees
  new oc.BRepMesh_IncrementalMesh_2(
    shape,
    linearDeflection,
    false,
    angularDeflection,
    true
  );

  const vertices: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];

  // Explore faces and extract triangulation
  const explorer = new oc.TopExp_Explorer_2(
    shape,
    oc.TopAbs_ShapeEnum.TopAbs_FACE,
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE
  );

  while (explorer.More()) {
    const face = oc.TopoDS.Face_1(explorer.Current());
    const location = new oc.TopLoc_Location_1();
    const triangulation = oc.BRep_Tool.Triangulation(face, location);

    if (!triangulation.IsNull()) {
      const tri = triangulation.get();
      const nbNodes = tri.NbNodes();
      const nbTriangles = tri.NbTriangles();
      const offset = vertices.length / 3;

      // Get transformation matrix
      const transformation = location.Transformation();

      // Extract vertices and normals
      for (let i = 1; i <= nbNodes; i++) {
        const node = tri.Node(i);

        // Apply transformation
        const transformedNode = node.Transformed(transformation);
        vertices.push(transformedNode.X(), transformedNode.Y(), transformedNode.Z());

        // Get normal if available
        if (tri.HasNormals()) {
          const normal = tri.Normal(i);
          normals.push(normal.X(), normal.Y(), normal.Z());
        } else {
          // Default normal (will be computed by Three.js)
          normals.push(0, 0, 1);
        }
      }

      // Check face orientation
      const faceOrientation = face.Orientation_1();
      const isReversed = faceOrientation === oc.TopAbs_Orientation.TopAbs_REVERSED;

      // Extract triangle indices
      for (let i = 1; i <= nbTriangles; i++) {
        const triangle = tri.Triangle(i);
        const n1 = triangle.Value(1) - 1 + offset;
        const n2 = triangle.Value(2) - 1 + offset;
        const n3 = triangle.Value(3) - 1 + offset;

        // Respect face orientation
        if (isReversed) {
          indices.push(n1, n3, n2);
        } else {
          indices.push(n1, n2, n3);
        }
      }
    }

    explorer.Next();
  }

  return {
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
    normals: new Float32Array(normals),
  };
}

// ============================================================================
// Message Handler
// ============================================================================

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { id, type, payload } = e.data;

  const respond = (response: Omit<WorkerResponse, 'id'>) => {
    self.postMessage({ id, ...response } as WorkerResponse);
  };

  try {
    switch (type) {
      case 'init':
        await initialize();
        respond({ type: 'init', success: true });
        break;

      case 'createBox':
        {
          const handle = createBox(payload as BoxParams);
          const mesh = extractMesh(handle.id);
          respond({ type: 'result', data: { handle, mesh } });
        }
        break;

      case 'createCylinder':
        {
          const handle = createCylinder(payload as CylinderParams);
          const mesh = extractMesh(handle.id);
          respond({ type: 'result', data: { handle, mesh } });
        }
        break;

      case 'extrude':
        {
          const handle = extrudeProfile(payload as ExtrusionParams);
          const mesh = extractMesh(handle.id);
          respond({ type: 'result', data: { handle, mesh } });
        }
        break;

      case 'boolean':
        {
          const handle = performBoolean(payload as BooleanOperationParams);
          const mesh = extractMesh(handle.id);
          respond({ type: 'result', data: { handle, mesh } });
        }
        break;

      case 'fillet':
        {
          const handle = performFillet(payload as FilletParams);
          const mesh = extractMesh(handle.id);
          respond({ type: 'result', data: { handle, mesh } });
        }
        break;

      case 'getMesh':
        {
          const mesh = extractMesh(payload as string);
          respond({ type: 'result', data: mesh });
        }
        break;

      case 'dispose':
        {
          const success = disposeShape(payload as string);
          respond({ type: 'result', data: success });
        }
        break;

      case 'disposeAll':
        disposeAllShapes();
        respond({ type: 'result', data: true });
        break;

      default:
        respond({ type: 'error', error: `Unknown message type: ${type}` });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[OCCT Worker] Error in ${type}:`, error);
    respond({ type: 'error', error: errorMessage });
  }
};

// Signal that worker is ready to receive messages
console.log('[OCCT Worker] Worker script loaded');
