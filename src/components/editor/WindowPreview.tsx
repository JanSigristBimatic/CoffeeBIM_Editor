import { useMemo } from 'react';
import { BoxGeometry, Euler } from 'three';
import { useToolStore, useElementStore } from '@/store';
import { DimensionLine } from '@/components/three';
import { usePreviewMaterial, getPreviewColor } from '@/components/three';

/**
 * Shows a preview of the window being placed on a wall
 * Includes distance indicators to wall edges
 */
export function WindowPreview() {
  const { activeTool, windowPlacement } = useToolStore();
  const { getElement } = useElementStore();

  const { params, hostWallId, previewPosition, distanceFromLeft, distanceFromRight, isValidPosition } =
    windowPlacement;

  // Get host wall
  const hostWall = useMemo(() => {
    if (!hostWallId) return null;
    return getElement(hostWallId) ?? null;
  }, [hostWallId, getElement]);

  // Calculate preview transform
  const transform = useMemo(() => {
    if (!hostWall?.wallData || previewPosition === null) return null;

    const { startPoint, endPoint } = hostWall.wallData;

    // Calculate wall direction and length
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const wallLength = Math.sqrt(dx * dx + dy * dy);

    // Position along wall (Z-up: x, y are ground plane)
    const x = startPoint.x + dx * previewPosition;
    const y = startPoint.y + dy * previewPosition;

    // Wall angle (rotation around Z axis)
    const angle = Math.atan2(dy, dx);

    // Wall start and end positions in 3D (Z-up)
    const wallStartX = startPoint.x;
    const wallStartY = startPoint.y;
    const wallEndX = endPoint.x;
    const wallEndY = endPoint.y;

    return {
      position: { x, y },
      angle,
      wallLength,
      wallStartX,
      wallStartY,
      wallEndX,
      wallEndY,
    };
  }, [hostWall, previewPosition]);

  // Create window preview geometry
  const windowGeometry = useMemo(() => {
    return new BoxGeometry(params.width, params.height, 0.05);
  }, [params.width, params.height]);

  // Preview material using reusable hook
  const previewMaterial = usePreviewMaterial({ isValid: isValidPosition });

  // Don't render if not in window mode or no preview data
  if (activeTool !== 'window' || !transform || previewPosition === null) {
    return null;
  }

  const hw = params.width / 2;
  // Position window center at sillHeight + half height (Z-up: z is height)
  const windowCenterZ = params.sillHeight + params.height / 2;
  const dimensionZ = params.sillHeight + 0.1; // Slightly above sill for dimension lines

  // Calculate dimension line endpoints (Z-up: X, Y are ground plane)
  const windowLeftX = transform.position.x - Math.cos(transform.angle) * hw;
  const windowLeftY = transform.position.y - Math.sin(transform.angle) * hw;
  const windowRightX = transform.position.x + Math.cos(transform.angle) * hw;
  const windowRightY = transform.position.y + Math.sin(transform.angle) * hw;

  return (
    <group renderOrder={999}>
      {/* Window preview mesh (Z-up: x, y ground, z height) */}
      <group
        position={[transform.position.x, transform.position.y, windowCenterZ]}
        rotation={new Euler(Math.PI / 2, 0, transform.angle, 'ZXY')}
      >
        <mesh geometry={windowGeometry} material={previewMaterial} renderOrder={999} />

        {/* Window frame outline */}
        <lineSegments renderOrder={1000}>
          <edgesGeometry args={[windowGeometry]} />
          <lineBasicMaterial color={getPreviewColor(isValidPosition)} depthTest={false} />
        </lineSegments>
      </group>

      {/* Distance indicators using reusable DimensionLine (Z-up) */}
      {distanceFromLeft !== null && distanceFromRight !== null && (
        <group>
          {/* Left distance line (wall start to window left edge) */}
          <DimensionLine
            start={[transform.wallStartX, transform.wallStartY, dimensionZ]}
            end={[windowLeftX, windowLeftY, dimensionZ]}
            distance={distanceFromLeft}
          />

          {/* Right distance line (window right edge to wall end) */}
          <DimensionLine
            start={[windowRightX, windowRightY, dimensionZ]}
            end={[transform.wallEndX, transform.wallEndY, dimensionZ]}
            distance={distanceFromRight}
          />
        </group>
      )}
    </group>
  );
}
