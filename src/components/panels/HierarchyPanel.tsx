import { ChevronDown, ChevronRight, Building2, Layers, Box, Plus, Trash2, MapPin, LayoutGrid, DoorOpen, Columns, Square, Armchair, Pencil, Eye, EyeOff, ArrowUp, ArrowDown } from 'lucide-react';
import { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useProjectStore, useElementStore, useSelectionStore, useViewStore } from '@/store';
import { cn } from '@/lib/utils';
import type { BimElement } from '@/types/bim';
import { DEFAULT_STOREY_HEIGHT } from '@/types/bim';
import { getElementCenter } from '@/lib/geometry';

// Inline editable name component
interface EditableNameProps {
  value: string;
  onSave: (newValue: string) => void;
  className?: string;
}

// Inline editable number component for elevation
interface EditableElevationProps {
  value: number;
  onSave: (newValue: number) => void;
}

function EditableElevation({ value, onSave }: EditableElevationProps) {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value.toString());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditValue(value.toString());
  }, [value]);

  const handleSave = () => {
    const numValue = parseFloat(editValue);
    if (!isNaN(numValue) && numValue !== value) {
      onSave(numValue);
    } else {
      setEditValue(value.toString());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditValue(value.toString());
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="number"
        step="0.1"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className="px-1 py-0 text-xs border rounded bg-background w-16"
      />
    );
  }

  return (
    <span
      className="cursor-pointer hover:underline text-xs text-muted-foreground"
      onDoubleClick={() => setIsEditing(true)}
      title={t('hierarchy.doubleClickToEditElevation')}
    >
      +{value}m
    </span>
  );
}

function EditableName({ value, onSave, className }: EditableNameProps) {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== value) {
      onSave(trimmed);
    } else {
      setEditValue(value);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditValue(value);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className="px-1 py-0 text-sm border rounded bg-background w-full max-w-[150px]"
      />
    );
  }

  return (
    <span
      className={cn('cursor-pointer hover:underline group/name', className)}
      onDoubleClick={() => setIsEditing(true)}
      title={t('hierarchy.doubleClickToEdit')}
    >
      {value}
      <Pencil
        size={10}
        className="inline ml-1 opacity-0 group-hover/name:opacity-50 transition-opacity"
      />
    </span>
  );
}

export function HierarchyPanel() {
  const { t } = useTranslation();
  const {
    project, site, building, storeys, activeStoreyId,
    setActiveStorey, addStorey, removeStorey, updateStorey,
    setProjectName, setSiteName, setBuildingName
  } = useProjectStore();
  const { getElementsByStorey } = useElementStore();
  const { select, isSelected } = useSelectionStore();
  const { focusOnPosition, showStoreyAbove, showStoreyBelow, toggleStoreyAbove, toggleStoreyBelow } = useViewStore();

  // Find adjacent storeys for display labels
  const adjacentStoreys = useMemo(() => {
    if (!activeStoreyId) return { above: null, below: null };
    const sortedStoreys = [...storeys].sort((a, b) => a.elevation - b.elevation);
    const activeIndex = sortedStoreys.findIndex((s) => s.id === activeStoreyId);
    if (activeIndex === -1) return { above: null, below: null };
    return {
      above: sortedStoreys[activeIndex + 1] ?? null,
      below: sortedStoreys[activeIndex - 1] ?? null,
    };
  }, [storeys, activeStoreyId]);

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
      alert(t('hierarchy.atLeastOneStoreyRequired'));
      return;
    }
    if (confirm(t('hierarchy.confirmDeleteStorey'))) {
      removeStorey(storeyId);
    }
  };

  const handleFocusElement = (element: BimElement) => {
    const center = getElementCenter(element);
    focusOnPosition(center);
  };

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-4">{t('hierarchy.projectStructure')}</h2>

      <div className="space-y-1 text-sm">
        {/* Project */}
        <div className="flex items-center gap-2 py-1 group">
          <Building2 size={16} className="text-muted-foreground" />
          <EditableName
            value={project.name}
            onSave={setProjectName}
            className="font-medium"
          />
        </div>

        {/* Site */}
        <div className="flex items-center gap-2 py-1 pl-4 group">
          <MapPin size={14} className="text-muted-foreground" />
          <EditableName value={site.name} onSave={setSiteName} />
        </div>

        {/* Building */}
        <div className="flex items-center gap-2 py-1 pl-8 group">
          <Building2 size={14} className="text-muted-foreground" />
          <EditableName value={building.name} onSave={setBuildingName} />
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
                <EditableName
                  value={storey.name}
                  onSave={(name) => updateStorey(storey.id, { name })}
                  className={cn(isActive && 'font-medium')}
                />
                <EditableElevation
                  value={storey.elevation}
                  onSave={(elevation) => updateStorey(storey.id, { elevation })}
                />
                <span className="text-xs text-muted-foreground ml-auto">
                  ({elements.length})
                </span>
                <button
                  onClick={(e) => handleDeleteStorey(storey.id, e)}
                  className="p-0.5 hover:bg-destructive hover:text-destructive-foreground rounded opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                  title={t('hierarchy.deleteStorey')}
                >
                  <Trash2 size={12} />
                </button>
              </div>

              {/* Elements */}
              {isExpanded && (
                <div className="pl-20 space-y-0.5">
                  {elements.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-1">{t('hierarchy.noElements')}</p>
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

        {/* Ghost Storey Visibility Controls */}
        <div className="pl-12 pt-3 pb-2 border-t border-border/50 mt-2">
          <p className="text-xs font-medium text-muted-foreground mb-2">{t('hierarchy.storeyDisplay')}</p>
          <div className="space-y-1">
            {/* Show storey above toggle */}
            <button
              onClick={toggleStoreyAbove}
              disabled={!adjacentStoreys.above}
              className={cn(
                'flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded transition-colors',
                adjacentStoreys.above
                  ? showStoreyAbove
                    ? 'bg-primary/10 text-primary hover:bg-primary/20'
                    : 'hover:bg-accent text-muted-foreground'
                  : 'opacity-50 cursor-not-allowed text-muted-foreground'
              )}
              title={adjacentStoreys.above ? t('hierarchy.showStorey', { name: adjacentStoreys.above.name }) : t('hierarchy.noStoreyAbove')}
            >
              <ArrowUp size={14} />
              {showStoreyAbove ? <Eye size={14} /> : <EyeOff size={14} />}
              <span className="truncate">
                {adjacentStoreys.above ? adjacentStoreys.above.name : t('hierarchy.noStoreyAbove')}
              </span>
            </button>

            {/* Show storey below toggle */}
            <button
              onClick={toggleStoreyBelow}
              disabled={!adjacentStoreys.below}
              className={cn(
                'flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded transition-colors',
                adjacentStoreys.below
                  ? showStoreyBelow
                    ? 'bg-primary/10 text-primary hover:bg-primary/20'
                    : 'hover:bg-accent text-muted-foreground'
                  : 'opacity-50 cursor-not-allowed text-muted-foreground'
              )}
              title={adjacentStoreys.below ? t('hierarchy.showStorey', { name: adjacentStoreys.below.name }) : t('hierarchy.noStoreyBelow')}
            >
              <ArrowDown size={14} />
              {showStoreyBelow ? <Eye size={14} /> : <EyeOff size={14} />}
              <span className="truncate">
                {adjacentStoreys.below ? adjacentStoreys.below.name : t('hierarchy.noStoreyBelow')}
              </span>
            </button>
          </div>
        </div>

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
                placeholder={t('hierarchy.storeyNamePlaceholder')}
                className="flex-1 px-2 py-1 text-xs border rounded bg-background"
                autoFocus
              />
              <button
                onClick={handleAddStorey}
                className="p-1 hover:bg-accent rounded text-primary"
                title={t('hierarchy.add')}
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
              <span>{t('hierarchy.addStorey')}</span>
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
        return <LayoutGrid size={12} />;
      case 'door':
        return <DoorOpen size={12} />;
      case 'window':
        return <Square size={12} />;
      case 'column':
        return <Columns size={12} />;
      case 'slab':
        return <Square size={12} />;
      case 'furniture':
        return <Armchair size={12} />;
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
