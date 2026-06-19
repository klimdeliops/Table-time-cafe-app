import type { Locale } from '@/lib/i18n';

export function formatRubles(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (!isFinite(num)) return '—';
  return new Intl.NumberFormat('ru-RU', {
    style:                 'currency',
    currency:              'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatRublesFull(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (!isFinite(num)) return '—';
  return new Intl.NumberFormat('ru-RU', {
    style:                 'currency',
    currency:              'RUB',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

const BCP: Record<Locale, string> = { ru: 'ru-RU', en: 'en-US' };

export function formatDate(
  date: string | Date,
  locale: Locale = 'ru',
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(BCP[locale], {
    day:   'numeric',
    month: 'long',
    year:  'numeric',
  }).format(d);
}

export function formatTime(
  date: string | Date,
  locale: Locale = 'ru',
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(BCP[locale], {
    hour:   '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatDateTime(
  date: string | Date,
  locale: Locale = 'ru',
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(BCP[locale], {
    day:    'numeric',
    month:  'long',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatTimeRange(
  start: string | Date,
  end:   string | Date,
  locale: Locale = 'ru',
): string {
  return `${formatTime(start, locale)} – ${formatTime(end, locale)}`;
}
