'use client';

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  DEFAULT_LOCALE,
  LOCALE_LABELS,
  STORAGE_KEY,
  SUPPORTED_LOCALES,
  en,
  ru,
} from '@/lib/i18n';
import type { Locale } from '@/lib/i18n';
import type { Dictionary } from '@/lib/i18n/types';

type Dict = Dictionary;

const DICTS: Record<Locale, Dict> = { ru, en };

function resolve(dict: Record<string, unknown>, key: string): string {
  const parts = key.split('.');
  let cur: unknown = dict;
  for (const part of parts) {
    if (cur !== null && typeof cur === 'object') {
      cur = (cur as Record<string, unknown>)[part];
    } else {
      return key;
    }
  }
  return typeof cur === 'string' ? cur : key;
}

export interface LocaleContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
  localeLabel: string;
}

export const LocaleContext = createContext<LocaleContextValue>({
  locale:      DEFAULT_LOCALE,
  setLocale:   () => {},
  t:           (key) => key,
  localeLabel: LOCALE_LABELS[DEFAULT_LOCALE],
});

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
      if (stored && SUPPORTED_LOCALES.includes(stored)) {
        setLocaleState(stored);
      }
    } catch {
      // keep default locale
    }
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {}
  }, []);

  const t = useCallback(
    (key: string): string => {
      const primary  = DICTS[locale]       as unknown as Record<string, unknown>;
      const fallback = DICTS[DEFAULT_LOCALE] as unknown as Record<string, unknown>;

      const result = resolve(primary, key);
      if (result !== key) return result;

      const fallbackResult = resolve(fallback, key);
      if (fallbackResult !== key) return fallbackResult;

      return key;
    },
    [locale],
  );

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      t,
      localeLabel: LOCALE_LABELS[locale],
    }),
    [locale, setLocale, t],
  );

  return (
    <LocaleContext.Provider value={value}>
      {children}
    </LocaleContext.Provider>
  );
}
