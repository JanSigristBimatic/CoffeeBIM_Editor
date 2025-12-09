import { useCallback } from 'react';
import { useToolStore } from '@/store';
import type { WallAlignmentSide } from '@/types/bim';
import { WALL_ALIGNMENT_LABELS } from '@/types/bim';

/**
 * Panel for configuring wall parameters before placement
 * Shows when wall tool is active
 */
export function WallParameterPanel() {
  const {
    activeTool,
    wallPlacement,
    setWallThickness,
    setWallHeight,
    setWallAlignmentSide,
  } = useToolStore();

  const { params, startPoint, previewEndPoint } = wallPlacement;

  // Handle thickness change
  const handleThicknessChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseFloat(e.target.value);
      if (!isNaN(value) && value > 0) {
        setWallThickness(value);
      }
    },
    [setWallThickness]
  );

  // Handle height change
  const handleHeightChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseFloat(e.target.value);
      if (!isNaN(value) && value > 0) {
        setWallHeight(value);
      }
    },
    [setWallHeight]
  );

  // Handle alignment change
  const handleAlignmentChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setWallAlignmentSide(e.target.value as WallAlignmentSide);
    },
    [setWallAlignmentSide]
  );

  // Don't show if not in wall mode
  if (activeTool !== 'wall') {
    return null;
  }

  // Calculate preview length if we have both points
  let previewLength: number | null = null;
  if (startPoint && previewEndPoint) {
    const dx = previewEndPoint.x - startPoint.x;
    const dy = previewEndPoint.y - startPoint.y;
    previewLength = Math.sqrt(dx * dx + dy * dy);
  }

  return (
    <div className="absolute left-4 top-20 bg-background border border-border rounded-lg shadow-lg p-4 w-64 z-10">
      <h3 className="font-semibold text-sm mb-3">Wand-Einstellungen</h3>

      {/* Alignment Selection */}
      <div className="mb-3">
        <label className="text-xs text-muted-foreground mb-1.5 block">Referenzkante</label>
        <select
          value={params.alignmentSide}
          onChange={handleAlignmentChange}
          className="w-full px-2 py-1.5 text-sm border border-input rounded bg-background"
        >
          {(Object.keys(WALL_ALIGNMENT_LABELS) as WallAlignmentSide[]).map((side) => (
            <option key={side} value={side}>
              {WALL_ALIGNMENT_LABELS[side]}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground/70 mt-1 block">
          Wohin die Wand von der gezeichneten Linie aus geht
        </span>
      </div>

      {/* Thickness Input */}
      <div className="mb-3">
        <label className="text-xs text-muted-foreground mb-1.5 block">Dicke (m)</label>
        <input
          type="number"
          value={params.thickness}
          onChange={handleThicknessChange}
          step={0.01}
          min={0.05}
          max={1}
          className="w-full px-2 py-1.5 text-sm border border-input rounded bg-background"
        />
      </div>

      {/* Height Input */}
      <div className="mb-3">
        <label className="text-xs text-muted-foreground mb-1.5 block">Höhe (m)</label>
        <input
          type="number"
          value={params.height}
          onChange={handleHeightChange}
          step={0.1}
          min={0.5}
          max={10}
          className="w-full px-2 py-1.5 text-sm border border-input rounded bg-background"
        />
      </div>

      {/* Preview Length (when placing) */}
      {previewLength !== null && (
        <div className="border-t border-border pt-3 mt-3">
          <label className="text-xs text-muted-foreground mb-2 block">Vorschau</label>
          <div className="bg-muted rounded p-2">
            <span className="text-xs text-muted-foreground">Länge:</span>
            <span className="ml-1 text-sm font-mono">{previewLength.toFixed(2)}m</span>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="border-t border-border pt-3 mt-3 text-xs text-muted-foreground">
        {!startPoint ? (
          <p>Klicken Sie, um den Startpunkt zu setzen.</p>
        ) : (
          <p>Klicken Sie erneut oder geben Sie die Distanz ein (z.B. 3.5 + Enter).</p>
        )}
        <p className="mt-1 text-muted-foreground/70">Rechtsklick zum Beenden.</p>
      </div>
    </div>
  );
}
