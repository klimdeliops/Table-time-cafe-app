'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from '@/hooks/useLocale';
import { apiFetch, ApiError } from '@/shared/api/client';

interface Table {
  id: string;
  number: number;
  restaurantId: string;
  capacity: number;
}

interface Props {
  table: Table;
  initialDate?: string;
  initialStartTime?: string;
  initialEndTime?: string;
  initialGuests?: number;
  onClose: () => void;
}

type ModalState = 'form' | 'success';

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

export function ReservationModal({
  table,
  initialDate = '',
  initialStartTime = '',
  initialEndTime = '',
  initialGuests = 1,
  onClose,
}: Props) {
  const router = useRouter();
  const { t } = useLocale();

  const [modalState, setModalState] = useState<ModalState>('form');
  const [date, setDate]             = useState(initialDate);
  const [startTime, setStartTime]   = useState(initialStartTime);
  const [endTime, setEndTime]       = useState(initialEndTime);
  const [guests, setGuests]         = useState(initialGuests || 1);
  const [error, setError]           = useState('');
  const [loading, setLoading]       = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (startTime >= endTime) {
      setError(t('reservation.timeError'));
      return;
    }

    setLoading(true);
    try {
      await apiFetch('/api/reservations', {
        method: 'POST',
        body: {
          tableId:        table.id,
          restaurantId:   table.restaurantId,
          startTime:      new Date(`${date}T${startTime}`).toISOString(),
          endTime:        new Date(`${date}T${endTime}`).toISOString(),
          numberOfGuests: guests,
        },
      });
      setModalState('success');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  }

  function handleOrderNow() {
    router.push(`/order/new?tableId=${table.id}&orderType=DINE_IN`);
  }

  function handleLater() {
    router.push('/reservation/success');
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(30, 18, 16, 0.45)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => e.target === e.currentTarget && modalState === 'form' && onClose()}
    >
      {modalState === 'form' ? (
        <div className="glass-modal w-full max-w-sm rounded-3xl p-6 space-y-5 animate-fade-up">

          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-bold text-brand-espresso">{t('reservation.title')}</h2>
              <p className="text-sm text-brand-espresso/45 mt-0.5">
                {t('reservation.table')} №{table.number} · {table.capacity} {t('reservation.seats')}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-brand-espresso/8 hover:bg-brand-espresso/14 flex items-center justify-center text-brand-espresso/55 hover:text-brand-espresso transition-colors text-lg leading-none"
              aria-label={t('common.close')}
            >
              ×
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">

            <Field label={t('reservation.date')}>
              <input
                type="date"
                required
                min={todayStr()}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="glass-input w-full rounded-xl px-3 py-2.5 text-sm text-brand-espresso focus:outline-none"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t('reservation.startTime')}>
                <input
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="glass-input w-full rounded-xl px-3 py-2.5 text-sm text-brand-espresso focus:outline-none"
                />
              </Field>
              <Field label={t('reservation.endTime')}>
                <input
                  type="time"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="glass-input w-full rounded-xl px-3 py-2.5 text-sm text-brand-espresso focus:outline-none"
                />
              </Field>
            </div>

            <Field label={t('reservation.guests')}>
              <input
                type="number"
                required
                min={1}
                max={table.capacity}
                value={guests}
                onChange={(e) => setGuests(Number(e.target.value))}
                className="glass-input w-full rounded-xl px-3 py-2.5 text-sm text-brand-espresso focus:outline-none"
              />
            </Field>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl text-sm text-brand-espresso/65 bg-brand-espresso/8 hover:bg-brand-espresso/14 transition-colors font-medium"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-[2] btn-amber rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    {t('common.loading')}
                  </span>
                ) : t('reservation.reserve')}
              </button>
            </div>

          </form>
        </div>
      ) : (
        <div className="glass-modal w-full max-w-sm rounded-3xl p-8 text-center space-y-6 animate-fade-up">

          {/* Animated green check */}
          <div
            className="w-20 h-20 mx-auto rounded-full flex items-center justify-center text-4xl shadow-lg animate-float"
            style={{ background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' }}
          >
            ✓
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold text-brand-espresso">{t('reservation.successTitle')}</h2>
            <p className="text-sm text-brand-espresso/55 leading-relaxed">
              {t('reservation.orderNow')}
            </p>
            <p className="text-xs text-brand-espresso/40">{t('reservation.orderNowDesc')}</p>
          </div>

          <div className="space-y-3 pt-1">
            <button
              onClick={handleOrderNow}
              className="btn-amber w-full rounded-2xl py-3.5 text-sm font-semibold"
            >
              {t('reservation.goToMenu')}
            </button>
            <button
              onClick={handleLater}
              className="w-full rounded-2xl py-3 text-sm font-medium text-brand-espresso/65 bg-brand-espresso/8 hover:bg-brand-espresso/14 transition-colors"
            >
              {t('reservation.later')}
            </button>
          </div>

        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-brand-espresso/70">{label}</label>
      {children}
    </div>
  );
}
