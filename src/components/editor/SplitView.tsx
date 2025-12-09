import { useRef, useState, useCallback } from 'react';
import { useViewStore } from '@/store';
import { cn } from '@/lib/utils';
import { Canvas2D } from './Canvas2D';
import { Canvas3D } from './Canvas3D';
import { BoxSelectionOverlay } from './BoxSelection3D';

export function SplitView() {
  const { viewMode, splitRatio, setSplitRatio } = useViewStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      setSplitRatio(ratio);
    },
    [isDragging, setSplitRatio]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Only 2D view
  if (viewMode === '2d') {
    return (
      <div className="w-full h-full">
        <Canvas2D />
      </div>
    );
  }

  // Only 3D view
  if (viewMode === '3d') {
    return (
      <div className="w-full h-full relative">
        <Canvas3D />
        <BoxSelectionOverlay />
      </div>
    );
  }

  // Split view (2D left, 3D right)
  const primarySize = `${splitRatio * 100}%`;
  const secondarySize = `${(1 - splitRatio) * 100}%`;

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex flex-row"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* 2D Panel (left) */}
      <div style={{ width: primarySize }} className="overflow-hidden">
        <Canvas2D />
      </div>

      {/* Splitter */}
      <div
        onMouseDown={handleMouseDown}
        className={cn(
          'flex-shrink-0 w-1 cursor-col-resize bg-border hover:bg-primary/50 transition-colors',
          isDragging && 'bg-primary'
        )}
      />

      {/* 3D Panel (right) */}
      <div style={{ width: secondarySize }} className="overflow-hidden relative">
        <Canvas3D />
        <BoxSelectionOverlay />
      </div>
    </div>
  );
}
