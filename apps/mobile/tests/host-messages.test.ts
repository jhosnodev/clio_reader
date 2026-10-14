import { describe, it, expect } from 'vitest';
import { interpretMessage } from '../src/reader/host-messages';

describe('interpretMessage', () => {
  it('maps the close sentinel', () => {
    expect(interpretMessage({ __clio: true, message: '__clio_back__' })).toEqual({ type: 'close' });
  });

  it('maps the rank sentinel with a numeric payload', () => {
    expect(interpretMessage({ __clio: true, message: '__clio_rank__{"rank":3.5}' })).toEqual({
      type: 'rank',
      rank: 3.5,
    });
  });

  it('ignores a rank sentinel with a non-numeric payload', () => {
    expect(interpretMessage({ __clio: true, message: '__clio_rank__{"rank":"x"}' })).toBeNull();
  });

  it('ignores a rank sentinel with invalid JSON', () => {
    expect(interpretMessage({ __clio: true, message: '__clio_rank__{oops' })).toBeNull();
  });

  it('maps the preferences sentinel', () => {
    const preferences = { theme: 'sepia', fontScale: 1.2 };
    expect(
      interpretMessage({ __clio: true, message: `__clio_prefs__${JSON.stringify(preferences)}` }),
    ).toEqual({ type: 'preferences', preferences });
  });

  it('maps the locator message', () => {
    expect(interpretMessage({ __clio: 'locator', value: 'epubcfi(/6/4)' })).toEqual({
      type: 'locator',
      value: 'epubcfi(/6/4)',
    });
  });

  it('maps a null locator value', () => {
    expect(interpretMessage({ __clio: 'locator', value: null })).toEqual({
      type: 'locator',
      value: null,
    });
  });

  it('coerces a non-string locator value to null', () => {
    expect(interpretMessage({ __clio: 'locator', value: 42 })).toEqual({
      type: 'locator',
      value: null,
    });
  });

  it('returns null for unrelated payloads', () => {
    expect(interpretMessage('__clio_back__')).toBeNull();
    expect(interpretMessage(null)).toBeNull();
    expect(interpretMessage({ foo: 'bar' })).toBeNull();
    expect(interpretMessage({ __clio: true, message: 'hola' })).toBeNull();
  });
});
