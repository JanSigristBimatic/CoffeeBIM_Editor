# Plan: Bemaßungssystem (Dimensions)

> **Status:** Geplant
> **Priorität:** Hoch (vor Raumerkennung)
> **Scope:** Automatische Bemaßungen für Wände, Räume, Geschosse

---

## 1. Übersicht

### Unterstützte Bemaßungen

| Typ | Element | Berechnung | Einheit |
|-----|---------|------------|---------|
| Wandlänge | `wall` | `distance(start, end)` | m |
| Wandhöhe | `wall` | `wallData.height` | m |
| Geschosshöhe | `storey` | `storey.height` | m |
| Raumfläche | `space` | Polygon-Shoelace | m² |
| Raumhöhe | `space` | `netHeight` oder Geschosshöhe | m |

### Anzeige

- **2D-Grundriss:** Maßlinien mit Text parallel zur Wand
- **3D-Ansicht:** Billboard-Sprites (immer zur Kamera ausgerichtet)
- **Toggle:** Ein Button schaltet alle Bemaßungen ein/aus

### IFC-Export

- **Qto Property Sets:** `Qto_WallBaseQuantities`, `Qto_SpaceBaseQuantities`
- **IfcAnnotation:** Geometrische Bemaßungslinien (optional)

---

## 2. Datenmodell

### Types (`src/types/dimensions.ts`)

```typescript
import type { Point2D, Vector3 } from './geometry';

/**
 * Bemaßungstypen
 */
export type DimensionType =
  | 'wall-length'
  | 'wall-height'
  | 'storey-height'
  | 'space-area'
  | 'space-height';

/**
 * Bemaßungsdaten
 */
export interface Dimension {
  /** Eindeutige ID */
  id: string;

  /** Typ der Bemaßung */
  type: DimensionType;

  /** Referenz auf das bemaßte Element */
  elementId: string;

  /** Berechneter numerischer Wert */
  value: number;

  /** Einheit */
  unit: 'm' | 'm²';

  /** Formatierter Anzeigetext */
  displayText: string;

  /** Position für 2D-Rendering */
  position2D: {
    /** Weltkoordinate X */
    x: number;
    /** Weltkoordinate Y */
    y: number;
    /** Abstand vom Element */
    offset: number;
    /** Rotation in Radiant */
    rotation: number;
  };

  /** Position für 3D-Rendering */
  position3D: Vector3;

  /** Start- und Endpunkt der Maßlinie (für lineare Bemaßungen) */
  measureLine?: {
    start: Point2D;
    end: Point2D;
  };
}

/**
 * Bemaßungs-Einstellungen
 */
export interface DimensionSettings {
  /** Anzeigeeinheit */
  unit: 'm' | 'cm' | 'mm';
  /** Dezimalstellen */
  precision: number;
  /** Schriftgröße in Pixel (2D) */
  fontSize2D: number;
  /** Schriftgröße in Metern (3D) */
  fontSize3D: number;
  /** Offset-Abstand vom Element */
  offsetDistance: number;
}

/**
 * Standard-Einstellungen
 */
export const DEFAULT_DIMENSION_SETTINGS: DimensionSettings = {
  unit: 'm',
  precision: 2,
  fontSize2D: 12,
  fontSize3D: 0.15,
  offsetDistance: 0.4,
};
```

---

## 3. Store-Erweiterung

### ViewStore (`src/store/useViewStore.ts`)

```typescript
// Neue Properties hinzufügen:

interface ViewState {
  // ... bestehende Properties

  /** Bemaßungen anzeigen */
  showDimensions: boolean;

  /** Bemaßungs-Einstellungen */
  dimensionSettings: DimensionSettings;
}

// Actions:
setShowDimensions: (show: boolean) => void;
toggleDimensions: () => void;
setDimensionSettings: (settings: Partial<DimensionSettings>) => void;
```

---

## 4. Berechnungs-Funktionen

### Datei: `src/lib/geometry/dimensions.ts`

```typescript
import type { Point2D, Vector3 } from '@/types/geometry';
import type { WallData, SpaceData } from '@/types/bim';
import type { Dimension, DimensionSettings } from '@/types/dimensions';

/**
 * Berechnet die Länge einer Wand
 */
export function calculateWallLength(wall: WallData): number {
  const dx = wall.endPoint.x - wall.startPoint.x;
  const dy = wall.endPoint.y - wall.startPoint.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Berechnet die Fläche eines Polygons (Shoelace-Formel)
 */
export function calculatePolygonArea(points: Point2D[]): number {
  if (points.length < 3) return 0;

  let area = 0;
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }

  return Math.abs(area / 2);
}

/**
 * Berechnet den Schwerpunkt (Centroid) eines Polygons
 */
export function calculatePolygonCentroid(points: Point2D[]): Point2D {
  if (points.length === 0) return { x: 0, y: 0 };

  let cx = 0;
  let cy = 0;

  for (const p of points) {
    cx += p.x;
    cy += p.y;
  }

  return {
    x: cx / points.length,
    y: cy / points.length,
  };
}

/**
 * Berechnet die Bemaßungs-Position für eine Wand
 * Platziert das Maß mittig, versetzt nach außen
 */
export function calculateWallDimensionPosition(
  wall: WallData,
  offsetDistance: number
): { position2D: Dimension['position2D']; position3D: Vector3; measureLine: Dimension['measureLine'] } {
  const { startPoint, endPoint, height } = wall;

  // Mittelpunkt
  const midX = (startPoint.x + endPoint.x) / 2;
  const midY = (startPoint.y + endPoint.y) / 2;

  // Richtungsvektor
  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;
  const length = Math.sqrt(dx * dx + dy * dy);

  if (length === 0) {
    return {
      position2D: { x: midX, y: midY, offset: 0, rotation: 0 },
      position3D: { x: midX, y: midY, z: height / 2 },
      measureLine: { start: startPoint, end: endPoint },
    };
  }

  // Normale (nach außen)
  const nx = -dy / length;
  const ny = dx / length;

  // Rotation der Wand
  const rotation = Math.atan2(dy, dx);

  return {
    position2D: {
      x: midX + nx * offsetDistance,
      y: midY + ny * offsetDistance,
      offset: offsetDistance,
      rotation,
    },
    position3D: {
      x: midX + nx * offsetDistance,
      y: midY + ny * offsetDistance,
      z: height / 2,
    },
    measureLine: {
      start: startPoint,
      end: endPoint,
    },
  };
}

/**
 * Formatiert einen Bemaßungswert
 */
export function formatDimensionValue(
  value: number,
  unit: 'm' | 'm²',
  precision: number
): string {
  return `${value.toFixed(precision)} ${unit}`;
}

/**
 * Generiert alle Bemaßungen für ein Element
 */
export function generateElementDimensions(
  element: BimElement,
  settings: DimensionSettings
): Dimension[] {
  const dimensions: Dimension[] = [];

  // Wand-Bemaßungen
  if (element.type === 'wall' && element.wallData) {
    const length = calculateWallLength(element.wallData);
    const pos = calculateWallDimensionPosition(element.wallData, settings.offsetDistance);

    dimensions.push({
      id: `dim-${element.id}-length`,
      type: 'wall-length',
      elementId: element.id,
      value: length,
      unit: 'm',
      displayText: formatDimensionValue(length, 'm', settings.precision),
      position2D: pos.position2D,
      position3D: pos.position3D,
      measureLine: pos.measureLine,
    });
  }

  // Raum-Bemaßungen
  if (element.type === 'space' && element.spaceData) {
    const { area, boundaryPolygon } = element.spaceData;
    const centroid = calculatePolygonCentroid(boundaryPolygon);

    dimensions.push({
      id: `dim-${element.id}-area`,
      type: 'space-area',
      elementId: element.id,
      value: area,
      unit: 'm²',
      displayText: formatDimensionValue(area, 'm²', 1), // 1 Dezimalstelle für Flächen
      position2D: {
        x: centroid.x,
        y: centroid.y,
        offset: 0,
        rotation: 0,
      },
      position3D: {
        x: centroid.x,
        y: centroid.y,
        z: 0.1, // Knapp über Boden
      },
    });
  }

  return dimensions;
}
```

---

## 5. Canvas2D Rendering

### In `src/components/editor/Canvas2D.tsx`

```tsx
// Konstanten
const DIMENSION_COLOR = '#0066cc';
const DIMENSION_LINE_COLOR = '#666666';

// Neue Render-Funktion
const renderDimensions = () => {
  if (!showDimensions) return null;

  const dimensionElements: JSX.Element[] = [];

  // Wand-Bemaßungen
  elements
    .filter((e) => e.type === 'wall' && e.wallData)
    .forEach((wall) => {
      const dim = renderWallLengthDimension(wall);
      if (dim) dimensionElements.push(dim);
    });

  // Raum-Bemaßungen
  elements
    .filter((e) => e.type === 'space' && e.spaceData)
    .forEach((space) => {
      const dim = renderSpaceAreaDimension(space);
      if (dim) dimensionElements.push(dim);
    });

  return <>{dimensionElements}</>;
};

// Wandlänge rendern
const renderWallLengthDimension = (wall: BimElement) => {
  if (!wall.wallData) return null;

  const { startPoint, endPoint } = wall.wallData;
  const length = calculateWallLength(wall.wallData);
  const pos = calculateWallDimensionPosition(wall.wallData, 0.4);

  const screenStart = worldToScreen(startPoint.x, startPoint.y);
  const screenEnd = worldToScreen(endPoint.x, endPoint.y);
  const screenMid = worldToScreen(pos.position2D.x, pos.position2D.y);

  // Text-Rotation (immer lesbar)
  let angleDeg = -pos.position2D.rotation * (180 / Math.PI);
  if (angleDeg > 90) angleDeg -= 180;
  if (angleDeg < -90) angleDeg += 180;

  // Offset-Punkte für Maßlinie
  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  const nx = -dy / len;
  const ny = dx / len;
  const offset = 0.4;

  const offsetStart = worldToScreen(
    startPoint.x + nx * offset,
    startPoint.y + ny * offset
  );
  const offsetEnd = worldToScreen(
    endPoint.x + nx * offset,
    endPoint.y + ny * offset
  );

  return (
    <Group key={`dim-wall-${wall.id}`}>
      {/* Hilfslinien (Extension Lines) */}
      <Line
        points={[screenStart.x, screenStart.y, offsetStart.x, offsetStart.y]}
        stroke={DIMENSION_LINE_COLOR}
        strokeWidth={0.5}
      />
      <Line
        points={[screenEnd.x, screenEnd.y, offsetEnd.x, offsetEnd.y]}
        stroke={DIMENSION_LINE_COLOR}
        strokeWidth={0.5}
      />

      {/* Maßlinie */}
      <Line
        points={[offsetStart.x, offsetStart.y, offsetEnd.x, offsetEnd.y]}
        stroke={DIMENSION_COLOR}
        strokeWidth={1}
      />

      {/* Endstriche */}
      <Line
        points={[
          offsetStart.x - 4,
          offsetStart.y - 4,
          offsetStart.x + 4,
          offsetStart.y + 4,
        ]}
        stroke={DIMENSION_COLOR}
        strokeWidth={1.5}
      />
      <Line
        points={[
          offsetEnd.x - 4,
          offsetEnd.y - 4,
          offsetEnd.x + 4,
          offsetEnd.y + 4,
        ]}
        stroke={DIMENSION_COLOR}
        strokeWidth={1.5}
      />

      {/* Maßtext */}
      <Text
        x={screenMid.x}
        y={screenMid.y}
        text={`${length.toFixed(2)}`}
        fontSize={12}
        fill={DIMENSION_COLOR}
        rotation={angleDeg}
        offsetX={15}
        offsetY={-3}
        fontFamily="Arial"
      />
    </Group>
  );
};

// Raumfläche rendern
const renderSpaceAreaDimension = (space: BimElement) => {
  if (!space.spaceData) return null;

  const { area, boundaryPolygon } = space.spaceData;
  const centroid = calculatePolygonCentroid(boundaryPolygon);
  const screenPos = worldToScreen(centroid.x, centroid.y);

  return (
    <Group key={`dim-space-${space.id}`}>
      {/* Hintergrund für bessere Lesbarkeit */}
      <Rect
        x={screenPos.x - 25}
        y={screenPos.y - 10}
        width={50}
        height={20}
        fill="rgba(255, 255, 255, 0.8)"
        cornerRadius={3}
      />
      {/* Flächentext */}
      <Text
        x={screenPos.x}
        y={screenPos.y}
        text={`${area.toFixed(1)} m²`}
        fontSize={14}
        fill={DIMENSION_COLOR}
        fontStyle="bold"
        align="center"
        offsetX={20}
        offsetY={6}
      />
    </Group>
  );
};

// In renderElements() Layer hinzufügen:
{/* Dimensions Layer */}
<Layer listening={false}>{renderDimensions()}</Layer>
```

---

## 6. 3D-Rendering (Billboard Sprites)

### Neue Komponente: `src/components/editor/meshes/DimensionSprite.tsx`

```tsx
import { Text, Billboard } from '@react-three/drei';
import type { Dimension } from '@/types/dimensions';

interface DimensionSpriteProps {
  dimension: Dimension;
  color?: string;
}

export function DimensionSprite({
  dimension,
  color = '#0066cc',
}: DimensionSpriteProps) {
  const { position3D, displayText, type } = dimension;

  // Unterschiedliche Darstellung je nach Typ
  const fontSize = type === 'space-area' ? 0.2 : 0.15;
  const backgroundColor = type === 'space-area' ? '#ffffff' : 'transparent';

  return (
    <Billboard
      position={[position3D.x, position3D.z, -position3D.y]} // Y/Z swap für three.js
      follow={true}
      lockX={false}
      lockY={false}
      lockZ={false}
    >
      <Text
        fontSize={fontSize}
        color={color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#ffffff"
      >
        {displayText}
      </Text>
    </Billboard>
  );
}
```

### In `SceneElements.tsx` integrieren

```tsx
import { DimensionSprite } from './meshes/DimensionSprite';
import { generateElementDimensions } from '@/lib/geometry/dimensions';

// In der Render-Funktion:
{showDimensions && elements.map((element) => {
  const dimensions = generateElementDimensions(element, dimensionSettings);
  return dimensions.map((dim) => (
    <DimensionSprite key={dim.id} dimension={dim} />
  ));
})}
```

---

## 7. Toolbar Toggle

### In `src/components/editor/Toolbar.tsx`

```tsx
import { Ruler } from 'lucide-react';

// Button hinzufügen:
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        variant={showDimensions ? 'default' : 'outline'}
        size="icon"
        onClick={() => toggleDimensions()}
        className={showDimensions ? 'bg-blue-600' : ''}
      >
        <Ruler className="h-4 w-4" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>
      <p>Bemaßungen {showDimensions ? 'ausblenden' : 'anzeigen'}</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

---

## 8. IFC-Export

### Qto Property Sets in `src/bim/ifc/IfcExporter.ts`

```typescript
/**
 * Erstellt Qto_WallBaseQuantities für eine Wand
 */
private createWallQuantities(wall: BimElement): void {
  if (!wall.wallData) return;

  const length = calculateWallLength(wall.wallData);
  const { height, thickness } = wall.wallData;
  const grossSideArea = length * height;
  const grossVolume = grossSideArea * thickness;

  // Netto-Werte (abzüglich Öffnungen)
  let openingArea = 0;
  for (const opening of wall.wallData.openings) {
    openingArea += opening.width * opening.height;
  }
  const netSideArea = grossSideArea - openingArea;
  const netVolume = netSideArea * thickness;

  const quantities = {
    Length: length,
    Height: height,
    Width: thickness,
    GrossSideArea: grossSideArea,
    NetSideArea: netSideArea,
    GrossVolume: grossVolume,
    NetVolume: netVolume,
  };

  this.createIfcElementQuantity(
    wall.id,
    'Qto_WallBaseQuantities',
    quantities
  );
}

/**
 * Erstellt Qto_SpaceBaseQuantities für einen Raum
 */
private createSpaceQuantities(space: BimElement): void {
  if (!space.spaceData) return;

  const { area, perimeter, netHeight } = space.spaceData;
  const height = netHeight ?? 3.0; // Fallback

  const quantities = {
    NetFloorArea: area,
    GrossFloorArea: area,
    NetPerimeter: perimeter,
    Height: height,
    NetVolume: area * height,
  };

  this.createIfcElementQuantity(
    space.id,
    'Qto_SpaceBaseQuantities',
    quantities
  );
}

/**
 * Erstellt IfcElementQuantity
 */
private createIfcElementQuantity(
  elementId: string,
  qtoName: string,
  quantities: Record<string, number>
): number {
  const quantityHandles: number[] = [];

  for (const [name, value] of Object.entries(quantities)) {
    // Bestimme Quantity-Typ basierend auf Name
    const isArea = name.includes('Area');
    const isVolume = name.includes('Volume');

    let quantityId: number;

    if (isArea) {
      quantityId = this.ifcApi.CreateIfcEntity(
        this.modelId,
        ifc.IFCQUANTITYAREA,
        this.createIfcLabel(name),
        null, // Description
        null, // Unit
        this.createIfcAreaMeasure(value),
        null  // Formula
      );
    } else if (isVolume) {
      quantityId = this.ifcApi.CreateIfcEntity(
        this.modelId,
        ifc.IFCQUANTITYVOLUME,
        this.createIfcLabel(name),
        null,
        null,
        this.createIfcVolumeMeasure(value),
        null
      );
    } else {
      // Length (default)
      quantityId = this.ifcApi.CreateIfcEntity(
        this.modelId,
        ifc.IFCQUANTITYLENGTH,
        this.createIfcLabel(name),
        null,
        null,
        this.createIfcLengthMeasure(value),
        null
      );
    }

    quantityHandles.push(quantityId);
  }

  // IfcElementQuantity erstellen
  const qtoId = this.ifcApi.CreateIfcEntity(
    this.modelId,
    ifc.IFCELEMENTQUANTITY,
    this.createIfcGloballyUniqueId(),
    this.ownerHistoryId,
    this.createIfcLabel(qtoName),
    null, // Description
    null, // MethodOfMeasurement
    quantityHandles
  );

  return qtoId;
}
```

### IfcAnnotation für Bemaßungslinien (optional)

```typescript
/**
 * Erstellt IfcAnnotation für eine Bemaßungslinie
 * (Optional - nicht alle Viewer unterstützen dies)
 */
private createDimensionAnnotation(dimension: Dimension): number | null {
  if (!dimension.measureLine) return null;

  const { start, end } = dimension.measureLine;

  // 1. IfcCartesianPoint für Start/End
  const startPointId = this.createIfcCartesianPoint2D(start.x, start.y);
  const endPointId = this.createIfcCartesianPoint2D(end.x, end.y);

  // 2. IfcPolyline
  const polylineId = this.ifcApi.CreateIfcEntity(
    this.modelId,
    ifc.IFCPOLYLINE,
    [startPointId, endPointId]
  );

  // 3. IfcGeometricCurveSet
  const curveSetId = this.ifcApi.CreateIfcEntity(
    this.modelId,
    ifc.IFCGEOMETRICCURVESET,
    [polylineId]
  );

  // 4. IfcShapeRepresentation
  const shapeRepId = this.ifcApi.CreateIfcEntity(
    this.modelId,
    ifc.IFCSHAPEREPRESENTATION,
    this.geometricRepresentationContextId,
    this.createIfcLabel('Annotation'),
    this.createIfcLabel('Annotation2D'),
    [curveSetId]
  );

  // 5. IfcProductDefinitionShape
  const productShapeId = this.ifcApi.CreateIfcEntity(
    this.modelId,
    ifc.IFCPRODUCTDEFINITIONSHAPE,
    null,
    null,
    [shapeRepId]
  );

  // 6. IfcAnnotation
  const annotationId = this.ifcApi.CreateIfcEntity(
    this.modelId,
    ifc.IFCANNOTATION,
    this.createIfcGloballyUniqueId(),
    this.ownerHistoryId,
    this.createIfcLabel(dimension.displayText),
    null, // Description
    this.createIfcLabel('Dimension'),
    null, // ObjectPlacement
    productShapeId
  );

  return annotationId;
}
```

---

## 9. Implementierungs-Reihenfolge

| # | Task | Datei(en) | Aufwand |
|---|------|-----------|---------|
| 1 | Types definieren | `src/types/dimensions.ts` | S |
| 2 | ViewStore erweitern | `src/store/useViewStore.ts` | S |
| 3 | Berechnungsfunktionen | `src/lib/geometry/dimensions.ts` | M |
| 4 | Canvas2D Bemaßungen | `src/components/editor/Canvas2D.tsx` | M |
| 5 | Toolbar Toggle | `src/components/editor/Toolbar.tsx` | S |
| 6 | 3D Billboard Sprites | `src/components/editor/meshes/DimensionSprite.tsx` | M |
| 7 | SceneElements Integration | `src/components/editor/SceneElements.tsx` | S |
| 8 | IFC Qto Export | `src/bim/ifc/IfcExporter.ts` | L |
| 9 | IFC Annotation (optional) | `src/bim/ifc/IfcExporter.ts` | M |

**Legende:** S = Small (< 1h), M = Medium (1-2h), L = Large (2-4h)

---

## 10. Testfälle

```typescript
// Unit Tests
describe('Dimensions', () => {
  test('calculateWallLength returns correct length', () => {
    const wall: WallData = {
      startPoint: { x: 0, y: 0 },
      endPoint: { x: 3, y: 4 },
      thickness: 0.2,
      height: 3,
      openings: [],
    };
    expect(calculateWallLength(wall)).toBe(5);
  });

  test('calculatePolygonArea returns correct area for rectangle', () => {
    const rect = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 3 },
      { x: 0, y: 3 },
    ];
    expect(calculatePolygonArea(rect)).toBe(12);
  });

  test('formatDimensionValue formats correctly', () => {
    expect(formatDimensionValue(5.678, 'm', 2)).toBe('5.68 m');
    expect(formatDimensionValue(12.5, 'm²', 1)).toBe('12.5 m²');
  });
});

// Integration Tests
describe('IFC Qto Export', () => {
  test('wall export includes Qto_WallBaseQuantities', async () => {
    // Create wall, export IFC, parse and verify Qto
  });

  test('space export includes Qto_SpaceBaseQuantities', async () => {
    // Create space, export IFC, parse and verify Qto
  });
});
```

---

## 11. Spätere Erweiterungen (Out of Scope)

- [ ] Manuelle Bemaßungen (Benutzer platziert selbst)
- [ ] Kettenbemaßungen
- [ ] Höhenkoten
- [ ] Winkelbemaßungen
- [ ] Bemaßungsstile (DIN, SIA, etc.)
- [ ] Export als separate DWG/PDF-Pläne

---

## Referenzen

- [IFC4 IfcElementQuantity](https://standards.buildingsmart.org/IFC/RELEASE/IFC4/ADD2_TC1/HTML/schema/ifcproductextension/lexical/ifcelementquantity.htm)
- [IFC4 Qto_WallBaseQuantities](https://standards.buildingsmart.org/IFC/RELEASE/IFC4/ADD2_TC1/HTML/schema/ifcsharedbldgelements/qset/qto_wallbasequantities.htm)
- [IFC4 IfcAnnotation](https://standards.buildingsmart.org/IFC/RELEASE/IFC4/ADD2_TC1/HTML/schema/ifcproductextension/lexical/ifcannotation.htm)
