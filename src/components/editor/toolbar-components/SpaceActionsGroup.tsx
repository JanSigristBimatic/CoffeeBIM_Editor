import { Trash2 } from 'lucide-react';
import { useElementStore } from '@/store';
import { ActionButton } from './ToolbarButtons';

export function SpaceActionsGroup() {
  const { getElementsByType, removeElements } = useElementStore();

  const spaces = getElementsByType('space');
  const hasSpaces = spaces.length > 0;

  const handleClearSpaces = () => {
    if (!hasSpaces) return;

    const confirmed = confirm(`${spaces.length} Raum${spaces.length > 1 ? 'e' : ''} loschen?`);
    if (confirmed) {
      removeElements(spaces.map((s) => s.id));
    }
  };

  return (
    <div className="flex items-center gap-1 border-r pr-2 mr-2">
      <ActionButton
        icon={<Trash2 size={20} />}
        label="Raume loschen"
        onClick={handleClearSpaces}
        disabled={!hasSpaces}
      />
    </div>
  );
}
