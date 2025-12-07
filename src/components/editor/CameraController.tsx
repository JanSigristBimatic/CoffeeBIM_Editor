import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { useViewStore } from '@/store';
import * as THREE from 'three';
import type { OrbitControls } from 'three-stdlib';

const ZOOM_DISTANCE = 8; // Distance from target when zooming
const LERP_SPEED = 0.08; // Animation smoothness (0-1)

export function CameraController() {
  const { camera, controls } = useThree();
  const { focusTarget, clearFocusTarget } = useViewStore();

  const isAnimating = useRef(false);
  const targetPosition = useRef(new THREE.Vector3());
  const cameraTarget = useRef(new THREE.Vector3());

  useEffect(() => {
    if (focusTarget) {
      // Calculate target camera position
      const target = new THREE.Vector3(focusTarget.x, focusTarget.y, focusTarget.z);
      targetPosition.current.copy(target);

      // Camera position: offset from target
      const offset = new THREE.Vector3(ZOOM_DISTANCE, ZOOM_DISTANCE * 0.6, ZOOM_DISTANCE);
      cameraTarget.current.copy(target).add(offset);

      isAnimating.current = true;
    }
  }, [focusTarget]);

  useFrame(() => {
    if (!isAnimating.current || !focusTarget) return;

    // Smoothly move camera
    camera.position.lerp(cameraTarget.current, LERP_SPEED);

    // Update OrbitControls target
    if (controls && 'target' in controls) {
      const orbitControls = controls as unknown as OrbitControls;
      orbitControls.target.lerp(targetPosition.current, LERP_SPEED);
      orbitControls.update();
    }

    // Check if animation is complete
    const cameraDistance = camera.position.distanceTo(cameraTarget.current);
    if (cameraDistance < 0.1) {
      isAnimating.current = false;
      clearFocusTarget();
    }
  });

  return null;
}
