import { FileImage, Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePdfUnderlayStore } from '@/store';
import { cn } from '@/lib/utils';

interface PdfUnderlayGroupProps {
  onOpenPdfDialog: () => void;
}

export function PdfUnderlayGroup({ onOpenPdfDialog }: PdfUnderlayGroupProps) {
  const { t } = useTranslation();
  const { isLoaded: hasPdf, isVisible: pdfVisible, toggleVisible: togglePdfVisible } = usePdfUnderlayStore();

  return (
    <div className="flex items-center gap-1 border-r pr-2 mr-2">
      <button
        onClick={onOpenPdfDialog}
        className={cn(
          'flex flex-col items-center justify-center p-2 rounded-md transition-colors',
          'hover:bg-accent hover:text-accent-foreground',
          hasPdf && 'bg-accent'
        )}
        title={t('pdf.loadPdf')}
      >
        <FileImage size={20} />
        <span className="text-xs mt-1">PDF</span>
      </button>
      {hasPdf && (
        <button
          onClick={togglePdfVisible}
          className={cn(
            'flex flex-col items-center justify-center p-2 rounded-md transition-colors',
            'hover:bg-accent hover:text-accent-foreground',
            pdfVisible && 'bg-accent'
          )}
          title={t('pdf.togglePdf')}
        >
          {pdfVisible ? <Eye size={20} /> : <EyeOff size={20} />}
          <span className="text-xs mt-1">{pdfVisible ? t('pdf.on') : t('pdf.off')}</span>
        </button>
      )}
    </div>
  );
}
