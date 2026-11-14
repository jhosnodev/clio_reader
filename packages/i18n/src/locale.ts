export const SUPPORTED_LOCALES = ['en', 'es'] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'es';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function coerceLocale(value: unknown): Locale | undefined {
  if (isLocale(value)) return value;
  if (typeof value !== 'string') return undefined;
  const base = value.toLowerCase().split(/[-_]/)[0];
  return isLocale(base) ? base : undefined;
}

export function detectLocale(navigatorLanguage?: string): Locale {
  return coerceLocale(navigatorLanguage) ?? DEFAULT_LOCALE;
}
