/**
 * Fire Safety Panel
 *
 * PRO Mode module for fire safety properties (spaces, walls, doors)
 */

import React from 'react';
import { Label } from '@/components/ui/Label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { useSelectionStore, useElementStore } from '@/store';
import type { FireSafetyData } from '@/types/bim';

const FIRE_RATINGS = ['REI30', 'REI60', 'REI90', 'REI120', 'REI180', 'REI240'] as const;
type FireRating = (typeof FIRE_RATINGS)[number];

type RiskFactor = 'Low' | 'Medium' | 'High';

export const FireSafetyPanel: React.FC = () => {
  const { getSelectedIds } = useSelectionStore();
  const { getElement, updateElement } = useElementStore();

  const selectedIds = getSelectedIds();
  const selectedId = selectedIds.length === 1 ? selectedIds[0] : null;
  const element = selectedId ? getElement(selectedId) : null;

  if (!element) return null;

  const isSpace = element.type === 'space';
  const isWall = element.type === 'wall';
  const isDoor = element.type === 'door';

  if (!isSpace && !isWall && !isDoor) return null;

  const fireSafetyData: Partial<FireSafetyData> = element.spaceData?.fireSafetyData || {};
  const wallFireRating = element.wallData?.fireRating;
  const wallCombustible = element.wallData?.combustible;
  const doorFireRating = element.doorData?.fireRating;
  const doorIsFireExit = element.doorData?.isFireExit;

  const updateSpaceFireData = (updates: Partial<FireSafetyData>) => {
    if (isSpace && element.spaceData && selectedId) {
      updateElement(selectedId, {
        spaceData: {
          ...element.spaceData,
          fireSafetyData: { ...fireSafetyData, ...updates },
        },
      });
    }
  };

  const updateWallFire = (fireRating?: FireRating, combustible?: boolean) => {
    if (isWall && element.wallData && selectedId) {
      updateElement(selectedId, {
        wallData: {
          ...element.wallData,
          fireRating: fireRating !== undefined ? fireRating : element.wallData.fireRating,
          combustible: combustible !== undefined ? combustible : element.wallData.combustible,
        },
      });
    }
  };

  const updateDoorFire = (fireRating?: FireRating, isFireExit?: boolean) => {
    if (isDoor && element.doorData && selectedId) {
      updateElement(selectedId, {
        doorData: {
          ...element.doorData,
          fireRating: fireRating !== undefined ? fireRating : element.doorData.fireRating,
          isFireExit: isFireExit !== undefined ? isFireExit : element.doorData.isFireExit,
        },
      });
    }
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
      <h3 className="font-semibold flex items-center gap-2">
        <span className="text-orange-500">🔥</span>
        Brandschutz
      </h3>

      {/* Space-specific properties */}
      {isSpace && (
        <>
          <div className="space-y-2">
            <Label htmlFor="fire-risk">Brandrisiko</Label>
            <Select
              value={fireSafetyData.fireRiskFactor || 'Low'}
              onValueChange={(value) =>
                updateSpaceFireData({ fireRiskFactor: value as RiskFactor })
              }
            >
              <SelectTrigger id="fire-risk">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Low">Niedrig</SelectItem>
                <SelectItem value="Medium">Mittel</SelectItem>
                <SelectItem value="High">Hoch</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="flammable-storage">Brennbare Lagerung</Label>
            <Switch
              id="flammable-storage"
              checked={fireSafetyData.flammableStorage || false}
              onCheckedChange={(checked) => updateSpaceFireData({ flammableStorage: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="fire-exit">Fluchtweg</Label>
            <Switch
              id="fire-exit"
              checked={fireSafetyData.isFireExit || false}
              onCheckedChange={(checked) => updateSpaceFireData({ isFireExit: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="sprinklers">Sprinkleranlage</Label>
            <Switch
              id="sprinklers"
              checked={fireSafetyData.hasSprinklers || false}
              onCheckedChange={(checked) => updateSpaceFireData({ hasSprinklers: checked })}
            />
          </div>

          {fireSafetyData.hasSprinklers && (
            <div className="flex items-center justify-between ml-4">
              <Label htmlFor="auto-sprinklers">Automatisch</Label>
              <Switch
                id="auto-sprinklers"
                checked={fireSafetyData.autoSprinklers || false}
                onCheckedChange={(checked) => updateSpaceFireData({ autoSprinklers: checked })}
              />
            </div>
          )}

          <div className="flex items-center justify-between">
            <Label htmlFor="air-pressurized">Überdruckbelüftung</Label>
            <Switch
              id="air-pressurized"
              checked={fireSafetyData.airPressurized || false}
              onCheckedChange={(checked) => updateSpaceFireData({ airPressurized: checked })}
            />
          </div>
        </>
      )}

      {/* Wall-specific properties */}
      {isWall && (
        <>
          <div className="space-y-2">
            <Label htmlFor="wall-fire-rating">Feuerwiderstandsklasse (REI)</Label>
            <Select
              value={wallFireRating || ''}
              onValueChange={(value) =>
                updateWallFire(value as FireRating, undefined)
              }
            >
              <SelectTrigger id="wall-fire-rating">
                <SelectValue placeholder="Nicht festgelegt" />
              </SelectTrigger>
              <SelectContent>
                {FIRE_RATINGS.map((rating) => (
                  <SelectItem key={rating} value={rating}>
                    {rating}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="wall-combustible">Brennbar</Label>
            <Switch
              id="wall-combustible"
              checked={wallCombustible || false}
              onCheckedChange={(checked) => updateWallFire(undefined, checked)}
            />
          </div>
        </>
      )}

      {/* Door-specific properties */}
      {isDoor && (
        <>
          <div className="space-y-2">
            <Label htmlFor="door-fire-rating">Feuerwiderstandsklasse (REI)</Label>
            <Select
              value={doorFireRating || ''}
              onValueChange={(value) =>
                updateDoorFire(value as FireRating, undefined)
              }
            >
              <SelectTrigger id="door-fire-rating">
                <SelectValue placeholder="Nicht festgelegt" />
              </SelectTrigger>
              <SelectContent>
                {FIRE_RATINGS.map((rating) => (
                  <SelectItem key={rating} value={rating}>
                    {rating}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="door-fire-exit">Notausgang</Label>
            <Switch
              id="door-fire-exit"
              checked={doorIsFireExit || false}
              onCheckedChange={(checked) => updateDoorFire(undefined, checked)}
            />
          </div>
        </>
      )}
    </div>
  );
};
