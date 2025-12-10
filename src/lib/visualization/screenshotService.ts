/**
 * Screenshot Service - Erfasst den 3D-Canvas als Bild
 *
 * Rendert die aktuelle Szene in ein Offscreen-Target und
 * exportiert es als PNG/JPEG Blob.
 */

import * as THREE from 'three';

export interface ScreenshotOptions {
  width: number;
  height: number;
  transparent?: boolean;
  format?: 'png' | 'jpeg';
}

export interface ScreenshotResult {
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Captures the current 3D canvas as an image
 */
export const captureCanvas = async (
  gl: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  options: ScreenshotOptions
): Promise<ScreenshotResult> => {
  const { width, height, transparent = false, format = 'png' } = options;

  // Create offscreen render target
  const renderTarget = new THREE.WebGLRenderTarget(width, height, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
  });

  // Store original settings
  const originalTarget = gl.getRenderTarget();
  const originalSize = new THREE.Vector2();
  gl.getSize(originalSize);

  try {
    // Render to offscreen target
    gl.setRenderTarget(renderTarget);
    gl.setSize(width, height);
    gl.render(scene, camera);

    // Read pixels
    const pixels = new Uint8Array(width * height * 4);
    gl.readRenderTargetPixels(renderTarget, 0, 0, width, height, pixels);

    // Create canvas and flip Y (WebGL renders upside down)
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    const imageData = ctx.createImageData(width, height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const srcIdx = ((height - y - 1) * width + x) * 4;
        const dstIdx = (y * width + x) * 4;
        imageData.data[dstIdx] = pixels[srcIdx] ?? 0;
        imageData.data[dstIdx + 1] = pixels[srcIdx + 1] ?? 0;
        imageData.data[dstIdx + 2] = pixels[srcIdx + 2] ?? 0;
        imageData.data[dstIdx + 3] = transparent ? (pixels[srcIdx + 3] ?? 255) : 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);

    // Convert to blob
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Failed to create blob'))),
        `image/${format}`,
        0.95
      );
    });

    return {
      blob,
      dataUrl: canvas.toDataURL(`image/${format}`, 0.95),
      width,
      height,
    };
  } finally {
    // Restore original settings
    gl.setRenderTarget(originalTarget);
    gl.setSize(originalSize.x, originalSize.y);
    renderTarget.dispose();
  }
};

/**
 * Alternative: Capture directly from canvas element (simpler but less control)
 */
export const captureCanvasElement = async (
  canvasElement: HTMLCanvasElement,
  options?: { format?: 'png' | 'jpeg'; quality?: number }
): Promise<ScreenshotResult> => {
  const format = options?.format || 'png';
  const quality = options?.quality || 0.95;

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvasElement.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Failed to create blob'))),
      `image/${format}`,
      quality
    );
  });

  return {
    blob,
    dataUrl: canvasElement.toDataURL(`image/${format}`, quality),
    width: canvasElement.width,
    height: canvasElement.height,
  };
};
