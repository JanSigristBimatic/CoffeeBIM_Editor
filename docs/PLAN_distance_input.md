# Implementation Plan: Distanzeingabe für Linien-Elemente

## Übersicht

Feature zur direkten Eingabe von Distanzen beim Erstellen von Wänden, Böden und Theken.
Der Benutzer kann nach dem Setzen des Startpunkts eine exakte Länge eingeben.

## User Flow

### Beispiel: Wand zeichnen

```
1. User wählt Wand-Tool (W)
2. User klickt Startpunkt → Startpunkt gesetzt
3. User bewegt Maus → Vorschau-Linie folgt Cursor
4. OPTION A: User klickt → Wand erstellt mit Cursor-Position
   OPTION B: User tippt "3.5" + Enter → Wand erstellt mit 3.5m Länge
```

### Verhalten bei Distanzeingabe

| Modus | Richtungsbestimmung |
|-------|---------------------|
| **Orthogonal AN** | Automatisch: Horizontal oder Vertikal (basierend auf Cursor-Position) |
| **Orthogonal AUS** | Richtung vom Startpunkt zum aktuellen Cursor |

## Technische Architektur

### 1. Neuer State im `useToolStore`

```typescript
// In useToolStore.ts
interface DistanceInputState {
  active: boolean;           // Eingabemodus aktiv
  value: string;             // Aktueller Eingabewert (String für "3.5")
  direction: Vector2 | null; // Normalisierter Richtungsvektor
  referencePoint: Point2D | null; // Startpunkt
}

// Neuer State
distanceInput: DistanceInputState;

// Actions
setDistanceInputActive: (active: boolean) => void;
updateDistanceInputValue: (value: string) => void;
setDistanceDirection: (direction: Vector2) => void;
clearDistanceInput: () => void;
```

### 2. Neuer Hook: `useDistanceInput`

```typescript
// src/hooks/useDistanceInput.ts
export const useDistanceInput = () => {
  const {
    distanceInput,
    setDistanceInputActive,
    updateDistanceInputValue,
    clearDistanceInput
  } = useToolStore();

  // Berechnet Zielpunkt basierend auf Distanz und Richtung
  const calculateTargetPoint = (
    startPoint: Point2D,
    distance: number,
    direction: Vector2
  ): Point2D => {
    return {
      x: startPoint.x + direction.x * distance,
      y: startPoint.y + direction.y * distance
    };
  };

  // Keyboard-Handler für numerische Eingabe
  const handleKeyDown = (e: KeyboardEvent) => {
    // Nur wenn Startpunkt gesetzt
    if (!distanceInput.referencePoint) return;

    // Numerische Eingabe (0-9, Punkt, Komma)
    if (/^[0-9.,]$/.test(e.key)) {
      e.preventDefault();
      const newValue = distanceInput.value + e.key.replace(',', '.');
      updateDistanceInputValue(newValue);
      setDistanceInputActive(true);
    }

    // Backspace
    if (e.key === 'Backspace' && distanceInput.active) {
      e.preventDefault();
      updateDistanceInputValue(distanceInput.value.slice(0, -1));
    }

    // Enter = Bestätigen
    if (e.key === 'Enter' && distanceInput.active) {
      e.preventDefault();
      return {
        confirmed: true,
        distance: parseFloat(distanceInput.value)
      };
    }

    // Escape = Abbrechen
    if (e.key === 'Escape' && distanceInput.active) {
      e.preventDefault();
      clearDistanceInput();
    }

    return { confirmed: false };
  };

  return {
    isActive: distanceInput.active,
    inputValue: distanceInput.value,
    calculateTargetPoint,
    handleKeyDown,
    clearDistanceInput
  };
};
```

### 3. Integration in `useWallPlacement`

```typescript
// Anpassungen in useWallPlacement.ts
const useWallPlacement = () => {
  const { distanceInput, setDistanceDirection, clearDistanceInput } = useToolStore();
  const { calculateTargetPoint } = useDistanceInput();

  const handlePointerMove = useCallback((event: ThreeEvent<PointerEvent>) => {
    if (!wallPlacement.startPoint) return;

    const snapResult = snapFromEvent(event, wallPlacement.startPoint);

    // Richtung aktualisieren (für Distanzeingabe)
    const direction = normalizeVector({
      x: snapResult.point.x - wallPlacement.startPoint.x,
      y: snapResult.point.y - wallPlacement.startPoint.y
    });
    setDistanceDirection(direction);

    // Wenn Distanzeingabe aktiv: Preview basiert auf eingegebener Distanz
    if (distanceInput.active && distanceInput.value) {
      const distance = parseFloat(distanceInput.value);
      if (!isNaN(distance) && distance > 0) {
        const targetPoint = calculateTargetPoint(
          wallPlacement.startPoint,
          distance,
          direction
        );
        setWallPreviewEndPoint(targetPoint);
        return;
      }
    }

    // Standard: Preview folgt Cursor
    setWallPreviewEndPoint(snapResult.point);
  }, [wallPlacement.startPoint, distanceInput]);

  // Keyboard-Event für Distanzeingabe
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!wallPlacement.startPoint) return;

      // Numerische Eingabe starten
      if (/^[0-9]$/.test(e.key)) {
        // ... (siehe useDistanceInput)
      }

      // Enter: Wand mit eingegebener Distanz erstellen
      if (e.key === 'Enter' && distanceInput.active) {
        const distance = parseFloat(distanceInput.value);
        if (!isNaN(distance) && distance > 0) {
          const targetPoint = calculateTargetPoint(
            wallPlacement.startPoint,
            distance,
            distanceInput.direction!
          );
          createWall(wallPlacement.startPoint, targetPoint);
          clearDistanceInput();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [wallPlacement, distanceInput]);
};
```

### 4. Orthogonal-Modus Spezialfall

```typescript
// Bei Orthogonal-Modus: Richtung auf Achse beschränken
const getOrthogonalDirection = (
  startPoint: Point2D,
  cursorPoint: Point2D
): Vector2 => {
  const dx = Math.abs(cursorPoint.x - startPoint.x);
  const dy = Math.abs(cursorPoint.y - startPoint.y);

  if (dx >= dy) {
    // Horizontale Richtung
    return {
      x: cursorPoint.x > startPoint.x ? 1 : -1,
      y: 0
    };
  } else {
    // Vertikale Richtung
    return {
      x: 0,
      y: cursorPoint.y > startPoint.y ? 1 : -1
    };
  }
};

// In handlePointerMove bei Orthogonal-Modus:
if (snapSettings.orthogonal) {
  const direction = getOrthogonalDirection(startPoint, cursorPoint);
  setDistanceDirection(direction);
} else {
  // Freie Richtung zum Cursor
  const direction = normalizeVector(subtract(cursorPoint, startPoint));
  setDistanceDirection(direction);
}
```

### 5. UI-Komponente: `DistanceInputOverlay`

```typescript
// src/components/editor/DistanceInputOverlay.tsx
export const DistanceInputOverlay: React.FC = () => {
  const { distanceInput, cursorPosition } = useToolStore();

  if (!distanceInput.active || !cursorPosition) return null;

  // Position neben dem Cursor
  const style = {
    position: 'absolute',
    left: `${screenPosition.x + 20}px`,
    top: `${screenPosition.y - 20}px`,
    // ... weitere Styles
  };

  return (
    <div className="distance-input-overlay" style={style}>
      <span className="distance-value">
        {distanceInput.value || '0'}
      </span>
      <span className="distance-unit">m</span>
    </div>
  );
};
```

### 6. Visuelle Anzeige im 3D-View

```typescript
// In WallPreview.tsx oder separater Komponente
// Distanz-Label an der Vorschaulinie anzeigen

const DistanceLabel: React.FC<{
  start: Point2D;
  end: Point2D;
  inputDistance?: number;
}> = ({ start, end, inputDistance }) => {
  const actualDistance = distance(start, end);
  const displayValue = inputDistance ?? actualDistance;

  // Position: Mitte der Linie
  const midpoint = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2
  };

  return (
    <Html position={[midpoint.x, midpoint.y, 0.1]}>
      <div className="distance-label">
        {displayValue.toFixed(2)} m
      </div>
    </Html>
  );
};
```

## Implementierungsschritte

### Phase 1: State & Grundstruktur (2h)

1. **State erweitern** (`useToolStore.ts`)
   - `distanceInput` State hinzufügen
   - Actions implementieren

2. **Hook erstellen** (`useDistanceInput.ts`)
   - Keyboard-Handler
   - Zielpunkt-Berechnung
   - Eingabe-Validierung

### Phase 2: Wand-Integration (2h)

3. **`useWallPlacement` anpassen**
   - Richtungsberechnung bei Pointer-Move
   - Keyboard-Events integrieren
   - Preview mit Distanz-Override

4. **Orthogonal-Modus**
   - Richtung auf Achse beschränken
   - Toggle zwischen H/V bei gleicher Distanz

### Phase 3: UI-Feedback (1.5h)

5. **`DistanceInputOverlay` Komponente**
   - Position neben Cursor
   - Eingabewert anzeigen
   - Styling (prominent aber nicht störend)

6. **Distanz-Label auf Linie**
   - Aktuelle/eingegebene Distanz
   - Position an Linienmitte

### Phase 4: Slab & Counter Integration (2h)

7. **`useSlabPlacement` anpassen**
   - Gleiche Logik wie Wand
   - Für jeden Polygon-Segment

8. **`useCounterPlacement` anpassen**
   - Gleiche Logik wie Wand
   - Für jeden Pfad-Segment

### Phase 5: Polish & Edge Cases (1h)

9. **Edge Cases behandeln**
   - Ungültige Eingaben (NaN, 0, negativ)
   - Eingabe während Snap-Operation
   - Tool-Wechsel während Eingabe

10. **UX-Verbesserungen**
    - Tab-Taste für nächsten Punkt
    - Pfeil-Tasten für Richtungswechsel (bei Orthogonal)

## Dateiänderungen

| Datei | Änderung |
|-------|----------|
| `src/store/useToolStore.ts` | + distanceInput State & Actions |
| `src/hooks/useDistanceInput.ts` | Neu: Hook für Distanzeingabe-Logik |
| `src/hooks/useWallPlacement.ts` | Integration Distanzeingabe |
| `src/hooks/useSlabPlacement.ts` | Integration Distanzeingabe |
| `src/hooks/useCounterPlacement.ts` | Integration Distanzeingabe |
| `src/hooks/useKeyboardShortcuts.ts` | Event-Routing anpassen |
| `src/components/editor/DistanceInputOverlay.tsx` | Neu: UI-Overlay |
| `src/components/editor/WallPreview.tsx` | Distanz-Label hinzufügen |
| `src/components/editor/SlabPreview.tsx` | Distanz-Label hinzufügen |
| `src/components/editor/CounterPreview.tsx` | Distanz-Label hinzufügen |
| `src/lib/geometry/math.ts` | Helper-Funktionen |

## Keyboard-Mapping

| Taste | Aktion |
|-------|--------|
| `0-9` | Distanzwert eingeben |
| `.` / `,` | Dezimalstelle |
| `Backspace` | Letzte Ziffer löschen |
| `Enter` | Eingabe bestätigen, Element erstellen |
| `Escape` | Eingabe abbrechen (zurück zu Cursor-Modus) |
| `Tab` | (Optional) Eingabe bestätigen, nächsten Punkt starten |

## Verhalten-Matrix

| Zustand | Aktion | Ergebnis |
|---------|--------|----------|
| Kein Startpunkt | Nummer tippen | Ignoriert |
| Startpunkt gesetzt | Nummer tippen | Distanzeingabe aktiviert |
| Distanzeingabe aktiv | Maus bewegen | Richtung aktualisiert, Distanz bleibt |
| Distanzeingabe aktiv | Klick | Element erstellt mit eingegebener Distanz |
| Distanzeingabe aktiv | Enter | Element erstellt mit eingegebener Distanz |
| Distanzeingabe aktiv | Escape | Distanzeingabe abgebrochen |
| Distanzeingabe aktiv | Neue Nummer | Wert erweitert |
| Orthogonal + Distanz | Maus links/rechts von Start | Richtung horizontal |
| Orthogonal + Distanz | Maus oben/unten von Start | Richtung vertikal |
| Nicht-Orthogonal + Distanz | Maus bewegen | Richtung zeigt zu Cursor |

## Rollback-Strategie

Falls Probleme auftreten:

1. **State-Änderungen** sind isoliert in `distanceInput` - kann entfernt werden ohne andere Features zu beeinflussen
2. **Hook-Integration** erfolgt additiv - bestehende Funktionalität bleibt erhalten
3. **Git-Branch** für Feature: `feature/distance-input`

## Testfälle

```typescript
describe('Distance Input', () => {
  it('activates when number is typed after start point', () => {});
  it('calculates correct end point with distance', () => {});
  it('constrains direction in orthogonal mode', () => {});
  it('updates direction when mouse moves', () => {});
  it('creates element on Enter', () => {});
  it('cancels on Escape', () => {});
  it('handles decimal input correctly', () => {});
  it('ignores invalid input (letters)', () => {});
  it('works for wall placement', () => {});
  it('works for slab placement', () => {});
  it('works for counter placement', () => {});
});
```

## Geschätzter Aufwand

| Phase | Zeit |
|-------|------|
| Phase 1: State & Grundstruktur | 2h |
| Phase 2: Wand-Integration | 2h |
| Phase 3: UI-Feedback | 1.5h |
| Phase 4: Slab & Counter | 2h |
| Phase 5: Polish | 1h |
| **Total** | **~8.5h** |

## Abhängigkeiten

- Keine neuen npm-Pakete erforderlich
- Nutzt bestehende `@react-three/drei` für `Html` Komponente
- Nutzt bestehende Geometrie-Funktionen aus `math.ts`
