# CoffeeBIM Editor - Projektstatus

> **Letzte Aktualisierung:** 2025-12-07 (aktualisiert)

## Projektübersicht

Web-basierter BIM-Editor für Kaffeebars/Restaurants mit IFC-Export.
Zielgruppe: Nicht-BIM-Experten (intuitive UX).

---

## Tech Stack

| Bereich | Technologie | Status |
|---------|-------------|--------|
| Framework | React 18 + Vite + TypeScript | ✅ |
| 3D | three.js + @react-three/fiber + @react-three/drei | ✅ |
| IFC | web-ifc (client-side) | ✅ |
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

### Phase 2: MVP Implementation ✅ ABGESCHLOSSEN

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
| Öffnungen für Türen/Fenster | ✅ | `Wall.ts` (openings array) |
| PropertyPanel | ✅ | `WallProperties.tsx` |

#### 2.2 Tür-Tool ✅ ABGESCHLOSSEN

| Feature | Status | Datei |
|---------|--------|-------|
| Tür auf Wand platzieren | ✅ | `useDoorPlacement.ts` |
| Tür-Preview | ✅ | `DoorPreview.tsx` |
| Tür-Geometrie | ✅ | `DoorMesh.tsx` |
| Schwenk-Visualisierung | ✅ | `DoorSwingArc.tsx` |
| Host-Wall-Referenz | ✅ | `DoorData.hostWallId` |
| Abstand zu Wandkanten | ✅ | `OpeningCalculations.ts` |
| Türtypen (Single/Double/Sliding) | ✅ | `Door.ts` |
| Schwenkrichtung | ✅ | `DoorData.swingDirection` |
| PropertyPanel | ✅ | `DoorProperties.tsx` |
| ParameterPanel | ✅ | `DoorParameterPanel.tsx` |

#### 2.3 Fenster-Tool ✅ ABGESCHLOSSEN

| Feature | Status | Datei |
|---------|--------|-------|
| Fenster auf Wand platzieren | ✅ | `useWindowPlacement.ts` |
| Fenster-Preview | ✅ | `WindowPreview.tsx` |
| Fenster-Geometrie | ✅ | `WindowMesh.tsx` |
| Host-Wall-Referenz | ✅ | `WindowData.hostWallId` |
| Fenstertypen (Single/Double/Fixed) | ✅ | `Window.ts` |
| Brüstungshöhe | ✅ | `WindowData.sillHeight` |
| PropertyPanel | ✅ | `WindowProperties.tsx` |
| ParameterPanel | ✅ | `WindowParameterPanel.tsx` |

#### 2.4 Säulen-Tool ✅ ABGESCHLOSSEN

| Feature | Status | Datei |
|---------|--------|-------|
| Einzelklick-Platzierung | ✅ | `useColumnPlacement.ts` |
| Säulen-Preview | ✅ | `ColumnPreview.tsx` |
| Säulen-Geometrie | ✅ | `ColumnMesh.tsx` |
| Rechteckiges Profil | ✅ | `Column.ts` |
| Rundes Profil (16-Segment) | ✅ | `Column.ts` |
| PropertyPanel | ✅ | `ColumnProperties.tsx` |
| ParameterPanel | ✅ | `ColumnParameterPanel.tsx` |

#### 2.5 Boden/Decken-Tool ✅ ABGESCHLOSSEN

| Feature | Status | Datei |
|---------|--------|-------|
| Polygon-Platzierung | ✅ | `useSlabPlacement.ts` |
| Slab-Preview | ✅ | `SlabPreview.tsx` |
| Slab-Geometrie | ✅ | `SlabMesh.tsx` |
| Boden/Decken-Typen | ✅ | `SlabData.slabType` |
| Flächenberechnung | ✅ | `Slab.ts` |
| PropertyPanel | ✅ | `SlabProperties.tsx` |

#### 2.6 Theken-Tool ✅ ABGESCHLOSSEN

| Feature | Status | Datei |
|---------|--------|-------|
| Pfad-Platzierung | ✅ | `useCounterPlacement.ts` |
| Counter-Preview | ✅ | `CounterPreview.tsx` |
| Counter-Geometrie | ✅ | `CounterMesh.tsx` |
| Path-Offset-Algorithmus | ✅ | `pathOffset.ts` |
| Theken-Typen (Standard/Bar/Service) | ✅ | `Counter.ts` |
| Überhang & Fussraste | ✅ | `CounterData` |
| PropertyPanel | ✅ | `CounterProperties.tsx` |
| ParameterPanel | ✅ | `CounterParameterPanel.tsx` |
| Deutsche Property-Sets | ✅ | `Counter.ts` |

#### 2.7 Möbel/Asset-System ✅ ABGESCHLOSSEN

| Feature | Status | Datei |
|---------|--------|-------|
| Asset-Katalog (13 vordefiniert) | ✅ | `assetCatalog.ts` |
| 3D-Import (GLB/GLTF/OBJ) | ✅ | `ImportModelDialog.tsx` |
| Asset-Platzierung | ✅ | `useAssetPlacement.ts` |
| Asset-Preview | ✅ | `AssetPreview.tsx` |
| Asset-Dropdown | ✅ | `AssetDropdown.tsx` |
| Möbel-Geometrie | ✅ | `FurnitureMesh.tsx` |
| PropertyPanel | ✅ | `FurnitureProperties.tsx` |
| Gastronomie-Property-Sets | ✅ | `AssetPropertySets.tsx` |

**Asset-Kategorien (13 GLB-Dateien):**
- Kaffeemaschinen: La Marzocco Gross, La Marzocco Strada (2)
- Mühlen: Kaffeemühle (1)
- Geräte: Spülmaschine, Kühlschrank gross, Kühlschrank mittel (3)
- Möbel: Tisch, Stuhl, Barhocker, Sofa, Sofa L-Form, Regal (6)
- Beleuchtung: Deckenlampe (1)

#### 2.8 IFC-Export ✅ ABGESCHLOSSEN

| Feature | Status | Datei |
|---------|--------|-------|
| web-ifc initialisieren | ✅ | `IfcExporter.ts` |
| IFC 2x3 Schema | ✅ | `IfcExporter.ts` |
| Z-up Koordinatensystem | ✅ | `IfcExporter.ts` |
| IfcProject/Site/Building/Storey | ✅ | `IfcExporter.ts` |
| IfcWallStandardCase | ✅ | `IfcExporter.ts` |
| IfcDoor + IfcOpeningElement | ✅ | `IfcExporter.ts` |
| IfcWindow + IfcOpeningElement | ✅ | `IfcExporter.ts` |
| IfcColumn (rechteckig/rund) | ✅ | `IfcExporter.ts` |
| IfcSlab | ✅ | `IfcExporter.ts` |
| IfcBuildingElementProxy (Theken) | ✅ | `IfcExporter.ts` |
| IfcFurnishingElement (Möbel) | ✅ | `IfcExporter.ts` |
| IfcFacetedBrep (Mesh-Export) | ✅ | `IfcExporter.ts` |
| Alle Pset_* Property-Sets | ✅ | `IfcExporter.ts` |
| Blob + Download | ✅ | `IfcExporter.ts` |

**Unterstützte Property-Sets:**
- `Pset_WallCommon`, `Pset_DoorCommon`, `Pset_WindowCommon`
- `Pset_ColumnCommon`, `Pset_SlabCommon`, `Pset_CounterCommon`
- `Pset_Grunddaten`, `Pset_Dimensionen`
- `Pset_KaufdatenGarantie`, `Pset_TechnischeDaten`

#### 2.9 2D/3D Ansicht ⏳ AUSSTEHEND

| Feature | Status | Datei |
|---------|--------|-------|
| Orthografische Top-Down | ⏳ | `Canvas2D.tsx` |
| Umschalten 2D ↔ 3D | ⏳ | |

#### 2.10 UI-Komponenten ✅ ABGESCHLOSSEN

| Feature | Status | Datei |
|---------|--------|-------|
| Toolbar | ✅ | `Toolbar.tsx` |
| PropertyPanel (dynamisch) | ✅ | `PropertyPanel.tsx` |
| HierarchyPanel | ✅ | `HierarchyPanel.tsx` |
| Keyboard-Shortcuts | ✅ | `useKeyboardShortcuts.ts` |
| Element bearbeiten | ✅ | Alle *Properties.tsx |
| Element löschen | ✅ | Delete-Taste |
| Transform-Gizmo | ✅ | `TransformGizmo.tsx` |
| Kamera-Controller | ✅ | `CameraController.tsx` |

#### 2.11 PDF-Underlay ✅ ABGESCHLOSSEN

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

#### 2.12 Persistenz ✅ ABGESCHLOSSEN

| Feature | Status | Datei |
|---------|--------|-------|
| IndexedDB Storage | ✅ | `indexedDBStorage.ts` |
| Projekt-Persistenz | ✅ | `useProjectStore.ts` |
| Element-Persistenz | ✅ | `useElementStore.ts` |
| Storage-Quota-Management | ✅ | `indexedDBStorage.ts` |

### Phase 3: Testing & Polish ⏳ AUSSTEHEND

- [ ] Unit Tests für Geometrie
- [ ] Integration Tests für IFC
- [ ] Error-Boundaries
- [x] Undo/Redo (mit zundo Middleware implementiert)

---

## Aktuelle Dateistruktur

```
src/
├── App.tsx                              # Haupt-Layout
├── main.tsx                             # Entry Point
├── bim/
│   ├── elements/
│   │   ├── Wall.ts                      # ✅ Wand-Factory
│   │   ├── Door.ts                      # ✅ Tür-Factory
│   │   ├── Window.ts                    # ✅ Fenster-Factory
│   │   ├── Column.ts                    # ✅ Säulen-Factory
│   │   ├── Slab.ts                      # ✅ Boden/Decken-Factory
│   │   ├── Counter.ts                   # ✅ Theken-Factory
│   │   ├── Furniture.ts                 # ✅ Möbel-Factory
│   │   ├── OpeningCalculations.ts       # ✅ Öffnungs-Berechnungen
│   │   └── index.ts                     # ✅ Barrel Exports
│   └── ifc/
│       └── IfcExporter.ts               # ✅ Vollständiger IFC-Export
├── components/
│   ├── editor/
│   │   ├── Canvas3D.tsx                 # ✅ 3D-Szene (Z-up)
│   │   ├── Grid.tsx                     # ✅ Infinite Grid
│   │   ├── GroundPlane.tsx              # ✅ Interaktionsfläche
│   │   ├── SceneElements.tsx            # ✅ Element-Renderer
│   │   ├── SnapIndicator.tsx            # ✅ Snap-Visualisierung
│   │   ├── Toolbar.tsx                  # ✅ Tool-Buttons
│   │   ├── PdfUnderlay.tsx              # ✅ PDF-Overlay
│   │   ├── CameraController.tsx         # ✅ Kamera-Steuerung
│   │   ├── TransformGizmo.tsx           # ✅ Transform-Gizmo
│   │   ├── AssetDropdown.tsx            # ✅ Asset-Auswahl
│   │   ├── AssetPreview.tsx             # ✅ Asset-Vorschau
│   │   ├── AssetPreviewWrapper.tsx      # ✅ Asset-Wrapper
│   │   ├── WallPreview.tsx              # ✅ Wand-Vorschau
│   │   ├── DoorPreview.tsx              # ✅ Tür-Vorschau
│   │   ├── WindowPreview.tsx            # ✅ Fenster-Vorschau
│   │   ├── ColumnPreview.tsx            # ✅ Säulen-Vorschau
│   │   ├── SlabPreview.tsx              # ✅ Boden-Vorschau
│   │   ├── CounterPreview.tsx           # ✅ Theken-Vorschau
│   │   └── meshes/
│   │       ├── WallMesh.tsx             # ✅ Wand-3D-Mesh
│   │       ├── DoorMesh.tsx             # ✅ Tür-3D-Mesh
│   │       ├── DoorSwingArc.tsx         # ✅ Schwenk-Bogen
│   │       ├── WindowMesh.tsx           # ✅ Fenster-3D-Mesh
│   │       ├── ColumnMesh.tsx           # ✅ Säulen-3D-Mesh
│   │       ├── SlabMesh.tsx             # ✅ Boden-3D-Mesh
│   │       ├── CounterMesh.tsx          # ✅ Theken-3D-Mesh
│   │       ├── FurnitureMesh.tsx        # ✅ Möbel-3D-Mesh
│   │       └── index.ts                 # ✅ Barrel Exports
│   ├── panels/
│   │   ├── HierarchyPanel.tsx           # ✅ Projektbaum
│   │   ├── PropertyPanel.tsx            # ✅ Dynamisches Panel
│   │   ├── WallProperties.tsx           # ✅ Wand-Eigenschaften
│   │   ├── DoorProperties.tsx           # ✅ Tür-Eigenschaften
│   │   ├── DoorParameterPanel.tsx       # ✅ Tür-Parameter
│   │   ├── WindowProperties.tsx         # ✅ Fenster-Eigenschaften
│   │   ├── WindowParameterPanel.tsx     # ✅ Fenster-Parameter
│   │   ├── ColumnProperties.tsx         # ✅ Säulen-Eigenschaften
│   │   ├── ColumnParameterPanel.tsx     # ✅ Säulen-Parameter
│   │   ├── SlabProperties.tsx           # ✅ Boden-Eigenschaften
│   │   ├── CounterProperties.tsx        # ✅ Theken-Eigenschaften
│   │   ├── CounterParameterPanel.tsx    # ✅ Theken-Parameter
│   │   ├── FurnitureProperties.tsx      # ✅ Möbel-Eigenschaften
│   │   ├── AssetPropertySets.tsx        # ✅ Asset Property-Sets
│   │   ├── ImportModelDialog.tsx        # ✅ 3D-Import-Dialog
│   │   └── index.ts                     # ✅ Barrel Exports
│   └── ui/                              # shadcn Komponenten
├── hooks/
│   ├── useKeyboardShortcuts.ts          # ✅ Tastatur
│   ├── useSnap.ts                       # ✅ Zentrales Snap-Modul
│   ├── useWallPlacement.ts              # ✅ Wand-Platzierung
│   ├── useDoorPlacement.ts              # ✅ Tür-Platzierung
│   ├── useWindowPlacement.ts            # ✅ Fenster-Platzierung
│   ├── useColumnPlacement.ts            # ✅ Säulen-Platzierung
│   ├── useSlabPlacement.ts              # ✅ Boden-Platzierung
│   ├── useCounterPlacement.ts           # ✅ Theken-Platzierung
│   ├── useAssetPlacement.ts             # ✅ Asset-Platzierung
│   ├── useStorageSync.ts                # ✅ IndexedDB-Sync
│   ├── useHistory.ts                    # ✅ Undo/Redo mit zundo
│   └── index.ts                         # ✅ Barrel Exports
├── lib/
│   ├── assets/
│   │   └── assetCatalog.ts              # ✅ 13 vordefinierte Assets
│   ├── geometry/
│   │   ├── math.ts                      # ✅ Geometrie-Utils
│   │   ├── pathOffset.ts                # ✅ Pfad-Offset (Theken)
│   │   └── index.ts                     # ✅ Barrel Exports
│   ├── storage/
│   │   └── indexedDBStorage.ts          # ✅ IndexedDB-Adapter
│   └── utils.ts                         # cn() Helper
├── store/
│   ├── useElementStore.ts               # ✅ Element CRUD + Persistenz
│   ├── useProjectStore.ts               # ✅ Projekt-Hierarchie + Persistenz
│   ├── useSelectionStore.ts             # ✅ Selektion
│   ├── useToolStore.ts                  # ✅ Werkzeuge
│   ├── useViewStore.ts                  # ✅ Ansicht/Grid
│   └── usePdfUnderlayStore.ts           # ✅ PDF-Store
├── types/
│   ├── bim.ts                           # ✅ BIM-Datenmodell (450+ Zeilen)
│   ├── geometry.ts                      # ✅ 2D/3D Typen
│   └── tools.ts                         # ✅ Tool-Typen
└── public/
    └── assets/                          # ✅ 13 GLB-Modelle
        ├── coffee-machines/             # 2 Modelle
        ├── grinders/                    # 1 Modell
        ├── appliances/                  # 3 Modelle
        ├── furniture/                   # 6 Modelle
        └── lighting/                    # 1 Modell
```

---

## Nächste Schritte (Priorität)

### Sofort (Quick Wins)

1. **Keyboard-Shortcuts vervollständigen**
   - Ctrl+A (Select All) - TODO
   - Ctrl+E (Export) - TODO

### Phase 3 (Testing & Polish)

2. **Unit Tests schreiben** (Kritisch!)
   - IFC-Export Roundtrip-Tests
   - Geometrie-Berechnungen
   - Path-Offset-Algorithmus
   - Store-Operationen

3. **2D-Ansicht implementieren**
   - `Canvas2D.tsx` mit orthografischer Kamera
   - Dedizierte 2D-Rendering-Logik

### Optional/Später

- IFC-Import (Modelle laden)
- Automatische Raumerkennung (IfcSpace)
- Kollaborations-Features
- Cloud-Speicherung

---

## Bekannte Issues

| Issue | Beschreibung | Workaround |
|-------|-------------|------------|
| - | Aktuell keine bekannten Bugs | - |

---

## Keyboard Shortcuts

| Taste | Aktion | Status |
|-------|--------|--------|
| A | Auswahl-Tool | ✅ |
| W | Wand-Tool | ✅ |
| T | Tür-Tool | ✅ |
| F | Fenster-Tool | ✅ |
| S | Säulen-Tool | ✅ |
| B | Boden-Tool | ✅ |
| K | Theken-Tool | ✅ |
| G | Grid ein/aus | ✅ |
| O | Orthogonal-Modus ein/aus | ✅ |
| P | PDF Underlay ein/aus | ✅ |
| Tab | 2D/3D Ansicht umschalten | ✅ |
| Escape | Platzierung abbrechen / Deselect | ✅ |
| Delete | Element löschen | ✅ |
| Ctrl+Z | Undo | ✅ |
| Ctrl+Y | Redo | ✅ |
| Ctrl+A | Alles auswählen | ⏳ (TODO) |
| Ctrl+E | IFC exportieren | ⏳ (TODO) |

---

## Dev Server

```bash
npm run dev
# http://localhost:5173 (oder 5174 wenn belegt)
```

---

## Zusammenfassung

### Fortschritt nach Bereich

| Bereich | Fertigstellung | Anmerkung |
|---------|---------------|-----------|
| BIM-Elemente | 100% (7/7) | Alle Elementtypen mit vollständigem Datenmodell |
| Editor-Komponenten | 100% | Alle Meshes inkl. WindowMesh fertig |
| Hooks | 95% | Alle Platzierungs-Hooks + History/Undo fertig |
| Property-Panels | 100% (14 Dateien) | Jeder Elementtyp hat Panel |
| IFC-Export | 100% | Professionell, alle Entity-Typen |
| State Management | 100% (6 Stores) | Zustand + IndexedDB-Persistenz + Undo/Redo |
| Assets | 100% (13 Items) | Vordefinierte Bibliothek komplett |
| Storage | 100% | IndexedDB-Adapter komplett |
| Testing | 0% | Keine Tests geschrieben |
| Dokumentation | 60% | CLAUDE.md vollständig, API-Docs fehlen |

### Gesamtfortschritt: **~95% MVP + Erweiterungen**

### Highlights

- ✅ Vollständiges Z-up Koordinatensystem (BIM-Standard)
- ✅ Professioneller IFC 2x3 Export mit allen Standard-Entitäten
- ✅ Deutsche Lokalisierung in UI & Property-Namen
- ✅ IndexedDB-Persistenz (überlebt Browser-Neustart)
- ✅ PDF-Underlay mit Kalibrierung
- ✅ Fortschrittliche Wandöffnungen (Türen/Fenster erzeugen Voids)
- ✅ Pfad-basiertes Theken-Tool mit realistischer Geometrie
- ✅ 3D-Modell-Import (GLB/GLTF/OBJ) mit Mesh-Export
- ✅ Gastronomie-spezifische Property-Sets & Equipment-Typen
- ✅ Undo/Redo mit zundo Middleware (Ctrl+Z / Ctrl+Y)
