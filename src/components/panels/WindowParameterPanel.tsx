import { useCallback } from 'react';
import { useToolStore } from '@/store';
import { getWindowTypeLabel } from '@/bim/elements/Window';
import type { WindowType } from '@/types/bim';
import {
  DEFAULT_WINDOW_WIDTH,
  DEFAULT_DOUBLE_WINDOW_WIDTH,
  DEFAULT_FIXED_WINDOW_WIDTH,
} from '@/types/bim';

const WINDOW_TYPES: WindowType[] = ['single', 'double', 'fixed'];

/**
 * Get default window width for a given type
 */
function getDefaultWindowWidth(windowType: WindowType): number {
  switch (windowType) {
    case 'single':
      return DEFAULT_WINDOW_WIDTH;
    case 'double':
      return DEFAULT_DOUBLE_WINDOW_WIDTH;
    case 'fixed':
      return DEFAULT_FIXED_WINDOW_WIDTH;
    default:
      return DEFAULT_WINDOW_WIDTH;
  }
}

/**
 * Panel for configuring window parameters before placement
 * Shows when window tool is active
 */
export function WindowParameterPanel() {
  const {
    activeTool,
    windowPlacement,
    setWindowType,
    setWindowWidth,
    setWindowHeight,
    setWindowSillHeight,
  } = useToolStore();

  const { params, distanceFromLeft, distanceFromRight, isValidPosition } = windowPlacement;

  // Handle window type change
  const handleWindowTypeChange = useCallback(
    (windowType: WindowType) => {
      setWindowType(windowType);
      // Update width to default for this type
      setWindowWidth(getDefaultWindowWidth(windowType));
    },
    [setWindowType, setWindowWidth]
  );

  // Handle width change
  const handleWidthChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseFloat(e.target.value);
      if (!isNaN(value) && value > 0) {
        setWindowWidth(value);
      }
    },
    [setWindowWidth]
  );

  // Handle height change
  const handleHeightChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseFloat(e.target.value);
      if (!isNaN(value) && value > 0) {
        setWindowHeight(value);
      }
    },
    [setWindowHeight]
  );

  // Handle sill height change
  const handleSillHeightChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseFloat(e.target.value);
      if (!isNaN(value) && value >= 0) {
        setWindowSillHeight(value);
      }
    },
    [setWindowSillHeight]
  );

  // Don't show if not in window mode
  if (activeTool !== 'window') {
    return null;
  }

  return (
    <div className="absolute left-4 top-20 bg-background border border-border rounded-lg shadow-lg p-4 w-64 z-10">
      <h3 className="font-semibold text-sm mb-3">Fenster-Einstellungen</h3>

      {/* Window Type Selection */}
      <div className="mb-3">
        <label className="text-xs text-muted-foreground mb-1.5 block">Fensterart</label>
        <div className="grid grid-cols-3 gap-1">
          {WINDOW_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => handleWindowTypeChange(type)}
              className={`px-2 py-1.5 text-xs rounded border transition-colors ${
                params.windowType === type
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted border-border hover:bg-accent'
              }`}
            >
              {getWindowTypeLabel(type)}
            </button>
          ))}
        </div>
      </div>

      {/* Width Input */}
      <div className="mb-3">
        <label className="text-xs text-muted-foreground mb-1.5 block">Breite (m)</label>
        <input
          type="number"
          value={params.width}
          onChange={handleWidthChange}
          step={0.05}
          min={0.3}
          max={4}
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
          step={0.05}
          min={0.3}
          max={3}
          className="w-full px-2 py-1.5 text-sm border border-input rounded bg-background"
        />
      </div>

      {/* Sill Height Input */}
      <div className="mb-3">
        <label className="text-xs text-muted-foreground mb-1.5 block">Brüstungshöhe (m)</label>
        <input
          type="number"
          value={params.sillHeight}
          onChange={handleSillHeightChange}
          step={0.05}
          min={0}
          max={2}
          className="w-full px-2 py-1.5 text-sm border border-input rounded bg-background"
        />
      </div>

      {/* Distance Info (when hovering over wall) */}
      {distanceFromLeft !== null && distanceFromRight !== null && (
        <div className="border-t border-border pt-3 mt-3">
          <label className="text-xs text-muted-foreground mb-2 block">Abstände</label>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-muted rounded p-2">
              <span className="text-muted-foreground">Links:</span>
              <span className="ml-1 font-mono">{formatDistance(distanceFromLeft)}</span>
            </div>
            <div className="bg-muted rounded p-2">
              <span className="text-muted-foreground">Rechts:</span>
              <span className="ml-1 font-mono">{formatDistance(distanceFromRight)}</span>
            </div>
          </div>

          {/* Validity indicator */}
          <div
            className={`mt-2 text-xs px-2 py-1 rounded ${isValidPosition ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}
          >
            {isValidPosition ? '✓ Position gültig' : '✗ Position ungültig'}
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="border-t border-border pt-3 mt-3 text-xs text-muted-foreground">
        <p>Klicken Sie auf eine Wand, um das Fenster zu platzieren.</p>
      </div>
    </div>
  );
}

/**
 * Format distance for display
 */
function formatDistance(meters: number): string {
  if (meters >= 1) {
    return `${meters.toFixed(2)}m`;
  }
  return `${Math.round(meters * 100)}cm`;
}
