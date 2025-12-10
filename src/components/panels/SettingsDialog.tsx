/**
 * Settings Dialog - Konfiguration für API-Keys und Einstellungen
 *
 * Ermöglicht Benutzern, ihren eigenen Gemini API-Key einzugeben.
 * Der Key wird nur lokal im Browser gespeichert.
 */

import { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogContent,
  DialogFooter,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { useSettingsStore } from '@/store';
import { validateApiKey, type ValidationResult } from '@/lib/visualization';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const {
    geminiApiKey,
    isKeyValidated,
    setGeminiApiKey,
    setKeyValidated,
    clearSettings,
  } = useSettingsStore();

  const [keyInput, setKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  // Sync input with stored key when dialog opens
  useEffect(() => {
    if (open) {
      setKeyInput(geminiApiKey || '');
      setValidationResult(null);
    }
  }, [open, geminiApiKey]);

  const handleValidate = useCallback(async () => {
    const trimmedKey = keyInput.trim();
    if (!trimmedKey) {
      setValidationResult({ valid: false, error: 'Bitte API-Key eingeben' });
      return;
    }

    setIsValidating(true);
    setValidationResult(null);

    const result = await validateApiKey(trimmedKey);

    setIsValidating(false);
    setValidationResult(result);

    if (result.valid) {
      setGeminiApiKey(trimmedKey);
      setKeyValidated(true);
    } else {
      setKeyValidated(false);
    }
  }, [keyInput, setGeminiApiKey, setKeyValidated]);

  const handleClear = useCallback(() => {
    setKeyInput('');
    clearSettings();
    setValidationResult(null);
  }, [clearSettings]);

  return (
    <Dialog open={open} onClose={onClose} size="md">
      <DialogHeader>
        <DialogTitle>Einstellungen</DialogTitle>
        <DialogDescription>
          API-Schlüssel für AI-Visualisierung konfigurieren
        </DialogDescription>
      </DialogHeader>

      <DialogContent>
        <div className="space-y-4">
          {/* API Key Section */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Google Gemini API Key
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={keyInput}
                  onChange={(e) => {
                    setKeyInput(e.target.value);
                    setValidationResult(null);
                  }}
                  placeholder="AIza..."
                  className="w-full px-3 py-2 pr-10 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                  title={showKey ? 'Verstecken' : 'Anzeigen'}
                >
                  {showKey ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              <Button
                variant="secondary"
                onClick={handleValidate}
                disabled={isValidating || !keyInput.trim()}
              >
                {isValidating ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Prüfe...
                  </span>
                ) : (
                  'Prüfen'
                )}
              </Button>
            </div>

            {/* Validation Status */}
            {validationResult?.valid && (
              <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-2 rounded">
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                API-Key gültig und gespeichert
              </div>
            )}

            {validationResult && !validationResult.valid && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                {validationResult.error}
              </div>
            )}

            {/* Stored key indicator */}
            {isKeyValidated && geminiApiKey && !validationResult && (
              <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 p-2 rounded">
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
                API-Key gespeichert
              </div>
            )}
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <h4 className="text-sm font-medium text-blue-800 mb-1 flex items-center gap-2">
              <span>🔑</span> API-Key erhalten
            </h4>
            <p className="text-sm text-blue-700">
              Erstelle einen kostenlosen API-Key bei{' '}
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-medium hover:text-blue-900"
              >
                Google AI Studio
              </a>
            </p>
          </div>

          {/* Privacy Notice */}
          <div className="bg-gray-50 border rounded-lg p-3">
            <h4 className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
              <span>🔒</span> Datenschutz
            </h4>
            <ul className="text-xs text-gray-600 space-y-1">
              <li className="flex items-start gap-2">
                <span className="text-gray-400">•</span>
                <span>Key wird nur lokal in deinem Browser gespeichert (IndexedDB)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-400">•</span>
                <span>Direkte Kommunikation mit Google API - kein Zwischenserver</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-400">•</span>
                <span>Key wird nie an Dritte übermittelt</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-400">•</span>
                <span>Du nutzt dein eigenes API-Kontingent</span>
              </li>
            </ul>
          </div>

          {/* Clear Button */}
          {geminiApiKey && (
            <div className="pt-2 border-t">
              <Button
                variant="ghost"
                onClick={handleClear}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                API-Key entfernen
              </Button>
            </div>
          )}
        </div>
      </DialogContent>

      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Schliessen
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
