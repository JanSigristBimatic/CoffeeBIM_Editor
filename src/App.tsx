import { useEffect, useState } from 'react';
import { MapPin, X, Layers, Settings2 } from 'lucide-react';
import { SplitView, Toolbar, SlabCompleteDialog, DistanceInputOverlay } from '@/components/editor';
import { PropertyPanel, HierarchyPanel, WallParameterPanel, DoorParameterPanel, WindowParameterPanel, ColumnParameterPanel, CounterParameterPanel, StairParameterPanel } from '@/components/panels';
import { BimaticLink } from '@/components/ui/BimaticLink';
import { BuyMeACoffeeButton } from '@/components/ui/BuyMeACoffeeButton';
import { useKeyboardShortcuts, useStorageSync, useMobile } from '@/hooks';
import { useViewStore, useToolStore, useProjectStore } from '@/store';
import { requestPersistentStorage } from '@/lib/storage';
import { cn } from '@/lib/utils';

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
  const { activeTool, wallPlacement, slabPlacement, counterPlacement, stairPlacement, distanceInput } = useToolStore();
  const { storeys, activeStoreyId } = useProjectStore();

  // Mobile responsive state
  const { isMobile, isTablet } = useMobile();
  const [leftPanelOpen, setLeftPanelOpen] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);

  // Close panels when clicking outside on mobile
  const closePanels = () => {
    if (isMobile || isTablet) {
      setLeftPanelOpen(false);
      setRightPanelOpen(false);
    }
  };

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
    if (activeTool === 'stair') {
      if (!stairPlacement.startPoint) {
        return 'Klicken Sie, um den Startpunkt der Treppe zu setzen';
      }
      return 'Klicken Sie erneut, um die Laufrichtung festzulegen';
    }
    return 'Bereit';
  };
  const toolStatus = getToolStatus();

  return (
    <div className="h-screen w-screen flex flex-col bg-background">
      {/* Header - CoffeeBIM Gold Gradient */}
      <header className="h-12 border-b flex items-center justify-between px-4 shrink-0 bg-gradient-to-r from-primary to-secondary">
        <div className="flex items-center gap-2">
          {/* Mobile: Hamburger menu for left panel */}
          {(isMobile || isTablet) && (
            <button
              onClick={() => setLeftPanelOpen(!leftPanelOpen)}
              className="p-1.5 rounded hover:bg-primary-foreground/10 lg:hidden"
              aria-label="Hierarchie öffnen"
            >
              <Layers size={20} className="text-primary-foreground" />
            </button>
          )}
          <h1 className="text-lg font-bold text-primary-foreground">CoffeeBIM Editor</h1>
          <span className="ml-2 text-xs text-primary-foreground/70 hidden sm:inline">v0.1.0</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Mobile: Properties panel button */}
          {(isMobile || isTablet) && (
            <button
              onClick={() => setRightPanelOpen(!rightPanelOpen)}
              className="p-1.5 rounded hover:bg-primary-foreground/10 lg:hidden"
              aria-label="Eigenschaften öffnen"
            >
              <Settings2 size={20} className="text-primary-foreground" />
            </button>
          )}
          <BuyMeACoffeeButton />
          <BimaticLink />
        </div>
      </header>

      {/* Toolbar */}
      <Toolbar />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile overlay backdrop */}
        {(isMobile || isTablet) && (leftPanelOpen || rightPanelOpen) && (
          <div
            className="absolute inset-0 bg-black/50 z-30 lg:hidden"
            onClick={closePanels}
          />
        )}

        {/* Left Panel - Hierarchy (desktop: always visible, mobile: overlay) */}
        <aside
          className={cn(
            "w-64 border-r bg-card overflow-y-auto shrink-0 transition-transform duration-200",
            // Desktop: always visible
            "hidden lg:block",
            // Mobile/Tablet: slide-in overlay
            (isMobile || isTablet) && "fixed inset-y-0 left-0 z-40 lg:relative lg:translate-x-0",
            (isMobile || isTablet) && (leftPanelOpen ? "translate-x-0 block" : "-translate-x-full")
          )}
        >
          {/* Mobile close button */}
          {(isMobile || isTablet) && (
            <div className="flex items-center justify-between p-2 border-b lg:hidden">
              <span className="font-medium">Hierarchie</span>
              <button onClick={() => setLeftPanelOpen(false)} className="p-1 rounded hover:bg-muted">
                <X size={18} />
              </button>
            </div>
          )}
          <HierarchyPanel />
        </aside>

        {/* Editor Area */}
        <main className="flex-1 flex flex-col relative" onClick={closePanels}>
          {/* View Content */}
          <div className="flex-1 relative">
            <SplitView />

            {/* Wall Parameter Panel (floating, shows when wall tool active) */}
            <WallParameterPanel />

            {/* Door Parameter Panel (floating, shows when door tool active) */}
            <DoorParameterPanel />

            {/* Window Parameter Panel (floating, shows when window tool active) */}
            <WindowParameterPanel />

            {/* Column Parameter Panel (floating, shows when column tool active) */}
            <ColumnParameterPanel />

            {/* Counter Parameter Panel (floating, shows when counter tool active) */}
            {activeTool === 'counter' && (
              <div className="absolute top-4 right-4 w-64 bg-card border rounded-lg shadow-lg z-10">
                <CounterParameterPanel />
              </div>
            )}

            {/* Stair Parameter Panel (floating, shows when stair tool active) */}
            <StairParameterPanel />
          </div>
        </main>

        {/* Right Panel - Properties (desktop: always visible, mobile: overlay) */}
        <aside
          className={cn(
            "w-72 border-l bg-card overflow-y-auto shrink-0 transition-transform duration-200",
            // Desktop: always visible
            "hidden lg:block",
            // Mobile/Tablet: slide-in overlay from right
            (isMobile || isTablet) && "fixed inset-y-0 right-0 z-40 lg:relative lg:translate-x-0",
            (isMobile || isTablet) && (rightPanelOpen ? "translate-x-0 block" : "translate-x-full")
          )}
        >
          {/* Mobile close button */}
          {(isMobile || isTablet) && (
            <div className="flex items-center justify-between p-2 border-b lg:hidden">
              <span className="font-medium">Eigenschaften</span>
              <button onClick={() => setRightPanelOpen(false)} className="p-1 rounded hover:bg-muted">
                <X size={18} />
              </button>
            </div>
          )}
          <PropertyPanel />
        </aside>
      </div>

      {/* Status Bar - simplified on mobile */}
      <footer className="h-6 border-t flex items-center px-4 text-xs text-muted-foreground shrink-0 overflow-hidden">
        <span className="font-medium text-foreground flex items-center gap-1 shrink-0">
          <MapPin size={12} />
          <span className="hidden sm:inline">{activeStorey?.name ?? 'Kein Stockwerk'}</span>
          <span className="sm:hidden">{activeStorey?.name?.slice(0, 10) ?? '-'}</span>
        </span>
        <span className="mx-2 hidden sm:inline">|</span>
        <span className="hidden sm:inline truncate">{toolStatus}</span>
        <span className="mx-2 hidden md:inline">|</span>
        <span className="hidden md:inline">Raster: 10cm</span>
        <span className="mx-2 hidden md:inline">|</span>
        <span className="capitalize hidden md:inline">{activeTool}</span>
        <span className="mx-2 hidden lg:inline">|</span>
        <span className="hidden lg:inline">Ansicht: {viewMode === '2d' ? '2D' : viewMode === '3d' ? '3D' : 'Split'}</span>
        <span className="ml-auto hidden xl:block">
          A = Auswahl, W = Wand, T = Tür, F = Fenster, S = Säule, Shift+S = Treppe, B = Boden, K = Theke, V = Split, Esc = Abbrechen
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
