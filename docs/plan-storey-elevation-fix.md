# Plan: Storey Elevation für Preview, Snap und Bemaßungen

## Problem
Preview-Elemente, SnapIndicator und Bemaßungen werden immer auf Z=0 gezeichnet, statt auf der Elevation des aktiven Stockwerks.

## Bereits behoben
- ✅ `Grid.tsx` - Grid auf `storeyElevation` verschoben
- ✅ `GroundPlane.tsx` - Interactive Plane auf `storeyElevation` verschoben
- ✅ `Slab.ts` - `elevation` Parameter hinzugefügt
- ✅ `SlabCompleteDialog.tsx` - `storeyElevation` an `createSlab` und `createWall` übergeben

## Noch zu beheben

### 1. SnapIndicator.tsx
**Problem:** Z-Position hardcoded auf `INDICATOR_HEIGHT` (0.05)

**Änderungen:**
```tsx
// Import hinzufügen
import { useProjectStore } from '@/store';

// In der Komponente:
const { activeStoreyId, storeys } = useProjectStore();
const activeStorey = storeys.find(s => s.id === activeStoreyId);
const storeyElevation = activeStorey?.elevation ?? 0;

// Position anpassen (Zeile ~199):
<group position={[snapInfo.point.x, snapInfo.point.y, storeyElevation + INDICATOR_HEIGHT]}>
```

### 2. WallPreview.tsx
**Problem:** Mehrere hardcodierte Z-Werte

**Änderungen:**
```tsx
// Import hinzufügen
import { useProjectStore } from '@/store';

// In der Komponente:
const { activeStoreyId, storeys } = useProjectStore();
const activeStorey = storeys.find(s => s.id === activeStoreyId);
const storeyElevation = activeStorey?.elevation ?? 0;

// Zeile 63 - transform.position:
position: new THREE.Vector3(startPoint.x, startPoint.y, storeyElevation),

// Zeile 109 - Label position:
position={[labelData.midpoint.x, labelData.midpoint.y, storeyElevation + DEFAULT_WALL_HEIGHT + 0.3]}
```

### 3. ColumnPreview.tsx
**Problem:** Z-Positionen hardcoded

**Änderungen:**
```tsx
// Import hinzufügen
import { useProjectStore } from '@/store';

// In der Komponente:
const { activeStoreyId, storeys } = useProjectStore();
const activeStorey = storeys.find(s => s.id === activeStoreyId);
const storeyElevation = activeStorey?.elevation ?? 0;

// Zeile 61 - Column mesh:
position={[previewPosition.x, previewPosition.y, storeyElevation + zOffset]}

// Zeile 69 - Line segments:
position={[previewPosition.x, previewPosition.y, storeyElevation + zOffset]}

// Zeile 78 - Ground marker:
position={[previewPosition.x, previewPosition.y, storeyElevation + 0.01]}
```

### 4. SlabPreview.tsx
**Problem:** Alle Z-Werte (0.01, 0.02, 0.03, 0.1) hardcoded

**Änderungen:**
```tsx
// Import hinzufügen
import { useProjectStore } from '@/store';

// In der Komponente:
const { activeStoreyId, storeys } = useProjectStore();
const activeStorey = storeys.find(s => s.id === activeStoreyId);
const storeyElevation = activeStorey?.elevation ?? 0;

// Alle Z-Werte anpassen:
// linePoints: z: storeyElevation + 0.02
// closingLine: z: storeyElevation + 0.02
// Point markers: z: storeyElevation + 0.03
// Preview point: z: storeyElevation + 0.03
// Distance label: z: storeyElevation + 0.1
// SlabFillPreview: z: storeyElevation + 0.01 (als prop übergeben)
```

### 5. CounterPreview.tsx
**Problem:** Alle Z-Werte (0.01, 0.02, 0.1, 0.5) hardcoded

**Änderungen:**
```tsx
// Import hinzufügen
import { useProjectStore } from '@/store';

// In der Komponente:
const { activeStoreyId, storeys } = useProjectStore();
const activeStorey = storeys.find(s => s.id === activeStoreyId);
const storeyElevation = activeStorey?.elevation ?? 0;

// Alle Z-Werte anpassen (ähnlich wie SlabPreview)
// createOutlinePoints: z: storeyElevation + 0.01
// frontLinePoints/backLinePoints: z: storeyElevation + 0.02
// pointMarkers/previewPoint: z: storeyElevation + 0.02
// Helper text: z: storeyElevation + 0.5
// Distance label: z: storeyElevation + 0.1
```

### 6. AssetPreview.tsx
**Problem:** Z-Position hardcoded auf 0

**Änderungen:**
```tsx
// Import hinzufügen
import { useProjectStore } from '@/store';

// In der Komponente:
const { activeStoreyId, storeys } = useProjectStore();
const activeStorey = storeys.find(s => s.id === activeStoreyId);
const storeyElevation = activeStorey?.elevation ?? 0;

// Zeile 30:
<group position={[position.x, position.y, storeyElevation]} rotation={[0, 0, rotationRad]}>
```

### 7. SpacePreview.tsx
**Prüfen:** Wahrscheinlich ähnliche Probleme wie SlabPreview

### 8. StairPreview.tsx
**Prüfen:** Treppen sind komplex - sie verbinden Stockwerke, daher spezielle Behandlung nötig

### 9. DoorPreview.tsx & WindowPreview.tsx
**Wahrscheinlich OK:** Diese positionieren sich relativ zu Wänden, die bereits elevation haben.
Trotzdem prüfen ob Preview-Elemente korrekt positioniert sind.

## Implementierungsreihenfolge

1. **SnapIndicator.tsx** - Höchste Priorität (wird bei jedem Tool verwendet)
2. **WallPreview.tsx** - Häufig verwendet
3. **SlabPreview.tsx** - Häufig verwendet
4. **ColumnPreview.tsx** - Mittel
5. **CounterPreview.tsx** - Mittel
6. **AssetPreview.tsx** - Mittel
7. **SpacePreview.tsx** - Prüfen
8. **StairPreview.tsx** - Prüfen (komplex)
9. **DoorPreview/WindowPreview** - Prüfen

## Refactoring-Möglichkeit

Um Code-Duplikation zu vermeiden, könnte ein Hook erstellt werden:

```tsx
// hooks/useStoreyElevation.ts
export function useStoreyElevation(): number {
  const { activeStoreyId, storeys } = useProjectStore();
  const activeStorey = storeys.find(s => s.id === activeStoreyId);
  return activeStorey?.elevation ?? 0;
}
```

Dann in allen Komponenten:
```tsx
const storeyElevation = useStoreyElevation();
```

## Testplan

1. Neues Stockwerk mit Elevation 3.0 erstellen
2. Stockwerk aktivieren
3. Prüfen:
   - [ ] Grid ist auf Höhe 3.0
   - [ ] SnapIndicator erscheint auf Höhe 3.0
   - [ ] WallPreview erscheint auf Höhe 3.0
   - [ ] SlabPreview erscheint auf Höhe 3.0
   - [ ] ColumnPreview erscheint auf Höhe 3.0
   - [ ] CounterPreview erscheint auf Höhe 3.0
   - [ ] AssetPreview erscheint auf Höhe 3.0
   - [ ] Erstellte Elemente haben Z=3.0
   - [ ] Bemaßungen werden auf korrekter Höhe angezeigt
