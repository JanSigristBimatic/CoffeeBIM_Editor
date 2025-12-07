# IFC Import - Implementierungsplan

## Übersicht

Dieser Plan beschreibt die Implementierung eines IFC-Imports für den CoffeeBIM Editor unter Verwendung der bereits vorhandenen `web-ifc` Bibliothek.

---

## 1. Recherche-Zusammenfassung

### 1.1 web-ifc Import API

| Methode | Beschreibung |
|---------|--------------|
| `OpenModel(data: Uint8Array, settings?)` | Lädt IFC-Datei aus Bytes, gibt `modelID` zurück |
| `GetLineIDsWithType(modelID, type)` | Holt alle Express-IDs eines IFC-Typs |
| `GetLine(modelID, expressID, flatten?)` | Liest alle Attribute eines IFC-Elements |
| `GetFlatMesh(modelID, expressID)` | Extrahiert Geometrie eines Elements |
| `GetGeometry(modelID, geometryExpressID)` | Holt Vertex/Index-Daten |
| `GetVertexArray()` / `GetIndexArray()` | Konvertiert Geometrie zu Arrays |
| `CloseModel(modelID)` | Gibt Speicher frei |

### 1.2 Relevante IFC-Typ-Konstanten

```typescript
import * as WebIFC from 'web-ifc';

// Hierarchie
WebIFC.IFCPROJECT
WebIFC.IFCSITE
WebIFC.IFCBUILDING
WebIFC.IFCBUILDINGSTOREY

// Elemente
WebIFC.IFCWALL
WebIFC.IFCWALLSTANDARDCASE
WebIFC.IFCDOOR
WebIFC.IFCWINDOW
WebIFC.IFCCOLUMN
WebIFC.IFCSLAB
WebIFC.IFCFURNITURE
WebIFC.IFCFURNISHINGELEMENT
WebIFC.IFCBUILDINGELEMENTPROXY  // Counter

// Beziehungen
WebIFC.IFCRELAGGREGATES         // Hierarchie (Project→Site→Building→Storey)
WebIFC.IFCRELCONTAINEDINSPATIALSTRUCTURE  // Elemente in Storey
WebIFC.IFCRELVOIDSELEMENT       // Öffnung in Wand
WebIFC.IFCRELFILLSELEMENT       // Tür/Fenster füllt Öffnung
WebIFC.IFCRELDEFINESBYPROPERTIES  // Property Sets
```

### 1.3 Geometrie-Extraktion Workflow

```typescript
// 1. FlatMesh laden
const mesh = ifcApi.GetFlatMesh(modelID, expressID);

// 2. Geometrien iterieren
for (let i = 0; i < mesh.geometries.size(); i++) {
  const placedGeometry = mesh.geometries.get(i);

  // 3. Vertex/Index-Daten holen
  const geometry = ifcApi.GetGeometry(modelID, placedGeometry.geometryExpressID);
  const indices = ifcApi.GetIndexArray(geometry.GetIndexData(), geometry.GetIndexDataSize());
  const vertices = ifcApi.GetVertexArray(geometry.GetVertexData(), geometry.GetVertexDataSize());

  // 4. Transformation anwenden
  const transform = placedGeometry.flatTransformation; // 4x4 Matrix als Float64Array
  const color = placedGeometry.color; // {x: r, y: g, z: b, w: a}
}
```

---

## 2. Mapping: IFC → Internes Datenmodell

### 2.1 Hierarchie-Mapping

| IFC-Entität | Internes Modell |
|-------------|-----------------|
| `IfcProject` | `ProjectInfo` |
| `IfcSite` | `SiteInfo` |
| `IfcBuilding` | `BuildingInfo` |
| `IfcBuildingStorey` | `StoreyInfo` |

### 2.2 Element-Mapping

| IFC-Entität | `ElementType` | Spezifische Daten |
|-------------|---------------|-------------------|
| `IfcWall`, `IfcWallStandardCase` | `'wall'` | `WallData` |
| `IfcDoor` | `'door'` | `DoorData` |
| `IfcWindow` | `'window'` | `WindowData` |
| `IfcColumn` | `'column'` | `ColumnData` |
| `IfcSlab` | `'slab'` | `SlabData` |
| `IfcFurnishingElement`, `IfcFurniture` | `'furniture'` | `FurnitureData` |
| `IfcBuildingElementProxy` (ObjectType='Counter') | `'counter'` | `CounterData` |

### 2.3 Geometrie-Extraktion Strategien

#### Wände
- **Primär:** Aus `IfcExtrudedAreaSolid` → Start/End-Punkt, Dicke, Höhe rekonstruieren
- **Fallback:** Aus Bounding-Box der Geometrie → Start/End als Mittellinie

#### Türen & Fenster
- Host-Wand aus `IfcRelVoidsElement` / `IfcRelFillsElement` ermitteln
- Position aus Placement relativ zur Wand
- Dimensionen aus `OverallWidth` / `OverallHeight` Attributen

#### Säulen
- Position aus Placement
- Profil aus Geometrie (rechteckig oder rund)
- Höhe aus Extrusion

#### Möbel
- Geometrie als `MeshData` (vertices, indices) speichern
- Bounding-Box für `width`, `depth`, `height`
- Kategorie aus `ObjectType` oder Description

---

## 3. Implementierungsschritte

### Phase 1: Grundstruktur (Priorität: HOCH)

#### 3.1 `IfcImporter` Klasse erstellen
**Datei:** `src/bim/ifc/IfcImporter.ts`

```typescript
export class IfcImporter {
  private ifcApi: WebIFC.IfcAPI;
  private modelId: number = 0;

  async init(): Promise<void>;
  async import(data: Uint8Array): Promise<ImportResult>;

  // Hierarchie
  private parseProject(): ProjectInfo;
  private parseSite(): SiteInfo;
  private parseBuilding(): BuildingInfo;
  private parseStoreys(): StoreyInfo[];

  // Elemente
  private parseWalls(): BimElement[];
  private parseDoors(): BimElement[];
  private parseWindows(): BimElement[];
  private parseColumns(): BimElement[];
  private parseSlabs(): BimElement[];
  private parseFurniture(): BimElement[];

  // Hilfsfunktionen
  private getPropertySets(expressID: number): PropertySet[];
  private extractMeshData(expressID: number): MeshData;
  private getParentStoreyId(expressID: number): string | null;
}

export interface ImportResult {
  project: ProjectInfo;
  site: SiteInfo;
  building: BuildingInfo;
  storeys: StoreyInfo[];
  elements: BimElement[];
  warnings: string[];
}
```

#### 3.2 Hierarchie-Parser implementieren
1. `GetLineIDsWithType(IFCPROJECT)` → Project lesen
2. `IFCRELAGGREGATES` traversieren für Site → Building → Storeys
3. Express-ID zu UUID-Mapping erstellen

#### 3.3 Basis-Import-Funktion
**Datei:** `src/bim/ifc/import.ts`

```typescript
export async function importFromIfc(file: File): Promise<ImportResult> {
  const importer = new IfcImporter();
  await importer.init();

  const buffer = await file.arrayBuffer();
  const data = new Uint8Array(buffer);

  return await importer.import(data);
}
```

### Phase 2: Element-Parser (Priorität: HOCH)

#### 3.4 Wand-Parser
1. `GetLineIDsWithType(IFCWALL)` + `GetLineIDsWithType(IFCWALLSTANDARDCASE)`
2. Für jede Wand:
   - Placement auslesen → Position/Rotation
   - Geometrie analysieren für Start/End-Punkt, Dicke
   - Höhe aus Extrusion
   - `WallData` erstellen

#### 3.5 Tür/Fenster-Parser
1. Host-Wand über `IFCRELVOIDSELEMENT` → `IFCRELFILLSELEMENT` finden
2. Position relativ zur Wand berechnen (`positionOnWall`)
3. Dimensionen aus IFC-Attributen
4. `DoorData` / `WindowData` erstellen

#### 3.6 Säulen/Platten-Parser
- Direkte Geometrie-Extraktion
- Profil-Typ erkennen (rechteckig/rund)

### Phase 3: Geometrie & Möbel (Priorität: MITTEL)

#### 3.7 Generische Geometrie-Extraktion
```typescript
private extractMeshData(expressID: number): MeshData | null {
  const mesh = this.ifcApi.GetFlatMesh(this.modelId, expressID);
  if (mesh.geometries.size() === 0) return null;

  const allVertices: number[] = [];
  const allIndices: number[] = [];
  let indexOffset = 0;

  for (let i = 0; i < mesh.geometries.size(); i++) {
    const pg = mesh.geometries.get(i);
    const geom = this.ifcApi.GetGeometry(this.modelId, pg.geometryExpressID);

    const verts = this.ifcApi.GetVertexArray(geom.GetVertexData(), geom.GetVertexDataSize());
    const inds = this.ifcApi.GetIndexArray(geom.GetIndexData(), geom.GetIndexDataSize());

    // Transformation anwenden
    const transformed = this.applyTransform(verts, pg.flatTransformation);

    allVertices.push(...transformed);
    allIndices.push(...Array.from(inds).map(i => i + indexOffset));
    indexOffset += verts.length / 6; // 6 floats per vertex (xyz + normal)
  }

  return { vertices: allVertices, indices: allIndices };
}
```

#### 3.8 Möbel-Import
1. `IFCFURNISHINGELEMENT` + `IFCFURNITURE` laden
2. Geometrie als `MeshData` extrahieren
3. Bounding-Box berechnen
4. Kategorie aus `ObjectType` / `Description`

### Phase 4: Property Sets & Beziehungen (Priorität: MITTEL)

#### 3.9 Property Set Extraktion
```typescript
private getPropertySets(expressID: number): PropertySet[] {
  const psets: PropertySet[] = [];

  // IFCRELDEFINESBYPROPERTIES finden
  const relIds = this.ifcApi.GetLineIDsWithType(this.modelId, WebIFC.IFCRELDEFINESBYPROPERTIES);

  for (let i = 0; i < relIds.size(); i++) {
    const rel = this.ifcApi.GetLine(this.modelId, relIds.get(i));

    if (rel.RelatedObjects.some(ref => ref.value === expressID)) {
      const psetDef = this.ifcApi.GetLine(this.modelId, rel.RelatingPropertyDefinition.value);

      if (psetDef.type === WebIFC.IFCPROPERTYSET) {
        const properties: Record<string, string | number | boolean | null> = {};

        for (const propRef of psetDef.HasProperties) {
          const prop = this.ifcApi.GetLine(this.modelId, propRef.value);
          if (prop.NominalValue) {
            properties[prop.Name.value] = prop.NominalValue.value;
          }
        }

        psets.push({ name: psetDef.Name.value, properties });
      }
    }
  }

  return psets;
}
```

#### 3.10 Wand-Öffnungen zuordnen
- `IFCRELVOIDSELEMENT` parsen
- Öffnungen zu Wänden zuordnen
- Türen/Fenster mit Host-Wänden verknüpfen

### Phase 5: UI Integration (Priorität: HOCH)

#### 3.11 Import-Dialog Komponente
**Datei:** `src/components/dialogs/ImportIfcDialog.tsx`

- Datei-Auswahl (Drag & Drop + Button)
- Fortschrittsanzeige
- Vorschau der zu importierenden Elemente
- Optionen:
  - Bestehendes Projekt ersetzen / zusammenführen
  - Elemente filtern (nur Wände, nur Möbel, etc.)
- Warnungen anzeigen (nicht unterstützte Elemente)

#### 3.12 Toolbar-Integration
- "Import" Button in Toolbar
- Keyboard Shortcut: `Ctrl+I`

#### 3.13 Store-Integration
```typescript
// useProjectStore.ts
importProject: (result: ImportResult) => {
  set({
    project: result.project,
    site: result.site,
    building: result.building,
    storeys: result.storeys,
  });
};

// useElementStore.ts
importElements: (elements: BimElement[], replace: boolean) => {
  if (replace) {
    set({ elements: new Map(elements.map(e => [e.id, e])) });
  } else {
    set(state => {
      const newElements = new Map(state.elements);
      elements.forEach(e => newElements.set(e.id, e));
      return { elements: newElements };
    });
  }
};
```

---

## 4. Technische Herausforderungen

### 4.1 Koordinatensystem
- **IFC:** Y-up oder Z-up (variiert je nach Export-Software)
- **Intern:** Z-up
- **Lösung:** Koordinaten-Matrix aus `GetCoordinationMatrix()` auslesen und anwenden

### 4.2 Wand-Geometrie Rekonstruktion
**Problem:** IFC-Wände können verschiedene Geometrie-Repräsentationen haben:
- `IfcExtrudedAreaSolid` (ideal)
- `IfcFacetedBrep` (Mesh)
- `IfcBooleanResult` (mit Öffnungen)

**Lösung:**
1. Bevorzugt `SweptSolid` Repräsentation suchen
2. Fallback: Bounding-Box → Mittellinie als Wand-Achse
3. Warnung ausgeben wenn Rekonstruktion ungenau

### 4.3 UUID-Mapping
- IFC verwendet Express-IDs (Integer)
- Intern: UUIDs (String)
- **Lösung:** Neue UUIDs generieren, Mapping-Tabelle für Referenzen

### 4.4 Nicht unterstützte Elemente
**Aktuell nicht unterstützt:**
- `IfcStair`, `IfcRamp`
- `IfcSpace` (Räume)
- `IfcCurtainWall`
- Komplexe Geometrien (NURBS, CSG)

**Lösung:** Als Warnung ausgeben, optional als generisches Mesh importieren

---

## 5. Dateistruktur

```
src/bim/ifc/
├── index.ts              # Re-exports
├── IfcExporter.ts        # Bestehend
├── IfcImporter.ts        # NEU: Haupt-Import-Klasse
├── import.ts             # NEU: High-level Import-Funktion
├── geometry/
│   ├── meshExtractor.ts  # NEU: Geometrie-Extraktion
│   ├── wallReconstructor.ts  # NEU: Wand-Geometrie-Analyse
│   └── transformUtils.ts # NEU: Matrix-Operationen
└── parsers/
    ├── hierarchyParser.ts    # NEU: Project/Site/Building/Storey
    ├── wallParser.ts         # NEU: Wand-spezifisch
    ├── openingParser.ts      # NEU: Türen/Fenster
    ├── columnParser.ts       # NEU: Säulen
    ├── slabParser.ts         # NEU: Platten
    └── furnitureParser.ts    # NEU: Möbel

src/components/dialogs/
└── ImportIfcDialog.tsx   # NEU: Import-UI
```

---

## 6. Testfälle

### Unit Tests
```typescript
// Hierarchie-Parsing
test('parseProject returns valid ProjectInfo');
test('parseStoreys returns all storeys with correct elevation');

// Element-Parsing
test('parseWalls extracts start/end points correctly');
test('parseDoors links to host wall');
test('parseWindows calculates sillHeight');

// Geometrie
test('extractMeshData returns valid vertices/indices');
test('applyTransform handles rotation correctly');
```

### Integration Tests
```typescript
// Roundtrip
test('export then import preserves wall count');
test('export then import preserves door-wall relationships');
test('export then import preserves property sets');
```

### Testdateien
- Einfaches Modell: 1 Raum, 4 Wände, 1 Tür
- Komplexes Modell: Mehrere Stockwerke, Möbel
- Externe IFC-Dateien (Revit, ArchiCAD Export)

---

## 7. Zeitschätzung

| Phase | Aufwand | Abhängigkeiten |
|-------|---------|----------------|
| Phase 1: Grundstruktur | 4-6h | - |
| Phase 2: Element-Parser | 8-12h | Phase 1 |
| Phase 3: Geometrie & Möbel | 6-8h | Phase 1, 2 |
| Phase 4: Property Sets | 4-6h | Phase 1 |
| Phase 5: UI Integration | 4-6h | Phase 1-4 |
| Testing & Bugfixing | 6-8h | Alle |

**Gesamt:** ca. 32-46 Stunden

---

## 8. Nächste Schritte

1. [ ] `IfcImporter` Grundklasse erstellen
2. [ ] Hierarchie-Parser implementieren
3. [ ] Wand-Parser mit Geometrie-Rekonstruktion
4. [ ] Tür/Fenster-Parser mit Wand-Zuordnung
5. [ ] Import-Dialog UI
6. [ ] Tests schreiben
7. [ ] Dokumentation aktualisieren

---

## Quellen

- [ThatOpen/engine_web-ifc](https://github.com/ThatOpen/engine_web-ifc) - Offizielle web-ifc Library
- [Stack Overflow: Geometry Extraction](https://stackoverflow.com/questions/79111084/how-to-get-element-geometry-in-web-ifc)
- [IFC 4.3 Dokumentation](https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/)
