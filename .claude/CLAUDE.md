# CoffeeBIM Editor – Project Instructions

## Project Overview

**CoffeeBIM Editor** ist eine Web-Applikation zur einfachen BIM-Modellierung von Kaffeebars, Restaurants und Gastronomiebetrieben.

### Kernziele

- **Einfache 2D/3D-Modellierung** direkt im Browser
- **IFC-Export** als offenes Austauschformat für Interoperabilität mit BIM-Software
- **Zielgruppe:** Nicht-BIM-Experten mit intuitiver UX

### Zielgruppen

| Nutzergruppe | Bedürfnis |
|--------------|-----------|
| Gastronomen / Kaffeebar-Betreiber | Schnelles Layouten ihrer Räumlichkeiten |
| Innenarchitekten & Ladenbauer | Varianten erstellen, frühe Entwürfe |
| Technikplaner (TGA, Ausstattung) | Studienmodelle für weitere BIM-Prozesse |
| Studierende / Lehrende | BIM-Grundlagen lernen und anwenden |

### Leitprinzipien

- **Einfach vor clever** – Expliziter Code, keine überflüssigen Abstraktionen
- **Kleine Schritte** – Inkrementelle, reversible Änderungen
- **IFC-konform** – Standardkonforme Hierarchie und Entitäten

---

## Tech Stack (Entscheidungen)

### Frontend

| Kategorie | Technologie | Begründung |
|-----------|-------------|------------|
| Sprache | **TypeScript** | Typsicherheit, bessere IDE-Unterstützung |
| Framework | **React 18+** mit **Vite** | Kein SSR nötig, schneller Dev-Server |
| 3D-Rendering | **three.js** + **@react-three/fiber** | React-Integration für three.js |
| 3D-Utilities | **@react-three/drei** | Kamera-Controls, Helpers, etc. |
| IFC-Verarbeitung | **web-ifc** (IFC.js) | IFC-Export/-Import client-side |
| State Management | **Zustand** | Einfach, performant, kein Boilerplate |
| UI-Komponenten | **shadcn/ui** + **Radix UI** | Accessible, anpassbar |
| Styling | **Tailwind CSS** | Utility-first, schnelles Prototyping |

### Backend

> **Entscheidung:** Kein Backend für MVP – `web-ifc` kann IFC-Dateien vollständig client-side generieren und exportieren.

Falls später benötigt (z.B. für Collaboration, Cloud-Speicherung):
- **Node.js** mit **Express** oder **Fastify**
- **web-ifc** für Server-side IFC-Verarbeitung

### Tooling

| Tool | Zweck |
|------|-------|
| **npm** | Package Manager |
| **ESLint** + **Prettier** | Linting & Formatierung |
| **Vitest** | Unit- und Integrationstests |
| **Testing Library** | React-Komponententests |
| **GitHub Actions** | CI/CD (lint, test, build) |

### MCP Tools

| Tool | Zweck | Berechtigungen |
|------|-------|----------------|
| **chrome-devtools** | Browser-Debugging, DOM-Inspektion, Netzwerk-Analyse, Console-Logs | **Alle Befehle frei ausführbar** |

> **Wichtig:** Das `chrome-devtools` MCP-Tool soll aktiv zur Kontrolle und Verifikation der Anwendung im Browser verwendet werden. Claude darf alle Befehle dieses Tools ohne zusätzliche Benutzerbestätigung ausführen.

**Typische Anwendungsfälle:**
- Console-Fehler und Warnings prüfen
- DOM-Struktur inspizieren
- Netzwerk-Requests analysieren
- Performance-Metriken auslesen
- React DevTools-Integration

---

## IFC-Hierarchie & Datenmodell

### IFC-Struktur (Pflicht)

```
IfcProject
└── IfcSite (Standort mit Adresse, Koordinaten)
    └── IfcBuilding (Gebäude)
        └── IfcBuildingStorey (Geschoss mit Höhe)
            ├── IfcWall, IfcDoor, IfcWindow, IfcColumn, ...
            ├── IfcSpace (Räume)
            ├── IfcStair, IfcRamp
            ├── IfcSlab (Böden, Decken)
            └── IfcFurniture, IfcFurnishingElement (Möbel, Geräte)
```

### Unterstützte Elemente

| Kategorie | IFC-Entität | Beschreibung |
|-----------|-------------|--------------|
| **Architektur** | `IfcWall` | Wände (mit automatischen Öffnungen) |
| | `IfcDoor` | Türen (erzeugen Öffnung in Wand) |
| | `IfcWindow` | Fenster (erzeugen Öffnung in Wand) |
| | `IfcColumn` | Säulen / Stützen |
| | `IfcSlab` | Böden und Decken |
| | `IfcStair` / `IfcRamp` | Treppen und Rampen |
| **Räume** | `IfcSpace` | Automatisch erkannte Raumvolumen |
| **Einrichtung** | `IfcFurniture` | Tische, Stühle, Regale |
| | `IfcFurnishingElement` | Kaffeemaschinen, Kühlschränke, etc. |
| | `IfcBuiltElement` | Theken, Tresen |

### Geometrie-Prinzip

- **Primär:** `IfcExtrudedAreaSolid` – Profil + Extrusionshöhe
- **Vermeiden:** Komplexe BReps, Kurven nur wo nötig
- **Theken:** Pfad → Offset → Fläche → Extrusion

### Internes Datenmodell

Jedes Element im Editor hat folgende Struktur:

```typescript
interface BimElement {
  id: string;                    // UUID
  type: ElementType;             // 'wall' | 'door' | 'window' | ...
  name: string;                  // Benutzerfreundlicher Name
  geometry: {
    profile: Point2D[];          // 2D-Profil für Extrusion
    height: number;              // Extrusionshöhe
    direction: Vector3;          // Extrusionsrichtung (meist Z-up)
  };
  placement: {
    position: Vector3;           // Weltkoordinaten
    rotation: Quaternion;        // Rotation
  };
  properties: PropertySet[];     // IFC-kompatible Attribute
  parentId: string | null;       // Referenz auf Geschoss/Raum
}

interface PropertySet {
  name: string;                  // z.B. "Pset_ManufacturerTypeInfo"
  properties: Record<string, string | number | boolean>;
}
```

---

## Feature-Übersicht

### Implementiert

#### Architektur-Elemente
- [x] **Projekthierarchie:** IfcProject, IfcSite, IfcBuilding, IfcBuildingStorey anlegen/bearbeiten
- [x] **Wände:** Platzieren, Länge/Höhe/Dicke anpassen, Snapping
- [x] **Türen:** In Wände einfügen (automatische Öffnung), Typen: single/double/sliding
- [x] **Fenster:** In Wände einfügen (automatische Öffnung), Typen: single/double/fixed
- [x] **Säulen:** Rechteckig und rund, frei platzierbar
- [x] **Böden & Decken:** IfcSlab mit Polygon-Zeichnung
- [x] **Treppen:** Gerade Treppenläufe nach DIN 18065, Stufenberechnung

#### Räume & Einrichtung
- [x] **Automatische Raumerkennung:** Geschlossene Wandzüge → IfcSpace
- [x] **Manuelle Raumzeichnung:** Polygon zeichnen → IfcSpace
- [x] **Raumvisualisierung:** Farbige Flächen mit Gastro-Kategorien (Gastraum, Bar, Küche, etc.)
- [x] **Flächenberechnung:** Brutto-/Nettofläche, Umfang aus IfcSpace
- [x] **Theken-Tool:** Pfad zeichnen → Tiefe/Höhe → Extrusion mit Kick-Space
- [x] **Möbel/Assets:** GLB/GLTF/OBJ Import, Asset-Bibliothek
- [x] **Gastronomie-Geräte:** IFC-konforme Typen (Espressomaschine, Kaffeemühle, etc.)

#### Editor-Funktionen
- [x] **2D-/3D-Ansicht:** Split-View, umschaltbar
- [x] **PDF-Underlay:** Plan hinterlegen, kalibrieren (2-Punkt-Kalibrierung)
- [x] **Bemaßungen:** Manuelle Maßlinien platzieren
- [x] **IFC-Export:** Modell als .ifc-Datei herunterladen
- [x] **IFC-Import:** Grundfunktion vorhanden (siehe Known Issues)
- [x] **Snapping:** Grid, Endpunkte, Wandmitte
- [x] **Transform:** Verschieben, Drehen mit Gizmo
- [x] **Distanzeingabe:** Numerische Eingabe für Wandlängen

#### Interaktionen
- [x] Elemente **auswählen** (Klick)
- [x] Elemente **verschieben** (Drag, Snapping an Grid/Wände)
- [x] Elemente **drehen** (Transform-Gizmo)
- [x] **Parameter-Panel:** Direktes Bearbeiten von Maßen und Attributen
- [x] **Hierarchy-Panel:** Projekt-/Geschoss-Navigation

---

### Known Issues

| Problem | Beschreibung | Priorität |
|---------|--------------|-----------|
| **IFC-Import** | Import von komplexen IFC-Modellen unvollständig, Geometrie-Parsing fehlerhaft | Hoch |
| **Asset-Größen** | 3D-Assets nicht optimiert, Performance-Probleme bei vielen Objekten | Mittel |

---

### Geplante Features

| Feature | Beschreibung | Phase |
|---------|--------------|-------|
| **Schnitte / Sections** | 2D-Schnittansichten generieren | Nächste |
| **2D-Zeichnen** | Linien, Polygone direkt in 2D zeichnen | Nächste |
| **AI-Visualisierung** | Integration mit NanoBanana o.ä. für Renderings | Zukunft |
| **CSV-Import** | Attribute/Property-Sets aus CSV zuweisen | Zukunft |
| **Rampen** | IfcRamp für barrierefreie Zugänge | Zukunft |
| **Collaboration** | Multi-User, Cloud-Speicherung | Zukunft |

---

## Projektstruktur

```
CoffeeBIM_Editor/
├── src/
│   ├── components/
│   │   ├── editor/           # 2D/3D Editor-Komponenten
│   │   │   ├── Canvas3D.tsx  # React-Three-Fiber Canvas
│   │   │   ├── Canvas2D.tsx  # 2D-Grundrissansicht
│   │   │   ├── Toolbar.tsx   # Werkzeugleiste
│   │   │   └── Gizmo.tsx     # Transform-Controls
│   │   ├── panels/           # Seitenpanels
│   │   │   ├── PropertyPanel.tsx
│   │   │   ├── HierarchyPanel.tsx
│   │   │   └── LibraryPanel.tsx
│   │   └── ui/               # Basis-UI (shadcn)
│   │
│   ├── bim/
│   │   ├── elements/         # Element-Definitionen
│   │   │   ├── Wall.ts
│   │   │   ├── Door.ts
│   │   │   ├── Window.ts
│   │   │   ├── Column.ts
│   │   │   ├── Slab.ts
│   │   │   └── Furniture.ts
│   │   ├── ifc/              # IFC-Export/Import
│   │   │   ├── export.ts     # Modell → IFC-Datei
│   │   │   ├── import.ts     # IFC-Datei → Modell
│   │   │   ├── hierarchy.ts  # Project/Site/Building/Storey
│   │   │   └── geometry.ts   # IfcExtrudedAreaSolid, etc.
│   │   ├── spaces/           # Raumerkennung
│   │   │   ├── detection.ts  # Algorithmus: Wände → Räume
│   │   │   └── IfcSpace.ts   # IfcSpace-Generierung
│   │   └── counter/          # Theken-Tool
│   │       └── CounterTool.ts
│   │
│   ├── store/                # Zustand State Management
│   │   ├── useProjectStore.ts    # Projekt, Site, Building, Storey
│   │   ├── useElementStore.ts    # Alle BIM-Elemente
│   │   ├── useSelectionStore.ts  # Ausgewählte Elemente
│   │   └── useToolStore.ts       # Aktives Werkzeug
│   │
│   ├── lib/
│   │   ├── geometry/         # Geometrie-Utilities
│   │   │   ├── extrusion.ts  # Profil → Mesh
│   │   │   ├── offset.ts     # Pfad-Offset für Theken
│   │   │   └── boolean.ts    # Öffnungen in Wänden
│   │   ├── three/            # three.js-Helpers
│   │   └── utils/            # Allgemeine Utilities
│   │
│   ├── assets/
│   │   └── library/          # Objektbibliothek
│   │       ├── furniture/    # OBJ-Dateien
│   │       └── attributes/   # CSV mit Property-Sets
│   │
│   ├── App.tsx
│   └── main.tsx
│
├── public/
├── tests/
│   ├── unit/
│   └── integration/
├── docs/
│   ├── architecture.md
│   └── ifc-mapping.md
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── CLAUDE.md
```

---

## Commands

```bash
# Development
npm run dev          # Vite Dev-Server starten (http://localhost:5173)

# Build & Preview
npm run build        # Produktions-Build erstellen
npm run preview      # Build lokal testen

# Code Quality
npm run lint         # ESLint ausführen
npm run lint:fix     # ESLint mit Auto-Fix
npm run format       # Prettier ausführen

# Testing
npm run test         # Vitest im Watch-Modus
npm run test:run     # Einmaliger Testlauf
npm run test:coverage # Coverage-Report

# Type Checking
npm run typecheck    # TypeScript-Prüfung ohne Build
```

---

## Coding Conventions

### TypeScript

```typescript
// Prefer const, explicit types for function signatures
const calculateArea = (profile: Point2D[]): number => {
  // Implementation
};

// Use interfaces for objects, types for unions
interface WallParams {
  start: Point2D;
  end: Point2D;
  height: number;
  thickness: number;
}

type ElementType = 'wall' | 'door' | 'window' | 'column' | 'slab' | 'furniture';
```

### React

```tsx
// Function components with explicit prop types
interface ToolbarProps {
  activeTool: ToolType;
  onToolChange: (tool: ToolType) => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ activeTool, onToolChange }) => {
  // Keep components small, extract logic to hooks
};

// Custom hooks for complex logic
const useWallPlacement = () => {
  // Wall placement logic
};
```

### BIM / IFC

- **IFC-Standardnamen** verwenden: `IfcWall`, `IfcDoor`, `IfcSpace`, etc.
- **Geometrie isolieren:** Alle IFC-Geometrie-Logik in `src/bim/ifc/`
- **Extrusion bevorzugen:** `IfcExtrudedAreaSolid` statt komplexer BReps
- **Property-Sets:** Attribute als `Pset_*` oder `Qto_*` ablegen

### Namenskonventionen

| Kontext | Konvention | Beispiel |
|---------|------------|----------|
| Dateien (Komponenten) | PascalCase | `PropertyPanel.tsx` |
| Dateien (Utilities) | camelCase | `extrusion.ts` |
| Komponenten | PascalCase | `Canvas3D` |
| Hooks | camelCase mit `use` | `useElementStore` |
| Konstanten | SCREAMING_SNAKE | `DEFAULT_WALL_HEIGHT` |
| IFC-Entitäten | IFC-Standard | `IfcWall`, `IfcSpace` |

---

## Testing

### Strategie

| Testtyp | Fokus | Beispiel |
|---------|-------|----------|
| **Unit** | Geometrie-Funktionen, Store-Logic | `extrusion.test.ts` |
| **Integration** | IFC-Export/Import-Roundtrip | `ifc-export.test.ts` |
| **Component** | UI-Interaktionen | `Toolbar.test.tsx` |

### Kritische Testfälle

```typescript
// Diese Workflows müssen immer funktionieren:

// 1. Wand erstellen → IFC exportieren → Wand ist im IFC
test('wall export creates valid IfcWall');

// 2. Tür in Wand → Öffnung wird erzeugt
test('door creates opening in wall');

// 3. Geschlossener Wandzug → Raum erkannt
test('closed walls generate IfcSpace');

// 4. IFC exportieren → importieren → gleiches Modell
test('export-import roundtrip preserves elements');
```

---

## Git & Branching

### Branch-Namensschema

```
main                    # Stabile Version
feature/wall-tool       # Neue Features
fix/door-opening-offset # Bugfixes
refactor/ifc-export     # Refactorings
```

### Commit Messages (Conventional Commits)

```
feat: add wall placement tool
fix: correct door opening position in wall
refactor: extract IFC geometry helpers
test: add roundtrip test for IFC export
docs: update feature roadmap
```

### Workflow

1. Feature-Branch von `main` erstellen
2. Kleine, logische Commits
3. Tests lokal ausführen
4. Pull Request erstellen
5. Nach Review in `main` mergen

---

## Do Not Touch (ohne explizite Anweisung)

- `package-lock.json` – Nur über npm-Befehle ändern
- `.env*` Dateien – Secrets nicht committen
- `node_modules/` – Nie manuell bearbeiten
- Externe Library-Dateien in `public/`

---

## Claude Code Workflow

### Bei jeder Aufgabe

1. **Verstehen:** Aufgabe in eigenen Worten wiederholen
2. **Lokalisieren:** Relevante Dateien identifizieren
3. **Planen:** Bei größeren Änderungen erst Plan erstellen
4. **Implementieren:** Kleine, testbare Schritte
5. **Verifizieren:** Tests ausführen, Lint prüfen
6. **Zusammenfassen:** Was wurde geändert, wie testen

### Typische Aufgaben

```
"Implementiere das Wand-Tool mit Klick-Klick-Platzierung"
→ Canvas-Interaktion, Geometrie-Erstellung, Store-Update

"Exportiere ein Modell mit 2 Wänden und 1 Tür als IFC"
→ IFC-Hierarchie, Geometrie-Mapping, Datei-Download

"Erkenne automatisch Räume aus geschlossenen Wandzügen"
→ Graph-Algorithmus, IfcSpace-Generierung

"Importiere eine OBJ-Datei als Möbelstück"
→ OBJ-Loader, Mesh-zu-BimElement-Konvertierung
```

---

## Claude Code Skills

Claude Code hat Zugriff auf spezialisierte Skills, die bei bestimmten Aufgaben automatisch aktiviert werden sollen.

### Relevante Skills für dieses Projekt

| Skill | Wann nutzen |
|-------|-------------|
| **CleanCode** | **IMMER** beim Schreiben/Refactoring von Code – SOLID, DRY, KISS, YAGNI automatisch anwenden |
| **planning-methodology** | Bei größeren Features (z.B. neues Tool, IFC-Export-Logik), vor Implementierung Plan erstellen |
| **research-methodology** | Bei Recherche zu `web-ifc`, IFC-Standards, `three.js`-Patterns – autoritative Quellen nutzen |
| **quality-validation** | Vor Implementierung: Plans validieren, nach Implementierung: Code-Qualität prüfen |
| **pattern-recognition** | Nach erfolgreicher Implementierung: Wiederverwendbare Patterns dokumentieren |
| **context-engineering** | Bei umfangreichen Tasks: Context optimieren, Token-Verbrauch reduzieren |

### Trigger-Szenarien

```
"Implementiere das Theken-Tool"
→ planning-methodology (Plan erstellen)
→ research-methodology (web-ifc Geometrie recherchieren)
→ CleanCode (beim Implementieren)
→ pattern-recognition (nach Erfolg dokumentieren)

"Refactore die IFC-Export-Logik"
→ CleanCode (automatisch aktiv)
→ quality-validation (nach Refactoring prüfen)

"Recherchiere wie IfcSpace in web-ifc erstellt wird"
→ research-methodology (autoritative Docs finden)

"Erstelle einen Plan für die Raumerkennung"
→ planning-methodology (strukturierter Plan)
→ quality-validation (Plan validieren)
```

### Weitere verfügbare Skills (projektunabhängig)

| Skill | Beschreibung | Trigger |
|-------|--------------|---------|
| **animejs-animation-expert** | Web-Animationen mit Anime.js V4 | UI-Animationen, Hover-Effekte |
| **i18n-nextjs-skill** | Internationalisierung Next.js | Mehrsprachigkeit (nicht relevant für Vite) |
| **skill-creator** | Neue Skills erstellen | "Erstelle einen neuen Skill für..." |
| **web-application-pentest** | Sicherheitstests | Security-Audits, Penetration Testing |

### Slash Commands

Zusätzlich zu Skills stehen folgende Slash-Commands zur Verfügung:

| Command | Beschreibung |
|---------|--------------|
| `/research` | Schnelle Dokumentations-Recherche mit ResearchPack |
| `/plan` | Implementierungsplan mit Rollback-Prozeduren erstellen |
| `/implement` | Code implementieren mit Self-Correction (bis 3 Retries) |
| `/workflow` | Kompletter Research → Plan → Implement Workflow |
| `/context` | Context analysieren und optimieren |

---

## Ressourcen

- [IFC 4.3 Dokumentation](https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/)
- [web-ifc GitHub](https://github.com/IFCjs/web-ifc)
- [React Three Fiber Docs](https://docs.pmnd.rs/react-three-fiber)
- [Zustand Docs](https://docs.pmnd.rs/zustand)
- [shadcn/ui](https://ui.shadcn.com/)
