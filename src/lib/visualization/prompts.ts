/**
 * AI Visualization Prompts - Optimiert für Geometrie-Erhaltung
 */

import type { VisualizationStyle } from '@/store/useSettingsStore';

// ============================================================================
// STYLE PROMPTS - Nur Materialien und Atmosphäre
// ============================================================================

export const STYLE_PROMPTS: Record<VisualizationStyle, string> = {
  modern: 'polished concrete, white walls, oak wood, pendant lights, neutral colors',
  industrial: 'exposed brick, black metal, Edison bulbs, copper accents, raw concrete',
  cozy: 'warm wood, soft textiles, plants, earth tones, fairy lights, cushions',
  minimal: 'white surfaces, birch wood, natural light, pale colors, simple forms',
  luxury: 'marble, brass, velvet, dark wood, chandeliers, emerald and gold',
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

/**
 * Builds a complete prompt for the given visualization style
 * Short, direct, with constraints repeated at end
 */
export const buildPrompt = (style: VisualizationStyle): string => {
  return `
TASK: Transform this 3D floor plan into a photorealistic interior visualization.

STRICT RULES:
- KEEP exact wall positions, room shapes, and layout
- KEEP all existing furniture, stairs, columns, counters, doors, windows
- KEEP the same camera angle and perspective
- REMOVE any text labels (like "Gastraum", "Bar", "Küche") from the image
- Only ADD furniture in EMPTY floor areas based on room function

ROOM FUNCTIONS (add appropriate furniture):
- Gastraum/Dining: tables, chairs, ambient lighting
- Bar/Theke: bar stools, bottles, coffee machines
- Küche/Kitchen: stainless steel equipment
- Lager/Storage: shelving, utilitarian
- Eingang/Entry: welcome area, plants

STYLE: ${STYLE_PROMPTS[style]}

Apply materials and lighting to create a warm, inviting café atmosphere.

REMEMBER: Do NOT change the room geometry or move existing elements. Only enhance materials and add furniture in empty spaces.
`.trim();
};

/**
 * Short description for UI display
 */
export const getStyleDescription = (style: VisualizationStyle): string => {
  const descriptions: Record<VisualizationStyle, string> = {
    modern: 'Klare Linien, neutrale Farben, Beton und Holz, zeitgenössisches Design',
    industrial: 'Sichtmauerwerk, Metall, Edison-Lampen, urbaner Loft-Charakter',
    cozy: 'Warme Holztöne, Pflanzen, gemütliche Sitzecken, einladende Atmosphäre',
    minimal: 'Skandinavisch hell, viel Weiss, einfache Formen, ruhige Ausstrahlung',
    luxury: 'Marmor, Messing, Samt, Art-Deco-Einflüsse, exklusives Ambiente',
  };
  return descriptions[style];
};
