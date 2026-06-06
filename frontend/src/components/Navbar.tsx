'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useLocale } from '@/hooks/useLocale';
import { useToast } from '@/contexts/ToastContext';
import { SUPPORTED_LOCALES, LOCALE_LABELS } from '@/lib/i18n';
import type { Locale } from '@/lib/i18n';

// ── Nav item definitions ─────────────────────────────────────────────────────

type NavLink   = { kind: 'link';   href: string; tKey: string; accent?: boolean };
type NavAction = { kind: 'action'; action: 'logout'; tKey: string };
type NavItem   = NavLink | NavAction;

const GUEST_ITEMS: NavItem[] = [
  { kind: 'link', href: '/',       tKey: 'navbar.home'   },
  { kind: 'link', href: '/menu',   tKey: 'navbar.menu'   },
  { kind: 'link', href: '/tables', tKey: 'navbar.tables' },
  { kind: 'link', href: '/login',  tKey: 'navbar.login', accent: true },
];

const USER_ITEMS: NavItem[] = [
  { kind: 'link', href: '/',       tKey: 'navbar.home'    },
  { kind: 'link', href: '/menu',   tKey: 'navbar.menu'    },
  { kind: 'link', href: '/tables', tKey: 'navbar.tables'  },
  { kind: 'link', href: '/me',     tKey: 'navbar.profile' },
  { kind: 'action', action: 'logout', tKey: 'navbar.logout' },
];

const WAITER_ITEMS: NavItem[] = [
  { kind: 'link', href: '/',          tKey: 'navbar.home'     },
  { kind: 'link', href: '/menu',      tKey: 'navbar.menu'     },
  { kind: 'link', href: '/tables',    tKey: 'navbar.tables'   },
  { kind: 'link', href: '/order/new', tKey: 'navbar.newOrder' },
  { kind: 'link', href: '/orders',    tKey: 'navbar.orders'   },
  { kind: 'link', href: '/me',        tKey: 'navbar.profile'  },
  { kind: 'action', action: 'logout', tKey: 'navbar.logout'   },
];

const ADMIN_ITEMS: NavItem[] = [
  { kind: 'link', href: '/',       tKey: 'navbar.home'    },
  { kind: 'link', href: '/menu',   tKey: 'navbar.menu'    },
  { kind: 'link', href: '/tables', tKey: 'navbar.tables'  },
  { kind: 'link', href: '/admin',  tKey: 'navbar.admin'   },
  { kind: 'link', href: '/me',     tKey: 'navbar.profile' },
  { kind: 'action', action: 'logout', tKey: 'navbar.logout' },
];

// ── Navbar ────────────────────────────────────────────────────────────────────

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname  = usePathname();
  const { user, loading, logout } = useAuth();
  const { locale, setLocale, t }  = useLocale();
  const { addToast } = useToast();

  const navItems: NavItem[] = loading
    ? GUEST_ITEMS
    : !user
      ? GUEST_ITEMS
      : user.role === 'ADMIN'
        ? ADMIN_ITEMS
        : user.role === 'WAITER'
          ? WAITER_ITEMS
          : USER_ITEMS;

  function isActive(href: string) {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(href + '/');
  }

  function closeMobile() {
    setMobileOpen(false);
  }

  async function handleLogout() {
    closeMobile();
    await logout();
    addToast(t('navbar.logout'), 'info');
  }

  // ── Render helpers ─────────────────────────────────────────────────────────

  function DesktopItem({ item }: { item: NavItem }) {
    if (item.kind === 'action') {
      return (
        <button
          onClick={handleLogout}
          className="text-sm font-semibold text-brand-espresso/55 hover:text-brand-espresso transition-colors duration-150 px-1"
        >
          {t(item.tKey)}
        </button>
      );
    }

    const label  = t(item.tKey);
    const active = isActive(item.href);

    if (item.accent) {
      return (
        <Link
          href={item.href}
          className="text-sm font-semibold bg-brand-amber text-white px-4 py-1.5 rounded-xl hover:bg-brand-amber/90 transition-colors duration-150"
        >
          {label}
        </Link>
      );
    }

    return (
      <Link
        href={item.href}
        className={[
          'text-sm font-semibold transition-colors duration-150 px-1',
          active
            ? 'text-brand-amber'
            : 'text-brand-espresso/65 hover:text-brand-espresso',
        ].join(' ')}
      >
        {label}
      </Link>
    );
  }

  function MobileItem({ item }: { item: NavItem }) {
    if (item.kind === 'action') {
      return (
        <button
          onClick={handleLogout}
          className="w-full text-left py-3.5 text-sm font-semibold text-brand-espresso/55 hover:text-brand-espresso transition-colors duration-150"
        >
          {t(item.tKey)}
        </button>
      );
    }

    const label  = t(item.tKey);
    const active = isActive(item.href);

    return (
      <Link
        href={item.href}
        onClick={closeMobile}
        className={[
          'block py-3.5 text-sm font-semibold transition-colors duration-150',
          item.accent
            ? 'text-brand-amber'
            : active
              ? 'text-brand-amber'
              : 'text-brand-espresso/65 hover:text-brand-espresso',
        ].join(' ')}
      >
        {label}
      </Link>
    );
  }

  // ── Language switcher ──────────────────────────────────────────────────────

  function LanguageSwitcher({ mobile = false }: { mobile?: boolean }) {
    return (
      <div className={`flex items-center gap-0.5 ${mobile ? 'pt-3 border-t border-black/5' : ''}`}>
        {SUPPORTED_LOCALES.map((loc: Locale) => (
          <button
            key={loc}
            onClick={() => setLocale(loc)}
            className={[
              'text-xs font-semibold rounded-md transition-colors duration-150 min-h-[44px] min-w-[44px] flex items-center justify-center',
              locale === loc
                ? 'bg-brand-espresso text-white'
                : 'text-brand-espresso/50 hover:text-brand-espresso',
            ].join(' ')}
          >
            {LOCALE_LABELS[loc]}
          </button>
        ))}
      </div>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-3 sm:px-5 pt-3 pointer-events-none">
      <div
        className="max-w-6xl mx-auto rounded-2xl pointer-events-auto"
        style={{
          backdropFilter: 'blur(20px) saturate(1.6)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
          background: 'rgba(252,249,234,0.84)',
          border: '1px solid rgba(255,255,255,0.58)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.09), 0 1px 0 rgba(255,255,255,0.72) inset',
        }}
      >
        {/* Nav bar row */}
        <div className="px-4 sm:px-5 h-14 flex items-center justify-between">

          {/* Logo — left */}
          <Link
            href="/"
            className="text-base font-semibold tracking-tight text-brand-espresso flex-shrink-0"
          >
            Table <span className="text-brand-amber">&</span> Time
          </Link>

          {/* Desktop nav — right */}
          <nav className="hidden lg:flex items-center gap-3 xl:gap-5">
            {navItems.map((item, i) => (
              <DesktopItem key={i} item={item} />
            ))}
            <LanguageSwitcher />
          </nav>

          {/* Mobile: language switcher + burger */}
          <div className="flex lg:hidden items-center gap-2">
            <LanguageSwitcher />
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="flex items-center justify-center w-11 h-11 rounded-xl -mr-1.5 focus:outline-none"
              aria-label="Toggle menu"
              aria-expanded={mobileOpen}
            >
              <div className="flex flex-col justify-center gap-[5px] w-8">
                <span
                  className={`block h-[1.5px] bg-brand-espresso origin-center transition-transform duration-200 ${
                    mobileOpen ? 'translate-y-[6.5px] rotate-45' : ''
                  }`}
                />
                <span
                  className={`block h-[1.5px] bg-brand-espresso transition-opacity duration-200 ${
                    mobileOpen ? 'opacity-0' : ''
                  }`}
                />
                <span
                  className={`block h-[1.5px] bg-brand-espresso origin-center transition-transform duration-200 ${
                    mobileOpen ? '-translate-y-[6.5px] -rotate-45' : ''
                  }`}
                />
              </div>
            </button>
          </div>
        </div>

        {/* Mobile drawer — inside the glass pill */}
        <div
          className={`lg:hidden overflow-hidden transition-all duration-300 ease-in-out ${
            mobileOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="border-t border-black/5 px-4 pb-4 pt-2 space-y-0">
            {navItems.map((item, i) => (
              <MobileItem key={i} item={item} />
            ))}
            <LanguageSwitcher mobile />
          </div>
        </div>
      </div>
    </header>
  );
}
