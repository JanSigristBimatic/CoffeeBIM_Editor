import { useCallback } from 'react';
import type { BimElement } from '@/types/bim';
import { useElementStore } from '@/store';
import {
  updateColumnDimensions,
  getColumnProfileLabel,
  type ColumnProfileType,
} from '@/bim/elements/Column';

interface ColumnPropertiesProps {
  element: BimElement;
}

const PROFILE_TYPES: ColumnProfileType[] = ['rectangular', 'circular'];

/**
 * Column-specific properties editor
 * Allows editing column dimensions after placement
 */
export function ColumnProperties({ element }: ColumnPropertiesProps) {
  const { updateElement } = useElementStore();

  const columnData = element.columnData;

  // Update column width (or diameter for circular)
  const handleWidthChange = useCallback(
    (newWidth: number) => {
      if (!columnData) return;

      // Clamp width to valid range
      const clampedWidth = Math.max(0.1, Math.min(2, newWidth));

      const updates = updateColumnDimensions(element, { width: clampedWidth });
      updateElement(element.id, updates);
    },
    [columnData, element, updateElement]
  );

  // Update column depth (only for rectangular)
  const handleDepthChange = useCallback(
    (newDepth: number) => {
      if (!columnData || columnData.profileType === 'circular') return;

      // Clamp depth to valid range
      const clampedDepth = Math.max(0.1, Math.min(2, newDepth));

      const updates = updateColumnDimensions(element, { depth: clampedDepth });
      updateElement(element.id, updates);
    },
    [columnData, element, updateElement]
  );

  // Update column height
  const handleHeightChange = useCallback(
    (newHeight: number) => {
      if (!columnData) return;

      // Clamp height to valid range
      const clampedHeight = Math.max(0.5, Math.min(10, newHeight));

      const updates = updateColumnDimensions(element, { height: clampedHeight });
      updateElement(element.id, updates);
    },
    [columnData, element, updateElement]
  );

  // Update profile type
  const handleProfileTypeChange = useCallback(
    (profileType: ColumnProfileType) => {
      if (!columnData) return;

      const updates = updateColumnDimensions(element, { profileType });
      updateElement(element.id, updates);
    },
    [columnData, element, updateElement]
  );

  if (!columnData) {
    return (
      <div className="text-sm text-muted-foreground">Säulen-Daten nicht verfügbar</div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Säulen-Parameter</h3>

      {/* Profile Type Selection */}
      <div>
        <label className="text-xs text-muted-foreground block mb-1.5">Profiltyp</label>
        <div className="grid grid-cols-2 gap-1">
          {PROFILE_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => handleProfileTypeChange(type)}
              className={`px-2 py-1.5 text-xs rounded border transition-colors ${
                columnData.profileType === type
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted border-border hover:bg-accent'
              }`}
            >
              {getColumnProfileLabel(type)}
            </button>
          ))}
        </div>
      </div>

      {/* Dimensions */}
      <div className="space-y-3">
        {/* Width / Diameter */}
        <div>
          <label className="text-xs text-muted-foreground">
            {columnData.profileType === 'circular' ? 'Durchmesser (m)' : 'Breite (m)'}
          </label>
          <input
            type="number"
            value={columnData.width}
            onChange={(e) => handleWidthChange(parseFloat(e.target.value) || columnData.width)}
            step={0.05}
            min={0.1}
            max={2}
            className="w-full mt-1 px-2 py-1.5 text-sm border rounded bg-background"
          />
        </div>

        {/* Depth (only for rectangular) */}
        {columnData.profileType === 'rectangular' && (
          <div>
            <label className="text-xs text-muted-foreground">Tiefe (m)</label>
            <input
              type="number"
              value={columnData.depth}
              onChange={(e) => handleDepthChange(parseFloat(e.target.value) || columnData.depth)}
              step={0.05}
              min={0.1}
              max={2}
              className="w-full mt-1 px-2 py-1.5 text-sm border rounded bg-background"
            />
          </div>
        )}

        {/* Height */}
        <div>
          <label className="text-xs text-muted-foreground">Höhe (m)</label>
          <input
            type="number"
            value={columnData.height}
            onChange={(e) => handleHeightChange(parseFloat(e.target.value) || columnData.height)}
            step={0.1}
            min={0.5}
            max={10}
            className="w-full mt-1 px-2 py-1.5 text-sm border rounded bg-background"
          />
        </div>
      </div>

      {/* Position Info */}
      <div className="pt-2 border-t text-xs text-muted-foreground">
        <div className="flex justify-between">
          <span>X-Position:</span>
          <span className="font-mono">{element.placement.position.x.toFixed(2)}m</span>
        </div>
        <div className="flex justify-between mt-1">
          <span>Z-Position:</span>
          <span className="font-mono">{element.placement.position.z.toFixed(2)}m</span>
        </div>
      </div>

      {/* Calculated values */}
      <div className="pt-2 border-t text-xs text-muted-foreground">
        <div className="flex justify-between">
          <span>Querschnittsfläche:</span>
          <span className="font-mono">
            {columnData.profileType === 'circular'
              ? `${(Math.PI * Math.pow(columnData.width / 2, 2)).toFixed(3)}m²`
              : `${(columnData.width * columnData.depth).toFixed(3)}m²`}
          </span>
        </div>
        <div className="flex justify-between mt-1">
          <span>Volumen:</span>
          <span className="font-mono">
            {columnData.profileType === 'circular'
              ? `${(Math.PI * Math.pow(columnData.width / 2, 2) * columnData.height).toFixed(3)}m³`
              : `${(columnData.width * columnData.depth * columnData.height).toFixed(3)}m³`}
          </span>
        </div>
      </div>
    </div>
  );
}
