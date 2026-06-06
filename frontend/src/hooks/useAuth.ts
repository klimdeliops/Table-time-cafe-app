'use client';

import { useContext } from 'react';
import { AuthContext } from '@/contexts/AuthContext';
import type { AuthContextValue } from '@/contexts/AuthContext';

/**
 * Returns the global auth state: user, loading, authenticated, refetch, logout.
 * Must be used inside <AuthProvider>. Outside returns safe no-op defaults.
 */
export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
