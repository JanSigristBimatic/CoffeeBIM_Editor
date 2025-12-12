import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useElementStore } from '@/store';
import { ActionButton } from './ToolbarButtons';

export function SpaceActionsGroup() {
  const { t } = useTranslation();
  const { getElementsByType, removeElements } = useElementStore();

  const spaces = getElementsByType('space');
  const hasSpaces = spaces.length > 0;

  const handleClearSpaces = () => {
    if (!hasSpaces) return;

    const confirmMessage = spaces.length === 1
      ? t('space.confirmDeleteOne')
      : t('space.confirmDeleteMany', { count: spaces.length });
    const confirmed = confirm(confirmMessage);
    if (confirmed) {
      removeElements(spaces.map((s) => s.id));
    }
  };

  return (
    <div className="flex items-center gap-1 border-r pr-2 mr-2">
      <ActionButton
        icon={<Trash2 size={20} />}
        label={t('space.clearSpaces')}
        onClick={handleClearSpaces}
        disabled={!hasSpaces}
      />
    </div>
  );
}
