import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { ProjectInfo, SiteInfo, BuildingInfo, StoreyInfo } from '@/types/bim';
import { DEFAULT_STOREY_HEIGHT } from '@/types/bim';

interface ProjectState {
  project: ProjectInfo;
  site: SiteInfo;
  building: BuildingInfo;
  storeys: StoreyInfo[];
  activeStoreyId: string | null;
}

interface ProjectActions {
  // Project actions
  setProjectName: (name: string) => void;
  setProjectDescription: (description: string) => void;

  // Site actions
  setSiteName: (name: string) => void;
  setSiteAddress: (address: string) => void;

  // Building actions
  setBuildingName: (name: string) => void;

  // Storey actions
  addStorey: (name: string, elevation: number, height?: number) => string;
  updateStorey: (id: string, updates: Partial<Omit<StoreyInfo, 'id' | 'buildingId'>>) => void;
  removeStorey: (id: string) => void;
  setActiveStorey: (id: string | null) => void;

  // Utility
  resetProject: () => void;
}

function createDefaultProject(): ProjectState {
  const projectId = uuidv4();
  const siteId = uuidv4();
  const buildingId = uuidv4();
  const storeyId = uuidv4();

  return {
    project: {
      id: projectId,
      name: 'Neues Kaffeebar-Projekt',
      description: '',
    },
    site: {
      id: siteId,
      name: 'Standort',
      address: '',
    },
    building: {
      id: buildingId,
      name: 'Gebäude',
      siteId: siteId,
    },
    storeys: [
      {
        id: storeyId,
        name: 'Erdgeschoss',
        buildingId: buildingId,
        elevation: 0,
        height: DEFAULT_STOREY_HEIGHT,
      },
    ],
    activeStoreyId: storeyId,
  };
}

export const useProjectStore = create<ProjectState & ProjectActions>((set, get) => ({
  ...createDefaultProject(),

  // Project actions
  setProjectName: (name) =>
    set((state) => ({
      project: { ...state.project, name },
    })),

  setProjectDescription: (description) =>
    set((state) => ({
      project: { ...state.project, description },
    })),

  // Site actions
  setSiteName: (name) =>
    set((state) => ({
      site: { ...state.site, name },
    })),

  setSiteAddress: (address) =>
    set((state) => ({
      site: { ...state.site, address },
    })),

  // Building actions
  setBuildingName: (name) =>
    set((state) => ({
      building: { ...state.building, name },
    })),

  // Storey actions
  addStorey: (name, elevation, height = DEFAULT_STOREY_HEIGHT) => {
    const id = uuidv4();
    const { building } = get();

    set((state) => ({
      storeys: [
        ...state.storeys,
        {
          id,
          name,
          buildingId: building.id,
          elevation,
          height,
        },
      ],
    }));

    return id;
  },

  updateStorey: (id, updates) =>
    set((state) => ({
      storeys: state.storeys.map((storey) =>
        storey.id === id ? { ...storey, ...updates } : storey
      ),
    })),

  removeStorey: (id) =>
    set((state) => {
      const filteredStoreys = state.storeys.filter((s) => s.id !== id);

      // If we removed the active storey, select another one
      let newActiveStoreyId = state.activeStoreyId;
      if (state.activeStoreyId === id) {
        newActiveStoreyId = filteredStoreys[0]?.id ?? null;
      }

      return {
        storeys: filteredStoreys,
        activeStoreyId: newActiveStoreyId,
      };
    }),

  setActiveStorey: (id) => set({ activeStoreyId: id }),

  // Utility
  resetProject: () => set(createDefaultProject()),
}));
