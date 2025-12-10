/**
 * Evacuation Simulation Store
 *
 * Uses Yuka's FollowPathBehavior for pathfinding and SeparationBehavior for
 * realistic crowd queuing at doors.
 */

import { create } from 'zustand';
import * as YUKA from 'yuka';
import type { BimElement } from '@/types/bim';

// ============================================================================
// Constants
// ============================================================================

const COLLISION = {
  WALL_PUSH_DISTANCE: 0.35,
  WALL_PUSH_NEAR_DOOR: 0.15,
  WALL_PUSH_COOLDOWN: 0.1,
  OBSTACLE_MARGIN: 0.2,
  DOOR_PROXIMITY_THRESHOLD: 1.0,
  DOOR_GAP_MARGIN: 0.25,
} as const;

const AGENT = {
  NEIGHBORHOOD_RADIUS: 1.5,
  SPEED_VARIATION: 0.2,
  MAX_FORCE: 10,
  MASS: 1,
  PATH_ARRIVAL_RADIUS: 0.5,
  SEPARATION_WEIGHT: 2.0,
  PATH_FOLLOW_WEIGHT: 1.0,
  MIN_SPAWN_DISTANCE: 0.5,
  SPAWN_MARGIN: 0.4,
} as const;

const STUCK = {
  MOVEMENT_THRESHOLD: 0.02,
  FRAMES_LIMIT: 45,
  PUSH_COOLDOWN_FRAMES: 30,
  PUSH_SPEED_FACTOR: 0.7,
  MIN_PUSH_DISTANCE: 0.3,
} as const;

const EXIT = {
  DETECTION_RADIUS: 0.8,
  BACKUP_DETECTION_RADIUS: 1.0,
  WAYPOINT_REACH_DISTANCE: 0.8,
} as const;

// ============================================================================
// Types
// ============================================================================

interface Point2D {
  x: number;
  y: number;
}

interface Point3D extends Point2D {
  z: number;
}

interface Waypoint {
  position: Point3D;
  doorId: string;
  isExit: boolean;
}

export interface EvacuationAgent {
  id: string;
  vehicle: YUKA.Vehicle;
  waypoints: Waypoint[];
  currentWaypointIndex: number;
  hasExited: boolean;
  position: Point3D;
  rotation: number;
  prevPosition: Point2D;
  stuckFrames: number;
  pushCooldown: number;
}

export interface ExitDoor {
  id: string;
  position: Point3D;
  doorElement: BimElement;
}

interface WallSegment {
  start: Point2D;
  end: Point2D;
}

interface CircleObstacle {
  position: Point2D;
  radius: number;
}

interface SimulationStats {
  totalAgents: number;
  exitedAgents: number;
  elapsedTime: number;
}

interface EvacuationState {
  isRunning: boolean;
  agents: Map<string, EvacuationAgent>;
  exitDoors: ExitDoor[];
  wallSegments: WallSegment[];
  obstacles: CircleObstacle[];
  entityManager: YUKA.EntityManager;
  time: YUKA.Time;
  agentsPerSpace: number;
  agentSpeed: number;
  stats: SimulationStats;
}

interface EvacuationActions {
  startSimulation: (
    spaces: BimElement[],
    doors: BimElement[],
    walls: BimElement[],
    columns?: BimElement[],
    furniture?: BimElement[],
    counters?: BimElement[]
  ) => void;
  stopSimulation: () => void;
  update: (delta: number) => void;
  setAgentsPerSpace: (count: number) => void;
  setAgentSpeed: (speed: number) => void;
  reset: () => void;
}

// ============================================================================
// Geometry Helpers
// ============================================================================

function distance2D(a: Point2D, b: Point2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function normalize2D(dx: number, dy: number): Point2D {
  const len = Math.sqrt(dx * dx + dy * dy);
  return len > 0 ? { x: dx / len, y: dy / len } : { x: 0, y: 0 };
}

function isPointInPolygon(point: Point2D, polygon: Point2D[]): boolean {
  let inside = false;
  const n = polygon.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const pi = polygon[i]!;
    const pj = polygon[j]!;

    if (
      pi.y > point.y !== pj.y > point.y &&
      point.x < ((pj.x - pi.x) * (point.y - pi.y)) / (pj.y - pi.y) + pi.x
    ) {
      inside = !inside;
    }
  }

  return inside;
}

function pointToSegmentDistance(
  point: Point2D,
  segStart: Point2D,
  segEnd: Point2D
): { distance: number; normal: Point2D } {
  const dx = segEnd.x - segStart.x;
  const dy = segEnd.y - segStart.y;
  const lengthSq = dx * dx + dy * dy;

  const t = lengthSq > 0
    ? Math.max(0, Math.min(1, ((point.x - segStart.x) * dx + (point.y - segStart.y) * dy) / lengthSq))
    : 0;

  const closest = { x: segStart.x + t * dx, y: segStart.y + t * dy };
  const distDx = point.x - closest.x;
  const distDy = point.y - closest.y;
  const dist = Math.sqrt(distDx * distDx + distDy * distDy);

  const segLength = Math.sqrt(lengthSq);
  let normal = segLength > 0 ? { x: -dy / segLength, y: dx / segLength } : { x: 0, y: 1 };

  if (normal.x * distDx + normal.y * distDy < 0) {
    normal = { x: -normal.x, y: -normal.y };
  }

  return { distance: dist, normal };
}

// ============================================================================
// Door & Space Helpers
// ============================================================================

function getDoorPosition(door: BimElement, walls: BimElement[]): Point3D | null {
  if (!door.doorData) return null;

  const hostWall = walls.find(w => w.id === door.doorData?.hostWallId);
  if (!hostWall?.wallData) return null;

  const { startPoint, endPoint } = hostWall.wallData;
  const t = door.doorData.positionOnWall;

  return {
    x: startPoint.x + (endPoint.x - startPoint.x) * t,
    y: startPoint.y + (endPoint.y - startPoint.y) * t,
    z: hostWall.placement.position.z,
  };
}

function findConnectedSpaces(
  door: BimElement,
  walls: BimElement[],
  spaces: BimElement[]
): { space1: string | null; space2: string | null } {
  const nullResult = { space1: null, space2: null };

  if (!door.doorData) return nullResult;

  const hostWall = walls.find(w => w.id === door.doorData?.hostWallId);
  if (!hostWall?.wallData) return nullResult;

  const doorPos = getDoorPosition(door, walls);
  if (!doorPos) return nullResult;

  const { startPoint, endPoint } = hostWall.wallData;
  const wallDir = normalize2D(endPoint.x - startPoint.x, endPoint.y - startPoint.y);
  const normal = { x: -wallDir.y, y: wallDir.x };

  const checkDistance = 0.5;
  const side1 = { x: doorPos.x + normal.x * checkDistance, y: doorPos.y + normal.y * checkDistance };
  const side2 = { x: doorPos.x - normal.x * checkDistance, y: doorPos.y - normal.y * checkDistance };

  let space1Id: string | null = null;
  let space2Id: string | null = null;

  for (const space of spaces) {
    if (!space.spaceData?.boundaryPolygon) continue;
    if (isPointInPolygon(side1, space.spaceData.boundaryPolygon)) space1Id = space.id;
    if (isPointInPolygon(side2, space.spaceData.boundaryPolygon)) space2Id = space.id;
  }

  return { space1: space1Id, space2: space2Id };
}

function findExitDoors(doors: BimElement[], walls: BimElement[], spaces: BimElement[]): ExitDoor[] {
  const exits: ExitDoor[] = [];

  for (const door of doors) {
    if (!door.doorData) continue;

    const isExternal = door.properties
      .find(p => p.name === 'Pset_DoorCommon')
      ?.properties?.IsExternal === true;

    const { space1, space2 } = findConnectedSpaces(door, walls, spaces);
    const isBoundaryDoor = (space1 !== null) !== (space2 !== null);

    if (isExternal || isBoundaryDoor) {
      const doorPos = getDoorPosition(door, walls);
      if (doorPos) {
        exits.push({ id: door.id, position: doorPos, doorElement: door });
      }
    }
  }

  return exits;
}

// ============================================================================
// Room Graph & Pathfinding
// ============================================================================

interface RoomNode {
  spaceId: string;
  doors: Array<{
    doorId: string;
    position: Point3D;
    connectsTo: string | null;
    isExit: boolean;
  }>;
}

function buildRoomGraph(
  spaces: BimElement[],
  doors: BimElement[],
  walls: BimElement[],
  exitDoors: ExitDoor[]
): Map<string, RoomNode> {
  const graph = new Map<string, RoomNode>();
  const exitDoorIds = new Set(exitDoors.map(e => e.id));

  for (const space of spaces) {
    graph.set(space.id, { spaceId: space.id, doors: [] });
  }

  for (const door of doors) {
    if (!door.doorData) continue;

    const doorPos = getDoorPosition(door, walls);
    if (!doorPos) continue;

    const { space1, space2 } = findConnectedSpaces(door, walls, spaces);
    const isExit = exitDoorIds.has(door.id);

    const addDoorToSpace = (spaceId: string | null, connectsTo: string | null) => {
      if (!spaceId) return;
      const node = graph.get(spaceId);
      if (node) {
        node.doors.push({
          doorId: door.id,
          position: doorPos,
          connectsTo: isExit ? null : connectsTo,
          isExit,
        });
      }
    };

    addDoorToSpace(space1, space2);
    if (space2 !== space1) {
      addDoorToSpace(space2, space1);
    }
  }

  return graph;
}

function findPathToExit(startSpaceId: string, roomGraph: Map<string, RoomNode>): Waypoint[] {
  const startNode = roomGraph.get(startSpaceId);
  if (!startNode) return [];

  // Direct exit check
  for (const door of startNode.doors) {
    if (door.isExit) {
      return [{ position: door.position, doorId: door.doorId, isExit: true }];
    }
  }

  // BFS for shortest path
  const queue: Array<{ spaceId: string; path: Waypoint[] }> = [{ spaceId: startSpaceId, path: [] }];
  const visited = new Set<string>([startSpaceId]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentNode = roomGraph.get(current.spaceId);
    if (!currentNode) continue;

    for (const door of currentNode.doors) {
      const waypoint: Waypoint = {
        position: door.position,
        doorId: door.doorId,
        isExit: door.isExit,
      };
      const newPath = [...current.path, waypoint];

      if (door.isExit) return newPath;

      if (door.connectsTo && !visited.has(door.connectsTo)) {
        visited.add(door.connectsTo);
        queue.push({ spaceId: door.connectsTo, path: newPath });
      }
    }
  }

  return [];
}

// ============================================================================
// Obstacle Creation
// ============================================================================

function createWallSegments(walls: BimElement[], doors: BimElement[]): WallSegment[] {
  const segments: WallSegment[] = [];

  for (const wall of walls) {
    if (!wall.wallData) continue;

    const { startPoint, endPoint } = wall.wallData;
    const doorsOnWall = doors.filter(d => d.doorData?.hostWallId === wall.id);

    if (doorsOnWall.length === 0) {
      segments.push({ start: { x: startPoint.x, y: startPoint.y }, end: { x: endPoint.x, y: endPoint.y } });
      continue;
    }

    const wallLength = distance2D(startPoint, endPoint);
    const wallDx = endPoint.x - startPoint.x;
    const wallDy = endPoint.y - startPoint.y;

    const gaps = createDoorGaps(doorsOnWall, wallLength);
    addSegmentsBetweenGaps(segments, startPoint, wallDx, wallDy, gaps, endPoint);
  }

  return segments;
}

function createDoorGaps(doors: BimElement[], wallLength: number): Array<{ start: number; end: number }> {
  const sortedDoors = doors
    .filter(d => d.doorData)
    .map(d => {
      const pos = d.doorData!.positionOnWall;
      const halfWidth = (d.doorData!.width / 2 + COLLISION.DOOR_GAP_MARGIN) / wallLength;
      return {
        startFraction: Math.max(0, pos - halfWidth),
        endFraction: Math.min(1, pos + halfWidth),
      };
    })
    .sort((a, b) => a.startFraction - b.startFraction);

  // Merge overlapping gaps
  const mergedGaps: Array<{ start: number; end: number }> = [];
  for (const gap of sortedDoors) {
    const last = mergedGaps[mergedGaps.length - 1];
    if (!last || gap.startFraction > last.end) {
      mergedGaps.push({ start: gap.startFraction, end: gap.endFraction });
    } else {
      last.end = Math.max(last.end, gap.endFraction);
    }
  }

  return mergedGaps;
}

function addSegmentsBetweenGaps(
  segments: WallSegment[],
  startPoint: Point2D,
  wallDx: number,
  wallDy: number,
  gaps: Array<{ start: number; end: number }>,
  endPoint: Point2D
): void {
  let currentPos = 0;

  for (const gap of gaps) {
    if (gap.start > currentPos) {
      segments.push({
        start: { x: startPoint.x + wallDx * currentPos, y: startPoint.y + wallDy * currentPos },
        end: { x: startPoint.x + wallDx * gap.start, y: startPoint.y + wallDy * gap.start },
      });
    }
    currentPos = gap.end;
  }

  if (currentPos < 1) {
    segments.push({
      start: { x: startPoint.x + wallDx * currentPos, y: startPoint.y + wallDy * currentPos },
      end: { x: endPoint.x, y: endPoint.y },
    });
  }
}

function createObstaclesFromColumns(columns: BimElement[]): CircleObstacle[] {
  return columns
    .filter(col => col.columnData)
    .map(col => ({
      position: { x: col.placement.position.x, y: col.placement.position.y },
      radius: Math.max(col.columnData!.width, col.columnData!.depth) / 2 + 0.1,
    }));
}

function createObstaclesFromFurniture(furniture: BimElement[]): CircleObstacle[] {
  return furniture
    .filter(furn => furn.furnitureData)
    .map(furn => {
      const scale = furn.furnitureData!.scale || 1;
      const w = furn.furnitureData!.width * scale;
      const d = furn.furnitureData!.depth * scale;
      return {
        position: { x: furn.placement.position.x, y: furn.placement.position.y },
        radius: Math.sqrt(w * w + d * d) / 2 + 0.1,
      };
    });
}

function createSegmentsFromCounters(counters: BimElement[], segments: WallSegment[]): void {
  for (const counter of counters) {
    if (!counter.counterData?.path || counter.counterData.path.length < 2) continue;

    const path = counter.counterData.path;
    const depth = counter.counterData.depth || 0.6;

    for (let i = 0; i < path.length - 1; i++) {
      const p1 = path[i]!;
      const p2 = path[i + 1]!;

      // Front line
      segments.push({ start: { x: p1.x, y: p1.y }, end: { x: p2.x, y: p2.y } });

      // Back line (offset by depth)
      const dir = normalize2D(p2.x - p1.x, p2.y - p1.y);
      const normal = { x: -dir.y, y: dir.x };

      segments.push({
        start: { x: p1.x + normal.x * depth, y: p1.y + normal.y * depth },
        end: { x: p2.x + normal.x * depth, y: p2.y + normal.y * depth },
      });
    }
  }
}

// ============================================================================
// Agent Spawning
// ============================================================================

function generateSpawnPoints(polygon: Point2D[], count: number, elevation: number): Point3D[] {
  const points: Point3D[] = [];
  const bounds = getPolygonBounds(polygon);
  const margin = AGENT.SPAWN_MARGIN;

  const minX = bounds.minX + margin;
  const minY = bounds.minY + margin;
  const maxX = bounds.maxX - margin;
  const maxY = bounds.maxY - margin;

  let attempts = 0;
  const maxAttempts = count * 100;

  while (points.length < count && attempts < maxAttempts) {
    const x = minX + Math.random() * (maxX - minX);
    const y = minY + Math.random() * (maxY - minY);

    if (isPointInPolygon({ x, y }, polygon) && !isTooCloseToExisting(points, x, y)) {
      points.push({ x, y, z: elevation });
    }
    attempts++;
  }

  return points;
}

function getPolygonBounds(polygon: Point2D[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of polygon) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}

function isTooCloseToExisting(points: Point3D[], x: number, y: number): boolean {
  return points.some(p => distance2D(p, { x, y }) < AGENT.MIN_SPAWN_DISTANCE);
}

function createAgent(
  id: string,
  spawnPoint: Point3D,
  pathToExit: Waypoint[],
  speed: number,
  entityManager: YUKA.EntityManager
): EvacuationAgent {
  const vehicle = new YUKA.Vehicle();
  vehicle.maxSpeed = speed * (1 - AGENT.SPEED_VARIATION / 2 + Math.random() * AGENT.SPEED_VARIATION);
  vehicle.maxForce = AGENT.MAX_FORCE;
  vehicle.mass = AGENT.MASS;
  vehicle.position.set(spawnPoint.x, spawnPoint.y, spawnPoint.z);
  vehicle.updateNeighborhood = true;
  vehicle.neighborhoodRadius = AGENT.NEIGHBORHOOD_RADIUS;

  const path = new YUKA.Path();
  path.loop = false;
  for (const wp of pathToExit) {
    path.add(new YUKA.Vector3(wp.position.x, wp.position.y, wp.position.z));
  }

  const followPath = new YUKA.FollowPathBehavior(path, AGENT.PATH_ARRIVAL_RADIUS);
  followPath.weight = AGENT.PATH_FOLLOW_WEIGHT;
  vehicle.steering.add(followPath);

  const separation = new YUKA.SeparationBehavior();
  separation.weight = AGENT.SEPARATION_WEIGHT;
  vehicle.steering.add(separation);

  entityManager.add(vehicle);

  return {
    id,
    vehicle,
    waypoints: pathToExit,
    currentWaypointIndex: 0,
    hasExited: false,
    position: { ...spawnPoint },
    rotation: 0,
    prevPosition: { x: spawnPoint.x, y: spawnPoint.y },
    stuckFrames: 0,
    pushCooldown: 0,
  };
}

// ============================================================================
// Collision & Movement Helpers
// ============================================================================

function handleWallCollision(
  agent: EvacuationAgent,
  segments: WallSegment[],
  pushDistance: number,
  nearDoor: boolean
): void {
  const pos = agent.vehicle.position;

  for (const segment of segments) {
    const { distance, normal } = pointToSegmentDistance({ x: pos.x, y: pos.y }, segment.start, segment.end);

    if (distance < pushDistance) {
      const pushAmount = pushDistance - distance + 0.02;
      pos.x += normal.x * pushAmount;
      pos.y += normal.y * pushAmount;

      dampVelocityTowardNormal(agent.vehicle.velocity, normal, nearDoor ? 0.3 : 0.8);
    }
  }
}

function handleObstacleCollision(agent: EvacuationAgent, obstacles: CircleObstacle[]): void {
  const pos = agent.vehicle.position;

  for (const obstacle of obstacles) {
    const dx = pos.x - obstacle.position.x;
    const dy = pos.y - obstacle.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const minDist = obstacle.radius + COLLISION.OBSTACLE_MARGIN;

    if (dist < minDist && dist > 0.01) {
      const pushDist = minDist - dist + 0.02;
      pos.x += (dx / dist) * pushDist;
      pos.y += (dy / dist) * pushDist;

      const vel = agent.vehicle.velocity;
      const velDotDir = (vel.x * dx + vel.y * dy) / dist;
      if (velDotDir < 0) {
        vel.x -= (velDotDir * dx / dist) * 0.8;
        vel.y -= (velDotDir * dy / dist) * 0.8;
      }
    }
  }
}

function dampVelocityTowardNormal(vel: YUKA.Vector3, normal: Point2D, factor: number): void {
  const velDotNormal = vel.x * normal.x + vel.y * normal.y;
  if (velDotNormal < 0) {
    vel.x -= velDotNormal * normal.x * factor;
    vel.y -= velDotNormal * normal.y * factor;
  }
}

function handleStuckDetection(agent: EvacuationAgent): void {
  const pos = agent.vehicle.position;
  const moveDistance = distance2D(agent.prevPosition, { x: pos.x, y: pos.y });

  if (moveDistance < STUCK.MOVEMENT_THRESHOLD) {
    agent.stuckFrames++;

    if (agent.stuckFrames > STUCK.FRAMES_LIMIT) {
      pushAgentTowardWaypoint(agent);
      agent.stuckFrames = 0;
    }
  } else {
    agent.stuckFrames = 0;
  }

  agent.prevPosition = { x: pos.x, y: pos.y };
}

function pushAgentTowardWaypoint(agent: EvacuationAgent): void {
  const currentWp = agent.waypoints[agent.currentWaypointIndex];
  if (!currentWp) return;

  const pos = agent.vehicle.position;
  const toWp = { x: currentWp.position.x - pos.x, y: currentWp.position.y - pos.y };
  const dist = Math.sqrt(toWp.x * toWp.x + toWp.y * toWp.y);

  if (dist > STUCK.MIN_PUSH_DISTANCE) {
    const vel = agent.vehicle.velocity;
    vel.x = (toWp.x / dist) * agent.vehicle.maxSpeed * STUCK.PUSH_SPEED_FACTOR;
    vel.y = (toWp.y / dist) * agent.vehicle.maxSpeed * STUCK.PUSH_SPEED_FACTOR;
    agent.pushCooldown = STUCK.PUSH_COOLDOWN_FRAMES;
  }
}

function updateAgentRotation(agent: EvacuationAgent): void {
  const vel = agent.vehicle.velocity;
  if (vel.length() > 0.01) {
    agent.rotation = Math.atan2(vel.y, vel.x);
  }
}

function advanceWaypointIfReached(agent: EvacuationAgent): void {
  if (agent.currentWaypointIndex >= agent.waypoints.length - 1) return;

  const currentWp = agent.waypoints[agent.currentWaypointIndex];
  if (!currentWp) return;

  const pos = agent.vehicle.position;
  const dist = distance2D({ x: pos.x, y: pos.y }, currentWp.position);

  if (dist < EXIT.WAYPOINT_REACH_DISTANCE) {
    agent.currentWaypointIndex++;
  }
}

function checkExitReached(
  agent: EvacuationAgent,
  exitDoors: ExitDoor[],
  entityManager: YUKA.EntityManager
): boolean {
  const pos = agent.vehicle.position;

  // Check last waypoint (primary exit)
  const lastWp = agent.waypoints[agent.waypoints.length - 1];
  if (lastWp?.isExit) {
    const dist = distance2D({ x: pos.x, y: pos.y }, lastWp.position);
    if (dist < EXIT.DETECTION_RADIUS) {
      markAgentAsExited(agent, entityManager);
      return true;
    }
  }

  // Backup: check proximity to any exit door
  for (const exit of exitDoors) {
    const dist = distance2D({ x: pos.x, y: pos.y }, exit.position);
    if (dist < EXIT.BACKUP_DETECTION_RADIUS) {
      markAgentAsExited(agent, entityManager);
      return true;
    }
  }

  return false;
}

function markAgentAsExited(agent: EvacuationAgent, entityManager: YUKA.EntityManager): void {
  agent.hasExited = true;
  entityManager.remove(agent.vehicle);
}

function getNearestWaypointDistance(agent: EvacuationAgent): number {
  const pos = agent.vehicle.position;
  let minDist = Infinity;

  for (const wp of agent.waypoints) {
    const dist = distance2D({ x: pos.x, y: pos.y }, wp.position);
    if (dist < minDist) minDist = dist;
  }

  return minDist;
}

function calculateEffectivePushDistance(agent: EvacuationAgent): number {
  if (agent.pushCooldown > 0) {
    agent.pushCooldown--;
    return COLLISION.WALL_PUSH_COOLDOWN;
  }

  const nearDoor = getNearestWaypointDistance(agent) < COLLISION.DOOR_PROXIMITY_THRESHOLD;
  return nearDoor ? COLLISION.WALL_PUSH_NEAR_DOOR : COLLISION.WALL_PUSH_DISTANCE;
}

// ============================================================================
// Store
// ============================================================================

const initialStats: SimulationStats = { totalAgents: 0, exitedAgents: 0, elapsedTime: 0 };

export const useEvacuationStore = create<EvacuationState & EvacuationActions>((set, get) => ({
  isRunning: false,
  agents: new Map(),
  exitDoors: [],
  wallSegments: [],
  obstacles: [],
  entityManager: new YUKA.EntityManager(),
  time: new YUKA.Time(),
  agentsPerSpace: 5,
  agentSpeed: 1.5,
  stats: { ...initialStats },

  startSimulation: (spaces, doors, walls, columns = [], furniture = [], counters = []) => {
    const state = get();
    state.reset();

    const exitDoors = findExitDoors(doors, walls, spaces);
    if (exitDoors.length === 0) {
      console.warn('No exit doors found!');
      return;
    }

    const wallSegments = createWallSegments(walls, doors);
    const roomGraph = buildRoomGraph(spaces, doors, walls, exitDoors);

    const obstacles = [
      ...createObstaclesFromColumns(columns),
      ...createObstaclesFromFurniture(furniture),
    ];
    createSegmentsFromCounters(counters, wallSegments);

    console.log(`Found ${exitDoors.length} exits, ${wallSegments.length} segments, ${obstacles.length} obstacles`);

    const entityManager = new YUKA.EntityManager();
    const agents = new Map<string, EvacuationAgent>();
    let agentIndex = 0;

    for (const space of spaces) {
      if (!space.spaceData?.boundaryPolygon) continue;

      const pathToExit = findPathToExit(space.id, roomGraph);
      if (pathToExit.length === 0) {
        console.warn(`No path to exit from space ${space.name || space.id}`);
        continue;
      }

      const spawnPoints = generateSpawnPoints(
        space.spaceData.boundaryPolygon,
        state.agentsPerSpace,
        space.placement.position.z
      );

      for (const spawnPoint of spawnPoints) {
        const agentId = `agent-${agentIndex++}`;
        const agent = createAgent(agentId, spawnPoint, pathToExit, state.agentSpeed, entityManager);
        agents.set(agentId, agent);
      }
    }

    console.log(`Spawned ${agents.size} agents`);

    set({
      isRunning: true,
      agents,
      exitDoors,
      wallSegments,
      obstacles,
      entityManager,
      time: new YUKA.Time(),
      stats: { totalAgents: agents.size, exitedAgents: 0, elapsedTime: 0 },
    });
  },

  stopSimulation: () => set({ isRunning: false }),

  update: (delta) => {
    const state = get();
    if (!state.isRunning) return;

    state.entityManager.update(delta);

    let exitedCount = 0;
    const updatedAgents = new Map(state.agents);

    for (const [, agent] of updatedAgents) {
      if (agent.hasExited) {
        exitedCount++;
        continue;
      }

      const pushDistance = calculateEffectivePushDistance(agent);
      const nearDoor = getNearestWaypointDistance(agent) < COLLISION.DOOR_PROXIMITY_THRESHOLD;

      handleWallCollision(agent, state.wallSegments, pushDistance, nearDoor);
      handleObstacleCollision(agent, state.obstacles);

      agent.position = {
        x: agent.vehicle.position.x,
        y: agent.vehicle.position.y,
        z: agent.vehicle.position.z,
      };

      handleStuckDetection(agent);
      updateAgentRotation(agent);
      advanceWaypointIfReached(agent);

      if (checkExitReached(agent, state.exitDoors, state.entityManager)) {
        exitedCount++;
      }
    }

    set({
      agents: updatedAgents,
      stats: {
        ...state.stats,
        exitedAgents: exitedCount,
        elapsedTime: state.stats.elapsedTime + delta,
      },
    });

    if (exitedCount >= state.stats.totalAgents && state.stats.totalAgents > 0) {
      console.log(`All agents evacuated in ${state.stats.elapsedTime.toFixed(1)}s`);
      set({ isRunning: false });
    }
  },

  setAgentsPerSpace: (count) => set({ agentsPerSpace: Math.max(1, Math.min(50, count)) }),
  setAgentSpeed: (speed) => set({ agentSpeed: Math.max(0.5, Math.min(5, speed)) }),

  reset: () => {
    const state = get();
    for (const [, agent] of state.agents) {
      state.entityManager.remove(agent.vehicle);
    }

    set({
      isRunning: false,
      agents: new Map(),
      exitDoors: [],
      wallSegments: [],
      obstacles: [],
      entityManager: new YUKA.EntityManager(),
      time: new YUKA.Time(),
      stats: { ...initialStats },
    });
  },
}));
