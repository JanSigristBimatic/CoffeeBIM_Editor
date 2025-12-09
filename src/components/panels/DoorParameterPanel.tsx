import { useCallback } from 'react';
import { useToolStore } from '@/store';
import { getDefaultDoorWidth, getDoorTypeLabel, getSwingSideLabel } from '@/bim/elements/Door';
import type { DoorType, DoorSwingSide } from '@/types/bim';

const DOOR_TYPES: DoorType[] = ['single', 'double', 'sliding'];
const SWING_SIDES: DoorSwingSide[] = ['inward', 'outward'];

/**
 * Panel for configuring door parameters before placement
 * Shows when door tool is active
 */
export function DoorParameterPanel() {
  const { activeTool, doorPlacement, setDoorType, setDoorWidth, setDoorHeight, setDoorSwingDirection, setDoorSwingSide } =
    useToolStore();

  const { params, distanceFromLeft, distanceFromRight, isValidPosition } = doorPlacement;

  // Handle door type change
  const handleDoorTypeChange = useCallback(
    (doorType: DoorType) => {
      setDoorType(doorType);
      // Update width to default for this type
      setDoorWidth(getDefaultDoorWidth(doorType));
    },
    [setDoorType, setDoorWidth]
  );

  // Handle width change
  const handleWidthChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseFloat(e.target.value);
      if (!isNaN(value) && value > 0) {
        setDoorWidth(value);
      }
    },
    [setDoorWidth]
  );

  // Handle height change
  const handleHeightChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseFloat(e.target.value);
      if (!isNaN(value) && value > 0) {
        setDoorHeight(value);
      }
    },
    [setDoorHeight]
  );

  // Don't show if not in door mode
  if (activeTool !== 'door') {
    return null;
  }

  return (
    <div className="absolute left-4 top-20 bg-background border border-border rounded-lg shadow-lg p-4 w-64 z-10">
      <h3 className="font-semibold text-sm mb-3">Tür-Einstellungen</h3>

      {/* Door Type Selection */}
      <div className="mb-3">
        <label className="text-xs text-muted-foreground mb-1.5 block">Türart</label>
        <div className="grid grid-cols-3 gap-1">
          {DOOR_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => handleDoorTypeChange(type)}
              className={`px-2 py-1.5 text-xs rounded border transition-colors ${
                params.doorType === type
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted border-border hover:bg-accent'
              }`}
            >
              {getDoorTypeLabel(type)}
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
          min={0.5}
          max={3}
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
          min={1.5}
          max={3}
          className="w-full px-2 py-1.5 text-sm border border-input rounded bg-background"
        />
      </div>

      {/* Swing Direction (only for single doors) */}
      {params.doorType === 'single' && (
        <div className="mb-3">
          <label className="text-xs text-muted-foreground mb-1.5 block">Anschlag</label>
          <div className="grid grid-cols-2 gap-1">
            <button
              onClick={() => setDoorSwingDirection('left')}
              className={`px-2 py-1.5 text-xs rounded border transition-colors ${
                params.swingDirection === 'left'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted border-border hover:bg-accent'
              }`}
            >
              Links
            </button>
            <button
              onClick={() => setDoorSwingDirection('right')}
              className={`px-2 py-1.5 text-xs rounded border transition-colors ${
                params.swingDirection === 'right'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted border-border hover:bg-accent'
              }`}
            >
              Rechts
            </button>
          </div>
        </div>
      )}

      {/* Swing Side (inward/outward) - not for sliding doors */}
      {params.doorType !== 'sliding' && (
        <div className="mb-3">
          <label className="text-xs text-muted-foreground mb-1.5 block">Aufschlag</label>
          <div className="grid grid-cols-2 gap-1">
            {SWING_SIDES.map((side) => (
              <button
                key={side}
                onClick={() => setDoorSwingSide(side)}
                className={`px-2 py-1.5 text-xs rounded border transition-colors ${
                  params.swingSide === side
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted border-border hover:bg-accent'
                }`}
              >
                {getSwingSideLabel(side)}
              </button>
            ))}
          </div>
        </div>
      )}

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
          <div className={`mt-2 text-xs px-2 py-1 rounded ${isValidPosition ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            {isValidPosition ? '✓ Position gültig' : '✗ Position ungültig'}
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="border-t border-border pt-3 mt-3 text-xs text-muted-foreground">
        <p>Klicken Sie auf eine Wand, um die Tür zu platzieren.</p>
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
