import { useMemo } from 'react';
import { MeshBasicMaterial, LineBasicMaterial, Color } from 'three';

// Standard preview colors
export const PREVIEW_COLORS = {
  valid: '#4ade80', // Green
  invalid: '#ef4444', // Red
  neutral: '#60a5fa', // Blue
  warning: '#fbbf24', // Yellow
} as const;

export type PreviewColorType = keyof typeof PREVIEW_COLORS;

interface UsePreviewMaterialOptions {
  /** Whether the current state is valid */
  isValid?: boolean;
  /** Opacity (default 0.6) */
  opacity?: number;
  /** Custom color override */
  color?: string;
  /** Whether to disable depth testing (default true for previews) */
  depthTest?: boolean;
}

/**
 * Hook to create a preview material that changes color based on validity
 * Always visible through other geometry (depthTest: false)
 */
export function usePreviewMaterial({
  isValid = true,
  opacity = 0.6,
  color,
  depthTest = false,
}: UsePreviewMaterialOptions = {}) {
  return useMemo(() => {
    const materialColor = color ?? (isValid ? PREVIEW_COLORS.valid : PREVIEW_COLORS.invalid);
    return new MeshBasicMaterial({
      color: materialColor,
      transparent: true,
      opacity,
      depthTest,
    });
  }, [isValid, opacity, color, depthTest]);
}

/**
 * Hook to create a line material for preview outlines
 */
export function usePreviewLineMaterial({
  isValid = true,
  color,
  depthTest = false,
}: Omit<UsePreviewMaterialOptions, 'opacity'> = {}) {
  return useMemo(() => {
    const materialColor = color ?? (isValid ? PREVIEW_COLORS.valid : PREVIEW_COLORS.invalid);
    return new LineBasicMaterial({
      color: materialColor,
      depthTest,
    });
  }, [isValid, color, depthTest]);
}

/**
 * Get the appropriate preview color based on state
 */
export function getPreviewColor(isValid: boolean): string {
  return isValid ? PREVIEW_COLORS.valid : PREVIEW_COLORS.invalid;
}

/**
 * Create a Three.js Color from preview color type
 */
export function createPreviewColor(type: PreviewColorType): Color {
  return new Color(PREVIEW_COLORS[type]);
}
