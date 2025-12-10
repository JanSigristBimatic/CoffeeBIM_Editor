import { useState, useEffect, useCallback } from 'react';
import { Trash2 } from 'lucide-react';
import { useSelectionStore, useElementStore, useProjectStore } from '@/store';
import { exportToIfc } from '@/bim/ifc';
import { clearDatabase } from '@/lib/storage/indexedDBStorage';
import { PdfCalibrationDialog } from '@/components/panels/PdfCalibrationDialog';
import { ImportModelDialog } from '@/components/panels/ImportModelDialog';
import { ImportIfcDialog } from '@/components/panels/ImportIfcDialog';
import {
  ToolSelectionGroup,
  ViewControlsGroup,
  SnapControlsGroup,
  PdfUnderlayGroup,
  EditActionsGroup,
  SpaceActionsGroup,
  ImportExportGroup,
  EvacuationGroup,
  ActionButton,
} from './toolbar-components';

export function Toolbar() {
  const { getSelectedIds } = useSelectionStore();
  const { getAllElements } = useElementStore();
  const { project, site, building, storeys } = useProjectStore();

  const [isExporting, setIsExporting] = useState(false);
  const [showPdfDialog, setShowPdfDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showIfcImportDialog, setShowIfcImportDialog] = useState(false);

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
      alert('IFC Export fehlgeschlagen. Bitte prufen Sie die Konsole fur Details.');
    } finally {
      setIsExporting(false);
    }
  }, [isExporting, getAllElements, project, site, building, storeys]);

  const handleClearProject = useCallback(async () => {
    const confirmed = window.confirm(
      'Möchten Sie das Projekt wirklich löschen?\n\nAlle Daten werden unwiderruflich gelöscht und die Seite wird neu geladen.'
    );
    if (confirmed) {
      await clearDatabase();
      window.location.reload();
    }
  }, []);

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
    <div className="flex items-center gap-1 p-2 bg-background border-b">
      <ToolSelectionGroup />
      <ViewControlsGroup />
      <SnapControlsGroup />
      <PdfUnderlayGroup onOpenPdfDialog={() => setShowPdfDialog(true)} />
      <EditActionsGroup />
      <SpaceActionsGroup />
      <EvacuationGroup />
      <ImportExportGroup
        isExporting={isExporting}
        onExport={handleExport}
        onOpenImportDialog={() => setShowImportDialog(true)}
        onOpenIfcImportDialog={() => setShowIfcImportDialog(true)}
      />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Selection Info */}
      {hasSelection && (
        <div className="text-sm text-muted-foreground">
          {selectedIds.length} Element{selectedIds.length > 1 ? 'e' : ''} ausgewahlt
        </div>
      )}

      {/* Project Actions */}
      <div className="flex items-center gap-1 border-l pl-2 ml-2">
        <ActionButton
          icon={<Trash2 size={20} className="text-destructive" />}
          label="Löschen"
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
    </div>
  );
}
