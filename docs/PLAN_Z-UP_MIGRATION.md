# 🗺️ Implementation Plan: Y-up → Z-up Koordinatensystem Migration

## Summary

**Was**: Umstellung des gesamten Koordinatensystems von three.js Y-up Standard auf BIM/IFC Z-up Standard.

**Warum**: IFC-Konformität, intuitivere Bearbeitung für BIM-Anwender, konsistente Import/Export-Daten.

**Ansatz**: Phasenweise Migration mit Verifikation nach jedem Schritt, beginnend bei den Grundlagen (Konstanten, Kamera) bis zu den abhängigen Komponenten (Meshes, Interaktion).

---

## 📁 File Changes Overview

| Kategorie | Neue Dateien | Modifizierte Dateien |
|-----------|--------------|---------------------|
| Typen & Konstanten | 0 | 2 |
| Kamera & View | 0 | 2 |
| Bodenebene & Grid | 0 | 1 |
| Element-Definitionen | 0 | 6 |
| Mesh-Rendering | 0 | 6 |
| Interaktion & Hooks | 0 | 5 |
| IFC Export | 0 | 1 |
| **Total** | **0** | **23** |

---

## 🔢 Implementation Steps

### Phase 1: Konstanten & Grundlagen (5 min)

#### Step 1.1: UP_VECTOR Konstante hinzufügen/anpassen
**Datei**: `src/types/geometry.ts`

```typescript
// Vorher (falls vorhanden):
export const UP_VECTOR = { x: 0, y: 1, z: 0 };

// Nachher:
/** Z-up Koordinatensystem (BIM/IFC Standard) */
export const UP_VECTOR: Vector3 = { x: 0, y: 0, z: 1 };

/** Bodenebenen-Normal (zeigt nach oben) */
export const GROUND_PLANE_NORMAL: Vector3 = { x: 0, y: 0, z: 1 };

/** 2D zu 3D Mapping Helper */
export const map2Dto3D = (point2D: Point2D, elevation: number = 0): Vector3 => ({
  x: point2D.x,
  y: point2D.y,
  z: elevation
});
```

**Verifikation**: TypeScript kompiliert ohne Fehler (`npm run typecheck`)

---

### Phase 2: Kamera & View (10 min)

#### Step 2.1: Canvas3D Kamera-Position
**Datei**: `src/components/editor/Canvas3D.tsx`

```typescript
// Vorher:
camera={{ position: [10, 10, 10], fov: 50 }}

// Nachher:
camera={{
  position: [10, 10, 10],  // Isometrisch von vorne-rechts-oben
  fov: 50,
  up: [0, 0, 1]  // Z-up explizit setzen
}}
```

#### Step 2.2: OrbitControls konfigurieren
**Datei**: `src/components/editor/Canvas3D.tsx` (oder wo OrbitControls verwendet wird)

```typescript
// OrbitControls muss Z-up respektieren
<OrbitControls
  makeDefault
  // Rotation um Z-Achse (Vertikale) einschränken
  minPolarAngle={0}
  maxPolarAngle={Math.PI / 2}
/>
```

#### Step 2.3: Beleuchtung anpassen
**Datei**: `src/components/editor/Canvas3D.tsx`

```typescript
// Vorher:
<directionalLight position={[10, 20, 10]} intensity={1} />

// Nachher (Sonne von oben-vorne):
<directionalLight position={[10, 10, 20]} intensity={1} />
```

#### Step 2.4: CameraController (falls vorhanden)
**Datei**: `src/components/editor/CameraController.tsx`

```typescript
// Vorher:
new THREE.Vector3(ZOOM_DISTANCE, ZOOM_DISTANCE * 0.6, ZOOM_DISTANCE)

// Nachher:
new THREE.Vector3(ZOOM_DISTANCE, ZOOM_DISTANCE, ZOOM_DISTANCE * 0.6)
```

**Verifikation**:
- App starten (`npm run dev`)
- Kamera schaut von schräg oben auf Szene
- Orbit-Rotation funktioniert (Maus-Drag)
- Keine Console-Errors

---

### Phase 3: Bodenebene & Grid (5 min)

#### Step 3.1: GroundPlane anpassen
**Datei**: `src/components/editor/GroundPlane.tsx`

```typescript
// Vorher:
<mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>

// Nachher (XY-Ebene ist horizontal in Z-up):
<mesh rotation={[0, 0, 0]} position={[0, 0, -0.01]}>
```

#### Step 3.2: Raycasting Plane
**Datei**: `src/components/editor/GroundPlane.tsx`

```typescript
// Vorher:
const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

// Nachher:
const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
```

**Verifikation**:
- Grid liegt horizontal
- Mausklicks auf Boden werden korrekt erkannt

---

### Phase 4: Element-Definitionen (20 min)

#### Step 4.1: Wall.ts
**Datei**: `src/bim/elements/Wall.ts`

```typescript
// Extrusion Direction (ca. Zeile 73-74)
// Vorher:
direction: { x: 0, y: 1, z: 0 }

// Nachher:
direction: { x: 0, y: 0, z: 1 }

// Position Mapping (ca. Zeile 76-77)
// Vorher:
position: { x: startPoint.x, y: 0, z: startPoint.y }

// Nachher:
position: { x: startPoint.x, y: startPoint.y, z: 0 }

// Rotation Quaternion (ca. Zeile 79-83)
// Vorher (Y-axis rotation):
rotation: {
  x: 0,
  y: Math.sin(angle / 2),
  z: 0,
  w: Math.cos(angle / 2)
}

// Nachher (Z-axis rotation):
rotation: {
  x: 0,
  y: 0,
  z: Math.sin(angle / 2),
  w: Math.cos(angle / 2)
}
```

#### Step 4.2: Door.ts
**Datei**: `src/bim/elements/Door.ts`

```typescript
// Position calculation (ca. Zeile 265)
// Vorher:
const z = startPoint.y + dy * positionOnWall;
return { x, y: 0, z, angle };

// Nachher:
const y = startPoint.y + dy * positionOnWall;
return { x, y, z: 0, angle };
```

#### Step 4.3: Slab.ts
**Datei**: `src/bim/elements/Slab.ts`

```typescript
// Position (ca. Zeile 59)
// Vorher:
position: { x: centroid.x, y: 0, z: centroid.y }

// Nachher:
position: { x: centroid.x, y: centroid.y, z: 0 }
```

#### Step 4.4: Column.ts
**Datei**: `src/bim/elements/Column.ts`

```typescript
// Position (ca. Zeile 111)
// Vorher:
position: { x: position.x, y: 0, z: position.y }

// Nachher:
position: { x: position.x, y: position.y, z: 0 }
```

#### Step 4.5: Furniture.ts
**Datei**: `src/bim/elements/Furniture.ts`

```typescript
// Rotation (ca. Zeile 109-114)
// Vorher (Y-axis):
rotation: {
  x: 0,
  y: Math.sin(rotation / 2),
  z: 0,
  w: Math.cos(rotation / 2)
}

// Nachher (Z-axis):
rotation: {
  x: 0,
  y: 0,
  z: Math.sin(rotation / 2),
  w: Math.cos(rotation / 2)
}
```

#### Step 4.6: Counter.ts
**Datei**: `src/bim/elements/Counter.ts`
- Prüfen ob Anpassungen nötig (sollte bereits teilweise Z-up kompatibel sein)

**Verifikation**: `npm run typecheck` erfolgreich

---

### Phase 5: Mesh-Rendering (25 min)

#### Step 5.1: WallMesh.tsx
**Datei**: `src/components/editor/meshes/WallMesh.tsx`

```typescript
// Position (ca. Zeile 136)
// Vorher:
position={[wallData.startPoint.x, 0, wallData.startPoint.y]}

// Nachher:
position={[wallData.startPoint.x, wallData.startPoint.y, 0]}

// Rotation (ca. Zeile 127)
// Vorher:
new Euler(0, -angle, 0, 'YXZ')

// Nachher:
new Euler(0, 0, -angle, 'XYZ')
```

#### Step 5.2: SlabMesh.tsx
**Datei**: `src/components/editor/meshes/SlabMesh.tsx`

```typescript
// Shape-Zeichnung (Y-Negierung entfernen)
// Vorher:
shape.moveTo(firstPoint.x, -firstPoint.y);
shape.lineTo(pt.x, -pt.y);

// Nachher:
shape.moveTo(firstPoint.x, firstPoint.y);
shape.lineTo(pt.x, pt.y);

// Position und Rotation (ca. Zeile 77-78)
// Vorher:
position={[0, -slabData.thickness, 0]}
rotation={[-Math.PI / 2, 0, 0]}

// Nachher:
position={[0, 0, 0]}
rotation={[0, 0, 0]}
```

#### Step 5.3: DoorMesh.tsx
**Datei**: `src/components/editor/meshes/DoorMesh.tsx`

```typescript
// Group Position (ca. Zeile 112)
// Vorher:
position={[transform.position.x, 0, transform.position.z]}

// Nachher:
position={[transform.position.x, transform.position.y, 0]}

// Rotation (ca. Zeile 113)
// Vorher:
rotation={new Euler(0, -transform.angle, 0)}

// Nachher:
rotation={new Euler(0, 0, -transform.angle)}

// Frame positions - Höhe auf Z-Achse verschieben
// Beispiel Zeile 120:
// Vorher:
position={[-hw - FRAME_WIDTH / 2, height / 2, 0]}

// Nachher:
position={[-hw - FRAME_WIDTH / 2, 0, height / 2]}
```

#### Step 5.4: ColumnMesh.tsx
**Datei**: `src/components/editor/meshes/ColumnMesh.tsx`

```typescript
// CylinderGeometry Rotation anpassen
// Nach Erstellung:
geometry.rotateX(Math.PI / 2);  // Zylinder steht auf Z-Achse

// Position (ca. Zeile 76)
// Vorher:
position={[placement.position.x, yOffset, placement.position.z]}

// Nachher:
position={[placement.position.x, placement.position.y, zOffset]}
```

#### Step 5.5: CounterMesh.tsx
**Datei**: `src/components/editor/meshes/CounterMesh.tsx`

```typescript
// Y-Negierung entfernen
// Vorher:
shape.moveTo(frontPath[0].x, -frontPath[0].y);

// Nachher:
shape.moveTo(frontPath[0].x, frontPath[0].y);

// Position und Rotation (ca. Zeile 160-161)
// Vorher:
position={[0, config.zOffset, 0]}
rotation={[-Math.PI / 2, 0, 0]}

// Nachher:
position={[0, 0, config.zOffset]}
rotation={[0, 0, 0]}
```

#### Step 5.6: FurnitureMesh.tsx (falls vorhanden)
- Gleiche Pattern wie andere Meshes

**Verifikation**:
- App starten
- Wand erstellen → steht vertikal auf Z=0
- Slab erstellen → liegt flach auf Z=0
- Säule erstellen → steht vertikal
- Theke erstellen → liegt/steht korrekt

---

### Phase 6: Interaktion & Hooks (20 min)

#### Step 6.1: TransformGizmo.tsx
**Datei**: `src/components/editor/TransformGizmo.tsx`

```typescript
// Ground Plane Normal (ca. Zeile 39)
// Vorher:
const groundPlane = new Plane(new Vector3(0, 1, 0), 0);

// Nachher:
const groundPlane = new Plane(new Vector3(0, 0, 1), 0);

// Delta-Berechnung für Drag (ca. Zeile 101-102)
// Vorher:
const dx = worldPoint.x - dragStartPointRef.current.x;
const dz = worldPoint.z - dragStartPointRef.current.z;

// Nachher:
const dx = worldPoint.x - dragStartPointRef.current.x;
const dy = worldPoint.y - dragStartPointRef.current.y;

// Alle dz → dy Änderungen in den Element-Updates
```

#### Step 6.2: useSnap.ts
**Datei**: `src/hooks/useSnap.ts`

```typescript
// Event Point Conversion (ca. Zeile 104-106)
// Vorher:
const rawPoint = { x: event.point.x, y: event.point.z };

// Nachher:
const rawPoint = { x: event.point.x, y: event.point.y };
```

#### Step 6.3: useWallPlacement.ts
**Datei**: `src/hooks/useWallPlacement.ts`
- Point-Mapping auf Z-up anpassen

#### Step 6.4: useSlabPlacement.ts
**Datei**: `src/hooks/useSlabPlacement.ts`
- Point-Mapping auf Z-up anpassen

#### Step 6.5: useColumnPlacement.ts / useCounterPlacement.ts
- Gleiche Pattern anpassen

**Verifikation**:
- Wand platzieren → Klick-Position korrekt
- Element verschieben → bewegt sich auf XY-Ebene
- Snapping funktioniert

---

### Phase 7: Geometrie-Utils & IFC Export (15 min)

#### Step 7.1: math.ts - Element Center Berechnung
**Datei**: `src/lib/geometry/math.ts`

```typescript
// getElementCenter() - alle Höhenberechnungen (ca. Zeile 495-557)
// Pattern:
// Vorher: y: pos.y + height / 2
// Nachher: z: pos.z + height / 2

// Vorher: z: (startPoint.y + endPoint.y) / 2
// Nachher: y: (startPoint.y + endPoint.y) / 2
```

#### Step 7.2: IfcExporter.ts - Position Mapping
**Datei**: `src/bim/ifc/IfcExporter.ts`

```typescript
// Column Position (ca. Zeile 852-854)
// Vorher:
const posX = column.placement.position.x;
const posY = column.placement.position.z;
const posZ = storey?.elevation ?? 0;

// Nachher:
const posX = column.placement.position.x;
const posY = column.placement.position.y;
const posZ = (storey?.elevation ?? 0) + column.placement.position.z;

// Furniture Position (ca. Zeile 975-977)
// Gleiches Pattern anwenden
```

**Verifikation**:
- IFC Export ausführen
- Exportierte Datei in BIM Viewer öffnen
- Elemente an korrekten Positionen

---

### Phase 8: Preview-Komponenten (10 min)

#### Step 8.1: Alle Preview-Komponenten
**Pattern für alle Preview-Dateien**:

```typescript
// Vorher:
position={[point.x, 0, point.y]}

// Nachher:
position={[point.x, point.y, 0]}
```

**Betroffene Dateien**:
- `src/components/editor/WallPreview.tsx` (falls vorhanden)
- `src/components/editor/SlabPreview.tsx`
- `src/components/editor/DoorPreview.tsx`
- `src/components/editor/ColumnPreview.tsx`
- `src/components/editor/CounterPreview.tsx`
- `src/components/editor/AssetPreview.tsx`

**Verifikation**:
- Vorschau beim Platzieren zeigt korrekte Position
- Keine visuellen Glitches

---

## 🧪 Test Plan

### Unit Tests
```bash
npm run test
```
- Geometrie-Funktionen testen
- Element-Erstellung testen

### Manuelle Tests

| Test | Erwartetes Ergebnis |
|------|---------------------|
| App starten | Kamera schaut von schräg oben, Grid horizontal |
| Orbit-Rotation | Rotation um Z-Achse (vertikale) |
| Wand erstellen | Wand steht vertikal, Basis auf Z=0 |
| Slab erstellen | Slab liegt flach auf Z=0 |
| Tür einfügen | Tür in Wand, steht vertikal |
| Säule erstellen | Säule steht vertikal |
| Element verschieben | Bewegung auf XY-Ebene |
| IFC Export | Datei öffnet korrekt in BIM Viewer |

### Integrationstests
```bash
npm run test:integration
```

---

## ⚠️ Risks & Mitigations

### Risk 1: Komplette 3D-Ansicht funktioniert nicht mehr
- **Wahrscheinlichkeit**: Mittel
- **Impact**: Hoch
- **Mitigation**: Phasenweise vorgehen, nach jeder Phase testen
- **Contingency**: Git reset auf letzte funktionierende Phase

### Risk 2: IFC Export produziert falsche Koordinaten
- **Wahrscheinlichkeit**: Mittel
- **Impact**: Hoch
- **Mitigation**: Export nach Phase 7 intensiv testen
- **Contingency**: IFC-Mapping-Logik isoliert korrigieren

### Risk 3: Interaktion (Drag, Snap) funktioniert nicht
- **Wahrscheinlichkeit**: Mittel
- **Impact**: Mittel
- **Mitigation**: Plane-Normal und Point-Mapping sorgfältig prüfen
- **Detection**: Manuelle Tests nach Phase 6
- **Contingency**: Hook-spezifische Fixes

### Risk 4: Performance-Regression
- **Wahrscheinlichkeit**: Niedrig
- **Impact**: Niedrig
- **Mitigation**: Keine zusätzlichen Berechnungen, nur Mapping-Änderungen

---

## 🔄 Rollback Plan

### Vollständiger Rollback
```bash
git stash  # Falls uncommitted changes
git reset --hard HEAD~[N]  # N = Anzahl der Commits
# ODER
git revert --no-commit HEAD~[N]..HEAD
git commit -m "revert: Z-up migration"
```

### Phasenweiser Rollback
Nach jeder Phase wird committed. Rollback auf spezifische Phase:
```bash
git log --oneline  # Phase-Commit finden
git reset --hard [commit-hash]
```

### Rollback-Trigger
- App startet nicht mehr
- 3D-Ansicht komplett schwarz/fehlerhaft
- Keine Elemente erstellbar
- IFC Export crasht

---

## ✅ Success Criteria

1. **Visuell**: Alle Elemente stehen/liegen korrekt orientiert
2. **Interaktion**: Platzieren, Verschieben, Snapping funktionieren
3. **Export**: IFC-Dateien zeigen korrekte Positionen in BIM-Viewer
4. **Performance**: Keine merkbare Verschlechterung
5. **Tests**: Alle bestehenden Tests grün
6. **TypeScript**: `npm run typecheck` ohne Fehler
7. **Lint**: `npm run lint` ohne Fehler

---

## 📋 Commit-Strategie

```bash
# Nach jeder Phase:
git add -A
git commit -m "refactor(coords): phase N - [beschreibung]"

# Beispiele:
git commit -m "refactor(coords): phase 1 - add Z-up constants"
git commit -m "refactor(coords): phase 2 - configure camera for Z-up"
git commit -m "refactor(coords): phase 3 - adjust ground plane"
git commit -m "refactor(coords): phase 4 - update BIM element definitions"
git commit -m "refactor(coords): phase 5 - update mesh rendering"
git commit -m "refactor(coords): phase 6 - fix interaction hooks"
git commit -m "refactor(coords): phase 7 - verify IFC export"
git commit -m "refactor(coords): phase 8 - update preview components"
```

---

## ⏱️ Geschätzte Gesamtzeit

| Phase | Zeit |
|-------|------|
| Phase 1: Konstanten | 5 min |
| Phase 2: Kamera & View | 10 min |
| Phase 3: Bodenebene | 5 min |
| Phase 4: Element-Definitionen | 20 min |
| Phase 5: Mesh-Rendering | 25 min |
| Phase 6: Interaktion | 20 min |
| Phase 7: IFC Export | 15 min |
| Phase 8: Previews | 10 min |
| **Testing & Fixes** | +30 min |
| **Total** | **~140 min** |

---

## 🚀 Start

Bereit zur Implementierung. Beginne mit Phase 1.
