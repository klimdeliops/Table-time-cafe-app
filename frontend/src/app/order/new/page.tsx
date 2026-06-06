'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth }   from '@/hooks/useAuth';
import { useLocale } from '@/hooks/useLocale';
import { useCart }   from '@/contexts/CartContext';
import { apiFetch, ApiError } from '@/shared/api/client';
import { formatRubles } from '@/lib/formatters';
import type { Locale } from '@/lib/i18n';

// ── Wizard types ──────────────────────────────────────────────────────────────

type WizardStep     = 'cart' | 'type' | 'details' | 'payment' | 'review';
type OrderType      = 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
type PaymentMethod  = 'CASH' | 'CARD';
type Timing         = 'asap' | 'scheduled';

interface WizardData {
  orderType:       OrderType | null;
  deliveryAddress: string;
  timing:          Timing;
  scheduledAt:     string; // datetime-local value
  tableId:         string | null;
  tableNumber:     number | null;
  tableCapacity:   number | null;
  paymentMethod:   PaymentMethod | null;
}

const ALL_STEPS: WizardStep[] = ['cart', 'type', 'details', 'payment', 'review'];

// ── Floor plan types ──────────────────────────────────────────────────────────

type TableStatus = 'FREE' | 'RESERVED' | 'OCCUPIED' | 'CLEANING';

interface FloorTable {
  id: string;
  number: number;
  capacity: number;
  x: number;
  y: number;
  status: TableStatus;
}

const DOT_COLOR: Record<TableStatus, string> = {
  FREE:     'bg-green-500',
  RESERVED: 'bg-yellow-400',
  OCCUPIED: 'bg-red-500',
  CLEANING: 'bg-gray-400',
};

const GLOW_RGBA: Record<TableStatus, string> = {
  FREE:     'rgba(34,197,94,0.9)',
  RESERVED: 'rgba(250,204,21,0.9)',
  OCCUPIED: 'rgba(239,68,68,0.9)',
  CLEANING: 'rgba(156,163,175,0.9)',
};

// ── Page (Suspense shell) ─────────────────────────────────────────────────────

export default function OrderNewPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center pt-14">
        <div className="w-6 h-6 rounded-full border-2 border-brand-espresso/20 border-t-brand-espresso animate-spin" />
      </main>
    }>
      <OrderWizard />
    </Suspense>
  );
}

// ── Wizard (uses useSearchParams — must be inside Suspense) ───────────────────

function OrderWizard() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { t, locale } = useLocale();
  const { user, loading: authLoading } = useAuth();
  const { items, clearCart, totalPrice } = useCart();

  // Query-param pre-fill from reservation flow
  const prefillTableId = searchParams.get('tableId');
  const prefillType    = searchParams.get('orderType') as OrderType | null;
  const isPrefilled    = !!(prefillTableId && prefillType);

  // When pre-filled skip 'type' and 'details' steps
  const STEPS: WizardStep[] = isPrefilled
    ? ['cart', 'payment', 'review']
    : ALL_STEPS;

  const [step, setStep]               = useState<WizardStep>('cart');
  const [submitting, setSubmitting]   = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [data, setData] = useState<WizardData>({
    orderType:       prefillType ?? null,
    deliveryAddress: '',
    timing:          'asap',
    scheduledAt:     '',
    tableId:         prefillTableId,
    tableNumber:     null,
    tableCapacity:   null,
    paymentMethod:   null,
  });

  // Floor plan state (loaded lazily when step === 'details' and type === 'DINE_IN')
  const [tables, setTables]             = useState<FloorTable[]>([]);
  const [floorLoading, setFloorLoading] = useState(false);

  // If pre-filled with tableId, load table details on mount
  useEffect(() => {
    if (prefillTableId) {
      apiFetch<FloorTable[]>('/api/tables')
        .then((all) => {
          const found = all.find((t) => t.id === prefillTableId);
          if (found) {
            setData((d) => ({ ...d, tableNumber: found.number, tableCapacity: found.capacity }));
            setTables(all);
          }
        })
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillTableId]);

  useEffect(() => {
    if (step === 'details' && data.orderType === 'DINE_IN' && tables.length === 0) {
      setFloorLoading(true);
      apiFetch<FloorTable[]>('/api/tables')
        .then(setTables)
        .catch(() => {})
        .finally(() => setFloorLoading(false));
    }
  }, [step, data.orderType, tables.length]);

  // Auth gate — redirect to login after auth resolves
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login?redirect=/order/new');
    }
  }, [authLoading, user, router]);

  if (authLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center pt-14">
        <div className="w-6 h-6 rounded-full border-2 border-brand-espresso/20 border-t-brand-espresso animate-spin" />
      </main>
    );
  }

  if (!user) return null; // redirecting

  // ── Step helpers ──────────────────────────────────────────────────────────

  const stepIdx = STEPS.indexOf(step);
  const isLast  = step === 'review';

  function canAdvance(): boolean {
    switch (step) {
      case 'cart':    return items.length > 0;
      case 'type':    return data.orderType !== null;
      case 'details':
        if (data.orderType === 'DELIVERY') return data.deliveryAddress.trim().length > 0;
        if (data.orderType === 'DINE_IN')  return data.tableId !== null;
        return true;
      case 'payment': return data.paymentMethod !== null;
      case 'review':  return true;
    }
  }

  function next() {
    if (stepIdx + 1 < STEPS.length) setStep(STEPS[stepIdx + 1]);
  }

  function back() {
    setSubmitError('');
    if (stepIdx > 0) setStep(STEPS[stepIdx - 1]);
    else router.push('/menu');
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError('');
    try {
      const body: Record<string, unknown> = {
        type:          data.orderType,
        paymentMethod: data.paymentMethod,
        items:         items.map(i => ({ dishId: i.dish.id, quantity: i.quantity })),
      };

      if (data.orderType === 'DELIVERY') {
        body.deliveryAddress = data.deliveryAddress;
      }
      if (data.orderType === 'DINE_IN' && data.tableId) {
        body.tableId = data.tableId;
      }
      if (data.timing === 'scheduled' && data.scheduledAt) {
        body.pickupTime = new Date(data.scheduledAt).toISOString();
      }

      await apiFetch('/api/orders', { method: 'POST', body });
      clearCart();
      router.push('/order/success');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401)      setSubmitError(t('order.errorUnauth'));
        else if (err.status === 409) setSubmitError(t('order.errorConflict'));
        else                         setSubmitError(err.message || t('order.errorGeneric'));
      } else {
        setSubmitError(t('order.errorGeneric'));
      }
    } finally {
      setSubmitting(false);
    }
  }

  // ── Step labels ───────────────────────────────────────────────────────────

  const STEP_LABELS: Record<WizardStep, string> = {
    cart:    t('order.stepCart'),
    type:    t('order.stepType'),
    details: t('order.stepDetails'),
    payment: t('order.stepPayment'),
    review:  t('order.stepReview'),
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen pt-14 pb-8">
      <div className="max-w-xl mx-auto px-4 py-6 space-y-6">

        {/* Step indicator */}
        <div className="flex items-center gap-0">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center flex-1 last:flex-none">
              <button
                onClick={() => i < stepIdx && setStep(s)}
                disabled={i >= stepIdx}
                className="flex flex-col items-center gap-1 group"
              >
                <span
                  className={[
                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200',
                    i < stepIdx  ? 'bg-green-500 text-white' :
                    i === stepIdx ? 'bg-brand-espresso text-brand-cream shadow-md scale-110' :
                    'bg-brand-espresso/10 text-brand-espresso/30',
                  ].join(' ')}
                >
                  {i < stepIdx ? '✓' : i + 1}
                </span>
                <span
                  className={[
                    'text-[10px] font-medium whitespace-nowrap hidden sm:block transition-colors',
                    i === stepIdx ? 'text-brand-espresso' : 'text-brand-espresso/35',
                  ].join(' ')}
                >
                  {STEP_LABELS[s]}
                </span>
              </button>
              {i < STEPS.length - 1 && (
                <div className="flex-1 h-px mx-1 transition-colors duration-300"
                  style={{ background: i < stepIdx ? '#22c55e' : 'rgba(75,46,43,0.12)' }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="glass-card rounded-3xl p-6 animate-fade-up">
          {step === 'cart'    && <StepCart    items={items} locale={locale} t={t} totalPrice={totalPrice} />}
          {step === 'type'    && <StepType    data={data} setData={setData} t={t} />}
          {step === 'details' && (
            <StepDetails
              data={data} setData={setData} t={t} locale={locale}
              tables={tables} floorLoading={floorLoading}
            />
          )}
          {step === 'payment' && <StepPayment data={data} setData={setData} t={t} />}
          {step === 'review'  && (
            <StepReview
              items={items} data={data} totalPrice={totalPrice} locale={locale} t={t}
            />
          )}
        </div>

        {/* Error */}
        {submitError && (
          <div className="glass-card rounded-2xl px-5 py-3 border border-red-200/60">
            <p className="text-sm text-red-600">{submitError}</p>
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-3">
          <button
            onClick={back}
            className="flex-1 py-3.5 rounded-2xl text-sm font-semibold text-brand-espresso/70 bg-brand-espresso/8 hover:bg-brand-espresso/14 transition-colors"
          >
            {t('common.back')}
          </button>

          {isLast ? (
            <button
              onClick={handleSubmit}
              disabled={submitting || !canAdvance()}
              className="flex-[2] btn-amber py-3.5 rounded-2xl text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? t('order.placing') : t('order.confirmOrder')}
            </button>
          ) : (
            <button
              onClick={next}
              disabled={!canAdvance()}
              className="flex-[2] btn-amber py-3.5 rounded-2xl text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('common.next')}
            </button>
          )}
        </div>

      </div>
    </main>
  );
}

// ── Step 1: Cart ──────────────────────────────────────────────────────────────

import type { CartItem } from '@/contexts/CartContext';

function StepCart({
  items, locale, t, totalPrice,
}: {
  items: CartItem[];
  locale: Locale;
  t: (k: string) => string;
  totalPrice: number;
}) {
  if (items.length === 0) {
    return (
      <div className="text-center py-8 space-y-4">
        <p className="text-5xl opacity-25">🛒</p>
        <p className="font-semibold text-brand-espresso">{t('order.emptyCart')}</p>
        <p className="text-sm text-brand-espresso/50">{t('order.emptyCartHint')}</p>
        <Link
          href="/menu"
          className="inline-block btn-amber rounded-xl px-6 py-2.5 text-sm font-semibold"
        >
          {t('order.goToMenu')}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-brand-espresso">{t('order.stepCart')}</h2>
      <ul className="space-y-3 divide-y divide-brand-espresso/8">
        {items.map(item => {
          const name = (locale === 'en' && item.dish.nameEn) ? item.dish.nameEn : item.dish.name;
          const lineTotal = parseFloat(item.dish.price) * item.quantity;
          return (
            <li key={item.dish.id} className="flex items-center gap-3 pt-3 first:pt-0">
              {/* Image / icon */}
              <div className="relative w-10 h-10 rounded-xl bg-brand-espresso/6 flex-shrink-0 overflow-hidden flex items-center justify-center text-lg">
                {item.dish.image
                  ? <Image src={item.dish.image} alt={name} fill className="object-cover" sizes="40px" />
                  : <span>{item.dish.category === 'hot_drinks' || item.dish.category === 'cold_drinks' ? '☕' : '🍽'}</span>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-brand-espresso truncate">{name}</p>
                <p className="text-xs text-brand-espresso/45">
                  {item.quantity} × {formatRubles(item.dish.price)}
                </p>
              </div>
              <span className="text-sm font-semibold tabular-nums text-brand-espresso flex-shrink-0">
                {formatRubles(lineTotal)}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="border-t border-brand-espresso/10 pt-3 flex justify-between font-semibold text-brand-espresso">
        <span>{t('order.subtotal')}</span>
        <span className="tabular-nums">{formatRubles(totalPrice)}</span>
      </div>
    </div>
  );
}

// ── Step 2: Order Type ────────────────────────────────────────────────────────

function StepType({
  data, setData, t,
}: {
  data: WizardData;
  setData: React.Dispatch<React.SetStateAction<WizardData>>;
  t: (k: string) => string;
}) {
  const types: { type: OrderType; icon: string; label: string; desc: string }[] = [
    { type: 'DINE_IN',  icon: '🪑', label: t('order.dineIn'),   desc: t('order.dineInDesc') },
    { type: 'TAKEAWAY', icon: '🥡', label: t('order.takeaway'), desc: t('order.takeawayDesc') },
    { type: 'DELIVERY', icon: '🛵', label: t('order.delivery'), desc: t('order.deliveryDesc') },
  ];

  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-brand-espresso">{t('order.typeTitle')}</h2>
      <div className="space-y-3">
        {types.map(({ type, icon, label, desc }) => {
          const selected = data.orderType === type;
          return (
            <button
              key={type}
              onClick={() => setData(d => ({ ...d, orderType: type }))}
              className={[
                'w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all duration-200',
                selected
                  ? 'border-brand-espresso bg-brand-espresso/6 shadow-sm'
                  : 'border-brand-espresso/12 bg-brand-espresso/3 hover:border-brand-espresso/30 hover:bg-brand-espresso/5',
              ].join(' ')}
            >
              <span className="text-2xl flex-shrink-0">{icon}</span>
              <div className="flex-1">
                <p className={`font-semibold text-sm ${selected ? 'text-brand-espresso' : 'text-brand-espresso/80'}`}>
                  {label}
                </p>
                <p className="text-xs text-brand-espresso/50 mt-0.5">{desc}</p>
              </div>
              <span
                className={[
                  'w-5 h-5 rounded-full border-2 flex-shrink-0 transition-all duration-200',
                  selected
                    ? 'border-brand-espresso bg-brand-espresso'
                    : 'border-brand-espresso/25',
                ].join(' ')}
              >
                {selected && (
                  <span className="w-full h-full flex items-center justify-center text-brand-cream text-xs font-bold">
                    ✓
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Step 3: Details ───────────────────────────────────────────────────────────

function StepDetails({
  data, setData, t, locale, tables, floorLoading,
}: {
  data: WizardData;
  setData: React.Dispatch<React.SetStateAction<WizardData>>;
  t: (k: string) => string;
  locale: Locale;
  tables: FloorTable[];
  floorLoading: boolean;
}) {
  if (data.orderType === 'DELIVERY') {
    return (
      <div className="space-y-5">
        <h2 className="font-semibold text-brand-espresso">{t('order.stepDetails')}</h2>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-brand-espresso/80">
            {t('order.addressLabel')}
          </label>
          <input
            type="text"
            placeholder={t('order.addressPlaceholder')}
            value={data.deliveryAddress}
            onChange={e => setData(d => ({ ...d, deliveryAddress: e.target.value }))}
            className="glass-input w-full rounded-xl px-4 py-3 text-sm text-brand-espresso placeholder:text-brand-espresso/35"
          />
        </div>
        <TimingSelector data={data} setData={setData} t={t} />
      </div>
    );
  }

  if (data.orderType === 'TAKEAWAY') {
    return (
      <div className="space-y-5">
        <h2 className="font-semibold text-brand-espresso">{t('order.stepDetails')}</h2>
        <TimingSelector data={data} setData={setData} t={t} />
      </div>
    );
  }

  // DINE_IN — floor plan
  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-brand-espresso">{t('order.stepDetails')}</h2>
      <p className="text-sm text-brand-espresso/55">{t('order.selectTable')}</p>

      {data.tableId && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50 border border-green-200">
          <span className="text-green-600 font-bold">✓</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-brand-espresso">
              {t('order.tableSelected')} № {data.tableNumber}
            </p>
            <p className="text-xs text-green-600">{data.tableCapacity} {locale === 'ru' ? 'места' : 'seats'}</p>
          </div>
          <button
            onClick={() => setData(d => ({ ...d, tableId: null, tableNumber: null, tableCapacity: null }))}
            className="text-xs text-green-600 underline"
          >
            {t('order.changeTable')}
          </button>
        </div>
      )}

      {floorLoading ? (
        <div className="aspect-[16/9] rounded-2xl bg-brand-espresso/5 animate-pulse flex items-center justify-center">
          <div className="w-6 h-6 rounded-full border-2 border-brand-espresso/20 border-t-brand-espresso animate-spin" />
        </div>
      ) : (
        <FloorPlan
          tables={tables}
          selectedId={data.tableId}
          onSelect={table => setData(d => ({
            ...d,
            tableId:       table.id,
            tableNumber:   table.number,
            tableCapacity: table.capacity,
          }))}
        />
      )}
    </div>
  );
}

// ── Timing selector (shared by DELIVERY + TAKEAWAY) ────────────────────────────

function TimingSelector({
  data, setData, t,
}: {
  data: WizardData;
  setData: React.Dispatch<React.SetStateAction<WizardData>>;
  t: (k: string) => string;
}) {
  return (
    <div className="space-y-3">
      {(['asap', 'scheduled'] as Timing[]).map(opt => (
        <button
          key={opt}
          onClick={() => setData(d => ({ ...d, timing: opt }))}
          className={[
            'w-full flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all duration-200',
            data.timing === opt
              ? 'border-brand-espresso bg-brand-espresso/6'
              : 'border-brand-espresso/12 bg-brand-espresso/3 hover:border-brand-espresso/25',
          ].join(' ')}
        >
          <span
            className={[
              'w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center',
              data.timing === opt ? 'border-brand-espresso bg-brand-espresso' : 'border-brand-espresso/25',
            ].join(' ')}
          >
            {data.timing === opt && <span className="w-2 h-2 rounded-full bg-white" />}
          </span>
          <span className={`text-sm font-medium ${data.timing === opt ? 'text-brand-espresso' : 'text-brand-espresso/70'}`}>
            {opt === 'asap' ? t('order.timingAsap') : t('order.timingScheduled')}
          </span>
        </button>
      ))}

      {data.timing === 'scheduled' && (
        <div className="space-y-1.5 pl-1">
          <label className="block text-xs font-medium text-brand-espresso/60">
            {t('order.scheduledTime')}
          </label>
          <input
            type="datetime-local"
            value={data.scheduledAt}
            min={new Date().toISOString().slice(0, 16)}
            onChange={e => setData(d => ({ ...d, scheduledAt: e.target.value }))}
            className="glass-input w-full rounded-xl px-4 py-2.5 text-sm text-brand-espresso"
          />
        </div>
      )}
    </div>
  );
}

// ── Floor plan ────────────────────────────────────────────────────────────────

function FloorPlan({
  tables, selectedId, onSelect,
}: {
  tables: FloorTable[];
  selectedId: string | null;
  onSelect: (t: FloorTable) => void;
}) {
  const { t } = useLocale();
  const floorRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={floorRef}
      className="relative w-full aspect-[1672/941] border border-brand-espresso/10 rounded-2xl overflow-hidden shadow-sm"
    >
      <div className="absolute inset-0 pt-[2%] pr-[1%]">
        <Image
          src="/floor.png"
          alt="Floor plan"
          fill
          className="object-cover pointer-events-none"
          draggable={false}
          priority
        />
      </div>

      {tables.length === 0 && (
        <p className="absolute inset-0 flex items-center justify-center text-sm text-brand-espresso/40">
          {t('tables.noTables')}
        </p>
      )}

      {tables.map(table => (
        <FloorDot
          key={table.id}
          table={table}
          selected={selectedId === table.id}
          onSelect={() => table.status === 'FREE' && onSelect(table)}
        />
      ))}
    </div>
  );
}

function FloorDot({
  table, selected, onSelect,
}: {
  table: FloorTable;
  selected: boolean;
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const clickable = table.status === 'FREE';
  const dotScale  = selected ? 1.4 : (hovered && clickable) ? 1.2 : 1;
  const glowOp    = !clickable ? 0 : selected ? 0.55 : hovered ? 0.40 : 0;

  return (
    <div
      style={{ left: `${table.x}%`, top: `${table.y}%` }}
      className="absolute -translate-x-1/2 -translate-y-1/2"
    >
      <button
        onClick={clickable ? onSelect : undefined}
        disabled={!clickable}
        title={`Table ${table.number} · ${table.capacity} seats — ${table.status}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`relative w-10 h-10 flex items-center justify-center rounded-full focus:outline-none ${
          clickable ? 'cursor-pointer' : 'cursor-not-allowed'
        }`}
      >
        {/* Wave pulse for free tables */}
        {clickable && !selected && (
          <>
            <span className={`absolute rounded-full table-wave pointer-events-none ${DOT_COLOR[table.status]}`} style={{ width: 20, height: 20 }} />
            <span className={`absolute rounded-full table-wave pointer-events-none ${DOT_COLOR[table.status]}`} style={{ width: 20, height: 20, animationDelay: '1.5s' }} />
          </>
        )}
        {/* Glow */}
        <span
          className="absolute pointer-events-none transition-opacity duration-200"
          style={{
            width: 76, height: 76,
            top: '50%', left: '50%',
            transform: 'translate(-50%,-50%)',
            background: `radial-gradient(circle, ${GLOW_RGBA[table.status]} 0%, transparent 70%)`,
            opacity: glowOp,
            filter: 'blur(6px)',
            borderRadius: '50%',
          }}
        />
        {/* Dot */}
        <span
          className={`relative rounded-full transition-all duration-150 ${DOT_COLOR[table.status]}`}
          style={{ width: 8, height: 8, opacity: clickable ? 0.9 : 0.3, transform: `scale(${dotScale})` }}
        />
        {/* Selection ring */}
        {selected && (
          <span
            className="absolute rounded-full ring-[2px] ring-offset-[3px] ring-green-400 pointer-events-none"
            style={{ width: 20, height: 20, top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }}
          />
        )}
        {/* Table number badge */}
        {(hovered || selected) && (
          <span
            className="absolute -top-7 left-1/2 -translate-x-1/2 bg-brand-espresso text-brand-cream text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap pointer-events-none"
          >
            №{table.number} · {table.capacity}p
          </span>
        )}
      </button>
    </div>
  );
}

// ── Step 4: Payment ───────────────────────────────────────────────────────────

function StepPayment({
  data, setData, t,
}: {
  data: WizardData;
  setData: React.Dispatch<React.SetStateAction<WizardData>>;
  t: (k: string) => string;
}) {
  const methods: { method: PaymentMethod; icon: string; label: string; desc: string }[] = [
    { method: 'CASH', icon: '💵', label: t('order.payCash'), desc: t('order.payCashDesc') },
    { method: 'CARD', icon: '💳', label: t('order.payCard'), desc: t('order.payCardDesc') },
  ];

  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-brand-espresso">{t('order.paymentTitle')}</h2>
      <div className="space-y-3">
        {methods.map(({ method, icon, label, desc }) => {
          const selected = data.paymentMethod === method;
          return (
            <button
              key={method}
              onClick={() => setData(d => ({ ...d, paymentMethod: method }))}
              className={[
                'w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all duration-200',
                selected
                  ? 'border-brand-espresso bg-brand-espresso/6 shadow-sm'
                  : 'border-brand-espresso/12 bg-brand-espresso/3 hover:border-brand-espresso/30',
              ].join(' ')}
            >
              <span className="text-2xl flex-shrink-0">{icon}</span>
              <div className="flex-1">
                <p className={`font-semibold text-sm ${selected ? 'text-brand-espresso' : 'text-brand-espresso/80'}`}>
                  {label}
                </p>
                <p className="text-xs text-brand-espresso/50 mt-0.5">{desc}</p>
              </div>
              <span
                className={[
                  'w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all',
                  selected ? 'border-brand-espresso bg-brand-espresso' : 'border-brand-espresso/25',
                ].join(' ')}
              >
                {selected && <span className="w-2 h-2 rounded-full bg-white" />}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-brand-espresso/45 text-center pt-1">{t('order.paymentNote')}</p>
    </div>
  );
}

// ── Step 5: Review ────────────────────────────────────────────────────────────

import { formatDateTime } from '@/lib/formatters';

function StepReview({
  items, data, totalPrice, locale, t,
}: {
  items: CartItem[];
  data: WizardData;
  totalPrice: number;
  locale: Locale;
  t: (k: string) => string;
}) {
  const typeLabels: Record<OrderType, string> = {
    DINE_IN:  t('order.dineIn'),
    TAKEAWAY: t('order.takeaway'),
    DELIVERY: t('order.delivery'),
  };

  const payLabels: Record<PaymentMethod, string> = {
    CASH: t('order.payCash'),
    CARD: t('order.payCard'),
  };

  return (
    <div className="space-y-5">
      <h2 className="font-semibold text-brand-espresso">{t('order.reviewTitle')}</h2>

      {/* Items */}
      <ul className="space-y-2">
        {items.map(item => {
          const name = (locale === 'en' && item.dish.nameEn) ? item.dish.nameEn : item.dish.name;
          return (
            <li key={item.dish.id} className="flex justify-between text-sm text-brand-espresso">
              <span className="flex-1 truncate pr-3">{name} × {item.quantity}</span>
              <span className="tabular-nums font-medium flex-shrink-0">
                {formatRubles(parseFloat(item.dish.price) * item.quantity)}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="border-t border-brand-espresso/10 pt-3 flex justify-between font-bold text-brand-espresso">
        <span>{t('menu.total')}</span>
        <span className="tabular-nums">{formatRubles(totalPrice)}</span>
      </div>

      {/* Details */}
      <div className="space-y-2.5 rounded-2xl bg-brand-espresso/4 p-4">
        <ReviewRow label={t('order.orderType')}    value={data.orderType ? typeLabels[data.orderType] : ''} />
        {data.orderType === 'DELIVERY' && data.deliveryAddress && (
          <ReviewRow label={t('order.deliveryAddress')} value={data.deliveryAddress} />
        )}
        {data.orderType === 'DINE_IN' && data.tableNumber && (
          <ReviewRow label={t('order.table')} value={`№ ${data.tableNumber}`} />
        )}
        {data.timing === 'scheduled' && data.scheduledAt ? (
          <ReviewRow label={t('order.scheduledAt')} value={formatDateTime(data.scheduledAt, locale)} />
        ) : (
          (data.orderType === 'TAKEAWAY' || data.orderType === 'DELIVERY') && (
            <ReviewRow label={t('order.scheduledAt')} value={t('order.asap')} />
          )
        )}
        {data.paymentMethod && (
          <ReviewRow label={t('order.paymentMethod')} value={payLabels[data.paymentMethod]} />
        )}
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-brand-espresso/50">{label}</span>
      <span className="font-medium text-brand-espresso">{value}</span>
    </div>
  );
}
