# Fluchtwegssimulation Erweiterungsplan

## Zusammenfassung

Erweiterung der bestehenden Evakuierungssimulation um:
1. Treppen als vertikale Fluchtwege (Stockwerk-Verbindungen)
2. Spawn an der weitesten Ecke vom Ausgang
3. Grüne Fluchtlinien mit 45cm Säulenumgehung (Visibility Graph)
4. Verbesserte Stuck-Recovery zur grünen Linie
5. Multi-Stockwerk-Simulation

---

## Phase 1: Treppen in Raumgraph integrieren

### Änderungen in `useEvacuationStore.ts`

**Neue Interfaces:**
```typescript
interface StairConnection {
  stairId: string;
  position: Point3D;           // Fußpunkt der Treppe
  topPosition: Point3D;        // Kopfpunkt der Treppe
  bottomStoreyId: string;
  topStoreyId: string;
  connectsToSpace: string | null;  // Raum am jeweiligen Ende
}

interface RoomNode {
  spaceId: string;
  storeyId: string;
  elevation: number;
  doors: Array<{...}>;
  stairs: Array<{              // NEU
    stairId: string;
    position: Point3D;
    connectsToStorey: string;
    connectsToSpace: string | null;
    isDescending: boolean;     // true = führt nach unten (Richtung Ausgang)
  }>;
}
```

**Neue Funktion: `findStairConnections()`**
```typescript
function findStairConnections(
  stairs: BimElement[],
  spaces: BimElement[],
  storeys: StoreyInfo[]
): StairConnection[] {
  // 1. Für jede Treppe: bottom/top Position berechnen
  // 2. Prüfen welcher Raum am Fuß/Kopf liegt (isPointInPolygon)
  // 3. Return Array von StairConnections
}
```

**Erweiterte `buildRoomGraph()`:**
```typescript
function buildRoomGraph(
  spaces: BimElement[],
  doors: BimElement[],
  walls: BimElement[],
  stairs: BimElement[],        // NEU
  storeys: StoreyInfo[],       // NEU
  exitDoors: ExitDoor[]
): Map<string, RoomNode> {
  // 1. Bisherige Tür-Logik
  // 2. NEU: Treppen als vertikale Verbindungen hinzufügen
  // 3. Treppen die nach unten führen (Richtung EG) als bevorzugte Wege markieren
}
```

**Erweiterte `findPathToExit()`:**
- BFS über Räume UND Stockwerke
- Treppen als Waypoints einfügen
- Priorisierung: Abwärts-Treppen bevorzugen

### Dateien:
- `src/store/useEvacuationStore.ts` - Hauptänderungen
- `src/bim/elements/Stair.ts` - Helper für Treppenpositionen

---

## Phase 2: Spawn an weitester Ecke

### Neue Funktion: `findFarthestCorner()`

```typescript
function findFarthestCorner(
  polygon: Point2D[],
  exitPoints: Point2D[]  // Türen/Treppen die zum Ausgang führen
): Point2D {
  // 1. Für jeden Vertex des Raum-Polygons
  // 2. Berechne minimale Distanz zu allen Exit-Punkten
  // 3. Vertex mit maximaler minimaler Distanz = weiteste Ecke

  let farthestCorner = polygon[0];
  let maxMinDistance = 0;

  for (const vertex of polygon) {
    const minDistToExit = Math.min(
      ...exitPoints.map(exit => distance2D(vertex, exit))
    );
    if (minDistToExit > maxMinDistance) {
      maxMinDistance = minDistToExit;
      farthestCorner = vertex;
    }
  }

  return farthestCorner;
}
```

### Angepasste `generateSpawnPoints()`

```typescript
function generateSpawnPoints(
  polygon: Point2D[],
  count: number,
  elevation: number,
  exitPoints: Point2D[]  // NEU
): Point3D[] {
  const points: Point3D[] = [];

  // 1. ERSTE Person: An weitester Ecke spawnen
  const farthestCorner = findFarthestCorner(polygon, exitPoints);
  const firstSpawn = offsetFromCorner(farthestCorner, polygon, 0.3); // 30cm Offset
  points.push({ ...firstSpawn, z: elevation });

  // 2. WEITERE Personen: Random (wie bisher)
  while (points.length < count) {
    // Bestehende Random-Logik
  }

  return points;
}
```

---

## Phase 3: Visibility Graph für Säulenumgehung

### Neues Modul: `src/lib/geometry/visibilityGraph.ts`

```typescript
interface VisibilityNode {
  id: string;
  position: Point2D;
  type: 'corner' | 'obstacle' | 'start' | 'end';
}

interface VisibilityEdge {
  from: string;
  to: string;
  distance: number;
}

/**
 * Erstellt Visibility Graph mit 45cm Offset um Säulen
 */
export function buildVisibilityGraph(
  start: Point2D,
  end: Point2D,
  columns: CircleObstacle[],
  walls: WallSegment[]
): { nodes: VisibilityNode[], edges: VisibilityEdge[] } {
  const COLUMN_OFFSET = 0.45; // 45cm
  const nodes: VisibilityNode[] = [];

  // 1. Start und End als Nodes
  nodes.push({ id: 'start', position: start, type: 'start' });
  nodes.push({ id: 'end', position: end, type: 'end' });

  // 2. Für jede Säule: 4 Tangentenpunkte (mit 45cm Offset)
  for (const column of columns) {
    const tangentPoints = calculateTangentPoints(
      column.position,
      column.radius + COLUMN_OFFSET
    );
    tangentPoints.forEach((p, i) => {
      nodes.push({
        id: `col-${column.id}-${i}`,
        position: p,
        type: 'obstacle'
      });
    });
  }

  // 3. Edges: Alle sichtbaren Verbindungen (nicht durch Wände/Säulen)
  const edges: VisibilityEdge[] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (isVisible(nodes[i].position, nodes[j].position, columns, walls)) {
        edges.push({
          from: nodes[i].id,
          to: nodes[j].id,
          distance: distance2D(nodes[i].position, nodes[j].position)
        });
      }
    }
  }

  return { nodes, edges };
}

/**
 * Berechnet 4 Tangentenpunkte um einen Kreis
 */
function calculateTangentPoints(center: Point2D, radius: number): Point2D[] {
  // 4 Punkte im 45° Winkel (optimiert für diagonale Wege)
  return [
    { x: center.x + radius, y: center.y },
    { x: center.x, y: center.y + radius },
    { x: center.x - radius, y: center.y },
    { x: center.x, y: center.y - radius },
  ];
}

/**
 * Prüft ob Sichtlinie frei ist
 */
function isVisible(
  from: Point2D,
  to: Point2D,
  columns: CircleObstacle[],
  walls: WallSegment[]
): boolean {
  // 1. Gegen alle Wände prüfen (lineSegmentIntersection)
  for (const wall of walls) {
    if (lineSegmentsIntersect(from, to, wall.start, wall.end)) {
      return false;
    }
  }

  // 2. Gegen alle Säulen prüfen (Kreis-Linie-Intersection)
  for (const column of columns) {
    if (lineIntersectsCircle(from, to, column.position, column.radius + 0.45)) {
      return false;
    }
  }

  return true;
}

/**
 * Dijkstra auf Visibility Graph
 */
export function findShortestPath(
  graph: { nodes: VisibilityNode[], edges: VisibilityEdge[] }
): Point2D[] {
  // Standard Dijkstra Implementation
  // Return: Array von Punkten für den kürzesten Pfad
}
```

### Hilfsfunktionen:

```typescript
/**
 * Prüft ob Linie einen Kreis schneidet
 */
function lineIntersectsCircle(
  lineStart: Point2D,
  lineEnd: Point2D,
  circleCenter: Point2D,
  circleRadius: number
): boolean {
  // Closest point on line to circle center
  const nearest = nearestPointOnSegment(circleCenter, { start: lineStart, end: lineEnd });
  return distance2D(nearest.point, circleCenter) < circleRadius;
}

/**
 * Prüft ob zwei Liniensegmente sich schneiden
 */
function lineSegmentsIntersect(
  a1: Point2D, a2: Point2D,
  b1: Point2D, b2: Point2D
): boolean {
  // CCW orientation test
  const ccw = (A: Point2D, B: Point2D, C: Point2D) =>
    (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);

  return ccw(a1, b1, b2) !== ccw(a2, b1, b2) &&
         ccw(a1, a2, b1) !== ccw(a1, a2, b2);
}
```

---

## Phase 4: Grüne Fluchtlinie im 2D Canvas

### Neue Datenstruktur im Store:

```typescript
interface EvacuationRoute {
  spaceId: string;
  spaceName: string;
  farthestCorner: Point2D;
  pathPoints: Point2D[];       // Kompletter Pfad inkl. Säulenumgehung
  totalDistance: number;
  exitDoorId: string;
  storeyId: string;
}

interface EvacuationState {
  // ... bestehende Felder
  evacuationRoutes: Map<string, EvacuationRoute>;  // NEU: Pro Raum eine Route
}
```

### Neue Funktion: `calculateEvacuationRoutes()`

```typescript
function calculateEvacuationRoutes(
  spaces: BimElement[],
  doors: BimElement[],
  walls: BimElement[],
  columns: BimElement[],
  stairs: BimElement[],
  roomGraph: Map<string, RoomNode>
): Map<string, EvacuationRoute> {
  const routes = new Map<string, EvacuationRoute>();

  for (const space of spaces) {
    // 1. Finde Pfad zum Ausgang (über Räume/Stockwerke)
    const pathToExit = findPathToExit(space.id, roomGraph);
    if (pathToExit.length === 0) continue;

    // 2. Finde weiteste Ecke
    const exitPoints = pathToExit.map(wp => ({ x: wp.position.x, y: wp.position.y }));
    const farthestCorner = findFarthestCorner(space.spaceData.boundaryPolygon, exitPoints);

    // 3. Baue Visibility Graph für diesen Raum
    const roomColumns = columns.filter(c => isInSpace(c, space));
    const roomWalls = getWallsForSpace(walls, space);

    // 4. Berechne Pfad von weitester Ecke zur ersten Tür
    const firstDoor = pathToExit[0];
    const graph = buildVisibilityGraph(
      farthestCorner,
      { x: firstDoor.position.x, y: firstDoor.position.y },
      roomColumns,
      roomWalls
    );
    const pathInRoom = findShortestPath(graph);

    // 5. Füge Pfade durch weitere Räume hinzu
    const fullPath = [
      ...pathInRoom,
      ...pathToExit.slice(1).map(wp => ({ x: wp.position.x, y: wp.position.y }))
    ];

    routes.set(space.id, {
      spaceId: space.id,
      spaceName: space.name,
      farthestCorner,
      pathPoints: fullPath,
      totalDistance: calculatePathLength(fullPath),
      exitDoorId: pathToExit[pathToExit.length - 1].doorId,
      storeyId: space.parentId!,
    });
  }

  return routes;
}
```

### Canvas2D Rendering:

```typescript
// In Canvas2D.tsx

const renderEvacuationRoutes = () => {
  const { evacuationRoutes, isRunning } = useEvacuationStore();
  const { activeStoreyId } = useProjectStore();

  if (evacuationRoutes.size === 0) return null;

  const elements: JSX.Element[] = [];

  for (const [spaceId, route] of evacuationRoutes) {
    // Nur Routen des aktiven Stockwerks anzeigen
    if (route.storeyId !== activeStoreyId) continue;

    // Pfad-Punkte zu Screen-Koordinaten
    const screenPoints = route.pathPoints.flatMap(p => {
      const screen = worldToScreen(p.x, p.y);
      return [screen.x, screen.y];
    });

    // Grüne Linie
    elements.push(
      <Line
        key={`route-${spaceId}`}
        points={screenPoints}
        stroke="#00FF00"
        strokeWidth={2}
        opacity={0.8}
        lineCap="round"
        lineJoin="round"
      />
    );

    // Markierung an weitester Ecke
    const cornerScreen = worldToScreen(route.farthestCorner.x, route.farthestCorner.y);
    elements.push(
      <Circle
        key={`corner-${spaceId}`}
        x={cornerScreen.x}
        y={cornerScreen.y}
        radius={5}
        fill="#FF0000"
        stroke="#FFFFFF"
        strokeWidth={1}
      />
    );

    // Distanz-Label
    elements.push(
      <Text
        key={`dist-${spaceId}`}
        x={cornerScreen.x + 10}
        y={cornerScreen.y - 10}
        text={`${route.totalDistance.toFixed(1)}m`}
        fontSize={10}
        fill="#00FF00"
      />
    );
  }

  return <>{elements}</>;
};

// In Layer-Stack einfügen (nach Spaces, vor Dimensions)
<Layer listening={false}>
  {renderEvacuationRoutes()}
</Layer>
```

---

## Phase 5: Stuck-Recovery zur grünen Linie

### Angepasste Stuck-Logik:

```typescript
function handleStuckDetection(
  agent: EvacuationAgent,
  evacuationRoutes: Map<string, EvacuationRoute>
): void {
  const pos = agent.vehicle.position;
  const moveDistance = distance2D(agent.prevPosition, { x: pos.x, y: pos.y });

  if (moveDistance < STUCK.MOVEMENT_THRESHOLD) {
    agent.stuckFrames++;

    if (agent.stuckFrames > STUCK.FRAMES_LIMIT) {
      // NEU: Zur grünen Linie navigieren statt direkt zum Waypoint
      pushAgentToGreenLine(agent, evacuationRoutes);
      agent.stuckFrames = 0;
    }
  } else {
    agent.stuckFrames = 0;
  }

  agent.prevPosition = { x: pos.x, y: pos.y };
}

function pushAgentToGreenLine(
  agent: EvacuationAgent,
  evacuationRoutes: Map<string, EvacuationRoute>
): void {
  // 1. Finde den Raum in dem der Agent ist
  const currentSpace = findSpaceContainingPoint(
    { x: agent.position.x, y: agent.position.y },
    spaces
  );
  if (!currentSpace) return;

  // 2. Hole die grüne Linie für diesen Raum
  const route = evacuationRoutes.get(currentSpace.id);
  if (!route) return;

  // 3. Finde nächsten Punkt auf der grünen Linie
  const nearestOnLine = findNearestPointOnPath(
    { x: agent.position.x, y: agent.position.y },
    route.pathPoints
  );

  // 4. Bewege Agent Richtung grüne Linie
  const toLine = {
    x: nearestOnLine.x - agent.position.x,
    y: nearestOnLine.y - agent.position.y
  };
  const dist = Math.sqrt(toLine.x * toLine.x + toLine.y * toLine.y);

  if (dist > 0.1) {
    const vel = agent.vehicle.velocity;
    vel.x = (toLine.x / dist) * agent.vehicle.maxSpeed * 0.7;
    vel.y = (toLine.y / dist) * agent.vehicle.maxSpeed * 0.7;
  }
}

function findNearestPointOnPath(point: Point2D, path: Point2D[]): Point2D {
  let nearest = path[0];
  let minDist = Infinity;

  // Prüfe jeden Pfad-Abschnitt
  for (let i = 0; i < path.length - 1; i++) {
    const segment = { start: path[i], end: path[i + 1] };
    const result = nearestPointOnSegment(point, segment);

    if (result.distance < minDist) {
      minDist = result.distance;
      nearest = result.point;
    }
  }

  return nearest;
}
```

---

## Phase 6: Multi-Stockwerk & Raumwechsel

### Erweiterte Simulation:

```typescript
interface EvacuationAgent {
  // ... bestehende Felder
  currentStoreyId: string;     // NEU: Aktuelles Stockwerk
  currentSpaceId: string;      // NEU: Aktueller Raum
}

function updateAgentSpace(agent: EvacuationAgent, spaces: BimElement[]): void {
  const pos = { x: agent.position.x, y: agent.position.y };

  for (const space of spaces) {
    if (!space.spaceData?.boundaryPolygon) continue;

    if (isPointInPolygon(pos, space.spaceData.boundaryPolygon)) {
      if (agent.currentSpaceId !== space.id) {
        // Agent hat Raum gewechselt!
        const oldSpace = agent.currentSpaceId;
        agent.currentSpaceId = space.id;
        agent.currentStoreyId = space.parentId!;

        console.log(`Agent ${agent.id} wechselte von ${oldSpace} zu ${space.id}`);

        // Neue Bedingungen des Raums anwenden
        applyRoomConditions(agent, space);
      }
      return;
    }
  }
}

function applyRoomConditions(agent: EvacuationAgent, space: BimElement): void {
  // 1. Neue Wegpunkte für diesen Raum berechnen
  // 2. Path zur grünen Linie des neuen Raums aktualisieren
  // 3. Ggf. Geschwindigkeit anpassen (z.B. Treppen langsamer)
}
```

### Treppen-Traversierung:

```typescript
function handleStairTraversal(agent: EvacuationAgent, stairs: BimElement[]): void {
  const pos = { x: agent.position.x, y: agent.position.y };

  for (const stair of stairs) {
    if (!stair.stairData) continue;

    // Prüfe ob Agent am Fuß oder Kopf der Treppe ist
    const footPos = stair.placement.position;
    const headPos = getStairHeadPosition(stair);

    const distToFoot = distance2D(pos, footPos);
    const distToHead = distance2D(pos, headPos);

    const STAIR_TRIGGER_RADIUS = 0.5;

    if (distToFoot < STAIR_TRIGGER_RADIUS &&
        agent.currentStoreyId === stair.stairData.topStoreyId) {
      // Agent geht Treppe runter
      teleportAgentToStorey(agent, stair.stairData.bottomStoreyId, footPos);
    } else if (distToHead < STAIR_TRIGGER_RADIUS &&
               agent.currentStoreyId === stair.stairData.bottomStoreyId) {
      // Agent geht Treppe hoch (ungewöhnlich für Flucht, aber möglich)
      teleportAgentToStorey(agent, stair.stairData.topStoreyId, headPos);
    }
  }
}
```

---

## Implementierungsreihenfolge

| Phase | Aufgabe | Dateien | Geschätzte Komplexität |
|-------|---------|---------|------------------------|
| 1 | Treppen in Raumgraph | `useEvacuationStore.ts` | Mittel |
| 2 | Spawn an weitester Ecke | `useEvacuationStore.ts` | Einfach |
| 3 | Visibility Graph | `visibilityGraph.ts` (neu) | Hoch |
| 4 | Grüne Linie im Canvas | `Canvas2D.tsx`, `useEvacuationStore.ts` | Mittel |
| 5 | Stuck-Recovery | `useEvacuationStore.ts` | Einfach |
| 6 | Multi-Stockwerk | `useEvacuationStore.ts` | Mittel |

---

## Testszenarien

1. **Einzel-Stockwerk ohne Säulen**: Agent spawnt in weitester Ecke, grüne Linie zeigt direkten Weg
2. **Einzel-Stockwerk mit Säulen**: Grüne Linie umgeht Säulen mit 45cm Abstand
3. **Multi-Stockwerk**: Agent nutzt Treppe zum EG, dann zum Ausgang
4. **Stuck-Recovery**: Agent der steckenbleibt findet zur grünen Linie zurück
5. **Raumwechsel**: Agent übernimmt Bedingungen des neuen Raums

---

## Offene Entscheidungen

1. **Treppe als Linie oder Fläche?** - Empfehlung: Fußpunkt als Trigger-Kreis
2. **Performance bei vielen Räumen** - Visibility Graph vorberechnen, nicht pro Frame
3. **2D-Darstellung von Treppen-Routen** - Gestrichelte Linie für vertikale Verbindung?
