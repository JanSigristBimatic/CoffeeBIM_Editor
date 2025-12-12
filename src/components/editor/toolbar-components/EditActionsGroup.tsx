import { Undo, Redo, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSelectionStore, useElementStore } from '@/store';
import { useHistory } from '@/hooks';
import { ActionButton } from './ToolbarButtons';

export function EditActionsGroup() {
  const { t } = useTranslation();
  const { getSelectedIds, clearSelection } = useSelectionStore();
  const { removeElements } = useElementStore();
  const { undo, redo, canUndo, canRedo } = useHistory();

  const selectedIds = getSelectedIds();
  const hasSelection = selectedIds.length > 0;

  const handleDelete = () => {
    if (hasSelection) {
      removeElements(selectedIds);
      clearSelection();
    }
  };

  return (
    <div className="flex items-center gap-1 border-r pr-2 mr-2">
      <ActionButton
        icon={<Undo size={20} />}
        label={t('edit.undo')}
        onClick={undo}
        disabled={!canUndo}
        shortcut="Ctrl+Z"
      />
      <ActionButton
        icon={<Redo size={20} />}
        label={t('edit.redo')}
        onClick={redo}
        disabled={!canRedo}
        shortcut="Ctrl+Y"
      />
      <ActionButton
        icon={<Trash2 size={20} />}
        label={t('edit.delete')}
        onClick={handleDelete}
        disabled={!hasSelection}
        shortcut="Del"
      />
    </div>
  );
}
