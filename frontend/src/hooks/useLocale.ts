'use client';

import { useContext } from 'react';
import { LocaleContext } from '@/contexts/LocaleContext';
import type { LocaleContextValue } from '@/contexts/LocaleContext';

export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}
