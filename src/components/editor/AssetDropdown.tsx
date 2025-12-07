import { useState, useRef, useEffect } from 'react';
import { Package, ChevronDown, ChevronRight, RotateCw, RotateCcw } from 'lucide-react';
import { useToolStore } from '@/store';
import { ASSET_CATALOG, getAssetById, type AssetCategory, type AssetItem } from '@/lib/assets';
import { cn } from '@/lib/utils';

interface AssetDropdownProps {
  className?: string;
}

export function AssetDropdown({ className }: AssetDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    activeTool,
    setActiveTool,
    assetPlacement,
    setSelectedAsset,
    setAssetRotation,
  } = useToolStore();

  const selectedAssetId = assetPlacement.params.assetId;
  const selectedAsset = selectedAssetId ? getAssetById(selectedAssetId) : null;
  const rotation = assetPlacement.params.rotation;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAssetSelect = (asset: AssetItem) => {
    setSelectedAsset(asset.id);
    setActiveTool('asset');
    setIsOpen(false);
  };

  const handleCategoryClick = (categoryId: string) => {
    setExpandedCategory(expandedCategory === categoryId ? null : categoryId);
  };

  const handleRotateLeft = (e: React.MouseEvent) => {
    e.stopPropagation();
    setAssetRotation((rotation - 45 + 360) % 360);
  };

  const handleRotateRight = (e: React.MouseEvent) => {
    e.stopPropagation();
    setAssetRotation((rotation + 45) % 360);
  };

  const isAssetToolActive = activeTool === 'asset';

  return (
    <div ref={dropdownRef} className={cn('relative', className)}>
      {/* Main Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-1 px-3 py-2 rounded-md transition-colors',
          'hover:bg-accent hover:text-accent-foreground',
          'focus:outline-none focus:ring-2 focus:ring-ring',
          isAssetToolActive && 'bg-primary text-primary-foreground'
        )}
        title="Assets platzieren"
      >
        <Package size={20} />
        <span className="text-xs">Assets</span>
        <ChevronDown size={14} className={cn('transition-transform', isOpen && 'rotate-180')} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-popover border rounded-md shadow-lg z-50 overflow-hidden">
          {/* Header with rotation controls */}
          {selectedAsset && (
            <div className="p-2 border-b bg-muted/50">
              <div className="text-xs font-medium text-muted-foreground mb-1">Ausgewählt:</div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium truncate">{selectedAsset.name}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleRotateLeft}
                    className="p-1 rounded hover:bg-accent"
                    title="45° links drehen"
                  >
                    <RotateCcw size={14} />
                  </button>
                  <span className="text-xs text-muted-foreground min-w-[32px] text-center">
                    {rotation}°
                  </span>
                  <button
                    onClick={handleRotateRight}
                    className="p-1 rounded hover:bg-accent"
                    title="45° rechts drehen"
                  >
                    <RotateCw size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Categories */}
          <div className="max-h-80 overflow-y-auto">
            {ASSET_CATALOG.map((category) => (
              <CategorySection
                key={category.id}
                category={category}
                isExpanded={expandedCategory === category.id}
                selectedAssetId={selectedAssetId}
                onCategoryClick={() => handleCategoryClick(category.id)}
                onAssetSelect={handleAssetSelect}
              />
            ))}
          </div>

          {/* Footer hint */}
          <div className="p-2 border-t bg-muted/30">
            <p className="text-xs text-muted-foreground">
              Wähle ein Asset und klicke in die Szene zum Platzieren
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

interface CategorySectionProps {
  category: AssetCategory;
  isExpanded: boolean;
  selectedAssetId: string | null;
  onCategoryClick: () => void;
  onAssetSelect: (asset: AssetItem) => void;
}

function CategorySection({
  category,
  isExpanded,
  selectedAssetId,
  onCategoryClick,
  onAssetSelect,
}: CategorySectionProps) {
  return (
    <div className="border-b last:border-b-0">
      {/* Category Header */}
      <button
        onClick={onCategoryClick}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent transition-colors"
      >
        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className="text-sm font-medium flex-1 text-left">{category.name}</span>
        <span className="text-xs text-muted-foreground">{category.items.length}</span>
      </button>

      {/* Category Items */}
      {isExpanded && (
        <div className="bg-muted/30 py-1">
          {category.items.map((item) => (
            <button
              key={item.id}
              onClick={() => onAssetSelect(item)}
              className={cn(
                'w-full flex items-center gap-2 px-6 py-1.5 text-left hover:bg-accent transition-colors',
                selectedAssetId === item.id && 'bg-primary/10 text-primary'
              )}
            >
              <span className="text-sm">{item.name}</span>
              <span className="text-xs text-muted-foreground ml-auto">
                {item.dimensions.width.toFixed(1)}×{item.dimensions.depth.toFixed(1)}m
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
