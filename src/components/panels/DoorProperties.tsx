import { useCallback, useMemo } from 'react';
import type { BimElement } from '@/types/bim';
import { useElementStore } from '@/store';
import {
  calculateDoorDistances,
  calculatePositionFromLeftDistance,
  calculatePositionFromRightDistance,
  getDoorTypeLabel,
} from '@/bim/elements/Door';
import { formatDistance } from '@/components/three';

interface DoorPropertiesProps {
  element: BimElement;
}

/**
 * Door-specific properties editor
 * Allows editing distances to wall edges after placement
 */
export function DoorProperties({ element }: DoorPropertiesProps) {
  const { getElement, updateElement } = useElementStore();

  const doorData = element.doorData;

  // Get host wall and calculate wall length
  const wallInfo = useMemo(() => {
    if (!doorData) return null;
    const hostWall = getElement(doorData.hostWallId);
    if (!hostWall?.wallData) return null;

    const { startPoint, endPoint } = hostWall.wallData;
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const wallLength = Math.sqrt(dx * dx + dy * dy);

    return { hostWall, wallLength };
  }, [doorData, getElement]);

  // Update door position based on new left distance
  const handleLeftDistanceChange = useCallback(
    (newDistanceFromLeft: number) => {
      if (!doorData || !wallInfo) return;

      const { wallLength } = wallInfo;
      const minDistance = 0;
      const maxDistance = wallLength - doorData.width;

      // Clamp value
      const clampedDistance = Math.max(minDistance, Math.min(maxDistance, newDistanceFromLeft));

      // Calculate new position
      const newPosition = calculatePositionFromLeftDistance(clampedDistance, doorData.width, wallLength);

      // Calculate new distances
      const { distanceFromLeft, distanceFromRight } = calculateDoorDistances(
        newPosition,
        doorData.width,
        wallLength
      );

      // Update element
      updateElement(element.id, {
        doorData: {
          ...doorData,
          positionOnWall: newPosition,
          distanceFromLeft,
          distanceFromRight,
        },
      });
    },
    [doorData, wallInfo, element.id, updateElement]
  );

  // Update door position based on new right distance
  const handleRightDistanceChange = useCallback(
    (newDistanceFromRight: number) => {
      if (!doorData || !wallInfo) return;

      const { wallLength } = wallInfo;
      const minDistance = 0;
      const maxDistance = wallLength - doorData.width;

      // Clamp value
      const clampedDistance = Math.max(minDistance, Math.min(maxDistance, newDistanceFromRight));

      // Calculate new position
      const newPosition = calculatePositionFromRightDistance(clampedDistance, doorData.width, wallLength);

      // Calculate new distances
      const { distanceFromLeft, distanceFromRight } = calculateDoorDistances(
        newPosition,
        doorData.width,
        wallLength
      );

      // Update element
      updateElement(element.id, {
        doorData: {
          ...doorData,
          positionOnWall: newPosition,
          distanceFromLeft,
          distanceFromRight,
        },
      });
    },
    [doorData, wallInfo, element.id, updateElement]
  );

  // Update door width
  const handleWidthChange = useCallback(
    (newWidth: number) => {
      if (!doorData || !wallInfo) return;

      const { wallLength } = wallInfo;

      // Clamp width to valid range
      const minWidth = 0.5;
      const maxWidth = Math.min(3, wallLength - 0.1); // Leave some margin
      const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));

      // Recalculate distances with new width, keeping center position
      const { distanceFromLeft, distanceFromRight } = calculateDoorDistances(
        doorData.positionOnWall,
        clampedWidth,
        wallLength
      );

      // Check if door still fits
      if (distanceFromLeft < 0 || distanceFromRight < 0) {
        // Center the door if it doesn't fit at current position
        const newPosition = 0.5;
        const newDistances = calculateDoorDistances(newPosition, clampedWidth, wallLength);

        updateElement(element.id, {
          doorData: {
            ...doorData,
            width: clampedWidth,
            positionOnWall: newPosition,
            distanceFromLeft: newDistances.distanceFromLeft,
            distanceFromRight: newDistances.distanceFromRight,
          },
        });
      } else {
        updateElement(element.id, {
          doorData: {
            ...doorData,
            width: clampedWidth,
            distanceFromLeft,
            distanceFromRight,
          },
        });
      }
    },
    [doorData, wallInfo, element.id, updateElement]
  );

  // Update door height
  const handleHeightChange = useCallback(
    (newHeight: number) => {
      if (!doorData) return;

      const clampedHeight = Math.max(1.5, Math.min(3, newHeight));

      updateElement(element.id, {
        doorData: {
          ...doorData,
          height: clampedHeight,
        },
      });
    },
    [doorData, element.id, updateElement]
  );

  // Update sill height (Brüstungshöhe)
  const handleSillHeightChange = useCallback(
    (newSillHeight: number) => {
      if (!doorData) return;

      // Clamp sill height (0 for doors, up to 2m for high windows)
      const clampedSillHeight = Math.max(0, Math.min(2, newSillHeight));

      updateElement(element.id, {
        doorData: {
          ...doorData,
          sillHeight: clampedSillHeight,
        },
      });
    },
    [doorData, element.id, updateElement]
  );

  if (!doorData || !wallInfo) {
    return (
      <div className="text-sm text-muted-foreground">
        Tür-Daten nicht verfügbar
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Tür-Parameter</h3>

      {/* Door Type (read-only) */}
      <div>
        <label className="text-xs text-muted-foreground">Türart</label>
        <p className="text-sm font-medium">{getDoorTypeLabel(doorData.doorType)}</p>
      </div>

      {/* Dimensions */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-muted-foreground">Breite (m)</label>
          <input
            type="number"
            value={doorData.width}
            onChange={(e) => handleWidthChange(parseFloat(e.target.value) || doorData.width)}
            step={0.05}
            min={0.5}
            max={3}
            className="w-full mt-1 px-2 py-1.5 text-sm border rounded bg-background"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Höhe (m)</label>
          <input
            type="number"
            value={doorData.height}
            onChange={(e) => handleHeightChange(parseFloat(e.target.value) || doorData.height)}
            step={0.05}
            min={1.5}
            max={3}
            className="w-full mt-1 px-2 py-1.5 text-sm border rounded bg-background"
          />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-muted-foreground">Brüstungshöhe (m)</label>
          <input
            type="number"
            value={doorData.sillHeight}
            onChange={(e) => handleSillHeightChange(parseFloat(e.target.value) || 0)}
            step={0.05}
            min={0}
            max={2}
            className="w-full mt-1 px-2 py-1.5 text-sm border rounded bg-background"
          />
          <span className="text-xs text-muted-foreground mt-0.5 block">
            Abstand vom Boden zur Unterkante (0 für normale Türen)
          </span>
        </div>
      </div>

      {/* Distance from edges */}
      <div className="pt-2 border-t">
        <label className="text-xs text-muted-foreground block mb-2">Abstände zu Wandecken</label>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground">Links (m)</label>
            <input
              type="number"
              value={Number(doorData.distanceFromLeft.toFixed(3))}
              onChange={(e) => handleLeftDistanceChange(parseFloat(e.target.value) || 0)}
              step={0.01}
              min={0}
              max={wallInfo.wallLength - doorData.width}
              className="w-full mt-1 px-2 py-1.5 text-sm border rounded bg-background"
            />
            <span className="text-xs text-muted-foreground mt-0.5 block">
              {formatDistance(doorData.distanceFromLeft)}
            </span>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Rechts (m)</label>
            <input
              type="number"
              value={Number(doorData.distanceFromRight.toFixed(3))}
              onChange={(e) => handleRightDistanceChange(parseFloat(e.target.value) || 0)}
              step={0.01}
              min={0}
              max={wallInfo.wallLength - doorData.width}
              className="w-full mt-1 px-2 py-1.5 text-sm border rounded bg-background"
            />
            <span className="text-xs text-muted-foreground mt-0.5 block">
              {formatDistance(doorData.distanceFromRight)}
            </span>
          </div>
        </div>
      </div>

      {/* Wall Info */}
      <div className="pt-2 border-t text-xs text-muted-foreground">
        <div className="flex justify-between">
          <span>Wandlänge:</span>
          <span className="font-mono">{formatDistance(wallInfo.wallLength)}</span>
        </div>
        <div className="flex justify-between mt-1">
          <span>Position:</span>
          <span className="font-mono">{(doorData.positionOnWall * 100).toFixed(1)}%</span>
        </div>
      </div>

      {/* Swing Direction (for single doors) */}
      {doorData.doorType === 'single' && (
        <div className="pt-2 border-t">
          <label className="text-xs text-muted-foreground block mb-1.5">Anschlag</label>
          <div className="grid grid-cols-2 gap-1">
            <button
              onClick={() =>
                updateElement(element.id, {
                  doorData: { ...doorData, swingDirection: 'left' },
                })
              }
              className={`px-2 py-1.5 text-xs rounded border transition-colors ${
                doorData.swingDirection === 'left'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted border-border hover:bg-accent'
              }`}
            >
              Links
            </button>
            <button
              onClick={() =>
                updateElement(element.id, {
                  doorData: { ...doorData, swingDirection: 'right' },
                })
              }
              className={`px-2 py-1.5 text-xs rounded border transition-colors ${
                doorData.swingDirection === 'right'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted border-border hover:bg-accent'
              }`}
            >
              Rechts
            </button>
          </div>
        </div>
      )}

      {/* Swing Side - Inward/Outward (for non-sliding doors) */}
      {doorData.doorType !== 'sliding' && (
        <div className="pt-2 border-t">
          <label className="text-xs text-muted-foreground block mb-1.5">Aufgehrichtung</label>
          <div className="grid grid-cols-2 gap-1">
            <button
              onClick={() =>
                updateElement(element.id, {
                  doorData: { ...doorData, swingSide: 'inward' },
                })
              }
              className={`px-2 py-1.5 text-xs rounded border transition-colors ${
                doorData.swingSide === 'inward'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted border-border hover:bg-accent'
              }`}
            >
              Innen
            </button>
            <button
              onClick={() =>
                updateElement(element.id, {
                  doorData: { ...doorData, swingSide: 'outward' },
                })
              }
              className={`px-2 py-1.5 text-xs rounded border transition-colors ${
                doorData.swingSide === 'outward'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted border-border hover:bg-accent'
              }`}
            >
              Außen
            </button>
          </div>
          <span className="text-xs text-muted-foreground mt-1 block">
            Innen: Tür öffnet in den Raum. Außen: Tür öffnet nach draußen.
          </span>
        </div>
      )}
    </div>
  );
}
