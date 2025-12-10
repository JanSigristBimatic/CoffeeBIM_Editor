import { useCallback } from 'react';
import { useToolStore, useElementStore, useProjectStore, useViewStore } from '@/store';
import { getAssetById, getAssetCategoryForItem, mapAssetCategoryToFurnitureCategory } from '@/lib/assets';
import { createFurniture } from '@/bim/elements';
import { useSnap } from './useSnap';
import type { ThreeEvent } from '@react-three/fiber';
import type { Point2D } from '@/types/geometry';

/**
 * Hook for handling asset placement from the asset library
 */
export function useAssetPlacement() {
  const { assetPlacement, setAssetPreview } = useToolStore();
  const { addElement } = useElementStore();
  const { activeStoreyId, storeys } = useProjectStore();
  const { snapSettings } = useViewStore();
  const { snap } = useSnap();

  const { assetId, scale, rotation } = assetPlacement.params;
  const { previewPosition } = assetPlacement;

  // Get storey elevation for Z position
  const activeStorey = storeys.find(s => s.id === activeStoreyId);
  const storeyElevation = activeStorey?.elevation ?? 0;

  /**
   * Handle pointer move - update preview position
   */
  const handlePointerMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (!assetId) return;

      // Get intersection point on ground plane (Z-up: XY is ground)
      const point = event.point;
      let snappedPoint: Point2D = { x: point.x, y: point.y };

      // Apply snapping if enabled
      if (snapSettings.enabled) {
        const snapResult = snap(snappedPoint);
        if (snapResult.type !== 'none') {
          snappedPoint = snapResult.point;
        }
      }

      setAssetPreview(snappedPoint, true);
    },
    [assetId, snapSettings.enabled, snap, setAssetPreview]
  );

  /**
   * Handle pointer down - place asset
   */
  const handlePointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      // Only handle left click
      if (event.button !== 0) return;
      if (!assetId || !activeStoreyId) return;

      event.stopPropagation();

      const asset = getAssetById(assetId);
      if (!asset) {
        console.warn('Asset not found:', assetId);
        return;
      }

      // Get the current preview position or use click position (Z-up: XY is ground)
      const point = event.point;
      let position: Point2D = previewPosition || { x: point.x, y: point.y };

      // Apply snapping if enabled
      if (snapSettings.enabled) {
        const snapResult = snap(position);
        if (snapResult.type !== 'none') {
          position = snapResult.point;
        }
      }

      const category = getAssetCategoryForItem(assetId);
      const furnitureCategory = category
        ? mapAssetCategoryToFurnitureCategory(category.id)
        : 'other';

      // Convert rotation from degrees to radians
      const rotationRad = (rotation * Math.PI) / 180;

      // Determine model format from file extension
      const extension = asset.path.split('.').pop()?.toLowerCase() || 'glb';
      const modelFormat = extension === 'obj' ? 'obj' : extension === 'gltf' ? 'gltf' : 'glb';

      // Use catalog dimensions for 2D display, actual model scale for 3D
      const element = createFurniture({
        name: asset.name,
        category: furnitureCategory,
        modelUrl: asset.path,
        modelFormat,
        originalFileName: asset.path.split('/').pop() || asset.id,
        position: {
          x: position.x,
          y: position.y,
          z: storeyElevation, // Z-up: elements at storey elevation
        },
        rotation: rotationRad,
        scale: scale * asset.defaultScale,
        width: asset.dimensions.width * scale,
        depth: asset.dimensions.depth * scale,
        height: asset.dimensions.height * scale,
        storeyId: activeStoreyId,
        // Store target dimensions for reference (2D uses these)
        targetDimensions: {
          width: asset.dimensions.width * scale,
          depth: asset.dimensions.depth * scale,
          height: asset.dimensions.height * scale,
        },
      });

      addElement(element);
    },
    [
      assetId,
      activeStoreyId,
      storeyElevation,
      previewPosition,
      rotation,
      scale,
      snapSettings.enabled,
      snap,
      addElement,
    ]
  );

  /**
   * Handle pointer leave - clear preview
   */
  const handlePointerLeave = useCallback(() => {
    setAssetPreview(null, false);
  }, [setAssetPreview]);

  return {
    handlePointerMove,
    handlePointerDown,
    handlePointerLeave,
    hasSelectedAsset: !!assetId,
    previewPosition,
  };
}
