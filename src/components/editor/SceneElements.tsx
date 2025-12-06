import { useElementStore, useProjectStore, useSelectionStore } from '@/store';
import { WallMesh, SlabMesh, DoorMesh } from './meshes';
import type { BimElement } from '@/types/bim';

/**
 * Renders all BIM elements in the current storey
 */
export function SceneElements() {
  const { activeStoreyId } = useProjectStore();
  const { getElementsByStorey } = useElementStore();
  const { isSelected } = useSelectionStore();

  if (!activeStoreyId) {
    return null;
  }

  const elements = getElementsByStorey(activeStoreyId);

  return (
    <group name="scene-elements">
      {elements.map((element) => (
        <ElementMesh key={element.id} element={element} selected={isSelected(element.id)} />
      ))}
    </group>
  );
}

interface ElementMeshProps {
  element: BimElement;
  selected: boolean;
}

/**
 * Routes element to appropriate mesh component based on type
 */
function ElementMesh({ element, selected }: ElementMeshProps) {
  switch (element.type) {
    case 'wall':
      return <WallMesh element={element} selected={selected} />;
    case 'door':
      return <DoorMesh element={element} selected={selected} />;
    case 'window':
      // TODO: Implement WindowMesh
      return null;
    case 'column':
      // TODO: Implement ColumnMesh
      return null;
    case 'slab':
      return <SlabMesh element={element} selected={selected} />;
    case 'furniture':
      // TODO: Implement FurnitureMesh
      return null;
    default:
      console.warn(`Unknown element type: ${element.type}`);
      return null;
  }
}
