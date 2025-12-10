/**
 * AI Visualization Module
 *
 * Ermöglicht fotorealistische Renderings des 3D-Modells
 * mit Google Gemini API (user-provided API key).
 */

export {
  captureCanvas,
  captureCanvasElement,
  type ScreenshotOptions,
  type ScreenshotResult,
} from './screenshotService';

export {
  validateApiKey,
  generateVisualization,
  revokeImageUrl,
  type GenerationResult,
  type ValidationResult,
} from './geminiClient';

export {
  buildPrompt,
  getStyleDescription,
  STYLE_PROMPTS,
  STYLE_LABELS,
  STYLE_EMOJIS,
} from './prompts';
