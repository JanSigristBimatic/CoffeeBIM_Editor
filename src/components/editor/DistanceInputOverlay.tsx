import React from 'react';
import { useToolStore } from '@/store/useToolStore';

/**
 * Overlay component that displays the current distance input value
 * Shows a small badge near the cursor when distance input is active
 */
export const DistanceInputOverlay: React.FC = () => {
  const { distanceInput, activeTool } = useToolStore();

  // Only show for line-based tools
  const isLineBasedTool = activeTool === 'wall' || activeTool === 'slab' || activeTool === 'counter';

  if (!isLineBasedTool || !distanceInput.active || !distanceInput.value) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      {/* Bottom-center input display */}
      <div className="absolute bottom-24 left-1/2 -translate-x-1/2 transform">
        <div className="flex items-center gap-2 rounded-lg bg-slate-900/95 px-4 py-2 shadow-lg ring-1 ring-slate-700">
          <span className="text-xs text-slate-400">Distanz:</span>
          <span className="min-w-[60px] font-mono text-lg font-semibold text-white">
            {distanceInput.value}
          </span>
          <span className="text-sm text-slate-400">m</span>
          <div className="ml-2 flex items-center gap-1 border-l border-slate-700 pl-2">
            <kbd className="rounded bg-slate-700 px-1.5 py-0.5 text-xs text-slate-300">
              Enter
            </kbd>
            <span className="text-xs text-slate-500">OK</span>
          </div>
        </div>
      </div>
    </div>
  );
};
