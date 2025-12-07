import { useToolStore } from '@/store';
import { AssetPreview } from './AssetPreview';

/**
 * Wrapper component that connects AssetPreview to the tool store
 */
export function AssetPreviewWrapper() {
  const { activeTool, assetPlacement } = useToolStore();

  // Only show when asset tool is active and we have a position
  if (activeTool !== 'asset') {
    return null;
  }

  const { previewPosition } = assetPlacement;
  const { assetId } = assetPlacement.params;

  // Don't show if no asset selected or no position
  if (!assetId || !previewPosition) {
    return null;
  }

  return <AssetPreview position={previewPosition} />;
}
