import { useMemo } from 'react';
import * as THREE from 'three';
import { usePdfUnderlayStore } from '@/store';

/**
 * Renders the calibrated PDF as a plane on the ground (Z=0)
 * The PDF is transformed based on calibration:
 * - Origin point becomes (0,0) in world
 * - Rotation aligns X-axis with the defined direction
 * - Scale converts PDF pixels to meters
 */
export function PdfUnderlay() {
  const { isLoaded, document, calibration, calibrationStep, isVisible, opacity } = usePdfUnderlayStore();

  // Load texture from data URL
  const texture = useMemo(() => {
    if (!document?.imageDataUrl) return null;

    const loader = new THREE.TextureLoader();
    const tex = loader.load(document.imageDataUrl);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    // Don't flip Y - the canvas renders PDF correctly, Three.js default flip would invert it
    tex.flipY = false;
    return tex;
  }, [document?.imageDataUrl]);

  // Calculate plane geometry and position based on calibration
  const { position, rotation, size } = useMemo(() => {
    if (!document || !calibration.originPdfPoint) {
      return {
        position: new THREE.Vector3(0, 0, 0),
        rotation: 0,
        size: { width: 10, height: 10 },
      };
    }

    const { originPdfPoint, rotationAngle, metersPerPixel } = calibration;

    // Size in world units (meters)
    const width = document.width * metersPerPixel;
    const height = document.height * metersPerPixel;

    // Origin offset in world units
    // The origin point in PDF coords becomes (0,0) in world
    const originOffsetX = originPdfPoint.x * metersPerPixel;
    const originOffsetY = (document.height - originPdfPoint.y) * metersPerPixel;

    // Calculate position so that the origin point is at world (0,0)
    // The plane center needs to be offset
    const planeCenterX = width / 2 - originOffsetX;
    const planeCenterY = height / 2 - originOffsetY;

    // Apply rotation around the Z axis (vertical) for XY ground plane (Z-up)
    const cos = Math.cos(-rotationAngle);
    const sin = Math.sin(-rotationAngle);
    // Rotate position around Z axis (XY plane)
    const rotatedX = planeCenterX * cos - planeCenterY * sin;
    const rotatedY = planeCenterX * sin + planeCenterY * cos;

    return {
      // Z-up coordinate system: X = right, Y = forward, Z = up
      // Place slightly below ground (Z = -0.001)
      position: new THREE.Vector3(rotatedX, rotatedY, -0.001),
      rotation: rotationAngle,
      size: { width, height },
    };
  }, [document, calibration]);

  // Don't render if not loaded or not visible
  if (!isLoaded || !document || !isVisible || !texture) {
    return null;
  }

  // Only show when calibration is complete
  if (calibrationStep !== 'complete' && !calibration.originPdfPoint) {
    return null;
  }

  return (
    <group rotation={[0, 0, -rotation]}>
      {/* Z-up: PlaneGeometry already lies in XY plane, flip X for correct orientation */}
      <mesh position={position} rotation={[0, 0, 0]} scale={[-1, 1, 1]}>
        <planeGeometry args={[size.width, size.height]} />
        <meshBasicMaterial
          map={texture}
          transparent
          opacity={opacity}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
