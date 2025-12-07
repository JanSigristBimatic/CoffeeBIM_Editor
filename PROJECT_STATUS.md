# CoffeeBIM Editor - Projektstatus

> **Letzte Aktualisierung:** 2025-12-07 (aktualisiert)

## Projektübersicht

Web-basierter BIM-Editor für Kaffeebars/Restaurants mit IFC-Export.
Zielgruppe: Nicht-BIM-Experten (intuitive UX).

---

## Tech Stack

| Bereich | Technologie | Status |
|---------|-------------|--------|
| Framework | React 18 + Vite + TypeScript | Done |
| 3D | three.js + @react-three/fiber + @react-three/drei | Done |
| IFC | web-ifc (client-side) | Done |
| State | Zustand | Done |
| UI | shadcn/ui + Tailwind CSS | Done |
| Testing | Vitest | Pending |

---

## Implementierungsfortschritt

### Phase 0: Bootstrap - ABGESCHLOSSEN

- [x] Vite-Projekt initialisiert
- [x] Core-Dependencies installiert
- [x] Konfiguration (vite, tsconfig, tailwind, eslint)
- [x] Verzeichnisstruktur angelegt
- [x] Basis-App mit 3D-Canvas

### Phase 1: Core Architecture - ABGESCHLOSSEN

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

### Phase 2: MVP Implementation - ABGESCHLOSSEN

#### 2.1 Wand-Tool - ABGESCHLOSSEN

| Feature | Status | Datei |
|---------|--------|-------|
| Klick-Klick-Platzierung | Done | `useWallPlacement.ts` |
| Wand-Preview | Done | `WallPreview.tsx` |
| Grid-Snapping (10cm) | Done | `useSnap.ts` |
| Endpoint-Snapping (30cm) | Done | `useSnap.ts` |
| Snap-Indikator | Done | `SnapIndicator.tsx` |
| Wand-Geometrie | Done | `WallMesh.tsx` |
| Ecken-Überlappung | Done | `WallMesh.tsx` |
| Parameter (Dicke, Höhe) | Done | `Wall.ts` |
| Öffnungen für Türen/Fenster | Done | `Wall.ts` (openings array) |
| PropertyPanel | Done | `WallProperties.tsx` |

#### 2.2 Tür-Tool - ABGESCHLOSSEN

| Feature | Status | Datei |
|---------|--------|-------|
| Tür auf Wand platzieren | Done | `useDoorPlacement.ts` |
| Tür-Preview | Done | `DoorPreview.tsx` |
| Tür-Geometrie | Done | `DoorMesh.tsx` |
| Schwenk-Visualisierung | Done | `DoorSwingArc.tsx` |
| Host-Wall-Referenz | Done | `DoorData.hostWallId` |
| Abstand zu Wandkanten | Done | `OpeningCalculations.ts` |
| Türtypen (Single/Double/Sliding) | Done | `Door.ts` |
| Schwenkrichtung | Done | `DoorData.swingDirection` |
| PropertyPanel | Done | `DoorProperties.tsx` |
| ParameterPanel | Done | `DoorParameterPanel.tsx` |

#### 2.3 Fenster-Tool - ABGESCHLOSSEN

| Feature | Status | Datei |
|---------|--------|-------|
| Fenster auf Wand platzieren | Done | `useWindowPlacement.ts` |
| Fenster-Preview | Done | `WindowPreview.tsx` |
| Fenster-Geometrie | Done | `WindowMesh.tsx` |
| Host-Wall-Referenz | Done | `WindowData.hostWallId` |
| Fenstertypen (Single/Double/Fixed) | Done | `Window.ts` |
| Brüstungshöhe | Done | `WindowData.sillHeight` |
| PropertyPanel | Done | `WindowProperties.tsx` |
| ParameterPanel | Done | `WindowParameterPanel.tsx` |

#### 2.4 Säulen-Tool - ABGESCHLOSSEN

| Feature | Status | Datei |
|---------|--------|-------|
| Einzelklick-Platzierung | Done | `useColumnPlacement.ts` |
| Säulen-Preview | Done | `ColumnPreview.tsx` |
| Säulen-Geometrie | Done | `ColumnMesh.tsx` |
| Rechteckiges Profil | Done | `Column.ts` |
| Rundes Profil (16-Segment) | Done | `Column.ts` |
| PropertyPanel | Done | `ColumnProperties.tsx` |
| ParameterPanel | Done | `ColumnParameterPanel.tsx` |

#### 2.5 Boden/Decken-Tool - ABGESCHLOSSEN

| Feature | Status | Datei |
|---------|--------|-------|
| Polygon-Platzierung | Done | `useSlabPlacement.ts` |
| Slab-Preview | Done | `SlabPreview.tsx` |
| Slab-Geometrie | Done | `SlabMesh.tsx` |
| Boden/Decken-Typen | Done | `SlabData.slabType` |
| Flächenberechnung | Done | `Slab.ts` |
| PropertyPanel | Done | `SlabProperties.tsx` |

#### 2.6 Theken-Tool - ABGESCHLOSSEN

| Feature | Status | Datei |
|---------|--------|-------|
| Pfad-Platzierung | Done | `useCounterPlacement.ts` |
| Counter-Preview | Done | `CounterPreview.tsx` |
| Counter-Geometrie | Done | `CounterMesh.tsx` |
| Path-Offset-Algorithmus | Done | `pathOffset.ts` |
| Theken-Typen (Standard/Bar/Service) | Done | `Counter.ts` |
| Überhang & Fussraste | Done | `CounterData` |
| PropertyPanel | Done | `CounterProperties.tsx` |
| ParameterPanel | Done | `CounterParameterPanel.tsx` |
| Deutsche Property-Sets | Done | `Counter.ts` |

#### 2.7 Möbel/Asset-System - ABGESCHLOSSEN

| Feature | Status | Datei |
|---------|--------|-------|
| Asset-Katalog (13 vordefiniert) | Done | `assetCatalog.ts` |
| 3D-Import (GLB/GLTF/OBJ) | Done | `ImportModelDialog.tsx` |
| Asset-Platzierung | Done | `useAssetPlacement.ts` |
| Asset-Preview | Done | `AssetPreview.tsx` |
| Asset-Dropdown | Done | `AssetDropdown.tsx` |
| Möbel-Geometrie | Done | `FurnitureMesh.tsx` |
| PropertyPanel | Done | `FurnitureProperties.tsx` |
| Gastronomie-Property-Sets | Done | `AssetPropertySets.tsx` |

**Asset-Kategorien (13 GLB-Dateien):**
- Kaffeemaschinen: La Marzocco Gross, La Marzocco Strada (2)
- Mühlen: Kaffeemühle (1)
- Geräte: Spülmaschine, Kühlschrank gross, Kühlschrank mittel (3)
- Möbel: Tisch, Stuhl, Barhocker, Sofa, Sofa L-Form, Regal (6)
- Beleuchtung: Deckenlampe (1)

#### 2.8 IFC-Export - ABGESCHLOSSEN

| Feature | Status | Datei |
|---------|--------|-------|
| web-ifc initialisieren | Done | `IfcExporter.ts` |
| IFC 2x3 Schema | Done | `IfcExporter.ts` |
| Z-up Koordinatensystem | Done | `IfcExporter.ts` |
| IfcProject/Site/Building/Storey | Done | `IfcExporter.ts` |
| IfcWallStandardCase | Done | `IfcExporter.ts` |
| IfcDoor + IfcOpeningElement | Done | `IfcExporter.ts` |
| IfcWindow + IfcOpeningElement | Done | `IfcExporter.ts` |
| IfcColumn (rechteckig/rund) | Done | `IfcExporter.ts` |
| IfcSlab | Done | `IfcExporter.ts` |
| IfcBuildingElementProxy (Theken) | Done | `IfcExporter.ts` |
| IfcFurnishingElement (Möbel) | Done | `IfcExporter.ts` |
| IfcFacetedBrep (Mesh-Export) | Done | `IfcExporter.ts` |
| Alle Pset_* Property-Sets | Done | `IfcExporter.ts` |
| Blob + Download | Done | `IfcExporter.ts` |

**Unterstützte Property-Sets:**
- `Pset_WallCommon`, `Pset_DoorCommon`, `Pset_WindowCommon`
- `Pset_ColumnCommon`, `Pset_SlabCommon`, `Pset_CounterCommon`
- `Pset_Grunddaten`, `Pset_Dimensionen`
- `Pset_KaufdatenGarantie`, `Pset_TechnischeDaten`

#### 2.9 2D/3D Ansicht - AUSSTEHEND

| Feature | Status | Datei |
|---------|--------|-------|
| Orthografische Top-Down | Pending | `Canvas2D.tsx` |
| Umschalten 2D / 3D | Pending | |

#### 2.10 UI-Komponenten - ABGESCHLOSSEN

| Feature | Status | Datei |
|---------|--------|-------|
| Toolbar | Done | `Toolbar.tsx` |
| PropertyPanel (dynamisch) | Done | `PropertyPanel.tsx` |
| HierarchyPanel | Done | `HierarchyPanel.tsx` |
| Keyboard-Shortcuts | Done | `useKeyboardShortcuts.ts` |
| Element bearbeiten | Done | Alle *Properties.tsx |
| Element löschen | Done | Delete-Taste |
| Transform-Gizmo | Done | `TransformGizmo.tsx` |
| Kamera-Controller | Done | `CameraController.tsx` |

#### 2.11 PDF-Underlay - ABGESCHLOSSEN

| Feature | Status | Datei |
|---------|--------|-------|
| PDF laden (pdf.js) | Done | `lib/pdf/pdfLoader.ts` |
| Kalibrierungs-Dialog | Done | `PdfCalibrationDialog.tsx` |
| Nullpunkt setzen | Done | Step 1 im Dialog |
| Rotation festlegen | Done | Step 2 im Dialog |
| Massstab kalibrieren | Done | Step 3 im Dialog |
| PDF als 3D-Plane | Done | `PdfUnderlay.tsx` |
| Sichtbarkeit toggle | Done | Toolbar + Shortcut `P` |
| Store | Done | `usePdfUnderlayStore.ts` |

#### 2.12 Persistenz - ABGESCHLOSSEN

| Feature | Status | Datei |
|---------|--------|-------|
| IndexedDB Storage | Done | `indexedDBStorage.ts` |
| Projekt-Persistenz | Done | `useProjectStore.ts` |
| Element-Persistenz | Done | `useElementStore.ts` |
| Storage-Quota-Management | Done | `indexedDBStorage.ts` |

### Phase 3: Testing & Polish - AUSSTEHEND

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
│   │   ├── Wall.ts                      # Wand-Factory
│   │   ├── Door.ts                      # Tür-Factory
│   │   ├── Window.ts                    # Fenster-Factory
│   │   ├── Column.ts                    # Säulen-Factory
│   │   ├── Slab.ts                      # Boden/Decken-Factory
│   │   ├── Counter.ts                   # Theken-Factory
│   │   ├── Furniture.ts                 # Möbel-Factory
│   │   ├── OpeningCalculations.ts       # Öffnungs-Berechnungen
│   │   └── index.ts                     # Barrel Exports
│   └── ifc/
│       └── IfcExporter.ts               # Vollständiger IFC-Export
├── components/
│   ├── editor/
│   │   ├── Canvas3D.tsx                 # 3D-Szene (Z-up)
│   │   ├── Grid.tsx                     # Infinite Grid
│   │   ├── GroundPlane.tsx              # Interaktionsfläche
│   │   ├── SceneElements.tsx            # Element-Renderer
│   │   ├── SnapIndicator.tsx            # Snap-Visualisierung
│   │   ├── Toolbar.tsx                  # Tool-Buttons
│   │   ├── PdfUnderlay.tsx              # PDF-Overlay
│   │   ├── CameraController.tsx         # Kamera-Steuerung
│   │   ├── TransformGizmo.tsx           # Transform-Gizmo
│   │   ├── AssetDropdown.tsx            # Asset-Auswahl
│   │   ├── AssetPreview.tsx             # Asset-Vorschau
│   │   ├── AssetPreviewWrapper.tsx      # Asset-Wrapper
│   │   ├── WallPreview.tsx              # Wand-Vorschau
│   │   ├── DoorPreview.tsx              # Tür-Vorschau
│   │   ├── WindowPreview.tsx            # Fenster-Vorschau
│   │   ├── ColumnPreview.tsx            # Säulen-Vorschau
│   │   ├── SlabPreview.tsx              # Boden-Vorschau
│   │   ├── CounterPreview.tsx           # Theken-Vorschau
│   │   └── meshes/
│   │       ├── WallMesh.tsx             # Wand-3D-Mesh
│   │       ├── DoorMesh.tsx             # Tür-3D-Mesh
│   │       ├── DoorSwingArc.tsx         # Schwenk-Bogen
│   │       ├── WindowMesh.tsx           # Fenster-3D-Mesh
│   │       ├── ColumnMesh.tsx           # Säulen-3D-Mesh
│   │       ├── SlabMesh.tsx             # Boden-3D-Mesh
│   │       ├── CounterMesh.tsx          # Theken-3D-Mesh
│   │       ├── FurnitureMesh.tsx        # Möbel-3D-Mesh
│   │       └── index.ts                 # Barrel Exports
│   ├── panels/
│   │   ├── HierarchyPanel.tsx           # Projektbaum
│   │   ├── PropertyPanel.tsx            # Dynamisches Panel
│   │   ├── WallProperties.tsx           # Wand-Eigenschaften
│   │   ├── DoorProperties.tsx           # Tür-Eigenschaften
│   │   ├── DoorParameterPanel.tsx       # Tür-Parameter
│   │   ├── WindowProperties.tsx         # Fenster-Eigenschaften
│   │   ├── WindowParameterPanel.tsx     # Fenster-Parameter
│   │   ├── ColumnProperties.tsx         # Säulen-Eigenschaften
│   │   ├── ColumnParameterPanel.tsx     # Säulen-Parameter
│   │   ├── SlabProperties.tsx           # Boden-Eigenschaften
│   │   ├── CounterProperties.tsx        # Theken-Eigenschaften
│   │   ├── CounterParameterPanel.tsx    # Theken-Parameter
│   │   ├── FurnitureProperties.tsx      # Möbel-Eigenschaften
│   │   ├── AssetPropertySets.tsx        # Asset Property-Sets
│   │   ├── ImportModelDialog.tsx        # 3D-Import-Dialog
│   │   └── index.ts                     # Barrel Exports
│   └── ui/                              # shadcn Komponenten
├── hooks/
│   ├── useKeyboardShortcuts.ts          # Tastatur
│   ├── useSnap.ts                       # Zentrales Snap-Modul
│   ├── useWallPlacement.ts              # Wand-Platzierung
│   ├── useDoorPlacement.ts              # Tür-Platzierung
│   ├── useWindowPlacement.ts            # Fenster-Platzierung
│   ├── useColumnPlacement.ts            # Säulen-Platzierung
│   ├── useSlabPlacement.ts              # Boden-Platzierung
│   ├── useCounterPlacement.ts           # Theken-Platzierung
│   ├── useAssetPlacement.ts             # Asset-Platzierung
│   ├── useStorageSync.ts                # IndexedDB-Sync
│   ├── useHistory.ts                    # Undo/Redo mit zundo
│   └── index.ts                         # Barrel Exports
├── lib/
│   ├── assets/
│   │   └── assetCatalog.ts              # 13 vordefinierte Assets
│   ├── geometry/
│   │   ├── math.ts                      # Geometrie-Utils
│   │   ├── pathOffset.ts                # Pfad-Offset (Theken)
│   │   └── index.ts                     # Barrel Exports
│   ├── storage/
│   │   └── indexedDBStorage.ts          # IndexedDB-Adapter
│   └── utils.ts                         # cn() Helper
├── store/
│   ├── useElementStore.ts               # Element CRUD + Persistenz
│   ├── useProjectStore.ts               # Projekt-Hierarchie + Persistenz
│   ├── useSelectionStore.ts             # Selektion
│   ├── useToolStore.ts                  # Werkzeuge
│   ├── useViewStore.ts                  # Ansicht/Grid
│   └── usePdfUnderlayStore.ts           # PDF-Store
├── types/
│   ├── bim.ts                           # BIM-Datenmodell (450+ Zeilen)
│   ├── geometry.ts                      # 2D/3D Typen
│   └── tools.ts                         # Tool-Typen
└── public/
    └── assets/                          # 13 GLB-Modelle
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
| A | Auswahl-Tool | Done |
| W | Wand-Tool | Done |
| T | Tür-Tool | Done |
| F | Fenster-Tool | Done |
| S | Säulen-Tool | Done |
| B | Boden-Tool | Done |
| K | Theken-Tool | Done |
| G | Grid ein/aus | Done |
| O | Orthogonal-Modus ein/aus | Done |
| P | PDF Underlay ein/aus | Done |
| Tab | 2D/3D Ansicht umschalten | Done |
| Escape | Platzierung abbrechen / Deselect | Done |
| Delete | Element löschen | Done |
| Ctrl+Z | Undo | Done |
| Ctrl+Y | Redo | Done |
| Ctrl+A | Alles auswählen | Pending (TODO) |
| Ctrl+E | IFC exportieren | Pending (TODO) |

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

- Vollständiges Z-up Koordinatensystem (BIM-Standard)
- Professioneller IFC 2x3 Export mit allen Standard-Entitäten
- Deutsche Lokalisierung in UI & Property-Namen
- IndexedDB-Persistenz (überlebt Browser-Neustart)
- PDF-Underlay mit Kalibrierung
- Fortschrittliche Wandöffnungen (Türen/Fenster erzeugen Voids)
- Pfad-basiertes Theken-Tool mit realistischer Geometrie
- 3D-Modell-Import (GLB/GLTF/OBJ) mit Mesh-Export
- Gastronomie-spezifische Property-Sets & Equipment-Typen
- Undo/Redo mit zundo Middleware (Ctrl+Z / Ctrl+Y)
