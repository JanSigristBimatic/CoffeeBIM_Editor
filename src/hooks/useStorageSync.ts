/**
 * Hook zur Synchronisierung von Stores nach der Hydration
 *
 * Problem: Wenn das Projekt nicht gespeichert wurde aber Elemente schon,
 * haben die Elemente eine parentId die auf ein altes (nicht mehr existierendes)
 * Geschoss zeigt. Dieser Hook migriert die Elemente zum aktuellen Geschoss.
 */

import { useEffect, useRef } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { useElementStore } from '@/store/useElementStore';

export function useStorageSync() {
  const hasRun = useRef(false);
  const activeStoreyId = useProjectStore((state) => state.activeStoreyId);
  const storeys = useProjectStore((state) => state.storeys);
  const elements = useElementStore((state) => state.elements);
  const updateElement = useElementStore((state) => state.updateElement);

  useEffect(() => {
    // Nur einmal ausführen
    if (hasRun.current) return;
    if (!activeStoreyId) return;
    if (elements.size === 0) return;

    // Prüfen ob es Elemente mit ungültiger parentId gibt
    const validStoreyIds = new Set(storeys.map((s) => s.id));
    const elementsToMigrate: string[] = [];

    for (const [id, element] of elements) {
      if (element.parentId && !validStoreyIds.has(element.parentId)) {
        elementsToMigrate.push(id);
      }
    }

    if (elementsToMigrate.length > 0) {
      console.log(
        `[CoffeeBIM] Migriere ${elementsToMigrate.length} Elemente zum aktuellen Geschoss`
      );

      // Migriere alle Elemente zum aktiven Geschoss
      elementsToMigrate.forEach((id) => {
        updateElement(id, { parentId: activeStoreyId });
      });

      hasRun.current = true;
    }
  }, [activeStoreyId, storeys, elements, updateElement]);
}
