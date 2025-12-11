/**
 * Settings Store - Verwaltet API-Keys und Benutzereinstellungen
 *
 * Der Gemini API-Key wird nur lokal im Browser gespeichert (IndexedDB).
 * Es findet keine Server-Kommunikation statt.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createIndexedDBStorage } from '@/lib/storage/indexedDBStorage';

export type VisualizationStyle =
  | 'modern'
  | 'industrial'
  | 'cozy'
  | 'minimal'
  | 'luxury';

export type ImageResolution = '1024' | '2048' | '4096';

export type OcctLoadState = 'idle' | 'loading' | 'ready' | 'error';

interface SettingsState {
  // API Key (stored locally only)
  geminiApiKey: string | null;
  isKeyValidated: boolean;

  // Visualization preferences
  visualizationStyle: VisualizationStyle;
  imageResolution: ImageResolution;

  // OpenCascade.js settings
  useOpenCascade: boolean;
  occtLoadState: OcctLoadState;
  occtError: string | null;

  // Actions
  setGeminiApiKey: (key: string | null) => void;
  setKeyValidated: (valid: boolean) => void;
  setVisualizationStyle: (style: VisualizationStyle) => void;
  setImageResolution: (res: ImageResolution) => void;
  setUseOpenCascade: (enabled: boolean) => void;
  setOcctLoadState: (state: OcctLoadState, error?: string) => void;
  clearSettings: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // Initial state
      geminiApiKey: null,
      isKeyValidated: false,
      visualizationStyle: 'modern',
      imageResolution: '2048',

      // OpenCascade.js state (disabled by default for safety)
      useOpenCascade: false,
      occtLoadState: 'idle',
      occtError: null,

      // Actions
      setGeminiApiKey: (key) => set({
        geminiApiKey: key,
        isKeyValidated: false
      }),

      setKeyValidated: (valid) => set({ isKeyValidated: valid }),

      setVisualizationStyle: (style) => set({ visualizationStyle: style }),

      setImageResolution: (res) => set({ imageResolution: res }),

      setUseOpenCascade: (enabled) => set({
        useOpenCascade: enabled,
        // Reset load state when toggling
        occtLoadState: enabled ? 'idle' : 'idle',
        occtError: null,
      }),

      setOcctLoadState: (state, error) => set({
        occtLoadState: state,
        occtError: error ?? null,
      }),

      clearSettings: () => set({
        geminiApiKey: null,
        isKeyValidated: false,
        useOpenCascade: false,
        occtLoadState: 'idle',
        occtError: null,
      }),
    }),
    {
      name: 'coffeebim-settings',
      storage: createIndexedDBStorage(),
      // Only persist these fields (not actions)
      partialize: (state) => ({
        geminiApiKey: state.geminiApiKey,
        isKeyValidated: state.isKeyValidated,
        visualizationStyle: state.visualizationStyle,
        imageResolution: state.imageResolution,
        useOpenCascade: state.useOpenCascade,
        // Don't persist occtLoadState/occtError - always start fresh
      }) as SettingsState,
    }
  )
);
