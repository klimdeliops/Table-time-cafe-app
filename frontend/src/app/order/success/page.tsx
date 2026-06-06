'use client';

import Link from 'next/link';
import { useLocale } from '@/hooks/useLocale';

export default function OrderSuccessPage() {
  const { t } = useLocale();

  return (
    <main className="min-h-screen flex items-center justify-center pt-14 px-4">
      <div className="glass-card rounded-3xl p-10 max-w-sm w-full text-center space-y-6 animate-fade-up">

        {/* Icon */}
        <div
          className="w-20 h-20 mx-auto rounded-full flex items-center justify-center text-4xl shadow-lg"
          style={{ background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' }}
        >
          ✓
        </div>

        {/* Text */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-brand-espresso">{t('order.successTitle')}</h1>
          <p className="text-sm text-brand-espresso/55 leading-relaxed">{t('order.successMessage')}</p>
        </div>

        {/* CTAs */}
        <div className="space-y-3 pt-2">
          <Link
            href="/orders"
            className="btn-amber flex items-center justify-center w-full rounded-2xl py-3.5 text-sm font-semibold"
          >
            {t('order.viewOrders')}
          </Link>
          <Link
            href="/menu"
            className="flex items-center justify-center w-full rounded-2xl py-3.5 text-sm font-semibold text-brand-espresso/70 bg-brand-espresso/8 hover:bg-brand-espresso/14 transition-colors"
          >
            {t('order.backToMenu')}
          </Link>
        </div>
      </div>
    </main>
  );
}
