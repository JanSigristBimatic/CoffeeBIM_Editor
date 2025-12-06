import { useState, useRef, useCallback, useEffect, type ChangeEvent, type MouseEvent } from 'react';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogContent,
  DialogFooter,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { usePdfUnderlayStore } from '@/store';
import { loadPdfFile, loadPdfPage } from '@/lib/pdf';
import type { PdfPoint, CalibrationStep } from '@/types/pdf';

interface PdfCalibrationDialogProps {
  open: boolean;
  onClose: () => void;
}

interface StepInfo {
  title: string;
  description: string;
  action: string;
}

const STEP_INFO: Record<CalibrationStep, StepInfo> = {
  upload: {
    title: 'PDF hochladen',
    description: 'Wähle eine PDF-Datei mit deinem Grundriss aus.',
    action: 'Datei auswählen',
  },
  origin: {
    title: 'Nullpunkt setzen',
    description: 'Klicke auf den Punkt, der im Modell bei (0, 0) liegen soll.',
    action: 'Weiter',
  },
  rotation: {
    title: 'Ausrichtung festlegen',
    description: 'Klicke auf einen zweiten Punkt für die X-Achse, oder gib einen Winkel manuell ein.',
    action: 'Weiter',
  },
  scale: {
    title: 'Massstab kalibrieren',
    description: 'Klicke zwei Punkte an und gib deren realen Abstand ein.',
    action: 'Fertig',
  },
  complete: {
    title: 'Kalibrierung abgeschlossen',
    description: 'Das PDF ist jetzt als Unterlegung im Modell sichtbar.',
    action: 'Schliessen',
  },
};

export function PdfCalibrationDialog({ open, onClose }: PdfCalibrationDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scaleDistance, setScaleDistance] = useState('1.0');
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [rotationInput, setRotationInput] = useState('0');

  const {
    document,
    calibration,
    calibrationStep,
    loadDocument,
    clearDocument,
    setOriginPoint,
    setRotationPoint,
    setRotationAngle,
    setScalePoint1,
    setScalePoint2,
    setRealWorldDistance,
    calculateCalibration,
    resetCalibration,
    setCalibrationStep,
  } = usePdfUnderlayStore();

  // Current angle in degrees
  const currentAngleDegrees = (calibration.rotationAngle * 180) / Math.PI;

  // Sync rotation input when angle changes from clicking on the PDF
  useEffect(() => {
    if (calibration.rotationPdfPoint) {
      setRotationInput(currentAngleDegrees.toFixed(0));
    }
  }, [calibration.rotationPdfPoint, currentAngleDegrees]);

  const handleFileChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!file.type.includes('pdf')) {
        setError('Bitte wähle eine PDF-Datei aus.');
        return;
      }

      setIsLoading(true);
      setError(null);
      setCurrentFile(file);

      try {
        const pdfDoc = await loadPdfFile(file);
        loadDocument(pdfDoc);
      } catch (err) {
        setError('Fehler beim Laden der PDF-Datei.');
        console.error('PDF load error:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [loadDocument]
  );

  const handlePageChange = useCallback(
    async (pageNumber: number) => {
      if (!currentFile || !document) return;

      setIsLoading(true);
      setError(null);

      try {
        const pdfDoc = await loadPdfPage(currentFile, pageNumber);
        loadDocument(pdfDoc);
      } catch (err) {
        setError('Fehler beim Laden der Seite.');
        console.error('PDF page load error:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [currentFile, document, loadDocument]
  );

  const handleImageClick = useCallback(
    (e: MouseEvent<HTMLImageElement>) => {
      const img = e.currentTarget;
      const rect = img.getBoundingClientRect();

      // Calculate click position relative to image (in PDF pixel coordinates)
      const scaleX = (document?.width ?? 1) / rect.width;
      const scaleY = (document?.height ?? 1) / rect.height;

      const point: PdfPoint = {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };

      switch (calibrationStep) {
        case 'origin':
          setOriginPoint(point);
          break;
        case 'rotation':
          setRotationPoint(point);
          break;
        case 'scale':
          if (!calibration.scalePoint1) {
            setScalePoint1(point);
          } else if (!calibration.scalePoint2) {
            setScalePoint2(point);
          }
          break;
      }
    },
    [
      calibrationStep,
      calibration,
      document,
      setOriginPoint,
      setRotationPoint,
      setScalePoint1,
      setScalePoint2,
    ]
  );

  const handleNext = useCallback(() => {
    switch (calibrationStep) {
      case 'rotation':
        // Proceed to scale step with current rotation angle
        setCalibrationStep('scale');
        break;
      case 'scale':
        const distance = parseFloat(scaleDistance);
        if (isNaN(distance) || distance <= 0) {
          setError('Bitte gib einen gültigen Abstand ein.');
          return;
        }
        setRealWorldDistance(distance);
        calculateCalibration();
        break;
      case 'complete':
        onClose();
        break;
    }
    setError(null);
  }, [calibrationStep, scaleDistance, setRealWorldDistance, calculateCalibration, onClose, setCalibrationStep]);

  const handleBack = useCallback(() => {
    switch (calibrationStep) {
      case 'rotation':
        setCalibrationStep('origin');
        break;
      case 'scale':
        setCalibrationStep('rotation');
        break;
    }
  }, [calibrationStep, setCalibrationStep]);

  const handleReset = useCallback(() => {
    clearDocument();
    resetCalibration();
    setError(null);
    setCurrentFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [clearDocument, resetCalibration]);

  const stepInfo = STEP_INFO[calibrationStep];
  const canProceed =
    calibrationStep === 'complete' ||
    calibrationStep === 'rotation' ||
    (calibrationStep === 'scale' &&
      calibration.scalePoint1 &&
      calibration.scalePoint2);

  return (
    <Dialog open={open} onClose={onClose} size="xl">
      <DialogHeader>
        <DialogTitle>{stepInfo.title}</DialogTitle>
        <DialogDescription>{stepInfo.description}</DialogDescription>
      </DialogHeader>

      <DialogContent>
        <div className="space-y-4">
          {/* Step indicator */}
          <div className="flex gap-2">
            {(['upload', 'origin', 'rotation', 'scale'] as CalibrationStep[]).map(
              (step, index) => (
                <div
                  key={step}
                  className={`h-2 flex-1 rounded-full ${
                    calibrationStep === step
                      ? 'bg-blue-500'
                      : ['origin', 'rotation', 'scale', 'complete'].indexOf(calibrationStep) >
                        index
                      ? 'bg-blue-300'
                      : 'bg-gray-200'
                  }`}
                />
              )
            )}
          </div>

          {/* Upload step */}
          {calibrationStep === 'upload' && (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileChange}
                className="hidden"
                id="pdf-upload"
              />
              <label
                htmlFor="pdf-upload"
                className="cursor-pointer flex flex-col items-center gap-3"
              >
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
                  {isLoading ? 'Wird geladen...' : 'PDF-Datei auswählen oder hierher ziehen'}
                </span>
              </label>
            </div>
          )}

          {/* Image preview with click handling */}
          {document && calibrationStep !== 'upload' && (
            <PdfImageWithMarkers
              document={document}
              calibration={calibration}
              calibrationStep={calibrationStep}
              isLoading={isLoading}
              onImageClick={handleImageClick}
              onPageChange={handlePageChange}
            />
          )}

          {/* Rotation input */}
          {calibrationStep === 'rotation' && (
            <div className="bg-gray-50 border rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-3">
                <label htmlFor="rotation-angle" className="text-sm font-medium">
                  Rotation:
                </label>
                <input
                  id="rotation-angle"
                  type="number"
                  step="1"
                  value={rotationInput}
                  onChange={(e) => {
                    setRotationInput(e.target.value);
                    const angle = parseFloat(e.target.value);
                    if (!isNaN(angle)) {
                      setRotationAngle(angle);
                    }
                  }}
                  className="w-20 px-3 py-2 border rounded-md text-sm text-center"
                />
                <span className="text-sm text-gray-600">°</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="text-sm text-gray-500 mr-2">Schnellauswahl:</span>
                {[0, 90, 180, 270].map((angle) => (
                  <button
                    key={angle}
                    type="button"
                    onClick={() => {
                      setRotationInput(String(angle));
                      setRotationAngle(angle);
                    }}
                    className={`px-3 py-1 text-sm rounded-md border transition-colors ${
                      rotationInput === String(angle)
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-white hover:bg-gray-100 border-gray-300'
                    }`}
                  >
                    {angle}°
                  </button>
                ))}
              </div>
              {calibration.rotationPdfPoint && (
                <p className="text-xs text-gray-500">
                  Winkel aus Klick: {currentAngleDegrees.toFixed(1)}°
                </p>
              )}
            </div>
          )}

          {/* Scale input */}
          {calibrationStep === 'scale' && calibration.scalePoint1 && calibration.scalePoint2 && (
            <div className="flex items-center gap-3">
              <label htmlFor="scale-distance" className="text-sm font-medium">
                Abstand zwischen den Punkten (Meter):
              </label>
              <input
                id="scale-distance"
                type="number"
                step="0.01"
                min="0.01"
                value={scaleDistance}
                onChange={(e) => setScaleDistance(e.target.value)}
                className="w-24 px-3 py-2 border rounded-md text-sm"
              />
            </div>
          )}

          {/* Calibration result */}
          {calibrationStep === 'complete' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-800 font-medium">Kalibrierung erfolgreich!</p>
              <p className="text-green-600 text-sm mt-1">
                Massstab: 1 Pixel = {(calibration.metersPerPixel * 100).toFixed(2)} cm
              </p>
              <p className="text-green-600 text-sm">
                Rotation: {((calibration.rotationAngle * 180) / Math.PI).toFixed(1)}°
              </p>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}
        </div>
      </DialogContent>

      <DialogFooter>
        {calibrationStep !== 'upload' && calibrationStep !== 'complete' && (
          <Button variant="ghost" onClick={handleBack}>
            Zurück
          </Button>
        )}
        {document && (
          <Button variant="ghost" onClick={handleReset}>
            Neu starten
          </Button>
        )}
        {canProceed && (
          <Button variant="primary" onClick={handleNext}>
            {stepInfo.action}
          </Button>
        )}
      </DialogFooter>
    </Dialog>
  );
}

/**
 * Combined image and markers component with proper dimension tracking
 */
interface PdfImageWithMarkersProps {
  document: NonNullable<ReturnType<typeof usePdfUnderlayStore.getState>['document']>;
  calibration: ReturnType<typeof usePdfUnderlayStore.getState>['calibration'];
  calibrationStep: CalibrationStep;
  isLoading: boolean;
  onImageClick: (e: MouseEvent<HTMLImageElement>) => void;
  onPageChange: (page: number) => void;
}

function PdfImageWithMarkers({
  document,
  calibration,
  calibrationStep: _calibrationStep,
  isLoading,
  onImageClick,
  onPageChange,
}: PdfImageWithMarkersProps) {
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const imageRef = useRef<HTMLImageElement>(null);
  void _calibrationStep;

  // Update dimensions when image loads or resizes
  const updateDimensions = useCallback(() => {
    if (imageRef.current) {
      setImageDimensions({
        width: imageRef.current.clientWidth,
        height: imageRef.current.clientHeight,
      });
    }
  }, []);

  // Calculate scale factors
  const scaleX = imageDimensions.width > 0 ? imageDimensions.width / document.width : 1;
  const scaleY = imageDimensions.height > 0 ? imageDimensions.height / document.height : 1;

  const markers: { point: PdfPoint | null; color: string; label: string }[] = [
    { point: calibration.originPdfPoint, color: 'bg-red-500', label: 'O' },
    { point: calibration.rotationPdfPoint, color: 'bg-blue-500', label: 'X' },
    { point: calibration.scalePoint1, color: 'bg-yellow-500', label: '1' },
    { point: calibration.scalePoint2, color: 'bg-yellow-500', label: '2' },
  ];

  return (
    <>
      {/* Page selector for multi-page PDFs */}
      {document.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mb-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(document.pageNumber - 1)}
            disabled={document.pageNumber <= 1 || isLoading}
          >
            ← Vorherige
          </Button>
          <span className="text-sm text-gray-600">
            Seite {document.pageNumber} von {document.totalPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(document.pageNumber + 1)}
            disabled={document.pageNumber >= document.totalPages || isLoading}
          >
            Nächste →
          </Button>
        </div>
      )}

      <div className="relative overflow-auto max-h-[60vh] border rounded-lg bg-gray-100">
        <img
          ref={imageRef}
          src={document.imageDataUrl}
          alt="PDF Vorschau"
          className="max-w-full cursor-crosshair"
          onClick={onImageClick}
          onLoad={updateDimensions}
          draggable={false}
        />

        {/* Markers overlay - only render when we have dimensions */}
        {imageDimensions.width > 0 && (
          <div className="absolute inset-0 pointer-events-none">
            {markers.map(
              ({ point, color, label }, index) =>
                point && (
                  <div
                    key={index}
                    className={`absolute w-6 h-6 ${color} rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg border-2 border-white`}
                    style={{
                      left: `${point.x * scaleX}px`,
                      top: `${point.y * scaleY}px`,
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    {label}
                  </div>
                )
            )}

            {/* Line between origin and rotation point */}
            {calibration.originPdfPoint && calibration.rotationPdfPoint && (
              <svg className="absolute inset-0 w-full h-full">
                <line
                  x1={calibration.originPdfPoint.x * scaleX}
                  y1={calibration.originPdfPoint.y * scaleY}
                  x2={calibration.rotationPdfPoint.x * scaleX}
                  y2={calibration.rotationPdfPoint.y * scaleY}
                  stroke="#3b82f6"
                  strokeWidth={2}
                  strokeDasharray="5,5"
                />
              </svg>
            )}

            {/* Line between scale points */}
            {calibration.scalePoint1 && calibration.scalePoint2 && (
              <svg className="absolute inset-0 w-full h-full">
                <line
                  x1={calibration.scalePoint1.x * scaleX}
                  y1={calibration.scalePoint1.y * scaleY}
                  x2={calibration.scalePoint2.x * scaleX}
                  y2={calibration.scalePoint2.y * scaleY}
                  stroke="#eab308"
                  strokeWidth={2}
                  strokeDasharray="5,5"
                />
              </svg>
            )}
          </div>
        )}
      </div>
    </>
  );
}
