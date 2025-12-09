import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { useViewStore, useElementStore, useProjectStore } from '@/store';
import * as THREE from 'three';
import type { OrbitControls } from 'three-stdlib';
import type { BimElement } from '@/types/bim';

const LERP_SPEED = 0.08;
const PADDING = 1.2; // 20% padding around elements

/**
 * Calculate bounding box from all BIM elements
 */
function calculateElementsBounds(elements: BimElement[]): THREE.Box3 | null {
  if (elements.length === 0) return null;

  const box = new THREE.Box3();
  let hasValidBounds = false;

  for (const element of elements) {
    const pos = element.placement.position;

    // Get element dimensions based on type
    let minX = pos.x;
    let minY = pos.y;
    let minZ = pos.z;
    let maxX = pos.x;
    let maxY = pos.y;
    let maxZ = pos.z;

    if (element.type === 'wall' && element.wallData) {
      const { startPoint, endPoint, height, thickness } = element.wallData;
      minX = Math.min(startPoint.x, endPoint.x) - thickness / 2;
      maxX = Math.max(startPoint.x, endPoint.x) + thickness / 2;
      minY = Math.min(startPoint.y, endPoint.y) - thickness / 2;
      maxY = Math.max(startPoint.y, endPoint.y) + thickness / 2;
      maxZ = pos.z + height;
    } else if (element.type === 'column' && element.columnData) {
      const { width, depth, height } = element.columnData;
      minX = pos.x - width / 2;
      maxX = pos.x + width / 2;
      minY = pos.y - depth / 2;
      maxY = pos.y + depth / 2;
      maxZ = pos.z + height;
    } else if (element.type === 'slab' && element.slabData) {
      const { outline, thickness } = element.slabData;
      for (const p of outline) {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      }
      maxZ = pos.z + thickness;
    } else if (element.type === 'space' && element.spaceData) {
      const { boundaryPolygon } = element.spaceData;
      for (const p of boundaryPolygon) {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      }
      maxZ = pos.z + 2.8; // Default room height
    } else if (element.type === 'furniture' && element.furnitureData) {
      const { width, depth, height } = element.furnitureData;
      minX = pos.x - width / 2;
      maxX = pos.x + width / 2;
      minY = pos.y - depth / 2;
      maxY = pos.y + depth / 2;
      maxZ = pos.z + height;
    } else if (element.type === 'door' && element.doorData) {
      const { width, height } = element.doorData;
      minX = pos.x - width / 2;
      maxX = pos.x + width / 2;
      minY = pos.y - 0.1;
      maxY = pos.y + 0.1;
      maxZ = pos.z + height;
    } else if (element.type === 'window' && element.windowData) {
      const { width, height } = element.windowData;
      minX = pos.x - width / 2;
      maxX = pos.x + width / 2;
      minY = pos.y - 0.1;
      maxY = pos.y + 0.1;
      maxZ = pos.z + height;
    } else if (element.type === 'stair' && element.stairData) {
      const { width, totalRise, steps } = element.stairData;
      minX = pos.x - width / 2;
      maxX = pos.x + width / 2;
      maxY = pos.y + steps.runLength;
      maxZ = pos.z + totalRise;
    } else if (element.type === 'counter' && element.counterData) {
      const { path, height, depth } = element.counterData;
      for (const p of path) {
        minX = Math.min(minX, p.x - depth);
        maxX = Math.max(maxX, p.x + depth);
        minY = Math.min(minY, p.y - depth);
        maxY = Math.max(maxY, p.y + depth);
      }
      maxZ = pos.z + height;
    } else {
      // Default bounds for unknown types
      minX = pos.x - 0.5;
      maxX = pos.x + 0.5;
      minY = pos.y - 0.5;
      maxY = pos.y + 0.5;
      maxZ = pos.z + 1;
    }

    box.expandByPoint(new THREE.Vector3(minX, minY, minZ));
    box.expandByPoint(new THREE.Vector3(maxX, maxY, maxZ));
    hasValidBounds = true;
  }

  return hasValidBounds ? box : null;
}

/**
 * Component that handles zoom-to-extents for 3D view
 */
export function ZoomToExtents3D() {
  const { camera, controls } = useThree();
  const { zoomToExtentsTrigger } = useViewStore();
  const { getAllElements, getElementsByStorey } = useElementStore();
  const { activeStoreyId } = useProjectStore();

  const isAnimating = useRef(false);
  const targetCameraPosition = useRef(new THREE.Vector3());
  const targetControlsTarget = useRef(new THREE.Vector3());
  const lastTrigger = useRef(0);

  useEffect(() => {
    if (zoomToExtentsTrigger === 0 || zoomToExtentsTrigger === lastTrigger.current) return;
    lastTrigger.current = zoomToExtentsTrigger;

    // Get elements for current storey or all
    const elements = activeStoreyId
      ? getElementsByStorey(activeStoreyId)
      : getAllElements();

    const bounds = calculateElementsBounds(elements);

    if (!bounds) {
      // No elements, zoom to default position
      targetCameraPosition.current.set(10, 10, 10);
      targetControlsTarget.current.set(0, 0, 0);
    } else {
      const center = new THREE.Vector3();
      bounds.getCenter(center);

      const size = new THREE.Vector3();
      bounds.getSize(size);

      // Calculate distance based on bounds size
      const maxDim = Math.max(size.x, size.y, size.z) * PADDING;
      const fov = (camera as THREE.PerspectiveCamera).fov ?? 50;
      const distance = maxDim / (2 * Math.tan((fov * Math.PI) / 360));

      // Position camera at an angle (isometric-like view)
      const offset = new THREE.Vector3(distance * 0.7, distance * 0.7, distance * 0.5);
      targetCameraPosition.current.copy(center).add(offset);
      targetControlsTarget.current.copy(center);
    }

    isAnimating.current = true;
  }, [zoomToExtentsTrigger, activeStoreyId, getAllElements, getElementsByStorey, camera]);

  useFrame(() => {
    if (!isAnimating.current) return;

    // Smoothly move camera
    camera.position.lerp(targetCameraPosition.current, LERP_SPEED);

    // Update OrbitControls target
    if (controls && 'target' in controls) {
      const orbitControls = controls as unknown as OrbitControls;
      orbitControls.target.lerp(targetControlsTarget.current, LERP_SPEED);
      orbitControls.update();
    }

    // Check if animation is complete
    const cameraDistance = camera.position.distanceTo(targetCameraPosition.current);
    if (cameraDistance < 0.05) {
      isAnimating.current = false;
    }
  });

  return null;
}
