import { useState } from 'react';
import {
  Magnet,
  Crosshair,
  Square,
  Triangle,
  CornerDownRight,
  X,
  Grid2X2,
} from 'lucide-react';
import { useViewStore } from '@/store';
import { cn } from '@/lib/utils';

interface SnapOptionButtonProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
  iconColor: string;
}

function SnapOptionButton({ icon, label, isActive, onClick, iconColor }: SnapOptionButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 w-full p-2 rounded-md transition-colors text-sm',
        'hover:bg-accent hover:text-accent-foreground',
        isActive && 'bg-accent'
      )}
    >
      <span className={iconColor}>{icon}</span>
      <span>{label}</span>
      {isActive && <span className="ml-auto text-xs text-green-500">&#10003;</span>}
    </button>
  );
}

export function SnapControlsGroup() {
  const {
    snapSettings,
    toggleSnapEndpoint,
    toggleSnapMidpoint,
    toggleSnapPerpendicular,
    toggleSnapNearest,
    toggleSnapGrid,
    setSnapSettings,
  } = useViewStore();

  const [showSnapMenu, setShowSnapMenu] = useState(false);

  return (
    <div className="flex items-center gap-1 border-r pr-2 mr-2 relative">
      <button
        onClick={() => setSnapSettings({ enabled: !snapSettings.enabled })}
        className={cn(
          'flex flex-col items-center justify-center p-2 rounded-md transition-colors',
          'hover:bg-accent hover:text-accent-foreground',
          snapSettings.enabled && 'bg-primary text-primary-foreground'
        )}
        title="Fangen ein/aus"
      >
        <Magnet size={20} />
        <span className="text-xs mt-1">Fangen</span>
      </button>
      <button
        onClick={() => setShowSnapMenu(!showSnapMenu)}
        className={cn(
          'flex flex-col items-center justify-center p-2 rounded-md transition-colors',
          'hover:bg-accent hover:text-accent-foreground',
          showSnapMenu && 'bg-accent'
        )}
        title="Fang-Optionen"
      >
        <Crosshair size={20} />
        <span className="text-xs mt-1">Optionen</span>
      </button>

      {showSnapMenu && (
        <div className="absolute top-full left-0 mt-1 p-2 bg-popover border rounded-md shadow-lg z-50 min-w-[180px]">
          <div className="text-xs font-medium mb-2 text-muted-foreground">Fang-Optionen</div>

          <SnapOptionButton
            icon={<Square size={16} />}
            label="Eckpunkte"
            isActive={snapSettings.endpoint}
            onClick={toggleSnapEndpoint}
            iconColor="text-green-500"
          />

          <SnapOptionButton
            icon={<Triangle size={16} />}
            label="Mittelpunkt"
            isActive={snapSettings.midpoint}
            onClick={toggleSnapMidpoint}
            iconColor="text-orange-500"
          />

          <SnapOptionButton
            icon={<CornerDownRight size={16} />}
            label="Lotrecht"
            isActive={snapSettings.perpendicular}
            onClick={toggleSnapPerpendicular}
            iconColor="text-blue-500"
          />

          <SnapOptionButton
            icon={<X size={16} />}
            label="Auf Linie"
            isActive={snapSettings.nearest}
            onClick={toggleSnapNearest}
            iconColor="text-fuchsia-500"
          />

          <SnapOptionButton
            icon={<Grid2X2 size={16} />}
            label="Raster"
            isActive={snapSettings.grid}
            onClick={toggleSnapGrid}
            iconColor="text-gray-500"
          />
        </div>
      )}
    </div>
  );
}
