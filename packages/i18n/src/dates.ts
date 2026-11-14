import { type Locale } from './locale.js';

const RELATIVE_UNITS: readonly (readonly [Intl.RelativeTimeFormatUnit, number])[] = [
  ['year', 365],
  ['month', 30],
  ['week', 7],
  ['day', 1],
];

export function formatDate(timestamp: number, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(timestamp));
}

export function formatRelativeDate(timestamp: number, locale: Locale, now = Date.now()): string {
  const deltaDays = (timestamp - now) / 86_400_000;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (Math.abs(deltaDays) < 1) return rtf.format(0, 'day');

  for (const [unit, days] of RELATIVE_UNITS) {
    if (Math.abs(deltaDays) >= days) {
      const value = Math.round(deltaDays / days);
      return rtf.format(value, unit);
    }
  }
  return rtf.format(Math.round(deltaDays), 'day');
}
