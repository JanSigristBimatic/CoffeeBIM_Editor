/**
 * PRO Mode Store
 *
 * Manages PRO mode activation and module state (Fire Safety, Cleaning/FM)
 */

import { create } from 'zustand';
import type { ProModule, ModuleId } from '@/types/proMode';

interface ProModeState {
  isProMode: boolean;
  modules: ProModule[];
  activeModule: ModuleId | null;
}

interface ProModeActions {
  enableProMode: () => void;
  disableProMode: () => void;
  toggleModule: (moduleId: ModuleId) => void;
  setActiveModule: (moduleId: ModuleId | null) => void;
  isModuleEnabled: (moduleId: ModuleId) => boolean;
}

const initialModules: ProModule[] = [
  {
    id: 'fire-safety',
    name: 'Brandschutz',
    description: 'Brandschutzanforderungen, Fluchtwegsimulation, Feuerwiderstand',
    enabled: false,
    icon: 'Flame',
  },
  {
    id: 'cleaning',
    name: 'Reinigung & FM',
    description: 'Reinigungszonen, Flächenklassifizierung, Wartungsplanung',
    enabled: false,
    icon: 'Brush',
  },
];

export const useProModeStore = create<ProModeState & ProModeActions>((set, get) => ({
  // State
  isProMode: false,
  modules: initialModules,
  activeModule: null,

  // Actions
  enableProMode: () => {
    set({ isProMode: true });
    console.log('PRO Mode enabled');
  },

  disableProMode: () => {
    set({
      isProMode: false,
      activeModule: null,
      modules: initialModules.map((m) => ({ ...m, enabled: false })),
    });
    console.log('PRO Mode disabled');
  },

  toggleModule: (moduleId) => {
    set((state) => {
      const updatedModules = state.modules.map((m) =>
        m.id === moduleId ? { ...m, enabled: !m.enabled } : m
      );

      const module = updatedModules.find((m) => m.id === moduleId);
      console.log(`Module ${moduleId}: ${module?.enabled ? 'enabled' : 'disabled'}`);

      return { modules: updatedModules };
    });
  },

  setActiveModule: (moduleId) => {
    set({ activeModule: moduleId });
    if (moduleId) {
      console.log(`Active module: ${moduleId}`);
    }
  },

  isModuleEnabled: (moduleId) => {
    const module = get().modules.find((m) => m.id === moduleId);
    return module?.enabled ?? false;
  },
}));
