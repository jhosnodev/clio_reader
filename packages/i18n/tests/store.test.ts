import { afterEach, describe, expect, it, vi } from 'vitest';

import { getLocale, setLocale, subscribeLocale, t, tp } from '../src/store.js';

afterEach(() => {
  setLocale('es');
});

describe('locale store', () => {
  it('starts at the default locale', () => {
    expect(getLocale()).toBe('es');
  });

  it('notifies subscribers on change and stops after unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeLocale(listener);
    setLocale('en');
    expect(listener).toHaveBeenCalledTimes(1);
    setLocale('en');
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    setLocale('es');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('t and tp read the active locale', () => {
    setLocale('es');
    expect(t('library.rail.home')).toBe('Inicio');
    expect(tp('library.notes.count', 2)).toBe('2 notas');
    setLocale('en');
    expect(t('library.rail.home')).toBe('Home');
    expect(tp('library.notes.count', 2)).toBe('2 notes');
  });
});
