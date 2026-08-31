import { describe, expect, it } from 'vitest';

import { InMemoryKeyValueStore, LocalRepository } from '@echo-reader/storage';

import { BookmarkNotFoundError, BookNotFoundError } from '../src/errors.js';
import { importBook } from '../src/import-book.js';
import { createBookmark, listBookmarks, removeBookmark } from '../src/bookmarks.js';

function createRepo(): LocalRepository {
  return new LocalRepository(new InMemoryKeyValueStore());
}

describe('bookmarks', () => {
  describe('createBookmark', () => {
    it('creates a bookmark with generated id and timestamps', async () => {
      const repo = createRepo();
      await importBook(repo, {
        id: 'book-1',
        title: 'My Book',
        format: 'epub',
        uri: 'file:///book.epub',
      });

      const bookmark = await createBookmark(repo, {
        bookId: 'book-1',
        locator: { format: 'epub', href: 'chapter1.xhtml' },
        label: 'Chapter 1',
      });

      expect(bookmark.id).toBeTypeOf('string');
      expect(bookmark.id.length).toBeGreaterThan(0);
      expect(bookmark.bookId).toBe('book-1');
      expect(bookmark.label).toBe('Chapter 1');
      expect(bookmark.createdAt).toBeTypeOf('number');
    });

    it('persists the bookmark in the repository', async () => {
      const repo = createRepo();
      await importBook(repo, {
        id: 'book-1',
        title: 'My Book',
        format: 'epub',
        uri: 'file:///book.epub',
      });

      const created = await createBookmark(repo, {
        bookId: 'book-1',
        locator: { format: 'epub', href: 'ch1' },
      });

      const bookmarks = await listBookmarks(repo, 'book-1');
      expect(bookmarks).toHaveLength(1);
      expect(bookmarks[0]!.id).toBe(created.id);
    });

    it('throws BookNotFoundError for nonexistent book', async () => {
      const repo = createRepo();

      await expect(
        createBookmark(repo, {
          bookId: 'nonexistent',
          locator: { format: 'epub', href: 'ch1' },
        }),
      ).rejects.toBeInstanceOf(BookNotFoundError);
    });
  });

  describe('listBookmarks', () => {
    it('returns empty array when no bookmarks exist', async () => {
      const repo = createRepo();
      const bookmarks = await listBookmarks(repo, 'book-1');
      expect(bookmarks).toEqual([]);
    });

    it('returns only bookmarks for the specified book', async () => {
      const repo = createRepo();
      await importBook(repo, {
        id: 'book-1',
        title: 'Book 1',
        format: 'epub',
        uri: 'file:///book1.epub',
      });
      await importBook(repo, {
        id: 'book-2',
        title: 'Book 2',
        format: 'epub',
        uri: 'file:///book2.epub',
      });

      await createBookmark(repo, {
        bookId: 'book-1',
        locator: { format: 'epub', href: 'ch1' },
      });
      await createBookmark(repo, {
        bookId: 'book-2',
        locator: { format: 'epub', href: 'ch1' },
      });

      const bookmarks1 = await listBookmarks(repo, 'book-1');
      const bookmarks2 = await listBookmarks(repo, 'book-2');

      expect(bookmarks1).toHaveLength(1);
      expect(bookmarks1[0]!.bookId).toBe('book-1');
      expect(bookmarks2).toHaveLength(1);
      expect(bookmarks2[0]!.bookId).toBe('book-2');
    });

    it('returns multiple bookmarks per book', async () => {
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
      await createBookmark(repo, {
        bookId: 'book-1',
        locator: { format: 'epub', href: 'ch2' },
      });

      const bookmarks = await listBookmarks(repo, 'book-1');
      expect(bookmarks).toHaveLength(2);
    });
  });

  describe('removeBookmark', () => {
    it('removes the bookmark', async () => {
      const repo = createRepo();
      await importBook(repo, {
        id: 'book-1',
        title: 'My Book',
        format: 'epub',
        uri: 'file:///book.epub',
      });

      const bookmark = await createBookmark(repo, {
        bookId: 'book-1',
        locator: { format: 'epub', href: 'ch1' },
      });

      await removeBookmark(repo, bookmark.id, 'book-1');

      const bookmarks = await listBookmarks(repo, 'book-1');
      expect(bookmarks).toHaveLength(0);
    });

    it('does not affect other books bookmarks', async () => {
      const repo = createRepo();
      await importBook(repo, {
        id: 'book-1',
        title: 'Book 1',
        format: 'epub',
        uri: 'file:///book1.epub',
      });
      await importBook(repo, {
        id: 'book-2',
        title: 'Book 2',
        format: 'epub',
        uri: 'file:///book2.epub',
      });

      const bm1 = await createBookmark(repo, {
        bookId: 'book-1',
        locator: { format: 'epub', href: 'ch1' },
      });
      await createBookmark(repo, {
        bookId: 'book-2',
        locator: { format: 'epub', href: 'ch1' },
      });

      await removeBookmark(repo, bm1.id, 'book-1');

      const bookmarks2 = await listBookmarks(repo, 'book-2');
      expect(bookmarks2).toHaveLength(1);
    });

    it('throws BookmarkNotFoundError for nonexistent bookmark', async () => {
      const repo = createRepo();
      await importBook(repo, {
        id: 'book-1',
        title: 'My Book',
        format: 'epub',
        uri: 'file:///book.epub',
      });

      await expect(removeBookmark(repo, 'nonexistent', 'book-1')).rejects.toBeInstanceOf(
        BookmarkNotFoundError,
      );
    });
  });
});
