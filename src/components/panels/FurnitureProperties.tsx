import { useCallback } from 'react';
import type { BimElement } from '@/types/bim';
import { useElementStore } from '@/store';
import type { FurnitureCategory } from '@/bim/elements';
import { AssetPropertySets } from './AssetPropertySets';

interface FurniturePropertiesProps {
  element: BimElement;
}

const CATEGORY_LABELS: Record<FurnitureCategory, string> = {
  table: 'Tisch',
  chair: 'Stuhl',
  sofa: 'Sofa',
  'coffee-machine': 'Kaffeemaschine',
  grinder: 'Mühle',
  refrigerator: 'Kühlschrank',
  counter: 'Theke',
  shelf: 'Regal',
  cabinet: 'Schrank',
  appliance: 'Gerät',
  decoration: 'Dekoration',
  other: 'Sonstiges',
};

const CATEGORY_OPTIONS: FurnitureCategory[] = [
  'coffee-machine',
  'grinder',
  'refrigerator',
  'counter',
  'table',
  'chair',
  'sofa',
  'shelf',
  'cabinet',
  'appliance',
  'decoration',
  'other',
];

/**
 * Furniture-specific properties editor
 * Allows editing furniture properties after import
 */
export function FurnitureProperties({ element }: FurniturePropertiesProps) {
  const { updateElement } = useElementStore();

  const furnitureData = element.furnitureData;

  // Update scale
  const handleScaleChange = useCallback(
    (newScale: number) => {
      if (!furnitureData) return;

      // Clamp scale to valid range (0.001 = mm to m conversion)
      const clampedScale = Math.max(0.001, Math.min(100, newScale));

      updateElement(element.id, {
        furnitureData: {
          ...furnitureData,
          scale: clampedScale,
        },
      });
    },
    [furnitureData, element.id, updateElement]
  );

  // Update category
  const handleCategoryChange = useCallback(
    (category: string) => {
      if (!furnitureData) return;

      updateElement(element.id, {
        furnitureData: {
          ...furnitureData,
          category,
        },
      });
    },
    [furnitureData, element.id, updateElement]
  );

  // Update name
  const handleNameChange = useCallback(
    (name: string) => {
      updateElement(element.id, { name });
    },
    [element.id, updateElement]
  );

  // Update position
  const handlePositionChange = useCallback(
    (axis: 'x' | 'y' | 'z', value: number) => {
      updateElement(element.id, {
        placement: {
          ...element.placement,
          position: {
            ...element.placement.position,
            [axis]: value,
          },
        },
      });
    },
    [element, updateElement]
  );

  // Update rotation (Y-axis only for simplicity)
  const handleRotationChange = useCallback(
    (degrees: number) => {
      const radians = (degrees * Math.PI) / 180;

      updateElement(element.id, {
        placement: {
          ...element.placement,
          rotation: {
            x: 0,
            y: Math.sin(radians / 2),
            z: 0,
            w: Math.cos(radians / 2),
          },
        },
      });
    },
    [element, updateElement]
  );

  // Calculate current Y rotation in degrees
  const currentRotationDegrees = (() => {
    const { rotation } = element.placement;
    // Extract Y rotation from quaternion
    const sinHalfAngle = rotation.y;
    const cosHalfAngle = rotation.w;
    const radians = 2 * Math.atan2(sinHalfAngle, cosHalfAngle);
    return (radians * 180) / Math.PI;
  })();

  if (!furnitureData) {
    return (
      <div className="text-sm text-muted-foreground">Möbel-Daten nicht verfügbar</div>
    );
  }

  const categoryLabel =
    CATEGORY_LABELS[furnitureData.category as FurnitureCategory] || furnitureData.category;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Möbel-Parameter</h3>

      {/* Name */}
      <div>
        <label className="text-xs text-muted-foreground block mb-1">Name</label>
        <input
          type="text"
          value={element.name}
          onChange={(e) => handleNameChange(e.target.value)}
          className="w-full px-2 py-1.5 text-sm border rounded bg-background"
        />
      </div>

      {/* Category */}
      <div>
        <label className="text-xs text-muted-foreground block mb-1">Kategorie</label>
        <select
          value={furnitureData.category}
          onChange={(e) => handleCategoryChange(e.target.value)}
          className="w-full px-2 py-1.5 text-sm border rounded bg-background"
        >
          {CATEGORY_OPTIONS.map((cat) => (
            <option key={cat} value={cat}>
              {CATEGORY_LABELS[cat]}
            </option>
          ))}
        </select>
      </div>

      {/* Scale */}
      <div>
        <label className="text-xs text-muted-foreground block mb-1">
          Skalierung ({furnitureData.scale < 0.01
            ? (furnitureData.scale * 1000).toFixed(1) + '‰'
            : (furnitureData.scale * 100).toFixed(1) + '%'})
        </label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            value={Math.log10(furnitureData.scale)}
            onChange={(e) => handleScaleChange(Math.pow(10, parseFloat(e.target.value)))}
            step={0.1}
            min={-3}
            max={1}
            className="flex-1"
          />
          <input
            type="number"
            value={furnitureData.scale}
            onChange={(e) => handleScaleChange(parseFloat(e.target.value) || 1)}
            step={0.001}
            min={0.001}
            max={100}
            className="w-20 px-2 py-1 text-sm border rounded bg-background"
          />
        </div>
        {/* Quick scale buttons */}
        <div className="flex flex-wrap gap-1 mt-2">
          {[
            { scale: 0.001, label: 'm→mm' },
            { scale: 0.01, label: 'cm→m' },
            { scale: 0.1, label: 'cm→mm' },
            { scale: 0.3048, label: 'fuss→m' },
            { scale: 0.0328, label: 'fuss→cm' },
            { scale: 0.00328, label: 'fuss→mm' },
            { scale: 1, label: '100%' },
          ].map(({ scale, label }) => (
            <button
              key={scale}
              onClick={() => handleScaleChange(scale)}
              className={`px-2 py-1 text-xs rounded border transition-colors ${
                Math.abs(furnitureData.scale - scale) < scale * 0.1
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted border-border hover:bg-accent'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Rotation */}
      <div>
        <label className="text-xs text-muted-foreground block mb-1">Rotation (Y-Achse)</label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            value={currentRotationDegrees}
            onChange={(e) => handleRotationChange(parseFloat(e.target.value))}
            step={15}
            min={0}
            max={360}
            className="flex-1"
          />
          <input
            type="number"
            value={Math.round(currentRotationDegrees)}
            onChange={(e) => handleRotationChange(parseFloat(e.target.value) || 0)}
            step={15}
            min={0}
            max={360}
            className="w-16 px-2 py-1 text-sm border rounded bg-background"
          />
          <span className="text-xs text-muted-foreground">°</span>
        </div>
      </div>

      {/* Quick rotation buttons */}
      <div className="flex gap-1">
        {[0, 90, 180, 270].map((angle) => (
          <button
            key={angle}
            onClick={() => handleRotationChange(angle)}
            className={`flex-1 px-2 py-1 text-xs rounded border transition-colors ${
              Math.abs(currentRotationDegrees - angle) < 5
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-muted border-border hover:bg-accent'
            }`}
          >
            {angle}°
          </button>
        ))}
      </div>

      {/* Position */}
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground block">Position (m)</label>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-xs text-muted-foreground">X</label>
            <input
              type="number"
              value={element.placement.position.x.toFixed(2)}
              onChange={(e) => handlePositionChange('x', parseFloat(e.target.value) || 0)}
              step={0.1}
              className="w-full px-2 py-1 text-sm border rounded bg-background"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Y</label>
            <input
              type="number"
              value={element.placement.position.y.toFixed(2)}
              onChange={(e) => handlePositionChange('y', parseFloat(e.target.value) || 0)}
              step={0.1}
              className="w-full px-2 py-1 text-sm border rounded bg-background"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Z</label>
            <input
              type="number"
              value={element.placement.position.z.toFixed(2)}
              onChange={(e) => handlePositionChange('z', parseFloat(e.target.value) || 0)}
              step={0.1}
              className="w-full px-2 py-1 text-sm border rounded bg-background"
            />
          </div>
        </div>
      </div>

      {/* Model Info */}
      <div className="pt-2 border-t space-y-1">
        <h4 className="text-xs font-medium text-muted-foreground">Modell-Info</h4>

        {furnitureData.originalFileName && (
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Datei:</span>
            <span className="font-mono truncate max-w-[60%]" title={furnitureData.originalFileName}>
              {furnitureData.originalFileName}
            </span>
          </div>
        )}

        {furnitureData.modelFormat && (
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Format:</span>
            <span className="font-mono uppercase">{furnitureData.modelFormat}</span>
          </div>
        )}

        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Kategorie:</span>
          <span>{categoryLabel}</span>
        </div>
      </div>

      {/* Dimensions (from bounding box) */}
      <div className="pt-2 border-t text-xs text-muted-foreground">
        <div className="flex justify-between">
          <span>Breite:</span>
          <span className="font-mono">{furnitureData.width.toFixed(2)}m</span>
        </div>
        <div className="flex justify-between mt-1">
          <span>Tiefe:</span>
          <span className="font-mono">{furnitureData.depth.toFixed(2)}m</span>
        </div>
        <div className="flex justify-between mt-1">
          <span>Höhe:</span>
          <span className="font-mono">{furnitureData.height.toFixed(2)}m</span>
        </div>
      </div>

      {/* Asset Property Sets */}
      <div className="pt-2 border-t">
        <AssetPropertySets element={element} />
      </div>
    </div>
  );
}
