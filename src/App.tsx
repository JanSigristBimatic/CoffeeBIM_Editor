import { useEffect } from 'react';
import { Canvas3D, Toolbar, SlabCompleteDialog, DistanceInputOverlay } from '@/components/editor';
import { PropertyPanel, HierarchyPanel, DoorParameterPanel, WindowParameterPanel, ColumnParameterPanel, CounterParameterPanel } from '@/components/panels';
import { useKeyboardShortcuts, useStorageSync } from '@/hooks';
import { useViewStore, useToolStore, useProjectStore } from '@/store';
import { requestPersistentStorage } from '@/lib/storage';

function App() {
  // Global keyboard shortcuts
  useKeyboardShortcuts();

  // Sync storage after hydration (migrate orphaned elements to current storey)
  useStorageSync();

  // Request persistent storage on app start (prevents browser from auto-deleting data)
  useEffect(() => {
    requestPersistentStorage();
  }, []);

  const { viewMode } = useViewStore();
  const { activeTool, wallPlacement, slabPlacement, counterPlacement, distanceInput } = useToolStore();
  const { storeys, activeStoreyId } = useProjectStore();

  // Get active storey name
  const activeStorey = storeys.find((s) => s.id === activeStoreyId);

  // Status bar text based on active tool
  const getToolStatus = () => {
    if (activeTool === 'wall') {
      if (wallPlacement.startPoint) {
        if (distanceInput.active) {
          return `Distanz: ${distanceInput.value}m – Enter zum Bestätigen`;
        }
        return 'Klicken oder Distanz eingeben (z.B. 3.5 + Enter)';
      }
      return 'Klicken Sie, um den Startpunkt zu setzen';
    }
    if (activeTool === 'slab') {
      if (slabPlacement.points.length === 0) {
        return 'Klicken Sie, um den ersten Punkt zu setzen';
      }
      if (distanceInput.active) {
        return `Distanz: ${distanceInput.value}m – Enter zum Bestätigen`;
      }
      return `${slabPlacement.points.length} Punkte – Distanz eingeben oder klicken`;
    }
    if (activeTool === 'door') {
      return 'Auf Wand klicken, um Tür zu platzieren';
    }
    if (activeTool === 'window') {
      return 'Auf Wand klicken, um Fenster zu platzieren';
    }
    if (activeTool === 'column') {
      return 'Klicken, um Säule zu platzieren';
    }
    if (activeTool === 'counter') {
      if (counterPlacement.points.length === 0) {
        return 'Klicken, um Frontlinie zu zeichnen';
      }
      if (distanceInput.active) {
        return `Distanz: ${distanceInput.value}m – Enter zum Bestätigen`;
      }
      return `${counterPlacement.points.length} Punkte – Distanz eingeben oder Rechtsklick`;
    }
    return 'Bereit';
  };
  const toolStatus = getToolStatus();

  return (
    <div className="h-screen w-screen flex flex-col bg-background">
      {/* Header */}
      <header className="h-12 border-b flex items-center px-4 shrink-0">
        <h1 className="text-lg font-bold">CoffeeBIM Editor</h1>
        <span className="ml-2 text-xs text-muted-foreground">v0.1.0</span>
      </header>

      {/* Toolbar */}
      <Toolbar />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Hierarchy */}
        <aside className="w-64 border-r bg-card overflow-y-auto shrink-0">
          <HierarchyPanel />
        </aside>

        {/* 3D Canvas */}
        <main className="flex-1 relative">
          <Canvas3D />

          {/* View Mode Indicator */}
          <div className="absolute top-4 left-4 bg-background/80 backdrop-blur px-3 py-1 rounded-full text-sm">
            {viewMode === '3d' ? '3D Ansicht' : '2D Grundriss'}
          </div>

          {/* Door Parameter Panel (floating, shows when door tool active) */}
          <DoorParameterPanel />

          {/* Window Parameter Panel (floating, shows when window tool active) */}
          <WindowParameterPanel />

          {/* Column Parameter Panel (floating, shows when column tool active) */}
          <ColumnParameterPanel />

          {/* Counter Parameter Panel (floating, shows when counter tool active) */}
          {activeTool === 'counter' && (
            <div className="absolute top-4 right-4 w-64 bg-card border rounded-lg shadow-lg">
              <CounterParameterPanel />
            </div>
          )}
        </main>

        {/* Right Panel - Properties */}
        <aside className="w-72 border-l bg-card overflow-y-auto shrink-0">
          <PropertyPanel />
        </aside>
      </div>

      {/* Status Bar */}
      <footer className="h-6 border-t flex items-center px-4 text-xs text-muted-foreground shrink-0">
        <span className="font-medium text-foreground">
          📍 {activeStorey?.name ?? 'Kein Stockwerk'}
        </span>
        <span className="mx-2">|</span>
        <span>{toolStatus}</span>
        <span className="mx-2">|</span>
        <span>Raster: 10cm</span>
        <span className="mx-2">|</span>
        <span className="capitalize">{activeTool}</span>
        <span className="ml-auto">
          A = Auswahl, W = Wand, T = Tür, F = Fenster, S = Säule, B = Boden, K = Theke, G = Raster, Esc = Abbrechen
        </span>
      </footer>

      {/* Dialogs */}
      <SlabCompleteDialog />

      {/* Distance Input Overlay */}
      <DistanceInputOverlay />
    </div>
  );
}

export default App;
