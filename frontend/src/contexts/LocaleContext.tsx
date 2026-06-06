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

// ── Dictionary resolution ────────────────────────────────────────────────────

type Dict = Dictionary;

const DICTS: Record<Locale, Dict> = { ru, en };

/**
 * Resolves a dot-notation key against a dictionary object.
 * Returns the key itself when the path doesn't exist.
 */
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

// ── Context shape ────────────────────────────────────────────────────────────

export interface LocaleContextValue {
  /** Active locale code */
  locale: Locale;
  /** Change locale and persist to localStorage */
  setLocale: (l: Locale) => void;
  /** Translate a dot-notation key. Falls back: active locale → ru → key */
  t: (key: string) => string;
  /** Human-readable locale label (e.g. "RU", "EN") */
  localeLabel: string;
}

// Safe no-op default so context consumers outside the provider don't crash
export const LocaleContext = createContext<LocaleContextValue>({
  locale:      DEFAULT_LOCALE,
  setLocale:   () => {},
  t:           (key) => key,
  localeLabel: LOCALE_LABELS[DEFAULT_LOCALE],
});

// ── Provider ─────────────────────────────────────────────────────────────────

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  // Server renders with default locale — client patches from localStorage on mount
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
      if (stored && SUPPORTED_LOCALES.includes(stored)) {
        setLocaleState(stored);
      }
    } catch {
      // localStorage unavailable (SSR guard, privacy mode) — keep default
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

      // Key missing in active locale — try the default locale
      const fallbackResult = resolve(fallback, key);
      if (fallbackResult !== key) return fallbackResult;

      // Unknown key — return raw key so UI never crashes or shows blank
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
