import { useCallback } from 'react';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogContent,
  DialogFooter,
} from '@/components/ui';
import { Button } from '@/components/ui/Button';
import { useToolStore, useElementStore, useProjectStore } from '@/store';
import { createSlab } from '@/bim/elements/Slab';
import { createWall } from '@/bim/elements/Wall';

/**
 * Dialog shown after completing a slab polygon
 * Asks user if walls should be generated along the outline
 */
export function SlabCompleteDialog() {
  const { slabCompletionDialog, closeSlabCompletionDialog } = useToolStore();
  const { addElement } = useElementStore();
  const { activeStoreyId, storeys } = useProjectStore();

  const { isOpen, pendingPoints } = slabCompletionDialog;

  // Get storey elevation for Z position
  const activeStorey = storeys.find(s => s.id === activeStoreyId);
  const storeyElevation = activeStorey?.elevation ?? 0;

  /**
   * Create slab element from pending points
   */
  const createSlabElement = useCallback(() => {
    if (!activeStoreyId || pendingPoints.length < 3) return null;

    try {
      const slab = createSlab({
        outline: pendingPoints,
        storeyId: activeStoreyId,
        slabType: 'floor',
        elevation: storeyElevation,
      });
      addElement(slab);
      return slab;
    } catch (error) {
      console.error('Could not create slab:', error);
      return null;
    }
  }, [activeStoreyId, pendingPoints, storeyElevation, addElement]);

  /**
   * Create walls along the slab outline edges
   */
  const createWallsFromOutline = useCallback(() => {
    if (!activeStoreyId || pendingPoints.length < 3) return;

    // Create a wall for each edge of the polygon
    for (let i = 0; i < pendingPoints.length; i++) {
      const startPoint = pendingPoints[i];
      const endPoint = pendingPoints[(i + 1) % pendingPoints.length];

      if (!startPoint || !endPoint) continue;

      try {
        const wall = createWall({
          startPoint,
          endPoint,
          storeyId: activeStoreyId,
          elevation: storeyElevation,
        });
        addElement(wall);
      } catch (error) {
        // Wall might be too short, skip it
        console.warn('Could not create wall segment:', error);
      }
    }
  }, [activeStoreyId, pendingPoints, storeyElevation, addElement]);

  /**
   * Handle "Only Slab" button
   */
  const handleSlabOnly = useCallback(() => {
    createSlabElement();
    closeSlabCompletionDialog();
  }, [createSlabElement, closeSlabCompletionDialog]);

  /**
   * Handle "Slab + Walls" button
   */
  const handleSlabWithWalls = useCallback(() => {
    createSlabElement();
    createWallsFromOutline();
    closeSlabCompletionDialog();
  }, [createSlabElement, createWallsFromOutline, closeSlabCompletionDialog]);

  /**
   * Handle cancel
   */
  const handleCancel = useCallback(() => {
    closeSlabCompletionDialog();
  }, [closeSlabCompletionDialog]);

  // Calculate area for display
  const area = pendingPoints.length >= 3 ? calculateArea(pendingPoints) : 0;
  const wallCount = pendingPoints.length;

  return (
    <Dialog open={isOpen} onClose={handleCancel}>
      <DialogHeader>
        <DialogTitle>Grundriss fertigstellen</DialogTitle>
        <DialogDescription>
          Polygon mit {pendingPoints.length} Punkten ({area.toFixed(2)} m²)
        </DialogDescription>
      </DialogHeader>

      <DialogContent>
        <p className="text-sm mb-4">
          Möchten Sie automatisch Wände entlang der Umrandung erstellen?
        </p>
        <div className="bg-muted rounded-md p-3 text-sm">
          <div className="flex justify-between mb-1">
            <span>Bodenplatte:</span>
            <span className="font-medium">1 Element</span>
          </div>
          <div className="flex justify-between">
            <span>Wände (optional):</span>
            <span className="font-medium">{wallCount} Segmente</span>
          </div>
        </div>
      </DialogContent>

      <DialogFooter>
        <Button variant="ghost" onClick={handleCancel}>
          Abbrechen
        </Button>
        <Button variant="secondary" onClick={handleSlabOnly}>
          Nur Boden
        </Button>
        <Button variant="primary" onClick={handleSlabWithWalls}>
          Boden + Wände
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

/**
 * Calculate the area of a polygon using the shoelace formula
 */
function calculateArea(points: { x: number; y: number }[]): number {
  let area = 0;
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const pi = points[i];
    const pj = points[j];
    if (pi && pj) {
      area += pi.x * pj.y;
      area -= pj.x * pi.y;
    }
  }

  return Math.abs(area / 2);
}
