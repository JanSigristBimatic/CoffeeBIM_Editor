import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import de from './locales/de/translation.json';
import en from './locales/en/translation.json';

export const resources = {
  de: { translation: de },
  en: { translation: en },
} as const;

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'de', // Default German
    fallbackLng: 'de',
    interpolation: {
      escapeValue: false, // React already escapes
    },
  });

export default i18n;
