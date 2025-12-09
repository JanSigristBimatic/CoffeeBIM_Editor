import { useCallback } from 'react';
import type { BimElement, SlabData } from '@/types/bim';
import { useElementStore } from '@/store';
import { updateSlabDimensions, calculateSlabArea } from '@/bim/elements/Slab';

interface SlabPropertiesProps {
  element: BimElement;
}

type SlabType = SlabData['slabType'];

const SLAB_TYPES: { value: SlabType; label: string }[] = [
  { value: 'floor', label: 'Boden' },
  { value: 'ceiling', label: 'Decke' },
];

/**
 * Slab-specific properties editor
 * Allows editing slab thickness and type after placement
 */
export function SlabProperties({ element }: SlabPropertiesProps) {
  const { updateElement } = useElementStore();

  const slabData = element.slabData;

  // Calculate slab area
  const slabArea = slabData ? calculateSlabArea(slabData.outline) : 0;

  // Update slab thickness
  const handleThicknessChange = useCallback(
    (newThickness: number) => {
      if (!slabData) return;

      // Clamp thickness to valid range
      const clampedThickness = Math.max(0.05, Math.min(1, newThickness));

      const updates = updateSlabDimensions(element, { thickness: clampedThickness });
      updateElement(element.id, updates);
    },
    [slabData, element, updateElement]
  );

  // Update slab type
  const handleSlabTypeChange = useCallback(
    (slabType: SlabType) => {
      if (!slabData) return;

      const updates = updateSlabDimensions(element, { slabType });
      updateElement(element.id, updates);
    },
    [slabData, element, updateElement]
  );

  // Update elevation offset
  const handleOffsetChange = useCallback(
    (newOffset: number) => {
      if (!slabData) return;

      // Clamp offset to reasonable range (-10m to +10m)
      const clampedOffset = Math.max(-10, Math.min(10, newOffset));

      const updates = updateSlabDimensions(element, { elevationOffset: clampedOffset });
      updateElement(element.id, updates);
    },
    [slabData, element, updateElement]
  );

  if (!slabData) {
    return <div className="text-sm text-muted-foreground">Boden-Daten nicht verfügbar</div>;
  }

  // Calculate volume
  const slabVolume = slabArea * slabData.thickness;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Boden/Decke-Parameter</h3>

      {/* Slab Type Selection */}
      <div>
        <label className="text-xs text-muted-foreground block mb-1.5">Typ</label>
        <div className="grid grid-cols-2 gap-1">
          {SLAB_TYPES.map((type) => (
            <button
              key={type.value}
              onClick={() => handleSlabTypeChange(type.value)}
              className={`px-2 py-1.5 text-xs rounded border transition-colors ${
                slabData.slabType === type.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted border-border hover:bg-accent'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* Thickness */}
      <div>
        <label className="text-xs text-muted-foreground">Dicke (m)</label>
        <input
          type="number"
          value={slabData.thickness}
          onChange={(e) => handleThicknessChange(parseFloat(e.target.value) || slabData.thickness)}
          step={0.01}
          min={0.05}
          max={1}
          className="w-full mt-1 px-2 py-1.5 text-sm border rounded bg-background"
        />
      </div>

      {/* Elevation Offset */}
      <div>
        <label className="text-xs text-muted-foreground">Höhenversatz (m)</label>
        <input
          type="number"
          value={slabData.elevationOffset ?? 0}
          onChange={(e) => handleOffsetChange(parseFloat(e.target.value) || 0)}
          step={0.1}
          min={-10}
          max={10}
          className="w-full mt-1 px-2 py-1.5 text-sm border rounded bg-background"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Positiv = nach oben, Negativ = nach unten
        </p>
      </div>

      {/* Outline Points (read-only info) */}
      <div>
        <label className="text-xs text-muted-foreground">Eckpunkte</label>
        <p className="text-sm font-medium">{slabData.outline.length} Punkte</p>
      </div>

      {/* Calculated values */}
      <div className="pt-2 border-t text-xs text-muted-foreground">
        <div className="flex justify-between">
          <span>Fläche:</span>
          <span className="font-mono">{slabArea.toFixed(2)}m²</span>
        </div>
        <div className="flex justify-between mt-1">
          <span>Volumen:</span>
          <span className="font-mono">{slabVolume.toFixed(3)}m³</span>
        </div>
      </div>

      {/* Outline coordinates (collapsed by default) */}
      <details className="pt-2 border-t">
        <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
          Koordinaten anzeigen
        </summary>
        <div className="mt-2 space-y-1 text-xs font-mono text-muted-foreground max-h-32 overflow-y-auto">
          {slabData.outline.map((point, index) => (
            <div key={index} className="flex justify-between">
              <span>P{index + 1}:</span>
              <span>
                ({point.x.toFixed(2)}, {point.y.toFixed(2)})
              </span>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
