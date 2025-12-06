import { Grid as DreiGrid } from '@react-three/drei';
import { useViewStore } from '@/store';

export function Grid() {
  const { gridSize } = useViewStore();

  return (
    <DreiGrid
      args={[100, 100]}
      cellSize={gridSize}
      cellThickness={0.5}
      cellColor="#6e6e6e"
      sectionSize={gridSize * 10}
      sectionThickness={1}
      sectionColor="#9d4b4b"
      fadeDistance={50}
      fadeStrength={1}
      followCamera={false}
      infiniteGrid={true}
    />
  );
}
