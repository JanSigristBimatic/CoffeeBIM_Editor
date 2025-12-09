import { useCallback } from 'react';
import type { BimElement, WallAlignmentSide } from '@/types/bim';
import { WALL_ALIGNMENT_LABELS } from '@/types/bim';
import { useElementStore } from '@/store';
import { updateWallDimensions, calculateWallLength } from '@/bim/elements/Wall';

interface WallPropertiesProps {
  element: BimElement;
}

/**
 * Wall-specific properties editor
 * Allows editing wall thickness and height after placement
 */
export function WallProperties({ element }: WallPropertiesProps) {
  const { updateElement } = useElementStore();

  const wallData = element.wallData;

  // Calculate wall length
  const wallLength = wallData ? calculateWallLength(element) : 0;

  // Update wall thickness
  const handleThicknessChange = useCallback(
    (newThickness: number) => {
      if (!wallData) return;

      // Clamp thickness to valid range
      const clampedThickness = Math.max(0.05, Math.min(1, newThickness));

      const updates = updateWallDimensions(element, { thickness: clampedThickness });
      updateElement(element.id, updates);
    },
    [wallData, element, updateElement]
  );

  // Update wall height
  const handleHeightChange = useCallback(
    (newHeight: number) => {
      if (!wallData) return;

      // Clamp height to valid range
      const clampedHeight = Math.max(0.5, Math.min(10, newHeight));

      const updates = updateWallDimensions(element, { height: clampedHeight });
      updateElement(element.id, updates);
    },
    [wallData, element, updateElement]
  );

  // Update wall alignment
  const handleAlignmentChange = useCallback(
    (newAlignment: WallAlignmentSide) => {
      if (!wallData) return;

      const updates = updateWallDimensions(element, { alignmentSide: newAlignment });
      updateElement(element.id, updates);
    },
    [wallData, element, updateElement]
  );

  if (!wallData) {
    return <div className="text-sm text-muted-foreground">Wand-Daten nicht verfügbar</div>;
  }

  // Calculate wall area and volume
  const wallArea = wallLength * wallData.height;
  const wallVolume = wallLength * wallData.height * wallData.thickness;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Wand-Parameter</h3>

      {/* Alignment */}
      <div>
        <label className="text-xs text-muted-foreground">Referenzkante</label>
        <select
          value={wallData.alignmentSide}
          onChange={(e) => handleAlignmentChange(e.target.value as WallAlignmentSide)}
          className="w-full mt-1 px-2 py-1.5 text-sm border rounded bg-background"
        >
          {(Object.keys(WALL_ALIGNMENT_LABELS) as WallAlignmentSide[]).map((side) => (
            <option key={side} value={side}>
              {WALL_ALIGNMENT_LABELS[side]}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground mt-0.5 block">
          Definiert, welche Kante die gezeichnete Linie repräsentiert
        </span>
      </div>

      {/* Dimensions */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-muted-foreground">Dicke (m)</label>
          <input
            type="number"
            value={wallData.thickness}
            onChange={(e) => handleThicknessChange(parseFloat(e.target.value) || wallData.thickness)}
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
            value={wallData.height}
            onChange={(e) => handleHeightChange(parseFloat(e.target.value) || wallData.height)}
            step={0.1}
            min={0.5}
            max={10}
            className="w-full mt-1 px-2 py-1.5 text-sm border rounded bg-background"
          />
        </div>
      </div>

      {/* Length (read-only) */}
      <div>
        <label className="text-xs text-muted-foreground">Länge (m)</label>
        <input
          type="number"
          value={Number(wallLength.toFixed(3))}
          readOnly
          className="w-full mt-1 px-2 py-1.5 text-sm border rounded bg-muted"
        />
        <span className="text-xs text-muted-foreground mt-0.5 block">
          Länge kann durch Verschieben der Endpunkte geändert werden
        </span>
      </div>

      {/* Openings count */}
      <div>
        <label className="text-xs text-muted-foreground">Öffnungen</label>
        <p className="text-sm font-medium">{wallData.openings.length}</p>
      </div>

      {/* Start/End Points (read-only info) */}
      <div className="pt-2 border-t text-xs text-muted-foreground">
        <div className="flex justify-between">
          <span>Startpunkt:</span>
          <span className="font-mono">
            ({wallData.startPoint.x.toFixed(2)}, {wallData.startPoint.y.toFixed(2)})
          </span>
        </div>
        <div className="flex justify-between mt-1">
          <span>Endpunkt:</span>
          <span className="font-mono">
            ({wallData.endPoint.x.toFixed(2)}, {wallData.endPoint.y.toFixed(2)})
          </span>
        </div>
      </div>

      {/* Calculated values */}
      <div className="pt-2 border-t text-xs text-muted-foreground">
        <div className="flex justify-between">
          <span>Wandfläche:</span>
          <span className="font-mono">{wallArea.toFixed(2)}m²</span>
        </div>
        <div className="flex justify-between mt-1">
          <span>Volumen:</span>
          <span className="font-mono">{wallVolume.toFixed(3)}m³</span>
        </div>
      </div>
    </div>
  );
}
