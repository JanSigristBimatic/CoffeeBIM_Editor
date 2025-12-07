import {
  MousePointer2,
  Square,
  DoorOpen,
  AppWindow,
  Grid2X2,
  Columns3,
  Download,
  Upload,
  Undo,
  Redo,
  Trash2,
  LayoutGrid,
  Loader2,
  FileImage,
  Eye,
  EyeOff,
  Magnet,
  CornerDownRight,
  Triangle,
  X,
  Crosshair,
  RectangleHorizontal,
  RulerIcon,
} from 'lucide-react';
import { useState } from 'react';
import { useToolStore, useViewStore, useSelectionStore, useElementStore, useProjectStore, usePdfUnderlayStore } from '@/store';
import type { ToolType } from '@/types/tools';
import { cn } from '@/lib/utils';
import { exportToIfc } from '@/bim/ifc';
import { PdfCalibrationDialog } from '@/components/panels/PdfCalibrationDialog';
import { ImportModelDialog } from '@/components/panels/ImportModelDialog';
import { AssetDropdown } from './AssetDropdown';
import { useHistory } from '@/hooks';

interface ToolButtonProps {
  tool: ToolType;
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
}

function ToolButton({ tool, icon, label, shortcut }: ToolButtonProps) {
  const { activeTool, setActiveTool } = useToolStore();
  const isActive = activeTool === tool;

  return (
    <button
      onClick={() => setActiveTool(tool)}
      className={cn(
        'flex flex-col items-center justify-center p-2 rounded-md transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
        'focus:outline-none focus:ring-2 focus:ring-ring',
        isActive && 'bg-primary text-primary-foreground'
      )}
      title={`${label}${shortcut ? ` (${shortcut})` : ''}`}
    >
      {icon}
      <span className="text-xs mt-1">{label}</span>
    </button>
  );
}

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  shortcut?: string;
}

function ActionButton({ icon, label, onClick, disabled, shortcut }: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex flex-col items-center justify-center p-2 rounded-md transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
        'focus:outline-none focus:ring-2 focus:ring-ring',
        'disabled:opacity-50 disabled:cursor-not-allowed'
      )}
      title={`${label}${shortcut ? ` (${shortcut})` : ''}`}
    >
      {icon}
      <span className="text-xs mt-1">{label}</span>
    </button>
  );
}

export function Toolbar() {
  const {
    toggleGrid,
    showGrid,
    snapSettings,
    toggleSnapEndpoint,
    toggleSnapMidpoint,
    toggleSnapPerpendicular,
    toggleSnapNearest,
    toggleSnapGrid,
    toggleSnapOrthogonal,
    setSnapSettings,
  } = useViewStore();
  const { getSelectedIds, clearSelection } = useSelectionStore();
  const { removeElements, getAllElements } = useElementStore();
  const { project, site, building, storeys } = useProjectStore();
  const { isLoaded: hasPdf, isVisible: pdfVisible, toggleVisible: togglePdfVisible } = usePdfUnderlayStore();
  const { undo, redo, canUndo, canRedo } = useHistory();

  const [isExporting, setIsExporting] = useState(false);
  const [showPdfDialog, setShowPdfDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showSnapMenu, setShowSnapMenu] = useState(false);

  const selectedIds = getSelectedIds();
  const hasSelection = selectedIds.length > 0;

  const handleDelete = () => {
    if (hasSelection) {
      removeElements(selectedIds);
      clearSelection();
    }
  };

  const handleExport = async () => {
    if (isExporting) return;

    setIsExporting(true);
    try {
      const elements = getAllElements();
      await exportToIfc(project, site, building, storeys, elements);
    } catch (error) {
      console.error('IFC Export failed:', error);
      alert('IFC Export fehlgeschlagen. Bitte prüfen Sie die Konsole für Details.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex items-center gap-1 p-2 bg-background border-b">
      {/* Tool Selection */}
      <div className="flex items-center gap-1 border-r pr-2 mr-2">
        <ToolButton
          tool="select"
          icon={<MousePointer2 size={20} />}
          label="Auswahl"
          shortcut="A"
        />
        <ToolButton tool="slab" icon={<LayoutGrid size={20} />} label="Boden" shortcut="B" />
        <ToolButton tool="wall" icon={<Square size={20} />} label="Wand" shortcut="W" />
        <ToolButton tool="door" icon={<DoorOpen size={20} />} label="Tür" shortcut="T" />
        <ToolButton tool="window" icon={<AppWindow size={20} />} label="Fenster" shortcut="F" />
        <ToolButton tool="column" icon={<Columns3 size={20} />} label="Säule" shortcut="S" />
        <ToolButton tool="counter" icon={<RectangleHorizontal size={20} />} label="Theke" shortcut="K" />
        <AssetDropdown />
      </div>

      {/* View Controls */}
      <div className="flex items-center gap-1 border-r pr-2 mr-2">
        <button
          onClick={toggleGrid}
          className={cn(
            'flex flex-col items-center justify-center p-2 rounded-md transition-colors',
            'hover:bg-accent hover:text-accent-foreground',
            showGrid && 'bg-accent'
          )}
          title="Raster ein/aus (G)"
        >
          <Grid2X2 size={20} />
          <span className="text-xs mt-1">Raster</span>
        </button>
        <button
          onClick={toggleSnapOrthogonal}
          className={cn(
            'flex flex-col items-center justify-center p-2 rounded-md transition-colors',
            'hover:bg-accent hover:text-accent-foreground',
            snapSettings.orthogonal && 'bg-primary text-primary-foreground'
          )}
          title="Orthogonal-Modus ein/aus (O)"
        >
          <RulerIcon size={20} />
          <span className="text-xs mt-1">Ortho</span>
        </button>
      </div>

      {/* Snap Controls */}
      <div className="flex items-center gap-1 border-r pr-2 mr-2 relative">
        <button
          onClick={() => setSnapSettings({ enabled: !snapSettings.enabled })}
          className={cn(
            'flex flex-col items-center justify-center p-2 rounded-md transition-colors',
            'hover:bg-accent hover:text-accent-foreground',
            snapSettings.enabled && 'bg-primary text-primary-foreground'
          )}
          title="Fangen ein/aus"
        >
          <Magnet size={20} />
          <span className="text-xs mt-1">Fangen</span>
        </button>
        <button
          onClick={() => setShowSnapMenu(!showSnapMenu)}
          className={cn(
            'flex flex-col items-center justify-center p-2 rounded-md transition-colors',
            'hover:bg-accent hover:text-accent-foreground',
            showSnapMenu && 'bg-accent'
          )}
          title="Fang-Optionen"
        >
          <Crosshair size={20} />
          <span className="text-xs mt-1">Optionen</span>
        </button>

        {/* Snap Options Dropdown */}
        {showSnapMenu && (
          <div className="absolute top-full left-0 mt-1 p-2 bg-popover border rounded-md shadow-lg z-50 min-w-[180px]">
            <div className="text-xs font-medium mb-2 text-muted-foreground">Fang-Optionen</div>

            {/* Endpoint - Square */}
            <button
              onClick={toggleSnapEndpoint}
              className={cn(
                'flex items-center gap-2 w-full p-2 rounded-md transition-colors text-sm',
                'hover:bg-accent hover:text-accent-foreground',
                snapSettings.endpoint && 'bg-accent'
              )}
            >
              <Square size={16} className="text-green-500" />
              <span>Eckpunkte</span>
              {snapSettings.endpoint && <span className="ml-auto text-xs text-green-500">✓</span>}
            </button>

            {/* Midpoint - Triangle */}
            <button
              onClick={toggleSnapMidpoint}
              className={cn(
                'flex items-center gap-2 w-full p-2 rounded-md transition-colors text-sm',
                'hover:bg-accent hover:text-accent-foreground',
                snapSettings.midpoint && 'bg-accent'
              )}
            >
              <Triangle size={16} className="text-orange-500" />
              <span>Mittelpunkt</span>
              {snapSettings.midpoint && <span className="ml-auto text-xs text-green-500">✓</span>}
            </button>

            {/* Perpendicular */}
            <button
              onClick={toggleSnapPerpendicular}
              className={cn(
                'flex items-center gap-2 w-full p-2 rounded-md transition-colors text-sm',
                'hover:bg-accent hover:text-accent-foreground',
                snapSettings.perpendicular && 'bg-accent'
              )}
            >
              <CornerDownRight size={16} className="text-blue-500" />
              <span>Lotrecht</span>
              {snapSettings.perpendicular && <span className="ml-auto text-xs text-green-500">✓</span>}
            </button>

            {/* Nearest - X */}
            <button
              onClick={toggleSnapNearest}
              className={cn(
                'flex items-center gap-2 w-full p-2 rounded-md transition-colors text-sm',
                'hover:bg-accent hover:text-accent-foreground',
                snapSettings.nearest && 'bg-accent'
              )}
            >
              <X size={16} className="text-fuchsia-500" />
              <span>Auf Linie</span>
              {snapSettings.nearest && <span className="ml-auto text-xs text-green-500">✓</span>}
            </button>

            {/* Grid */}
            <button
              onClick={toggleSnapGrid}
              className={cn(
                'flex items-center gap-2 w-full p-2 rounded-md transition-colors text-sm',
                'hover:bg-accent hover:text-accent-foreground',
                snapSettings.grid && 'bg-accent'
              )}
            >
              <Grid2X2 size={16} className="text-gray-500" />
              <span>Raster</span>
              {snapSettings.grid && <span className="ml-auto text-xs text-green-500">✓</span>}
            </button>
          </div>
        )}
      </div>

      {/* PDF Underlay */}
      <div className="flex items-center gap-1 border-r pr-2 mr-2">
        <button
          onClick={() => setShowPdfDialog(true)}
          className={cn(
            'flex flex-col items-center justify-center p-2 rounded-md transition-colors',
            'hover:bg-accent hover:text-accent-foreground',
            hasPdf && 'bg-accent'
          )}
          title="PDF Grundriss laden (P)"
        >
          <FileImage size={20} />
          <span className="text-xs mt-1">PDF</span>
        </button>
        {hasPdf && (
          <button
            onClick={togglePdfVisible}
            className={cn(
              'flex flex-col items-center justify-center p-2 rounded-md transition-colors',
              'hover:bg-accent hover:text-accent-foreground',
              pdfVisible && 'bg-accent'
            )}
            title="PDF ein/aus"
          >
            {pdfVisible ? <Eye size={20} /> : <EyeOff size={20} />}
            <span className="text-xs mt-1">{pdfVisible ? 'Ein' : 'Aus'}</span>
          </button>
        )}
      </div>

      {/* Edit Actions */}
      <div className="flex items-center gap-1 border-r pr-2 mr-2">
        <ActionButton
          icon={<Undo size={20} />}
          label="Rückgängig"
          onClick={undo}
          disabled={!canUndo}
          shortcut="Ctrl+Z"
        />
        <ActionButton
          icon={<Redo size={20} />}
          label="Wiederholen"
          onClick={redo}
          disabled={!canRedo}
          shortcut="Ctrl+Y"
        />
        <ActionButton
          icon={<Trash2 size={20} />}
          label="Löschen"
          onClick={handleDelete}
          disabled={!hasSelection}
          shortcut="Del"
        />
      </div>

      {/* Import/Export */}
      <div className="flex items-center gap-1">
        <ActionButton
          icon={<Upload size={20} />}
          label="3D Import"
          onClick={() => setShowImportDialog(true)}
          shortcut="Ctrl+I"
        />
        <ActionButton
          icon={isExporting ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />}
          label={isExporting ? 'Exportiere...' : 'IFC Export'}
          onClick={handleExport}
          disabled={isExporting}
          shortcut="Ctrl+E"
        />
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Selection Info */}
      {hasSelection && (
        <div className="text-sm text-muted-foreground">
          {selectedIds.length} Element{selectedIds.length > 1 ? 'e' : ''} ausgewählt
        </div>
      )}

      {/* PDF Calibration Dialog */}
      <PdfCalibrationDialog
        open={showPdfDialog}
        onClose={() => setShowPdfDialog(false)}
      />

      {/* 3D Model Import Dialog */}
      <ImportModelDialog
        open={showImportDialog}
        onClose={() => setShowImportDialog(false)}
      />
    </div>
  );
}
