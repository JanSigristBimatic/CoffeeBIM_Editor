import { ChevronDown, ChevronRight, Building2, Layers, Box, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useProjectStore, useElementStore, useSelectionStore, useViewStore } from '@/store';
import { cn } from '@/lib/utils';
import type { BimElement } from '@/types/bim';
import { DEFAULT_STOREY_HEIGHT } from '@/types/bim';
import { getElementCenter } from '@/lib/geometry';

export function HierarchyPanel() {
  const { project, site, building, storeys, activeStoreyId, setActiveStorey, addStorey, removeStorey } = useProjectStore();
  const { getElementsByStorey } = useElementStore();
  const { select, isSelected } = useSelectionStore();
  const { focusOnPosition } = useViewStore();

  const [expandedStoreys, setExpandedStoreys] = useState<Set<string>>(
    new Set(storeys.map((s) => s.id))
  );
  const [isAddingStorey, setIsAddingStorey] = useState(false);
  const [newStoreyName, setNewStoreyName] = useState('');

  const toggleStorey = (storeyId: string) => {
    setExpandedStoreys((prev) => {
      const next = new Set(prev);
      if (next.has(storeyId)) {
        next.delete(storeyId);
      } else {
        next.add(storeyId);
      }
      return next;
    });
  };

  const handleAddStorey = () => {
    if (!newStoreyName.trim()) return;

    // Calculate elevation based on existing storeys
    const maxElevation = storeys.reduce((max, s) => Math.max(max, s.elevation + s.height), 0);
    const newId = addStorey(newStoreyName.trim(), maxElevation, DEFAULT_STOREY_HEIGHT);

    // Expand and activate the new storey
    setExpandedStoreys((prev) => new Set([...prev, newId]));
    setActiveStorey(newId);

    // Reset form
    setNewStoreyName('');
    setIsAddingStorey(false);
  };

  const handleDeleteStorey = (storeyId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (storeys.length <= 1) {
      alert('Mindestens ein Stockwerk muss vorhanden sein.');
      return;
    }
    if (confirm('Stockwerk und alle zugehörigen Elemente löschen?')) {
      removeStorey(storeyId);
    }
  };

  const handleFocusElement = (element: BimElement) => {
    const center = getElementCenter(element);
    focusOnPosition(center);
  };

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-4">Projektstruktur</h2>

      <div className="space-y-1 text-sm">
        {/* Project */}
        <div className="flex items-center gap-2 py-1">
          <Building2 size={16} className="text-muted-foreground" />
          <span className="font-medium">{project.name}</span>
        </div>

        {/* Site */}
        <div className="flex items-center gap-2 py-1 pl-4">
          <span className="text-muted-foreground">📍</span>
          <span>{site.name}</span>
        </div>

        {/* Building */}
        <div className="flex items-center gap-2 py-1 pl-8">
          <Building2 size={14} className="text-muted-foreground" />
          <span>{building.name}</span>
        </div>

        {/* Storeys */}
        {storeys.map((storey) => {
          const elements = getElementsByStorey(storey.id);
          const isExpanded = expandedStoreys.has(storey.id);
          const isActive = activeStoreyId === storey.id;

          return (
            <div key={storey.id}>
              {/* Storey Header */}
              <div
                className={cn(
                  'flex items-center gap-1 py-1 pl-12 pr-2 cursor-pointer rounded group',
                  'hover:bg-accent',
                  isActive && 'bg-accent'
                )}
                onClick={() => setActiveStorey(storey.id)}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleStorey(storey.id);
                  }}
                  className="p-0.5 hover:bg-muted rounded"
                >
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                <Layers size={14} className="text-muted-foreground" />
                <span className={cn(isActive && 'font-medium')}>{storey.name}</span>
                <span className="text-xs text-muted-foreground ml-1">
                  +{storey.elevation}m
                </span>
                <span className="text-xs text-muted-foreground ml-auto">
                  ({elements.length})
                </span>
                <button
                  onClick={(e) => handleDeleteStorey(storey.id, e)}
                  className="p-0.5 hover:bg-destructive hover:text-destructive-foreground rounded opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                  title="Stockwerk löschen"
                >
                  <Trash2 size={12} />
                </button>
              </div>

              {/* Elements */}
              {isExpanded && (
                <div className="pl-20 space-y-0.5">
                  {elements.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-1">Keine Elemente</p>
                  ) : (
                    elements.map((element) => (
                      <ElementItem
                        key={element.id}
                        element={element}
                        isSelected={isSelected(element.id)}
                        onSelect={() => select(element.id)}
                        onDoubleClick={() => handleFocusElement(element)}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Add Storey Section */}
        <div className="pl-12 pt-2">
          {isAddingStorey ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={newStoreyName}
                onChange={(e) => setNewStoreyName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddStorey();
                  if (e.key === 'Escape') setIsAddingStorey(false);
                }}
                placeholder="Stockwerk-Name"
                className="flex-1 px-2 py-1 text-xs border rounded bg-background"
                autoFocus
              />
              <button
                onClick={handleAddStorey}
                className="p-1 hover:bg-accent rounded text-primary"
                title="Hinzufügen"
              >
                <Plus size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsAddingStorey(true)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Plus size={12} />
              <span>Stockwerk hinzufügen</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface ElementItemProps {
  element: BimElement;
  isSelected: boolean;
  onSelect: () => void;
  onDoubleClick: () => void;
}

function ElementItem({ element, isSelected, onSelect, onDoubleClick }: ElementItemProps) {
  const getIcon = () => {
    switch (element.type) {
      case 'wall':
        return '🧱';
      case 'door':
        return '🚪';
      case 'window':
        return '🪟';
      case 'column':
        return '🏛️';
      case 'slab':
        return '⬜';
      case 'furniture':
        return '🪑';
      default:
        return <Box size={12} />;
    }
  };

  return (
    <div
      className={cn(
        'flex items-center gap-2 py-1 px-2 cursor-pointer rounded text-xs',
        'hover:bg-accent',
        isSelected && 'bg-primary text-primary-foreground'
      )}
      onClick={onSelect}
      onDoubleClick={onDoubleClick}
    >
      <span>{getIcon()}</span>
      <span className="truncate">{element.name}</span>
    </div>
  );
}
