import { useMemo } from 'react';
import { BoxGeometry, Euler } from 'three';
import { useToolStore, useElementStore } from '@/store';
import { DimensionLine } from '@/components/three';
import { usePreviewMaterial, getPreviewColor } from '@/components/three';

/**
 * Shows a preview of the door being placed on a wall
 * Includes distance indicators to wall edges
 */
export function DoorPreview() {
  const { activeTool, doorPlacement } = useToolStore();
  const { getElement } = useElementStore();

  const { params, hostWallId, previewPosition, distanceFromLeft, distanceFromRight, isValidPosition } =
    doorPlacement;

  // Get host wall
  const hostWall = useMemo(() => {
    if (!hostWallId) return null;
    return getElement(hostWallId) ?? null;
  }, [hostWallId, getElement]);

  // Calculate preview transform
  const transform = useMemo(() => {
    if (!hostWall?.wallData || previewPosition === null) return null;

    const { startPoint, endPoint, height: wallHeight } = hostWall.wallData;

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
      wallHeight,
      wallStartX,
      wallStartZ,
      wallEndX,
      wallEndZ,
    };
  }, [hostWall, previewPosition]);

  // Create door preview geometry
  const doorGeometry = useMemo(() => {
    return new BoxGeometry(params.width, params.height, 0.08);
  }, [params.width, params.height]);

  // Preview material using reusable hook
  const previewMaterial = usePreviewMaterial({ isValid: isValidPosition });

  // Don't render if not in door mode or no preview data
  if (activeTool !== 'door' || !transform || previewPosition === null) {
    return null;
  }

  const hw = params.width / 2;
  const dimensionY = 0.1; // Height above ground for dimension lines

  // Calculate dimension line endpoints
  const doorLeftX = transform.position.x - Math.cos(transform.angle) * hw;
  const doorLeftZ = transform.position.z - Math.sin(transform.angle) * hw;
  const doorRightX = transform.position.x + Math.cos(transform.angle) * hw;
  const doorRightZ = transform.position.z + Math.sin(transform.angle) * hw;

  return (
    <group renderOrder={999}>
      {/* Door preview mesh */}
      <group
        position={[transform.position.x, params.height / 2, transform.position.z]}
        rotation={new Euler(0, -transform.angle, 0)}
      >
        <mesh geometry={doorGeometry} material={previewMaterial} renderOrder={999} />

        {/* Door frame outline */}
        <lineSegments renderOrder={1000}>
          <edgesGeometry args={[doorGeometry]} />
          <lineBasicMaterial color={getPreviewColor(isValidPosition)} depthTest={false} />
        </lineSegments>
      </group>

      {/* Distance indicators using reusable DimensionLine */}
      {distanceFromLeft !== null && distanceFromRight !== null && (
        <group>
          {/* Left distance line (wall start to door left edge) */}
          <DimensionLine
            start={[transform.wallStartX, dimensionY, transform.wallStartZ]}
            end={[doorLeftX, dimensionY, doorLeftZ]}
            distance={distanceFromLeft}
          />

          {/* Right distance line (door right edge to wall end) */}
          <DimensionLine
            start={[doorRightX, dimensionY, doorRightZ]}
            end={[transform.wallEndX, dimensionY, transform.wallEndZ]}
            distance={distanceFromRight}
          />
        </group>
      )}
    </group>
  );
}
