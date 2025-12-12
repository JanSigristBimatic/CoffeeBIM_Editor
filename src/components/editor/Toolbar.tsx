import { useState, useEffect, useCallback } from 'react';
import { Trash2, Settings, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSelectionStore, useElementStore, useProjectStore, useSettingsStore } from '@/store';
import { exportToIfc } from '@/bim/ifc';
import { clearDatabase } from '@/lib/storage/indexedDBStorage';
import { PdfCalibrationDialog } from '@/components/panels/PdfCalibrationDialog';
import { ImportModelDialog } from '@/components/panels/ImportModelDialog';
import { ImportIfcDialog } from '@/components/panels/ImportIfcDialog';
import { SettingsDialog } from '@/components/panels/SettingsDialog';
import { VisualizationDialog } from '@/components/panels/VisualizationDialog';
import {
  ToolSelectionGroup,
  ViewControlsGroup,
  SnapControlsGroup,
  PdfUnderlayGroup,
  EditActionsGroup,
  SpaceActionsGroup,
  ImportExportGroup,
  ActionButton,
} from './toolbar-components';
import { ProModeGroup } from './toolbar-components/ProModeGroup';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';

export function Toolbar() {
  const { t } = useTranslation();
  const { getSelectedIds } = useSelectionStore();
  const { getAllElements } = useElementStore();
  const { project, site, building, storeys } = useProjectStore();
  const { geminiApiKey, isKeyValidated } = useSettingsStore();

  const [isExporting, setIsExporting] = useState(false);
  const [showPdfDialog, setShowPdfDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showIfcImportDialog, setShowIfcImportDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showVisualizationDialog, setShowVisualizationDialog] = useState(false);

  // Check if AI visualization is available
  const canVisualize = geminiApiKey && isKeyValidated;

  const selectedIds = getSelectedIds();
  const hasSelection = selectedIds.length > 0;

  const handleExport = useCallback(async () => {
    if (isExporting) return;

    setIsExporting(true);
    try {
      const elements = getAllElements();
      await exportToIfc(project, site, building, storeys, elements);
    } catch (error) {
      console.error('IFC Export failed:', error);
      alert(t('dialogs.exportFailed'));
    } finally {
      setIsExporting(false);
    }
  }, [isExporting, getAllElements, project, site, building, storeys, t]);

  const handleClearProject = useCallback(async () => {
    const confirmed = window.confirm(t('dialogs.confirmDelete'));
    if (confirmed) {
      await clearDatabase();
      window.location.reload();
    }
  }, [t]);

  // Keyboard shortcuts for import/export
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const ctrl = event.ctrlKey || event.metaKey;
      const shift = event.shiftKey;

      // Ctrl+Shift+I - IFC Import
      if (ctrl && shift && event.key.toLowerCase() === 'i') {
        event.preventDefault();
        setShowIfcImportDialog(true);
        return;
      }

      // Ctrl+E - IFC Export
      if (ctrl && !shift && event.key.toLowerCase() === 'e') {
        event.preventDefault();
        if (!isExporting) {
          handleExport();
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExporting, handleExport]);

  return (
    <div className="flex items-center gap-1 p-2 bg-background border-b overflow-x-auto scrollbar-hide">
      {/* Tool groups - scrollable on mobile */}
      <div className="flex items-center gap-1 shrink-0">
        <ToolSelectionGroup />
        <ViewControlsGroup />
        <SnapControlsGroup />
        <PdfUnderlayGroup onOpenPdfDialog={() => setShowPdfDialog(true)} />
        <EditActionsGroup />
        <SpaceActionsGroup />
        <ProModeGroup />
        <ImportExportGroup
          isExporting={isExporting}
          onExport={handleExport}
          onOpenImportDialog={() => setShowImportDialog(true)}
          onOpenIfcImportDialog={() => setShowIfcImportDialog(true)}
        />
      </div>

      {/* Spacer - hidden on small screens */}
      <div className="flex-1 hidden md:block" />

      {/* Selection Info - hidden on small screens */}
      {hasSelection && (
        <div className="text-sm text-muted-foreground hidden lg:block shrink-0">
          {t('messages.multipleSelected', { count: selectedIds.length })}
        </div>
      )}

      {/* AI & Settings */}
      <div className="flex items-center gap-1 border-l pl-2 ml-2 shrink-0">
        <ActionButton
          icon={<Sparkles size={20} className={canVisualize ? 'text-purple-500' : 'text-muted-foreground'} />}
          label={t('toolbar.visualize')}
          onClick={() => setShowVisualizationDialog(true)}
          disabled={!canVisualize}
        />
        <ActionButton
          icon={<Settings size={20} />}
          label={t('toolbar.settings')}
          onClick={() => setShowSettingsDialog(true)}
        />
        <LanguageSwitcher />
      </div>

      {/* Project Actions */}
      <div className="flex items-center gap-1 border-l pl-2 ml-2 shrink-0">
        <ActionButton
          icon={<Trash2 size={20} className="text-destructive" />}
          label={t('toolbar.clearProject')}
          onClick={handleClearProject}
        />
      </div>

      {/* Dialogs */}
      <PdfCalibrationDialog
        open={showPdfDialog}
        onClose={() => setShowPdfDialog(false)}
      />
      <ImportModelDialog
        open={showImportDialog}
        onClose={() => setShowImportDialog(false)}
      />
      <ImportIfcDialog
        open={showIfcImportDialog}
        onClose={() => setShowIfcImportDialog(false)}
      />
      <SettingsDialog
        open={showSettingsDialog}
        onClose={() => setShowSettingsDialog(false)}
      />
      <VisualizationDialog
        open={showVisualizationDialog}
        onClose={() => setShowVisualizationDialog(false)}
      />
    </div>
  );
}
