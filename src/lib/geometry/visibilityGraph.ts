/**
 * Visibility Graph for Evacuation Route Planning
 *
 * Creates optimal paths around obstacles (columns) with 45cm offset.
 * Uses visibility graph approach with Dijkstra's algorithm.
 */

// ============================================================================
// Types
// ============================================================================

export interface Point2D {
  x: number;
  y: number;
}

export interface CircleObstacle {
  id: string;
  position: Point2D;
  radius: number;
}

export interface WallSegment {
  start: Point2D;
  end: Point2D;
}

interface VisibilityNode {
  id: string;
  position: Point2D;
  type: 'start' | 'end' | 'obstacle';
}

interface VisibilityEdge {
  from: string;
  to: string;
  distance: number;
}

// ============================================================================
// Constants
// ============================================================================

const COLUMN_OFFSET = 0.45; // 45cm offset around columns
const TANGENT_POINTS = 8;   // Number of tangent points per column (for smooth paths)

// ============================================================================
// Geometry Helpers
// ============================================================================

function distance2D(a: Point2D, b: Point2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Check if two line segments intersect
 */
function lineSegmentsIntersect(
  a1: Point2D, a2: Point2D,
  b1: Point2D, b2: Point2D
): boolean {
  const ccw = (A: Point2D, B: Point2D, C: Point2D): boolean =>
    (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);

  // Check if points are collinear and overlapping
  const onSegment = (p: Point2D, q: Point2D, r: Point2D): boolean => {
    return q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) &&
           q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y);
  };

  const d1 = direction(b1, b2, a1);
  const d2 = direction(b1, b2, a2);
  const d3 = direction(a1, a2, b1);
  const d4 = direction(a1, a2, b2);

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }

  if (d1 === 0 && onSegment(b1, a1, b2)) return true;
  if (d2 === 0 && onSegment(b1, a2, b2)) return true;
  if (d3 === 0 && onSegment(a1, b1, a2)) return true;
  if (d4 === 0 && onSegment(a1, b2, a2)) return true;

  return ccw(a1, b1, b2) !== ccw(a2, b1, b2) && ccw(a1, a2, b1) !== ccw(a1, a2, b2);
}

function direction(p1: Point2D, p2: Point2D, p3: Point2D): number {
  return (p3.x - p1.x) * (p2.y - p1.y) - (p2.x - p1.x) * (p3.y - p1.y);
}

/**
 * Check if a line segment intersects a circle
 */
function lineIntersectsCircle(
  lineStart: Point2D,
  lineEnd: Point2D,
  circleCenter: Point2D,
  circleRadius: number
): boolean {
  // Vector from line start to end
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;

  // Vector from line start to circle center
  const fx = lineStart.x - circleCenter.x;
  const fy = lineStart.y - circleCenter.y;

  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - circleRadius * circleRadius;

  let discriminant = b * b - 4 * a * c;

  if (discriminant < 0) {
    return false; // No intersection
  }

  discriminant = Math.sqrt(discriminant);

  // Check if intersection points are on the line segment
  const t1 = (-b - discriminant) / (2 * a);
  const t2 = (-b + discriminant) / (2 * a);

  // t in [0, 1] means intersection is on the segment
  return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1);
}

/**
 * Calculate tangent points around a circle (for visibility graph)
 */
function calculateTangentPoints(center: Point2D, radius: number): Point2D[] {
  const points: Point2D[] = [];

  for (let i = 0; i < TANGENT_POINTS; i++) {
    const angle = (i / TANGENT_POINTS) * 2 * Math.PI;
    points.push({
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle),
    });
  }

  return points;
}

// ============================================================================
// Visibility Graph
// ============================================================================

/**
 * Check if a path from point A to point B is visible (not blocked)
 */
export function isVisible(
  from: Point2D,
  to: Point2D,
  columns: CircleObstacle[],
  walls: WallSegment[]
): boolean {
  // Skip very short paths
  if (distance2D(from, to) < 0.01) return true;

  // Check against all walls
  for (const wall of walls) {
    if (lineSegmentsIntersect(from, to, wall.start, wall.end)) {
      return false;
    }
  }

  // Check against all columns (with offset)
  for (const column of columns) {
    const effectiveRadius = column.radius + COLUMN_OFFSET;
    if (lineIntersectsCircle(from, to, column.position, effectiveRadius)) {
      return false;
    }
  }

  return true;
}

/**
 * Build a visibility graph from start to end, avoiding columns and walls
 */
export function buildVisibilityGraph(
  start: Point2D,
  end: Point2D,
  columns: CircleObstacle[],
  walls: WallSegment[]
): { nodes: VisibilityNode[]; edges: VisibilityEdge[] } {
  const nodes: VisibilityNode[] = [];

  // Add start and end nodes
  nodes.push({ id: 'start', position: start, type: 'start' });
  nodes.push({ id: 'end', position: end, type: 'end' });

  // Add tangent points around each column (with 45cm offset)
  for (const column of columns) {
    const effectiveRadius = column.radius + COLUMN_OFFSET;
    const tangentPoints = calculateTangentPoints(column.position, effectiveRadius);

    tangentPoints.forEach((p, i) => {
      nodes.push({
        id: `col-${column.id}-${i}`,
        position: p,
        type: 'obstacle',
      });
    });
  }

  // Build edges for all visible connections
  const edges: VisibilityEdge[] = [];

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const nodeA = nodes[i]!;
      const nodeB = nodes[j]!;

      if (isVisible(nodeA.position, nodeB.position, columns, walls)) {
        const dist = distance2D(nodeA.position, nodeB.position);
        edges.push({ from: nodeA.id, to: nodeB.id, distance: dist });
      }
    }
  }

  return { nodes, edges };
}

/**
 * Find shortest path using Dijkstra's algorithm
 */
export function findShortestPath(
  graph: { nodes: VisibilityNode[]; edges: VisibilityEdge[] }
): Point2D[] {
  const { nodes, edges } = graph;

  if (nodes.length < 2) return [];

  // Build adjacency list
  const adjacency = new Map<string, Array<{ to: string; distance: number }>>();
  for (const node of nodes) {
    adjacency.set(node.id, []);
  }
  for (const edge of edges) {
    adjacency.get(edge.from)?.push({ to: edge.to, distance: edge.distance });
    adjacency.get(edge.to)?.push({ to: edge.from, distance: edge.distance });
  }

  // Dijkstra
  const distances = new Map<string, number>();
  const previous = new Map<string, string | null>();
  const unvisited = new Set<string>();

  for (const node of nodes) {
    distances.set(node.id, Infinity);
    previous.set(node.id, null);
    unvisited.add(node.id);
  }
  distances.set('start', 0);

  while (unvisited.size > 0) {
    // Find node with smallest distance
    let current: string | null = null;
    let minDist = Infinity;
    for (const id of unvisited) {
      const dist = distances.get(id) ?? Infinity;
      if (dist < minDist) {
        minDist = dist;
        current = id;
      }
    }

    if (current === null || current === 'end') break;

    unvisited.delete(current);

    const neighbors = adjacency.get(current) ?? [];
    for (const { to, distance } of neighbors) {
      if (!unvisited.has(to)) continue;

      const alt = (distances.get(current) ?? Infinity) + distance;
      if (alt < (distances.get(to) ?? Infinity)) {
        distances.set(to, alt);
        previous.set(to, current);
      }
    }
  }

  // Reconstruct path
  const path: Point2D[] = [];
  let current: string | null = 'end';

  while (current !== null) {
    const node = nodes.find(n => n.id === current);
    if (node) {
      path.unshift(node.position);
    }
    current = previous.get(current) ?? null;
  }

  return path;
}

/**
 * Calculate the optimal evacuation path from start to end, avoiding columns
 */
export function calculateEvacuationPath(
  start: Point2D,
  end: Point2D,
  columns: CircleObstacle[],
  walls: WallSegment[]
): Point2D[] {
  // If direct path is visible, use it
  if (isVisible(start, end, columns, walls)) {
    return [start, end];
  }

  // Build visibility graph and find shortest path
  const graph = buildVisibilityGraph(start, end, columns, walls);
  const path = findShortestPath(graph);

  // If no path found, return direct path as fallback
  if (path.length === 0) {
    return [start, end];
  }

  return path;
}

/**
 * Calculate total path length
 */
export function calculatePathLength(path: Point2D[]): number {
  let totalLength = 0;
  for (let i = 0; i < path.length - 1; i++) {
    totalLength += distance2D(path[i]!, path[i + 1]!);
  }
  return totalLength;
}

/**
 * Find nearest point on a path to a given point
 */
export function findNearestPointOnPath(point: Point2D, path: Point2D[]): Point2D {
  if (path.length === 0) return point;
  if (path.length === 1) return path[0]!;

  let nearest = path[0]!;
  let minDist = Infinity;

  for (let i = 0; i < path.length - 1; i++) {
    const segStart = path[i]!;
    const segEnd = path[i + 1]!;

    // Project point onto segment
    const dx = segEnd.x - segStart.x;
    const dy = segEnd.y - segStart.y;
    const lengthSq = dx * dx + dy * dy;

    let t = 0;
    if (lengthSq > 0) {
      t = Math.max(0, Math.min(1,
        ((point.x - segStart.x) * dx + (point.y - segStart.y) * dy) / lengthSq
      ));
    }

    const closest = {
      x: segStart.x + t * dx,
      y: segStart.y + t * dy,
    };

    const dist = distance2D(point, closest);
    if (dist < minDist) {
      minDist = dist;
      nearest = closest;
    }
  }

  return nearest;
}
