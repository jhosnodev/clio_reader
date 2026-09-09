import { describe, expect, it } from 'vitest';

import { createBook, createReadingProgress, createDefaultPreferences } from '@clio-reader/domain';
import { InMemoryKeyValueStore, LocalRepository, PersistenceError } from '../src/index.js';

describe('LocalRepository', () => {
  it('persists and restores the last reading position', async () => {
    const store = new InMemoryKeyValueStore();
    const repository = new LocalRepository(store);
    const book = createBook({
      id: 'book-1',
      title: 'Example',
      format: 'pdf',
      uri: 'file:///example.pdf',
      addedAt: 1,
    });
    const progress = createReadingProgress({
      bookId: book.id,
      locator: { format: 'pdf', page: 7, zoom: 1.2 },
      percent: 0.5,
      updatedAt: 2,
    });

    await repository.upsertBook(book);
    await repository.saveProgress(progress);

    const restored = await new LocalRepository(store).getProgress(book.id);
    expect(restored).toEqual(progress);
  });

  it('keeps global and per-book settings separate', async () => {
    const repository = new LocalRepository(new InMemoryKeyValueStore());
    const defaults = createDefaultPreferences();

    await repository.saveGlobalPreferences({ ...defaults, theme: 'dark' });
    await repository.saveBookPreferences('book-1', { fontScale: 1.25 });

    expect((await repository.getGlobalPreferences()).theme).toBe('dark');
    expect(await repository.getBookPreferences('book-1')).toEqual({ fontScale: 1.25 });
  });

  it('isolates annotations by book and removes them with the book', async () => {
    const repository = new LocalRepository(new InMemoryKeyValueStore());
    const bookmark = {
      id: 'bookmark-1',
      bookId: 'book-1',
      locator: { format: 'cbz' as const, page: 3 },
      createdAt: 1,
    };
    const note = {
      id: 'note-1',
      bookId: 'book-1',
      locator: { format: 'cbz' as const, page: 3 },
      body: 'Review this page',
      createdAt: 1,
      updatedAt: 1,
    };

    await repository.saveBookmark(bookmark);
    await repository.saveNote(note);
    expect(await repository.listBookmarks('book-2')).toHaveLength(0);
    expect(await repository.listNotes('book-1')).toHaveLength(1);

    await repository.removeBook('book-1');
    expect(await repository.listBookmarks('book-1')).toHaveLength(0);
    expect(await repository.listNotes('book-1')).toHaveLength(0);
  });

  it('reports invalid persisted JSON', async () => {
    const store = new InMemoryKeyValueStore();
    await store.set('clio-reader.state', '{invalid');

    await expect(new LocalRepository(store).getState()).rejects.toBeInstanceOf(PersistenceError);
  });
});
