import { useCallback } from 'react';
import { useToolStore } from '@/store';
import { getColumnProfileLabel, type ColumnProfileType } from '@/bim/elements/Column';

const PROFILE_TYPES: ColumnProfileType[] = ['rectangular', 'circular'];

/**
 * Panel for configuring column parameters before placement
 * Shows when column tool is active
 */
export function ColumnParameterPanel() {
  const {
    activeTool,
    columnPlacement,
    setColumnProfileType,
    setColumnWidth,
    setColumnDepth,
    setColumnHeight,
  } = useToolStore();

  const { params, previewPosition, isValidPosition } = columnPlacement;

  // Handle profile type change
  const handleProfileTypeChange = useCallback(
    (profileType: ColumnProfileType) => {
      setColumnProfileType(profileType);
    },
    [setColumnProfileType]
  );

  // Handle width change
  const handleWidthChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseFloat(e.target.value);
      if (!isNaN(value) && value > 0) {
        setColumnWidth(value);
      }
    },
    [setColumnWidth]
  );

  // Handle depth change (only for rectangular)
  const handleDepthChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseFloat(e.target.value);
      if (!isNaN(value) && value > 0) {
        setColumnDepth(value);
      }
    },
    [setColumnDepth]
  );

  // Handle height change
  const handleHeightChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseFloat(e.target.value);
      if (!isNaN(value) && value > 0) {
        setColumnHeight(value);
      }
    },
    [setColumnHeight]
  );

  // Don't show if not in column mode
  if (activeTool !== 'column') {
    return null;
  }

  return (
    <div className="absolute left-4 top-20 bg-background border border-border rounded-lg shadow-lg p-4 w-64 z-10">
      <h3 className="font-semibold text-sm mb-3">Säulen-Einstellungen</h3>

      {/* Profile Type Selection */}
      <div className="mb-3">
        <label className="text-xs text-muted-foreground mb-1.5 block">Profiltyp</label>
        <div className="grid grid-cols-2 gap-1">
          {PROFILE_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => handleProfileTypeChange(type)}
              className={`px-2 py-1.5 text-xs rounded border transition-colors ${
                params.profileType === type
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted border-border hover:bg-accent'
              }`}
            >
              {getColumnProfileLabel(type)}
            </button>
          ))}
        </div>
      </div>

      {/* Width Input */}
      <div className="mb-3">
        <label className="text-xs text-muted-foreground mb-1.5 block">
          {params.profileType === 'circular' ? 'Durchmesser (m)' : 'Breite (m)'}
        </label>
        <input
          type="number"
          value={params.width}
          onChange={handleWidthChange}
          step={0.05}
          min={0.1}
          max={2}
          className="w-full px-2 py-1.5 text-sm border border-input rounded bg-background"
        />
      </div>

      {/* Depth Input (only for rectangular) */}
      {params.profileType === 'rectangular' && (
        <div className="mb-3">
          <label className="text-xs text-muted-foreground mb-1.5 block">Tiefe (m)</label>
          <input
            type="number"
            value={params.depth}
            onChange={handleDepthChange}
            step={0.05}
            min={0.1}
            max={2}
            className="w-full px-2 py-1.5 text-sm border border-input rounded bg-background"
          />
        </div>
      )}

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

      {/* Preview Position Info */}
      {previewPosition && (
        <div className="border-t border-border pt-3 mt-3">
          <label className="text-xs text-muted-foreground mb-2 block">Position</label>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-muted rounded p-2">
              <span className="text-muted-foreground">X:</span>
              <span className="ml-1 font-mono">{previewPosition.x.toFixed(2)}m</span>
            </div>
            <div className="bg-muted rounded p-2">
              <span className="text-muted-foreground">Y:</span>
              <span className="ml-1 font-mono">{previewPosition.y.toFixed(2)}m</span>
            </div>
          </div>

          {/* Validity indicator */}
          <div
            className={`mt-2 text-xs px-2 py-1 rounded ${
              isValidPosition ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            }`}
          >
            {isValidPosition ? '✓ Position gültig' : '✗ Position ungültig'}
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="border-t border-border pt-3 mt-3 text-xs text-muted-foreground">
        <p>Klicken Sie, um die Säule zu platzieren.</p>
      </div>
    </div>
  );
}
