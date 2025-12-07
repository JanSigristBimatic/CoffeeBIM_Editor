import { useCallback } from 'react';
import type { BimElement, CounterType } from '@/types/bim';
import { useElementStore } from '@/store';
import { offsetPath, createCounterPolygon, calculatePathLength } from '@/lib/geometry/pathOffset';
import { AssetPropertySets } from './AssetPropertySets';

interface CounterPropertiesProps {
  element: BimElement;
}

const COUNTER_TYPES: { value: CounterType; label: string }[] = [
  { value: 'standard', label: 'Standard (90cm)' },
  { value: 'bar', label: 'Bar (110cm)' },
  { value: 'service', label: 'Service' },
];

/**
 * Recalculate the counter outline polygon when dimensions change
 */
function recalculateOutline(path: import('@/types/geometry').Point2D[], depth: number) {
  if (path.length < 2) return [];
  const backPath = offsetPath(path, depth);
  return createCounterPolygon(path, backPath);
}

/**
 * Counter-specific properties editor
 * Allows editing counter parameters after placement
 */
export function CounterProperties({ element }: CounterPropertiesProps) {
  const { updateElement } = useElementStore();
  const counterData = element.counterData;

  // Update counter data with recalculated geometry
  const updateCounter = useCallback(
    (updates: Partial<NonNullable<typeof counterData>>) => {
      if (!counterData) return;

      const newCounterData = { ...counterData, ...updates };

      // Recalculate outline if depth changed
      const newOutline = updates.depth !== undefined
        ? recalculateOutline(counterData.path, updates.depth)
        : element.geometry.profile;

      updateElement(element.id, {
        counterData: newCounterData,
        geometry: {
          ...element.geometry,
          profile: newOutline,
          height: updates.height ?? element.geometry.height,
        },
      });
    },
    [counterData, element, updateElement]
  );

  if (!counterData) {
    return <div className="text-sm text-muted-foreground">Theken-Daten nicht verfügbar</div>;
  }

  // Calculate metrics
  const pathLength = calculatePathLength(counterData.path);
  const area = pathLength * counterData.depth;
  const volume = area * counterData.height;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Theken-Parameter</h3>

      {/* Counter Type */}
      <div>
        <label className="text-xs text-muted-foreground">Theken-Typ</label>
        <select
          value={counterData.counterType}
          onChange={(e) => updateCounter({ counterType: e.target.value as CounterType })}
          className="w-full mt-1 px-2 py-1.5 text-sm border rounded bg-background"
        >
          {COUNTER_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      {/* Main Dimensions */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-muted-foreground">Tiefe (m)</label>
          <input
            type="number"
            value={counterData.depth}
            onChange={(e) => updateCounter({ depth: parseFloat(e.target.value) || counterData.depth })}
            step={0.05}
            min={0.3}
            max={1.5}
            className="w-full mt-1 px-2 py-1.5 text-sm border rounded bg-background"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Höhe (m)</label>
          <input
            type="number"
            value={counterData.height}
            onChange={(e) => updateCounter({ height: parseFloat(e.target.value) || counterData.height })}
            step={0.05}
            min={0.6}
            max={1.5}
            className="w-full mt-1 px-2 py-1.5 text-sm border rounded bg-background"
          />
        </div>
      </div>

      {/* Overhang and Top Thickness */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-muted-foreground">Überstand (m)</label>
          <input
            type="number"
            value={counterData.overhang}
            onChange={(e) => updateCounter({ overhang: parseFloat(e.target.value) || 0 })}
            step={0.05}
            min={0}
            max={0.5}
            className="w-full mt-1 px-2 py-1.5 text-sm border rounded bg-background"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Plattendicke (m)</label>
          <input
            type="number"
            value={counterData.topThickness}
            onChange={(e) => updateCounter({ topThickness: parseFloat(e.target.value) || counterData.topThickness })}
            step={0.01}
            min={0.02}
            max={0.1}
            className="w-full mt-1 px-2 py-1.5 text-sm border rounded bg-background"
          />
        </div>
      </div>

      {/* Kick/Sockel Section */}
      <div className="pt-2 border-t">
        <label className="text-xs text-muted-foreground block mb-2">Sockel</label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground">Höhe (m)</label>
            <input
              type="number"
              value={counterData.kickHeight}
              onChange={(e) => updateCounter({ kickHeight: parseFloat(e.target.value) || 0 })}
              step={0.01}
              min={0}
              max={0.3}
              className="w-full mt-1 px-2 py-1.5 text-sm border rounded bg-background"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Rücksprung (m)</label>
            <input
              type="number"
              value={counterData.kickRecess}
              onChange={(e) => updateCounter({ kickRecess: parseFloat(e.target.value) || 0 })}
              step={0.01}
              min={0}
              max={0.2}
              className="w-full mt-1 px-2 py-1.5 text-sm border rounded bg-background"
            />
          </div>
        </div>
      </div>

      {/* Footrest */}
      <div className="pt-2 border-t">
        <div className="flex items-center gap-2 mb-2">
          <input
            type="checkbox"
            id="edit-hasFootrest"
            checked={counterData.hasFootrest}
            onChange={(e) => updateCounter({ hasFootrest: e.target.checked })}
            className="rounded border-border"
          />
          <label htmlFor="edit-hasFootrest" className="text-xs text-muted-foreground">
            Fußstütze
          </label>
        </div>
        {counterData.hasFootrest && (
          <div>
            <label className="text-xs text-muted-foreground">Fußstützen-Höhe (m)</label>
            <input
              type="number"
              value={counterData.footrestHeight}
              onChange={(e) => updateCounter({ footrestHeight: parseFloat(e.target.value) || 0.2 })}
              step={0.01}
              min={0.1}
              max={0.4}
              className="w-full mt-1 px-2 py-1.5 text-sm border rounded bg-background"
            />
          </div>
        )}
      </div>

      {/* Read-only metrics */}
      <div className="pt-2 border-t text-xs text-muted-foreground">
        <div className="flex justify-between">
          <span>Frontlänge:</span>
          <span className="font-mono">{pathLength.toFixed(2)}m</span>
        </div>
        <div className="flex justify-between mt-1">
          <span>Punkte:</span>
          <span className="font-mono">{counterData.path.length}</span>
        </div>
        <div className="flex justify-between mt-1">
          <span>Grundfläche:</span>
          <span className="font-mono">{area.toFixed(2)}m²</span>
        </div>
        <div className="flex justify-between mt-1">
          <span>Volumen:</span>
          <span className="font-mono">{volume.toFixed(3)}m³</span>
        </div>
      </div>

      {/* Asset Property Sets */}
      <div className="pt-2 border-t">
        <AssetPropertySets element={element} />
      </div>
    </div>
  );
}
