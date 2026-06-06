'use client';

import { useContext } from 'react';
import { LocaleContext } from '@/contexts/LocaleContext';
import type { LocaleContextValue } from '@/contexts/LocaleContext';

/**
 * Returns the active locale, setLocale, and the t() translation function.
 *
 * Must be used inside <LocaleProvider>.
 * Outside a provider it returns safe no-op defaults (never throws).
 */
export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}
