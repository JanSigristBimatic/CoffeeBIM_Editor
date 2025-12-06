import { useCallback, useMemo } from 'react';
import type { BimElement } from '@/types/bim';
import { useElementStore } from '@/store';
import {
  calculateWindowDistances,
  calculatePositionFromLeftDistance,
  calculatePositionFromRightDistance,
} from '@/bim/elements/Window';
import { formatDistance } from '@/components/three';

interface WindowPropertiesProps {
  element: BimElement;
}

/**
 * Window-specific properties editor
 * Allows editing dimensions and distances to wall edges after placement
 */
export function WindowProperties({ element }: WindowPropertiesProps) {
  const { getElement, updateElement } = useElementStore();

  const windowData = element.windowData;

  // Get host wall and calculate wall length
  const wallInfo = useMemo(() => {
    if (!windowData) return null;
    const hostWall = getElement(windowData.hostWallId);
    if (!hostWall?.wallData) return null;

    const { startPoint, endPoint } = hostWall.wallData;
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const wallLength = Math.sqrt(dx * dx + dy * dy);

    return { hostWall, wallLength };
  }, [windowData, getElement]);

  // Update window position based on new left distance
  const handleLeftDistanceChange = useCallback(
    (newDistanceFromLeft: number) => {
      if (!windowData || !wallInfo) return;

      const { wallLength } = wallInfo;
      const minDistance = 0;
      const maxDistance = wallLength - windowData.width;

      // Clamp value
      const clampedDistance = Math.max(minDistance, Math.min(maxDistance, newDistanceFromLeft));

      // Calculate new position
      const newPosition = calculatePositionFromLeftDistance(clampedDistance, windowData.width, wallLength);

      // Calculate new distances
      const { distanceFromLeft, distanceFromRight } = calculateWindowDistances(
        newPosition,
        windowData.width,
        wallLength
      );

      // Update element
      updateElement(element.id, {
        windowData: {
          ...windowData,
          positionOnWall: newPosition,
          distanceFromLeft,
          distanceFromRight,
        },
      });
    },
    [windowData, wallInfo, element.id, updateElement]
  );

  // Update window position based on new right distance
  const handleRightDistanceChange = useCallback(
    (newDistanceFromRight: number) => {
      if (!windowData || !wallInfo) return;

      const { wallLength } = wallInfo;
      const minDistance = 0;
      const maxDistance = wallLength - windowData.width;

      // Clamp value
      const clampedDistance = Math.max(minDistance, Math.min(maxDistance, newDistanceFromRight));

      // Calculate new position
      const newPosition = calculatePositionFromRightDistance(clampedDistance, windowData.width, wallLength);

      // Calculate new distances
      const { distanceFromLeft, distanceFromRight } = calculateWindowDistances(
        newPosition,
        windowData.width,
        wallLength
      );

      // Update element
      updateElement(element.id, {
        windowData: {
          ...windowData,
          positionOnWall: newPosition,
          distanceFromLeft,
          distanceFromRight,
        },
      });
    },
    [windowData, wallInfo, element.id, updateElement]
  );

  // Update window width
  const handleWidthChange = useCallback(
    (newWidth: number) => {
      if (!windowData || !wallInfo) return;

      const { wallLength } = wallInfo;

      // Clamp width to valid range
      const minWidth = 0.3;
      const maxWidth = Math.min(4, wallLength - 0.1); // Leave some margin
      const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));

      // Recalculate distances with new width, keeping center position
      const { distanceFromLeft, distanceFromRight } = calculateWindowDistances(
        windowData.positionOnWall,
        clampedWidth,
        wallLength
      );

      // Check if window still fits
      if (distanceFromLeft < 0 || distanceFromRight < 0) {
        // Center the window if it doesn't fit at current position
        const newPosition = 0.5;
        const newDistances = calculateWindowDistances(newPosition, clampedWidth, wallLength);

        updateElement(element.id, {
          windowData: {
            ...windowData,
            width: clampedWidth,
            positionOnWall: newPosition,
            distanceFromLeft: newDistances.distanceFromLeft,
            distanceFromRight: newDistances.distanceFromRight,
          },
        });
      } else {
        updateElement(element.id, {
          windowData: {
            ...windowData,
            width: clampedWidth,
            distanceFromLeft,
            distanceFromRight,
          },
        });
      }
    },
    [windowData, wallInfo, element.id, updateElement]
  );

  // Update window height
  const handleHeightChange = useCallback(
    (newHeight: number) => {
      if (!windowData) return;

      const clampedHeight = Math.max(0.3, Math.min(3, newHeight));

      updateElement(element.id, {
        windowData: {
          ...windowData,
          height: clampedHeight,
        },
      });
    },
    [windowData, element.id, updateElement]
  );

  // Update sill height (Brüstungshöhe)
  const handleSillHeightChange = useCallback(
    (newSillHeight: number) => {
      if (!windowData) return;

      // Clamp sill height (0 to 2m)
      const clampedSillHeight = Math.max(0, Math.min(2, newSillHeight));

      updateElement(element.id, {
        windowData: {
          ...windowData,
          sillHeight: clampedSillHeight,
        },
      });
    },
    [windowData, element.id, updateElement]
  );

  if (!windowData || !wallInfo) {
    return (
      <div className="text-sm text-muted-foreground">
        Fenster-Daten nicht verfügbar
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Fenster-Parameter</h3>

      {/* Dimensions */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-muted-foreground">Breite (m)</label>
          <input
            type="number"
            value={windowData.width}
            onChange={(e) => handleWidthChange(parseFloat(e.target.value) || windowData.width)}
            step={0.05}
            min={0.3}
            max={4}
            className="w-full mt-1 px-2 py-1.5 text-sm border rounded bg-background"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Höhe (m)</label>
          <input
            type="number"
            value={windowData.height}
            onChange={(e) => handleHeightChange(parseFloat(e.target.value) || windowData.height)}
            step={0.05}
            min={0.3}
            max={3}
            className="w-full mt-1 px-2 py-1.5 text-sm border rounded bg-background"
          />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-muted-foreground">Brüstungshöhe (m)</label>
          <input
            type="number"
            value={windowData.sillHeight}
            onChange={(e) => handleSillHeightChange(parseFloat(e.target.value) || 0)}
            step={0.05}
            min={0}
            max={2}
            className="w-full mt-1 px-2 py-1.5 text-sm border rounded bg-background"
          />
          <span className="text-xs text-muted-foreground mt-0.5 block">
            Abstand vom Boden zur Unterkante
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
              value={Number(windowData.distanceFromLeft.toFixed(3))}
              onChange={(e) => handleLeftDistanceChange(parseFloat(e.target.value) || 0)}
              step={0.01}
              min={0}
              max={wallInfo.wallLength - windowData.width}
              className="w-full mt-1 px-2 py-1.5 text-sm border rounded bg-background"
            />
            <span className="text-xs text-muted-foreground mt-0.5 block">
              {formatDistance(windowData.distanceFromLeft)}
            </span>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Rechts (m)</label>
            <input
              type="number"
              value={Number(windowData.distanceFromRight.toFixed(3))}
              onChange={(e) => handleRightDistanceChange(parseFloat(e.target.value) || 0)}
              step={0.01}
              min={0}
              max={wallInfo.wallLength - windowData.width}
              className="w-full mt-1 px-2 py-1.5 text-sm border rounded bg-background"
            />
            <span className="text-xs text-muted-foreground mt-0.5 block">
              {formatDistance(windowData.distanceFromRight)}
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
          <span className="font-mono">{(windowData.positionOnWall * 100).toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}
