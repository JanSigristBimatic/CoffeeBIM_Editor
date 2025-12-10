/**
 * AI Visualization Prompts - Vordefinierte Stil-Prompts für Gastro-Renderings
 */

import type { VisualizationStyle } from '@/store/useSettingsStore';

export const STYLE_PROMPTS: Record<VisualizationStyle, string> = {
  modern: `
    Modern minimalist coffee bar interior. Clean lines, neutral colors
    (white, gray, black), concrete and wood materials, pendant lighting,
    large windows with natural light, contemporary furniture,
    professional espresso machines, clean counters.
  `.trim(),

  industrial: `
    Industrial coffee bar interior. Exposed brick walls, metal pipes and
    ductwork visible, Edison bulb lighting, reclaimed wood surfaces,
    vintage furniture, dark color palette with warm copper accents,
    raw concrete floors, metal bar stools.
  `.trim(),

  cozy: `
    Cozy and warm coffee shop interior. Soft warm lighting from multiple
    sources, comfortable upholstered seating, indoor plants and greenery,
    warm wood tones throughout, textured fabrics and cushions,
    inviting atmosphere, bohemian decorative touches, book shelves.
  `.trim(),

  minimal: `
    Ultra-minimal Scandinavian coffee bar. Bright white walls, light
    natural wood furniture, simple clean lines, lots of negative space,
    subtle natural elements, calm and serene atmosphere,
    muted pastel accents, geometric simplicity.
  `.trim(),

  luxury: `
    High-end luxury coffee lounge. Polished marble surfaces and floors,
    brass and gold metal accents, deep velvet upholstery in rich colors,
    art deco geometric patterns, crystal chandelier lighting,
    premium leather seating, sophisticated dark wood paneling.
  `.trim(),
};

export const STYLE_LABELS: Record<VisualizationStyle, string> = {
  modern: 'Modern',
  industrial: 'Industrial',
  cozy: 'Gemütlich',
  minimal: 'Minimal',
  luxury: 'Luxus',
};

export const STYLE_EMOJIS: Record<VisualizationStyle, string> = {
  modern: '🏢',
  industrial: '🏭',
  cozy: '🛋️',
  minimal: '⬜',
  luxury: '✨',
};

const BASE_PROMPT = `
You are an expert architectural visualization artist. Transform this 3D model
or floor plan image into a photorealistic interior rendering.

The image shows a cafe, coffee bar, or restaurant layout. Generate a stunning
photorealistic visualization that brings this space to life.

Style direction:
{STYLE}

Requirements:
- Photorealistic quality with accurate lighting, shadows, and reflections
- Maintain the exact spatial layout and proportions from the input image
- Add realistic furniture, fixtures, equipment, and decor appropriate to the style
- Include realistic materials and textures (wood, metal, fabric, etc.)
- Professional architectural visualization quality
- Proper perspective and depth of field
- Ambient lighting appropriate for a welcoming cafe atmosphere

Generate the image now.
`.trim();

/**
 * Builds a complete prompt for the given visualization style
 */
export const buildPrompt = (style: VisualizationStyle): string => {
  return BASE_PROMPT.replace('{STYLE}', STYLE_PROMPTS[style]);
};

/**
 * Short description for UI display
 */
export const getStyleDescription = (style: VisualizationStyle): string => {
  return STYLE_PROMPTS[style];
};
