/**
 * Type declarations for Yuka - JavaScript library for AI in games
 * https://github.com/mugen87/yuka
 */

declare module 'yuka' {
  // Math
  export class Vector3 {
    x: number;
    y: number;
    z: number;
    constructor(x?: number, y?: number, z?: number);
    set(x: number, y: number, z: number): this;
    copy(v: Vector3): this;
    add(v: Vector3): this;
    sub(v: Vector3): this;
    multiplyScalar(s: number): this;
    divideScalar(s: number): this;
    length(): number;
    normalize(): this;
    clone(): Vector3;
    distanceTo(v: Vector3): number;
  }

  export class Matrix4 {
    elements: number[];
    constructor();
    copy(m: Matrix4): this;
    multiply(m: Matrix4): this;
    toArray(array?: number[], offset?: number): number[];
  }

  // Core
  export class GameEntity {
    uuid: string;
    name: string;
    active: boolean;
    children: GameEntity[];
    parent: GameEntity | null;
    neighbors: GameEntity[];
    neighborhoodRadius: number;
    updateNeighborhood: boolean;
    position: Vector3;
    rotation: Quaternion;
    scale: Vector3;
    forward: Vector3;
    up: Vector3;
    right: Vector3;
    velocity: Vector3;
    mass: number;
    maxSpeed: number;
    maxForce: number;
    maxTurnRate: number;
    boundingRadius: number;
    worldMatrix: Matrix4;

    constructor();
    start(): this;
    update(delta: number): this;
    setRenderComponent(renderComponent: unknown, callback: SyncCallback): this;
    add(entity: GameEntity): this;
    remove(entity: GameEntity): this;
  }

  export class MovingEntity extends GameEntity {
    constructor();
  }

  export class Vehicle extends MovingEntity {
    steering: SteeringManager;
    smoother: Smoother | null;

    constructor();
  }

  export type SyncCallback = (entity: GameEntity, renderComponent: unknown) => void;

  // Quaternion
  export class Quaternion {
    x: number;
    y: number;
    z: number;
    w: number;
    constructor(x?: number, y?: number, z?: number, w?: number);
    set(x: number, y: number, z: number, w: number): this;
    copy(q: Quaternion): this;
    fromEuler(x: number, y: number, z: number): this;
  }

  // Entity Manager
  export class EntityManager {
    entities: GameEntity[];

    constructor();
    add(entity: GameEntity): this;
    remove(entity: GameEntity): this;
    clear(): this;
    update(delta: number): this;
  }

  // Time
  export class Time {
    constructor();
    update(): this;
    getDelta(): number;
    getElapsed(): number;
    reset(): this;
  }

  // Steering
  export class SteeringManager {
    behaviors: SteeringBehavior[];

    constructor(owner: Vehicle);
    add(behavior: SteeringBehavior): this;
    remove(behavior: SteeringBehavior): this;
    clear(): this;
    calculate(delta: number, force: Vector3): Vector3;
  }

  export class SteeringBehavior {
    active: boolean;
    weight: number;

    constructor();
    calculate(vehicle: Vehicle, force: Vector3): Vector3;
  }

  export class SeekBehavior extends SteeringBehavior {
    target: Vector3;
    constructor(target?: Vector3);
  }

  export class FleeBehavior extends SteeringBehavior {
    target: Vector3;
    panicDistance: number;
    constructor(target?: Vector3, panicDistance?: number);
  }

  export class ArriveBehavior extends SteeringBehavior {
    target: Vector3;
    deceleration: number;
    tolerance: number;
    constructor(target?: Vector3, deceleration?: number, tolerance?: number);
  }

  export class PursuitBehavior extends SteeringBehavior {
    evader: Vehicle;
    predictionFactor: number;
    constructor(evader?: Vehicle, predictionFactor?: number);
  }

  export class EvadeBehavior extends SteeringBehavior {
    pursuer: Vehicle;
    panicDistance: number;
    predictionFactor: number;
    constructor(pursuer?: Vehicle, panicDistance?: number, predictionFactor?: number);
  }

  export class WanderBehavior extends SteeringBehavior {
    radius: number;
    distance: number;
    jitter: number;
    constructor(radius?: number, distance?: number, jitter?: number);
  }

  export class FollowPathBehavior extends SteeringBehavior {
    path: Path;
    nextWaypointDistance: number;
    constructor(path?: Path, nextWaypointDistance?: number);
  }

  export class OnPathBehavior extends SteeringBehavior {
    path: Path;
    radius: number;
    predictionFactor: number;
    constructor(path?: Path, radius?: number, predictionFactor?: number);
  }

  export class ObstacleAvoidanceBehavior extends SteeringBehavior {
    obstacles: GameEntity[];
    brakingWeight: number;
    dBoxMinLength: number;
    constructor(obstacles?: GameEntity[]);
  }

  export class SeparationBehavior extends SteeringBehavior {
    constructor();
  }

  export class AlignmentBehavior extends SteeringBehavior {
    constructor();
  }

  export class CohesionBehavior extends SteeringBehavior {
    constructor();
  }

  export class InterposeBehavior extends SteeringBehavior {
    entity1: GameEntity;
    entity2: GameEntity;
    deceleration: number;
    constructor(entity1?: GameEntity, entity2?: GameEntity, deceleration?: number);
  }

  export class OffsetPursuitBehavior extends SteeringBehavior {
    leader: Vehicle;
    offset: Vector3;
    constructor(leader?: Vehicle, offset?: Vector3);
  }

  // Path
  export class Path {
    loop: boolean;

    constructor();
    add(waypoint: Vector3): this;
    clear(): this;
    current(): Vector3;
    finished(): boolean;
    advance(): this;
  }

  // Smoother
  export class Smoother {
    constructor(count?: number);
    calculate(value: Vector3): Vector3;
  }

  // Navigation
  export class NavMesh {
    regions: NavMeshRegion[];

    constructor();
    fromPolygons(polygons: Polygon[]): this;
    findPath(from: Vector3, to: Vector3): Vector3[];
    getRandomRegion(): NavMeshRegion;
    getClosestRegion(point: Vector3): NavMeshRegion;
  }

  export class NavMeshRegion {
    centroid: Vector3;
    constructor();
  }

  export class NavMeshLoader {
    constructor();
    load(url: string, options?: Record<string, unknown>): Promise<NavMesh>;
  }

  export class Polygon {
    vertices: Vector3[];
    constructor();
    fromContour(points: Vector3[]): this;
  }
}
