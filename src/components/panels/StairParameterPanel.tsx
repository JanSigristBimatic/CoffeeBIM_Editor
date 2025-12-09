import { useCallback, useMemo, useEffect } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { useToolStore, useProjectStore } from '@/store';
import { getStairTypeLabel } from '@/bim/elements/Stair';
import type { StairType } from '@/types/bim';

const STAIR_TYPES: StairType[] = ['straight', 'l-shape', 'u-shape'];

/**
 * Panel for configuring stair parameters before placement
 * Shows when stair tool is active
 * Supports stairs going both UP and DOWN
 */
export function StairParameterPanel() {
  const { activeTool, stairPlacement, setStairType, setStairWidth, setStairTargetStorey } =
    useToolStore();
  const { storeys, activeStoreyId } = useProjectStore();

  const { params, startPoint } = stairPlacement;

  // Get current storey
  const currentStorey = storeys.find((s) => s.id === activeStoreyId);

  // Get all available target storeys (both above AND below current one)
  const { storeysAbove, storeysBelow, allTargetStoreys } = useMemo(() => {
    if (!currentStorey) return { storeysAbove: [], storeysBelow: [], allTargetStoreys: [] };

    const above = storeys
      .filter((s) => s.elevation > currentStorey.elevation)
      .sort((a, b) => a.elevation - b.elevation);

    const below = storeys
      .filter((s) => s.elevation < currentStorey.elevation)
      .sort((a, b) => b.elevation - a.elevation); // Descending for below

    return {
      storeysAbove: above,
      storeysBelow: below,
      allTargetStoreys: [...above, ...below],
    };
  }, [storeys, currentStorey]);

  // Auto-select first storey above if no target selected (or first below if no above)
  const effectiveTargetStoreyId = params.targetStoreyId ?? storeysAbove[0]?.id ?? storeysBelow[0]?.id ?? null;

  // Determine direction based on selected target
  const targetStorey = storeys.find((s) => s.id === effectiveTargetStoreyId);
  const isGoingUp = currentStorey && targetStorey ? targetStorey.elevation > currentStorey.elevation : true;

  // Auto-select first available storey when tool is activated
  useEffect(() => {
    if (activeTool === 'stair' && !params.targetStoreyId && allTargetStoreys.length > 0) {
      setStairTargetStorey(storeysAbove[0]?.id ?? storeysBelow[0]?.id ?? null);
    }
  }, [activeTool, params.targetStoreyId, allTargetStoreys, storeysAbove, storeysBelow, setStairTargetStorey]);

  // Handle stair type change
  const handleStairTypeChange = useCallback(
    (stairType: StairType) => {
      setStairType(stairType);
    },
    [setStairType]
  );

  // Handle width change
  const handleWidthChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseFloat(e.target.value);
      if (!isNaN(value) && value >= 0.8 && value <= 2.0) {
        setStairWidth(value);
      }
    },
    [setStairWidth]
  );

  // Handle target storey change
  const handleTargetStoreyChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const storeyId = e.target.value || null;
      setStairTargetStorey(storeyId);
    },
    [setStairTargetStorey]
  );

  // Don't show if not in stair mode
  if (activeTool !== 'stair') {
    return null;
  }

  // Calculate preview info if we have a target storey
  // totalRise is always positive (absolute height difference)
  const totalRise = currentStorey && targetStorey
    ? Math.abs(targetStorey.elevation - currentStorey.elevation)
    : null;

  return (
    <div className="absolute left-4 top-20 bg-background border border-border rounded-lg shadow-lg p-4 w-64 z-10">
      <h3 className="font-semibold text-sm mb-3">Treppen-Einstellungen</h3>

      {/* Stair Type Selection */}
      <div className="mb-3">
        <label className="text-xs text-muted-foreground mb-1.5 block">Treppentyp</label>
        <div className="grid grid-cols-3 gap-1">
          {STAIR_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => handleStairTypeChange(type)}
              disabled={type !== 'straight'} // Only straight supported for now
              className={`px-2 py-1.5 text-xs rounded border transition-colors ${
                params.stairType === type
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted border-border hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed'
              }`}
            >
              {getStairTypeLabel(type)}
            </button>
          ))}
        </div>
        {params.stairType !== 'straight' && (
          <p className="text-xs text-amber-500 mt-1">Nur gerade Treppen werden aktuell unterstutzt</p>
        )}
      </div>

      {/* Width Input */}
      <div className="mb-3">
        <label className="text-xs text-muted-foreground mb-1.5 block">Breite (m)</label>
        <input
          type="number"
          value={params.width}
          onChange={handleWidthChange}
          step={0.05}
          min={0.8}
          max={2.0}
          className="w-full px-2 py-1.5 text-sm border border-input rounded bg-background"
        />
        <p className="text-xs text-muted-foreground mt-1">Lichte Breite: 0.8 - 2.0m (DIN 18065)</p>
      </div>

      {/* Target Storey Selection */}
      <div className="mb-3">
        <label className="text-xs text-muted-foreground mb-1.5 block">Zielgeschoss</label>
        {allTargetStoreys.length === 0 ? (
          <p className="text-xs text-amber-500">
            Kein anderes Geschoss verfugbar. Erstellen Sie zuerst ein weiteres Geschoss.
          </p>
        ) : (
          <>
            <select
              value={effectiveTargetStoreyId ?? ''}
              onChange={handleTargetStoreyChange}
              className="w-full px-2 py-1.5 text-sm border border-input rounded bg-background"
            >
              {/* Storeys above */}
              {storeysAbove.length > 0 && (
                <optgroup label="Nach oben">
                  {storeysAbove.map((storey) => (
                    <option key={storey.id} value={storey.id}>
                      ↑ {storey.name} (+{(storey.elevation - (currentStorey?.elevation ?? 0)).toFixed(2)}m)
                    </option>
                  ))}
                </optgroup>
              )}
              {/* Storeys below */}
              {storeysBelow.length > 0 && (
                <optgroup label="Nach unten">
                  {storeysBelow.map((storey) => (
                    <option key={storey.id} value={storey.id}>
                      ↓ {storey.name} ({(storey.elevation - (currentStorey?.elevation ?? 0)).toFixed(2)}m)
                    </option>
                  ))}
                </optgroup>
              )}
            </select>

            {/* Direction indicator */}
            <div
              className={`mt-2 flex items-center gap-2 text-xs px-2 py-1.5 rounded ${
                isGoingUp ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
              }`}
            >
              {isGoingUp ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
              <span>
                Treppe fuhrt {isGoingUp ? 'nach oben' : 'nach unten'}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Preview Info */}
      {totalRise !== null && totalRise > 0 && (
        <div className="border-t border-border pt-3 mt-3">
          <label className="text-xs text-muted-foreground mb-2 block">Vorschau (DIN 18065)</label>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Gesamthohe:</span>
              <span className="font-mono">{totalRise.toFixed(2)} m</span>
            </div>
            {/* Estimate step count */}
            {(() => {
              const targetRiser = 0.18; // DIN 18065 optimal
              const estimatedSteps = Math.round(totalRise / targetRiser);
              const actualRiser = totalRise / estimatedSteps;
              const tread = 0.63 - 2 * actualRiser; // Schrittmassregel
              const runLength = (estimatedSteps - 1) * tread;

              return (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">~Stufen:</span>
                    <span className="font-mono">{estimatedSteps}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">~Steigung:</span>
                    <span className="font-mono">{(actualRiser * 100).toFixed(1)} cm</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">~Lauflange:</span>
                    <span className="font-mono">{runLength.toFixed(2)} m</span>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Placement Status */}
      {startPoint && (
        <div className="border-t border-border pt-3 mt-3">
          <label className="text-xs text-muted-foreground mb-2 block">Platzierung</label>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-muted rounded p-2">
              <span className="text-muted-foreground">X:</span>
              <span className="ml-1 font-mono">{startPoint.x.toFixed(2)}m</span>
            </div>
            <div className="bg-muted rounded p-2">
              <span className="text-muted-foreground">Y:</span>
              <span className="ml-1 font-mono">{startPoint.y.toFixed(2)}m</span>
            </div>
          </div>
          <div className="mt-2 text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-400">
            Klicken Sie, um die Richtung zu bestimmen
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="border-t border-border pt-3 mt-3 text-xs text-muted-foreground">
        {!startPoint ? (
          <p>Klicken Sie, um den Startpunkt der Treppe zu setzen.</p>
        ) : (
          <p>Klicken Sie erneut, um die Laufrichtung festzulegen.</p>
        )}
      </div>
    </div>
  );
}
