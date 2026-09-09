import { describe, expect, it } from 'vitest';

import { InMemoryKeyValueStore, LocalRepository } from '@clio-reader/storage';

import { BookNotFoundError } from '../src/errors.js';
import { getBook } from '../src/get-book.js';
import { importBook } from '../src/import-book.js';
import { updateProgress } from '../src/update-progress.js';
import { saveBookPreferences } from '../src/preferences.js';

function createRepo(): LocalRepository {
  return new LocalRepository(new InMemoryKeyValueStore());
}

describe('getBook', () => {
  it('returns book details with default values', async () => {
    const repo = createRepo();
    const imported = await importBook(repo, {
      id: 'book-1',
      title: 'My Book',
      format: 'epub',
      uri: 'file:///book.epub',
    });

    const details = await getBook(repo, 'book-1');
    expect(details.book).toEqual(imported);
    expect(details.progress).toBeUndefined();
    expect(details.preferences).toEqual({});
  });

  it('includes progress when available', async () => {
    const repo = createRepo();
    await importBook(repo, {
      id: 'book-1',
      title: 'My Book',
      format: 'pdf',
      uri: 'file:///book.pdf',
    });

    await updateProgress(repo, {
      bookId: 'book-1',
      locator: { format: 'pdf', page: 10 },
      percent: 0.5,
    });

    const details = await getBook(repo, 'book-1');
    expect(details.progress).toBeDefined();
    expect(details.progress!.percent).toBe(0.5);
  });

  it('includes per-book preferences when available', async () => {
    const repo = createRepo();
    await importBook(repo, {
      id: 'book-1',
      title: 'My Book',
      format: 'epub',
      uri: 'file:///book.epub',
    });

    await saveBookPreferences(repo, 'book-1', { fontScale: 1.5 });

    const details = await getBook(repo, 'book-1');
    expect(details.preferences.fontScale).toBe(1.5);
  });

  it('throws BookNotFoundError for nonexistent book', async () => {
    const repo = createRepo();

    await expect(getBook(repo, 'nonexistent')).rejects.toBeInstanceOf(BookNotFoundError);
  });
});
