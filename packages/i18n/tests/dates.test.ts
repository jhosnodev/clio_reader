import { describe, expect, it } from 'vitest';

import { formatDate, formatRelativeDate } from '../src/dates.js';

const NOW = Date.UTC(2026, 5, 15, 12, 0, 0);

describe('formatDate', () => {
  it('formats as short date with year', () => {
    expect(formatDate(new Date(2026, 5, 1).getTime(), 'es')).toBe('1 jun 2026');
    expect(formatDate(new Date(2026, 5, 1).getTime(), 'en')).toBe('Jun 1, 2026');
  });
});

describe('formatRelativeDate', () => {
  it('returns "today" for the same day', () => {
    expect(formatRelativeDate(NOW, 'es', NOW)).toBe('hoy');
    expect(formatRelativeDate(NOW, 'en', NOW)).toBe('today');
  });

  it('formats days, weeks and months', () => {
    expect(formatRelativeDate(NOW - 3 * 86_400_000, 'es', NOW)).toBe('hace 3 días');
    expect(formatRelativeDate(NOW - 3 * 86_400_000, 'en', NOW)).toBe('3 days ago');
    expect(formatRelativeDate(NOW - 14 * 86_400_000, 'en', NOW)).toBe('2 weeks ago');
    expect(formatRelativeDate(NOW + 60 * 86_400_000, 'es', NOW)).toBe('dentro de 2 meses');
  });
});
