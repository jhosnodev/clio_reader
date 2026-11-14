import { describe, expect, it } from 'vitest';

import { en, type MessageKey } from '../src/en.js';
import { es } from '../src/es.js';

function placeholders(template: string): string[] {
  return [...template.matchAll(/\{(\w+)\}/g)].map((match) => match[1] ?? '').sort();
}

describe('dictionary completeness', () => {
  it('es has exactly the same keys as en', () => {
    const enKeys = Object.keys(en).sort();
    const esKeys = Object.keys(es).sort();
    expect(esKeys).toEqual(enKeys);
  });

  it('every locale message uses the same placeholders', () => {
    for (const key of Object.keys(en) as MessageKey[]) {
      expect(placeholders(es[key]), `placeholders for ${key}`).toEqual(placeholders(en[key]));
    }
  });

  it('no message is empty', () => {
    for (const key of Object.keys(en) as MessageKey[]) {
      expect(en[key].trim().length, `en ${key}`).toBeGreaterThan(0);
      expect(es[key].trim().length, `es ${key}`).toBeGreaterThan(0);
    }
  });
});
