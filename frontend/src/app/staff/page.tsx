'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ProtectedPage } from '@/components/ProtectedPage';
import { apiFetch } from '@/shared/api/client';
import { useAuth } from '@/hooks/useAuth';
import { useLocale } from '@/hooks/useLocale';
import { formatRubles } from '@/lib/formatters';

// ── Types ─────────────────────────────────────────────────────────────────────

type OrderStatus       = 'CREATED' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED';
type OrderType         = 'DINE_IN' | 'DELIVERY' | 'TAKEAWAY';
type TableStatus       = 'FREE' | 'RESERVED' | 'OCCUPIED' | 'CLEANING';
type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
type PaymentMethod     = 'CASH' | 'CARD';
type DishCategory      = 'hot_drinks' | 'cold_drinks' | 'breakfast' | 'sandwiches' | 'main' | 'salads' | 'desserts' | 'signature';

interface Dish {
  id: string;
  name: string;
  nameEn: string | null;
  price: string;
  category: DishCategory;
  image: string | null;
  isAvailable: boolean;
}

interface OrderItem {
  id: string;
  quantity: number;
  unitPrice: string;
  dish: { id: string; name: string; category: string; image: string | null };
}

interface Order {
  id: string;
  type: OrderType;
  status: OrderStatus;
  totalAmount: string;
  paymentMethod: PaymentMethod | null;
  tableId: string | null;
  deliveryAddress: string | null;
  table: { id: string; number: number; capacity: number } | null;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

interface TableFull {
  id: string;
  number: number;
  capacity: number;
  status: TableStatus;
  assignedWaiterId: string | null;
  assignedWaiter: { id: string; email: string } | null;
}

interface Reservation {
  id: string;
  status: ReservationStatus;
  numberOfGuests: number;
  startTime: string;
  endTime: string;
  table: { id: string; number: number; capacity: number };
  user: { id: string; email: string };
}

interface CartItem { dish: Dish; qty: number }

// ── Constants ─────────────────────────────────────────────────────────────────

const ACTIVE_ORDER_STATUSES = new Set<OrderStatus>(['CREATED', 'CONFIRMED', 'PREPARING', 'READY']);
const POLL_MS  = 10_000;
const NOTIFY_TTL_MS = 6_000;

const STATUS_BORDER: Record<OrderStatus, string> = {
  CREATED:   'border-l-amber-400',
  CONFIRMED: 'border-l-blue-400',
  PREPARING: 'border-l-orange-400',
  READY:     'border-l-emerald-400',
  COMPLETED: 'border-l-gray-300',
  CANCELLED: 'border-l-red-300',
};

const STATUS_BADGE: Record<OrderStatus, string> = {
  CREATED:   'bg-amber-100   text-amber-700',
  CONFIRMED: 'bg-blue-100    text-blue-700',
  PREPARING: 'bg-orange-100  text-orange-700',
  READY:     'bg-emerald-100 text-emerald-700',
  COMPLETED: 'bg-gray-100    text-gray-500',
  CANCELLED: 'bg-red-100     text-red-500',
};

const TABLE_GLOW: Record<TableStatus, string> = {
  FREE:     'ring-0',
  RESERVED: 'ring-2 ring-amber-300',
  OCCUPIED: 'ring-2 ring-red-300',
  CLEANING: 'ring-2 ring-gray-300',
};

const TABLE_STATUS_BG: Record<TableStatus, string> = {
  FREE:     'bg-emerald-100 text-emerald-700',
  RESERVED: 'bg-amber-100   text-amber-700',
  OCCUPIED: 'bg-red-100     text-red-700',
  CLEANING: 'bg-gray-100    text-gray-500',
};

const DISH_CATEGORIES: DishCategory[] = [
  'hot_drinks', 'cold_drinks', 'breakfast', 'sandwiches',
  'main', 'salads', 'desserts', 'signature',
];

// ── Toast ─────────────────────────────────────────────────────────────────────

interface Toast { id: string; message: string; type: 'success' | 'error' }

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const add = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);
  return { toasts, add };
}

function ToastStack({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="fixed bottom-24 right-4 z-[60] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`px-4 py-3 rounded-xl text-sm font-medium shadow-lg pointer-events-auto animate-fade-in
            ${t.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function startOfToday() {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function StaffPage() {
  return (
    <ProtectedPage roles={['WAITER', 'ADMIN']}>
      <StaffDashboard />
    </ProtectedPage>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

function StaffDashboard() {
  const { user }   = useAuth();
  const { t }      = useLocale();
  const { toasts, add: addToast } = useToasts();

  const [tables,       setTables]       = useState<TableFull[]>([]);
  const [orders,       setOrders]       = useState<Order[]>([]);
  const [restaurant,   setRestaurant]   = useState<{ id: string } | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [dishes,       setDishes]       = useState<Dish[]>([]);
  const [loadingInit,  setLoadingInit]  = useState(true);

  // Quick Order modal state
  const [quickTable, setQuickTable] = useState<TableFull | null>(null);

  // Polling
  const knownCreatedIds = useRef<Set<string>>(new Set());
  const initialDone     = useRef(false);
  const notifyTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadOrders = useCallback((silent = false) => {
    return apiFetch<{ items: Order[] }>('/api/orders?limit=100')
      .then(res => {
        const incoming = res.items;
        const createdNow = new Set(incoming.filter(o => o.status === 'CREATED').map(o => o.id));

        if (initialDone.current) {
          const fresh = [...createdNow].filter(id => !knownCreatedIds.current.has(id));
          if (fresh.length > 0) {
            addToast(`${t('staff.newOrderAlert')} (${fresh.length})`, 'success');
            if (notifyTimer.current) clearTimeout(notifyTimer.current);
            notifyTimer.current = setTimeout(() => {}, NOTIFY_TTL_MS);
          }
        }
        knownCreatedIds.current = createdNow;
        initialDone.current = true;
        setOrders(incoming);
      })
      .catch(() => { if (!silent) addToast(t('common.error'), 'error'); });
  }, [t, addToast]);

  // Initial load: tables + orders + restaurant + reservations + dishes
  useEffect(() => {
    Promise.all([
      apiFetch<TableFull[]>('/api/tables'),
      apiFetch<{ items: Order[] }>('/api/orders?limit=100'),
      apiFetch<{ id: string; name: string }[]>('/api/restaurants'),
      apiFetch<Dish[]>('/api/menu'),
    ])
      .then(([tbls, ordRes, rests, menuItems]) => {
        setTables(tbls);
        setOrders(ordRes.items);
        const rest = rests[0] ?? null;
        setRestaurant(rest);
        setDishes(menuItems);

        const createdNow = new Set(ordRes.items.filter(o => o.status === 'CREATED').map(o => o.id));
        knownCreatedIds.current = createdNow;
        initialDone.current = true;

        if (rest) {
          const today = new Date().toISOString().split('T')[0];
          return apiFetch<{ items: Reservation[] }>(
            `/api/reservations/restaurant/${rest.id}?date=${today}&limit=100`,
          ).then(r => setReservations(r.items));
        }
      })
      .finally(() => setLoadingInit(false));
  }, []);

  // Poll orders every 10s
  useEffect(() => {
    const id = setInterval(() => loadOrders(true), POLL_MS);
    return () => clearInterval(id);
  }, [loadOrders]);

  useEffect(() => () => { if (notifyTimer.current) clearTimeout(notifyTimer.current); }, []);

  const isAdmin      = user?.role === 'ADMIN';
  const myTables     = isAdmin ? tables : tables.filter(t => t.assignedWaiterId === user?.id);
  const activeOrders = orders.filter(o => ACTIVE_ORDER_STATUSES.has(o.status));
  const newOrders    = orders.filter(o => o.status === 'CREATED');

  const completedToday = orders.filter(o =>
    o.status === 'COMPLETED' && new Date(o.updatedAt) >= startOfToday()
  );
  const revenueToday = completedToday.reduce((sum, o) => sum + parseFloat(o.totalAmount), 0);

  const upcomingRes = reservations.filter(
    r => new Date(r.endTime) >= new Date() && (r.status === 'PENDING' || r.status === 'CONFIRMED')
  );
  const doneRes = reservations.filter(
    r => new Date(r.startTime) >= startOfToday() &&
         (r.status === 'COMPLETED' || r.status === 'CANCELLED')
  );

  // Map tableId → active order (for table cards)
  const orderByTable = new Map<string, Order>();
  activeOrders.forEach(o => { if (o.tableId) orderByTable.set(o.tableId, o); });

  // Map tableId → active reservation
  const reservationByTable = new Map<string, Reservation>();
  upcomingRes.forEach(r => reservationByTable.set(r.table.id, r));

  if (loadingInit) {
    return (
      <main className="min-h-screen bg-brand-cream flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-brand-espresso/20 border-t-brand-espresso animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-brand-cream pb-28">
      {/* Header */}
      <div className="sticky top-14 z-20 bg-brand-cream/90 backdrop-blur-lg border-b border-brand-espresso/8 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-brand-espresso">{t('staff.title')}</h1>
            <p className="text-xs text-brand-espresso/50">{user?.email}</p>
          </div>
          <div className="flex items-center gap-2">
            {newOrders.length > 0 && (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-400 text-amber-900 animate-pulse">
                {newOrders.length} {t('staff.newOrdersBadge')}
              </span>
            )}
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
              isAdmin ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'
            }`}>
              {user?.role}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pt-5 space-y-8">

        {/* Quick Stats */}
        <QuickStats
          myTables={myTables.length}
          activeOrders={activeOrders.length}
          upcomingRes={upcomingRes.length}
          completedToday={completedToday.length}
          t={t}
        />

        {/* My Tables */}
        <Section title={isAdmin ? t('staff.allTables') : t('staff.assignedTables')}>
          {myTables.length === 0 ? (
            <EmptyHint text={t('staff.noAssignedTables')} />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {myTables.map(table => (
                <TableCard
                  key={table.id}
                  table={table}
                  activeOrder={orderByTable.get(table.id) ?? null}
                  activeRes={reservationByTable.get(table.id) ?? null}
                  onQuickOrder={setQuickTable}
                  t={t}
                />
              ))}
            </div>
          )}
        </Section>

        {/* Active Orders */}
        <Section
          title={t('staff.tables')}
          headerRight={
            activeOrders.length > 0 ? (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-brand-espresso/10 text-brand-espresso/60">
                {activeOrders.length}
              </span>
            ) : undefined
          }
        >
          <ActiveOrdersPanel
            orders={activeOrders}
            onRefresh={() => loadOrders(false)}
            addToast={addToast}
            t={t}
          />
        </Section>

        {/* Completed Today */}
        <Section title={t('staff.completedToday')}>
          <CompletedTodayPanel
            orders={completedToday}
            revenue={revenueToday}
            t={t}
          />
        </Section>

        {/* Reservations */}
        <Section title={t('staff.reservations')}>
          <ReservationsPanel
            upcoming={upcomingRes}
            done={doneRes}
            addToast={addToast}
            onRefresh={() => {
              if (!restaurant) return;
              const today = new Date().toISOString().split('T')[0];
              apiFetch<{ items: Reservation[] }>(
                `/api/reservations/restaurant/${restaurant.id}?date=${today}&limit=100`
              ).then(r => setReservations(r.items)).catch(() => {});
            }}
            t={t}
          />
        </Section>

      </div>

      {/* Sticky FAB — Quick Order */}
      {myTables.length > 0 && (
        <div className="fixed bottom-6 right-4 z-30">
          <button
            onClick={() => setQuickTable(myTables[0])}
            className="btn-amber px-5 py-3 text-sm font-semibold rounded-2xl shadow-lg flex items-center gap-2"
          >
            <span className="text-base">+</span> {t('staff.quickOrder')}
          </button>
        </div>
      )}

      {/* Quick Order Modal */}
      {quickTable && (
        <QuickOrderModal
          table={quickTable}
          tables={myTables}
          dishes={dishes}
          onClose={() => setQuickTable(null)}
          onCreated={order => {
            setOrders(prev => [order, ...prev]);
            setQuickTable(null);
            addToast(t('staff.newOrderAlert'), 'success');
          }}
          addToast={addToast}
          t={t}
        />
      )}

      <ToastStack toasts={toasts} />
    </main>
  );
}

// ── Quick Stats ───────────────────────────────────────────────────────────────

function QuickStats({
  myTables, activeOrders, upcomingRes, completedToday, t,
}: {
  myTables: number; activeOrders: number; upcomingRes: number; completedToday: number;
  t: (k: string) => string;
}) {
  const stats = [
    { label: t('staff.assignedTables'), value: myTables,      color: 'text-brand-espresso' },
    { label: t('staff.inProgress'),     value: activeOrders,   color: 'text-amber-600'      },
    { label: t('staff.reservations'),   value: upcomingRes,    color: 'text-blue-600'       },
    { label: t('staff.completedToday'), value: completedToday, color: 'text-emerald-600'    },
  ];
  return (
    <div className="grid grid-cols-4 gap-2">
      {stats.map(({ label, value, color }) => (
        <div key={label} className="glass-card p-3 text-center">
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
          <p className="text-[10px] text-brand-espresso/50 mt-0.5 leading-tight">{label}</p>
        </div>
      ))}
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({
  title, headerRight, children,
}: {
  title: string; headerRight?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-brand-espresso/40">{title}</h2>
        {headerRight}
      </div>
      {children}
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <p className="text-sm text-brand-espresso/40 py-2">{text}</p>;
}

// ── Table Card ────────────────────────────────────────────────────────────────

function TableCard({
  table, activeOrder, activeRes, onQuickOrder, t,
}: {
  table: TableFull;
  activeOrder: Order | null;
  activeRes: Reservation | null;
  onQuickOrder: (t: TableFull) => void;
  t: (k: string) => string;
}) {
  return (
    <div className={`glass-card p-3 space-y-2 transition-all ${TABLE_GLOW[table.status]}`}>
      {/* Number + status */}
      <div className="flex items-center justify-between">
        <span className="text-2xl font-bold text-brand-espresso">#{table.number}</span>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${TABLE_STATUS_BG[table.status]}`}>
          {t(`tables.legend.${table.status.toLowerCase()}`)}
        </span>
      </div>

      {/* Capacity */}
      <p className="text-xs text-brand-espresso/50">{table.capacity} {t('reservation.seats')}</p>

      {/* Active reservation snippet */}
      {activeRes && (
        <div className="text-[10px] bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 leading-tight">
          <span className="font-semibold text-amber-700">{t('staff.activeReservation')}</span>
          <br />
          <span className="text-amber-600">{fmtTime(activeRes.startTime)}–{fmtTime(activeRes.endTime)} · {activeRes.numberOfGuests} {t('tables.guests')}</span>
        </div>
      )}

      {/* Active order snippet */}
      {activeOrder && (
        <div className={`text-[10px] rounded-lg px-2 py-1 leading-tight border-l-2 ${STATUS_BORDER[activeOrder.status]} ${STATUS_BADGE[activeOrder.status]} border`}>
          <span className="font-semibold">{t('staff.activeOrder')}</span>
          <br />
          <span>{activeOrder.items.length} {t('orders.items')} · {formatRubles(activeOrder.totalAmount)}</span>
        </div>
      )}

      {/* Quick order button */}
      <button
        onClick={() => onQuickOrder(table)}
        className="w-full btn-amber text-xs py-2 rounded-xl font-medium"
      >
        + {t('staff.quickOrder')}
      </button>
    </div>
  );
}

// ── Active Orders Panel ───────────────────────────────────────────────────────

function ActiveOrdersPanel({
  orders, onRefresh, addToast, t,
}: {
  orders: Order[];
  onRefresh: () => void;
  addToast: (msg: string, type: 'success' | 'error') => void;
  t: (k: string) => string;
}) {
  if (orders.length === 0) {
    return <EmptyHint text={t('staff.noOrders')} />;
  }

  const newO = orders.filter(o => o.status === 'CREATED');
  const inP  = orders.filter(o => o.status === 'CONFIRMED' || o.status === 'PREPARING');
  const ready = orders.filter(o => o.status === 'READY');

  return (
    <div className="space-y-5">
      {newO.length > 0 && (
        <OrderGroup label={t('staff.newOrders')} count={newO.length} accent="amber">
          {newO.map(o => <OrderCard key={o.id} order={o} onRefresh={onRefresh} addToast={addToast} t={t} />)}
        </OrderGroup>
      )}
      {inP.length > 0 && (
        <OrderGroup label={t('staff.inProgress')} count={inP.length} accent="blue">
          {inP.map(o => <OrderCard key={o.id} order={o} onRefresh={onRefresh} addToast={addToast} t={t} />)}
        </OrderGroup>
      )}
      {ready.length > 0 && (
        <OrderGroup label={t('orders.status.READY')} count={ready.length} accent="emerald">
          {ready.map(o => <OrderCard key={o.id} order={o} onRefresh={onRefresh} addToast={addToast} t={t} />)}
        </OrderGroup>
      )}
    </div>
  );
}

function OrderGroup({
  label, count, accent, children,
}: {
  label: string; count: number; accent: 'amber' | 'blue' | 'emerald'; children: React.ReactNode;
}) {
  const colors = {
    amber:   'bg-amber-100   text-amber-700',
    blue:    'bg-blue-100    text-blue-700',
    emerald: 'bg-emerald-100 text-emerald-700',
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-brand-espresso/50">{label}</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${colors[accent]}`}>{count}</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {children}
      </div>
    </div>
  );
}

const ORDER_ACTION_KEYS: Partial<Record<OrderStatus, { next: OrderStatus; labelKey: string; cls: string }>> = {
  CREATED:   { next: 'CONFIRMED', labelKey: 'staff.accept',   cls: 'bg-amber-500   hover:bg-amber-400   text-white' },
  CONFIRMED: { next: 'PREPARING', labelKey: 'staff.start',    cls: 'bg-blue-600    hover:bg-blue-500    text-white' },
  PREPARING: { next: 'READY',     labelKey: 'staff.finish',   cls: 'bg-orange-500  hover:bg-orange-400  text-white' },
  READY:     { next: 'COMPLETED', labelKey: 'staff.complete', cls: 'bg-emerald-600 hover:bg-emerald-500 text-white' },
};

function OrderCard({
  order, onRefresh, addToast, t,
}: {
  order: Order;
  onRefresh: () => void;
  addToast: (msg: string, type: 'success' | 'error') => void;
  t: (k: string) => string;
}) {
  const [busy, setBusy]           = useState(false);
  const [showCancel, setCancel]   = useState(false);
  const action = ORDER_ACTION_KEYS[order.status];

  async function advance() {
    if (!action) return;
    setBusy(true);
    try {
      await apiFetch(`/api/orders/${order.id}/status`, {
        method: 'PATCH',
        body: { status: action.next },
      });
      onRefresh();
    } catch {
      addToast(t('common.error'), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function cancelOrder() {
    setBusy(true);
    try {
      await apiFetch(`/api/orders/${order.id}/cancel`, { method: 'PATCH' });
      onRefresh();
      addToast(t('profile.orderCancelled'), 'success');
    } catch {
      addToast(t('common.error'), 'error');
    } finally {
      setBusy(false);
      setCancel(false);
    }
  }

  const shortId = order.id.slice(0, 8).toUpperCase();

  return (
    <div className={`glass-card overflow-hidden border-l-4 ${STATUS_BORDER[order.status]}`}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between gap-2 border-b border-brand-espresso/8">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="font-mono text-xs font-bold text-brand-espresso/60">#{shortId}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_BADGE[order.status]}`}>
            {t(`orders.status.${order.status}`)}
          </span>
          {order.table && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
              #{order.table.number}
            </span>
          )}
        </div>
        <span className="text-sm font-bold text-brand-espresso shrink-0">
          {formatRubles(order.totalAmount)}
        </span>
      </div>

      {/* Items */}
      {order.items.length > 0 && (
        <div className="px-4 py-2.5 space-y-1">
          {order.items.map(item => (
            <div key={item.id} className="text-sm text-brand-espresso flex items-baseline gap-1.5">
              <span className="text-brand-espresso/40 tabular-nums text-xs">{item.quantity}×</span>
              {item.dish.name}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="px-4 py-2.5 border-t border-brand-espresso/8 flex items-center gap-3">
        {action && (
          <button
            onClick={advance}
            disabled={busy}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 transition-colors ${action.cls}`}
          >
            {busy ? '…' : t(action.labelKey)}
          </button>
        )}
        {!showCancel ? (
          <button
            onClick={() => setCancel(true)}
            disabled={busy}
            className="text-xs text-red-400 hover:text-red-600 disabled:opacity-40 transition-colors py-1"
          >
            {t('orders.cancel')}
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-brand-espresso/50">{t('staff.cancelOrderQ')}</span>
            <button onClick={cancelOrder} disabled={busy} className="text-xs font-semibold text-red-600 hover:text-red-700">
              {t('common.yes')}
            </button>
            <button onClick={() => setCancel(false)} className="text-xs text-brand-espresso/50 hover:text-brand-espresso">
              {t('common.no')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Completed Today Panel ─────────────────────────────────────────────────────

function CompletedTodayPanel({
  orders, revenue, t,
}: {
  orders: Order[]; revenue: number; t: (k: string) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const showCount = 3;

  if (orders.length === 0) {
    return <EmptyHint text={t('staff.noCompletedToday')} />;
  }

  const visible = expanded ? orders : orders.slice(0, showCount);

  return (
    <div className="space-y-3">
      {/* Summary chips */}
      <div className="flex gap-3 flex-wrap">
        <div className="glass-card px-4 py-2.5 flex items-center gap-2">
          <span className="text-lg font-bold text-emerald-600">{orders.length}</span>
          <span className="text-xs text-brand-espresso/50">{t('orders.title').toLowerCase()}</span>
        </div>
        <div className="glass-card px-4 py-2.5 flex items-center gap-2">
          <span className="text-lg font-bold text-emerald-600">{formatRubles(revenue)}</span>
          <span className="text-xs text-brand-espresso/50">{t('staff.revenue')}</span>
        </div>
      </div>

      {/* Order list */}
      <div className="space-y-2">
        {visible.map(order => (
          <div key={order.id} className="glass-card px-4 py-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="font-mono text-xs text-brand-espresso/40">#{order.id.slice(0, 8).toUpperCase()}</span>
              {order.table && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                  #{order.table.number}
                </span>
              )}
              <span className="text-xs text-brand-espresso/50 truncate">
                {order.items.length} {t('orders.items')}
              </span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs text-brand-espresso/40">{fmtTime(order.updatedAt)}</span>
              <span className="text-sm font-semibold text-brand-espresso">{formatRubles(order.totalAmount)}</span>
            </div>
          </div>
        ))}
      </div>

      {orders.length > showCount && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-xs text-brand-espresso/50 hover:text-brand-espresso transition-colors"
        >
          {expanded ? t('profile.showLess') : `${t('profile.showMore')} (${orders.length - showCount})`}
        </button>
      )}
    </div>
  );
}

// ── Reservations Panel ────────────────────────────────────────────────────────

function ReservationsPanel({
  upcoming, done, addToast, onRefresh, t,
}: {
  upcoming: Reservation[];
  done: Reservation[];
  addToast: (msg: string, type: 'success' | 'error') => void;
  onRefresh: () => void;
  t: (k: string) => string;
}) {
  if (upcoming.length === 0 && done.length === 0) {
    return <EmptyHint text={t('common.noData')} />;
  }

  return (
    <div className="space-y-4">
      {upcoming.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-brand-espresso/30">{t('staff.upcoming')}</p>
          {upcoming.map(r => (
            <ReservationRow key={r.id} reservation={r} onRefresh={onRefresh} addToast={addToast} t={t} />
          ))}
        </div>
      )}
      {done.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-brand-espresso/30">{t('staff.todayDone')}</p>
          {done.map(r => (
            <ReservationRow key={r.id} reservation={r} onRefresh={onRefresh} addToast={addToast} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReservationRow({
  reservation: r, onRefresh, addToast, t,
}: {
  reservation: Reservation;
  onRefresh: () => void;
  addToast: (msg: string, type: 'success' | 'error') => void;
  t: (k: string) => string;
}) {
  const [busy, setBusy] = useState(false);
  const isActive        = r.status === 'PENDING' || r.status === 'CONFIRMED';
  const isNow           = new Date(r.startTime) <= new Date() && new Date(r.endTime) >= new Date();
  const shortId         = r.id.slice(0, 6).toUpperCase();

  async function act(endpoint: string) {
    setBusy(true);
    try {
      await apiFetch(`/api/reservations/${r.id}/${endpoint}`, { method: 'PATCH' });
      onRefresh();
    } catch {
      addToast(t('common.error'), 'error');
    } finally {
      setBusy(false);
    }
  }

  const RES_BADGE: Record<ReservationStatus, string> = {
    PENDING:   'bg-amber-100 text-amber-700',
    CONFIRMED: 'bg-blue-100  text-blue-700',
    COMPLETED: 'bg-emerald-100 text-emerald-700',
    CANCELLED: 'bg-red-100   text-red-500',
  };

  return (
    <div className={`glass-card px-4 py-3 flex flex-wrap items-center gap-3 ${
      isNow && isActive ? 'ring-2 ring-blue-300' : ''
    }`}>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs font-bold text-brand-espresso/50">#{shortId}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${RES_BADGE[r.status]}`}>
            {t(`reservation.status.${r.status}`)}
          </span>
          {isNow && isActive && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-600 text-white font-semibold">{t('staff.nowPill')}</span>
          )}
          <span className="text-xs text-brand-espresso/50">#{r.table.number} · {r.numberOfGuests} {t('tables.guests')}</span>
        </div>
        <p className="text-xs text-brand-espresso/40">
          {fmtDate(r.startTime)} · {fmtTime(r.startTime)}–{fmtTime(r.endTime)}
          <span className="ml-2">{r.user.email}</span>
        </p>
      </div>

      {isActive && (
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {r.status === 'PENDING' && (
            <button
              onClick={() => act('confirm')}
              disabled={busy}
              className="text-xs bg-blue-600 text-white px-3 py-2 rounded-xl hover:bg-blue-500 disabled:opacity-40 font-medium transition-colors"
            >
              {t('staff.confirm')}
            </button>
          )}
          {r.status === 'CONFIRMED' && (
            <button
              onClick={() => act('complete')}
              disabled={busy}
              className="text-xs bg-emerald-600 text-white px-3 py-2 rounded-xl hover:bg-emerald-500 disabled:opacity-40 font-medium transition-colors"
            >
              {t('staff.complete')}
            </button>
          )}
          <button
            onClick={() => act('cancel')}
            disabled={busy}
            className="text-xs text-red-400 hover:text-red-600 disabled:opacity-40 transition-colors py-1"
          >
            {t('common.cancel')}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Quick Order Modal ─────────────────────────────────────────────────────────

function QuickOrderModal({
  table, tables, dishes, onClose, onCreated, addToast, t,
}: {
  table: TableFull;
  tables: TableFull[];
  dishes: Dish[];
  onClose: () => void;
  onCreated: (order: Order) => void;
  addToast: (msg: string, type: 'success' | 'error') => void;
  t: (k: string) => string;
}) {
  const [selectedTableId, setSelectedTableId] = useState(table.id);
  const [cart,    setCart]    = useState<Map<string, CartItem>>(new Map());
  const [search,  setSearch]  = useState('');
  const [catFilter, setCat]   = useState<DishCategory | 'all'>('all');
  const [payment, setPayment] = useState<PaymentMethod>('CASH');
  const [placing, setPlacing] = useState(false);

  const filtered = dishes.filter(d => {
    const matchSearch = !search || d.name.toLowerCase().includes(search.toLowerCase()) ||
      (d.nameEn?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchCat = catFilter === 'all' || d.category === catFilter;
    return matchSearch && matchCat;
  });

  function addToCart(dish: Dish) {
    setCart(prev => {
      const next = new Map(prev);
      const existing = next.get(dish.id);
      next.set(dish.id, { dish, qty: (existing?.qty ?? 0) + 1 });
      return next;
    });
  }

  function setQty(dishId: string, qty: number) {
    setCart(prev => {
      const next = new Map(prev);
      if (qty <= 0) next.delete(dishId);
      else next.set(dishId, { ...next.get(dishId)!, qty });
      return next;
    });
  }

  const cartItems = [...cart.values()];
  const total = cartItems.reduce((s, ci) => s + parseFloat(ci.dish.price) * ci.qty, 0);

  async function placeOrder() {
    if (cartItems.length === 0) return;
    setPlacing(true);
    try {
      const order = await apiFetch<Order>('/api/orders', {
        method: 'POST',
        body: {
          type:          'DINE_IN',
          tableId:       selectedTableId,
          paymentMethod: payment,
          items:         cartItems.map(ci => ({ dishId: ci.dish.id, quantity: ci.qty })),
        },
      });
      onCreated(order);
    } catch {
      addToast(t('order.errorGeneric'), 'error');
    } finally {
      setPlacing(false);
    }
  }

  // Active categories in filtered set
  const activeCats = DISH_CATEGORIES.filter(cat => filtered.some(d => d.category === cat));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="glass-modal w-full sm:max-w-lg max-h-[92vh] flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden">

        {/* Modal header */}
        <div className="px-5 py-4 border-b border-brand-espresso/10 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-base font-semibold text-brand-espresso">{t('staff.quickOrder')}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <select
                value={selectedTableId}
                onChange={e => setSelectedTableId(e.target.value)}
                className="text-xs text-brand-espresso/60 bg-transparent border-none outline-none cursor-pointer"
              >
                {tables.map(tbl => (
                  <option key={tbl.id} value={tbl.id}>#{tbl.number} ({tbl.capacity} {t('reservation.seats')})</option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-brand-espresso/40 hover:text-brand-espresso text-xl font-light w-8 h-8 flex items-center justify-center rounded-full hover:bg-brand-espresso/5 transition-all"
          >
            ×
          </button>
        </div>

        {/* Search + category chips */}
        <div className="px-4 py-3 border-b border-brand-espresso/8 space-y-2 shrink-0">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('menu.search')}
            className="glass-input px-3 py-2 text-sm w-full"
          />
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setCat('all')}
              className={`text-xs px-3 py-1.5 rounded-full font-medium shrink-0 transition-all ${
                catFilter === 'all' ? 'bg-brand-espresso text-brand-cream' : 'bg-brand-espresso/8 text-brand-espresso/60'
              }`}
            >
              {t('menu.all')}
            </button>
            {activeCats.map(cat => (
              <button
                key={cat}
                onClick={() => setCat(cat)}
                className={`text-xs px-3 py-1.5 rounded-full font-medium shrink-0 transition-all ${
                  catFilter === cat ? 'bg-brand-espresso text-brand-cream' : 'bg-brand-espresso/8 text-brand-espresso/60'
                }`}
              >
                {t(`menu.categories.${cat}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Dish grid — scrollable */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {filtered.length === 0 ? (
            <p className="text-sm text-brand-espresso/40 text-center py-8">{t('common.noData')}</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {filtered.map(dish => {
                const inCart = cart.get(dish.id);
                return (
                  <div
                    key={dish.id}
                    className={`glass-card p-3 space-y-2 cursor-pointer transition-all ${
                      inCart ? 'ring-2 ring-amber-400' : ''
                    }`}
                    onClick={() => !inCart && addToCart(dish)}
                  >
                    {dish.image && (
                      <img src={dish.image} alt="" className="w-full h-20 object-cover rounded-lg" />
                    )}
                    <div>
                      <p className="text-xs font-medium text-brand-espresso leading-tight">{dish.name}</p>
                      <p className="text-xs text-brand-espresso/50 font-semibold mt-0.5">{formatRubles(dish.price)}</p>
                    </div>
                    {inCart ? (
                      <div className="flex items-center justify-between">
                        <button
                          onClick={(e) => { e.stopPropagation(); setQty(dish.id, inCart.qty - 1); }}
                          className="w-7 h-7 rounded-full bg-brand-espresso/10 text-brand-espresso text-lg font-medium flex items-center justify-center hover:bg-brand-espresso/20"
                        >
                          −
                        </button>
                        <span className="text-sm font-bold text-brand-espresso">{inCart.qty}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setQty(dish.id, inCart.qty + 1); }}
                          className="w-7 h-7 rounded-full bg-amber-400 text-white text-lg font-medium flex items-center justify-center hover:bg-amber-500"
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <button
                        className="w-full text-xs py-1.5 rounded-lg bg-amber-100 text-amber-700 font-medium hover:bg-amber-200 transition-colors"
                      >
                        + {t('menu.addToCart')}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Cart summary + payment + submit */}
        {cartItems.length > 0 && (
          <div className="px-4 py-4 border-t border-brand-espresso/10 space-y-3 shrink-0 bg-brand-cream/80 backdrop-blur-sm">
            {/* Cart items summary */}
            <div className="flex flex-col gap-1 max-h-24 overflow-y-auto">
              {cartItems.map(ci => (
                <div key={ci.dish.id} className="flex items-center justify-between text-xs text-brand-espresso/70">
                  <span className="truncate flex-1">{ci.qty}× {ci.dish.name}</span>
                  <span className="shrink-0 ml-2 font-medium">{formatRubles(parseFloat(ci.dish.price) * ci.qty)}</span>
                </div>
              ))}
            </div>

            {/* Payment method */}
            <div className="flex gap-2">
              <button
                onClick={() => setPayment('CASH')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  payment === 'CASH'
                    ? 'bg-brand-espresso text-brand-cream'
                    : 'bg-brand-espresso/8 text-brand-espresso/60 hover:bg-brand-espresso/15'
                }`}
              >
                {t('order.payCash')}
              </button>
              <button
                onClick={() => setPayment('CARD')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  payment === 'CARD'
                    ? 'bg-brand-espresso text-brand-cream'
                    : 'bg-brand-espresso/8 text-brand-espresso/60 hover:bg-brand-espresso/15'
                }`}
              >
                {t('order.payCard')}
              </button>
            </div>

            {/* Total + submit */}
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="text-xs text-brand-espresso/50">{t('orders.total')}</p>
                <p className="text-lg font-bold text-brand-espresso">{formatRubles(total)}</p>
              </div>
              <button
                onClick={placeOrder}
                disabled={placing}
                className="flex-1 btn-amber py-3 text-sm font-semibold rounded-xl disabled:opacity-60"
              >
                {placing ? t('order.placing') : t('order.confirmOrder')}
              </button>
            </div>
          </div>
        )}

        {cartItems.length === 0 && (
          <div className="px-4 py-3 border-t border-brand-espresso/10 text-center shrink-0">
            <p className="text-xs text-brand-espresso/40">{t('order.emptyCart')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
