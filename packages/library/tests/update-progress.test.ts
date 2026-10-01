import { describe, expect, it, vi } from 'vitest';

import { InMemoryKeyValueStore, LocalRepository } from '@clio-reader/storage';

import { BookNotFoundError } from '../src/errors.js';
import { importBook } from '../src/import-book.js';
import { updateProgress } from '../src/update-progress.js';

function createRepo(): LocalRepository {
  return new LocalRepository(new InMemoryKeyValueStore());
}

describe('updateProgress', () => {
  it('saves and returns normalized progress', async () => {
    const repo = createRepo();
    await importBook(repo, {
      id: 'book-1',
      title: 'My Book',
      format: 'pdf',
      uri: 'file:///book.pdf',
    });

    const progress = await updateProgress(repo, {
      bookId: 'book-1',
      locator: { format: 'pdf', page: 10 },
      percent: 0.5,
    });

    expect(progress.bookId).toBe('book-1');
    expect(progress.percent).toBe(0.5);
    expect(progress.locator).toEqual({ format: 'pdf', page: 10 });
    expect(progress.updatedAt).toBeTypeOf('number');
  });

  it('clamps percent above 1 to 1', async () => {
    const repo = createRepo();
    await importBook(repo, {
      id: 'book-1',
      title: 'My Book',
      format: 'pdf',
      uri: 'file:///book.pdf',
    });

    const progress = await updateProgress(repo, {
      bookId: 'book-1',
      locator: { format: 'pdf', page: 10 },
      percent: 2,
    });

    expect(progress.percent).toBe(1);
  });

  it('clamps negative percent to 0', async () => {
    const repo = createRepo();
    await importBook(repo, {
      id: 'book-1',
      title: 'My Book',
      format: 'pdf',
      uri: 'file:///book.pdf',
    });

    const progress = await updateProgress(repo, {
      bookId: 'book-1',
      locator: { format: 'pdf', page: 10 },
      percent: -0.5,
    });

    expect(progress.percent).toBe(0);
  });

  it('updates existing progress for the same book', async () => {
    const repo = createRepo();
    await importBook(repo, {
      id: 'book-1',
      title: 'My Book',
      format: 'pdf',
      uri: 'file:///book.pdf',
    });

    await updateProgress(repo, {
      bookId: 'book-1',
      locator: { format: 'pdf', page: 5 },
      percent: 0.2,
    });
    await updateProgress(repo, {
      bookId: 'book-1',
      locator: { format: 'pdf', page: 20 },
      percent: 0.8,
    });

    const stored = await repo.getProgress('book-1');
    expect(stored!.percent).toBe(0.8);
    expect(stored!.locator).toEqual({ format: 'pdf', page: 20 });
  });

  it('throws BookNotFoundError for nonexistent book', async () => {
    const repo = createRepo();

    await expect(
      updateProgress(repo, {
        bookId: 'nonexistent',
        locator: { format: 'pdf', page: 1 },
        percent: 0.5,
      }),
    ).rejects.toBeInstanceOf(BookNotFoundError);
  });

  it('supports epub locators', async () => {
    const repo = createRepo();
    await importBook(repo, {
      id: 'book-1',
      title: 'My Book',
      format: 'epub',
      uri: 'file:///book.epub',
    });

    const progress = await updateProgress(repo, {
      bookId: 'book-1',
      locator: { format: 'epub', href: 'chapter1.xhtml', cfi: 'epubcfi(/6/2)' },
      percent: 0.3,
    });

    expect(progress.locator.format).toBe('epub');
  });

  it('refreshes lastOpenedAt so recency survives a progress-only write', async () => {
    const repo = createRepo();
    await importBook(repo, {
      id: 'book-1',
      title: 'My Book',
      format: 'pdf',
      uri: 'file:///book.pdf',
    });

    const before = (await repo.getBook('book-1'))!.lastOpenedAt ?? 0;
    await updateProgress(repo, {
      bookId: 'book-1',
      locator: { format: 'pdf', page: 3 },
      percent: 0.3,
    });
    const after = (await repo.getBook('book-1'))!.lastOpenedAt ?? 0;

    expect(after).toBeGreaterThanOrEqual(before);
  });

  it('looks the book up by id instead of listing the whole library', async () => {
    const repo = createRepo();
    await importBook(repo, {
      id: 'book-1',
      title: 'My Book',
      format: 'pdf',
      uri: 'file:///book.pdf',
    });

    const getBook = vi.spyOn(repo, 'getBook');
    const listBooks = vi.spyOn(repo, 'listBooks');

    await updateProgress(repo, {
      bookId: 'book-1',
      locator: { format: 'pdf', page: 3 },
      percent: 0.3,
    });

    expect(getBook).toHaveBeenCalledWith('book-1');
    expect(listBooks).not.toHaveBeenCalled();
  });
});
