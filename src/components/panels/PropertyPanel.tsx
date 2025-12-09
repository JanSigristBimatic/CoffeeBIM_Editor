import { useMemo } from 'react';
import { useSelectionStore, useElementStore } from '@/store';
import { DoorProperties } from './DoorProperties';
import { WindowProperties } from './WindowProperties';
import { ColumnProperties } from './ColumnProperties';
import { WallProperties } from './WallProperties';
import { SlabProperties } from './SlabProperties';
import { FurnitureProperties } from './FurnitureProperties';
import { CounterProperties } from './CounterProperties';
import { SpaceProperties } from './SpaceProperties';
import { StairProperties } from './StairProperties';
import { MultiEditPanel } from './MultiEditPanel';

export function PropertyPanel() {
  const { getSelectedIds } = useSelectionStore();
  const { getElement } = useElementStore();

  const selectedIds = getSelectedIds();

  // Get all selected elements for multi-edit
  const selectedElements = useMemo(
    () => selectedIds.map((id) => getElement(id)).filter((e) => e !== undefined),
    [selectedIds, getElement]
  );

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

  // Multi-selection: Show MultiEditPanel
  if (selectedIds.length > 1) {
    return (
      <div className="p-4">
        <h2 className="text-lg font-semibold mb-4">Mehrfachbearbeitung</h2>
        <MultiEditPanel selectedElements={selectedElements} />
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
        <div className="mt-4 pt-4 border-t">
          <WallProperties element={element} />
        </div>
      )}

      {/* Slab-specific properties */}
      {element.type === 'slab' && element.slabData && (
        <div className="mt-4 pt-4 border-t">
          <SlabProperties element={element} />
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

      {/* Column-specific properties */}
      {element.type === 'column' && element.columnData && (
        <div className="mt-4 pt-4 border-t">
          <ColumnProperties element={element} />
        </div>
      )}

      {/* Furniture-specific properties */}
      {element.type === 'furniture' && element.furnitureData && (
        <div className="mt-4 pt-4 border-t">
          <FurnitureProperties element={element} />
        </div>
      )}

      {/* Counter-specific properties */}
      {element.type === 'counter' && element.counterData && (
        <div className="mt-4 pt-4 border-t">
          <CounterProperties element={element} />
        </div>
      )}

      {/* Space-specific properties */}
      {element.type === 'space' && element.spaceData && (
        <div className="mt-4 pt-4 border-t">
          <SpaceProperties element={element} />
        </div>
      )}

      {/* Stair-specific properties */}
      {element.type === 'stair' && element.stairData && (
        <div className="mt-4 pt-4 border-t">
          <StairProperties element={element} />
        </div>
      )}
    </div>
  );
}
