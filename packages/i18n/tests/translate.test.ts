import { describe, expect, it } from 'vitest';

import { translate, translatePlural } from '../src/translate.js';
import { coerceLocale, detectLocale, isLocale } from '../src/locale.js';

describe('translate', () => {
  it('translates a key in each locale', () => {
    expect(translate('en', 'library.rail.home')).toBe('Home');
    expect(translate('es', 'library.rail.home')).toBe('Inicio');
  });

  it('interpolates named params', () => {
    expect(translate('en', 'library.card.open', { title: 'Dune' })).toBe('Open Dune');
    expect(translate('es', 'library.card.open', { title: 'Dune' })).toBe('Abrir Dune');
  });

  it('leaves unknown params untouched', () => {
    expect(translate('en', 'library.card.open')).toBe('Open {title}');
  });
});

describe('translatePlural', () => {
  it('selects singular and plural forms', () => {
    expect(translatePlural('en', 'library.notes.count', 1)).toBe('1 note');
    expect(translatePlural('en', 'library.notes.count', 3)).toBe('3 notes');
    expect(translatePlural('es', 'library.notes.count', 1)).toBe('1 nota');
    expect(translatePlural('es', 'library.notes.count', 3)).toBe('3 notas');
  });

  it('falls back to .other when the category is missing', () => {
    expect(translatePlural('es', 'library.import.skipped', 2)).toBe('(2 omitidos)');
  });
});

describe('locale detection', () => {
  it('accepts supported locales only', () => {
    expect(isLocale('en')).toBe(true);
    expect(isLocale('es')).toBe(true);
    expect(isLocale('fr')).toBe(false);
  });

  it('coerces region variants to the base locale', () => {
    expect(coerceLocale('en-US')).toBe('en');
    expect(coerceLocale('es-MX')).toBe('es');
    expect(coerceLocale('fr-FR')).toBeUndefined();
  });

  it('falls back to the default locale', () => {
    expect(detectLocale('fr-FR')).toBe('es');
    expect(detectLocale(undefined)).toBe('es');
    expect(detectLocale('en-GB')).toBe('en');
  });
});
