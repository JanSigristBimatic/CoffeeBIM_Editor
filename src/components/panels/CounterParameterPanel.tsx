import { useToolStore } from '@/store';
import type { CounterType } from '@/types/bim';

const COUNTER_TYPES: { value: CounterType; label: string; description: string }[] = [
  { value: 'standard', label: 'Standard', description: '90cm Höhe, 10cm Überstand' },
  { value: 'bar', label: 'Bar', description: '110cm Höhe, 30cm Überstand, Fußstütze' },
  { value: 'service', label: 'Service', description: '90cm Höhe, kein Überstand' },
];

/**
 * Panel for configuring counter parameters before placement
 */
export function CounterParameterPanel() {
  const { counterPlacement, setCounterType, setCounterParams } = useToolStore();
  const { params, points, isDrawing } = counterPlacement;

  return (
    <div className="p-3 space-y-4 text-sm">
      <div>
        <h3 className="font-semibold text-base mb-3">Theken-Parameter</h3>

        {/* Counter Type Selection */}
        <div className="space-y-2 mb-4">
          <label className="text-xs text-muted-foreground block">Theken-Typ</label>
          <div className="space-y-1">
            {COUNTER_TYPES.map((type) => (
              <button
                key={type.value}
                onClick={() => setCounterType(type.value)}
                disabled={isDrawing}
                className={`w-full text-left px-2 py-1.5 rounded border transition-colors ${
                  params.counterType === type.value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted border-border hover:bg-accent disabled:opacity-50'
                }`}
              >
                <div className="font-medium text-xs">{type.label}</div>
                <div className="text-[10px] opacity-70">{type.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Depth */}
        <div className="space-y-1 mb-3">
          <label className="text-xs text-muted-foreground">Tiefe (m)</label>
          <input
            type="number"
            value={params.depth}
            onChange={(e) =>
              setCounterParams({ depth: parseFloat(e.target.value) || params.depth })
            }
            step={0.05}
            min={0.3}
            max={1.5}
            disabled={isDrawing}
            className="w-full px-2 py-1 text-sm border rounded bg-background disabled:opacity-50"
          />
        </div>

        {/* Height */}
        <div className="space-y-1 mb-3">
          <label className="text-xs text-muted-foreground">Höhe (m)</label>
          <input
            type="number"
            value={params.height}
            onChange={(e) =>
              setCounterParams({ height: parseFloat(e.target.value) || params.height })
            }
            step={0.05}
            min={0.6}
            max={1.5}
            disabled={isDrawing}
            className="w-full px-2 py-1 text-sm border rounded bg-background disabled:opacity-50"
          />
        </div>

        {/* Overhang */}
        <div className="space-y-1 mb-3">
          <label className="text-xs text-muted-foreground">Überstand (m)</label>
          <input
            type="number"
            value={params.overhang}
            onChange={(e) =>
              setCounterParams({ overhang: parseFloat(e.target.value) || 0 })
            }
            step={0.05}
            min={0}
            max={0.5}
            disabled={isDrawing}
            className="w-full px-2 py-1 text-sm border rounded bg-background disabled:opacity-50"
          />
        </div>

        {/* Top Thickness */}
        <div className="space-y-1 mb-3">
          <label className="text-xs text-muted-foreground">Plattendicke (m)</label>
          <input
            type="number"
            value={params.topThickness}
            onChange={(e) =>
              setCounterParams({ topThickness: parseFloat(e.target.value) || params.topThickness })
            }
            step={0.01}
            min={0.02}
            max={0.1}
            disabled={isDrawing}
            className="w-full px-2 py-1 text-sm border rounded bg-background disabled:opacity-50"
          />
        </div>

        {/* Advanced Settings Collapsible */}
        <details className="mt-4 pt-3 border-t">
          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
            Erweiterte Einstellungen
          </summary>
          <div className="mt-3 space-y-3">
            {/* Kick Height */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Sockel-Höhe (m)</label>
              <input
                type="number"
                value={params.kickHeight}
                onChange={(e) =>
                  setCounterParams({ kickHeight: parseFloat(e.target.value) || 0 })
                }
                step={0.01}
                min={0}
                max={0.3}
                disabled={isDrawing}
                className="w-full px-2 py-1 text-sm border rounded bg-background disabled:opacity-50"
              />
            </div>

            {/* Kick Recess */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Sockel-Rücksprung (m)</label>
              <input
                type="number"
                value={params.kickRecess}
                onChange={(e) =>
                  setCounterParams({ kickRecess: parseFloat(e.target.value) || 0 })
                }
                step={0.01}
                min={0}
                max={0.2}
                disabled={isDrawing}
                className="w-full px-2 py-1 text-sm border rounded bg-background disabled:opacity-50"
              />
            </div>

            {/* Footrest */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="hasFootrest"
                checked={params.hasFootrest}
                onChange={(e) => setCounterParams({ hasFootrest: e.target.checked })}
                disabled={isDrawing}
                className="rounded border-border"
              />
              <label htmlFor="hasFootrest" className="text-xs text-muted-foreground">
                Fußstütze
              </label>
            </div>

            {/* Footrest Height */}
            {params.hasFootrest && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Fußstützen-Höhe (m)</label>
                <input
                  type="number"
                  value={params.footrestHeight}
                  onChange={(e) =>
                    setCounterParams({ footrestHeight: parseFloat(e.target.value) || 0.2 })
                  }
                  step={0.01}
                  min={0.1}
                  max={0.4}
                  disabled={isDrawing}
                  className="w-full px-2 py-1 text-sm border rounded bg-background disabled:opacity-50"
                />
              </div>
            )}
          </div>
        </details>
      </div>

      {/* Placement status */}
      <div className="pt-3 border-t text-xs text-muted-foreground">
        {isDrawing ? (
          <div>
            <p className="font-medium text-foreground">Zeichnen aktiv</p>
            <p>{points.length} Punkt(e) gesetzt</p>
            <p className="mt-1">Rechtsklick zum Abschliessen</p>
          </div>
        ) : (
          <div>
            <p>Klicken Sie, um die Frontlinie zu zeichnen.</p>
            <p className="mt-1 text-[10px]">Die Theke wird nach hinten erweitert.</p>
          </div>
        )}
      </div>
    </div>
  );
}
