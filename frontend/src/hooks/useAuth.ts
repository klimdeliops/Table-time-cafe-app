'use client';

import { useContext } from 'react';
import { AuthContext } from '@/contexts/AuthContext';
import type { AuthContextValue } from '@/contexts/AuthContext';

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
