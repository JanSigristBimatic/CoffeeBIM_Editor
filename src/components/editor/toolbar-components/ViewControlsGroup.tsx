import { Grid2X2, RulerIcon, Columns, Box, Layout, Maximize2 } from 'lucide-react';
import { useViewStore } from '@/store';
import { ToggleButton } from './ToolbarButtons';

export function ViewControlsGroup() {
  const { toggleGrid, showGrid, snapSettings, toggleSnapOrthogonal, viewMode, cycleViewMode, showDimensions, toggleDimensions } = useViewStore();

  // Icon and label based on view mode
  const getViewIcon = () => {
    switch (viewMode) {
      case '2d':
        return <Layout size={20} />;
      case '3d':
        return <Box size={20} />;
      case 'split':
        return <Columns size={20} />;
    }
  };

  const getViewLabel = () => {
    switch (viewMode) {
      case '2d':
        return '2D';
      case '3d':
        return '3D';
      case 'split':
        return 'Split';
    }
  };

  return (
    <div className="flex items-center gap-1 border-r pr-2 mr-2">
      {/* View Mode Toggle */}
      <ToggleButton
        icon={getViewIcon()}
        label={getViewLabel()}
        isActive={viewMode === 'split'}
        onClick={cycleViewMode}
        title="Ansicht wechseln: 2D → 3D → Split (V)"
      />
      <ToggleButton
        icon={<Grid2X2 size={20} />}
        label="Raster"
        isActive={showGrid}
        onClick={toggleGrid}
        title="Raster ein/aus (G)"
      />
      <ToggleButton
        icon={<RulerIcon size={20} />}
        label="Ortho"
        isActive={snapSettings.orthogonal}
        onClick={toggleSnapOrthogonal}
        title="Orthogonal-Modus ein/aus (O)"
      />
      <ToggleButton
        icon={<Maximize2 size={20} />}
        label="Maße"
        isActive={showDimensions}
        onClick={toggleDimensions}
        title="Bemaßungen ein/aus (D)"
      />
    </div>
  );
}
