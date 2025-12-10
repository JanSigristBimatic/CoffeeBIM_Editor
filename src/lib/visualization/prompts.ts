/**
 * AI Visualization Prompts - Vordefinierte Stil-Prompts für Gastro-Renderings
 *
 * Struktur:
 * 1. GUARDRAILS - Was MUSS beibehalten werden
 * 2. ROOM_CONTEXT - Interpretation von Raum-Labels
 * 3. STYLE_PROMPTS - Materialien und Atmosphäre
 */

import type { VisualizationStyle } from '@/store/useSettingsStore';

// ============================================================================
// GUARDRAILS - Strikte Regeln für die Geometrie-Erhaltung
// ============================================================================

const GUARDRAILS = `
CRITICAL RULES - You MUST follow these strictly:

1. PRESERVE GEOMETRY EXACTLY:
   - Keep ALL walls, floors, and ceilings in their exact positions
   - Maintain the exact room layout and proportions
   - Keep the camera angle and perspective unchanged
   - Do NOT add, remove, or move any structural elements

2. PRESERVE EXISTING ELEMENTS:
   - Keep ALL furniture and equipment already visible in the image
   - Keep ALL stairs, columns, doors, and windows in their exact positions
   - Keep counters, bars, and built-in furniture exactly as shown
   - Only ENHANCE materials/textures on existing objects, don't replace them

3. ROOM LABELS:
   - If you see text labels like "Gastraum", "Bar", "Küche", "Lager", etc.
   - Use these to understand room function and add APPROPRIATE furniture
   - DO NOT render the text labels themselves in the output image
   - Remove any visible text overlays from the final visualization

4. ADDITIONS ALLOWED:
   - Add appropriate furniture ONLY in empty floor areas
   - Add decorative elements (plants, art, lighting fixtures)
   - Add realistic materials and textures to surfaces
   - Add atmospheric lighting and shadows
`.trim();

// ============================================================================
// ROOM CONTEXT - Wie Raum-Labels interpretiert werden sollen
// ============================================================================

const ROOM_CONTEXT = `
ROOM TYPE INTERPRETATION:
If you identify room labels or can infer room function, add appropriate items:

- "Gastraum" / "Dining" / "Sitzbereich":
  Add tables, chairs, ambient lighting, wall art, plants

- "Bar" / "Theke" / "Counter":
  Add bar stools, bottles display, coffee machines, menu boards

- "Küche" / "Kitchen" / "Prep":
  Add stainless steel equipment, shelving, prep surfaces (keep industrial)

- "Lager" / "Storage" / "Back":
  Keep minimal, add shelving with supplies, keep utilitarian look

- "Eingang" / "Entry" / "Lobby":
  Add welcome mat, coat hooks, menu display, plants

- "WC" / "Toilette" / "Restroom":
  Add mirrors, soap dispensers, hand towels, clean tiles

- "Terrasse" / "Outdoor" / "Patio":
  Add outdoor furniture, umbrellas, planters, string lights
`.trim();

// ============================================================================
// STYLE PROMPTS - Nur Materialien und Atmosphäre (keine Struktur-Änderungen)
// ============================================================================

export const STYLE_PROMPTS: Record<VisualizationStyle, string> = {
  modern: `
STYLE: Modern Minimalist
- Materials: Polished concrete floors, white walls, light oak wood accents
- Furniture style: Clean lines, contemporary design, neutral fabrics
- Lighting: Large pendant lights, natural daylight, subtle spotlights
- Colors: White, gray, black, with warm wood tones
- Atmosphere: Clean, professional, sophisticated
- Details: Sleek espresso machines, minimal decor, geometric shapes
  `.trim(),

  industrial: `
STYLE: Industrial Loft
- Materials: Exposed brick, raw concrete, weathered wood, black metal
- Furniture style: Vintage-industrial, reclaimed materials, metal frames
- Lighting: Edison bulbs, exposed conduit, hanging pendants, warm glow
- Colors: Dark browns, rusty oranges, matte black, copper accents
- Atmosphere: Raw, authentic, urban warehouse feel
- Details: Visible pipes/ducts, chalkboard menus, vintage signage
  `.trim(),

  cozy: `
STYLE: Cozy & Warm
- Materials: Warm wood throughout, soft textiles, natural fibers
- Furniture style: Comfortable, plush seating, mixed vintage pieces
- Lighting: Warm ambient, multiple sources, fairy lights, candles
- Colors: Earth tones, terracotta, forest green, cream, mustard
- Atmosphere: Inviting, homey, hygge-inspired, relaxed
- Details: Plants everywhere, books, cushions, woven textures, rugs
  `.trim(),

  minimal: `
STYLE: Scandinavian Minimal
- Materials: Light birch wood, white surfaces, natural stone
- Furniture style: Simple, functional, iconic Scandinavian design
- Lighting: Bright, airy, maximum natural light, simple fixtures
- Colors: White, pale gray, soft pastels, natural wood
- Atmosphere: Calm, serene, uncluttered, breathing room
- Details: Few carefully chosen objects, clean surfaces, subtle greenery
  `.trim(),

  luxury: `
STYLE: Luxury Lounge
- Materials: Marble, brass, velvet, polished dark wood, leather
- Furniture style: Art deco influenced, premium quality, statement pieces
- Lighting: Crystal chandeliers, brass sconces, dramatic accent lighting
- Colors: Deep emerald, navy, burgundy, gold, cream, black
- Atmosphere: Opulent, exclusive, sophisticated, glamorous
- Details: Ornate details, artwork, plush seating, champagne service
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

// ============================================================================
// PROMPT BUILDER
// ============================================================================

const BASE_PROMPT = `
You are an expert architectural visualization artist specializing in hospitality interiors.

Transform this 3D BIM model view into a photorealistic interior rendering.

${GUARDRAILS}

${ROOM_CONTEXT}

{STYLE}

OUTPUT REQUIREMENTS:
- Photorealistic quality with accurate lighting, shadows, and reflections
- Professional architectural visualization standard
- Warm, inviting atmosphere appropriate for a café/restaurant
- High resolution, sharp details, proper depth of field
- NO text labels or UI elements in the final image

Generate the photorealistic visualization now.
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
  const descriptions: Record<VisualizationStyle, string> = {
    modern: 'Klare Linien, neutrale Farben, Beton und Holz, zeitgenössisches Design',
    industrial: 'Sichtmauerwerk, Metall, Edison-Lampen, urbaner Loft-Charakter',
    cozy: 'Warme Holztöne, Pflanzen, gemütliche Sitzecken, einladende Atmosphäre',
    minimal: 'Skandinavisch hell, viel Weiss, einfache Formen, ruhige Ausstrahlung',
    luxury: 'Marmor, Messing, Samt, Art-Deco-Einflüsse, exklusives Ambiente',
  };
  return descriptions[style];
};
