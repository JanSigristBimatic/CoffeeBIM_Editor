import { RulerIcon, Columns, Box, Layout, Focus, Eye, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useViewStore } from '@/store';
import { ToggleButton, ActionButton } from './ToolbarButtons';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover';
import { cn } from '@/lib/utils';

export function ViewControlsGroup() {
  const { t } = useTranslation();
  const { toggleGrid, showGrid, snapSettings, toggleSnapOrthogonal, viewMode, cycleViewMode, showDimensions, toggleDimensions, triggerZoomToExtents, showSpaces, toggleSpaces, showSpaceLabels, toggleSpaceLabels } = useViewStore();

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
        title={t('view.cycleView')}
      />
      <ToggleButton
        icon={<RulerIcon size={20} />}
        label={t('view.ortho')}
        isActive={snapSettings.orthogonal}
        onClick={toggleSnapOrthogonal}
        title={t('view.orthoTooltip')}
      />
      {/* Display Dropdown */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            className={cn(
              'flex flex-col items-center justify-center p-2 rounded-md transition-colors',
              'hover:bg-accent hover:text-accent-foreground',
              (showGrid || showDimensions || showSpaces || showSpaceLabels) && 'bg-accent'
            )}
            title={t('view.displaySettings')}
          >
            <Eye size={20} />
            <span className="text-xs mt-1">{t('view.display')}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2" align="start">
          <div className="flex flex-col gap-1">
            <button
              onClick={toggleGrid}
              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent text-sm w-full text-left"
            >
              <div className={cn('w-4 h-4 flex items-center justify-center', showGrid ? 'text-primary' : 'text-transparent')}>
                <Check size={14} />
              </div>
              {t('view.grid')}
            </button>
            <button
              onClick={toggleDimensions}
              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent text-sm w-full text-left"
            >
              <div className={cn('w-4 h-4 flex items-center justify-center', showDimensions ? 'text-primary' : 'text-transparent')}>
                <Check size={14} />
              </div>
              {t('view.dimensions')}
            </button>
            <button
              onClick={toggleSpaces}
              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent text-sm w-full text-left"
            >
              <div className={cn('w-4 h-4 flex items-center justify-center', showSpaces ? 'text-primary' : 'text-transparent')}>
                <Check size={14} />
              </div>
              {t('view.spaces')}
            </button>
            <button
              onClick={toggleSpaceLabels}
              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent text-sm w-full text-left"
            >
              <div className={cn('w-4 h-4 flex items-center justify-center', showSpaceLabels ? 'text-primary' : 'text-transparent')}>
                <Check size={14} />
              </div>
              {t('view.spaceLabels')}
            </button>
          </div>
        </PopoverContent>
      </Popover>
      <ActionButton
        icon={<Focus size={20} />}
        label={t('view.zoom')}
        onClick={triggerZoomToExtents}
        shortcut="Shift+Z"
      />
    </div>
  );
}
