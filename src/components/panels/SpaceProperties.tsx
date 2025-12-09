import { useCallback } from 'react';
import type { BimElement, SpaceType, GastroSpaceCategory } from '@/types/bim';
import { GASTRO_SPACE_LABELS, GASTRO_SPACE_COLORS } from '@/types/bim';
import { useElementStore } from '@/store';
import {
  updateSpaceProperties,
  renameSpace,
  getSpaceVolume,
  getSpaceNetVolume,
  updateSpaceNetFloorArea,
} from '@/bim/elements';

interface SpacePropertiesProps {
  element: BimElement;
}

const SPACE_TYPES: { value: SpaceType; label: string }[] = [
  { value: 'INTERNAL', label: 'Innenraum' },
  { value: 'EXTERNAL', label: 'Aussenbereich' },
  { value: 'NOTDEFINED', label: 'Nicht definiert' },
];

const GASTRO_CATEGORIES: { value: GastroSpaceCategory; label: string }[] = [
  { value: 'GASTRAUM', label: GASTRO_SPACE_LABELS.GASTRAUM },
  { value: 'BAR', label: GASTRO_SPACE_LABELS.BAR },
  { value: 'KUECHE', label: GASTRO_SPACE_LABELS.KUECHE },
  { value: 'LAGER', label: GASTRO_SPACE_LABELS.LAGER },
  { value: 'SANITAER', label: GASTRO_SPACE_LABELS.SANITAER },
  { value: 'PERSONAL', label: GASTRO_SPACE_LABELS.PERSONAL },
  { value: 'EINGANG', label: GASTRO_SPACE_LABELS.EINGANG },
  { value: 'TERRASSE', label: GASTRO_SPACE_LABELS.TERRASSE },
  { value: 'TECHNIK', label: GASTRO_SPACE_LABELS.TECHNIK },
  { value: 'SONSTIGES', label: GASTRO_SPACE_LABELS.SONSTIGES },
];

/**
 * Space-specific properties editor
 * Shows room area, perimeter, volume and allows editing type
 */
export function SpaceProperties({ element }: SpacePropertiesProps) {
  const { updateElement, getAllElements } = useElementStore();

  const spaceData = element.spaceData;

  // Update space type
  const handleSpaceTypeChange = useCallback(
    (spaceType: SpaceType) => {
      if (!spaceData) return;

      const updated = updateSpaceProperties(element, { spaceType });
      updateElement(element.id, updated);
    },
    [spaceData, element, updateElement]
  );

  // Update long name
  const handleLongNameChange = useCallback(
    (longName: string) => {
      if (!spaceData) return;

      const updated = updateSpaceProperties(element, { longName: longName || undefined });
      updateElement(element.id, updated);
    },
    [spaceData, element, updateElement]
  );

  // Update gastro category
  const handleGastroCategoryChange = useCallback(
    (gastroCategory: GastroSpaceCategory) => {
      if (!spaceData) return;

      const updated = updateSpaceProperties(element, { gastroCategory });
      updateElement(element.id, updated);
    },
    [spaceData, element, updateElement]
  );

  // Rename space
  const handleNameChange = useCallback(
    (name: string) => {
      if (!spaceData || !name.trim()) return;

      const updated = renameSpace(element, name.trim());
      updateElement(element.id, updated);
    },
    [spaceData, element, updateElement]
  );

  // Recalculate net floor area
  const handleRecalculateNetArea = useCallback(() => {
    if (!spaceData) return;

    const allElements = getAllElements();
    const updated = updateSpaceNetFloorArea(element, allElements);
    updateElement(element.id, updated);
  }, [spaceData, element, getAllElements, updateElement]);

  if (!spaceData) {
    return <div className="text-sm text-muted-foreground">Raum-Daten nicht verfügbar</div>;
  }

  const volume = getSpaceVolume(element);
  const netVolume = getSpaceNetVolume(element);
  const netArea = spaceData.netFloorArea;
  const hasNetArea = netArea !== undefined;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Raum-Parameter</h3>

      {/* Name */}
      <div>
        <label className="text-xs text-muted-foreground">Name</label>
        <input
          type="text"
          value={element.name}
          onChange={(e) => handleNameChange(e.target.value)}
          className="w-full mt-1 px-2 py-1.5 text-sm border rounded bg-background"
        />
      </div>

      {/* Long Name / Description */}
      <div>
        <label className="text-xs text-muted-foreground">Beschreibung</label>
        <input
          type="text"
          value={spaceData.longName || ''}
          onChange={(e) => handleLongNameChange(e.target.value)}
          placeholder="z.B. Hauptgastraum mit Theke"
          className="w-full mt-1 px-2 py-1.5 text-sm border rounded bg-background"
        />
      </div>

      {/* Gastro Category Selection */}
      <div>
        <label className="text-xs text-muted-foreground block mb-1.5">Raumkategorie</label>
        <div className="grid grid-cols-2 gap-1">
          {GASTRO_CATEGORIES.map((cat) => {
            const isSelected = spaceData.gastroCategory === cat.value;
            const color = GASTRO_SPACE_COLORS[cat.value];
            return (
              <button
                key={cat.value}
                onClick={() => handleGastroCategoryChange(cat.value)}
                className={`px-2 py-1.5 text-xs rounded border transition-colors truncate ${
                  isSelected
                    ? 'border-primary ring-1 ring-primary'
                    : 'border-border hover:bg-accent'
                }`}
                style={{
                  backgroundColor: isSelected ? color : undefined,
                  color: isSelected ? '#000' : undefined,
                }}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Space Type Selection (IFC) */}
      <div>
        <label className="text-xs text-muted-foreground block mb-1.5">IFC-Raumtyp</label>
        <div className="grid grid-cols-3 gap-1">
          {SPACE_TYPES.map((type) => (
            <button
              key={type.value}
              onClick={() => handleSpaceTypeChange(type.value)}
              className={`px-2 py-1.5 text-xs rounded border transition-colors ${
                spaceData.spaceType === type.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted border-border hover:bg-accent'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* Calculated Values - Key Metrics */}
      <div className="p-3 bg-muted rounded-md space-y-2">
        {/* Gross Area */}
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Bruttofläche</span>
          <span className="text-sm font-semibold font-mono">{spaceData.area.toFixed(2)} m²</span>
        </div>

        {/* Net Area */}
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Nettofläche</span>
          {hasNetArea ? (
            <span className="text-sm font-semibold font-mono text-green-600">
              {netArea.toFixed(2)} m²
            </span>
          ) : (
            <span className="text-xs text-muted-foreground italic">nicht berechnet</span>
          )}
        </div>

        {/* Deducted area info */}
        {hasNetArea && (
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground">Abzug (Stützen, Theken)</span>
            <span className="font-mono text-orange-600">
              -{(spaceData.area - netArea).toFixed(2)} m²
            </span>
          </div>
        )}

        <div className="border-t my-2" />

        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Umfang</span>
          <span className="text-sm font-medium font-mono">{spaceData.perimeter.toFixed(2)} m</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Volumen (brutto)</span>
          <span className="text-sm font-medium font-mono">{volume.toFixed(2)} m³</span>
        </div>
        {hasNetArea && (
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Volumen (netto)</span>
            <span className="text-sm font-medium font-mono text-green-600">{netVolume.toFixed(2)} m³</span>
          </div>
        )}
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Höhe</span>
          <span className="text-sm font-medium font-mono">{element.geometry.height.toFixed(2)} m</span>
        </div>

        {/* Recalculate button */}
        <button
          onClick={handleRecalculateNetArea}
          className="w-full mt-2 px-2 py-1.5 text-xs rounded border border-border bg-background hover:bg-accent transition-colors"
        >
          Nettofläche neu berechnen
        </button>
      </div>

      {/* Bounding Walls Info */}
      <div>
        <label className="text-xs text-muted-foreground">Begrenzende Wände</label>
        <p className="text-sm font-medium">{spaceData.boundingWallIds.length} Wände</p>
      </div>

      {/* Detection Info */}
      <div className="pt-2 border-t text-xs text-muted-foreground">
        <div className="flex justify-between">
          <span>Erkennung:</span>
          <span>{spaceData.autoDetected ? 'Automatisch' : 'Manuell'}</span>
        </div>
        <div className="flex justify-between mt-1">
          <span>Polygon-Punkte:</span>
          <span>{spaceData.boundaryPolygon.length}</span>
        </div>
      </div>

      {/* Boundary coordinates (collapsed by default) */}
      <details className="pt-2 border-t">
        <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
          Koordinaten anzeigen
        </summary>
        <div className="mt-2 space-y-1 text-xs font-mono text-muted-foreground max-h-32 overflow-y-auto">
          {spaceData.boundaryPolygon.map((point, index) => (
            <div key={index} className="flex justify-between">
              <span>P{index + 1}:</span>
              <span>
                ({point.x.toFixed(2)}, {point.y.toFixed(2)})
              </span>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
