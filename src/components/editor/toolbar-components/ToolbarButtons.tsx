import { useToolStore } from '@/store';
import type { ToolType } from '@/types/tools';
import { cn } from '@/lib/utils';

interface ToolButtonProps {
  tool: ToolType;
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
}

export function ToolButton({ tool, icon, label, shortcut }: ToolButtonProps) {
  const { activeTool, setActiveTool } = useToolStore();
  const isActive = activeTool === tool;

  return (
    <button
      onClick={() => setActiveTool(tool)}
      className={cn(
        'flex flex-col items-center justify-center p-2 rounded-md transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
        'focus:outline-none focus:ring-2 focus:ring-ring',
        isActive && 'bg-primary text-primary-foreground'
      )}
      title={`${label}${shortcut ? ` (${shortcut})` : ''}`}
    >
      {icon}
      <span className="text-xs mt-1">{label}</span>
    </button>
  );
}

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  shortcut?: string;
}

export function ActionButton({ icon, label, onClick, disabled, shortcut }: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex flex-col items-center justify-center p-2 rounded-md transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
        'focus:outline-none focus:ring-2 focus:ring-ring',
        'disabled:opacity-50 disabled:cursor-not-allowed'
      )}
      title={`${label}${shortcut ? ` (${shortcut})` : ''}`}
    >
      {icon}
      <span className="text-xs mt-1">{label}</span>
    </button>
  );
}

interface ToggleButtonProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
  title?: string;
}

export function ToggleButton({ icon, label, isActive, onClick, title }: ToggleButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center justify-center p-2 rounded-md transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
        isActive && 'bg-accent'
      )}
      title={title}
    >
      {icon}
      <span className="text-xs mt-1">{label}</span>
    </button>
  );
}
