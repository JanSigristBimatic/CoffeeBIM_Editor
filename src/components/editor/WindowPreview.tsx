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

    // Position along wall
    const x = startPoint.x + dx * previewPosition;
    const z = startPoint.y + dy * previewPosition;

    // Wall angle
    const angle = Math.atan2(dy, dx);

    // Wall start and end positions in 3D
    const wallStartX = startPoint.x;
    const wallStartZ = startPoint.y;
    const wallEndX = endPoint.x;
    const wallEndZ = endPoint.y;

    return {
      position: { x, z },
      angle,
      wallLength,
      wallStartX,
      wallStartZ,
      wallEndX,
      wallEndZ,
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
  // Position window center at sillHeight + half height
  const windowCenterY = params.sillHeight + params.height / 2;
  const dimensionY = params.sillHeight + 0.1; // Slightly above sill for dimension lines

  // Calculate dimension line endpoints
  const windowLeftX = transform.position.x - Math.cos(transform.angle) * hw;
  const windowLeftZ = transform.position.z - Math.sin(transform.angle) * hw;
  const windowRightX = transform.position.x + Math.cos(transform.angle) * hw;
  const windowRightZ = transform.position.z + Math.sin(transform.angle) * hw;

  return (
    <group renderOrder={999}>
      {/* Window preview mesh */}
      <group
        position={[transform.position.x, windowCenterY, transform.position.z]}
        rotation={new Euler(0, -transform.angle, 0)}
      >
        <mesh geometry={windowGeometry} material={previewMaterial} renderOrder={999} />

        {/* Window frame outline */}
        <lineSegments renderOrder={1000}>
          <edgesGeometry args={[windowGeometry]} />
          <lineBasicMaterial color={getPreviewColor(isValidPosition)} depthTest={false} />
        </lineSegments>
      </group>

      {/* Distance indicators using reusable DimensionLine */}
      {distanceFromLeft !== null && distanceFromRight !== null && (
        <group>
          {/* Left distance line (wall start to window left edge) */}
          <DimensionLine
            start={[transform.wallStartX, dimensionY, transform.wallStartZ]}
            end={[windowLeftX, dimensionY, windowLeftZ]}
            distance={distanceFromLeft}
          />

          {/* Right distance line (window right edge to wall end) */}
          <DimensionLine
            start={[windowRightX, dimensionY, windowRightZ]}
            end={[transform.wallEndX, dimensionY, transform.wallEndZ]}
            distance={distanceFromRight}
          />
        </group>
      )}
    </group>
  );
}
