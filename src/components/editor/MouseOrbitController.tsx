import { useEffect, useRef, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { OrbitControls } from 'three-stdlib';

/**
 * Updates OrbitControls target based on mouse position when starting to orbit.
 *
 * Behavior:
 * - On middle mouse down (or Alt+Left): Sets orbit pivot to point under cursor
 * - Uses smooth transition to avoid jarring viewport jumps
 * - Does NOT change pivot on zoom (scroll) - that would be disorienting
 */
export function MouseOrbitController() {
  const { camera, controls, gl, scene } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2());
  const groundPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)); // Z-up ground plane

  // Animation state
  const targetPosition = useRef(new THREE.Vector3());
  const startPosition = useRef(new THREE.Vector3());
  const isTransitioning = useRef(false);
  const transitionProgress = useRef(0);

  // Transition duration in seconds (fast but smooth)
  const TRANSITION_DURATION = 0.15;

  /**
   * Calculate intersection point from mouse position
   * Prioritizes scene objects, falls back to ground plane
   */
  const getIntersectionPoint = useCallback((event: MouseEvent): THREE.Vector3 | null => {
    const rect = gl.domElement.getBoundingClientRect();
    mouse.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.current.setFromCamera(mouse.current, camera);

    // Try to intersect with scene objects (meshes only)
    const intersects = raycaster.current.intersectObjects(scene.children, true);

    for (const intersect of intersects) {
      // Only consider visible mesh objects
      if (
        intersect.object.visible &&
        intersect.object instanceof THREE.Mesh &&
        !intersect.object.name.includes('helper') &&
        !intersect.object.name.includes('gizmo')
      ) {
        return intersect.point.clone();
      }
    }

    // Fall back to ground plane intersection
    const planeIntersect = new THREE.Vector3();
    if (raycaster.current.ray.intersectPlane(groundPlane.current, planeIntersect)) {
      return planeIntersect;
    }

    return null;
  }, [camera, gl, scene]);

  /**
   * Handle orbit start - set new pivot with smooth transition
   */
  useEffect(() => {
    const domElement = gl.domElement;

    const handleMouseDown = (event: MouseEvent) => {
      if (!controls || !('target' in controls)) return;

      const orbitControls = controls as unknown as OrbitControls;

      // Middle mouse button (orbit) or Alt+Left mouse
      const isOrbitStart = event.button === 1 || (event.button === 0 && event.altKey);

      if (!isOrbitStart) return;

      const intersectionPoint = getIntersectionPoint(event);
      if (!intersectionPoint) return;

      // Check if the new target is significantly different from current
      const currentTarget = orbitControls.target;
      const distance = intersectionPoint.distanceTo(currentTarget);

      // Only transition if target moved more than 0.5m (prevents micro-jumps)
      if (distance < 0.5) return;

      // Start smooth transition to new target
      startPosition.current.copy(currentTarget);
      targetPosition.current.copy(intersectionPoint);
      transitionProgress.current = 0;
      isTransitioning.current = true;
    };

    domElement.addEventListener('mousedown', handleMouseDown);
    return () => domElement.removeEventListener('mousedown', handleMouseDown);
  }, [controls, gl, getIntersectionPoint]);

  // Smooth transition animation
  useFrame((_, delta) => {
    if (!isTransitioning.current || !controls || !('target' in controls)) return;

    const orbitControls = controls as unknown as OrbitControls;

    // Advance transition
    transitionProgress.current += delta / TRANSITION_DURATION;

    if (transitionProgress.current >= 1) {
      // Transition complete
      orbitControls.target.copy(targetPosition.current);
      isTransitioning.current = false;
    } else {
      // Smooth ease-out interpolation
      const t = 1 - Math.pow(1 - transitionProgress.current, 3);
      orbitControls.target.lerpVectors(startPosition.current, targetPosition.current, t);
    }

    orbitControls.update();
  });

  return null;
}
