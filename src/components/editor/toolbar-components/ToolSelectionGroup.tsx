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
import { ToolButton } from './ToolbarButtons';
import { AssetDropdown } from '../AssetDropdown';

export function ToolSelectionGroup() {
  return (
    <div className="flex items-center gap-1 border-r pr-2 mr-2">
      <ToolButton
        tool="select"
        icon={<MousePointer2 size={20} />}
        label="Auswahl"
        shortcut="A"
      />
      <ToolButton tool="slab" icon={<LayoutGrid size={20} />} label="Boden" shortcut="B" />
      <ToolButton tool="wall" icon={<Square size={20} />} label="Wand" shortcut="W" />
      <ToolButton tool="door" icon={<DoorOpen size={20} />} label="Tur" shortcut="T" />
      <ToolButton tool="window" icon={<Grid2x2 size={20} />} label="Fenster" shortcut="F" />
      <ToolButton tool="column" icon={<Columns3 size={20} />} label="Saule" shortcut="S" />
      <ToolButton tool="counter" icon={<RectangleHorizontal size={20} />} label="Theke" shortcut="K" />
      <ToolButton tool="stair" icon={<TrendingUp size={20} />} label="Treppe" shortcut="Shift+S" />
      <ToolButton
        tool="space-detect"
        icon={<ScanSearch size={20} />}
        label="Raum erkennen"
        shortcut="R"
      />
      <ToolButton
        tool="space-draw"
        icon={<PenTool size={20} />}
        label="Raum zeichnen"
        shortcut="Shift+R"
      />
      <ToolButton
        tool="measure"
        icon={<Ruler size={20} />}
        label="Messen"
        shortcut="M"
      />
      <AssetDropdown />
    </div>
  );
}
