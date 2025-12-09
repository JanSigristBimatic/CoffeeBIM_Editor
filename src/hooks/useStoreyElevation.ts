import { useProjectStore } from '@/store';

/**
 * Hook to get the elevation of the currently active storey.
 * Used for positioning preview elements, snap indicators, and dimensions
 * at the correct Z-height for the selected storey.
 *
 * @returns The elevation (Z position) of the active storey, or 0 if no storey is active
 */
export function useStoreyElevation(): number {
  const { activeStoreyId, storeys } = useProjectStore();
  const activeStorey = storeys.find(s => s.id === activeStoreyId);
  return activeStorey?.elevation ?? 0;
}
