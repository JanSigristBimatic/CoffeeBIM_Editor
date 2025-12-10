/**
 * Gemini API Client - Integration mit Google's Gemini für Bildgenerierung
 *
 * Alle API-Calls erfolgen direkt vom Browser (client-side).
 * Der API-Key wird nur lokal verwendet und nie an andere Server gesendet.
 */

import type { VisualizationStyle } from '@/store/useSettingsStore';
import { buildPrompt } from './prompts';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// Models that support image generation
const IMAGE_GEN_MODEL = 'gemini-2.0-flash-exp-image-generation';
const FALLBACK_MODEL = 'gemini-2.0-flash-exp';

export interface GenerationResult {
  success: boolean;
  imageUrl?: string;
  imageBlob?: Blob;
  error?: string;
  model?: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates a Gemini API key by making a simple request
 */
export const validateApiKey = async (apiKey: string): Promise<ValidationResult> => {
  if (!apiKey || apiKey.trim().length < 10) {
    return { valid: false, error: 'API-Key zu kurz' };
  }

  try {
    const response = await fetch(
      `${GEMINI_API_BASE}/${FALLBACK_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Hello, respond with just "OK"' }] }],
        }),
      }
    );

    if (response.ok) {
      return { valid: true };
    }

    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.error?.message || `HTTP ${response.status}`;

    if (response.status === 400 && errorMessage.includes('API key')) {
      return { valid: false, error: 'Ungültiger API-Key' };
    }
    if (response.status === 403) {
      return { valid: false, error: 'API-Key hat keine Berechtigung' };
    }
    if (response.status === 429) {
      return { valid: false, error: 'Rate Limit erreicht - bitte später versuchen' };
    }

    return { valid: false, error: errorMessage };
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return { valid: false, error: 'Netzwerkfehler - Internetverbindung prüfen' };
    }
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unbekannter Fehler',
    };
  }
};

/**
 * Generates a visualization using Gemini API with image generation
 */
export const generateVisualization = async (
  apiKey: string,
  screenshot: Blob,
  style: VisualizationStyle
): Promise<GenerationResult> => {
  try {
    // Convert screenshot to base64
    const base64Image = await blobToBase64(screenshot);
    const prompt = buildPrompt(style);

    // Try image generation model first
    let result = await tryGenerateWithModel(
      apiKey,
      IMAGE_GEN_MODEL,
      base64Image,
      prompt
    );

    // If that fails, try fallback model
    if (!result.success && result.error?.includes('not found')) {
      console.log('Image gen model not available, trying fallback...');
      result = await tryGenerateWithModel(
        apiKey,
        FALLBACK_MODEL,
        base64Image,
        prompt
      );
    }

    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unbekannter Fehler',
    };
  }
};

/**
 * Try generating with a specific model
 */
async function tryGenerateWithModel(
  apiKey: string,
  modelId: string,
  base64Image: string,
  prompt: string
): Promise<GenerationResult> {
  const response = await fetch(
    `${GEMINI_API_BASE}/${modelId}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: 'image/png',
                  data: base64Image,
                },
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ['image', 'text'],
          responseMimeType: 'image/png',
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    return {
      success: false,
      error: error.error?.message || `API Error: ${response.status}`,
      model: modelId,
    };
  }

  const result = await response.json();

  // Extract generated image from response
  const candidates = result.candidates || [];
  for (const candidate of candidates) {
    const parts = candidate.content?.parts || [];
    for (const part of parts) {
      if (part.inline_data?.data) {
        const imageBlob = base64ToBlob(part.inline_data.data, 'image/png');
        const imageUrl = URL.createObjectURL(imageBlob);

        return {
          success: true,
          imageUrl,
          imageBlob,
          model: modelId,
        };
      }
    }
  }

  // No image in response - might be text-only response
  const textContent = candidates[0]?.content?.parts?.[0]?.text;
  if (textContent) {
    return {
      success: false,
      error: `Model returned text instead of image: "${textContent.substring(0, 100)}..."`,
      model: modelId,
    };
  }

  return {
    success: false,
    error: 'Keine Bildgenerierung verfügbar - Model unterstützt möglicherweise keine Bilder',
    model: modelId,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert Blob to base64 string (without data URL prefix)
 */
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      // Remove "data:image/png;base64," prefix
      const base64 = dataUrl.split(',')[1] ?? '';
      if (!base64) {
        reject(new Error('Failed to extract base64 from data URL'));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to read blob'));
    reader.readAsDataURL(blob);
  });
};

/**
 * Convert base64 string to Blob
 */
const base64ToBlob = (base64: string, mimeType: string): Blob => {
  const bytes = atob(base64);
  const buffer = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    buffer[i] = bytes.charCodeAt(i);
  }
  return new Blob([buffer], { type: mimeType });
};

/**
 * Revoke a previously created object URL to free memory
 */
export const revokeImageUrl = (url: string): void => {
  if (url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
};
