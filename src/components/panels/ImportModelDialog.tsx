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
import {
  createFurniture,
  getModelFormatFromExtension,
  isSupportedModelFormat,
} from '@/bim/elements';
import type { FurnitureCategory } from '@/bim/elements';

interface ImportModelDialogProps {
  open: boolean;
  onClose: () => void;
}

interface ImportedModel {
  file: File;
  name: string;
  category: FurnitureCategory;
  dataUrl: string; // Data URL (base64) persists across sessions, unlike blob URLs
}

const CATEGORY_OPTIONS: { value: FurnitureCategory; label: string }[] = [
  { value: 'coffee-machine', label: 'Kaffeemaschine' },
  { value: 'grinder', label: 'Mühle' },
  { value: 'refrigerator', label: 'Kühlschrank' },
  { value: 'counter', label: 'Theke' },
  { value: 'table', label: 'Tisch' },
  { value: 'chair', label: 'Stuhl' },
  { value: 'sofa', label: 'Sofa' },
  { value: 'shelf', label: 'Regal' },
  { value: 'cabinet', label: 'Schrank' },
  { value: 'appliance', label: 'Gerät' },
  { value: 'decoration', label: 'Dekoration' },
  { value: 'other', label: 'Sonstiges' },
];

export function ImportModelDialog({ open, onClose }: ImportModelDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importedModels, setImportedModels] = useState<ImportedModel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const { addElement } = useElementStore();
  const { activeStoreyId } = useProjectStore();

  // Convert file to data URL (base64) - persists across sessions unlike blob URLs
  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error(`Fehler beim Lesen von ${file.name}`));
      reader.readAsDataURL(file);
    });
  };

  // Handle file selection
  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files) return;

    const errors: string[] = [];
    const warnings: string[] = [];
    const validFiles: File[] = [];

    Array.from(files).forEach((file) => {
      if (!isSupportedModelFormat(file.name)) {
        errors.push(`${file.name}: Nicht unterstütztes Format`);
        return;
      }

      // Warn about gltf files (they often have external dependencies)
      const ext = file.name.toLowerCase().split('.').pop();
      if (ext === 'gltf') {
        warnings.push(
          `${file.name}: .gltf Dateien können externe Abhängigkeiten haben. ` +
          `Verwende .glb (binär) für beste Kompatibilität.`
        );
      }

      // Warn about large files (>10MB) - data URLs can be large
      if (file.size > 10 * 1024 * 1024) {
        warnings.push(
          `${file.name}: Große Datei (${(file.size / 1024 / 1024).toFixed(1)} MB). ` +
          `Performance kann beeinträchtigt sein.`
        );
      }

      validFiles.push(file);
    });

    if (errors.length > 0) {
      setError(errors.join('\n'));
      return;
    }

    // Convert all valid files to data URLs (async)
    try {
      const newModels: ImportedModel[] = await Promise.all(
        validFiles.map(async (file) => {
          const dataUrl = await fileToDataUrl(file);
          const name = file.name.replace(/\.[^/.]+$/, '');
          return {
            file,
            name,
            category: 'other' as FurnitureCategory,
            dataUrl,
          };
        })
      );

      if (warnings.length > 0) {
        setError(warnings.join('\n'));
      } else {
        setError(null);
      }

      setImportedModels((prev) => [...prev, ...newModels]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Dateien');
    }
  }, []);

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files);
      // Reset input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [handleFiles]
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
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  // Update model properties
  const updateModel = useCallback((index: number, updates: Partial<ImportedModel>) => {
    setImportedModels((prev) =>
      prev.map((model, i) => (i === index ? { ...model, ...updates } : model))
    );
  }, []);

  // Remove model from list
  const removeModel = useCallback((index: number) => {
    setImportedModels((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Import all models
  const handleImport = useCallback(() => {
    if (!activeStoreyId) {
      setError('Kein aktives Geschoss ausgewählt');
      return;
    }

    const spacing = 2; // meters between imported objects

    importedModels.forEach((model, index) => {
      const format = getModelFormatFromExtension(model.file.name);
      if (!format) return;

      // Default scale - start at 1.0 (assume model is in meters)
      // User can adjust in property panel after import
      const defaultScale = 1.0;

      const element = createFurniture({
        name: model.name,
        category: model.category,
        modelUrl: model.dataUrl, // Use data URL - persists across sessions
        modelFormat: format,
        originalFileName: model.file.name,
        position: {
          x: index * spacing, // Spread objects along X axis
          y: 0,
          z: 0,
        },
        scale: defaultScale,
        storeyId: activeStoreyId,
      });

      addElement(element);
    });

    // Clear and close
    setImportedModels([]);
    setError(null);
    onClose();
  }, [importedModels, activeStoreyId, addElement, onClose]);

  // Cleanup on close
  const handleClose = useCallback(() => {
    // Clear models that weren't imported
    setImportedModels([]);
    setError(null);
    onClose();
  }, [onClose]);

  return (
    <Dialog open={open} onClose={handleClose} size="lg">
      <DialogHeader>
        <DialogTitle>3D-Modell importieren</DialogTitle>
        <DialogDescription>
          Importiere GLB, glTF oder OBJ Dateien als Möbel und Ausstattung.
        </DialogDescription>
      </DialogHeader>

      <DialogContent>
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
              accept=".glb,.gltf,.obj"
              multiple
              onChange={handleFileChange}
              className="hidden"
              id="model-upload"
            />
            <label htmlFor="model-upload" className="cursor-pointer flex flex-col items-center gap-3">
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
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <span className="text-gray-600">
                GLB, glTF oder OBJ Dateien hierher ziehen
                <br />
                <span className="text-sm text-gray-500">oder klicken zum Auswählen</span>
              </span>
            </label>
          </div>

          {/* Imported Models List */}
          {importedModels.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-700">
                Zu importieren ({importedModels.length})
              </h3>

              <div className="max-h-64 overflow-y-auto space-y-2">
                {importedModels.map((model, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border"
                  >
                    {/* File icon */}
                    <div className="w-10 h-10 bg-blue-100 rounded flex items-center justify-center flex-shrink-0">
                      <svg
                        className="w-6 h-6 text-blue-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                        />
                      </svg>
                    </div>

                    {/* Name input */}
                    <div className="flex-1 min-w-0">
                      <input
                        type="text"
                        value={model.name}
                        onChange={(e) => updateModel(index, { name: e.target.value })}
                        className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Name"
                      />
                      <div className="text-xs text-gray-500 mt-1 truncate">
                        {model.file.name} ({(model.file.size / 1024).toFixed(1)} KB)
                      </div>
                    </div>

                    {/* Category select */}
                    <select
                      value={model.category}
                      onChange={(e) =>
                        updateModel(index, { category: e.target.value as FurnitureCategory })
                      }
                      className="px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {CATEGORY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>

                    {/* Remove button */}
                    <button
                      onClick={() => removeModel(index)}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      title="Entfernen"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Supported formats info */}
          <div className="text-xs text-gray-500 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>
              Unterstützte Formate: <strong>GLB</strong> (empfohlen), <strong>glTF</strong>,{' '}
              <strong>OBJ</strong>
            </span>
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-700 text-sm whitespace-pre-line">{error}</p>
            </div>
          )}
        </div>
      </DialogContent>

      <DialogFooter>
        <Button variant="ghost" onClick={handleClose}>
          Abbrechen
        </Button>
        <Button
          variant="primary"
          onClick={handleImport}
          disabled={importedModels.length === 0 || !activeStoreyId}
        >
          {importedModels.length === 0
            ? 'Importieren'
            : `${importedModels.length} Objekt${importedModels.length > 1 ? 'e' : ''} importieren`}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
