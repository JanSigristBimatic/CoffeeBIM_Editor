import { useMemo } from 'react';
import { useElementStore, useProjectStore, useSelectionStore, useViewStore, useMeasurementStore } from '@/store';
import { WallMesh, SlabMesh, DoorMesh, WindowMesh, ColumnMesh, CounterMesh, FurnitureMesh, SpaceMesh, StairMesh, DimensionLabel, DimensionLine3D, MeasurementMesh, PreviewMeasurement } from './meshes';
import type { BimElement } from '@/types/bim';
import { generateElementDimensions } from '@/lib/geometry';

/**
 * Find adjacent storeys (above and below) relative to the active storey
 */
function useAdjacentStoreys() {
  const { storeys, activeStoreyId } = useProjectStore();

  return useMemo(() => {
    if (!activeStoreyId) return { storeyAbove: null, storeyBelow: null };

    // Sort storeys by elevation
    const sortedStoreys = [...storeys].sort((a, b) => a.elevation - b.elevation);
    const activeIndex = sortedStoreys.findIndex((s) => s.id === activeStoreyId);

    if (activeIndex === -1) return { storeyAbove: null, storeyBelow: null };

    return {
      storeyAbove: sortedStoreys[activeIndex + 1] ?? null,
      storeyBelow: sortedStoreys[activeIndex - 1] ?? null,
    };
  }, [storeys, activeStoreyId]);
}

/**
 * Renders all BIM elements in the current storey plus ghost elements from adjacent storeys
 */
export function SceneElements() {
  const { activeStoreyId } = useProjectStore();
  const { getElementsByStorey } = useElementStore();
  const { isSelected } = useSelectionStore();
  const { showStoreyAbove, showStoreyBelow, ghostOpacity, showDimensions, dimensionSettings, showSpaces, showSpaceLabels } = useViewStore();
  const { storeyAbove, storeyBelow } = useAdjacentStoreys();
  const { measurements, placementState, selectedMeasurementId, selectMeasurement } = useMeasurementStore();

  if (!activeStoreyId) {
    return null;
  }

  const elements = getElementsByStorey(activeStoreyId);
  const elementsAbove = showStoreyAbove && storeyAbove ? getElementsByStorey(storeyAbove.id) : [];
  const elementsBelow = showStoreyBelow && storeyBelow ? getElementsByStorey(storeyBelow.id) : [];

  return (
    <group name="scene-elements">
      {/* Ghost elements from storey below (rendered first, behind) */}
      {elementsBelow.length > 0 && (
        <group name="ghost-storey-below">
          {elementsBelow.map((element) => (
            <ElementMesh
              key={`ghost-below-${element.id}`}
              element={element}
              selected={false}
              isGhost
              ghostOpacity={ghostOpacity}
            />
          ))}
        </group>
      )}

      {/* Ghost elements from storey above */}
      {elementsAbove.length > 0 && (
        <group name="ghost-storey-above">
          {elementsAbove.map((element) => (
            <ElementMesh
              key={`ghost-above-${element.id}`}
              element={element}
              selected={false}
              isGhost
              ghostOpacity={ghostOpacity}
            />
          ))}
        </group>
      )}

      {/* Active storey elements (rendered last, on top) */}
      {elements.map((element) => (
        <ElementMesh
          key={element.id}
          element={element}
          selected={isSelected(element.id)}
          showSpaces={showSpaces}
          showSpaceLabels={showSpaceLabels}
        />
      ))}

      {/* Dimension labels (rendered on top of everything) */}
      {showDimensions && (
        <group name="dimensions">
          {elements.map((element) => {
            const dims = generateElementDimensions(element, dimensionSettings);
            return dims.map((dim) => (
              dim.measureLine ? (
                <DimensionLine3D key={dim.id} dimension={dim} visible={showDimensions} />
              ) : (
                <DimensionLabel key={dim.id} dimension={dim} visible={showDimensions} />
              )
            ));
          })}
        </group>
      )}

      {/* Manual measurements (always visible) */}
      <group name="measurements">
        {/* Completed measurements */}
        {measurements.map((measurement) => (
          <MeasurementMesh
            key={measurement.id}
            measurement={measurement}
            selected={selectedMeasurementId === measurement.id}
            onClick={(id) => selectMeasurement(id)}
          />
        ))}

        {/* Preview measurement during placement */}
        {placementState.isPlacing && placementState.startPoint && placementState.previewEndPoint && (
          <PreviewMeasurement
            startPoint={placementState.startPoint}
            endPoint={placementState.previewEndPoint}
          />
        )}
      </group>
    </group>
  );
}

interface ElementMeshProps {
  element: BimElement;
  selected: boolean;
  isGhost?: boolean;
  ghostOpacity?: number;
  showSpaces?: boolean;
  showSpaceLabels?: boolean;
}

/**
 * Routes element to appropriate mesh component based on type
 * Ghost elements are rendered with reduced opacity and no interaction
 */
function ElementMesh({ element, selected, isGhost = false, ghostOpacity = 0.25, showSpaces = true, showSpaceLabels = true }: ElementMeshProps) {
  const meshProps = { element, selected: isGhost ? false : selected, isGhost, ghostOpacity };

  switch (element.type) {
    case 'wall':
      return <WallMesh {...meshProps} />;
    case 'door':
      return <DoorMesh {...meshProps} />;
    case 'window':
      return <WindowMesh {...meshProps} />;
    case 'column':
      return <ColumnMesh {...meshProps} />;
    case 'slab':
      return <SlabMesh {...meshProps} />;
    case 'counter':
      return <CounterMesh element={element} isSelected={isGhost ? false : selected} isGhost={isGhost} ghostOpacity={ghostOpacity} />;
    case 'furniture':
      return <FurnitureMesh {...meshProps} />;
    case 'space':
      return <SpaceMesh element={element} selected={isGhost ? false : selected} visible={!isGhost && showSpaces} showLabel={showSpaceLabels} />;
    case 'stair':
      return <StairMesh {...meshProps} />;
    default:
      console.warn(`Unknown element type: ${element.type}`);
      return null;
  }
}
