import { describe, expect, it } from 'vitest';

import { createBook } from '../src/index.js';

describe('createBook', () => {
  it('creates a book with a deterministic supplied timestamp', () => {
    const book = createBook({
      id: 'book-1',
      title: 'Example',
      format: 'epub',
      uri: 'file:///example.epub',
      addedAt: 1,
    });

    expect(book).toEqual({
      id: 'book-1',
      title: 'Example',
      format: 'epub',
      uri: 'file:///example.epub',
      addedAt: 1,
    });
  });
});
