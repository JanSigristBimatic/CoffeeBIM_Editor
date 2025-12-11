# Implementation Plan: OpenCascade.js Integration

## Summary

Integration von OpenCascade.js als Geometrie-Engine in CoffeeBIM Editor, um echte Boolean-Operationen (CSG) und professionelle Fillets/Chamfers zu ermöglichen. Die Integration erfolgt **komplementär** zu web-ifc (IFC bleibt für Daten, OpenCascade für Geometrie).

**Approach:** Phasenweise Integration mit Custom WASM Build, Web Worker Pattern, und Feature Flags für sicheren Rollout.

## Codebase Profile

```
Primary Language: TypeScript
Framework: React 18 + Vite
3D Rendering: three.js + @react-three/fiber
IFC Processing: web-ifc v0.0.66
State: Zustand
Structure: src/{components, bim, lib, store, hooks, types}
Key Integration Points:
  - src/lib/geometry/ (wallCorners.ts, pathOffset.ts)
  - src/bim/elements/ (Wall.ts, Door.ts, Window.ts, Counter.ts)
  - src/bim/ifc/IfcExporter.ts
```

## File Changes

### New Files (7)

| File | Purpose | Lines (est.) |
|------|---------|--------------|
| `src/lib/opencascade/index.ts` | Public API & Lazy Loading | ~50 |
| `src/lib/opencascade/worker.ts` | Web Worker für heavy operations | ~150 |
| `src/lib/opencascade/operations.ts` | Boolean, Fillet, Extrusion wrappers | ~300 |
| `src/lib/opencascade/converters.ts` | OCCT Shape <-> Three.js Mesh | ~200 |
| `src/lib/opencascade/types.ts` | TypeScript interfaces | ~80 |
| `src/hooks/useOcctOperation.ts` | React hook für async operations | ~60 |
| `opencascade.build.yml` | Custom Build Config (Docker) | ~40 |

### Modified Files (5)

| File | Changes | Risk |
|------|---------|------|
| `package.json` | Add opencascade.js dependency | LOW |
| `vite.config.ts` | WASM loader config, Worker setup | LOW |
| `src/bim/elements/Wall.ts` | Optional OCCT boolean for openings | MEDIUM |
| `src/bim/elements/Counter.ts` | Optional OCCT fillet for edges | MEDIUM |
| `src/store/useSettingsStore.ts` | Feature flag: useOpenCascade | LOW |

### Unchanged (Critical)

- `src/bim/ifc/IfcExporter.ts` - IFC export bleibt unverändert
- `src/lib/geometry/wallCorners.ts` - Fallback bleibt erhalten
- `web-ifc` - Bleibt für IFC I/O

## Implementation Steps

### Phase 1: Foundation (Tag 1-2)

#### Step 1.1: Package Installation & Vite Config
```bash
npm install opencascade.js@beta
```

**Task:** Vite für WASM und Web Worker konfigurieren

**File:** `vite.config.ts`
```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  // ... existing config
  optimizeDeps: {
    exclude: ['opencascade.js']
  },
  worker: {
    format: 'es'
  },
  assetsInclude: ['**/*.wasm']
});
```

**Verification:** `npm run build` erfolgreich

---

#### Step 1.2: Feature Flag einrichten

**File:** `src/store/useSettingsStore.ts`
```typescript
interface SettingsState {
  // ... existing
  useOpenCascade: boolean;
  occtLoadState: 'idle' | 'loading' | 'ready' | 'error';
}

// Default: false (opt-in)
useOpenCascade: false,
occtLoadState: 'idle',
```

**Verification:** Settings Panel zeigt Toggle (deaktiviert)

---

#### Step 1.3: TypeScript Interfaces

**File:** `src/lib/opencascade/types.ts`
```typescript
import type { Point2D } from '@/types/geometry';

export interface OcctShape {
  ptr: number;  // WASM pointer
}

export interface BooleanOperationParams {
  type: 'cut' | 'fuse' | 'common';
  object: OcctShape;
  tool: OcctShape;
  fuzzyValue?: number;  // Default: 0.001
}

export interface FilletParams {
  shape: OcctShape;
  radius: number;
  edges?: number[];  // Specific edges, or all if empty
}

export interface ExtrusionParams {
  profile: Point2D[];
  height: number;
  direction?: { x: number; y: number; z: number };
}

export interface MeshData {
  vertices: Float32Array;
  indices: Uint32Array;
  normals: Float32Array;
}
```

**Verification:** TypeScript compilation ohne Fehler

---

### Phase 2: Core Engine (Tag 3-5)

#### Step 2.1: Web Worker Setup

**File:** `src/lib/opencascade/worker.ts`
```typescript
/// <reference lib="webworker" />

import initOpenCascade, { OpenCascadeInstance } from 'opencascade.js';

let oc: OpenCascadeInstance | null = null;

// Initialize on first message
self.onmessage = async (e: MessageEvent) => {
  const { type, id, payload } = e.data;

  try {
    if (type === 'init') {
      if (!oc) {
        oc = await initOpenCascade();
        self.postMessage({ id, type: 'init', success: true });
      }
      return;
    }

    if (!oc) throw new Error('OpenCascade not initialized');

    switch (type) {
      case 'boolean':
        const result = performBoolean(oc, payload);
        self.postMessage({ id, type: 'result', data: result });
        break;
      case 'fillet':
        const filleted = performFillet(oc, payload);
        self.postMessage({ id, type: 'result', data: filleted });
        break;
      case 'extrude':
        const extruded = performExtrusion(oc, payload);
        self.postMessage({ id, type: 'result', data: extruded });
        break;
      default:
        throw new Error(`Unknown operation: ${type}`);
    }
  } catch (error) {
    self.postMessage({ id, type: 'error', error: String(error) });
  }
};

function performBoolean(oc: OpenCascadeInstance, params: BooleanOperationParams) {
  const { type, object, tool, fuzzyValue = 0.001 } = params;

  let builder;
  switch (type) {
    case 'cut':
      builder = new oc.BRepAlgoAPI_Cut_3(object, tool, new oc.Message_ProgressRange_1());
      break;
    case 'fuse':
      builder = new oc.BRepAlgoAPI_Fuse_3(object, tool, new oc.Message_ProgressRange_1());
      break;
    case 'common':
      builder = new oc.BRepAlgoAPI_Common_3(object, tool, new oc.Message_ProgressRange_1());
      break;
  }

  builder.SetFuzzyValue(fuzzyValue);
  builder.Build();

  if (builder.HasErrors()) {
    throw new Error('Boolean operation failed');
  }

  return shapeToMesh(oc, builder.Shape());
}

function performFillet(oc: OpenCascadeInstance, params: FilletParams) {
  const { shape, radius, edges } = params;

  const fillet = new oc.BRepFilletAPI_MakeFillet(shape);

  // Add all edges or specific ones
  const explorer = new oc.TopExp_Explorer_2(
    shape,
    oc.TopAbs_ShapeEnum.TopAbs_EDGE,
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE
  );

  let edgeIndex = 0;
  while (explorer.More()) {
    if (!edges || edges.includes(edgeIndex)) {
      fillet.Add_2(radius, oc.TopoDS.Edge_1(explorer.Current()));
    }
    explorer.Next();
    edgeIndex++;
  }

  fillet.Build();

  if (!fillet.IsDone()) {
    throw new Error('Fillet operation failed');
  }

  return shapeToMesh(oc, fillet.Shape());
}

function shapeToMesh(oc: OpenCascadeInstance, shape: OcctShape): MeshData {
  // Triangulate the shape
  new oc.BRepMesh_IncrementalMesh_2(shape, 0.1, false, 0.5, true);

  const vertices: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];

  // Extract mesh data from faces
  const explorer = new oc.TopExp_Explorer_2(
    shape,
    oc.TopAbs_ShapeEnum.TopAbs_FACE,
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE
  );

  while (explorer.More()) {
    const face = oc.TopoDS.Face_1(explorer.Current());
    const location = new oc.TopLoc_Location_1();
    const triangulation = oc.BRep_Tool.Triangulation(face, location);

    if (!triangulation.IsNull()) {
      const nbNodes = triangulation.get().NbNodes();
      const nbTriangles = triangulation.get().NbTriangles();
      const offset = vertices.length / 3;

      // Extract vertices
      for (let i = 1; i <= nbNodes; i++) {
        const node = triangulation.get().Node(i);
        vertices.push(node.X(), node.Y(), node.Z());

        // Compute normal (simplified)
        const normal = triangulation.get().Normal(i);
        normals.push(normal.X(), normal.Y(), normal.Z());
      }

      // Extract indices
      for (let i = 1; i <= nbTriangles; i++) {
        const tri = triangulation.get().Triangle(i);
        indices.push(
          offset + tri.Value(1) - 1,
          offset + tri.Value(2) - 1,
          offset + tri.Value(3) - 1
        );
      }
    }

    explorer.Next();
  }

  return {
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
    normals: new Float32Array(normals)
  };
}
```

**Verification:** Worker lädt ohne Fehler in DevTools

---

#### Step 2.2: Public API mit Lazy Loading

**File:** `src/lib/opencascade/index.ts`
```typescript
import type { BooleanOperationParams, FilletParams, ExtrusionParams, MeshData } from './types';

let worker: Worker | null = null;
let messageId = 0;
const pendingRequests = new Map<number, { resolve: Function; reject: Function }>();

export async function initOpenCascade(): Promise<void> {
  if (worker) return;

  worker = new Worker(
    new URL('./worker.ts', import.meta.url),
    { type: 'module' }
  );

  worker.onmessage = (e) => {
    const { id, type, data, error } = e.data;
    const pending = pendingRequests.get(id);
    if (!pending) return;

    pendingRequests.delete(id);
    if (type === 'error') {
      pending.reject(new Error(error));
    } else {
      pending.resolve(data);
    }
  };

  return sendMessage('init', null);
}

function sendMessage<T>(type: string, payload: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = ++messageId;
    pendingRequests.set(id, { resolve, reject });
    worker?.postMessage({ type, id, payload });
  });
}

export async function booleanOperation(params: BooleanOperationParams): Promise<MeshData> {
  await initOpenCascade();
  return sendMessage('boolean', params);
}

export async function filletOperation(params: FilletParams): Promise<MeshData> {
  await initOpenCascade();
  return sendMessage('fillet', params);
}

export async function extrudeProfile(params: ExtrusionParams): Promise<MeshData> {
  await initOpenCascade();
  return sendMessage('extrude', params);
}

export function isOpenCascadeReady(): boolean {
  return worker !== null;
}

export function disposeOpenCascade(): void {
  worker?.terminate();
  worker = null;
  pendingRequests.clear();
}
```

**Verification:** `initOpenCascade()` resolved ohne Timeout

---

#### Step 2.3: React Hook

**File:** `src/hooks/useOcctOperation.ts`
```typescript
import { useState, useCallback } from 'react';
import { useSettingsStore } from '@/store/useSettingsStore';
import * as occt from '@/lib/opencascade';
import type { MeshData } from '@/lib/opencascade/types';

interface UseOcctOperationResult<T> {
  execute: (params: T) => Promise<MeshData | null>;
  loading: boolean;
  error: string | null;
  isAvailable: boolean;
}

export function useOcctBoolean(): UseOcctOperationResult<Parameters<typeof occt.booleanOperation>[0]> {
  const useOpenCascade = useSettingsStore((s) => s.useOpenCascade);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async (params: Parameters<typeof occt.booleanOperation>[0]) => {
    if (!useOpenCascade) return null;

    setLoading(true);
    setError(null);

    try {
      const result = await occt.booleanOperation(params);
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      return null;
    } finally {
      setLoading(false);
    }
  }, [useOpenCascade]);

  return {
    execute,
    loading,
    error,
    isAvailable: useOpenCascade
  };
}

export function useOcctFillet(): UseOcctOperationResult<Parameters<typeof occt.filletOperation>[0]> {
  // Similar implementation...
}
```

**Verification:** Hook kompiliert, returns correct types

---

### Phase 3: Integration (Tag 6-8)

#### Step 3.1: Wall Opening Boolean (Optional Enhancement)

**File:** `src/bim/elements/Wall.ts` (Modification)

```typescript
// Add at top
import { useSettingsStore } from '@/store/useSettingsStore';
import * as occt from '@/lib/opencascade';

// Add new function
export async function createWallWithOpenings(
  wall: BimElement,
  openings: Opening[]
): Promise<MeshData | null> {
  const useOcct = useSettingsStore.getState().useOpenCascade;

  if (!useOcct || openings.length === 0) {
    return null; // Use traditional mesh generation
  }

  try {
    // Create wall solid
    let wallShape = await occt.extrudeProfile({
      profile: wall.geometry.profile,
      height: wall.geometry.height
    });

    // Cut each opening
    for (const opening of openings) {
      const openingShape = await createOpeningShape(opening, wall);
      wallShape = await occt.booleanOperation({
        type: 'cut',
        object: wallShape,
        tool: openingShape,
        fuzzyValue: 0.001
      });
    }

    return wallShape;
  } catch (error) {
    console.warn('OCCT wall generation failed, using fallback:', error);
    return null;
  }
}

async function createOpeningShape(opening: Opening, wall: BimElement) {
  // Create box for door/window opening
  const { width, height, sillHeight } = opening;
  const profile: Point2D[] = [
    { x: -width / 2, y: -wall.wallData!.thickness / 2 - 0.1 },
    { x: width / 2, y: -wall.wallData!.thickness / 2 - 0.1 },
    { x: width / 2, y: wall.wallData!.thickness / 2 + 0.1 },
    { x: -width / 2, y: wall.wallData!.thickness / 2 + 0.1 },
  ];

  return occt.extrudeProfile({
    profile,
    height,
    // Position would need transformation based on opening position
  });
}
```

**Verification:** Toggle Feature Flag, Wall mit Door zeigt Boolean-Öffnung

---

#### Step 3.2: Counter Fillet (Optional Enhancement)

**File:** `src/bim/elements/Counter.ts` (Modification)

```typescript
// Add new export
export async function createCounterWithFillets(
  counter: BimElement,
  filletRadius: number = 0.02 // 2cm default
): Promise<MeshData | null> {
  const useOcct = useSettingsStore.getState().useOpenCascade;

  if (!useOcct) return null;

  try {
    // Extrude counter profile
    const counterShape = await occt.extrudeProfile({
      profile: counter.geometry.profile,
      height: counter.geometry.height
    });

    // Apply fillet to top edges
    const filletedShape = await occt.filletOperation({
      shape: counterShape,
      radius: filletRadius,
      // Top edges would be identified by index
    });

    return filletedShape;
  } catch (error) {
    console.warn('OCCT counter fillet failed:', error);
    return null;
  }
}
```

**Verification:** Counter mit aktiviertem OCCT zeigt abgerundete Kanten

---

### Phase 4: Custom Build (Optimierung)

#### Step 4.1: Docker Custom Build Config

**File:** `opencascade.build.yml`
```yaml
# OpenCascade.js Custom Build Configuration
# Run: docker run --rm -v $(pwd):/src ocjs/builder

version: "1.0"

# Only include required modules for smaller bundle
modules:
  - BRepAlgoAPI      # Boolean Operations (Cut, Fuse, Common)
  - BRepFilletAPI    # Fillets and Chamfers
  - BRepPrimAPI      # Primitive shapes (Box, Cylinder)
  - BRepBuilderAPI   # Shape construction
  - BRepMesh         # Triangulation for Three.js
  - BRepOffsetAPI    # Offset/Thick solid (for future use)
  - TopExp           # Topology exploration
  - TopoDS           # Topology data structure
  - gp               # Geometric primitives

# Optimization flags
optimizations:
  level: 3           # -O3 for dead code elimination
  lto: true          # Link-time optimization

# Output
output:
  name: "coffeebim-occt"
  formats:
    - js
    - wasm
    - d.ts

# Estimated size: ~3-5 MB (vs 13 MB full)
```

**Verification:** Custom build < 5 MB gzipped

---

## Test Plan

### Unit Tests

```typescript
// src/lib/opencascade/__tests__/operations.test.ts

describe('OpenCascade Operations', () => {
  beforeAll(async () => {
    await initOpenCascade();
  });

  test('boolean cut creates valid mesh', async () => {
    const box1 = await createBox(10, 10, 10);
    const box2 = await createBox(5, 5, 20);

    const result = await booleanOperation({
      type: 'cut',
      object: box1,
      tool: box2
    });

    expect(result.vertices.length).toBeGreaterThan(0);
    expect(result.indices.length).toBeGreaterThan(0);
  });

  test('fillet operation adds smoothed edges', async () => {
    const box = await createBox(10, 10, 10);

    const result = await filletOperation({
      shape: box,
      radius: 1
    });

    // Filleted box has more vertices than sharp box
    expect(result.vertices.length).toBeGreaterThan(24 * 3);
  });

  test('handles invalid geometry gracefully', async () => {
    await expect(
      booleanOperation({
        type: 'cut',
        object: { ptr: 0 }, // Invalid
        tool: { ptr: 0 }
      })
    ).rejects.toThrow();
  });
});
```

### Integration Tests

```typescript
// src/bim/elements/__tests__/Wall.integration.test.ts

describe('Wall with OCCT Boolean', () => {
  beforeEach(() => {
    useSettingsStore.setState({ useOpenCascade: true });
  });

  test('wall with door creates proper opening', async () => {
    const wall = createWall({ /* params */ });
    const door = createDoor({ hostWallId: wall.id, /* params */ });

    const mesh = await createWallWithOpenings(wall, [door.doorData!]);

    expect(mesh).not.toBeNull();
    // Opening should reduce vertex count in door area
  });

  test('falls back gracefully when OCCT disabled', async () => {
    useSettingsStore.setState({ useOpenCascade: false });

    const wall = createWall({ /* params */ });
    const mesh = await createWallWithOpenings(wall, []);

    expect(mesh).toBeNull(); // Signals to use traditional mesh
  });
});
```

### Manual Tests

| Test | Steps | Expected |
|------|-------|----------|
| Feature Flag Toggle | Settings > Enable OpenCascade | Status changes, WASM loads |
| Wall + Door | Create wall, add door, check 3D | Clean boolean opening visible |
| Counter Fillet | Create counter, check edges | Rounded edges on countertop |
| Performance | Create 10 walls with doors | < 2s total processing |
| Fallback | Disable flag mid-session | Traditional meshes used |

---

## Risks & Mitigations

### Risk 1: Bundle Size Impact
- **Probability:** HIGH
- **Impact:** MEDIUM (load time)
- **Mitigation:** Custom build + lazy loading + caching
- **Detection:** Lighthouse CI check
- **Contingency:** Ship full build initially, optimize later

### Risk 2: WASM Initialization Failure
- **Probability:** LOW
- **Impact:** HIGH (feature unavailable)
- **Mitigation:** Feature flag off by default, graceful fallback
- **Detection:** Error boundary + logging
- **Contingency:** Traditional mesh generation always available

### Risk 3: Boolean Operation Failure
- **Probability:** MEDIUM (edge cases)
- **Impact:** MEDIUM (visual glitch)
- **Mitigation:** FuzzyValue tuning, try-catch with fallback
- **Detection:** Console warnings
- **Contingency:** Skip OCCT for problematic geometry

### Risk 4: Memory Leaks in WASM
- **Probability:** MEDIUM
- **Impact:** HIGH (browser crash)
- **Mitigation:** Explicit cleanup, WeakRef for shapes
- **Detection:** Memory profiling in tests
- **Contingency:** Worker restart on high memory

### Risk 5: Browser Compatibility
- **Probability:** LOW (WASM well-supported)
- **Impact:** HIGH (feature unavailable)
- **Mitigation:** `isWasmSupported()` check, Safari testing
- **Detection:** Feature detection on load
- **Contingency:** Feature flag remains disabled

---

## Rollback Plan

### Immediate Rollback (< 1 min)
```typescript
// In useSettingsStore
useOpenCascade: false, // Set default to false
```
All OCCT code is opt-in, setting to false disables all OCCT paths.

### Git Rollback
```bash
# If issues discovered post-merge
git revert HEAD~N  # Revert OCCT commits
# Or
git reset --hard <pre-occt-commit>
```

### Feature Flag Persistence
```typescript
// Clear user's stored preference
localStorage.removeItem('coffeebim-settings');
```

### Rollback Triggers
- [ ] Error rate > 5% in OCCT operations
- [ ] Load time increase > 3s
- [ ] Memory usage > 500MB
- [ ] Critical bug in boolean operations

---

## Success Criteria

### Functional
- [ ] Boolean Cut working for Door/Window openings
- [ ] Fillet working for Counter edges
- [ ] Feature flag properly enables/disables
- [ ] Fallback to traditional mesh when OCCT fails

### Performance
- [ ] Initial load (with OCCT): < 5s
- [ ] Boolean operation: < 500ms
- [ ] Fillet operation: < 300ms
- [ ] Memory footprint: < 200MB additional

### Quality
- [ ] 0 TypeScript errors
- [ ] 0 ESLint errors
- [ ] Unit test coverage > 80%
- [ ] No console errors in production

---

## Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Foundation | 2 days | None |
| Phase 2: Core Engine | 3 days | Phase 1 |
| Phase 3: Integration | 3 days | Phase 2 |
| Phase 4: Custom Build | 1 day | Phase 3 (optional) |
| Testing & Polish | 2 days | Phase 3 |
| **Total** | **~11 days** | |

---

## Appendix: Context7 API Reference

### BRepAlgoAPI Boolean Operations
```cpp
BRepAlgoAPI_Cut(S1, S2)    // S1 - S2
BRepAlgoAPI_Fuse(S1, S2)   // S1 + S2
BRepAlgoAPI_Common(S1, S2) // S1 ∩ S2

// Usage pattern:
builder.SetFuzzyValue(0.001);
builder.Build();
if (builder.HasErrors()) { /* handle */ }
const result = builder.Shape();
```

### BRepFilletAPI
```cpp
BRepFilletAPI_MakeFillet(shape)
  .Add(radius, edge)
  .Build()
  .Shape()
```

### Key Configuration
- **FuzzyValue:** `0.001` (prevent geometry collapse)
- **Mesh tolerance:** `0.1` (triangulation quality)
- **Multi-threading:** Requires SharedArrayBuffer (COOP/COEP headers)

---

**Plan erstellt:** 2024-12-10
**Confidence:** HIGH
**Ready for implementation:** YES
