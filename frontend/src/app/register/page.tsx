'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useLocale } from '@/hooks/useLocale';
import { useAuth } from '@/hooks/useAuth';
import { apiFetch, ApiError } from '@/shared/api/client';

// ── Eye icons ─────────────────────────────────────────────────────────────────

function EyeOpen() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOff() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

// ── Brand mark ────────────────────────────────────────────────────────────────

function BrandMark() {
  return (
    <div className="text-center space-y-2">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-amber/15 text-2xl">
        ☕
      </div>
      <p className="text-sm font-semibold tracking-tight text-brand-espresso/60">
        Table <span className="text-brand-amber">&</span> Time
      </p>
    </div>
  );
}

// ── Register form ─────────────────────────────────────────────────────────────

function RegisterForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { t }        = useLocale();
  const { refetch }  = useAuth();
  const redirect     = searchParams.get('redirect') ?? '/';

  const [email,    setEmail]    = useState('');
  const [password, setPwd]      = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [showPwd,  setShowPwd]  = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  function validate(): string {
    if (password.length < 8) return t('auth.passwordTooShort');
    if (password !== confirm)  return t('auth.passwordMismatch');
    return '';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setError('');
    setLoading(true);
    try {
      await apiFetch('/api/auth/register', {
        method: 'POST',
        body: { email, password },
      });
      await refetch();
      router.push(redirect);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError(t('auth.registerError'));
      } else {
        setError(err instanceof ApiError ? err.message : t('auth.registerError'));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass-modal rounded-3xl p-8 w-full max-w-sm space-y-6 animate-fade-up relative z-10">
      <BrandMark />

      <h1 className="text-xl font-bold text-brand-espresso text-center">
        {t('auth.registerTitle')}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Email */}
        <div className="space-y-1.5">
          <label htmlFor="reg-email" className="block text-sm font-medium text-brand-espresso/70">
            {t('auth.email')}
          </label>
          <input
            id="reg-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="glass-input w-full rounded-xl px-4 py-3 text-sm text-brand-espresso placeholder:text-brand-espresso/30"
          />
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <label htmlFor="reg-password" className="block text-sm font-medium text-brand-espresso/70">
            {t('auth.password')}
          </label>
          <div className="relative">
            <input
              id="reg-password"
              type={showPwd ? 'text' : 'password'}
              required
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={e => { setPwd(e.target.value); if (error) setError(''); }}
              placeholder="••••••••"
              className="glass-input w-full rounded-xl px-4 py-3 pr-12 text-sm text-brand-espresso placeholder:text-brand-espresso/30"
            />
            <button
              type="button"
              onClick={() => setShowPwd(p => !p)}
              aria-label={showPwd ? t('auth.hidePassword') : t('auth.showPassword')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-espresso/35 hover:text-brand-espresso/70 transition-colors p-1 rounded-lg"
            >
              {showPwd ? <EyeOff /> : <EyeOpen />}
            </button>
          </div>
        </div>

        {/* Confirm password */}
        <div className="space-y-1.5">
          <label htmlFor="reg-confirm" className="block text-sm font-medium text-brand-espresso/70">
            {t('auth.confirmPassword')}
          </label>
          <div className="relative">
            <input
              id="reg-confirm"
              type={showConf ? 'text' : 'password'}
              required
              autoComplete="new-password"
              value={confirm}
              onChange={e => { setConfirm(e.target.value); if (error) setError(''); }}
              placeholder="••••••••"
              className="glass-input w-full rounded-xl px-4 py-3 pr-12 text-sm text-brand-espresso placeholder:text-brand-espresso/30"
            />
            <button
              type="button"
              onClick={() => setShowConf(p => !p)}
              aria-label={showConf ? t('auth.hidePassword') : t('auth.showPassword')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-espresso/35 hover:text-brand-espresso/70 transition-colors p-1 rounded-lg"
            >
              {showConf ? <EyeOff /> : <EyeOpen />}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div role="alert" className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <span className="shrink-0 mt-px" aria-hidden="true">⚠</span>
            <span>{error}</span>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="btn-amber w-full rounded-xl py-3 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" aria-hidden="true" />
              {t('common.loading')}
            </span>
          ) : t('auth.signUp')}
        </button>
      </form>

      <p className="text-sm text-center text-brand-espresso/50">
        {t('auth.hasAccount')}{' '}
        <Link
          href={`/login${redirect !== '/' ? `?redirect=${encodeURIComponent(redirect)}` : ''}`}
          className="text-brand-espresso font-semibold hover:text-brand-amber transition-colors duration-150"
        >
          {t('auth.signIn')}
        </Link>
      </p>
    </div>
  );
}

// ── Page shell ────────────────────────────────────────────────────────────────

export default function RegisterPage() {
  return (
    <div className="relative -mt-[68px] h-screen overflow-hidden flex items-center justify-center px-4">
      <div className="auth-blob-1" aria-hidden="true" />
      <div className="auth-blob-2" aria-hidden="true" />
      <div className="auth-blob-3" aria-hidden="true" />

      <Suspense fallback={
        <div className="glass-modal rounded-3xl p-8 w-full max-w-sm flex items-center justify-center h-64 relative z-10">
          <span className="w-6 h-6 rounded-full border-2 border-brand-espresso/20 border-t-brand-espresso animate-spin" aria-label="Loading" />
        </div>
      }>
        <RegisterForm />
      </Suspense>
    </div>
  );
}
