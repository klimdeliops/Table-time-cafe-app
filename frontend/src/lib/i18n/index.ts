export { default as ru } from './ru';
export { default as en } from './en';

export type Locale = 'ru' | 'en';

export const SUPPORTED_LOCALES: Locale[] = ['ru', 'en'];

export const LOCALE_LABELS: Record<Locale, string> = {
  ru: 'RU',
  en: 'EN',
};

export const STORAGE_KEY = 'tt_locale';

export const DEFAULT_LOCALE: Locale = 'ru';
