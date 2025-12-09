import { Suspense, useEffect, useState } from 'react';
import { Group, Box3, Vector3, MeshStandardMaterial, Mesh, DoubleSide } from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useToolStore } from '@/store';
import { useStoreyElevation } from '@/hooks';
import { getAssetById } from '@/lib/assets';
import type { Point2D } from '@/types/geometry';

interface AssetPreviewProps {
  position: Point2D;
}

/**
 * Preview component for asset placement
 * Shows a semi-transparent version of the selected asset at the cursor position
 */
export function AssetPreview({ position }: AssetPreviewProps) {
  const { assetPlacement } = useToolStore();
  const storeyElevation = useStoreyElevation();
  const { assetId, scale, rotation } = assetPlacement.params;

  const asset = assetId ? getAssetById(assetId) : null;

  if (!asset || !position) {
    return null;
  }

  // Convert rotation from degrees to radians (Z-up: rotate around Z axis)
  const rotationRad = (rotation * Math.PI) / 180;

  return (
    <group position={[position.x, position.y, storeyElevation]} rotation={[0, 0, rotationRad]}>
      <Suspense fallback={<PreviewFallback asset={asset} scale={scale} />}>
        <AssetModelPreview
          assetPath={asset.path}
          scale={scale * asset.defaultScale}
          dimensions={asset.dimensions}
        />
      </Suspense>
    </group>
  );
}

/**
 * Fallback box shown while model is loading
 * Z-up: height is along Z axis
 */
function PreviewFallback({
  asset,
  scale,
}: {
  asset: { dimensions: { width: number; depth: number; height: number } };
  scale: number;
}) {
  const { width, depth, height } = asset.dimensions;
  const scaledWidth = width * scale;
  const scaledDepth = depth * scale;
  const scaledHeight = height * scale;

  return (
    <mesh position={[0, 0, scaledHeight / 2]}>
      <boxGeometry args={[scaledWidth, scaledDepth, scaledHeight]} />
      <meshStandardMaterial
        color="#4CAF50"
        transparent
        opacity={0.3}
        wireframe
      />
    </mesh>
  );
}

/**
 * Loads and displays a GLTF model with preview styling
 */
function AssetModelPreview({
  assetPath,
  scale,
  dimensions,
}: {
  assetPath: string;
  scale: number;
  dimensions: { width: number; depth: number; height: number };
}) {
  const [loadedScene, setLoadedScene] = useState<Group | null>(null);
  const [offset, setOffset] = useState<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 0 });
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loader = new GLTFLoader();

    loader.load(
      assetPath,
      (gltf: GLTF) => {
        if (!mounted) return;

        const scene = gltf.scene.clone();

        // Calculate bounding box
        const box = new Box3().setFromObject(scene);
        const size = new Vector3();
        const center = new Vector3();
        box.getSize(size);
        box.getCenter(center);

        // Calculate offset to center and ground the model (in model's Y-up space)
        // After -90° X rotation: model Y becomes world Z
        setOffset({
          x: -center.x,
          y: -center.y + size.y / 2, // Lift to ground in model's Y-up space
          z: -center.z,
        });

        // Apply preview material (semi-transparent green)
        scene.traverse((child) => {
          if (child instanceof Mesh) {
            const previewMaterial = new MeshStandardMaterial({
              color: '#4CAF50',
              transparent: true,
              opacity: 0.6,
              side: DoubleSide,
            });
            child.material = previewMaterial;
          }
        });

        setLoadedScene(scene);
        setLoadError(false);
      },
      undefined,
      () => {
        if (mounted) {
          setLoadError(true);
        }
      }
    );

    return () => {
      mounted = false;
    };
  }, [assetPath]);

  // Show fallback on error (Z-up: height along Z)
  if (loadError) {
    return (
      <mesh position={[0, 0, (dimensions.height * scale) / 2]}>
        <boxGeometry
          args={[dimensions.width * scale, dimensions.depth * scale, dimensions.height * scale]}
        />
        <meshStandardMaterial color="#f44336" transparent opacity={0.5} wireframe />
      </mesh>
    );
  }

  // Show loading state (Z-up: height along Z)
  if (!loadedScene) {
    return (
      <mesh position={[0, 0, (dimensions.height * scale) / 2]}>
        <boxGeometry
          args={[dimensions.width * scale, dimensions.depth * scale, dimensions.height * scale]}
        />
        <meshStandardMaterial color="#4CAF50" transparent opacity={0.3} wireframe />
      </mesh>
    );
  }

  // GLTF models are Y-up, rotate +90° around X to convert to Z-up (Y → +Z)
  return (
    <group scale={[scale, scale, scale]} rotation={[Math.PI / 2, 0, 0]}>
      <group position={[offset.x, offset.y, offset.z]}>
        <primitive object={loadedScene} />
      </group>
    </group>
  );
}
