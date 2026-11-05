import { describe, expect, it } from 'vitest';

import {
  createBook,
  createDefaultPreferences,
  createReadingProgress,
  DomainValidationError,
  normalizePercent,
  normalizeReaderMargin,
  validateReaderPreferences,
} from '../src/index.js';

describe('createBook', () => {
  it('creates a book with defaults', () => {
    const book = createBook({
      id: 'book-1',
      title: 'Example',
      format: 'epub',
      uri: 'file:///example.epub',
      addedAt: 1,
    });

    expect(book.status).toBe('available');
    expect(book.addedAt).toBe(1);
  });

  it('rejects an empty identity field', () => {
    expect(() =>
      createBook({
        id: '',
        title: 'Example',
        format: 'pdf',
        uri: 'file:///example.pdf',
      }),
    ).toThrow(DomainValidationError);
  });
});

describe('reader preferences', () => {
  it('creates valid defaults', () => {
    const preferences = createDefaultPreferences();

    expect(() => validateReaderPreferences(preferences)).not.toThrow();
  });

  it('rejects an invalid font scale', () => {
    expect(() =>
      validateReaderPreferences({
        ...createDefaultPreferences(),
        fontScale: 3,
      }),
    ).toThrow('fontScale must be between 0.8 and 2');
  });

  it('rejects an out-of-range margin', () => {
    expect(() =>
      validateReaderPreferences({
        ...createDefaultPreferences(),
        margin: 200,
      }),
    ).toThrow('margin must be between 8 and 120');
  });

  it('normalizes legacy and numeric margins', () => {
    expect(normalizeReaderMargin('compact')).toBe(16);
    expect(normalizeReaderMargin('comfortable')).toBe(48);
    expect(normalizeReaderMargin('wide')).toBe(96);
    expect(normalizeReaderMargin('64')).toBe(64);
    expect(normalizeReaderMargin(0)).toBe(8);
    expect(normalizeReaderMargin(999)).toBe(120);
    expect(normalizeReaderMargin('unknown')).toBe(48);
  });
});

describe('reading progress', () => {
  it('clamps progress to the supported range', () => {
    expect(normalizePercent(2)).toBe(1);
    expect(normalizePercent(-1)).toBe(0);
  });

  it('creates format-specific progress', () => {
    const progress = createReadingProgress({
      bookId: 'book-1',
      locator: { format: 'pdf', page: 4 },
      percent: 0.4,
      updatedAt: 1,
    });

    expect(progress).toEqual({
      bookId: 'book-1',
      locator: { format: 'pdf', page: 4 },
      percent: 0.4,
      updatedAt: 1,
    });
  });
});
