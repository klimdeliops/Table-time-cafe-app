'use client';

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiError } from '@/shared/api/client';

// ── Types ────────────────────────────────────────────────────────────────────

export type UserRole = 'GUEST' | 'USER' | 'WAITER' | 'ADMIN';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface AuthContextValue {
  user:          AuthUser | null;
  loading:       boolean;
  authenticated: boolean;
  refetch:       () => Promise<void>;
  logout:        () => Promise<void>;
}

// ── Context (safe defaults — never throws outside provider) ──────────────────

export const AuthContext = createContext<AuthContextValue>({
  user:          null,
  loading:       true,
  authenticated: false,
  refetch:       async () => {},
  logout:        async () => {},
});

// ── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const [user,    setUser]    = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const data = await apiFetch<AuthUser>('/api/users/me');
      setUser(data);
    } catch (err) {
      // 401 → not authenticated; any other error → treat as unauthenticated
      if (err instanceof ApiError) {
        setUser(null);
      }
      // Network errors: keep user null, still mark loading as done
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch once on mount. React 18 StrictMode runs effects twice in dev —
  // the extra call is harmless (returns the same cached cookie response).
  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const refetch = useCallback(async () => {
    setLoading(true);
    await fetchUser();
  }, [fetchUser]);

  const logout = useCallback(async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setUser(null);
    router.push('/');
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      authenticated: user !== null,
      refetch,
      logout,
    }),
    [user, loading, refetch, logout],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
