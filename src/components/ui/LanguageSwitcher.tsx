import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    const newLang = i18n.language === 'de' ? 'en' : 'de';
    i18n.changeLanguage(newLang);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleLanguage}
      title={i18n.language === 'de' ? 'Switch to English' : 'Zu Deutsch wechseln'}
    >
      <Globe size={16} />
      <span className="ml-1 text-xs font-medium uppercase">{i18n.language}</span>
    </Button>
  );
}
