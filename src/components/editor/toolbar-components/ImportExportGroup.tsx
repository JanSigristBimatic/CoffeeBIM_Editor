import { Upload, FileUp, Download, Loader2 } from 'lucide-react';
import { ActionButton } from './ToolbarButtons';

interface ImportExportGroupProps {
  isExporting: boolean;
  onExport: () => void;
  onOpenImportDialog: () => void;
  onOpenIfcImportDialog: () => void;
}

export function ImportExportGroup({
  isExporting,
  onExport,
  onOpenImportDialog,
  onOpenIfcImportDialog,
}: ImportExportGroupProps) {
  return (
    <div className="flex items-center gap-1">
      <ActionButton
        icon={<Upload size={20} />}
        label="3D Import"
        onClick={onOpenImportDialog}
        shortcut="Ctrl+I"
      />
      <ActionButton
        icon={<FileUp size={20} />}
        label="IFC Import"
        onClick={onOpenIfcImportDialog}
        shortcut="Ctrl+Shift+I"
      />
      <ActionButton
        icon={isExporting ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />}
        label={isExporting ? 'Exportiere...' : 'IFC Export'}
        onClick={onExport}
        disabled={isExporting}
        shortcut="Ctrl+E"
      />
    </div>
  );
}
