import { useCallback, useMemo } from 'react';
import type { BimElement, ElementType } from '@/types/bim';
import { useElementStore, useSelectionStore } from '@/store';

// Note: useCallback is used for change handlers below

interface MultiEditPanelProps {
  selectedElements: BimElement[];
}

/**
 * German labels for element types
 */
const ELEMENT_TYPE_LABELS: Record<ElementType, string> = {
  wall: 'Wand',
  door: 'Tür',
  window: 'Fenster',
  column: 'Säule',
  slab: 'Boden',
  furniture: 'Möbel',
  counter: 'Theke',
  space: 'Raum',
  stair: 'Treppe',
};

/**
 * Represents a property value that may vary across elements
 */
type MultiValue<T> = { type: 'same'; value: T } | { type: 'mixed' };

/**
 * Get common value across elements, returns 'mixed' if values differ
 */
function getCommonValue<T>(values: T[]): MultiValue<T> {
  if (values.length === 0) return { type: 'mixed' };
  const first = values[0];
  const allSame = values.every((v) => v === first);
  return allSame ? { type: 'same', value: first as T } : { type: 'mixed' };
}

/**
 * Multi-edit panel for batch editing multiple selected elements
 */
export function MultiEditPanel({ selectedElements }: MultiEditPanelProps) {
  const { updateElement } = useElementStore();
  const { clearSelection } = useSelectionStore();

  // Group elements by type
  const elementsByType = useMemo(() => {
    const groups = new Map<ElementType, BimElement[]>();
    for (const element of selectedElements) {
      const existing = groups.get(element.type) || [];
      existing.push(element);
      groups.set(element.type, existing);
    }
    return groups;
  }, [selectedElements]);

  // Check if all elements are the same type (for future use)
  const uniqueTypes = Array.from(elementsByType.keys());
  void uniqueTypes; // Reserved for future single-type optimizations

  // Wall-specific batch editing
  const wallElements = elementsByType.get('wall') || [];
  const wallThickness = useMemo(
    () => getCommonValue(wallElements.map((e) => e.wallData?.thickness ?? 0)),
    [wallElements]
  );
  const wallHeight = useMemo(
    () => getCommonValue(wallElements.map((e) => e.wallData?.height ?? 0)),
    [wallElements]
  );

  const handleWallThicknessChange = useCallback(
    (newThickness: number) => {
      const clamped = Math.max(0.05, Math.min(1, newThickness));
      for (const element of wallElements) {
        if (element.wallData) {
          updateElement(element.id, {
            wallData: { ...element.wallData, thickness: clamped },
          });
        }
      }
    },
    [wallElements, updateElement]
  );

  const handleWallHeightChange = useCallback(
    (newHeight: number) => {
      const clamped = Math.max(0.5, Math.min(10, newHeight));
      for (const element of wallElements) {
        if (element.wallData) {
          updateElement(element.id, {
            wallData: { ...element.wallData, height: clamped },
          });
        }
      }
    },
    [wallElements, updateElement]
  );

  // Column-specific batch editing
  const columnElements = elementsByType.get('column') || [];
  const columnWidth = useMemo(
    () => getCommonValue(columnElements.map((e) => e.columnData?.width ?? 0)),
    [columnElements]
  );
  const columnDepth = useMemo(
    () => getCommonValue(columnElements.map((e) => e.columnData?.depth ?? 0)),
    [columnElements]
  );
  const columnHeight = useMemo(
    () => getCommonValue(columnElements.map((e) => e.columnData?.height ?? 0)),
    [columnElements]
  );

  const handleColumnDimensionChange = useCallback(
    (dimension: 'width' | 'depth' | 'height', newValue: number) => {
      const clamped = Math.max(0.05, Math.min(dimension === 'height' ? 10 : 2, newValue));
      for (const element of columnElements) {
        if (element.columnData) {
          updateElement(element.id, {
            columnData: { ...element.columnData, [dimension]: clamped },
          });
        }
      }
    },
    [columnElements, updateElement]
  );

  // Slab-specific batch editing
  const slabElements = elementsByType.get('slab') || [];
  const slabThickness = useMemo(
    () => getCommonValue(slabElements.map((e) => e.slabData?.thickness ?? 0)),
    [slabElements]
  );

  const handleSlabThicknessChange = useCallback(
    (newThickness: number) => {
      const clamped = Math.max(0.05, Math.min(1, newThickness));
      for (const element of slabElements) {
        if (element.slabData) {
          updateElement(element.id, {
            slabData: { ...element.slabData, thickness: clamped },
          });
        }
      }
    },
    [slabElements, updateElement]
  );

  // Counter-specific batch editing
  const counterElements = elementsByType.get('counter') || [];
  const counterDepth = useMemo(
    () => getCommonValue(counterElements.map((e) => e.counterData?.depth ?? 0)),
    [counterElements]
  );
  const counterHeight = useMemo(
    () => getCommonValue(counterElements.map((e) => e.counterData?.height ?? 0)),
    [counterElements]
  );

  const handleCounterDimensionChange = useCallback(
    (dimension: 'depth' | 'height', newValue: number) => {
      const clamped = Math.max(0.3, Math.min(dimension === 'height' ? 1.5 : 1, newValue));
      for (const element of counterElements) {
        if (element.counterData) {
          updateElement(element.id, {
            counterData: { ...element.counterData, [dimension]: clamped },
          });
        }
      }
    },
    [counterElements, updateElement]
  );

  return (
    <div className="space-y-4">
      {/* Selection Summary */}
      <div className="pb-3 border-b">
        <p className="text-sm font-medium">{selectedElements.length} Elemente ausgewählt</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {Array.from(elementsByType.entries()).map(([type, elements]) => (
            <span
              key={type}
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary"
            >
              {elements.length}× {ELEMENT_TYPE_LABELS[type]}
            </span>
          ))}
        </div>
      </div>

      {/* Same-type editing: Walls */}
      {wallElements.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-gray-600" />
            Wände ({wallElements.length})
          </h4>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Dicke (m)</label>
              <input
                type="number"
                value={wallThickness.type === 'same' ? wallThickness.value : ''}
                placeholder={wallThickness.type === 'mixed' ? 'Gemischt' : undefined}
                onChange={(e) => handleWallThicknessChange(parseFloat(e.target.value))}
                step={0.01}
                min={0.05}
                max={1}
                className="w-full mt-1 px-2 py-1.5 text-sm border rounded bg-background"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Höhe (m)</label>
              <input
                type="number"
                value={wallHeight.type === 'same' ? wallHeight.value : ''}
                placeholder={wallHeight.type === 'mixed' ? 'Gemischt' : undefined}
                onChange={(e) => handleWallHeightChange(parseFloat(e.target.value))}
                step={0.1}
                min={0.5}
                max={10}
                className="w-full mt-1 px-2 py-1.5 text-sm border rounded bg-background"
              />
            </div>
          </div>
        </div>
      )}

      {/* Same-type editing: Columns */}
      {columnElements.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-gray-500" />
            Säulen ({columnElements.length})
          </h4>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Breite (m)</label>
              <input
                type="number"
                value={columnWidth.type === 'same' ? columnWidth.value : ''}
                placeholder={columnWidth.type === 'mixed' ? 'Gemischt' : undefined}
                onChange={(e) => handleColumnDimensionChange('width', parseFloat(e.target.value))}
                step={0.05}
                min={0.05}
                max={2}
                className="w-full mt-1 px-2 py-1.5 text-sm border rounded bg-background"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Tiefe (m)</label>
              <input
                type="number"
                value={columnDepth.type === 'same' ? columnDepth.value : ''}
                placeholder={columnDepth.type === 'mixed' ? 'Gemischt' : undefined}
                onChange={(e) => handleColumnDimensionChange('depth', parseFloat(e.target.value))}
                step={0.05}
                min={0.05}
                max={2}
                className="w-full mt-1 px-2 py-1.5 text-sm border rounded bg-background"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Höhe (m)</label>
              <input
                type="number"
                value={columnHeight.type === 'same' ? columnHeight.value : ''}
                placeholder={columnHeight.type === 'mixed' ? 'Gemischt' : undefined}
                onChange={(e) => handleColumnDimensionChange('height', parseFloat(e.target.value))}
                step={0.1}
                min={0.5}
                max={10}
                className="w-full mt-1 px-2 py-1.5 text-sm border rounded bg-background"
              />
            </div>
          </div>
        </div>
      )}

      {/* Same-type editing: Slabs */}
      {slabElements.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-gray-400" />
            Böden ({slabElements.length})
          </h4>
          <div>
            <label className="text-xs text-muted-foreground">Dicke (m)</label>
            <input
              type="number"
              value={slabThickness.type === 'same' ? slabThickness.value : ''}
              placeholder={slabThickness.type === 'mixed' ? 'Gemischt' : undefined}
              onChange={(e) => handleSlabThicknessChange(parseFloat(e.target.value))}
              step={0.01}
              min={0.05}
              max={1}
              className="w-full mt-1 px-2 py-1.5 text-sm border rounded bg-background"
            />
          </div>
        </div>
      )}

      {/* Same-type editing: Counters */}
      {counterElements.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-amber-700" />
            Theken ({counterElements.length})
          </h4>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Tiefe (m)</label>
              <input
                type="number"
                value={counterDepth.type === 'same' ? counterDepth.value : ''}
                placeholder={counterDepth.type === 'mixed' ? 'Gemischt' : undefined}
                onChange={(e) => handleCounterDimensionChange('depth', parseFloat(e.target.value))}
                step={0.05}
                min={0.3}
                max={1}
                className="w-full mt-1 px-2 py-1.5 text-sm border rounded bg-background"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Höhe (m)</label>
              <input
                type="number"
                value={counterHeight.type === 'same' ? counterHeight.value : ''}
                placeholder={counterHeight.type === 'mixed' ? 'Gemischt' : undefined}
                onChange={(e) => handleCounterDimensionChange('height', parseFloat(e.target.value))}
                step={0.05}
                min={0.5}
                max={1.5}
                className="w-full mt-1 px-2 py-1.5 text-sm border rounded bg-background"
              />
            </div>
          </div>
        </div>
      )}

      {/* Info for non-editable types */}
      {(elementsByType.has('door') ||
        elementsByType.has('window') ||
        elementsByType.has('furniture') ||
        elementsByType.has('space') ||
        elementsByType.has('stair')) && (
        <div className="pt-3 border-t">
          <p className="text-xs text-muted-foreground">
            Türen, Fenster, Möbel, Räume und Treppen können einzeln bearbeitet werden.
          </p>
        </div>
      )}

      {/* Clear Selection Button */}
      <div className="pt-3 border-t">
        <button
          onClick={clearSelection}
          className="w-full px-3 py-2 text-sm font-medium text-muted-foreground bg-muted hover:bg-muted/80 rounded transition-colors"
        >
          Auswahl aufheben
        </button>
      </div>
    </div>
  );
}
