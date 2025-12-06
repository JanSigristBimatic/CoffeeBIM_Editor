import {
  MousePointer2,
  Square,
  DoorOpen,
  AppWindow,
  Grid2X2,
  Columns3,
  Download,
  Undo,
  Redo,
  Trash2,
  LayoutGrid,
  Loader2,
  FileImage,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useState } from 'react';
import { useToolStore, useViewStore, useSelectionStore, useElementStore, useProjectStore, usePdfUnderlayStore } from '@/store';
import type { ToolType } from '@/types/tools';
import { cn } from '@/lib/utils';
import { exportToIfc } from '@/bim/ifc';
import { PdfCalibrationDialog } from '@/components/panels/PdfCalibrationDialog';

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
  const { toggleGrid, showGrid } = useViewStore();
  const { getSelectedIds, clearSelection } = useSelectionStore();
  const { removeElements, getAllElements } = useElementStore();
  const { project, site, building, storeys } = useProjectStore();
  const { isLoaded: hasPdf, isVisible: pdfVisible, toggleVisible: togglePdfVisible } = usePdfUnderlayStore();

  const [isExporting, setIsExporting] = useState(false);
  const [showPdfDialog, setShowPdfDialog] = useState(false);

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
        <ToolButton tool="wall" icon={<Square size={20} />} label="Wand" shortcut="W" />
        <ToolButton tool="door" icon={<DoorOpen size={20} />} label="Tür" shortcut="T" />
        <ToolButton tool="window" icon={<AppWindow size={20} />} label="Fenster" shortcut="F" />
        <ToolButton tool="column" icon={<Columns3 size={20} />} label="Säule" shortcut="S" />
        <ToolButton tool="slab" icon={<LayoutGrid size={20} />} label="Boden" shortcut="B" />
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
          onClick={() => console.log('Undo')}
          disabled
          shortcut="Ctrl+Z"
        />
        <ActionButton
          icon={<Redo size={20} />}
          label="Wiederholen"
          onClick={() => console.log('Redo')}
          disabled
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

      {/* Export */}
      <div className="flex items-center gap-1">
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
    </div>
  );
}
