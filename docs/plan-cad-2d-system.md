# Plan: Klassisches CAD 2D-System

## Status: ENTWURF - Zur Diskussion

---

## 1. Problemanalyse

### Aktueller Zustand
- **Ein Canvas** mit 2D/3D-Toggle (`V`-Taste)
- 2D = orthografische Kamera von oben im gleichen React-Three-Fiber Canvas
- Keine echte CAD-Erfahrung, nur "3D von oben"
- Gleiche Mesh-Darstellung in beiden Modi

### Probleme
1. **Keine CAD-typische Darstellung:** Wände als gefüllte Rechtecke statt Linien mit Schraffur
2. **Keine 2D-spezifischen Annotationen:** Maßketten, Beschriftungen, Raumlabels
3. **Keine Layer-Kontrolle:** In CAD kann man Layer ein/ausblenden
4. **Keine klassische CAD-Navigation:** Zoom zu Fenster, Pan mit Mitteltaste, etc.
5. **Keine Zeichenwerkzeuge:** Hilfslinien, Konstruktionslinien, Referenzpunkte

---

## 2. Lösungsoptionen

### Option A: Separates Browser-Fenster (Multi-Window)
```
┌─────────────────┐    ┌─────────────────┐
│   3D Editor     │    │   2D CAD View   │
│ (Hauptfenster)  │    │ (Popup-Fenster) │
│                 │    │                 │
│  ┌───────────┐  │    │  ┌───────────┐  │
│  │  Canvas3D │  │    │  │ Canvas2D  │  │
│  └───────────┘  │    │  └───────────┘  │
└─────────────────┘    └─────────────────┘
        ↑                      ↑
        └──── Shared State ────┘
```

**Vorteile:**
- Echte Multi-Monitor-Unterstützung (2D auf einem, 3D auf anderem Bildschirm)
- Unabhängige Fenstergrößen
- Klassisches CAD-Workflow-Feeling

**Nachteile:**
- Komplexe State-Synchronisation (BroadcastChannel API oder SharedWorker)
- Browser-Popup-Blocker könnten stören
- Zwei React-Apps synchron halten

---

### Option B: Split-View im gleichen Fenster
```
┌──────────────────────────────────────┐
│              Toolbar                 │
├──────────────────┬───────────────────┤
│                  │                   │
│    2D CAD View   │    3D Editor      │
│    (Canvas2D)    │    (Canvas3D)     │
│                  │                   │
│  ─────┐  ┌─────  │                   │
│       │  │       │      ╱╲           │
│       └──┘       │     ╱  ╲          │
│                  │    ╱    ╲         │
├──────────────────┴───────────────────┤
│              Status Bar              │
└──────────────────────────────────────┘
```

**Vorteile:**
- Keine Multi-Window-Komplexität
- Einfachere State-Synchronisation
- Beide Ansichten immer sichtbar
- Resizable Splitter möglich

**Nachteile:**
- Weniger Platz pro Ansicht
- Nicht ideal für kleinere Bildschirme

---

### Option C: Tab-basierte Ansichten
```
┌──────────────────────────────────────┐
│ [2D Grundriss] [3D Modell] [...]     │  ← Tabs
├──────────────────────────────────────┤
│                                      │
│         Aktive Ansicht               │
│     (entweder 2D oder 3D)            │
│                                      │
└──────────────────────────────────────┘
```

**Vorteile:**
- Maximaler Platz für aktive Ansicht
- Einfache Implementierung
- Erweiterbar (weitere Tabs: Schnitte, Ansichten)

**Nachteile:**
- Nur eine Ansicht zur Zeit sichtbar
- Ständiges Tab-Wechseln nötig

---

### Option D: Dockable Panels (wie AutoCAD/Revit)
```
┌──────────────────────────────────────┐
│              Toolbar                 │
├───────┬──────────────────────┬───────┤
│       │                      │       │
│ Hier- │    Hauptansicht      │ Prop- │
│ archie│    (3D oder 2D)      │ erties│
│       ├──────────────────────┤       │
│       │   2D Preview         │       │
│       │   (angedockt)        │       │
├───────┴──────────────────────┴───────┤
│              Status Bar              │
└──────────────────────────────────────┘
```

**Vorteile:**
- Maximale Flexibilität
- User kann Layout anpassen
- Professionelles Feeling

**Nachteile:**
- Komplexe Implementierung (Docking-Library nötig)
- Viel State für Layout-Persistenz

---

## 3. Empfehlung: Option B (Split-View) + Option C (Tabs)

### Kombination:
```
┌──────────────────────────────────────────────────────┐
│ [📋 Grundriss] [🏠 3D Modell] [📐 Schnitt A-A]       │
├──────────────────────────────────────────────────────┤
│                                                      │
│                  Aktiver Tab                         │
│                                                      │
│   ┌─────────────────┬────────────────────────────┐   │
│   │                 │                            │   │
│   │   2D CAD View   │      3D Preview            │   │
│   │   (Hauptfokus)  │      (Optional)            │   │
│   │                 │                            │   │
│   └─────────────────┴────────────────────────────┘   │
│                                                      │
└──────────────────────────────────────────────────────┘

Toggle: [Nur 2D] [Split 2D+3D] [Nur 3D]
```

**Warum diese Kombination?**
1. **Tabs** für verschiedene Ansichtstypen (Grundriss, 3D, Schnitte)
2. **Split-View** optional innerhalb eines Tabs
3. **Keyboard-Shortcut** `V` wechselt zwischen Split-Modi
4. **Erweiterbar** für zukünftige Features (Schnitte, Ansichten)

---

## 4. 2D CAD Canvas - Technische Spezifikation

### 4.1 Rendering-Technologie

**Zwei Optionen:**

#### A) HTML5 Canvas 2D API (Empfohlen für CAD)
```typescript
// Vorteile:
// - Perfekte Linien, kein Anti-Aliasing-Problem
// - Einfache Text-Rendering
// - Bewährte CAD-Bibliotheken (Fabric.js, Konva.js, Paper.js)
// - Performant für 2D-Zeichnungen

import Konva from 'konva';
// oder
import paper from 'paper';
```

#### B) React-Three-Fiber mit 2D-Geometrie
```typescript
// Vorteile:
// - Gleiche Geometrie-Daten wie 3D
// - Einfache Synchronisation
// Nachteile:
// - Overhead für echte 2D-Darstellung
// - Text-Rendering komplizierter
```

**Empfehlung:** HTML5 Canvas 2D (Option A) mit **Konva.js** oder **Paper.js**
- Bessere CAD-Erfahrung
- Einfacheres Text-Rendering für Maßketten
- Bewährte Lösung für technische Zeichnungen

---

### 4.2 CAD-spezifische Darstellung

#### Wände
```
Aktuell (3D-Mesh von oben):     CAD-Style:
┌────────────────────┐          ═══════════════════
│████████████████████│          ║                 ║
│████████████████████│    →     ║     (Schraffur) ║
│████████████████████│          ║                 ║
└────────────────────┘          ═══════════════════
```

#### Türen
```
CAD-Symbol:
    ┌──╮
    │  │
    │  │   ← 90° Öffnungsbogen
────┘  └────
```

#### Fenster
```
CAD-Symbol:
════╪════
    │
    │     ← Glaslinie
    │
════╪════
```

#### Räume
```
┌─────────────────┐
│                 │
│     Küche       │  ← Raumname
│    12.5 m²      │  ← Fläche
│                 │
└─────────────────┘
```

---

### 4.3 CAD-Navigation

| Aktion | Maus/Tastatur | Beschreibung |
|--------|---------------|--------------|
| Pan | Mitteltaste gedrückt + Drag | Ansicht verschieben |
| Zoom | Scrollrad | Rein/Raus zoomen |
| Zoom Fenster | `Z` + Rechteck ziehen | Auf Bereich zoomen |
| Zoom Extents | `E` oder Doppelklick Scrollrad | Alles zeigen |
| Zoom Previous | `P` | Letzte Zoom-Stufe |

---

### 4.4 CAD-Werkzeuge (2D-spezifisch)

| Werkzeug | Tastatur | Beschreibung |
|----------|----------|--------------|
| Hilfslinie | `H` | Konstruktions-Referenzlinie |
| Maßkette | `M` | Bemaßung hinzufügen |
| Text | `T` | Beschriftung |
| Referenzpunkt | `R` | Snap-Punkt setzen |

---

### 4.5 Layer-System

```typescript
interface Layer {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  locked: boolean;
  printable: boolean;
}

// Vordefinierte Layer:
const defaultLayers: Layer[] = [
  { id: 'walls', name: 'Wände', color: '#000000', visible: true, locked: false, printable: true },
  { id: 'doors', name: 'Türen', color: '#0000FF', visible: true, locked: false, printable: true },
  { id: 'windows', name: 'Fenster', color: '#00FFFF', visible: true, locked: false, printable: true },
  { id: 'furniture', name: 'Möbel', color: '#808080', visible: true, locked: false, printable: true },
  { id: 'dimensions', name: 'Bemaßung', color: '#FF0000', visible: true, locked: false, printable: true },
  { id: 'construction', name: 'Konstruktion', color: '#00FF00', visible: true, locked: true, printable: false },
  { id: 'rooms', name: 'Räume', color: '#FFFF00', visible: true, locked: false, printable: true },
];
```

---

## 5. Implementierungsplan

### Phase 1: Grundstruktur (1-2 Tage)
- [ ] Tab-System für Ansichten implementieren
- [ ] Split-View Container mit resizable Splitter
- [ ] Canvas2D Komponente mit Konva.js/Paper.js
- [ ] Basis-Navigation (Pan, Zoom)

### Phase 2: Element-Darstellung (2-3 Tage)
- [ ] Wände als CAD-Linien mit Dicke
- [ ] Türen mit Öffnungsbogen-Symbol
- [ ] Fenster mit Glas-Symbol
- [ ] Säulen als Kreise/Rechtecke
- [ ] Synchronisation mit Element-Store

### Phase 3: CAD-Features (2-3 Tage)
- [ ] Snap-System (Endpunkte, Mittelpunkte, Senkrechte)
- [ ] Raster-Snap
- [ ] Orthogonal-Modus
- [ ] Maßanzeige beim Zeichnen

### Phase 4: Annotationen (1-2 Tage)
- [ ] Maßketten-Tool
- [ ] Text/Beschriftungen
- [ ] Raumflächen-Berechnung und -Anzeige

### Phase 5: Layer & Polish (1-2 Tage)
- [ ] Layer-Panel mit Sichtbarkeit/Sperren
- [ ] Druckansicht / PDF-Export
- [ ] Keyboard-Shortcuts

---

## 6. Dateien & Struktur

```
src/
├── components/
│   ├── editor/
│   │   ├── Canvas3D.tsx          # Bestehend (3D)
│   │   ├── Canvas2D.tsx          # NEU: 2D CAD Canvas
│   │   ├── EditorTabs.tsx        # NEU: Tab-Container
│   │   ├── SplitView.tsx         # NEU: Resizable Split
│   │   └── cad/                   # NEU: 2D CAD Komponenten
│   │       ├── CadWall.tsx
│   │       ├── CadDoor.tsx
│   │       ├── CadWindow.tsx
│   │       ├── CadRoom.tsx
│   │       ├── DimensionLine.tsx
│   │       └── CadGrid.tsx
│   ├── panels/
│   │   └── LayerPanel.tsx        # NEU: Layer-Verwaltung
│
├── store/
│   ├── useLayerStore.ts          # NEU: Layer State
│   ├── useViewStore.ts           # Erweitern: Tab/Split State
│
├── lib/
│   └── cad/                       # NEU: CAD Utilities
│       ├── symbols.ts            # Tür/Fenster-Symbole
│       ├── dimensions.ts         # Maßketten-Logik
│       └── snap.ts               # 2D Snap-System
```

---

## 7. Offene Fragen

1. **Welche Option bevorzugst du?**
   - [ ] Option A: Separates Browser-Fenster
   - [ ] Option B: Split-View
   - [ ] Option C: Tabs
   - [ ] Option D: Dockable Panels
   - [ ] Kombination B+C (empfohlen)

2. **Rendering-Technologie für 2D?**
   - [ ] Konva.js (Empfohlen)
   - [ ] Paper.js
   - [ ] Pure Canvas 2D API
   - [ ] React-Three-Fiber (2D-Modus)

3. **Prioritäten bei CAD-Features?**
   - [ ] Maßketten zuerst
   - [ ] Layer-System zuerst
   - [ ] CAD-Symbole zuerst

4. **Soll 2D-Bearbeitung möglich sein?**
   - [ ] Nur Ansicht (Bearbeitung in 3D)
   - [ ] Volle Bearbeitung in 2D
   - [ ] Beides (empfohlen)

---

## 8. Nächste Schritte

Nach Entscheidung:
1. Rendering-Library installieren (npm install konva react-konva)
2. Tab-System implementieren
3. Basis Canvas2D mit Navigation
4. Erste Element-Darstellung (Wände)

---

*Plan erstellt: 2024-12-08*
*Status: Wartet auf Feedback*
