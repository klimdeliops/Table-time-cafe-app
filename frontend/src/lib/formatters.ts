import type { Locale } from '@/lib/i18n';

// ── Currency ─────────────────────────────────────────────────────────────────

/**
 * Formats a number or decimal string as Russian rubles.
 * Examples: 1250 → "1 250 ₽"  |  99.9 → "100 ₽"  |  NaN → "—"
 */
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

/**
 * Same as formatRubles but preserves up to 2 decimal places (kopeks).
 * Example: 3.5 → "3,50 ₽"
 */
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

// ── Date & Time ───────────────────────────────────────────────────────────────

const BCP: Record<Locale, string> = { ru: 'ru-RU', en: 'en-US' };

/**
 * Formats a date value as "15 мая 2025" (ru) or "May 15, 2025" (en).
 */
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

/**
 * Formats a time value as "14:30".
 */
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

/**
 * Formats a full date-time as "15 мая 2025, 14:30" or "May 15, 2025, 2:30 PM".
 */
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

/**
 * Formats a date range as "15 мая, 14:00 – 16:00".
 */
export function formatTimeRange(
  start: string | Date,
  end:   string | Date,
  locale: Locale = 'ru',
): string {
  return `${formatTime(start, locale)} – ${formatTime(end, locale)}`;
}
