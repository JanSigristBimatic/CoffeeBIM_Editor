import { useCallback } from 'react';
import { ArrowUp } from 'lucide-react';
import type { BimElement, StairType } from '@/types/bim';
import { useElementStore, useProjectStore } from '@/store';
import { updateStairDimensions, getStairTypeLabel } from '@/bim/elements/Stair';

interface StairPropertiesProps {
  element: BimElement;
}

const STAIR_TYPES: StairType[] = ['straight', 'l-shape', 'u-shape'];

/**
 * Stair-specific properties editor
 * Allows editing stair dimensions after placement
 */
export function StairProperties({ element }: StairPropertiesProps) {
  const { updateElement } = useElementStore();
  const { storeys } = useProjectStore();

  const stairData = element.stairData;

  // Update stair width
  const handleWidthChange = useCallback(
    (newWidth: number) => {
      if (!stairData) return;

      // Clamp width to valid range (0.8m - 2.0m)
      const clampedWidth = Math.max(0.8, Math.min(2.0, newWidth));

      const updates = updateStairDimensions(element, { width: clampedWidth });
      updateElement(element.id, updates);
    },
    [stairData, element, updateElement]
  );

  // Update stair type
  const handleStairTypeChange = useCallback(
    (stairType: StairType) => {
      if (!stairData) return;

      const updates = updateStairDimensions(element, { stairType });
      updateElement(element.id, updates);
    },
    [stairData, element, updateElement]
  );

  if (!stairData) {
    return (
      <div className="text-sm text-muted-foreground">Treppen-Daten nicht verfugbar</div>
    );
  }

  // Find storey names
  const bottomStorey = storeys.find((s) => s.id === stairData.bottomStoreyId);
  const topStorey = storeys.find((s) => s.id === stairData.topStoreyId);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Treppen-Parameter</h3>

      {/* Stair Type Selection */}
      <div>
        <label className="text-xs text-muted-foreground block mb-1.5">Treppentyp</label>
        <div className="grid grid-cols-3 gap-1">
          {STAIR_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => handleStairTypeChange(type)}
              disabled={type !== 'straight'} // Only straight supported for now
              className={`px-2 py-1.5 text-xs rounded border transition-colors ${
                stairData.stairType === type
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted border-border hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed'
              }`}
            >
              {getStairTypeLabel(type)}
            </button>
          ))}
        </div>
        {stairData.stairType !== 'straight' && (
          <p className="text-xs text-amber-500 mt-1">Nur gerade Treppen werden aktuell unterstutzt</p>
        )}
      </div>

      {/* Width */}
      <div>
        <label className="text-xs text-muted-foreground">Breite (m)</label>
        <input
          type="number"
          value={stairData.width}
          onChange={(e) => handleWidthChange(parseFloat(e.target.value) || stairData.width)}
          step={0.05}
          min={0.8}
          max={2.0}
          className="w-full mt-1 px-2 py-1.5 text-sm border rounded bg-background"
        />
      </div>

      {/* Storey Connection */}
      <div className="pt-2 border-t">
        <label className="text-xs text-muted-foreground block mb-2">Geschossverbindung</label>
        <div className="space-y-2">
          {/* Direction indicator */}
          <div className="flex items-center gap-2 text-xs px-2 py-1.5 rounded bg-muted">
            <ArrowUp size={14} className="text-green-500" />
            <span>Treppe fuhrt nach oben</span>
          </div>

          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Unten (Start):</span>
              <span>{bottomStorey?.name ?? 'Unbekannt'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Oben (Ziel):</span>
              <span>{topStorey?.name ?? 'Unbekannt'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Step Dimensions (calculated, read-only) */}
      <div className="pt-2 border-t">
        <label className="text-xs text-muted-foreground block mb-2">Stufenberechnung (DIN 18065)</label>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Anzahl Stufen:</span>
            <span className="font-mono">{stairData.steps.count}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Steigung (h):</span>
            <span className="font-mono">{(stairData.steps.riserHeight * 100).toFixed(1)} cm</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Auftritt (a):</span>
            <span className="font-mono">{(stairData.steps.treadDepth * 100).toFixed(1)} cm</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Schrittmass:</span>
            <span className="font-mono">
              {((2 * stairData.steps.riserHeight + stairData.steps.treadDepth) * 100).toFixed(1)} cm
            </span>
          </div>
        </div>
      </div>

      {/* Geometric Info */}
      <div className="pt-2 border-t text-xs text-muted-foreground">
        <div className="flex justify-between">
          <span>Gesamthohe:</span>
          <span className="font-mono">{stairData.totalRise.toFixed(2)} m</span>
        </div>
        <div className="flex justify-between mt-1">
          <span>Lauflange:</span>
          <span className="font-mono">{stairData.steps.runLength.toFixed(2)} m</span>
        </div>
        <div className="flex justify-between mt-1">
          <span>Neigung:</span>
          <span className="font-mono">
            {(Math.atan(stairData.totalRise / stairData.steps.runLength) * (180 / Math.PI)).toFixed(1)}°
          </span>
        </div>
      </div>

      {/* Position Info */}
      <div className="pt-2 border-t text-xs text-muted-foreground">
        <div className="flex justify-between">
          <span>X-Position:</span>
          <span className="font-mono">{element.placement.position.x.toFixed(2)} m</span>
        </div>
        <div className="flex justify-between mt-1">
          <span>Y-Position:</span>
          <span className="font-mono">{element.placement.position.y.toFixed(2)} m</span>
        </div>
        <div className="flex justify-between mt-1">
          <span>Richtung:</span>
          <span className="font-mono">{((stairData.rotation * 180) / Math.PI).toFixed(0)}°</span>
        </div>
      </div>
    </div>
  );
}
