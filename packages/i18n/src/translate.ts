import { en, type MessageKey, type MessageParams } from './en.js';
import { es } from './es.js';
import { DEFAULT_LOCALE, type Locale } from './locale.js';

const dictionaries: Record<Locale, Record<string, string>> = { en, es };

export function getMessages(locale: Locale): Record<string, string> {
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
}

function interpolate(template: string, params?: MessageParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match,
  );
}

export function translate(locale: Locale, key: MessageKey, params?: MessageParams): string {
  const messages = dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
  const template = messages[key] ?? en[key] ?? key;
  return interpolate(template, params);
}

export function translatePlural(
  locale: Locale,
  baseKey: string,
  count: number,
  params?: Omit<MessageParams, 'count'>,
): string {
  const category = new Intl.PluralRules(locale).select(count);
  const key = `${baseKey}.${category}`;
  const messages = dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
  const template = messages[key] ?? messages[`${baseKey}.other`] ?? messages[baseKey] ?? baseKey;
  return interpolate(template, { count, ...params });
}
