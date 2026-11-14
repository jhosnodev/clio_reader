import type { MessageKey } from './en.js';
import { getLocale } from './store.js';
import { translate } from './translate.js';

export function applyStaticTranslations(root: ParentNode = document): void {
  const locale = getLocale();

  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n as MessageKey | undefined;
    if (key) el.textContent = translate(locale, key);
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((el) => {
    const key = el.dataset.i18nTitle as MessageKey | undefined;
    if (key) el.title = translate(locale, key);
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-placeholder]').forEach((el) => {
    const key = el.dataset.i18nPlaceholder as MessageKey | undefined;
    if (key && 'placeholder' in el) {
      (el as HTMLInputElement).placeholder = translate(locale, key);
    }
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach((el) => {
    const key = el.dataset.i18nAria as MessageKey | undefined;
    if (key) el.setAttribute('aria-label', translate(locale, key));
  });

  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale;
  }
}
