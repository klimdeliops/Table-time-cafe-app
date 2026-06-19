'use client';

import { useCallback, useEffect, useState } from 'react';
import { ProtectedPage } from '@/components/ProtectedPage';
import { apiFetch, ApiError } from '@/shared/api/client';
import { useLocale } from '@/hooks/useLocale';
import { formatDate, formatDateTime } from '@/lib/formatters';

type DishCategory =
  | 'hot_drinks' | 'cold_drinks' | 'breakfast' | 'sandwiches'
  | 'main' | 'salads' | 'desserts' | 'signature';

type TableStatus = 'FREE' | 'RESERVED' | 'OCCUPIED' | 'CLEANING';
type UserRole    = 'GUEST' | 'USER' | 'WAITER' | 'ADMIN';
type OrdStatus   = 'CREATED' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED';
type AdminTab    = 'analytics' | 'menu' | 'tables' | 'orders' | 'reservations' | 'accounts' | 'personnel';
type ResStatus   = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';

interface Dish {
  id: string; name: string; nameEn: string | null;
  price: string; category: DishCategory;
  image: string | null; isAvailable: boolean;
}

interface TableFull {
  id: string; restaurantId: string; number: number;
  capacity: number; x: number; y: number;
  status: TableStatus; assignedWaiterId: string | null;
  assignedWaiter: { id: string; email: string; role: UserRole } | null;
}

interface User {
  id: string; email: string; role: UserRole; createdAt: string;
}

interface OrderItem {
  id: string; quantity: number; unitPrice: string;
  dish: { id: string; name: string };
}

interface Order {
  id: string; status: OrdStatus; totalAmount: string;
  tableId: string | null;
  table: { id: string; number: number } | null;
  items: OrderItem[]; createdAt: string; type: string;
}

interface Restaurant { id: string; name: string; }
interface Toast { id: string; message: string; type: 'success' | 'error'; }

interface Reservation {
  id: string;
  status: ResStatus;
  numberOfGuests: number;
  startTime: string;
  endTime: string;
  createdAt: string;
  user: { id: string; email: string };
  table: { id: string; number: number; capacity: number };
}

const DISH_CATEGORIES: DishCategory[] = [
  'hot_drinks', 'cold_drinks', 'breakfast', 'sandwiches',
  'main', 'salads', 'desserts', 'signature',
];

const CATEGORY_COLOR: Record<DishCategory, string> = {
  hot_drinks:  'bg-orange-100 text-orange-700',
  cold_drinks: 'bg-sky-100    text-sky-700',
  breakfast:   'bg-yellow-100 text-yellow-700',
  sandwiches:  'bg-amber-100  text-amber-700',
  main:        'bg-red-100    text-red-700',
  salads:      'bg-green-100  text-green-700',
  desserts:    'bg-pink-100   text-pink-700',
  signature:   'bg-purple-100 text-purple-700',
};

const STATUS_STYLE: Record<TableStatus, { bg: string; text: string }> = {
  FREE:     { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  RESERVED: { bg: 'bg-amber-100',   text: 'text-amber-700'   },
  OCCUPIED: { bg: 'bg-red-100',     text: 'text-red-700'     },
  CLEANING: { bg: 'bg-gray-100',    text: 'text-gray-500'    },
};

const TABLE_CARD_STYLE: Record<TableStatus, {
  cardBg:    string;
  topBorder: string;
  badgeBg:   string;
  badgeText: string;
  numColor:  string;
  icon:      string;
  iconBg:    string;
}> = {
  FREE: {
    cardBg:    'bg-emerald-50/60 border border-emerald-200/70',
    topBorder: 'bg-emerald-400',
    badgeBg:   'bg-emerald-100',
    badgeText: 'text-emerald-700',
    numColor:  'text-emerald-800',
    icon:      '✓',
    iconBg:    'bg-emerald-100 text-emerald-600',
  },
  RESERVED: {
    cardBg:    'bg-amber-50/60 border border-amber-200/70',
    topBorder: 'bg-amber-400',
    badgeBg:   'bg-amber-100',
    badgeText: 'text-amber-700',
    numColor:  'text-amber-900',
    icon:      '📅',
    iconBg:    'bg-amber-100 text-amber-700',
  },
  OCCUPIED: {
    cardBg:    'bg-red-50/60 border border-red-200/70',
    topBorder: 'bg-red-400',
    badgeBg:   'bg-red-100',
    badgeText: 'text-red-700',
    numColor:  'text-red-900',
    icon:      '●',
    iconBg:    'bg-red-100 text-red-500',
  },
  CLEANING: {
    cardBg:    'bg-gray-100/80 border border-gray-200/70',
    topBorder: 'bg-gray-400',
    badgeBg:   'bg-gray-200',
    badgeText: 'text-gray-600',
    numColor:  'text-gray-700',
    icon:      '🧹',
    iconBg:    'bg-gray-200 text-gray-500',
  },
};

const ORD_STATUS_STYLE: Record<OrdStatus, { bg: string; text: string }> = {
  CREATED:   { bg: 'bg-gray-100',    text: 'text-gray-600'    },
  CONFIRMED: { bg: 'bg-blue-100',    text: 'text-blue-700'    },
  PREPARING: { bg: 'bg-orange-100',  text: 'text-orange-700'  },
  READY:     { bg: 'bg-green-100',   text: 'text-green-700'   },
  COMPLETED: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  CANCELLED: { bg: 'bg-red-100',     text: 'text-red-600'     },
};

const ROLE_STYLE: Record<UserRole, string> = {
  GUEST:  'bg-gray-100   text-gray-500',
  USER:   'bg-blue-100   text-blue-700',
  WAITER: 'bg-amber-100  text-amber-700',
  ADMIN:  'bg-purple-100 text-purple-700',
};

const cancelBtnCls = 'text-sm px-4 py-2 rounded-xl bg-brand-espresso/8 text-brand-espresso/70 hover:bg-brand-espresso/14 transition-colors font-medium';
const inputCls     = 'glass-input w-full px-3 py-2 text-sm rounded-xl';
const labelCls     = 'block text-xs font-medium text-brand-espresso/60 mb-1';
const sectionTitle = 'text-lg font-semibold text-brand-espresso';

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const addToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);
  return { toasts, addToast };
}

function ToastContainer({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="fixed bottom-6 right-6 z-[70] flex flex-col gap-2 pointer-events-none">
      {toasts.map(toast => (
        <div key={toast.id} className={`px-4 py-3 rounded-xl text-sm font-medium shadow-lg animate-fade-in pointer-events-auto ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {children}
    </div>
  );
}

function ConfirmModal({ title, body, confirmLabel, onConfirm, onCancel, loading, danger = false }: {
  title: string; body: string; confirmLabel?: string;
  onConfirm: () => void; onCancel: () => void;
  loading?: boolean; danger?: boolean;
}) {
  const { t } = useLocale();
  return (
    <Overlay onClose={onCancel}>
      <div className="glass-modal rounded-2xl max-w-sm w-full p-6 space-y-4">
        <h3 className="text-base font-semibold text-brand-espresso">{title}</h3>
        <p className="text-sm text-brand-espresso/70">{body}</p>
        <div className="flex gap-3 justify-end pt-1">
          <button onClick={onCancel} className={cancelBtnCls}>{t('common.cancel')}</button>
          <button onClick={onConfirm} disabled={loading} className={`text-sm px-4 py-2 rounded-xl font-medium disabled:opacity-60 ${danger ? 'bg-red-500 text-white hover:bg-red-600' : 'btn-amber'}`}>
            {loading ? t('common.loading') : (confirmLabel ?? t('common.confirm'))}
          </button>
        </div>
      </div>
    </Overlay>
  );
}

function Shimmer({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-brand-espresso/8 ${className ?? ''}`} />;
}

export default function AdminPage() {
  return (
    <ProtectedPage roles={['ADMIN']}>
      <AdminDashboard />
    </ProtectedPage>
  );
}

function AdminDashboard() {
  const { t } = useLocale();
  const { toasts, addToast } = useToasts();

  const [tab, setTab]               = useState<AdminTab>('analytics');
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [users, setUsers]           = useState<User[]>([]);
  const [loadingShell, setLoadingShell] = useState(true);
  const [shellError, setShellError]     = useState('');

  useEffect(() => {
    Promise.all([
      apiFetch<Restaurant[]>('/api/restaurants'),
      apiFetch<User[]>('/api/users'),
    ])
      .then(([rests, usersArr]) => {
        setRestaurant(rests[0] ?? null);
        setUsers(usersArr);
      })
      .catch((err) => setShellError(err instanceof ApiError ? err.message : t('common.error')))
      .finally(() => setLoadingShell(false));
  }, [t]);

  const waiters = users.filter(u => u.role === 'WAITER');

  const TABS: { key: AdminTab; label: string }[] = [
    { key: 'analytics',    label: t('admin.analyticsSection')    },
    { key: 'menu',         label: t('admin.menuSection')         },
    { key: 'tables',       label: t('admin.tablesSection')       },
    { key: 'orders',       label: t('admin.ordersSection')       },
    { key: 'reservations', label: t('admin.reservationsSection') },
    { key: 'accounts',     label: t('admin.accountsSection')     },
    { key: 'personnel',    label: t('admin.personnelSection')    },
  ];

  return (
    <main className="min-h-screen bg-brand-cream py-8 px-4">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-brand-espresso">{t('admin.title')}</h1>
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-purple-100 text-purple-700">ADMIN</span>
        </div>

        {/* Tab nav */}
        <nav className="overflow-x-auto scrollbar-none">
          <div className="flex gap-1 p-1 glass-card rounded-2xl min-w-max">
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`text-sm font-medium py-2 px-4 rounded-xl transition-all whitespace-nowrap ${
                  tab === key ? 'bg-brand-espresso text-brand-cream shadow-sm' : 'text-brand-espresso/60 hover:text-brand-espresso'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </nav>

        {shellError && (
          <div role="alert" className="glass-card rounded-xl px-4 py-3 border border-red-200 text-sm text-red-600">{shellError}</div>
        )}

        {loadingShell ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Shimmer key={i} className="h-28" />)}
          </div>
        ) : (
          <>
            {tab === 'analytics' && restaurant && (
              <AnalyticsTab restaurantId={restaurant.id} waiters={waiters} />
            )}
            {tab === 'menu' && <MenuTab addToast={addToast} />}
            {tab === 'tables' && restaurant && (
              <TablesTab waiters={waiters} restaurantId={restaurant.id} addToast={addToast} />
            )}
            {tab === 'orders' && <OrdersAdminTab addToast={addToast} waiters={waiters} />}
            {tab === 'reservations' && restaurant && (
              <ReservationsAdminTab restaurantId={restaurant.id} addToast={addToast} />
            )}
            {tab === 'accounts' && (
              <AccountsTab users={users} setUsers={setUsers} addToast={addToast} />
            )}
            {tab === 'personnel' && (
              <PersonnelTab waiters={waiters} addToast={addToast} />
            )}
          </>
        )}
      </div>

      <ToastContainer toasts={toasts} />
    </main>
  );
}

function AnalyticsTab({ restaurantId, waiters }: { restaurantId: string; waiters: User[] }) {
  const { t } = useLocale();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    ordersToday: 0, reservationsToday: 0,
    occupiedTables: 0, totalTables: 0,
  });

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

    Promise.all([
      apiFetch<{ items: { createdAt: string }[]; total: number }>('/api/orders?limit=200'),
      apiFetch<TableFull[]>('/api/tables'),
      apiFetch<{ total: number } | { items: unknown[] }>(`/api/reservations/restaurant/${restaurantId}?date=${today}&limit=1`),
    ]).then(([ordersRes, tables, resData]) => {
      const resTotal = 'total' in resData ? resData.total : ('items' in resData ? (resData as { items: unknown[] }).items.length : 0);
      setStats({
        ordersToday:       ordersRes.items.filter(o => new Date(o.createdAt) >= todayStart).length,
        reservationsToday: resTotal,
        occupiedTables:    tables.filter(tbl => tbl.status === 'OCCUPIED').length,
        totalTables:       tables.length,
      });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [restaurantId]);

  const cards = [
    { label: t('admin.ordersToday'),        value: stats.ordersToday,      icon: '🛒', accent: 'border-amber-300'  },
    { label: t('admin.reservationsToday'),  value: stats.reservationsToday, icon: '📅', accent: 'border-blue-300'  },
    { label: t('admin.occupiedTables'),     value: `${stats.occupiedTables}/${stats.totalTables}`, icon: '🪑', accent: 'border-red-300' },
    { label: t('admin.totalStaff'),         value: waiters.length,          icon: '👤', accent: 'border-purple-300' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map(({ label, value, icon, accent }) => (
        <div key={label} className={`glass-card p-5 space-y-2 border-t-4 ${accent}`}>
          {loading ? <Shimmer className="h-14" /> : (
            <>
              <div className="text-2xl">{icon}</div>
              <div className="text-3xl font-bold text-brand-espresso">{value}</div>
              <div className="text-xs text-brand-espresso/60">{label}</div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function DishModal({ dish, onClose, onSave, addToast }: {
  dish: Dish | null; onClose: () => void;
  onSave: (dish: Dish) => void;
  addToast: (msg: string, type: 'success' | 'error') => void;
}) {
  const { t } = useLocale();
  const isEdit = !!dish;

  const [form, setForm] = useState({
    name:        dish?.name        ?? '',
    nameEn:      dish?.nameEn      ?? '',
    price:       dish ? String(parseFloat(dish.price)) : '',
    category:    dish?.category    ?? ('main' as DishCategory),
    image:       dish?.image       ?? '',
    isAvailable: dish?.isAvailable ?? true,
  });
  const [saving, setSaving] = useState(false);

  function set(field: string, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(), nameEn: form.nameEn.trim() || undefined,
        price: parseFloat(form.price), category: form.category,
        image: form.image.trim() || undefined, isAvailable: form.isAvailable,
      };
      const saved = isEdit
        ? await apiFetch<Dish>(`/api/menu/${dish!.id}`, { method: 'PATCH', body })
        : await apiFetch<Dish>('/api/menu', { method: 'POST', body });
      addToast(t('admin.saved'), 'success');
      onSave(saved);
    } catch {
      addToast(t('admin.errorSaving'), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Overlay onClose={onClose}>
      <div className="glass-modal rounded-2xl max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-base font-semibold text-brand-espresso">
          {isEdit ? t('admin.editDish') : t('admin.createDish')}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className={labelCls}>{t('admin.dishNameRu')} *</label>
              <input required value={form.name} onChange={e => set('name', e.target.value)} className={inputCls} placeholder="Капучино" />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>{t('admin.dishNameEn')}</label>
              <input value={form.nameEn} onChange={e => set('nameEn', e.target.value)} className={inputCls} placeholder="Cappuccino" />
            </div>
            <div>
              <label className={labelCls}>{t('admin.dishPrice')} *</label>
              <input required type="number" min="1" step="0.01" value={form.price} onChange={e => set('price', e.target.value)} className={inputCls} placeholder="350" />
            </div>
            <div>
              <label className={labelCls}>{t('admin.dishCategory')} *</label>
              <select value={form.category} onChange={e => set('category', e.target.value)} className={inputCls}>
                {DISH_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{t(`menu.categories.${cat}`)}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>{t('admin.dishImageUrl')}</label>
              <input value={form.image} onChange={e => set('image', e.target.value)} className={inputCls} placeholder="https://…" />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={form.isAvailable} onChange={e => set('isAvailable', e.target.checked)} className="w-4 h-4 accent-amber-600" />
            <span className="text-sm text-brand-espresso">{t('admin.dishAvailable')}</span>
          </label>

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className={cancelBtnCls}>{t('common.cancel')}</button>
            <button type="submit" disabled={saving} className="btn-amber text-sm px-5 py-2 disabled:opacity-60">
              {saving ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </Overlay>
  );
}

function MenuTab({ addToast }: { addToast: (msg: string, type: 'success' | 'error') => void }) {
  const { t } = useLocale();
  const [dishes, setDishes]       = useState<Dish[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [editingDish, setEditing] = useState<Dish | null | 'new'>(null);
  const [confirm, setConfirm]     = useState<{ dish: Dish; action: 'delete' | 'toggle' } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    apiFetch<Dish[]>('/api/menu/admin/all')
      .then(data => { setDishes(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = dishes.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    (d.nameEn?.toLowerCase().includes(search.toLowerCase()) ?? false)
  );

  const byCategory = DISH_CATEGORIES
    .map(cat => ({ cat, items: filtered.filter(d => d.category === cat) }))
    .filter(g => g.items.length > 0);

  function handleSave(saved: Dish) {
    setDishes(prev => {
      const idx = prev.findIndex(d => d.id === saved.id);
      return idx >= 0 ? prev.map(d => d.id === saved.id ? saved : d) : [...prev, saved];
    });
    setEditing(null);
  }

  async function executeAction() {
    if (!confirm) return;
    setActionLoading(true);
    try {
      if (confirm.action === 'delete') {
        await apiFetch(`/api/menu/${confirm.dish.id}`, { method: 'DELETE' });
        setDishes(prev => prev.filter(d => d.id !== confirm.dish.id));
        addToast(t('admin.deleted'), 'success');
      } else {
        const updated = await apiFetch<Dish>(`/api/menu/${confirm.dish.id}`, {
          method: 'PATCH', body: { isAvailable: !confirm.dish.isAvailable },
        });
        setDishes(prev => prev.map(d => d.id === updated.id ? updated : d));
        addToast(t('admin.saved'), 'success');
      }
    } catch {
      addToast(confirm.action === 'delete' ? t('admin.errorDeleting') : t('admin.errorSaving'), 'error');
    } finally {
      setActionLoading(false);
      setConfirm(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-3 flex-wrap">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder={t('common.search')}
          className="glass-input px-3 py-2 text-sm flex-1 min-w-48 rounded-xl"
        />
        <button onClick={() => setEditing('new')} className="btn-amber text-sm px-5 py-2">
          + {t('admin.createDish')}
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(6)].map((_, i) => <Shimmer key={i} className="h-16" />)}</div>
      ) : byCategory.length === 0 ? (
        <p className="text-sm text-brand-espresso/50 text-center py-12">{t('common.noData')}</p>
      ) : (
        byCategory.map(({ cat, items }) => (
          <div key={cat} className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-brand-espresso/40 px-1">
              {t(`menu.categories.${cat}`)}
            </h3>
            {items.map(dish => (
              <div key={dish.id} className={`glass-card rounded-xl flex items-center gap-3 p-3 ${!dish.isAvailable ? 'opacity-50' : ''}`}>
                {dish.image
                  ? <img src={dish.image} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                  : <div className="w-12 h-12 rounded-lg bg-brand-espresso/8 shrink-0 flex items-center justify-center text-lg">
                      {cat === 'hot_drinks' || cat === 'cold_drinks' ? '☕' : cat === 'desserts' ? '🍰' : '🍽'}
                    </div>
                }
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-brand-espresso truncate">{dish.name}</p>
                  {dish.nameEn && <p className="text-xs text-brand-espresso/45 truncate">{dish.nameEn}</p>}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${CATEGORY_COLOR[dish.category]}`}>
                  {t(`menu.categories.${dish.category}`)}
                </span>
                <span className="text-sm font-semibold text-brand-espresso shrink-0 tabular-nums">
                  ₽{parseFloat(dish.price).toLocaleString('ru')}
                </span>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => setEditing(dish)} className="text-xs px-3 py-1.5 rounded-lg bg-brand-espresso/8 text-brand-espresso/70 hover:bg-brand-espresso/14 font-medium transition-colors">
                    {t('common.edit')}
                  </button>
                  <button
                    onClick={() => setConfirm({ dish, action: 'toggle' })}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${dish.isAvailable ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'}`}
                  >
                    {dish.isAvailable ? t('admin.disable') : t('admin.enable')}
                  </button>
                  <button onClick={() => setConfirm({ dish, action: 'delete' })} className="text-xs px-3 py-1.5 rounded-lg font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-all">
                    {t('common.delete')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ))
      )}

      {editingDish !== null && (
        <DishModal dish={editingDish === 'new' ? null : editingDish} onClose={() => setEditing(null)} onSave={handleSave} addToast={addToast} />
      )}
      {confirm && (
        <ConfirmModal
          title={t('admin.confirmTitle')}
          body={confirm.action === 'delete' ? t('admin.confirmDeleteDish') : confirm.dish.isAvailable ? t('admin.confirmDisableDish') : t('admin.confirmEnableDish')}
          confirmLabel={confirm.action === 'delete' ? t('common.delete') : confirm.dish.isAvailable ? t('admin.disable') : t('admin.enable')}
          danger={confirm.action === 'delete'}
          onConfirm={executeAction} onCancel={() => setConfirm(null)} loading={actionLoading}
        />
      )}
    </div>
  );
}

function TableStatusModal({ table, onClose, onSave, addToast }: {
  table: TableFull; onClose: () => void;
  onSave: (t: TableFull) => void;
  addToast: (msg: string, type: 'success' | 'error') => void;
}) {
  const { t } = useLocale();
  const [status, setStatus] = useState<TableStatus>(table.status);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await apiFetch<TableFull>(`/api/tables/${table.id}/status`, {
        method: 'PATCH', body: { status },
      });
      addToast(t('admin.saved'), 'success');
      onSave(updated);
    } catch {
      addToast(t('admin.errorSaving'), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Overlay onClose={onClose}>
      <div className="glass-modal rounded-2xl max-w-xs w-full p-6 space-y-4">
        <h3 className="text-base font-semibold text-brand-espresso">
          {t('admin.changeStatus')} — {t('admin.tableNumber')}{table.number}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className={labelCls}>{t('admin.tableStatus')}</label>
            <select value={status} onChange={e => setStatus(e.target.value as TableStatus)} className={inputCls}>
              {(['FREE', 'RESERVED', 'OCCUPIED', 'CLEANING'] as TableStatus[]).map(s => (
                <option key={s} value={s}>{t(`tables.legend.${s.toLowerCase() as 'free' | 'reserved' | 'occupied' | 'cleaning'}`)}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={onClose} className={cancelBtnCls}>{t('common.cancel')}</button>
            <button type="submit" disabled={saving || status === table.status} className="btn-amber text-sm px-5 py-2 disabled:opacity-60">
              {saving ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </Overlay>
  );
}

function TableCreateModal({ restaurantId, onClose, onCreated, addToast }: {
  restaurantId: string; onClose: () => void;
  onCreated: (t: TableFull) => void;
  addToast: (msg: string, type: 'success' | 'error') => void;
}) {
  const { t } = useLocale();
  const [form, setForm] = useState({ number: '', capacity: '2', x: '50', y: '50' });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const created = await apiFetch<TableFull>('/api/tables', {
        method: 'POST',
        body: {
          restaurantId,
          number:   parseInt(form.number),
          capacity: parseInt(form.capacity),
          x:        parseFloat(form.x),
          y:        parseFloat(form.y),
        },
      });
      addToast(t('admin.saved'), 'success');
      onCreated(created);
    } catch {
      addToast(t('admin.errorSaving'), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Overlay onClose={onClose}>
      <div className="glass-modal rounded-2xl max-w-sm w-full p-6 space-y-4">
        <h3 className="text-base font-semibold text-brand-espresso">{t('admin.createTable')}</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{t('admin.tableNumberField')} *</label>
              <input required type="number" min="1" value={form.number} onChange={e => setForm(p => ({ ...p, number: e.target.value }))} className={inputCls} placeholder="10" />
            </div>
            <div>
              <label className={labelCls}>{t('admin.tableCapacity')} *</label>
              <input required type="number" min="1" max="20" value={form.capacity} onChange={e => setForm(p => ({ ...p, capacity: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>X (%)</label>
              <input type="number" step="0.1" min="0" max="100" value={form.x} onChange={e => setForm(p => ({ ...p, x: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Y (%)</label>
              <input type="number" step="0.1" min="0" max="100" value={form.y} onChange={e => setForm(p => ({ ...p, y: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={onClose} className={cancelBtnCls}>{t('common.cancel')}</button>
            <button type="submit" disabled={saving} className="btn-amber text-sm px-5 py-2 disabled:opacity-60">
              {saving ? t('common.loading') : t('common.add')}
            </button>
          </div>
        </form>
      </div>
    </Overlay>
  );
}

function TableEditModal({ table, onClose, onSave, addToast }: {
  table: TableFull; onClose: () => void;
  onSave: (t: TableFull) => void;
  addToast: (msg: string, type: 'success' | 'error') => void;
}) {
  const { t } = useLocale();
  const [form, setForm] = useState({
    number:   String(table.number),
    capacity: String(table.capacity),
    x:        String(table.x),
    y:        String(table.y),
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await apiFetch<TableFull>(`/api/tables/${table.id}`, {
        method: 'PATCH',
        body: {
          number:   parseInt(form.number),
          capacity: parseInt(form.capacity),
          x:        parseFloat(form.x),
          y:        parseFloat(form.y),
        },
      });
      addToast(t('admin.saved'), 'success');
      onSave(updated);
    } catch {
      addToast(t('admin.errorSaving'), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Overlay onClose={onClose}>
      <div className="glass-modal rounded-2xl max-w-sm w-full p-6 space-y-4">
        <h3 className="text-base font-semibold text-brand-espresso">
          {t('admin.editTable')} — {t('admin.tableNumber')}{table.number}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{t('admin.tableNumberField')}</label>
              <input type="number" min="1" value={form.number} onChange={e => setForm(p => ({ ...p, number: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t('admin.tableCapacity')}</label>
              <input type="number" min="1" max="20" value={form.capacity} onChange={e => setForm(p => ({ ...p, capacity: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>X (%)</label>
              <input type="number" step="0.1" value={form.x} onChange={e => setForm(p => ({ ...p, x: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Y (%)</label>
              <input type="number" step="0.1" value={form.y} onChange={e => setForm(p => ({ ...p, y: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={onClose} className={cancelBtnCls}>{t('common.cancel')}</button>
            <button type="submit" disabled={saving} className="btn-amber text-sm px-5 py-2 disabled:opacity-60">
              {saving ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </Overlay>
  );
}

function AssignWaiterModal({ table, waiters, onClose, onAssign, addToast }: {
  table: TableFull; waiters: User[];
  onClose: () => void; onAssign: (table: TableFull) => void;
  addToast: (msg: string, type: 'success' | 'error') => void;
}) {
  const { t } = useLocale();
  const [selected, setSelected]           = useState(table.assignedWaiterId ?? '');
  const [saving, setSaving]               = useState(false);
  const [confirmUnassign, setConfirmUnassign] = useState(false);

  async function assign() {
    setSaving(true);
    try {
      const updated = await apiFetch<TableFull>(`/api/tables/${table.id}/assign`, {
        method: 'PATCH', body: { waiterId: selected || undefined },
      });
      addToast(t('admin.assigned'), 'success');
      onAssign(updated);
    } catch {
      addToast(t('admin.errorSaving'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function unassign() {
    setSaving(true);
    try {
      const updated = await apiFetch<TableFull>(`/api/tables/${table.id}/assign`, {
        method: 'PATCH', body: { waiterId: null },
      });
      addToast(t('admin.unassigned'), 'success');
      onAssign(updated);
    } catch {
      addToast(t('admin.errorSaving'), 'error');
    } finally {
      setSaving(false);
      setConfirmUnassign(false);
    }
  }

  if (confirmUnassign) {
    return (
      <ConfirmModal
        title={t('admin.confirmTitle')} body={t('admin.confirmUnassign')}
        confirmLabel={t('admin.unassign')} danger
        onConfirm={unassign} onCancel={() => setConfirmUnassign(false)} loading={saving}
      />
    );
  }

  return (
    <Overlay onClose={onClose}>
      <div className="glass-modal rounded-2xl max-w-sm w-full p-6 space-y-4">
        <h3 className="text-base font-semibold text-brand-espresso">
          {t('admin.assignTable')} — {t('admin.tableNumber')}{table.number}
        </h3>
        <div>
          <label className={labelCls}>{t('admin.assignedWaiter')}</label>
          <select value={selected} onChange={e => setSelected(e.target.value)} className={inputCls}>
            <option value="">{t('admin.noWaiter')}</option>
            {waiters.map(w => <option key={w.id} value={w.id}>{w.email}</option>)}
          </select>
        </div>
        <div className="flex gap-3 justify-between pt-1">
          {table.assignedWaiterId && (
            <button onClick={() => setConfirmUnassign(true)} className="text-sm px-3 py-2 rounded-xl font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-all">
              {t('admin.unassign')}
            </button>
          )}
          <div className="flex gap-3 ml-auto">
            <button onClick={onClose} className={cancelBtnCls}>{t('common.cancel')}</button>
            <button onClick={assign} disabled={saving || selected === (table.assignedWaiterId ?? '')} className="btn-amber text-sm px-5 py-2 disabled:opacity-60">
              {saving ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </div>
      </div>
    </Overlay>
  );
}

function TablesTab({ waiters, restaurantId, addToast }: {
  waiters: User[]; restaurantId: string;
  addToast: (msg: string, type: 'success' | 'error') => void;
}) {
  const { t, locale } = useLocale();
  const [tables, setTables]         = useState<TableFull[]>([]);
  const [loading, setLoading]       = useState(true);
  const [editingTable, setEditing]  = useState<TableFull | null>(null);
  const [statusTable, setStatusTbl] = useState<TableFull | null>(null);
  const [assigningTable, setAssigning] = useState<TableFull | null>(null);
  const [creatingTable, setCreating]   = useState(false);

  useEffect(() => {
    apiFetch<TableFull[]>('/api/tables')
      .then(data => { setTables(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function handleUpdate(updated: TableFull) {
    setTables(prev => prev.map(tb => tb.id === updated.id ? updated : tb));
    setEditing(null); setStatusTbl(null); setAssigning(null);
  }

  function handleCreated(created: TableFull) {
    setTables(prev => [...prev, created]);
    setCreating(false);
  }

  const statusGroups = (['FREE', 'RESERVED', 'OCCUPIED', 'CLEANING'] as TableStatus[]).map(s => ({
    status: s,
    count:  tables.filter(tb => tb.status === s).length,
  }));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className={sectionTitle}>{t('admin.tablesSection')}</h2>
        <button onClick={() => setCreating(true)} className="btn-amber text-sm px-4 py-2">
          + {t('admin.createTable')}
        </button>
      </div>

      {/* Status legend bar */}
      {!loading && tables.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {statusGroups.map(({ status, count }) => {
            const cs = TABLE_CARD_STYLE[status];
            return (
              <div key={status} className={`rounded-xl p-3 flex flex-col items-center gap-1 ${cs.cardBg}`}>
                <span className="text-xl font-bold tabular-nums" style={{}}>{count}</span>
                <span className={`text-[11px] font-semibold ${cs.badgeText}`}>
                  {t(`tables.legend.${status.toLowerCase() as 'free' | 'reserved' | 'occupied' | 'cleaning'}`)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Shimmer key={i} className="h-44" />)}
        </div>
      ) : tables.length === 0 ? (
        <p className="text-sm text-brand-espresso/50 text-center py-12">{t('common.noData')}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {tables.map(table => {
            const cs = TABLE_CARD_STYLE[table.status];
            const statusKey = table.status.toLowerCase() as 'free' | 'reserved' | 'occupied' | 'cleaning';
            return (
              <div key={table.id} className={`rounded-2xl overflow-hidden ${cs.cardBg} shadow-sm`}>

                {/* Colored top stripe */}
                <div className={`h-1.5 w-full ${cs.topBorder}`} />

                <div className="p-4 space-y-3">
                  {/* Number + status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-base font-bold shrink-0 ${cs.iconBg}`}>
                        {cs.icon}
                      </div>
                      <div>
                        <p className={`text-xl font-bold leading-tight ${cs.numColor}`}>
                          {t('admin.tableNumber')}{table.number}
                        </p>
                        <p className="text-xs text-brand-espresso/45">
                          {table.capacity} {t('reservation.seats')}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => setStatusTbl(table)}
                      title={t('admin.changeStatus')}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full cursor-pointer hover:opacity-75 transition-opacity ${cs.badgeBg} ${cs.badgeText}`}
                    >
                      {t(`tables.legend.${statusKey}`)}
                    </button>
                  </div>

                  {/* Waiter row */}
                  <div className="flex items-center gap-2 rounded-lg bg-white/50 px-2.5 py-2">
                    <span className="text-base">👤</span>
                    <span className="text-xs text-brand-espresso/65 truncate">
                      {table.assignedWaiter?.email ?? (
                        <span className="italic text-brand-espresso/35">{t('admin.noWaiter')}</span>
                      )}
                    </span>
                  </div>

                  {/* Action buttons */}
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      onClick={() => setEditing(table)}
                      className="text-xs py-2 rounded-lg bg-white/60 text-brand-espresso/65 hover:bg-white/90 font-medium transition-colors border border-white/50"
                    >
                      {t('common.edit')}
                    </button>
                    <button
                      onClick={() => setStatusTbl(table)}
                      className={`text-xs py-2 rounded-lg font-medium transition-colors border border-white/50 ${cs.badgeBg} ${cs.badgeText} hover:opacity-80`}
                    >
                      Статус
                    </button>
                    <button
                      onClick={() => setAssigning(table)}
                      className="text-xs py-2 rounded-lg bg-white/60 text-brand-espresso/65 hover:bg-white/90 font-medium transition-colors border border-white/50"
                    >
                      {locale === 'en' ? 'Waiter' : 'Официант'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editingTable  && <TableEditModal  table={editingTable}  onClose={() => setEditing(null)}   onSave={handleUpdate} addToast={addToast} />}
      {statusTable   && <TableStatusModal table={statusTable}  onClose={() => setStatusTbl(null)} onSave={handleUpdate} addToast={addToast} />}
      {assigningTable && <AssignWaiterModal table={assigningTable} waiters={waiters} onClose={() => setAssigning(null)} onAssign={handleUpdate} addToast={addToast} />}
      {creatingTable && <TableCreateModal restaurantId={restaurantId} onClose={() => setCreating(false)} onCreated={handleCreated} addToast={addToast} />}
    </div>
  );
}

const ORD_NEXT: Partial<Record<OrdStatus, OrdStatus>> = {
  CREATED:   'CONFIRMED',
  CONFIRMED: 'PREPARING',
  PREPARING: 'READY',
  READY:     'COMPLETED',
};

const ORD_NEXT_LABEL: Partial<Record<OrdStatus, string>> = {
  CREATED:   'admin.confirmOrder',
  CONFIRMED: 'admin.startCooking',
  PREPARING: 'admin.markReady',
  READY:     'admin.completeOrder',
};

function OrdersAdminTab({ addToast, waiters }: {
  addToast: (msg: string, type: 'success' | 'error') => void;
  waiters: User[];
}) {
  const { t } = useLocale();
  const [orders, setOrders]   = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<OrdStatus | 'ALL'>('ALL');
  const [acting, setActing]   = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ items: Order[]; total: number }>('/api/orders?limit=200')
      .then(res => { setOrders(res.items); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const STATUS_FILTERS: { key: OrdStatus | 'ALL'; label: string }[] = [
    { key: 'ALL',       label: t('admin.filterAll')           },
    { key: 'CREATED',   label: t('orders.status.CREATED')     },
    { key: 'CONFIRMED', label: t('orders.status.CONFIRMED')   },
    { key: 'PREPARING', label: t('orders.status.PREPARING')   },
    { key: 'READY',     label: t('orders.status.READY')       },
    { key: 'COMPLETED', label: t('orders.status.COMPLETED')   },
    { key: 'CANCELLED', label: t('orders.status.CANCELLED')   },
  ];

  const visible = filter === 'ALL' ? orders : orders.filter(o => o.status === filter);

  async function advance(order: Order) {
    const next = ORD_NEXT[order.status];
    if (!next) return;
    setActing(order.id);
    try {
      const updated = await apiFetch<Order>(`/api/orders/${order.id}/status`, {
        method: 'PATCH', body: { status: next },
      });
      setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
      addToast(t('admin.saved'), 'success');
    } catch {
      addToast(t('admin.errorSaving'), 'error');
    } finally {
      setActing(null);
    }
  }

  async function cancelOrder(order: Order) {
    setActing(order.id + '_cancel');
    try {
      await apiFetch(`/api/orders/${order.id}/cancel`, { method: 'PATCH' });
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'CANCELLED' as OrdStatus } : o));
      addToast(t('admin.saved'), 'success');
    } catch {
      addToast(t('admin.errorSaving'), 'error');
    } finally {
      setActing(null);
    }
  }

  const active   = orders.filter(o => !['COMPLETED', 'CANCELLED'].includes(o.status)).length;
  const terminal = new Set<OrdStatus>(['COMPLETED', 'CANCELLED']);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className={sectionTitle}>{t('admin.allOrders')}</h2>
          <p className="text-xs text-brand-espresso/50 mt-0.5">{active} активных · {orders.length} всего</p>
        </div>
      </div>

      {/* Status filter */}
      <div className="overflow-x-auto scrollbar-none">
        <div className="flex gap-1 p-1 glass-card rounded-xl min-w-max">
          {STATUS_FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                filter === key ? 'bg-brand-espresso text-brand-cream' : 'text-brand-espresso/60 hover:text-brand-espresso'
              }`}
            >
              {label}
              {key !== 'ALL' && (
                <span className="ml-1 opacity-60">
                  ({orders.filter(o => o.status === key).length})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Shimmer key={i} className="h-24" />)}</div>
      ) : visible.length === 0 ? (
        <p className="text-sm text-brand-espresso/50 text-center py-12">{t('admin.noOrders')}</p>
      ) : (
        <div className="space-y-3">
          {visible.map(order => {
            const style   = ORD_STATUS_STYLE[order.status];
            const nextKey = ORD_NEXT_LABEL[order.status];
            const isActing = acting === order.id;
            const isCancelling = acting === order.id + '_cancel';
            const canAct = !terminal.has(order.status);

            return (
              <div key={order.id} className="glass-card rounded-2xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-brand-espresso/70">
                        #{order.id.slice(0, 8).toUpperCase()}
                      </span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>
                        {t(`orders.status.${order.status}`)}
                      </span>
                      {order.table && (
                        <span className="text-xs bg-brand-espresso/8 text-brand-espresso/65 px-2 py-0.5 rounded-full">
                          {t('admin.orderTable')} №{order.table.number}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-brand-espresso/45">
                      {formatDateTime(order.createdAt, 'ru')}
                      {' · '}
                      {t(`orders.type.${order.type}`)}
                    </p>
                  </div>
                  <span className="text-sm font-bold tabular-nums text-brand-espresso shrink-0">
                    ₽{parseFloat(order.totalAmount).toLocaleString('ru')}
                  </span>
                </div>

                {/* Items */}
                {order.items.length > 0 && (
                  <div className="bg-brand-espresso/4 rounded-xl px-3 py-2 space-y-1">
                    {order.items.slice(0, 4).map(item => (
                      <div key={item.id} className="flex items-center justify-between text-xs">
                        <span className="text-brand-espresso/65 truncate pr-2">
                          <span className="text-brand-espresso/40">{item.quantity}× </span>{item.dish.name}
                        </span>
                        <span className="text-brand-espresso/50 tabular-nums shrink-0">
                          ₽{(parseFloat(item.unitPrice) * item.quantity).toLocaleString('ru')}
                        </span>
                      </div>
                    ))}
                    {order.items.length > 4 && (
                      <p className="text-xs text-brand-espresso/35">…ещё {order.items.length - 4}</p>
                    )}
                  </div>
                )}

                {/* Actions */}
                {canAct && (
                  <div className="flex gap-2 flex-wrap">
                    {nextKey && (
                      <button
                        onClick={() => advance(order)}
                        disabled={!!acting}
                        className="btn-amber text-xs px-4 py-1.5 disabled:opacity-60"
                      >
                        {isActing ? t('common.loading') : t(nextKey)}
                      </button>
                    )}
                    <button
                      onClick={() => cancelOrder(order)}
                      disabled={!!acting}
                      className="text-xs px-4 py-1.5 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 font-medium transition-colors disabled:opacity-60"
                    >
                      {isCancelling ? t('common.loading') : t('admin.cancelOrder')}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CreateAccountModal({ onClose, onCreated, addToast }: {
  onClose: () => void;
  onCreated: (user: User) => void;
  addToast: (msg: string, type: 'success' | 'error') => void;
}) {
  const { t } = useLocale();
  const [form, setForm]         = useState({ email: '', password: '', role: 'USER' as UserRole });
  const [saving, setSaving]     = useState(false);
  const [fieldError, setFieldError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldError('');
    setSaving(true);
    try {
      const created = await apiFetch<User>('/api/users', { method: 'POST', body: form });
      addToast(t('admin.saved'), 'success');
      onCreated(created);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setFieldError(t('auth.registerError'));
      else if (err instanceof ApiError && err.status === 400) setFieldError(err.message);
      else addToast(t('admin.errorSaving'), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Overlay onClose={onClose}>
      <div className="glass-modal rounded-2xl max-w-sm w-full p-6 space-y-4">
        <h3 className="text-base font-semibold text-brand-espresso">{t('admin.createWorker')}</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className={labelCls}>{t('auth.email')} *</label>
            <input required type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className={inputCls} placeholder="staff@cafe.ru" />
          </div>
          <div>
            <label className={labelCls}>{t('auth.password')} *</label>
            <input required type="password" minLength={8} value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} className={inputCls} />
            <p className="text-xs text-brand-espresso/50 mt-1">Минимум 8 символов, заглавная и строчная буква, цифра</p>
          </div>
          <div>
            <label className={labelCls}>{t('admin.staffRole')}</label>
            <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value as UserRole }))} className={inputCls}>
              <option value="USER">{t('profile.roles.USER')}</option>
              <option value="WAITER">{t('profile.roles.WAITER')}</option>
            </select>
          </div>
          {fieldError && <p className="text-xs text-red-500">{fieldError}</p>}
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={onClose} className={cancelBtnCls}>{t('common.cancel')}</button>
            <button type="submit" disabled={saving} className="btn-amber text-sm px-5 py-2 disabled:opacity-60">
              {saving ? t('common.loading') : t('common.add')}
            </button>
          </div>
        </form>
      </div>
    </Overlay>
  );
}

function AccountsTab({ users, setUsers, addToast }: {
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  addToast: (msg: string, type: 'success' | 'error') => void;
}) {
  const { t, locale } = useLocale();
  const [search, setSearch]         = useState('');
  const [roleFilter, setFilter]     = useState<UserRole | 'ALL'>('ALL');
  const [creating, setCreating]     = useState(false);
  const [confirmUser, setConfirmUser] = useState<User | null>(null);
  const [roleUser, setRoleUser]     = useState<User | null>(null);
  const [newRole, setNewRole]       = useState<UserRole>('USER');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [roleLoading, setRoleLoading]     = useState(false);

  const filtered = users.filter(u => {
    const matchSearch = u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole   = roleFilter === 'ALL' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  async function handleDelete() {
    if (!confirmUser) return;
    setDeleteLoading(true);
    try {
      await apiFetch(`/api/users/${confirmUser.id}`, { method: 'DELETE' });
      setUsers(prev => prev.filter(u => u.id !== confirmUser.id));
      addToast(t('admin.deleted'), 'success');
    } catch {
      addToast(t('admin.errorDeleting'), 'error');
    } finally {
      setDeleteLoading(false);
      setConfirmUser(null);
    }
  }

  async function handleRoleChange() {
    if (!roleUser) return;
    setRoleLoading(true);
    try {
      await apiFetch(`/api/users/${roleUser.id}/role`, { method: 'PATCH', body: { role: newRole } });
      setUsers(prev => prev.map(u => u.id === roleUser.id ? { ...u, role: newRole } : u));
      addToast(t('admin.saved'), 'success');
    } catch {
      addToast(t('admin.errorSaving'), 'error');
    } finally {
      setRoleLoading(false);
      setRoleUser(null);
    }
  }

  const ROLE_FILTERS: { key: UserRole | 'ALL'; label: string }[] = [
    { key: 'ALL',    label: t('admin.filterAll')      },
    { key: 'ADMIN',  label: t('profile.roles.ADMIN')  },
    { key: 'WAITER', label: t('profile.roles.WAITER') },
    { key: 'USER',   label: t('profile.roles.USER')   },
    { key: 'GUEST',  label: t('profile.roles.GUEST')  },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap items-center">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder={t('admin.searchByEmail')}
          className="glass-input px-3 py-2 text-sm flex-1 min-w-48 rounded-xl"
        />
        <div className="overflow-x-auto scrollbar-none">
          <div className="flex gap-1 p-1 glass-card rounded-xl min-w-max">
            {ROLE_FILTERS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                  roleFilter === key ? 'bg-brand-espresso text-brand-cream' : 'text-brand-espresso/60 hover:text-brand-espresso'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <button onClick={() => setCreating(true)} className="btn-amber text-sm px-5 py-2">
          + {t('admin.createWorker')}
        </button>
      </div>

      <p className="text-xs text-brand-espresso/45">{filtered.length} аккаунтов</p>

      {filtered.length === 0 ? (
        <p className="text-sm text-brand-espresso/50 text-center py-12">{t('common.noData')}</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(user => (
            <div key={user.id} className="glass-card rounded-xl flex items-center gap-3 p-3">
              <div className="w-9 h-9 rounded-full bg-brand-espresso/10 flex items-center justify-center shrink-0">
                <span className="text-sm font-semibold text-brand-espresso">{user.email[0].toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-brand-espresso truncate">{user.email}</p>
                <p className="text-xs text-brand-espresso/45">{t('profile.memberSince')} {formatDate(user.createdAt, locale)}</p>
              </div>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${ROLE_STYLE[user.role]}`}>
                {t(`profile.roles.${user.role}`)}
              </span>
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => { setRoleUser(user); setNewRole(user.role); }}
                  className="text-xs px-2.5 py-1.5 rounded-lg bg-brand-espresso/8 text-brand-espresso/70 hover:bg-brand-espresso/14 font-medium transition-colors"
                >
                  {t('admin.changeRole')}
                </button>
                <button
                  onClick={() => setConfirmUser(user)}
                  className="text-xs px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-medium transition-all"
                >
                  {t('common.delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Change role modal */}
      {roleUser && (
        <Overlay onClose={() => setRoleUser(null)}>
          <div className="glass-modal rounded-2xl max-w-xs w-full p-6 space-y-4">
            <h3 className="text-base font-semibold text-brand-espresso">{t('admin.changeRole')}</h3>
            <p className="text-xs text-brand-espresso/60 truncate">{roleUser.email}</p>
            <div>
              <label className={labelCls}>{t('admin.staffRole')}</label>
              <select value={newRole} onChange={e => setNewRole(e.target.value as UserRole)} className={inputCls}>
                <option value="USER">{t('profile.roles.USER')}</option>
                <option value="WAITER">{t('profile.roles.WAITER')}</option>
                <option value="ADMIN">{t('profile.roles.ADMIN')}</option>
                <option value="GUEST">{t('profile.roles.GUEST')}</option>
              </select>
            </div>
            <div className="flex gap-3 justify-end pt-1">
              <button onClick={() => setRoleUser(null)} className={cancelBtnCls}>{t('common.cancel')}</button>
              <button onClick={handleRoleChange} disabled={roleLoading || newRole === roleUser.role} className="btn-amber text-sm px-5 py-2 disabled:opacity-60">
                {roleLoading ? t('common.loading') : t('common.save')}
              </button>
            </div>
          </div>
        </Overlay>
      )}

      {creating && (
        <CreateAccountModal
          onClose={() => setCreating(false)}
          onCreated={user => { setUsers(prev => [...prev, user]); setCreating(false); }}
          addToast={addToast}
        />
      )}
      {confirmUser && (
        <ConfirmModal
          title={t('admin.confirmTitle')} body={t('admin.confirmDeleteUser')}
          confirmLabel={t('common.delete')} danger
          onConfirm={handleDelete} onCancel={() => setConfirmUser(null)} loading={deleteLoading}
        />
      )}
    </div>
  );
}

const RES_STATUS_STYLE: Record<ResStatus, { bg: string; text: string }> = {
  PENDING:   { bg: 'bg-gray-100',    text: 'text-gray-600'    },
  CONFIRMED: { bg: 'bg-blue-100',    text: 'text-blue-700'    },
  CANCELLED: { bg: 'bg-red-100',     text: 'text-red-600'     },
  COMPLETED: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
};

function ReservationsAdminTab({ restaurantId, addToast }: {
  restaurantId: string;
  addToast: (msg: string, type: 'success' | 'error') => void;
}) {
  const { t } = useLocale();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading]           = useState(true);
  const [filter, setFilter]             = useState<ResStatus | 'ALL'>('ALL');
  const [acting, setActing]             = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ items: Reservation[]; total: number }>(
      `/api/reservations/restaurant/${restaurantId}?limit=50`,
    )
      .then(res => { setReservations(res.items); setLoading(false); })
      .catch(() => setLoading(false));
  }, [restaurantId]);

  const STATUS_FILTERS: { key: ResStatus | 'ALL'; label: string }[] = [
    { key: 'ALL',       label: t('admin.filterAll')             },
    { key: 'PENDING',   label: t('reservation.status.PENDING')  },
    { key: 'CONFIRMED', label: t('reservation.status.CONFIRMED')},
    { key: 'COMPLETED', label: t('reservation.status.COMPLETED')},
    { key: 'CANCELLED', label: t('reservation.status.CANCELLED')},
  ];

  const visible = filter === 'ALL' ? reservations : reservations.filter(r => r.status === filter);

  async function doAction(res: Reservation, action: 'confirm' | 'complete' | 'cancel') {
    setActing(res.id + action);
    try {
      const updated = await apiFetch<Reservation>(
        `/api/reservations/${res.id}/${action}`,
        { method: 'PATCH' },
      );
      setReservations(prev => prev.map(r => r.id === updated.id ? updated : r));
      addToast(t('admin.saved'), 'success');
    } catch {
      addToast(t('admin.errorSaving'), 'error');
    } finally {
      setActing(null);
    }
  }

  const terminal = new Set<ResStatus>(['CANCELLED', 'COMPLETED']);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className={sectionTitle}>{t('admin.allReservations')}</h2>
          <p className="text-xs text-brand-espresso/50 mt-0.5">
            {reservations.filter(r => !terminal.has(r.status)).length} активных · {reservations.length} всего
          </p>
        </div>
      </div>

      <div className="overflow-x-auto scrollbar-none">
        <div className="flex gap-1 p-1 glass-card rounded-xl min-w-max">
          {STATUS_FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                filter === key ? 'bg-brand-espresso text-brand-cream' : 'text-brand-espresso/60 hover:text-brand-espresso'
              }`}
            >
              {label}
              {key !== 'ALL' && (
                <span className="ml-1 opacity-60">
                  ({reservations.filter(r => r.status === key).length})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Shimmer key={i} className="h-20" />)}</div>
      ) : visible.length === 0 ? (
        <p className="text-sm text-brand-espresso/50 text-center py-12">{t('admin.noReservations')}</p>
      ) : (
        <div className="space-y-3">
          {visible.map(res => {
            const style = RES_STATUS_STYLE[res.status];
            const canAct = !terminal.has(res.status);
            const start = new Date(res.startTime);
            const end   = new Date(res.endTime);
            const fmt = (d: Date) =>
              d.toLocaleString('ru', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

            return (
              <div key={res.id} className="glass-card rounded-2xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-brand-espresso/70">
                        #{res.id.slice(0, 8).toUpperCase()}
                      </span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>
                        {t(`reservation.status.${res.status}`)}
                      </span>
                      <span className="text-xs bg-brand-espresso/8 text-brand-espresso/65 px-2 py-0.5 rounded-full">
                        {t('admin.tableNumber')}{res.table.number}
                      </span>
                    </div>
                    <p className="text-xs text-brand-espresso/45">
                      {res.user.email} · {res.numberOfGuests} {t('admin.reservationGuests')}
                    </p>
                    <p className="text-xs text-brand-espresso/45">
                      {fmt(start)} — {fmt(end)}
                    </p>
                  </div>
                </div>

                {canAct && (
                  <div className="flex gap-2 flex-wrap">
                    {res.status === 'PENDING' && (
                      <button
                        onClick={() => doAction(res, 'confirm')}
                        disabled={!!acting}
                        className="btn-amber text-xs px-4 py-1.5 disabled:opacity-60"
                      >
                        {acting === res.id + 'confirm' ? t('common.loading') : t('admin.confirmReservation')}
                      </button>
                    )}
                    {res.status === 'CONFIRMED' && (
                      <button
                        onClick={() => doAction(res, 'complete')}
                        disabled={!!acting}
                        className="btn-amber text-xs px-4 py-1.5 disabled:opacity-60"
                      >
                        {acting === res.id + 'complete' ? t('common.loading') : t('admin.completeReservation')}
                      </button>
                    )}
                    <button
                      onClick={() => doAction(res, 'cancel')}
                      disabled={!!acting}
                      className="text-xs px-4 py-1.5 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 font-medium transition-colors disabled:opacity-60"
                    >
                      {acting === res.id + 'cancel' ? t('common.loading') : t('admin.cancelReservation')}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PersonnelTab({ waiters, addToast }: {
  waiters: User[];
  addToast: (msg: string, type: 'success' | 'error') => void;
}) {
  const { t } = useLocale();
  const [tables, setTables]   = useState<TableFull[]>([]);
  const [orders, setOrders]   = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    Promise.allSettled([
      apiFetch<TableFull[]>('/api/tables'),
      apiFetch<{ items: Order[] }>('/api/orders?limit=500'),
    ]).then(([tbls, ords]) => {
      if (tbls.status === 'fulfilled') setTables(tbls.value);
      if (ords.status === 'fulfilled')
        setOrders(ords.value.items.filter(o => new Date(o.createdAt) >= todayStart));
      setLoading(false);
    });
  }, []);

  function getWaiterTables(waiterId: string) {
    return tables.filter(tb => tb.assignedWaiterId === waiterId);
  }

  function getCompletedToday(waiterId: string) {
    const waiterTableIds = new Set(getWaiterTables(waiterId).map(tb => tb.id));
    return orders.filter(o => o.status === 'COMPLETED' && o.tableId && waiterTableIds.has(o.tableId)).length;
  }

  function getActiveOrders(waiterId: string) {
    const waiterTableIds = new Set(getWaiterTables(waiterId).map(tb => tb.id));
    return orders.filter(o => !['COMPLETED', 'CANCELLED'].includes(o.status) && o.tableId && waiterTableIds.has(o.tableId)).length;
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => <Shimmer key={i} className="h-40" />)}
      </div>
    );
  }

  if (waiters.length === 0) {
    return <p className="text-sm text-brand-espresso/50 text-center py-12">{t('common.noData')}</p>;
  }

  return (
    <div className="space-y-4">
      <h2 className={sectionTitle}>{t('admin.personnelSection')}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {waiters.map(waiter => {
          const waiterTables    = getWaiterTables(waiter.id);
          const completedToday  = getCompletedToday(waiter.id);
          const activeOrdersNum = getActiveOrders(waiter.id);

          return (
            <div key={waiter.id} className="glass-card rounded-2xl p-5 space-y-4">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-amber-700">{waiter.email[0].toUpperCase()}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-brand-espresso truncate">{waiter.email}</p>
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                    {t('profile.roles.WAITER')}
                  </span>
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-brand-espresso/4 rounded-xl p-2.5 text-center">
                  <p className="text-lg font-bold text-brand-espresso">{waiterTables.length}</p>
                  <p className="text-[10px] text-brand-espresso/50 leading-tight">столов</p>
                </div>
                <div className="bg-emerald-50 rounded-xl p-2.5 text-center">
                  <p className="text-lg font-bold text-emerald-700">{completedToday}</p>
                  <p className="text-[10px] text-emerald-600/70 leading-tight">{t('admin.completedToday')}</p>
                </div>
                <div className="bg-orange-50 rounded-xl p-2.5 text-center">
                  <p className="text-lg font-bold text-orange-700">{activeOrdersNum}</p>
                  <p className="text-[10px] text-orange-600/70 leading-tight">активных</p>
                </div>
              </div>

              {/* Tables list */}
              <div>
                <p className="text-xs font-semibold text-brand-espresso/45 uppercase tracking-wider mb-1.5">
                  {t('admin.assignedTables')}
                </p>
                {waiterTables.length === 0 ? (
                  <p className="text-xs text-brand-espresso/35 italic">{t('admin.noAssignedTables')}</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {waiterTables.map(tb => {
                      const style = STATUS_STYLE[tb.status];
                      return (
                        <span key={tb.id} className={`text-xs px-2 py-0.5 rounded-full font-medium ${style.bg} ${style.text}`}>
                          №{tb.number}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
