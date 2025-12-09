import { useMemo } from 'react';
import { BoxGeometry, Euler } from 'three';
import { useToolStore, useElementStore } from '@/store';
import { DimensionLine } from '@/components/three';
import { usePreviewMaterial, getPreviewColor } from '@/components/three';
import { DoorSwingArc } from './meshes';

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
      wallHeight,
      wallStartX,
      wallStartY,
      wallEndX,
      wallEndY,
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
  const dimensionZ = 0.1; // Height above ground for dimension lines (Z-up)

  // Calculate dimension line endpoints (Z-up: X, Y are ground plane)
  const doorLeftX = transform.position.x - Math.cos(transform.angle) * hw;
  const doorLeftY = transform.position.y - Math.sin(transform.angle) * hw;
  const doorRightX = transform.position.x + Math.cos(transform.angle) * hw;
  const doorRightY = transform.position.y + Math.sin(transform.angle) * hw;

  return (
    <group renderOrder={999}>
      {/* Door preview mesh (Z-up: x, y ground, z height) */}
      <group
        position={[transform.position.x, transform.position.y, params.height / 2]}
        rotation={new Euler(Math.PI / 2, 0, transform.angle, 'ZXY')}
      >
        <mesh geometry={doorGeometry} material={previewMaterial} renderOrder={999} />

        {/* Door frame outline */}
        <lineSegments renderOrder={1000}>
          <edgesGeometry args={[doorGeometry]} />
          <lineBasicMaterial color={getPreviewColor(isValidPosition)} depthTest={false} />
        </lineSegments>
      </group>

      {/* Door swing arc preview (Z-up: arc lies in XY plane) */}
      <group
        position={[transform.position.x, transform.position.y, 0]}
        rotation={new Euler(0, 0, transform.angle)}
      >
        <DoorSwingArc
          doorWidth={params.width}
          doorType={params.doorType}
          swingDirection={params.swingDirection}
          swingSide={params.swingSide}
          zOffset={0.02}
        />
      </group>

      {/* Distance indicators using reusable DimensionLine (Z-up) */}
      {distanceFromLeft !== null && distanceFromRight !== null && (
        <group>
          {/* Left distance line (wall start to door left edge) */}
          <DimensionLine
            start={[transform.wallStartX, transform.wallStartY, dimensionZ]}
            end={[doorLeftX, doorLeftY, dimensionZ]}
            distance={distanceFromLeft}
          />

          {/* Right distance line (door right edge to wall end) */}
          <DimensionLine
            start={[doorRightX, doorRightY, dimensionZ]}
            end={[transform.wallEndX, transform.wallEndY, dimensionZ]}
            distance={distanceFromRight}
          />
        </group>
      )}
    </group>
  );
}
