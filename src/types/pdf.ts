/**
 * PDF Underlay types for tracing floor plans
 */

/**
 * Point in PDF coordinate space (pixels from top-left)
 */
export interface PdfPoint {
  x: number;
  y: number;
}

/**
 * Calibration steps for PDF alignment
 */
export type CalibrationStep = 'upload' | 'origin' | 'rotation' | 'scale' | 'complete';

/**
 * Calibration data for transforming PDF to world coordinates
 */
export interface PdfCalibration {
  /** Origin point in PDF pixels - becomes (0,0) in world */
  originPdfPoint: PdfPoint | null;

  /** Second point for rotation - defines X+ direction from origin */
  rotationPdfPoint: PdfPoint | null;

  /** First point for scale measurement */
  scalePoint1: PdfPoint | null;

  /** Second point for scale measurement */
  scalePoint2: PdfPoint | null;

  /** Real-world distance between scale points (meters) */
  realWorldDistance: number;

  /** Calculated scale factor (meters per pixel) */
  metersPerPixel: number;

  /** Calculated rotation angle (radians) */
  rotationAngle: number;
}

/**
 * PDF document state
 */
export interface PdfDocument {
  /** Original file name */
  fileName: string;

  /** PDF page number (1-indexed) */
  pageNumber: number;

  /** Total pages in PDF */
  totalPages: number;

  /** Rendered width in pixels */
  width: number;

  /** Rendered height in pixels */
  height: number;

  /** Base64 or Object URL of rendered image */
  imageDataUrl: string;
}

/**
 * Complete PDF underlay state
 */
export interface PdfUnderlayState {
  /** Whether a PDF is loaded */
  isLoaded: boolean;

  /** PDF document data */
  document: PdfDocument | null;

  /** Calibration data */
  calibration: PdfCalibration;

  /** Current calibration step */
  calibrationStep: CalibrationStep;

  /** Whether underlay is visible in 3D view */
  isVisible: boolean;

  /** Opacity of the underlay (0-1) */
  opacity: number;
}

/**
 * Default calibration values
 */
export const DEFAULT_CALIBRATION: PdfCalibration = {
  originPdfPoint: null,
  rotationPdfPoint: null,
  scalePoint1: null,
  scalePoint2: null,
  realWorldDistance: 1.0,
  metersPerPixel: 0.01, // Default: 1 pixel = 1 cm
  rotationAngle: 0,
};

/**
 * Default PDF underlay state
 */
export const DEFAULT_PDF_UNDERLAY_STATE: PdfUnderlayState = {
  isLoaded: false,
  document: null,
  calibration: DEFAULT_CALIBRATION,
  calibrationStep: 'upload',
  isVisible: true,
  opacity: 0.5,
};
