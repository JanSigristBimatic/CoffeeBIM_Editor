import { Canvas3D, Toolbar, SlabCompleteDialog } from '@/components/editor';
import { PropertyPanel, HierarchyPanel, DoorParameterPanel, WindowParameterPanel } from '@/components/panels';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useViewStore, useToolStore, useProjectStore } from '@/store';

function App() {
  // Global keyboard shortcuts
  useKeyboardShortcuts();

  const { viewMode } = useViewStore();
  const { activeTool, wallPlacement, slabPlacement } = useToolStore();
  const { storeys, activeStoreyId } = useProjectStore();

  // Get active storey name
  const activeStorey = storeys.find((s) => s.id === activeStoreyId);

  // Status bar text based on active tool
  const getToolStatus = () => {
    if (activeTool === 'wall') {
      return wallPlacement.startPoint
        ? 'Klicken Sie, um den Endpunkt zu setzen'
        : 'Klicken Sie, um den Startpunkt zu setzen';
    }
    if (activeTool === 'slab') {
      if (slabPlacement.points.length === 0) {
        return 'Klicken Sie, um den ersten Punkt zu setzen';
      }
      return `${slabPlacement.points.length} Punkte – Doppelklick oder nahe Start klicken zum Schliessen`;
    }
    if (activeTool === 'door') {
      return 'Auf Wand klicken, um Tür zu platzieren';
    }
    if (activeTool === 'window') {
      return 'Auf Wand klicken, um Fenster zu platzieren';
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
          A = Auswahl, W = Wand, T = Tür, F = Fenster, S = Säule, B = Boden, G = Raster, Esc = Abbrechen
        </span>
      </footer>

      {/* Dialogs */}
      <SlabCompleteDialog />
    </div>
  );
}

export default App;
