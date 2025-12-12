import { Upload, FileUp, Download, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-1">
      <ActionButton
        icon={<Upload size={20} />}
        label={t('import.model')}
        onClick={onOpenImportDialog}
        shortcut="Ctrl+I"
      />
      <ActionButton
        icon={<FileUp size={20} />}
        label={t('import.ifc')}
        onClick={onOpenIfcImportDialog}
        shortcut="Ctrl+Shift+I"
      />
      <ActionButton
        icon={isExporting ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />}
        label={isExporting ? t('export.exporting') : t('export.ifc')}
        onClick={onExport}
        disabled={isExporting}
        shortcut="Ctrl+E"
      />
    </div>
  );
}
