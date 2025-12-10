/**
 * Visualization Dialog - AI-gestützte Renderingenerierung
 *
 * Workflow:
 * 1. Benutzer wählt einen Stil
 * 2. Screenshot des 3D-Modells wird erstellt
 * 3. Gemini API generiert fotorealistisches Rendering
 * 4. Ergebnis kann heruntergeladen werden
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogContent,
  DialogFooter,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { useSettingsStore, type VisualizationStyle } from '@/store';
import {
  captureCanvasElement,
  generateVisualization,
  revokeImageUrl,
  STYLE_LABELS,
  STYLE_EMOJIS,
  getStyleDescription,
} from '@/lib/visualization';

interface VisualizationDialogProps {
  open: boolean;
  onClose: () => void;
  canvasRef?: React.RefObject<HTMLCanvasElement>;
}

type Status = 'idle' | 'capturing' | 'generating' | 'done' | 'error';

const STYLE_OPTIONS: VisualizationStyle[] = ['modern', 'industrial', 'cozy', 'minimal', 'luxury'];

export function VisualizationDialog({
  open,
  onClose,
  canvasRef,
}: VisualizationDialogProps) {
  const {
    geminiApiKey,
    isKeyValidated,
    visualizationStyle,
    setVisualizationStyle,
  } = useSettingsStore();

  const [status, setStatus] = useState<Status>('idle');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');

  // Clean up object URLs when component unmounts or result changes
  const resultUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (resultUrlRef.current) {
        revokeImageUrl(resultUrlRef.current);
      }
    };
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!geminiApiKey) {
      setError('API-Key nicht konfiguriert');
      setStatus('error');
      return;
    }

    // Find canvas element - try provided ref or search in DOM
    let canvas: HTMLCanvasElement | null = canvasRef?.current || null;
    if (!canvas) {
      // Try to find the R3F canvas
      canvas = document.querySelector('canvas[data-engine]') as HTMLCanvasElement;
    }
    if (!canvas) {
      canvas = document.querySelector('canvas') as HTMLCanvasElement;
    }

    if (!canvas) {
      setError('3D-Canvas nicht gefunden');
      setStatus('error');
      return;
    }

    setError(null);
    setStatus('capturing');
    setProgress('Erstelle Screenshot...');

    try {
      // Step 1: Capture screenshot
      const screenshotResult = await captureCanvasElement(canvas, {
        format: 'png',
        quality: 0.95,
      });

      setScreenshot(screenshotResult.dataUrl);
      setStatus('generating');
      setProgress('Generiere Visualisierung mit AI...');

      // Step 2: Generate with Gemini
      const genResult = await generateVisualization(
        geminiApiKey,
        screenshotResult.blob,
        visualizationStyle
      );

      if (genResult.success && genResult.imageUrl) {
        // Clean up old result URL
        if (resultUrlRef.current) {
          revokeImageUrl(resultUrlRef.current);
        }
        resultUrlRef.current = genResult.imageUrl;
        setResult(genResult.imageUrl);
        setStatus('done');
        setProgress('');
      } else {
        setError(genResult.error || 'Generierung fehlgeschlagen');
        setStatus('error');
        setProgress('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
      setStatus('error');
      setProgress('');
    }
  }, [geminiApiKey, canvasRef, visualizationStyle]);

  const handleDownload = useCallback(() => {
    if (!result) return;

    const link = document.createElement('a');
    link.href = result;
    link.download = `coffeebim-${visualizationStyle}-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [result, visualizationStyle]);

  const handleReset = useCallback(() => {
    setStatus('idle');
    setScreenshot(null);
    if (resultUrlRef.current) {
      revokeImageUrl(resultUrlRef.current);
      resultUrlRef.current = null;
    }
    setResult(null);
    setError(null);
    setProgress('');
  }, []);

  const handleClose = useCallback(() => {
    handleReset();
    onClose();
  }, [handleReset, onClose]);

  // Check if API key is configured
  const hasApiKey = geminiApiKey && isKeyValidated;

  return (
    <Dialog open={open} onClose={handleClose} size="lg">
      <DialogHeader>
        <DialogTitle>
          🎨 AI Visualisierung
        </DialogTitle>
        <DialogDescription>
          Generiere ein fotorealistisches Rendering deines Modells
        </DialogDescription>
      </DialogHeader>

      <DialogContent>
        {!hasApiKey ? (
          // No API Key configured
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔑</div>
            <h3 className="text-lg font-medium mb-2">API-Key erforderlich</h3>
            <p className="text-gray-600 mb-6">
              Konfiguriere deinen Gemini API-Key in den Einstellungen,
              <br />
              um AI-Visualisierungen zu erstellen.
            </p>
            <Button variant="secondary" onClick={handleClose}>
              Schliessen
            </Button>
          </div>
        ) : status === 'idle' ? (
          // Style Selection
          <div className="space-y-6">
            {/* Style Grid */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-3 block">
                Stil auswählen
              </label>
              <div className="grid grid-cols-5 gap-3">
                {STYLE_OPTIONS.map((style) => (
                  <button
                    key={style}
                    onClick={() => setVisualizationStyle(style)}
                    className={`p-4 rounded-xl border-2 text-center transition-all hover:scale-105 ${
                      visualizationStyle === style
                        ? 'border-blue-500 bg-blue-50 shadow-md'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="text-3xl mb-2">{STYLE_EMOJIS[style]}</div>
                    <div className="text-sm font-medium">{STYLE_LABELS[style]}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Style Description */}
            <div className="bg-gray-50 rounded-lg p-4 border">
              <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <span>{STYLE_EMOJIS[visualizationStyle]}</span>
                {STYLE_LABELS[visualizationStyle]}
              </h4>
              <p className="text-sm text-gray-600 leading-relaxed">
                {getStyleDescription(visualizationStyle)}
              </p>
            </div>

            {/* Info */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
              <div className="flex items-start gap-2">
                <span className="text-amber-500">💡</span>
                <div className="text-amber-800">
                  <strong>Tipp:</strong> Positioniere die Kamera so, dass der Raum
                  gut sichtbar ist. Die AI nutzt die aktuelle Ansicht als Basis.
                </div>
              </div>
            </div>
          </div>
        ) : status === 'capturing' || status === 'generating' ? (
          // Loading State
          <div className="flex flex-col items-center justify-center py-12 gap-6">
            <div className="relative">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl">
                  {status === 'capturing' ? '📸' : '🎨'}
                </span>
              </div>
            </div>
            <div className="text-center">
              <p className="text-gray-700 font-medium">{progress}</p>
              <p className="text-sm text-gray-500 mt-1">
                Dies kann bis zu 30 Sekunden dauern...
              </p>
            </div>
            {screenshot && (
              <div className="mt-4">
                <p className="text-xs text-gray-500 mb-2 text-center">Eingabebild:</p>
                <img
                  src={screenshot}
                  alt="Screenshot"
                  className="w-48 h-auto rounded-lg border shadow-sm opacity-75"
                />
              </div>
            )}
          </div>
        ) : status === 'done' && result ? (
          // Result
          <div className="space-y-4">
            <div className="relative bg-gray-100 rounded-lg overflow-hidden">
              <img
                src={result}
                alt="Generated visualization"
                className="w-full h-auto"
              />
              <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Fertig
              </div>
            </div>

            {/* Comparison if we have screenshot */}
            {screenshot && (
              <details className="group">
                <summary className="text-sm text-gray-600 cursor-pointer hover:text-gray-800">
                  Vorher/Nachher anzeigen
                </summary>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Eingabe:</p>
                    <img src={screenshot} alt="Original" className="w-full rounded border" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Ergebnis:</p>
                    <img src={result} alt="Result" className="w-full rounded border" />
                  </div>
                </div>
              </details>
            )}

            <div className="flex gap-3 justify-center pt-2">
              <Button variant="primary" onClick={handleDownload}>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download
              </Button>
              <Button variant="secondary" onClick={handleReset}>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Neu generieren
              </Button>
            </div>
          </div>
        ) : status === 'error' ? (
          // Error State
          <div className="text-center py-12">
            <div className="text-6xl mb-4">❌</div>
            <h3 className="text-lg font-medium text-red-600 mb-2">Fehler aufgetreten</h3>
            <p className="text-gray-600 mb-2 max-w-md mx-auto">{error}</p>

            {/* Helpful tips based on error */}
            <div className="bg-gray-50 rounded-lg p-4 mt-4 text-left max-w-md mx-auto">
              <p className="text-sm font-medium text-gray-700 mb-2">Mögliche Lösungen:</p>
              <ul className="text-sm text-gray-600 space-y-1">
                {error?.includes('API') && (
                  <li>• API-Key in den Einstellungen überprüfen</li>
                )}
                {error?.includes('Rate') && (
                  <li>• Warte einige Minuten und versuche es erneut</li>
                )}
                {error?.includes('image') && (
                  <li>• Das Model unterstützt möglicherweise keine Bildgenerierung</li>
                )}
                <li>• Internetverbindung prüfen</li>
                <li>• Mit kleinerem Modell oder anderem Stil versuchen</li>
              </ul>
            </div>

            <div className="flex gap-3 justify-center mt-6">
              <Button variant="secondary" onClick={handleReset}>
                Erneut versuchen
              </Button>
              <Button variant="ghost" onClick={handleClose}>
                Schliessen
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>

      <DialogFooter>
        {status === 'idle' && hasApiKey && (
          <>
            <Button variant="ghost" onClick={handleClose}>
              Abbrechen
            </Button>
            <Button variant="primary" onClick={handleGenerate}>
              <span className="mr-2">✨</span>
              Generieren
            </Button>
          </>
        )}
        {(status === 'capturing' || status === 'generating') && (
          <Button variant="ghost" onClick={handleClose} disabled>
            Bitte warten...
          </Button>
        )}
        {status === 'done' && (
          <Button variant="ghost" onClick={handleClose}>
            Schliessen
          </Button>
        )}
      </DialogFooter>
    </Dialog>
  );
}
