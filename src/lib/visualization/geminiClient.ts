/**
 * Gemini API Client - Integration mit Google's Gemini für Bildgenerierung
 *
 * Verwendet das offizielle @google/genai SDK für zuverlässige API-Calls.
 * Alle API-Calls erfolgen direkt vom Browser (client-side).
 * Der API-Key wird nur lokal verwendet und nie an andere Server gesendet.
 */

import { GoogleGenAI } from '@google/genai';
import type { VisualizationStyle } from '@/store/useSettingsStore';
import { buildPrompt } from './prompts';

// Model für Bildgenerierung (Nano Banana)
const IMAGE_MODEL = 'gemini-2.5-flash-preview-04-17';

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
 * Validates a Gemini API key by listing available models
 * This is a lightweight call that doesn't consume generation quota
 */
export const validateApiKey = async (apiKey: string): Promise<ValidationResult> => {
  if (!apiKey || apiKey.trim().length < 10) {
    return { valid: false, error: 'API-Key zu kurz' };
  }

  try {
    // Use models.list endpoint - much lighter than generateContent
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
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
    if (response.status === 401 || response.status === 403) {
      return { valid: false, error: 'Ungültiger API-Key oder keine Berechtigung' };
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
 * Uses the official @google/genai SDK
 */
export const generateVisualization = async (
  apiKey: string,
  screenshot: Blob,
  style: VisualizationStyle
): Promise<GenerationResult> => {
  try {
    // Initialize the SDK with the user's API key
    const ai = new GoogleGenAI({ apiKey });

    // Convert screenshot to base64
    const base64Image = await blobToBase64(screenshot);
    const prompt = buildPrompt(style);

    // Build the full prompt for photorealistic rendering
    const fullPrompt = `Create a high-quality, photorealistic visualization of this 3D BIM model view. Maintain the exact camera angle, perspective, and building structure. ${prompt}`;

    // Call the API using the SDK
    const response = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Image,
              mimeType: 'image/png',
            },
          },
          {
            text: fullPrompt,
          },
        ],
      },
    });

    // Extract image from response
    if (response.candidates && response.candidates[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData?.data) {
          const imageBlob = base64ToBlob(part.inlineData.data, 'image/png');
          const imageUrl = URL.createObjectURL(imageBlob);

          return {
            success: true,
            imageUrl,
            imageBlob,
            model: IMAGE_MODEL,
          };
        }
      }
    }

    // Check if we got text instead of image
    const textContent = response.candidates?.[0]?.content?.parts?.[0]?.text;
    if (textContent) {
      return {
        success: false,
        error: `Model gab Text statt Bild zurück. Versuche es mit einem anderen Stil.`,
        model: IMAGE_MODEL,
      };
    }

    return {
      success: false,
      error: 'Keine Bildgenerierung in der Antwort',
      model: IMAGE_MODEL,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';

    // Handle specific error cases
    if (errorMessage.includes('429') || errorMessage.includes('quota')) {
      return {
        success: false,
        error: 'Rate Limit erreicht - bitte warte kurz und versuche es erneut',
      };
    }
    if (errorMessage.includes('API key')) {
      return {
        success: false,
        error: 'API-Key ungültig oder abgelaufen',
      };
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
};

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
