import { create } from 'zustand';
import type {
  PdfDocument,
  PdfCalibration,
  CalibrationStep,
  PdfPoint,
} from '@/types/pdf';
import { DEFAULT_CALIBRATION } from '@/types/pdf';

interface PdfUnderlayState {
  // Document state
  isLoaded: boolean;
  document: PdfDocument | null;

  // Calibration
  calibration: PdfCalibration;
  calibrationStep: CalibrationStep;

  // Display
  isVisible: boolean;
  opacity: number;
}

interface PdfUnderlayActions {
  // Document actions
  loadDocument: (doc: PdfDocument) => void;
  clearDocument: () => void;
  setPage: (pageNumber: number) => void;

  // Calibration actions
  setCalibrationStep: (step: CalibrationStep) => void;
  setOriginPoint: (point: PdfPoint) => void;
  setRotationPoint: (point: PdfPoint) => void;
  setRotationAngle: (angleDegrees: number) => void;
  setScalePoint1: (point: PdfPoint) => void;
  setScalePoint2: (point: PdfPoint) => void;
  setRealWorldDistance: (distance: number) => void;
  calculateCalibration: () => void;
  resetCalibration: () => void;

  // Display actions
  setVisible: (visible: boolean) => void;
  toggleVisible: () => void;
  setOpacity: (opacity: number) => void;
}

/**
 * Calculate distance between two PDF points in pixels
 */
const pdfDistance = (p1: PdfPoint, p2: PdfPoint): number => {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
};

/**
 * Calculate angle from origin to rotation point
 */
const calculateAngle = (origin: PdfPoint, rotationPoint: PdfPoint): number => {
  // In PDF coords, Y increases downward, so we negate the Y difference
  const dx = rotationPoint.x - origin.x;
  const dy = -(rotationPoint.y - origin.y); // Flip Y for world coords
  return Math.atan2(dy, dx);
};

export const usePdfUnderlayStore = create<PdfUnderlayState & PdfUnderlayActions>(
  (set, get) => ({
    // Initial state
    isLoaded: false,
    document: null,
    calibration: { ...DEFAULT_CALIBRATION },
    calibrationStep: 'upload',
    isVisible: true,
    opacity: 0.5,

    // Document actions
    loadDocument: (doc) =>
      set({
        isLoaded: true,
        document: doc,
        calibrationStep: 'origin',
        calibration: { ...DEFAULT_CALIBRATION },
      }),

    clearDocument: () =>
      set({
        isLoaded: false,
        document: null,
        calibration: { ...DEFAULT_CALIBRATION },
        calibrationStep: 'upload',
      }),

    setPage: (pageNumber) =>
      set((state) => ({
        document: state.document
          ? { ...state.document, pageNumber }
          : null,
      })),

    // Calibration actions
    setCalibrationStep: (step) => set({ calibrationStep: step }),

    setOriginPoint: (point) =>
      set((state) => ({
        calibration: { ...state.calibration, originPdfPoint: point },
        calibrationStep: 'rotation',
      })),

    setRotationPoint: (point) =>
      set((state) => {
        const { originPdfPoint } = state.calibration;
        // Calculate angle immediately when rotation point is set
        const rotationAngle = originPdfPoint
          ? calculateAngle(originPdfPoint, point)
          : 0;
        return {
          calibration: {
            ...state.calibration,
            rotationPdfPoint: point,
            rotationAngle,
          },
          calibrationStep: 'scale',
        };
      }),

    setRotationAngle: (angleDegrees) =>
      set((state) => ({
        calibration: {
          ...state.calibration,
          rotationAngle: (angleDegrees * Math.PI) / 180,
        },
      })),

    setScalePoint1: (point) =>
      set((state) => ({
        calibration: { ...state.calibration, scalePoint1: point },
      })),

    setScalePoint2: (point) =>
      set((state) => ({
        calibration: { ...state.calibration, scalePoint2: point },
      })),

    setRealWorldDistance: (distance) =>
      set((state) => ({
        calibration: { ...state.calibration, realWorldDistance: distance },
      })),

    calculateCalibration: () => {
      const { calibration } = get();
      const { originPdfPoint, rotationPdfPoint, scalePoint1, scalePoint2, realWorldDistance } =
        calibration;

      if (!originPdfPoint || !rotationPdfPoint || !scalePoint1 || !scalePoint2) {
        return;
      }

      // Calculate rotation angle
      const rotationAngle = calculateAngle(originPdfPoint, rotationPdfPoint);

      // Calculate scale (meters per pixel)
      const pixelDistance = pdfDistance(scalePoint1, scalePoint2);
      const metersPerPixel = pixelDistance > 0 ? realWorldDistance / pixelDistance : 0.01;

      set({
        calibration: {
          ...calibration,
          rotationAngle,
          metersPerPixel,
        },
        calibrationStep: 'complete',
      });
    },

    resetCalibration: () =>
      set({
        calibration: { ...DEFAULT_CALIBRATION },
        calibrationStep: 'origin',
      }),

    // Display actions
    setVisible: (visible) => set({ isVisible: visible }),

    toggleVisible: () => set((state) => ({ isVisible: !state.isVisible })),

    setOpacity: (opacity) => set({ opacity: Math.max(0, Math.min(1, opacity)) }),
  })
);

/**
 * Transform a PDF point to world coordinates using calibration
 */
export const pdfToWorld = (
  pdfPoint: PdfPoint,
  calibration: PdfCalibration
): { x: number; y: number } => {
  if (!calibration.originPdfPoint) {
    return { x: 0, y: 0 };
  }

  // Translate to origin
  const dx = pdfPoint.x - calibration.originPdfPoint.x;
  const dy = -(pdfPoint.y - calibration.originPdfPoint.y); // Flip Y

  // Apply rotation
  const cos = Math.cos(-calibration.rotationAngle);
  const sin = Math.sin(-calibration.rotationAngle);
  const rotatedX = dx * cos - dy * sin;
  const rotatedY = dx * sin + dy * cos;

  // Apply scale
  return {
    x: rotatedX * calibration.metersPerPixel,
    y: rotatedY * calibration.metersPerPixel,
  };
};
