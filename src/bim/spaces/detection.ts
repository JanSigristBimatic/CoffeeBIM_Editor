/**
 * Room Detection Algorithm
 *
 * Detects closed spaces (rooms) from wall segments using graph-based cycle detection.
 * Each closed loop of walls forms a potential room (IfcSpace).
 */

import type { Point2D } from '@/types/geometry';
import type { BimElement } from '@/types/bim';
import { distance2D } from '@/lib/geometry/math';
import { SPACE_DETECTION_TOLERANCE } from '@/types/bim';

// ============================================================================
// Types
// ============================================================================

/**
 * A detected space (room) before it becomes a BimElement
 */
export interface DetectedSpace {
  /** Closed boundary polygon defining the space outline */
  boundaryPolygon: Point2D[];
  /** IDs of walls that bound this space */
  boundingWallIds: string[];
  /** Calculated floor area in square meters */
  area: number;
  /** Calculated perimeter in meters */
  perimeter: number;
  /** Centroid of the space for labeling */
  centroid: Point2D;
}

/**
 * Internal graph node representing a wall endpoint
 */
interface GraphNode {
  /** The point coordinates */
  point: Point2D;
  /** Unique key for this node */
  key: string;
  /** Connected edges (walls) */
  edges: GraphEdge[];
}

/**
 * Internal graph edge representing a wall segment
 */
interface GraphEdge {
  /** Wall ID (BimElement id) */
  wallId: string;
  /** The other end of the wall */
  targetNodeKey: string;
  /** Start point of wall */
  start: Point2D;
  /** End point of wall */
  end: Point2D;
}

/**
 * A found cycle (potential room)
 */
interface Cycle {
  /** Ordered points forming the cycle */
  points: Point2D[];
  /** Wall IDs in order */
  wallIds: string[];
}

// ============================================================================
// Main Detection Function
// ============================================================================

/**
 * Detect closed spaces (rooms) from a list of wall elements
 *
 * @param walls - Array of wall BimElements
 * @param tolerance - Distance tolerance for connecting endpoints (default: 5cm)
 * @returns Array of detected spaces
 */
export function detectSpaces(
  walls: BimElement[],
  tolerance: number = SPACE_DETECTION_TOLERANCE
): DetectedSpace[] {
  if (walls.length < 3) {
    // Need at least 3 walls to form a closed space
    return [];
  }

  // 1. Build graph from wall segments
  const graph = buildGraph(walls, tolerance);

  // 2. Find all minimal cycles (closed rooms)
  const cycles = findMinimalCycles(graph);

  // 3. Convert cycles to DetectedSpace objects
  const spaces: DetectedSpace[] = [];

  for (const cycle of cycles) {
    // Filter out degenerate cycles (less than 3 points)
    if (cycle.points.length < 3) continue;

    const area = calculatePolygonArea(cycle.points);

    // Skip very small areas (likely not real rooms)
    if (area < 0.5) continue; // Minimum 0.5 m²

    const perimeter = calculatePerimeter(cycle.points);
    const centroid = calculateCentroid(cycle.points);

    spaces.push({
      boundaryPolygon: cycle.points,
      boundingWallIds: cycle.wallIds,
      area,
      perimeter,
      centroid,
    });
  }

  // Sort by area (largest first)
  return spaces.sort((a, b) => b.area - a.area);
}

/**
 * Detect a single space containing a specific point using RAY CASTING
 * (Flood-fill style detection like Paint's bucket tool)
 *
 * Algorithm:
 * 1. Cast rays from the click point in all directions (360°)
 * 2. Find the first wall each ray hits
 * 3. Collect hit points and wall IDs
 * 4. Form a polygon from the hit points (sorted by angle)
 *
 * @param point - The point to check (click location)
 * @param walls - Array of wall BimElements
 * @param tolerance - Distance tolerance (unused, kept for API compatibility)
 * @returns The detected space containing the point, or null if no enclosure found
 */
export function detectSpaceAtPoint(
  point: Point2D,
  walls: BimElement[],
  _tolerance: number = SPACE_DETECTION_TOLERANCE
): DetectedSpace | null {
  if (walls.length < 3) {
    return null;
  }

  // Convert walls to line segments
  const wallSegments: WallSegment[] = [];
  for (const wall of walls) {
    if (!wall.wallData) continue;
    wallSegments.push({
      id: wall.id,
      start: wall.wallData.startPoint,
      end: wall.wallData.endPoint,
    });
  }

  if (wallSegments.length < 3) {
    return null;
  }

  // Cast rays in all directions and find boundary
  const result = castRaysFromPoint(point, wallSegments);

  if (!result || result.hitPoints.length < 3) {
    return null;
  }

  const area = calculatePolygonArea(result.hitPoints);

  // Skip very small areas
  if (area < 0.5) return null;

  const perimeter = calculatePerimeter(result.hitPoints);
  const centroid = calculateCentroid(result.hitPoints);

  return {
    boundaryPolygon: result.hitPoints,
    boundingWallIds: result.wallIds,
    area,
    perimeter,
    centroid,
  };
}

// ============================================================================
// Ray Casting Room Detection
// ============================================================================

interface WallSegment {
  id: string;
  start: Point2D;
  end: Point2D;
}

interface RayHit {
  point: Point2D;
  wallId: string;
  distance: number;
  angle: number;
}

interface RayCastResult {
  hitPoints: Point2D[];
  wallIds: string[];
}

/**
 * Cast rays from a point in all directions and find the enclosing boundary
 */
function castRaysFromPoint(
  origin: Point2D,
  walls: WallSegment[],
  rayCount: number = 360
): RayCastResult | null {
  const hits: RayHit[] = [];
  const maxDistance = 1000; // Maximum ray distance

  // Cast rays in all directions
  for (let i = 0; i < rayCount; i++) {
    const angle = (i / rayCount) * Math.PI * 2;
    const direction = {
      x: Math.cos(angle),
      y: Math.sin(angle),
    };

    // Find closest wall hit for this ray
    let closestHit: RayHit | null = null;

    for (const wall of walls) {
      const hit = rayLineIntersection(origin, direction, wall.start, wall.end, maxDistance);

      if (hit && (!closestHit || hit.distance < closestHit.distance)) {
        closestHit = {
          point: hit.point,
          wallId: wall.id,
          distance: hit.distance,
          angle,
        };
      }
    }

    if (closestHit) {
      hits.push(closestHit);
    }
  }

  if (hits.length < 3) {
    return null;
  }

  // Simplify the hit points to remove duplicates and collinear points
  const simplified = simplifyBoundary(hits);

  if (simplified.hitPoints.length < 3) {
    return null;
  }

  return simplified;
}

/**
 * Ray-line segment intersection
 * Returns intersection point and distance if ray hits the line segment
 */
function rayLineIntersection(
  rayOrigin: Point2D,
  rayDir: Point2D,
  lineStart: Point2D,
  lineEnd: Point2D,
  maxDistance: number
): { point: Point2D; distance: number } | null {
  // Ray: P = rayOrigin + t * rayDir
  // Line: Q = lineStart + s * (lineEnd - lineStart)

  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;

  const denominator = rayDir.x * dy - rayDir.y * dx;

  // Parallel lines
  if (Math.abs(denominator) < 1e-10) {
    return null;
  }

  const t = ((lineStart.x - rayOrigin.x) * dy - (lineStart.y - rayOrigin.y) * dx) / denominator;
  const s = ((lineStart.x - rayOrigin.x) * rayDir.y - (lineStart.y - rayOrigin.y) * rayDir.x) / denominator;

  // Check if intersection is valid
  // t > 0: intersection is in front of ray origin
  // 0 <= s <= 1: intersection is on the line segment
  if (t > 0.001 && s >= 0 && s <= 1 && t <= maxDistance) {
    return {
      point: {
        x: rayOrigin.x + t * rayDir.x,
        y: rayOrigin.y + t * rayDir.y,
      },
      distance: t,
    };
  }

  return null;
}

/**
 * Simplify boundary by merging nearby points and removing collinear points
 */
function simplifyBoundary(hits: RayHit[]): RayCastResult {
  if (hits.length === 0) {
    return { hitPoints: [], wallIds: [] };
  }

  // Sort by angle (should already be sorted, but ensure it)
  const sorted = [...hits].sort((a, b) => a.angle - b.angle);

  // Merge points that are very close together
  const merged: RayHit[] = [];
  const mergeThreshold = 0.05; // 5cm

  for (const hit of sorted) {
    if (merged.length === 0) {
      merged.push(hit);
      continue;
    }

    const lastHit = merged[merged.length - 1]!;
    const dist = distance2D(hit.point, lastHit.point);

    if (dist > mergeThreshold) {
      merged.push(hit);
    }
  }

  // Also check if first and last are too close
  if (merged.length > 1) {
    const first = merged[0]!;
    const last = merged[merged.length - 1]!;
    if (distance2D(first.point, last.point) < mergeThreshold) {
      merged.pop();
    }
  }

  // Remove collinear points (Douglas-Peucker style simplification)
  const simplified = removeCollinearPoints(merged, 0.02);

  // Extract unique wall IDs
  const wallIdSet = new Set<string>();
  for (const hit of simplified) {
    wallIdSet.add(hit.wallId);
  }

  return {
    hitPoints: simplified.map((h) => h.point),
    wallIds: Array.from(wallIdSet),
  };
}

/**
 * Remove points that are nearly collinear with their neighbors
 */
function removeCollinearPoints(hits: RayHit[], threshold: number): RayHit[] {
  if (hits.length <= 3) {
    return hits;
  }

  const result: RayHit[] = [];

  for (let i = 0; i < hits.length; i++) {
    const prev = hits[(i - 1 + hits.length) % hits.length]!;
    const curr = hits[i]!;
    const next = hits[(i + 1) % hits.length]!;

    // Calculate perpendicular distance from curr to line prev-next
    const perpDist = pointToLineDistance(curr.point, prev.point, next.point);

    // Keep point if it's not collinear (significant deviation from line)
    if (perpDist > threshold) {
      result.push(curr);
    }
  }

  // Ensure we have at least 3 points
  if (result.length < 3) {
    return hits.slice(0, Math.min(hits.length, 3));
  }

  return result;
}

/**
 * Calculate perpendicular distance from point to line
 */
function pointToLineDistance(point: Point2D, lineStart: Point2D, lineEnd: Point2D): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lineLength = Math.sqrt(dx * dx + dy * dy);

  if (lineLength < 1e-10) {
    return distance2D(point, lineStart);
  }

  // Calculate perpendicular distance using cross product
  const cross = Math.abs((point.x - lineStart.x) * dy - (point.y - lineStart.y) * dx);
  return cross / lineLength;
}

// ============================================================================
// Graph Building
// ============================================================================

/**
 * Create a unique key for a point (rounded to tolerance)
 */
function pointKey(p: Point2D, tolerance: number): string {
  // Round to tolerance grid to merge nearby points
  const precision = Math.ceil(-Math.log10(tolerance));
  const factor = Math.pow(10, precision);
  const x = Math.round(p.x * factor) / factor;
  const y = Math.round(p.y * factor) / factor;
  return `${x.toFixed(precision)}_${y.toFixed(precision)}`;
}

/**
 * Find or create a node for a point
 */
function findOrCreateNode(
  nodes: Map<string, GraphNode>,
  point: Point2D,
  tolerance: number
): GraphNode {
  // First, try to find an existing node within tolerance
  for (const node of nodes.values()) {
    if (distance2D(node.point, point) < tolerance) {
      return node;
    }
  }

  // Create new node
  const key = pointKey(point, tolerance);
  const node: GraphNode = {
    point: { ...point },
    key,
    edges: [],
  };
  nodes.set(key, node);
  return node;
}

/**
 * Build a graph from wall segments
 */
function buildGraph(
  walls: BimElement[],
  tolerance: number
): Map<string, GraphNode> {
  const nodes = new Map<string, GraphNode>();

  for (const wall of walls) {
    if (!wall.wallData) continue;

    const { startPoint, endPoint } = wall.wallData;

    // Find or create nodes for endpoints
    const startNode = findOrCreateNode(nodes, startPoint, tolerance);
    const endNode = findOrCreateNode(nodes, endPoint, tolerance);

    // Skip self-loops
    if (startNode.key === endNode.key) continue;

    // Add edges in both directions
    startNode.edges.push({
      wallId: wall.id,
      targetNodeKey: endNode.key,
      start: startPoint,
      end: endPoint,
    });

    endNode.edges.push({
      wallId: wall.id,
      targetNodeKey: startNode.key,
      start: endPoint,
      end: startPoint,
    });
  }

  return nodes;
}

// ============================================================================
// Cycle Detection
// ============================================================================

/**
 * Find all minimal cycles in the graph using the minimum cycle basis algorithm
 *
 * Key insight: Interior walls belong to TWO rooms, so each DIRECTED edge
 * (A→B vs B→A) should be explored separately. This allows finding all rooms
 * even when they share walls.
 */
function findMinimalCycles(graph: Map<string, GraphNode>): Cycle[] {
  const cycles: Cycle[] = [];
  // Use DIRECTED edge keys - each wall can be traversed twice (once per side)
  const globalVisitedDirectedEdges = new Set<string>();

  // Try to find cycles starting from each node
  for (const startNode of graph.values()) {
    // Only start from nodes with at least 2 connections
    if (startNode.edges.length < 2) continue;

    // Try each edge from this node as a starting edge
    for (const startEdge of startNode.edges) {
      // Use DIRECTED key - A→B is different from B→A
      const directedKey = createDirectedEdgeKey(startNode.key, startEdge.targetNodeKey, startEdge.wallId);

      // Skip if we've already explored this DIRECTED edge
      if (globalVisitedDirectedEdges.has(directedKey)) continue;

      // Find cycles using this edge
      const found = findCycleFromEdge(
        graph,
        startNode,
        startEdge,
        globalVisitedDirectedEdges
      );

      if (found) {
        cycles.push(found);
      }
    }
  }

  // Remove duplicate cycles (same walls in different order)
  return deduplicateCycles(cycles);
}

/**
 * Create a DIRECTED edge key - each edge can be traversed twice (once per direction)
 * This is important for interior walls that belong to TWO rooms
 */
function createDirectedEdgeKey(fromNode: string, toNode: string, wallId: string): string {
  return `${fromNode}->${toNode}-${wallId}`;
}

/**
 * Find a cycle starting from a specific edge using DFS
 */
function findCycleFromEdge(
  graph: Map<string, GraphNode>,
  startNode: GraphNode,
  startEdge: GraphEdge,
  globalVisitedDirected: Set<string>
): Cycle | null {
  // Use leftmost-turn algorithm (always turn left at intersections)
  // This finds the minimal enclosing cycle

  const maxSteps = 100; // Prevent infinite loops
  const path: { node: GraphNode; edge: GraphEdge }[] = [];
  // Use DIRECTED keys for path tracking too
  const visitedInPath = new Set<string>();

  let currentNode = startNode;
  let currentEdge = startEdge;

  for (let step = 0; step < maxSteps; step++) {
    // Move to target node
    const targetKey = currentEdge.targetNodeKey;
    const targetNode = graph.get(targetKey);

    if (!targetNode) break;

    // Add to path - use DIRECTED key
    path.push({ node: currentNode, edge: currentEdge });
    const pathEdgeKey = createDirectedEdgeKey(currentNode.key, targetKey, currentEdge.wallId);
    visitedInPath.add(pathEdgeKey);

    // Check if we've returned to start
    if (targetKey === startNode.key && path.length >= 3) {
      // Found a cycle!
      const cycle = extractCycle(path);

      // Mark all DIRECTED edges as globally visited
      for (const { node, edge } of path) {
        const key = createDirectedEdgeKey(node.key, edge.targetNodeKey, edge.wallId);
        globalVisitedDirected.add(key);
      }

      return cycle;
    }

    // Find next edge (turn left algorithm)
    const nextEdge = findLeftmostEdge(
      targetNode,
      currentEdge,
      visitedInPath
    );

    if (!nextEdge) break;

    currentNode = targetNode;
    currentEdge = nextEdge;
  }

  return null;
}

/**
 * Find the leftmost edge from current node (relative to incoming direction)
 * This ensures we follow the boundary of a minimal cycle
 */
function findLeftmostEdge(
  node: GraphNode,
  incomingEdge: GraphEdge,
  visitedInPath: Set<string>
): GraphEdge | null {
  // Incoming direction vector
  const inDir = {
    x: node.point.x - incomingEdge.start.x,
    y: node.point.y - incomingEdge.start.y,
  };
  const inAngle = Math.atan2(inDir.y, inDir.x);

  let bestEdge: GraphEdge | null = null;
  let bestAngleDiff = -Infinity;

  for (const edge of node.edges) {
    // Skip the reverse of the incoming edge (going back the same wall)
    if (edge.wallId === incomingEdge.wallId) continue;

    // Skip already visited DIRECTED edges in this path
    const edgeKey = createDirectedEdgeKey(node.key, edge.targetNodeKey, edge.wallId);
    if (visitedInPath.has(edgeKey)) continue;

    // Calculate outgoing angle
    const outDir = {
      x: edge.end.x - node.point.x,
      y: edge.end.y - node.point.y,
    };
    const outAngle = Math.atan2(outDir.y, outDir.x);

    // Calculate left turn angle (positive = left turn)
    let angleDiff = outAngle - inAngle;

    // Normalize to [-PI, PI]
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

    // We want the most left turn (largest positive angle difference)
    // But if no left turn possible, take the least right turn
    if (angleDiff > bestAngleDiff) {
      bestAngleDiff = angleDiff;
      bestEdge = edge;
    }
  }

  return bestEdge;
}

/**
 * Extract cycle points and wall IDs from path
 */
function extractCycle(
  path: { node: GraphNode; edge: GraphEdge }[]
): Cycle {
  const points: Point2D[] = [];
  const wallIds: string[] = [];

  for (const { node, edge } of path) {
    points.push({ ...node.point });
    wallIds.push(edge.wallId);
  }

  return { points, wallIds };
}

/**
 * Remove duplicate cycles (same walls in different order/direction)
 */
function deduplicateCycles(cycles: Cycle[]): Cycle[] {
  const unique: Cycle[] = [];
  const seen = new Set<string>();

  for (const cycle of cycles) {
    // Create a canonical key from sorted wall IDs
    const key = [...cycle.wallIds].sort().join(',');

    if (!seen.has(key)) {
      seen.add(key);
      unique.push(cycle);
    }
  }

  return unique;
}

// ============================================================================
// Polygon Calculations
// ============================================================================

/**
 * Calculate the area of a polygon using the Shoelace formula
 * Returns positive area (absolute value)
 */
export function calculatePolygonArea(polygon: Point2D[]): number {
  if (polygon.length < 3) return 0;

  let area = 0;
  const n = polygon.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += polygon[i]!.x * polygon[j]!.y;
    area -= polygon[j]!.x * polygon[i]!.y;
  }

  return Math.abs(area) / 2;
}

/**
 * Calculate the perimeter of a polygon
 */
export function calculatePerimeter(polygon: Point2D[]): number {
  if (polygon.length < 2) return 0;

  let perimeter = 0;
  const n = polygon.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    perimeter += distance2D(polygon[i]!, polygon[j]!);
  }

  return perimeter;
}

/**
 * Calculate the centroid (geometric center) of a polygon
 */
export function calculateCentroid(polygon: Point2D[]): Point2D {
  if (polygon.length === 0) {
    return { x: 0, y: 0 };
  }

  let cx = 0;
  let cy = 0;

  for (const p of polygon) {
    cx += p.x;
    cy += p.y;
  }

  return {
    x: cx / polygon.length,
    y: cy / polygon.length,
  };
}

/**
 * Check if a point is inside a polygon using ray casting
 */
export function isPointInPolygon(point: Point2D, polygon: Point2D[]): boolean {
  if (polygon.length < 3) return false;

  let inside = false;
  const n = polygon.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i]!.x;
    const yi = polygon[i]!.y;
    const xj = polygon[j]!.x;
    const yj = polygon[j]!.y;

    if (
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Ensure polygon points are in counter-clockwise order
 * (Standard for IFC space boundaries)
 */
export function ensureCounterClockwise(polygon: Point2D[]): Point2D[] {
  if (polygon.length < 3) return polygon;

  // Calculate signed area (positive = counter-clockwise)
  let signedArea = 0;
  const n = polygon.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    signedArea += polygon[i]!.x * polygon[j]!.y;
    signedArea -= polygon[j]!.x * polygon[i]!.y;
  }

  // If clockwise (negative area), reverse
  if (signedArea < 0) {
    return [...polygon].reverse();
  }

  return polygon;
}
