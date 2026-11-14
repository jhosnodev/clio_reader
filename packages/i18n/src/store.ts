import type { MessageKey, MessageParams } from './en.js';
import { DEFAULT_LOCALE, type Locale } from './locale.js';
import { translate, translatePlural } from './translate.js';

let current: Locale = DEFAULT_LOCALE;

const listeners = new Set<() => void>();

export function getLocale(): Locale {
  return current;
}

export function setLocale(locale: Locale): void {
  if (locale === current) return;
  current = locale;
  for (const listener of listeners) listener();
}

export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function t(key: MessageKey, params?: MessageParams): string {
  return translate(current, key, params);
}

export function tp(baseKey: string, count: number, params?: Omit<MessageParams, 'count'>): string {
  return translatePlural(current, baseKey, count, params);
}
