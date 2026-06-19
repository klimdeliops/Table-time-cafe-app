'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ProtectedPage } from '@/components/ProtectedPage';
import { apiFetch, ApiError } from '@/shared/api/client';
import { useLocale } from '@/hooks/useLocale';
import { formatRubles } from '@/lib/formatters';

type OrderStatus = 'CREATED' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED';
type OrderType   = 'DINE_IN' | 'DELIVERY' | 'TAKEAWAY';

interface OrderItem {
  id: string;
  quantity: number;
  unitPrice: string;
  dish: { id: string; name: string; category: string };
}

interface Order {
  id: string;
  type: OrderType;
  status: OrderStatus;
  totalAmount: string;
  tableId: string | null;
  deliveryAddress: string | null;
  table: { id: string; capacity: number; number: number } | null;
  items: OrderItem[];
  createdAt: string;
}

const CURRENT_STATUSES  = new Set<OrderStatus>(['CREATED', 'CONFIRMED', 'PREPARING', 'READY']);
const POLL_INTERVAL_MS  = 12_000;
const ITEMS_COLLAPSE_AT = 3;

const STATUS_STYLE: Record<OrderStatus, string> = {
  CREATED:   'bg-amber-100   text-amber-700',
  CONFIRMED: 'bg-blue-100    text-blue-700',
  PREPARING: 'bg-orange-100  text-orange-700',
  READY:     'bg-emerald-100 text-emerald-700',
  COMPLETED: 'bg-gray-100    text-gray-500',
  CANCELLED: 'bg-red-100     text-red-500',
};

const STATUS_BORDER: Record<OrderStatus, string> = {
  CREATED:   'border-l-amber-400',
  CONFIRMED: 'border-l-blue-400',
  PREPARING: 'border-l-orange-400',
  READY:     'border-l-emerald-400',
  COMPLETED: 'border-l-gray-200',
  CANCELLED: 'border-l-red-200',
};

function Shimmer() {
  return (
    <div className="glass-card rounded-2xl overflow-hidden p-5 space-y-3 animate-pulse">
      <div className="flex gap-2">
        <div className="h-4 w-20 rounded-full bg-brand-espresso/8" />
        <div className="h-4 w-16 rounded-full bg-brand-espresso/8" />
      </div>
      <div className="h-3 w-32 rounded-full bg-brand-espresso/6" />
      <div className="space-y-1.5 pt-1">
        <div className="h-3 w-full rounded-full bg-brand-espresso/6" />
        <div className="h-3 w-3/4 rounded-full bg-brand-espresso/6" />
      </div>
    </div>
  );
}

function EmptyOrders({ label, cta, ctaHref }: { label: string; cta: string; ctaHref: string }) {
  return (
    <div className="glass-card rounded-2xl px-6 py-10 text-center space-y-4">
      <p className="text-3xl" aria-hidden="true">🍽</p>
      <p className="text-sm text-brand-espresso/50">{label}</p>
      <Link
        href={ctaHref}
        className="inline-block btn-amber px-5 py-2.5 rounded-xl text-sm font-medium"
      >
        {cta}
      </Link>
    </div>
  );
}

export default function OrdersPage() {
  return (
    <ProtectedPage>
      <OrdersContent />
    </ProtectedPage>
  );
}

function OrdersContent() {
  const { t, locale } = useLocale();
  const [orders,  setOrders]  = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    apiFetch<{ items: Order[] }>('/api/orders/me?limit=50')
      .then(res => setOrders(res.items))
      .catch(err => {
        if (!silent) setError(err instanceof ApiError ? err.message : t('common.error'));
      })
      .finally(() => { if (!silent) setLoading(false); });
  }, [t]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(() => load(true), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [load]);

  const current = orders.filter(o => CURRENT_STATUSES.has(o.status));
  const history = orders.filter(o => !CURRENT_STATUSES.has(o.status));

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString(locale === 'en' ? 'en-GB' : 'ru-RU', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  }

  return (
    <main className="min-h-screen bg-brand-cream py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link href="/me" className="text-sm text-brand-espresso/40 hover:text-brand-espresso/70 transition-colors">
              ← {t('profile.title')}
            </Link>
            <h1 className="text-xl font-bold text-brand-espresso mt-1">{t('orders.myOrders')}</h1>
          </div>
          <Link href="/menu" className="btn-amber px-4 py-2 rounded-xl text-sm font-medium">
            + {t('menu.placeOrder')}
          </Link>
        </div>

        {error && (
          <div role="alert" className="text-sm text-red-600 glass-card rounded-xl px-4 py-3 border border-red-200">
            {error}
          </div>
        )}

        {/* Current orders */}
        <section aria-label={t('orders.current')}>
          <SectionHeader label={t('orders.current')} count={loading ? null : current.length} />
          {loading ? (
            <div className="space-y-3 mt-3">
              <Shimmer /><Shimmer />
            </div>
          ) : current.length === 0 ? (
            <div className="mt-3">
              <EmptyOrders
                label={t('orders.empty')}
                cta={t('menu.placeOrder')}
                ctaHref="/menu"
              />
            </div>
          ) : (
            <div className="space-y-3 mt-3">
              {current.map(order => (
                <OrderCard key={order.id} order={order} onRefresh={() => load(true)} fmtDate={fmtDate} t={t} />
              ))}
            </div>
          )}
        </section>

        {/* History */}
        <section aria-label={t('orders.history')}>
          <SectionHeader label={t('orders.history')} count={loading ? null : history.length} />
          {loading ? (
            <div className="space-y-3 mt-3">
              <Shimmer />
            </div>
          ) : history.length === 0 ? (
            <p className="mt-3 text-sm text-brand-espresso/40 py-2">{t('orders.empty')}</p>
          ) : (
            <div className="space-y-3 mt-3">
              {history.map(order => (
                <OrderCard key={order.id} order={order} onRefresh={() => load(true)} fmtDate={fmtDate} t={t} />
              ))}
            </div>
          )}
        </section>

      </div>
    </main>
  );
}

function SectionHeader({ label, count }: { label: string; count: number | null }) {
  return (
    <div className="flex items-center gap-2">
      <h2 className="text-xs font-semibold text-brand-espresso/40 uppercase tracking-widest">{label}</h2>
      {count !== null && (
        <span className="text-xs bg-brand-espresso/8 text-brand-espresso/50 rounded-full px-2 py-0.5 tabular-nums font-medium">
          {count}
        </span>
      )}
    </div>
  );
}

function OrderCard({
  order, onRefresh, fmtDate, t,
}: {
  order: Order;
  onRefresh: () => void;
  fmtDate: (iso: string) => string;
  t: (k: string) => string;
}) {
  const [cancelling, setCancelling] = useState(false);
  const [cancelled,  setCancelled]  = useState(false);
  const [cancelErr,  setCancelErr]  = useState('');
  const [expanded,   setExpanded]   = useState(false);

  const shortId    = order.id.slice(0, 8).toUpperCase();
  const hasMany    = order.items.length > ITEMS_COLLAPSE_AT;
  const visible    = expanded || !hasMany ? order.items : order.items.slice(0, ITEMS_COLLAPSE_AT);

  async function handleCancel() {
    setCancelling(true);
    setCancelErr('');
    try {
      await apiFetch(`/api/orders/${order.id}/cancel`, { method: 'PATCH' });
      setCancelled(true);
      setTimeout(onRefresh, 800);
    } catch (err) {
      setCancelErr(err instanceof ApiError ? err.message : t('common.error'));
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className={`glass-card rounded-2xl overflow-hidden border-l-4 ${STATUS_BORDER[order.status]}`}>

      {/* Header */}
      <div className="px-5 py-4 flex items-start gap-4">
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-bold text-brand-espresso/60">#{shortId}</span>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${STATUS_STYLE[order.status]}`}>
              {t(`orders.status.${order.status}`)}
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-brand-espresso/8 text-brand-espresso/50 font-medium">
              {t(`orders.type.${order.type}`)}
            </span>
          </div>
          <p className="text-xs text-brand-espresso/40 flex flex-wrap gap-x-2 gap-y-1">
            <span>{fmtDate(order.createdAt)}</span>
            {order.table && (
              <span>· {t('admin.tableNumber')}{order.table.number} · {order.table.capacity} {t('reservation.seats')}</span>
            )}
            {order.deliveryAddress && (
              <span className="truncate max-w-[180px]">· {order.deliveryAddress}</span>
            )}
          </p>
        </div>
        <p className="text-base font-bold tabular-nums text-brand-espresso shrink-0">
          {formatRubles(order.totalAmount)}
        </p>
      </div>

      {/* Items */}
      {order.items.length > 0 && (
        <div className="border-t border-brand-espresso/8 px-5 py-3 space-y-2">
          {visible.map(item => (
            <div key={item.id} className="flex items-center justify-between">
              <span className="text-sm text-brand-espresso">
                <span className="text-brand-espresso/35 mr-1.5 tabular-nums">{item.quantity}×</span>
                {item.dish.name}
              </span>
              <span className="text-sm text-brand-espresso/50 tabular-nums ml-4 shrink-0">
                {formatRubles(parseFloat(item.unitPrice) * item.quantity)}
              </span>
            </div>
          ))}
          {hasMany && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="text-xs text-brand-espresso/40 hover:text-brand-espresso/70 transition-colors pt-0.5"
            >
              {expanded
                ? `↑ ${t('profile.showLess')}`
                : `+${order.items.length - ITEMS_COLLAPSE_AT} ${t('profile.showMore')} ↓`}
            </button>
          )}
        </div>
      )}

      {/* Cancel row */}
      {order.status === 'CREATED' && (
        <div className="border-t border-brand-espresso/8 px-5 py-3 flex items-center gap-3">
          {cancelled ? (
            <span className="text-xs text-emerald-600 font-medium">{t('profile.orderCancelled')}</span>
          ) : (
            <>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="text-sm text-red-500 hover:text-red-700 disabled:opacity-40 transition-colors font-medium"
              >
                {cancelling ? t('common.loading') : t('profile.cancelOrder')}
              </button>
              {cancelErr && <span className="text-xs text-red-400">{cancelErr}</span>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
