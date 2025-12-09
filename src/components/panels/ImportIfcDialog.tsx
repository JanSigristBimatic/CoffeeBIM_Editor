import { useState, useRef, useCallback, type ChangeEvent, type DragEvent } from 'react';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogContent,
  DialogFooter,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { useElementStore, useProjectStore } from '@/store';
import { importFromIfc, type ImportResult, type ImportOptions } from '@/bim/ifc';

interface ImportIfcDialogProps {
  open: boolean;
  onClose: () => void;
}

type ImportMode = 'replace' | 'merge';

interface ImportState {
  status: 'idle' | 'loading' | 'preview' | 'error';
  file: File | null;
  result: ImportResult | null;
  error: string | null;
}

export function ImportIfcDialog({ open, onClose }: ImportIfcDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importState, setImportState] = useState<ImportState>({
    status: 'idle',
    file: null,
    result: null,
    error: null,
  });
  const [importMode, setImportMode] = useState<ImportMode>('replace');
  const [options, setOptions] = useState<ImportOptions>({
    importWalls: true,
    importDoors: true,
    importWindows: true,
    importColumns: true,
    importSlabs: true,
    importFurniture: true,
    importPropertySets: true,
    coordinateSystem: 'z-up',
  });
  const [isDragging, setIsDragging] = useState(false);

  const { importElements } = useElementStore();
  const { importProject } = useProjectStore();

  // Handle file selection
  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.ifc')) {
      setImportState({
        status: 'error',
        file: null,
        result: null,
        error: 'Nur IFC-Dateien werden unterstützt',
      });
      return;
    }

    setImportState({
      status: 'loading',
      file,
      result: null,
      error: null,
    });

    try {
      const result = await importFromIfc(file, options);

      setImportState({
        status: 'preview',
        file,
        result,
        error: null,
      });
    } catch (err) {
      setImportState({
        status: 'error',
        file,
        result: null,
        error: err instanceof Error ? err.message : 'Fehler beim Lesen der IFC-Datei',
      });
    }
  }, [options]);

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFile(file);
      }
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [handleFile]
  );

  // Drag & drop handlers
  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  // Confirm import
  const handleConfirmImport = useCallback(() => {
    if (!importState.result) return;

    const { project, site, building, storeys, elements } = importState.result;

    // Import project hierarchy
    importProject(project, site, building, storeys);

    // Import elements
    importElements(elements, importMode === 'replace');

    // Close dialog
    handleClose();
  }, [importState.result, importMode, importProject, importElements]);

  // Reset and close
  const handleClose = useCallback(() => {
    setImportState({
      status: 'idle',
      file: null,
      result: null,
      error: null,
    });
    setImportMode('replace');
    onClose();
  }, [onClose]);

  // Reset to file selection
  const handleBack = useCallback(() => {
    setImportState({
      status: 'idle',
      file: null,
      result: null,
      error: null,
    });
  }, []);

  // Toggle import option
  const toggleOption = useCallback((key: keyof ImportOptions) => {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  return (
    <Dialog open={open} onClose={handleClose} size="lg">
      <DialogHeader>
        <DialogTitle>IFC-Datei importieren</DialogTitle>
        <DialogDescription>
          Importiere ein bestehendes IFC-Modell in den Editor.
        </DialogDescription>
      </DialogHeader>

      <DialogContent>
        {/* Idle/Error State - File Selection */}
        {(importState.status === 'idle' || importState.status === 'error') && (
          <div className="space-y-4">
            {/* Drag & Drop Zone */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".ifc"
                onChange={handleFileChange}
                className="hidden"
                id="ifc-upload"
              />
              <label htmlFor="ifc-upload" className="cursor-pointer flex flex-col items-center gap-3">
                <svg
                  className="w-12 h-12 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <span className="text-gray-600">
                  IFC-Datei hierher ziehen
                  <br />
                  <span className="text-sm text-gray-500">oder klicken zum Auswählen</span>
                </span>
              </label>
            </div>

            {/* Import Options */}
            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-medium text-gray-700">Import-Optionen</h3>
              <div className="grid grid-cols-2 gap-2">
                {([
                  ['importWalls', 'Wände'],
                  ['importDoors', 'Türen'],
                  ['importWindows', 'Fenster'],
                  ['importColumns', 'Säulen'],
                  ['importSlabs', 'Böden/Decken'],
                  ['importFurniture', 'Möbel'],
                  ['importPropertySets', 'Attribute'],
                ] as const).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={options[key] === true}
                      onChange={() => toggleOption(key)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    {label}
                  </label>
                ))}
              </div>

              {/* Coordinate System */}
              <div className="pt-3 mt-3 border-t">
                <h4 className="text-sm font-medium text-gray-600 mb-2">Koordinatensystem</h4>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="coordSystem"
                      value="z-up"
                      checked={options.coordinateSystem === 'z-up'}
                      onChange={() => setOptions((prev) => ({ ...prev, coordinateSystem: 'z-up' }))}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    Z-Up (Standard)
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="coordSystem"
                      value="y-up"
                      checked={options.coordinateSystem === 'y-up'}
                      onChange={() => setOptions((prev) => ({ ...prev, coordinateSystem: 'y-up' }))}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    Y-Up (z.B. Revit)
                  </label>
                </div>
              </div>
            </div>

            {/* Error message */}
            {importState.status === 'error' && importState.error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-700 text-sm">{importState.error}</p>
              </div>
            )}
          </div>
        )}

        {/* Loading State */}
        {importState.status === 'loading' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
            <p className="text-gray-600">
              Lade <span className="font-medium">{importState.file?.name}</span>...
            </p>
          </div>
        )}

        {/* Preview State */}
        {importState.status === 'preview' && importState.result && (
          <div className="space-y-4">
            {/* File Info */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
              <div className="w-10 h-10 bg-green-100 rounded flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="font-medium">{importState.file?.name}</div>
                <div className="text-sm text-gray-500">
                  {((importState.file?.size || 0) / 1024 / 1024).toFixed(2)} MB
                </div>
              </div>
            </div>

            {/* Import Statistics */}
            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-medium text-gray-700">Gefundene Elemente</h3>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-blue-600">
                    {importState.result.stats.wallsImported}
                  </span>
                  <span className="text-gray-600">Wände</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-blue-600">
                    {importState.result.stats.doorsImported}
                  </span>
                  <span className="text-gray-600">Türen</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-blue-600">
                    {importState.result.stats.windowsImported}
                  </span>
                  <span className="text-gray-600">Fenster</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-blue-600">
                    {importState.result.stats.columnsImported}
                  </span>
                  <span className="text-gray-600">Säulen</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-blue-600">
                    {importState.result.stats.slabsImported}
                  </span>
                  <span className="text-gray-600">Böden</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-blue-600">
                    {importState.result.stats.furnitureImported}
                  </span>
                  <span className="text-gray-600">Möbel</span>
                </div>
              </div>

              {importState.result.stats.elementsSkipped > 0 && (
                <p className="text-sm text-amber-600">
                  {importState.result.stats.elementsSkipped} Elemente wurden übersprungen
                </p>
              )}
            </div>

            {/* Project Info */}
            <div className="border rounded-lg p-4 space-y-2">
              <h3 className="text-sm font-medium text-gray-700">Projekt</h3>
              <div className="text-sm space-y-1">
                <div>
                  <span className="text-gray-500">Name:</span>{' '}
                  <span className="font-medium">{importState.result.project.name}</span>
                </div>
                <div>
                  <span className="text-gray-500">Stockwerke:</span>{' '}
                  <span className="font-medium">{importState.result.storeys.length}</span>
                  {importState.result.storeys.length > 0 && (
                    <span className="text-gray-500 ml-2">
                      ({importState.result.storeys.map((s) => s.name).join(', ')})
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Import Mode */}
            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-medium text-gray-700">Import-Modus</h3>
              <div className="space-y-2">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="importMode"
                    value="replace"
                    checked={importMode === 'replace'}
                    onChange={() => setImportMode('replace')}
                    className="mt-1 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <div className="font-medium text-sm">Projekt ersetzen</div>
                    <div className="text-xs text-gray-500">
                      Alle bestehenden Elemente werden durch das importierte Modell ersetzt
                    </div>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="importMode"
                    value="merge"
                    checked={importMode === 'merge'}
                    onChange={() => setImportMode('merge')}
                    className="mt-1 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <div className="font-medium text-sm">Zusammenführen</div>
                    <div className="text-xs text-gray-500">
                      Importierte Elemente werden zum bestehenden Projekt hinzugefügt
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Warnings */}
            {importState.result.warnings.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <h4 className="text-sm font-medium text-amber-800 mb-2">
                  Warnungen ({importState.result.warnings.length})
                </h4>
                <ul className="text-sm text-amber-700 space-y-1 max-h-32 overflow-y-auto">
                  {importState.result.warnings.slice(0, 10).map((warning, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-amber-500">•</span>
                      <span>{warning}</span>
                    </li>
                  ))}
                  {importState.result.warnings.length > 10 && (
                    <li className="text-amber-600 font-medium">
                      ... und {importState.result.warnings.length - 10} weitere
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}
      </DialogContent>

      <DialogFooter>
        {importState.status === 'preview' ? (
          <>
            <Button variant="ghost" onClick={handleBack}>
              Zurück
            </Button>
            <Button variant="primary" onClick={handleConfirmImport}>
              Importieren
            </Button>
          </>
        ) : (
          <Button variant="ghost" onClick={handleClose}>
            Abbrechen
          </Button>
        )}
      </DialogFooter>
    </Dialog>
  );
}
