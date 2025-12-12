import {
  MousePointer2,
  Square,
  DoorOpen,
  Columns3,
  LayoutGrid,
  RectangleHorizontal,
  ScanSearch,
  PenTool,
  TrendingUp,
  Grid2x2,
  Ruler,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ToolButton } from './ToolbarButtons';
import { AssetDropdown } from '../AssetDropdown';

export function ToolSelectionGroup() {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-1 border-r pr-2 mr-2">
      <ToolButton
        tool="select"
        icon={<MousePointer2 size={20} />}
        label={t('toolbar.select')}
        shortcut="A"
      />
      <ToolButton tool="slab" icon={<LayoutGrid size={20} />} label={t('toolbar.slab')} shortcut="B" />
      <ToolButton tool="wall" icon={<Square size={20} />} label={t('toolbar.wall')} shortcut="W" />
      <ToolButton tool="door" icon={<DoorOpen size={20} />} label={t('toolbar.door')} shortcut="T" />
      <ToolButton tool="window" icon={<Grid2x2 size={20} />} label={t('toolbar.window')} shortcut="F" />
      <ToolButton tool="column" icon={<Columns3 size={20} />} label={t('toolbar.column')} shortcut="S" />
      <ToolButton tool="counter" icon={<RectangleHorizontal size={20} />} label={t('toolbar.counter')} shortcut="K" />
      <ToolButton tool="stair" icon={<TrendingUp size={20} />} label={t('toolbar.stair')} shortcut="Shift+S" />
      <ToolButton
        tool="space-detect"
        icon={<ScanSearch size={20} />}
        label={t('toolbar.spaceDetect')}
        shortcut="R"
      />
      <ToolButton
        tool="space-draw"
        icon={<PenTool size={20} />}
        label={t('toolbar.spaceDraw')}
        shortcut="Shift+R"
      />
      <ToolButton
        tool="measure"
        icon={<Ruler size={20} />}
        label={t('toolbar.measure')}
        shortcut="M"
      />
      <AssetDropdown />
    </div>
  );
}
