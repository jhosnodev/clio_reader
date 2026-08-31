import { describe, expect, it } from 'vitest';

import { InMemoryKeyValueStore, LocalRepository } from '@echo-reader/storage';

import { BookNotFoundError } from '../src/errors.js';
import { importBook } from '../src/import-book.js';
import { removeBook } from '../src/remove-book.js';
import { updateProgress } from '../src/update-progress.js';
import { createBookmark } from '../src/bookmarks.js';
import { createNote } from '../src/notes.js';

function createRepo(): LocalRepository {
  return new LocalRepository(new InMemoryKeyValueStore());
}

describe('removeBook', () => {
  it('removes the book from the repository', async () => {
    const repo = createRepo();
    await importBook(repo, {
      id: 'book-1',
      title: 'My Book',
      format: 'epub',
      uri: 'file:///book.epub',
    });

    await removeBook(repo, 'book-1');

    const books = await repo.listBooks();
    expect(books).toHaveLength(0);
  });

  it('cascades removal of progress', async () => {
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
      percent: 0.3,
    });

    await removeBook(repo, 'book-1');

    const progress = await repo.getProgress('book-1');
    expect(progress).toBeUndefined();
  });

  it('cascades removal of bookmarks', async () => {
    const repo = createRepo();
    await importBook(repo, {
      id: 'book-1',
      title: 'My Book',
      format: 'epub',
      uri: 'file:///book.epub',
    });
    await createBookmark(repo, {
      bookId: 'book-1',
      locator: { format: 'epub', href: 'ch1' },
    });

    await removeBook(repo, 'book-1');

    const bookmarks = await repo.listBookmarks('book-1');
    expect(bookmarks).toHaveLength(0);
  });

  it('cascades removal of notes', async () => {
    const repo = createRepo();
    await importBook(repo, {
      id: 'book-1',
      title: 'My Book',
      format: 'epub',
      uri: 'file:///book.epub',
    });
    await createNote(repo, {
      bookId: 'book-1',
      locator: { format: 'epub', href: 'ch1' },
      body: 'My note',
    });

    await removeBook(repo, 'book-1');

    const notes = await repo.listNotes('book-1');
    expect(notes).toHaveLength(0);
  });

  it('cascades removal of per-book preferences', async () => {
    const repo = createRepo();
    await importBook(repo, {
      id: 'book-1',
      title: 'My Book',
      format: 'epub',
      uri: 'file:///book.epub',
    });
    await repo.saveBookPreferences('book-1', { fontScale: 1.5 });

    await removeBook(repo, 'book-1');

    const prefs = await repo.getBookPreferences('book-1');
    expect(prefs).toEqual({});
  });

  it('does not affect other books', async () => {
    const repo = createRepo();
    await importBook(repo, {
      id: 'book-1',
      title: 'First',
      format: 'epub',
      uri: 'file:///first.epub',
    });
    await importBook(repo, {
      id: 'book-2',
      title: 'Second',
      format: 'epub',
      uri: 'file:///second.epub',
    });

    await removeBook(repo, 'book-1');

    const books = await repo.listBooks();
    expect(books).toHaveLength(1);
    expect(books[0]!.id).toBe('book-2');
  });

  it('throws BookNotFoundError for nonexistent book', async () => {
    const repo = createRepo();

    await expect(removeBook(repo, 'nonexistent')).rejects.toBeInstanceOf(BookNotFoundError);
  });
});
