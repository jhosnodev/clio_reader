import { useMemo, useSyncExternalStore } from 'react';
import {
  coerceLocale,
  detectLocale,
  getLocale,
  setLocale,
  subscribeLocale,
  t,
  tp,
  type Locale,
  type MessageKey,
  type MessageParams,
} from '@clio-reader/i18n';

export const LOCALE_STORAGE_KEY = 'clio-lang';

export function bootstrapLocale(): void {
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  setLocale(coerceLocale(stored) ?? detectLocale(navigator.language));
  document.documentElement.lang = getLocale();
}

export function persistLocale(locale: Locale): void {
  localStorage.setItem(LOCALE_STORAGE_KEY, locale);
}

export interface Translator {
  readonly locale: Locale;
  readonly t: (key: MessageKey, params?: MessageParams) => string;
  readonly tp: (baseKey: string, count: number, params?: Omit<MessageParams, 'count'>) => string;
}

export function useT(): Translator {
  const locale = useSyncExternalStore(subscribeLocale, getLocale, getLocale);
  return useMemo(
    () => ({
      locale,
      t: (key: MessageKey, params?: MessageParams) => t(key, params),
      tp: (baseKey: string, count: number, params?: Omit<MessageParams, 'count'>) =>
        tp(baseKey, count, params),
    }),
    [locale],
  );
}
