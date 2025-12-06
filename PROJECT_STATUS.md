# CoffeeBIM Editor - Projektstatus

> **Letzte Aktualisierung:** 2024-12-06

## Projektübersicht

Web-basierter BIM-Editor für Kaffeebars/Restaurants mit IFC-Export.
Zielgruppe: Nicht-BIM-Experten (intuitive UX).

---

## Tech Stack

| Bereich | Technologie | Status |
|---------|-------------|--------|
| Framework | React 18 + Vite + TypeScript | ✅ |
| 3D | three.js + @react-three/fiber + @react-three/drei | ✅ |
| IFC | web-ifc (client-side) | ⏳ |
| State | Zustand | ✅ |
| UI | shadcn/ui + Tailwind CSS | ✅ |
| Testing | Vitest | ⏳ |

---

## Implementierungsfortschritt

### Phase 0: Bootstrap ✅ ABGESCHLOSSEN

- [x] Vite-Projekt initialisiert
- [x] Core-Dependencies installiert
- [x] Konfiguration (vite, tsconfig, tailwind, eslint)
- [x] Verzeichnisstruktur angelegt
- [x] Basis-App mit 3D-Canvas

### Phase 1: Core Architecture ✅ ABGESCHLOSSEN

- [x] TypeScript-Typen definiert (`src/types/bim.ts`, `geometry.ts`, `tools.ts`)
- [x] Zustand Stores erstellt:
  - [x] `useProjectStore` - Project, Site, Building, Storey
  - [x] `useElementStore` - CRUD für BimElements
  - [x] `useSelectionStore` - Ausgewählte Element-IDs
  - [x] `useToolStore` - Aktives Werkzeug + Platzierungs-State
  - [x] `useViewStore` - 2D/3D Ansicht, Grid, Snap
- [x] 3D-Szene aufgebaut:
  - [x] Canvas3D mit R3F
  - [x] OrbitControls mit Limits
  - [x] Infinite Grid
  - [x] GizmoHelper (Orientierung)
  - [x] Beleuchtung + Environment

### Phase 2: MVP Implementation 🚧 IN ARBEIT

#### 2.1 Wand-Tool ✅ ABGESCHLOSSEN

| Feature | Status | Datei |
|---------|--------|-------|
| Klick-Klick-Platzierung | ✅ | `useWallPlacement.ts` |
| Wand-Preview | ✅ | `WallPreview.tsx` |
| Grid-Snapping (10cm) | ✅ | `useSnap.ts` |
| Endpoint-Snapping (30cm) | ✅ | `useSnap.ts` |
| Snap-Indikator | ✅ | `SnapIndicator.tsx` |
| Wand-Geometrie | ✅ | `WallMesh.tsx` |
| Ecken-Überlappung | ✅ | `WallMesh.tsx` |
| Parameter (Dicke, Höhe) | ✅ | `Wall.ts` |

**Bekannte Fixes:**
- Euler-Rotation mit 'YXZ' Order für korrekte Wand-Ausrichtung
- Negierter Winkel für intuitive Maussteuerung
- Shape als (Länge × Dicke) extrudiert nach Höhe

#### 2.2 Tür- & Fenster-Tool ⏳ AUSSTEHEND

| Feature | Status | Datei |
|---------|--------|-------|
| Tür auf Wand platzieren | ⏳ | `Door.ts`, `useDoorPlacement.ts` |
| Automatische Öffnung | ⏳ | `boolean.ts` |
| Fenster-Platzierung | ⏳ | `Window.ts` |
| Host-Wall-Referenz | ⏳ | |

#### 2.3 Säulen-Tool ⏳ AUSSTEHEND

| Feature | Status | Datei |
|---------|--------|-------|
| Einzelklick-Platzierung | ⏳ | `Column.ts` |
| Rechteckig/Rund | ⏳ | |

#### 2.4 IFC-Export ⏳ AUSSTEHEND (Kritisch!)

| Feature | Status | Datei |
|---------|--------|-------|
| web-ifc initialisieren | ⏳ | `export.ts` |
| IFC-Hierarchie | ⏳ | `hierarchy.ts` |
| IfcWall | ⏳ | `geometry.ts` |
| IfcDoor + Opening | ⏳ | |
| IfcWindow + Opening | ⏳ | |
| IfcColumn | ⏳ | |
| Blob + Download | ⏳ | |

#### 2.5 2D/3D Ansicht ⏳ AUSSTEHEND

| Feature | Status | Datei |
|---------|--------|-------|
| Orthografische Top-Down | ⏳ | `Canvas2D.tsx` |
| Umschalten 2D ↔ 3D | ⏳ | |

#### 2.6 UI-Komponenten 🚧 TEILWEISE

| Feature | Status | Datei |
|---------|--------|-------|
| Toolbar | ✅ | `Toolbar.tsx` |
| PropertyPanel | ✅ (Basic) | `PropertyPanel.tsx` |
| HierarchyPanel | ✅ (Basic) | `HierarchyPanel.tsx` |
| Keyboard-Shortcuts | ✅ | `useKeyboardShortcuts.ts` |
| Element bearbeiten | ⏳ | |
| Element löschen | ✅ | |

#### 2.7 PDF-Underlay ✅ ABGESCHLOSSEN

| Feature | Status | Datei |
|---------|--------|-------|
| PDF laden (pdf.js) | ✅ | `lib/pdf/pdfLoader.ts` |
| Kalibrierungs-Dialog | ✅ | `PdfCalibrationDialog.tsx` |
| Nullpunkt setzen | ✅ | Step 1 im Dialog |
| Rotation festlegen | ✅ | Step 2 im Dialog |
| Massstab kalibrieren | ✅ | Step 3 im Dialog |
| PDF als 3D-Plane | ✅ | `PdfUnderlay.tsx` |
| Sichtbarkeit toggle | ✅ | Toolbar + Shortcut `P` |
| Store | ✅ | `usePdfUnderlayStore.ts` |

### Phase 3: Testing & Polish ⏳ AUSSTEHEND

- [ ] Unit Tests für Geometrie
- [ ] Integration Tests für IFC
- [ ] Error-Boundaries
- [ ] Undo/Redo

---

## Aktuelle Dateistruktur

```
src/
├── App.tsx                          # Haupt-Layout
├── main.tsx                         # Entry Point
├── bim/
│   ├── elements/
│   │   └── Wall.ts                  # ✅ Wand-Factory
│   └── index.ts
├── components/
│   ├── editor/
│   │   ├── Canvas3D.tsx             # ✅ 3D-Szene
│   │   ├── Grid.tsx                 # ✅ Infinite Grid
│   │   ├── GroundPlane.tsx          # ✅ Interaktionsfläche
│   │   ├── SceneElements.tsx        # ✅ Element-Renderer
│   │   ├── SnapIndicator.tsx        # ✅ Snap-Visualisierung
│   │   ├── Toolbar.tsx              # ✅ Tool-Buttons
│   │   ├── WallPreview.tsx          # ✅ Wand-Vorschau
│   │   └── meshes/
│   │       └── WallMesh.tsx         # ✅ Wand-3D-Mesh
│   ├── panels/
│   │   ├── HierarchyPanel.tsx       # ✅ Projektbaum
│   │   └── PropertyPanel.tsx        # ✅ Eigenschaften
│   └── ui/                          # shadcn Komponenten
├── hooks/
│   ├── useKeyboardShortcuts.ts      # ✅ Tastatur
│   ├── useSnap.ts                   # ✅ Zentrales Snap-Modul
│   └── useWallPlacement.ts          # ✅ Wand-Platzierung
├── lib/
│   ├── geometry/
│   │   └── math.ts                  # ✅ Geometrie-Utils
│   └── utils.ts                     # cn() Helper
├── store/
│   ├── useElementStore.ts           # ✅ Element CRUD
│   ├── useProjectStore.ts           # ✅ Projekt-Hierarchie
│   ├── useSelectionStore.ts         # ✅ Selektion
│   ├── useToolStore.ts              # ✅ Werkzeuge
│   └── useViewStore.ts              # ✅ Ansicht/Grid
└── types/
    ├── bim.ts                       # ✅ BIM-Datenmodell
    ├── geometry.ts                  # ✅ 2D/3D Typen
    └── tools.ts                     # ✅ Tool-Typen
```

---

## Nächste Schritte (Priorität)

### Sofort

1. **Tür-Tool implementieren**
   - `src/bim/elements/Door.ts`
   - `src/hooks/useDoorPlacement.ts`
   - `src/components/editor/meshes/DoorMesh.tsx`
   - Host-Wall-Referenz im BimElement

2. **Öffnungen in Wänden**
   - CSG oder Shape-Holes für Durchbrüche
   - `src/lib/geometry/boolean.ts`

### Dann

3. **Fenster-Tool** (ähnlich wie Tür)

4. **Säulen-Tool**
   - Einfacher als Türen (keine Host-Wall)

5. **IFC-Export** (Kernfeature!)
   - web-ifc API verstehen
   - Minimal: IfcProject → IfcWall

### Optional/Später

- 2D-Ansicht
- Undo/Redo
- Property-Bearbeitung im Panel
- Unit Tests

---

## Bekannte Issues

| Issue | Beschreibung | Workaround |
|-------|-------------|------------|
| - | Aktuell keine bekannten Bugs | - |

---

## Keyboard Shortcuts

| Taste | Aktion |
|-------|--------|
| W | Wand-Tool |
| D | Tür-Tool |
| C | Säulen-Tool |
| F | Boden-Tool |
| V | Auswahl-Tool |
| G | Grid ein/aus |
| P | PDF Underlay ein/aus |
| Escape | Platzierung abbrechen |
| Delete | Element löschen |

---

## Dev Server

```bash
npm run dev
# http://localhost:5173 (oder 5174 wenn belegt)
```
