import { useCallback } from 'react';
import { useToolStore } from '@/store/useToolStore';
import { useViewStore } from '@/store/useViewStore';
import type { Point2D, Vector2D } from '@/types/geometry';

/**
 * Normalize a 2D vector to unit length
 */
const normalizeVector = (v: Vector2D): Vector2D => {
  const length = Math.sqrt(v.x * v.x + v.y * v.y);
  if (length === 0) return { x: 1, y: 0 };
  return { x: v.x / length, y: v.y / length };
};

/**
 * Calculate direction vector from start to cursor
 * In orthogonal mode, constrain to horizontal or vertical
 */
const calculateDirection = (
  startPoint: Point2D,
  cursorPoint: Point2D,
  isOrthogonal: boolean
): Vector2D => {
  const dx = cursorPoint.x - startPoint.x;
  const dy = cursorPoint.y - startPoint.y;

  if (isOrthogonal) {
    // Constrain to the dominant axis
    if (Math.abs(dx) >= Math.abs(dy)) {
      // Horizontal
      return { x: dx >= 0 ? 1 : -1, y: 0 };
    } else {
      // Vertical
      return { x: 0, y: dy >= 0 ? 1 : -1 };
    }
  }

  // Free direction: normalize vector from start to cursor
  return normalizeVector({ x: dx, y: dy });
};

/**
 * Hook for handling distance input during line-based element placement
 * Allows users to type exact distances instead of clicking
 */
export const useDistanceInput = () => {
  const {
    distanceInput,
    updateDistanceInputValue,
    setDistanceDirection,
    setDistanceReferencePoint,
    appendDistanceInputDigit,
    clearDistanceInput,
    getDistanceTargetPoint,
  } = useToolStore();

  const { snapSettings } = useViewStore();

  /**
   * Update the direction based on cursor position
   * Called during pointer move
   */
  const updateDirection = useCallback(
    (startPoint: Point2D, cursorPoint: Point2D) => {
      const direction = calculateDirection(
        startPoint,
        cursorPoint,
        snapSettings.orthogonal
      );
      setDistanceDirection(direction);
    },
    [snapSettings.orthogonal, setDistanceDirection]
  );

  /**
   * Initialize distance input with a reference point (start point)
   */
  const initializeDistanceInput = useCallback(
    (referencePoint: Point2D) => {
      setDistanceReferencePoint(referencePoint);
      // Default direction (right/positive X) until cursor moves
      setDistanceDirection({ x: 1, y: 0 });
    },
    [setDistanceReferencePoint, setDistanceDirection]
  );

  /**
   * Handle keyboard input for distance entry
   * Returns true if the key was handled
   */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent): { handled: boolean; confirmed: boolean; cancelled: boolean } => {
      // Only process if we have a reference point (start point is set)
      if (!distanceInput.referencePoint) {
        return { handled: false, confirmed: false, cancelled: false };
      }

      // Numeric input (0-9)
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        appendDistanceInputDigit(e.key);
        return { handled: true, confirmed: false, cancelled: false };
      }

      // Decimal point (. or ,)
      if (e.key === '.' || e.key === ',') {
        e.preventDefault();
        appendDistanceInputDigit('.');
        return { handled: true, confirmed: false, cancelled: false };
      }

      // Backspace - delete last character
      if (e.key === 'Backspace' && distanceInput.active) {
        e.preventDefault();
        const newValue = distanceInput.value.slice(0, -1);
        updateDistanceInputValue(newValue);
        return { handled: true, confirmed: false, cancelled: false };
      }

      // Enter - confirm distance input
      if (e.key === 'Enter' && distanceInput.active && distanceInput.value) {
        e.preventDefault();
        const targetPoint = getDistanceTargetPoint();
        if (targetPoint) {
          return { handled: true, confirmed: true, cancelled: false };
        }
        return { handled: true, confirmed: false, cancelled: false };
      }

      // Escape - cancel distance input (but not the whole operation)
      if (e.key === 'Escape' && distanceInput.active) {
        e.preventDefault();
        clearDistanceInput();
        return { handled: true, confirmed: false, cancelled: true };
      }

      return { handled: false, confirmed: false, cancelled: false };
    },
    [
      distanceInput,
      appendDistanceInputDigit,
      updateDistanceInputValue,
      getDistanceTargetPoint,
      clearDistanceInput,
    ]
  );

  /**
   * Get the preview end point based on distance input or null if not active
   */
  const getPreviewEndPoint = useCallback((): Point2D | null => {
    if (!distanceInput.active || !distanceInput.value) {
      return null;
    }
    return getDistanceTargetPoint();
  }, [distanceInput.active, distanceInput.value, getDistanceTargetPoint]);

  /**
   * Parse the current distance value
   */
  const getDistance = useCallback((): number | null => {
    if (!distanceInput.value) return null;
    const distance = parseFloat(distanceInput.value);
    return isNaN(distance) || distance <= 0 ? null : distance;
  }, [distanceInput.value]);

  return {
    // State
    isActive: distanceInput.active,
    inputValue: distanceInput.value,
    direction: distanceInput.direction,
    referencePoint: distanceInput.referencePoint,

    // Actions
    initializeDistanceInput,
    updateDirection,
    handleKeyDown,
    clearDistanceInput,

    // Computed
    getPreviewEndPoint,
    getDistance,
    getDistanceTargetPoint,
  };
};
