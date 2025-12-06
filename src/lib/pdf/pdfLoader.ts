import * as pdfjsLib from 'pdfjs-dist';
import type { PdfDocument } from '@/types/pdf';

// Configure PDF.js worker - use local worker bundled by Vite
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/**
 * Render scale for PDF (higher = better quality, more memory)
 */
const RENDER_SCALE = 2.0;

/**
 * Load a PDF file and render the first page to an image
 */
export async function loadPdfFile(file: File): Promise<PdfDocument> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pageNumber = 1;
  const page = await pdfDoc.getPage(pageNumber);

  // Get page dimensions at render scale
  const viewport = page.getViewport({ scale: RENDER_SCALE });

  // Create canvas for rendering
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Could not get 2D context from canvas');
  }

  // Render PDF page to canvas
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await page.render({
    canvasContext: context,
    viewport: viewport,
  } as any).promise;

  // Convert to data URL
  const imageDataUrl = canvas.toDataURL('image/png');

  return {
    fileName: file.name,
    pageNumber,
    totalPages: pdfDoc.numPages,
    width: viewport.width,
    height: viewport.height,
    imageDataUrl,
  };
}

/**
 * Load a specific page from an already loaded PDF
 */
export async function loadPdfPage(
  file: File,
  pageNumber: number
): Promise<PdfDocument> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  if (pageNumber < 1 || pageNumber > pdfDoc.numPages) {
    throw new Error(`Invalid page number: ${pageNumber}`);
  }

  const page = await pdfDoc.getPage(pageNumber);
  const viewport = page.getViewport({ scale: RENDER_SCALE });

  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Could not get 2D context from canvas');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await page.render({
    canvasContext: context,
    viewport: viewport,
  } as any).promise;

  const imageDataUrl = canvas.toDataURL('image/png');

  return {
    fileName: file.name,
    pageNumber,
    totalPages: pdfDoc.numPages,
    width: viewport.width,
    height: viewport.height,
    imageDataUrl,
  };
}
