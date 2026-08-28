import { describe, expect, it } from 'vitest';

import {
  createBook,
  createDefaultPreferences,
  createReadingProgress,
  DomainValidationError,
  normalizePercent,
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
