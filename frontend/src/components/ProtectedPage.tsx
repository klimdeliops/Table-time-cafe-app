'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import type { UserRole } from '@/contexts/AuthContext';

interface ProtectedPageProps {
  /** Allowed roles. Omit to allow any authenticated user. */
  roles?: UserRole[];
  children: React.ReactNode;
}

/**
 * Wraps a page to require authentication (and optionally a specific role).
 *
 * - While auth loads: shows a neutral loading screen.
 * - Unauthenticated: redirects to /login.
 * - Wrong role: redirects to /.
 * - Authorized: renders children.
 */
export function ProtectedPage({ roles, children }: ProtectedPageProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    if (roles && !roles.includes(user.role)) {
      router.push('/');
    }
  }, [loading, user, roles, router]);

  if (loading) {
    return (
      <main className="min-h-[80vh] flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading…</p>
      </main>
    );
  }

  if (!user || (roles && !roles.includes(user.role))) {
    return null;
  }

  return <>{children}</>;
}
