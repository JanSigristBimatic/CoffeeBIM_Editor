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

interface SettingsState {
  // API Key (stored locally only)
  geminiApiKey: string | null;
  isKeyValidated: boolean;

  // Visualization preferences
  visualizationStyle: VisualizationStyle;
  imageResolution: ImageResolution;

  // Actions
  setGeminiApiKey: (key: string | null) => void;
  setKeyValidated: (valid: boolean) => void;
  setVisualizationStyle: (style: VisualizationStyle) => void;
  setImageResolution: (res: ImageResolution) => void;
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

      // Actions
      setGeminiApiKey: (key) => set({
        geminiApiKey: key,
        isKeyValidated: false
      }),

      setKeyValidated: (valid) => set({ isKeyValidated: valid }),

      setVisualizationStyle: (style) => set({ visualizationStyle: style }),

      setImageResolution: (res) => set({ imageResolution: res }),

      clearSettings: () => set({
        geminiApiKey: null,
        isKeyValidated: false
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
      }) as SettingsState,
    }
  )
);
