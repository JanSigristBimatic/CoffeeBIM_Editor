import { useSelectionStore, useElementStore } from '@/store';
import { DoorProperties } from './DoorProperties';
import { WindowProperties } from './WindowProperties';

export function PropertyPanel() {
  const { getSelectedIds } = useSelectionStore();
  const { getElement } = useElementStore();

  const selectedIds = getSelectedIds();

  if (selectedIds.length === 0) {
    return (
      <div className="p-4">
        <h2 className="text-lg font-semibold mb-4">Eigenschaften</h2>
        <p className="text-sm text-muted-foreground">
          Wählen Sie ein Element aus, um seine Eigenschaften zu bearbeiten.
        </p>
      </div>
    );
  }

  if (selectedIds.length > 1) {
    return (
      <div className="p-4">
        <h2 className="text-lg font-semibold mb-4">Eigenschaften</h2>
        <p className="text-sm text-muted-foreground">
          {selectedIds.length} Elemente ausgewählt.
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Mehrfachbearbeitung wird noch nicht unterstützt.
        </p>
      </div>
    );
  }

  const element = getElement(selectedIds[0]!);

  if (!element) {
    return (
      <div className="p-4">
        <h2 className="text-lg font-semibold mb-4">Eigenschaften</h2>
        <p className="text-sm text-muted-foreground">Element nicht gefunden.</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-4">Eigenschaften</h2>

      {/* Basic Info */}
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium text-muted-foreground">Typ</label>
          <p className="text-sm capitalize">{element.type}</p>
        </div>

        <div>
          <label className="text-sm font-medium text-muted-foreground">Name</label>
          <input
            type="text"
            value={element.name}
            readOnly
            className="w-full mt-1 px-2 py-1 text-sm border rounded bg-muted"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-muted-foreground">ID</label>
          <p className="text-xs font-mono text-muted-foreground truncate">{element.id}</p>
        </div>
      </div>

      {/* Wall-specific properties */}
      {element.type === 'wall' && element.wallData && (
        <div className="mt-4 pt-4 border-t space-y-3">
          <h3 className="text-sm font-semibold">Wand-Parameter</h3>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Dicke (m)</label>
              <input
                type="number"
                value={element.wallData.thickness}
                readOnly
                className="w-full mt-1 px-2 py-1 text-sm border rounded bg-muted"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Höhe (m)</label>
              <input
                type="number"
                value={element.wallData.height}
                readOnly
                className="w-full mt-1 px-2 py-1 text-sm border rounded bg-muted"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Öffnungen</label>
            <p className="text-sm">{element.wallData.openings.length}</p>
          </div>
        </div>
      )}

      {/* Door-specific properties */}
      {element.type === 'door' && element.doorData && (
        <div className="mt-4 pt-4 border-t">
          <DoorProperties element={element} />
        </div>
      )}

      {/* Window-specific properties */}
      {element.type === 'window' && element.windowData && (
        <div className="mt-4 pt-4 border-t">
          <WindowProperties element={element} />
        </div>
      )}
    </div>
  );
}
