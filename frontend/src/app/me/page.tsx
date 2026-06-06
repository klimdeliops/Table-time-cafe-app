'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useLocale } from '@/hooks/useLocale';
import { ProtectedPage } from '@/components/ProtectedPage';
import { apiFetch, ApiError } from '@/shared/api/client';
import { formatDateTime, formatRubles, formatDate, formatTime } from '@/lib/formatters';
import type { Locale } from '@/lib/i18n';

// ── Types ─────────────────────────────────────────────────────────────────────

type ResStatus  = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';
type OrdStatus  = 'CREATED' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED';
type OrdType    = 'DINE_IN' | 'DELIVERY' | 'TAKEAWAY';
type PayMethod  = 'CASH' | 'CARD';

interface Reservation {
  id: string;
  status: ResStatus;
  numberOfGuests: number;
  startTime: string;
  endTime: string;
  table: { id: string; number: number; capacity: number };
}

interface OrderItem {
  id: string;
  quantity: number;
  unitPrice: string;
  dish: { id: string; name: string; category: string };
}

interface Order {
  id: string;
  type: OrdType;
  status: OrdStatus;
  paymentMethod: PayMethod | null;
  totalAmount: string;
  tableId: string | null;
  table: { id: string; number: number; capacity: number } | null;
  deliveryAddress: string | null;
  items: OrderItem[];
  createdAt: string;
}

// ── Status styling ────────────────────────────────────────────────────────────

const RES_STATUS_COLORS: Record<ResStatus, string> = {
  PENDING:   'bg-amber-50  text-amber-700  border-amber-200',
  CONFIRMED: 'bg-green-50   text-green-700  border-green-200',
  CANCELLED: 'bg-red-50    text-red-600    border-red-200',
  COMPLETED: 'bg-brand-espresso/6 text-brand-espresso/55 border-brand-espresso/12',
  NO_SHOW:   'bg-gray-100  text-gray-500   border-gray-200',
};

const ORD_STATUS_COLORS: Record<OrdStatus, string> = {
  CREATED:   'bg-brand-espresso/8 text-brand-espresso/65 border-brand-espresso/15',
  CONFIRMED: 'bg-blue-50   text-blue-700   border-blue-200',
  PREPARING: 'bg-orange-50 text-orange-700 border-orange-200',
  READY:     'bg-green-50    text-green-700  border-green-200',
  COMPLETED: 'bg-emerald-50  text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-red-50    text-red-600    border-red-200',
};

const ACTIVE_ORD = new Set<OrdStatus>(['CREATED', 'CONFIRMED', 'PREPARING', 'READY']);

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  return (
    <ProtectedPage>
      <ProfileDashboard />
    </ProtectedPage>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

function ProfileDashboard() {
  const { user, logout } = useAuth();
  const { t, locale }    = useLocale();

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [orders, setOrders]             = useState<Order[]>([]);
  const [loading, setLoading]           = useState(true);
  const [dataError, setDataError]       = useState('');

  useEffect(() => {
    Promise.all([
      apiFetch<{ items: Reservation[] }>('/api/reservations/me'),
      apiFetch<{ items: Order[] }>('/api/orders/me?limit=50'),
    ])
      .then(([res, ord]) => {
        setReservations(res.items);
        setOrders(ord.items);
      })
      .catch((err) => {
        if (!(err instanceof ApiError && err.status === 401)) {
          setDataError(err instanceof ApiError ? err.message : t('common.error'));
        }
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cancelOrder = useCallback(async (id: string) => {
    await apiFetch(`/api/orders/${id}/cancel`, { method: 'PATCH' });
    setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status: 'CANCELLED' as OrdStatus } : o));
  }, []);

  if (!user) return null;

  const now           = new Date();
  const upcomingRes   = reservations.filter((r) => new Date(r.startTime) > now && r.status !== 'CANCELLED' && r.status !== 'NO_SHOW');
  const pastRes       = reservations.filter((r) => new Date(r.startTime) <= now || r.status === 'CANCELLED' || r.status === 'NO_SHOW');
  const activeOrders  = orders.filter((o) => ACTIVE_ORD.has(o.status));
  const historyOrders = orders.filter((o) => !ACTIVE_ORD.has(o.status));

  return (
    <main className="min-h-screen pb-16">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* ── Summary card ── */}
        <SummaryCard
          user={user} t={t} locale={locale} onLogout={logout}
          upcomingCount={upcomingRes.length}
          activeCount={activeOrders.length}
          totalReservations={reservations.length}
          totalOrders={orders.length}
          loading={loading}
        />

        {/* ── Main content grid ── */}
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <ShimmerSection rows={3} />
            <ShimmerSection rows={2} />
            <ShimmerSection rows={2} />
            <ShimmerSection rows={2} />
          </div>
        ) : dataError ? (
          <div className="glass-card rounded-2xl px-5 py-4">
            <p className="text-sm text-red-600">{dataError}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <UpcomingReservationsSection reservations={upcomingRes} locale={locale} t={t} />
            <ActiveOrdersSection        orders={activeOrders}      locale={locale} t={t} onCancel={cancelOrder} />
            <HistorySection title={t('profile.reservationHistory')} emptyLabel={t('profile.noReservations')}>
              {pastRes.map((r) => <ReservationRow key={r.id} r={r} locale={locale} t={t} dim />)}
            </HistorySection>
            <HistorySection title={t('profile.orderHistory')} emptyLabel={t('profile.noOrders')}>
              {historyOrders.map((o) => <OrderRow key={o.id} order={o} locale={locale} t={t} compact />)}
            </HistorySection>
          </div>
        )}

      </div>
    </main>
  );
}

// ── Summary card ──────────────────────────────────────────────────────────────

function SummaryCard({
  user, t, locale, onLogout,
  upcomingCount, activeCount, totalReservations, totalOrders, loading,
}: {
  user: { email: string; role: string; createdAt: string };
  t: (k: string) => string;
  locale: Locale;
  onLogout: () => void;
  upcomingCount: number;
  activeCount: number;
  totalReservations: number;
  totalOrders: number;
  loading: boolean;
}) {
  const initial    = user.email[0].toUpperCase();
  const joinedDate = formatDate(user.createdAt, locale);

  const stats = [
    { label: t('profile.upcoming'),     value: upcomingCount,      icon: '📅', accent: 'text-blue-600'    },
    { label: t('profile.activeOrders'), value: activeCount,        icon: '🛒', accent: 'text-amber-600'   },
    { label: t('profile.reservations'), value: totalReservations,  icon: '🗓', accent: 'text-emerald-600' },
    { label: t('profile.orders'),       value: totalOrders,        icon: '📋', accent: 'text-purple-600'  },
  ];

  return (
    <div className="glass-card-warm rounded-3xl overflow-hidden animate-fade-up">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-0">

        {/* Left: identity */}
        <div className="px-6 pt-8 pb-6 flex items-center gap-5">
          <div
            className="w-20 h-20 rounded-2xl flex-shrink-0 flex items-center justify-center text-3xl font-bold text-white shadow-lg"
            style={{ background: 'linear-gradient(135deg, #FFA239 0%, #f07c0c 100%)' }}
          >
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-brand-espresso truncate text-lg leading-tight">{user.email}</p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="text-xs bg-brand-espresso/10 text-brand-espresso/65 rounded-full px-2.5 py-1 font-semibold border border-brand-espresso/12">
                {t(`profile.roles.${user.role}`)}
              </span>
              <span className="text-xs text-brand-espresso/40">
                {t('profile.memberSince')} {joinedDate}
              </span>
            </div>
            {/* Action buttons — only show on mobile/sm */}
            <div className="flex gap-2 mt-3 sm:hidden flex-wrap">
              <Link href="/menu"   className="inline-flex items-center gap-1 py-2 px-3 rounded-xl text-xs font-medium text-brand-espresso bg-brand-espresso/8 hover:bg-brand-espresso/14 transition-colors">🍽 {t('profile.browseMenu')}</Link>
              <Link href="/tables" className="inline-flex items-center gap-1 py-2 px-3 rounded-xl text-xs font-medium text-brand-espresso bg-brand-espresso/8 hover:bg-brand-espresso/14 transition-colors">📅 {t('profile.reserveTable')}</Link>
              <button onClick={onLogout} className="inline-flex items-center gap-1 py-2 px-3 rounded-xl text-xs font-medium text-red-600/80 bg-red-50 hover:bg-red-100 transition-colors">{t('profile.signOut')}</button>
            </div>
          </div>
        </div>

        {/* Right: action buttons — desktop */}
        <div className="hidden sm:flex flex-col gap-2 justify-center px-6 py-6 border-l border-brand-espresso/8">
          <Link href="/menu"   className="flex items-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium text-brand-espresso bg-brand-espresso/8 hover:bg-brand-espresso/14 transition-colors whitespace-nowrap"><span>🍽</span>{t('profile.browseMenu')}</Link>
          <Link href="/tables" className="flex items-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium text-brand-espresso bg-brand-espresso/8 hover:bg-brand-espresso/14 transition-colors whitespace-nowrap"><span>📅</span>{t('profile.reserveTable')}</Link>
          <button onClick={onLogout} className="flex items-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium text-red-600/80 bg-red-50 hover:bg-red-100 transition-colors">{t('profile.signOut')}</button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="border-t border-brand-espresso/8 grid grid-cols-4">
        {stats.map(({ label, value, icon, accent }) => (
          <div key={label} className="flex flex-col items-center gap-0.5 py-4 px-2 text-center">
            {loading ? (
              <div className="w-8 h-6 rounded bg-brand-espresso/8 animate-pulse mb-1" />
            ) : (
              <span className={`text-xl font-bold tabular-nums ${accent}`}>{value}</span>
            )}
            <span className="text-[10px] text-brand-espresso/45 leading-tight hidden sm:block">{label}</span>
            <span className="text-base sm:hidden">{icon}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Upcoming reservations ──────────────────────────────────────────────────────

function UpcomingReservationsSection({
  reservations, locale, t,
}: {
  reservations: Reservation[];
  locale: Locale;
  t: (k: string) => string;
}) {
  return (
    <div className="glass-card rounded-2xl p-5 space-y-3 animate-fade-up" style={{ animationDelay: '0.06s' }}>
      <SectionHeader
        title={t('profile.upcoming')}
        subtitle={t('profile.reservations')}
        count={reservations.length}
        linkHref="/tables"
        linkLabel={t('profile.browseReservations')}
      />

      {reservations.length === 0 ? (
        <EmptyState label={t('profile.noReservations')} icon="📅" />
      ) : (
        <div className="space-y-2.5">
          {reservations.map((r) => (
            <div key={r.id} className="space-y-2">
              <ReservationRow r={r} locale={locale} t={t} />
              {/* CTA to order food for this reservation */}
              <Link
                href={`/order/new?tableId=${r.table.id}&orderType=DINE_IN`}
                className="flex items-center gap-2 py-2 px-3 rounded-xl text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200/70 transition-colors"
              >
                <span>🛒</span>
                {t('profile.orderForThisTable')}
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Active orders ─────────────────────────────────────────────────────────────

function ActiveOrdersSection({
  orders, locale, t, onCancel,
}: {
  orders: Order[];
  locale: Locale;
  t: (k: string) => string;
  onCancel: (id: string) => Promise<void>;
}) {
  return (
    <div className="glass-card rounded-2xl p-5 space-y-3 animate-fade-up" style={{ animationDelay: '0.10s' }}>
      <SectionHeader
        title={t('profile.activeOrders')}
        count={orders.length}
        linkHref="/orders"
        linkLabel={t('orders.myOrders')}
      />

      {orders.length === 0 ? (
        <EmptyState label={t('profile.noOrders')} icon="🧾" />
      ) : (
        <div className="space-y-2.5">
          {orders.map((o) => (
            <OrderRow key={o.id} order={o} locale={locale} t={t} onCancel={onCancel} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── History section (collapsible) ─────────────────────────────────────────────

const HISTORY_SHOW = 3;

function HistorySection({
  title, emptyLabel, children,
}: {
  title: string;
  emptyLabel: string;
  children: React.ReactNode[];
}) {
  const { t } = useLocale();
  const [expanded, setExpanded] = useState(false);
  const total    = children.length;
  const visible  = expanded ? children : children.slice(0, HISTORY_SHOW);
  const hasMore  = total > HISTORY_SHOW;

  return (
    <div className="glass-card rounded-2xl p-5 space-y-3 animate-fade-up" style={{ animationDelay: '0.14s' }}>
      <SectionHeader title={title} count={total} />

      {total === 0 ? (
        <EmptyState label={emptyLabel} icon="🕐" dim />
      ) : (
        <>
          <div className="space-y-2">
            {visible}
          </div>
          {hasMore && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="w-full py-2 text-xs font-medium text-brand-espresso/50 hover:text-brand-espresso/80 transition-colors text-center"
            >
              {expanded ? t('profile.showLess') : `${t('profile.showMore')} (${total - HISTORY_SHOW})`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ── Reservation row ───────────────────────────────────────────────────────────

function ReservationRow({
  r, locale, t, dim = false,
}: {
  r: Reservation;
  locale: Locale;
  t: (k: string) => string;
  dim?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-2xl bg-brand-espresso/4 transition-opacity ${dim ? 'opacity-55' : ''}`}>
      {/* Table badge */}
      <div className="w-10 h-10 rounded-xl bg-brand-espresso/8 flex-shrink-0 flex flex-col items-center justify-center">
        <span className="text-[10px] text-brand-espresso/45 leading-none">№</span>
        <span className="text-sm font-bold text-brand-espresso leading-none">{r.table.number}</span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-brand-espresso truncate">
          {formatDate(r.startTime, locale)}
        </p>
        <p className="text-xs text-brand-espresso/45 mt-0.5">
          {formatTime(r.startTime, locale)}–{formatTime(r.endTime, locale)}
          {' · '}
          {r.numberOfGuests} {t('reservation.seats')}
        </p>
      </div>

      {/* Status */}
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 ${RES_STATUS_COLORS[r.status]}`}>
        {t(`reservation.status.${r.status}`)}
      </span>
    </div>
  );
}

// ── Order row ─────────────────────────────────────────────────────────────────

function OrderRow({
  order, locale, t, compact = false, onCancel,
}: {
  order: Order;
  locale: Locale;
  t: (k: string) => string;
  compact?: boolean;
  onCancel?: (id: string) => Promise<void>;
}) {
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled]   = useState(false);
  const [cancelErr, setCancelErr]   = useState('');
  const [expanded, setExpanded]     = useState(false);

  const shortId    = order.id.slice(0, 8).toUpperCase();
  const itemCount  = order.items.reduce((s, i) => s + i.quantity, 0);
  const showItems  = !compact || expanded;
  const canCancel  = !compact && !cancelled && order.status === 'CREATED' && !!onCancel;

  const PAY_LABEL: Record<PayMethod, string> = {
    CASH: t('order.payCash'),
    CARD: t('order.payCard'),
  };

  async function handleCancel() {
    if (!onCancel) return;
    setCancelling(true);
    setCancelErr('');
    try {
      await onCancel(order.id);
      setCancelled(true);
    } catch (err) {
      setCancelErr(err instanceof ApiError ? err.message : t('common.error'));
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="rounded-2xl bg-brand-espresso/4 overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 p-3">
        {/* ID + status */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold font-mono text-xs text-brand-espresso/70">#{shortId}</span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${ORD_STATUS_COLORS[order.status]}`}>
              {t(`orders.status.${order.status}`)}
            </span>
            <span className="text-[10px] text-brand-espresso/45 bg-brand-espresso/6 px-2 py-0.5 rounded-full border border-brand-espresso/10">
              {t(`orders.type.${order.type}`)}
            </span>
          </div>
          <p className="text-xs text-brand-espresso/40">
            {formatDate(order.createdAt, locale)}
            {order.table && ` · ${t('reservation.table')} №${order.table.number}`}
            {order.paymentMethod && ` · ${PAY_LABEL[order.paymentMethod]}`}
          </p>
        </div>

        {/* Total + expand */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className="text-sm font-bold tabular-nums text-brand-espresso">
            {formatRubles(order.totalAmount)}
          </span>
          {compact && order.items.length > 0 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-[10px] text-brand-espresso/40 hover:text-brand-espresso/70 transition-colors"
            >
              {itemCount} {t('orders.items')} {expanded ? '↑' : '↓'}
            </button>
          )}
        </div>
      </div>

      {/* Items */}
      {showItems && order.items.length > 0 && (
        <div className="border-t border-brand-espresso/6 px-3 py-2 space-y-1.5">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between text-xs">
              <span className="text-brand-espresso/65 truncate pr-3">
                <span className="text-brand-espresso/40 mr-1">{item.quantity}×</span>
                {item.dish.name}
              </span>
              <span className="tabular-nums text-brand-espresso/50 flex-shrink-0">
                {formatRubles(parseFloat(item.unitPrice) * item.quantity)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Cancel row */}
      {canCancel && (
        <div className="border-t border-brand-espresso/6 px-3 py-2 flex items-center gap-3">
          {cancelled ? (
            <span className="text-xs text-brand-espresso/50 font-medium">{t('profile.orderCancelled')}</span>
          ) : (
            <>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40 transition-colors font-medium"
              >
                {cancelling ? t('common.loading') : t('profile.cancelOrder')}
              </button>
              {cancelErr && <span className="text-[10px] text-red-400">{cancelErr}</span>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({
  title, subtitle, count, linkHref, linkLabel,
}: {
  title: string;
  subtitle?: string;
  count?: number;
  linkHref?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-bold text-brand-espresso">
          {title}{subtitle ? ` · ${subtitle}` : ''}
        </h2>
        {count !== undefined && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-brand-espresso/10 text-brand-espresso/55 tabular-nums">
            {count}
          </span>
        )}
      </div>
      {linkHref && linkLabel && (
        <Link
          href={linkHref}
          className="text-xs text-amber-600 hover:text-amber-500 font-medium transition-colors"
        >
          {linkLabel} →
        </Link>
      )}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ label, icon, dim = false }: { label: string; icon: string; dim?: boolean }) {
  return (
    <div className={`text-center py-5 space-y-1.5 ${dim ? 'opacity-50' : ''}`}>
      <p className="text-2xl">{icon}</p>
      <p className="text-xs text-brand-espresso/45">{label}</p>
    </div>
  );
}

// ── Shimmer skeleton ──────────────────────────────────────────────────────────

function ShimmerSection({ rows = 2 }: { rows?: number }) {
  return (
    <div className="glass-card rounded-3xl p-5 space-y-3">
      <div className="h-4 w-36 rounded-full bg-brand-espresso/8 animate-pulse" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 rounded-2xl bg-brand-espresso/6 animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />
      ))}
    </div>
  );
}
