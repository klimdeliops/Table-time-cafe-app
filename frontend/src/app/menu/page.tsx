'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth }   from '@/hooks/useAuth';
import { useLocale } from '@/hooks/useLocale';
import { useCart }   from '@/contexts/CartContext';
import type { CartDish } from '@/contexts/CartContext';
import { apiFetch, ApiError } from '@/shared/api/client';
import { formatRubles } from '@/lib/formatters';
import type { Locale } from '@/lib/i18n';

interface Dish {
  id: string;
  name: string;
  nameEn: string | null;
  price: string;
  category: string;
  image: string | null;
  isAvailable: boolean;
}

const ALL = '__all__';

function dishName(dish: Dish, locale: Locale): string {
  return (locale === 'en' && dish.nameEn) ? dish.nameEn : dish.name;
}

function toCartDish(dish: Dish): CartDish {
  return {
    id: dish.id,
    name: dish.name,
    nameEn: dish.nameEn,
    price: dish.price,
    category: dish.category,
    image: dish.image,
    isAvailable: dish.isAvailable,
  };
}

export default function MenuPage() {
  const router = useRouter();
  const { t, locale } = useLocale();
  const { authenticated } = useAuth();
  const { items, addItem, removeItem, updateQty, totalItems, totalPrice } = useCart();

  const [dishes, setDishes]       = useState<Dish[]>([]);
  const [loading, setLoading]     = useState(true);
  const [pageError, setPageError] = useState('');
  const [search, setSearch]       = useState('');
  const [activeTab, setActiveTab] = useState(ALL);
  const [cartOpen, setCartOpen]   = useState(false);

  useEffect(() => {
    apiFetch<Dish[]>('/api/menu')
      .then(setDishes)
      .catch(err => {
        if (err instanceof ApiError && err.status === 401) return;
        setPageError(err instanceof ApiError ? err.message : String(err));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    document.body.style.overflow = cartOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [cartOpen]);

  const categories = [...new Set(dishes.map(d => d.category))];

  const visible = dishes.filter(d => {
    const inCat    = activeTab === ALL || d.category === activeTab;
    const term     = search.toLowerCase().trim();
    const inSearch = !term || dishName(d, locale).toLowerCase().includes(term);
    return inCat && inSearch;
  });

  function cartQty(dishId: string) {
    return items.find(i => i.dish.id === dishId)?.quantity ?? 0;
  }

  function handleCheckout() {
    if (!authenticated) {
      router.push('/login?redirect=/order/new');
      return;
    }
    router.push('/order/new');
  }


  if (loading) {
    return (
      <main className="-mt-[68px] min-h-screen">
        <div className="sticky top-0 z-30 glass-nav border-b border-brand-espresso/8 px-4 pt-[68px] pb-3 space-y-2.5">
          <div className="h-10 rounded-xl bg-brand-espresso/6 animate-pulse" />
          <div className="flex gap-2">
            {[1,2,3,4].map(n => (
              <div key={n} className="h-8 w-20 rounded-full bg-brand-espresso/6 animate-pulse" />
            ))}
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl overflow-hidden bg-brand-espresso/5 animate-pulse">
                <div className="h-44" />
                <div className="p-4 space-y-2">
                  <div className="h-4 rounded bg-brand-espresso/8 w-3/4" />
                  <div className="h-3 rounded bg-brand-espresso/5 w-1/4" />
                  <div className="h-8 rounded-xl bg-brand-espresso/5 mt-3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (pageError) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="glass-card rounded-3xl p-8 text-center space-y-4 max-w-sm w-full">
          <p className="text-2xl">☕</p>
          <p className="font-semibold text-brand-espresso">{t('common.error')}</p>
          <p className="text-sm text-brand-espresso/50">{pageError}</p>
          <button
            onClick={() => window.location.reload()}
            className="btn-amber rounded-xl px-6 py-2.5 text-sm font-semibold"
          >
            {t('common.retry')}
          </button>
        </div>
      </main>
    );
  }

  const cartSidebarProps = {
    items, totalPrice, locale, t,
    onInc:      (id: string) => updateQty(id, +1),
    onDec:      (id: string) => updateQty(id, -1),
    onRemove:   removeItem,
    onCheckout: handleCheckout,
  };

  return (
    <main className="-mt-[68px] min-h-screen">

      {/* ── Sticky filter bar ─────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-30 border-b border-white/30"
        style={{
          backdropFilter: 'blur(24px) saturate(1.9)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.9)',
          background: 'linear-gradient(180deg, rgba(252,249,234,0.94) 0%, rgba(252,249,234,0.88) 100%)',
          boxShadow: '0 2px 20px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.80)',
        }}
      >
        <div className="max-w-6xl mx-auto px-4 pt-[78px] pb-3 space-y-2.5">
          <input
            type="search"
            placeholder={t('menu.search')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="glass-input w-full rounded-xl px-4 py-2.5 text-sm text-brand-espresso placeholder:text-brand-espresso/40"
          />
          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-px">
            <FilterPill label={t('menu.all')} active={activeTab === ALL} onClick={() => setActiveTab(ALL)} />
            {categories.map(cat => (
              <FilterPill
                key={cat}
                label={t(`menu.categories.${cat}`)}
                active={activeTab === cat}
                onClick={() => setActiveTab(cat)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Main content ──────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 pt-6 pb-6">
        <div className="flex gap-6 items-stretch">

          {/* Dish grid */}
          <section className="flex-1 min-w-0">
            {visible.length === 0 ? (
              <div className="py-20 text-center space-y-3">
                <p className="text-4xl opacity-30">🍽</p>
                <p className="font-medium text-brand-espresso/60">
                  {search || activeTab !== ALL ? t('common.noData') : t('menu.title')}
                </p>
                {(search || activeTab !== ALL) && (
                  <button
                    onClick={() => { setSearch(''); setActiveTab(ALL); }}
                    className="text-sm text-brand-espresso/50 underline hover:text-brand-espresso transition-colors"
                  >
                    {t('common.cancel')}
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 pb-28 lg:pb-8">
                {visible.map(dish => (
                  <DishCard
                    key={dish.id}
                    dish={dish}
                    locale={locale}
                    qty={cartQty(dish.id)}
                    t={t}
                    onAdd={() => addItem(toCartDish(dish))}
                    onInc={() => updateQty(dish.id, +1)}
                    onDec={() => updateQty(dish.id, -1)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Desktop cart sidebar */}
          <aside className="hidden lg:block w-80 flex-shrink-0">
            <div className="sticky top-[196px] glass-card-warm rounded-3xl p-6">
              <h2 className="font-semibold text-brand-espresso mb-4">{t('menu.cart')}</h2>
              <CartSidebar {...cartSidebarProps} />
            </div>
          </aside>

        </div>
      </div>

      {/* ── Mobile sticky CTA ─────────────────────────────────────────── */}
      {totalItems > 0 && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-20 px-4 pb-4 pt-2 bg-gradient-to-t from-brand-cream via-brand-cream/96 to-transparent pointer-events-none">
          <button
            onClick={() => setCartOpen(true)}
            className="btn-amber w-full rounded-2xl py-4 px-5 font-semibold text-sm flex items-center justify-between pointer-events-auto"
          >
            <span className="flex items-center gap-2.5">
              <span className="bg-white/30 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                {totalItems}
              </span>
              <span>{t('menu.cart')}</span>
            </span>
            <span className="tabular-nums font-bold">{formatRubles(totalPrice)}</span>
          </button>
        </div>
      )}

      {/* ── Mobile cart sheet ─────────────────────────────────────────── */}
      {cartOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-brand-espresso/40 backdrop-blur-sm animate-fade-in"
          onClick={() => setCartOpen(false)}
        >
          <div
            className="absolute bottom-0 inset-x-0 glass-modal rounded-t-3xl max-h-[88vh] flex flex-col animate-fade-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-brand-espresso/8 flex-shrink-0">
              <h2 className="font-semibold text-brand-espresso">{t('menu.cart')}</h2>
              <button
                onClick={() => setCartOpen(false)}
                className="w-8 h-8 rounded-full bg-brand-espresso/8 flex items-center justify-center text-brand-espresso/60 hover:bg-brand-espresso/15 transition-colors"
                aria-label={t('common.close')}
              >
                ✕
              </button>
            </div>
            <div className="px-5 py-4 overflow-y-auto flex-1">
              <CartSidebar
                {...cartSidebarProps}
                onCheckout={() => { setCartOpen(false); handleCheckout(); }}
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={[
        'flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200',
        active
          ? 'bg-brand-espresso text-brand-cream shadow-sm'
          : 'bg-brand-espresso/8 text-brand-espresso/70 hover:bg-brand-espresso/14 hover:text-brand-espresso',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

function DishCard({
  dish, locale, qty, t, onAdd, onInc, onDec,
}: {
  dish: Dish;
  locale: Locale;
  qty: number;
  t: (key: string) => string;
  onAdd: () => void;
  onInc: () => void;
  onDec: () => void;
}) {
  const unavailable = !dish.isAvailable;
  const name = dishName(dish, locale);

  return (
    <div
      className={[
        'rounded-2xl overflow-hidden flex flex-col',
        unavailable ? 'opacity-45' : 'hover:-translate-y-1 cursor-default',
      ].join(' ')}
      style={{
        backdropFilter: 'blur(18px) saturate(1.7)',
        WebkitBackdropFilter: 'blur(18px) saturate(1.7)',
        background: 'rgba(252,249,234,0.82)',
        border: '1px solid rgba(255,255,255,0.62)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.80)',
        transition: 'transform 0.2s ease, box-shadow 0.25s ease, opacity 0.2s ease',
        ...(unavailable ? {} : { ['--hover-shadow' as string]: '0 8px 32px rgba(0,0,0,0.12)' }),
      }}
      onMouseEnter={e => { if (!unavailable) (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 32px rgba(0,0,0,0.13), inset 0 1px 0 rgba(255,255,255,0.85)'; }}
      onMouseLeave={e => { if (!unavailable) (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.80)'; }}
    >
      {/* Image */}
      {dish.image ? (
        <div className="relative h-44 w-full">
          <Image
            src={dish.image}
            alt={name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
          />
        </div>
      ) : (
        <div
          className="h-44 w-full flex items-center justify-center text-4xl relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, rgba(174,183,132,0.18) 0%, rgba(255,162,57,0.13) 60%, rgba(252,249,234,0.30) 100%)' }}
        >
          <span className="relative z-10 opacity-60">
            {dish.category === 'hot_drinks' || dish.category === 'cold_drinks' ? '☕' :
             dish.category === 'desserts' ? '🍰' :
             dish.category === 'signature' ? '⭐' : '🍽'}
          </span>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.35) 0%, transparent 60%)' }} />
        </div>
      )}

      {/* Body */}
      <div className="p-4 flex flex-col flex-1 gap-3">
        <div className="flex-1 space-y-1">
          <p className="text-sm font-semibold leading-snug text-brand-espresso">{name}</p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-brand-espresso/45 capitalize">
              {t(`menu.categories.${dish.category}`)}
            </span>
            <span className="text-sm font-bold tabular-nums text-brand-espresso">
              {formatRubles(dish.price)}
            </span>
          </div>
          {unavailable && (
            <p className="text-xs text-brand-espresso/40">{t('menu.unavailable')}</p>
          )}
        </div>

        {/* Cart control */}
        {!unavailable && (
          qty > 0 ? (
            <div className="flex items-center justify-between gap-2">
              <QtyBtn onClick={onDec}>−</QtyBtn>
              <span className="text-sm font-bold tabular-nums text-brand-espresso w-6 text-center">
                {qty}
              </span>
              <QtyBtn amber onClick={onInc}>+</QtyBtn>
            </div>
          ) : (
            <button
              onClick={onAdd}
              className="w-full glass-button rounded-xl py-2 text-sm font-medium text-brand-espresso"
            >
              {t('menu.addToCart')}
            </button>
          )
        )}
      </div>
    </div>
  );
}

import type { CartItem } from '@/contexts/CartContext';

interface CartSidebarProps {
  items: CartItem[];
  totalPrice: number;
  locale: Locale;
  t: (key: string) => string;
  onInc:      (id: string) => void;
  onDec:      (id: string) => void;
  onRemove:   (id: string) => void;
  onCheckout: () => void;
}

function CartSidebar({
  items, totalPrice, locale, t, onInc, onDec, onRemove, onCheckout,
}: CartSidebarProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-6 space-y-2">
        <p className="text-3xl opacity-30">🛒</p>
        <p className="text-sm text-brand-espresso/50">{t('menu.emptyCart')}</p>
        <Link
          href="/menu"
          className="text-sm text-brand-espresso/60 underline hover:text-brand-espresso transition-colors"
        >
          {t('order.goToMenu')}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-3 max-h-64 overflow-y-auto pr-1">
        {items.map(item => {
          const name = (locale === 'en' && item.dish.nameEn) ? item.dish.nameEn : item.dish.name;
          return (
            <li key={item.dish.id} className="flex items-center gap-2 text-sm">
              <span className="flex-1 truncate text-brand-espresso leading-tight">{name}</span>
              <div className="flex items-center gap-1 flex-shrink-0">
                <QtyBtn small onClick={() => onDec(item.dish.id)}>−</QtyBtn>
                <span className="w-4 text-center tabular-nums text-brand-espresso font-semibold">
                  {item.quantity}
                </span>
                <QtyBtn small amber onClick={() => onInc(item.dish.id)}>+</QtyBtn>
              </div>
              <span className="w-14 text-right tabular-nums text-brand-espresso/60 flex-shrink-0">
                {formatRubles(parseFloat(item.dish.price) * item.quantity)}
              </span>
              <button
                onClick={() => onRemove(item.dish.id)}
                className="flex-shrink-0 text-brand-espresso/25 hover:text-red-400 transition-colors text-base leading-none"
                aria-label="Remove"
              >
                ×
              </button>
            </li>
          );
        })}
      </ul>

      <div className="border-t border-brand-espresso/10 pt-3 flex justify-between text-sm font-semibold text-brand-espresso">
        <span>{t('menu.total')}</span>
        <span className="tabular-nums">{formatRubles(totalPrice)}</span>
      </div>

      <button
        onClick={onCheckout}
        className="btn-amber w-full rounded-xl py-3 text-sm font-semibold"
      >
        {t('menu.placeOrder')}
      </button>
    </div>
  );
}

function QtyBtn({
  children, amber, small, onClick,
}: {
  children: React.ReactNode;
  amber?: boolean;
  small?: boolean;
  onClick: () => void;
}) {
  const size = small ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm';
  return (
    <button
      onClick={onClick}
      className={[
        `${size} rounded-full flex items-center justify-center font-bold transition-all duration-150`,
        amber
          ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-sm'
          : 'bg-brand-espresso/10 text-brand-espresso hover:bg-brand-espresso/20',
      ].join(' ')}
    >
      {children}
    </button>
  );
}
