import { describe, expect, it } from 'vitest';

import { InMemoryKeyValueStore, LocalRepository } from '@clio-reader/storage';
import { importBook } from '@clio-reader/library';

import {
  createBookmarkManaged,
  listBookmarksManaged,
  removeBookmarkManaged,
  getBookmarkById,
  hasBookmarkAtLocator,
  locatorsEqual,
} from '../src/bookmark-manager.js';
import { DuplicateLocatorError } from '../src/errors.js';

function createRepo(): LocalRepository {
  return new LocalRepository(new InMemoryKeyValueStore());
}

async function setupBook(repo: LocalRepository): Promise<void> {
  await importBook(repo, {
    id: 'book-1',
    title: 'My Book',
    format: 'epub',
    uri: 'file:///book.epub',
  });
}

describe('BookmarkManager', () => {
  describe('createBookmarkManaged', () => {
    it('creates a bookmark with validation', async () => {
      const repo = createRepo();
      await setupBook(repo);

      const bookmark = await createBookmarkManaged(repo, 'book-1', {
        format: 'epub',
        href: 'chapter1.xhtml',
      });

      expect(bookmark.id).toBeTypeOf('string');
      expect(bookmark.bookId).toBe('book-1');
      expect(bookmark.createdAt).toBeTypeOf('number');
    });

    it('creates a bookmark with label', async () => {
      const repo = createRepo();
      await setupBook(repo);

      const bookmark = await createBookmarkManaged(
        repo,
        'book-1',
        {
          format: 'epub',
          href: 'chapter1.xhtml',
        },
        { label: 'Chapter 1' },
      );

      expect(bookmark.label).toBe('Chapter 1');
    });

    it('rejects duplicate locators', async () => {
      const repo = createRepo();
      await setupBook(repo);

      await createBookmarkManaged(repo, 'book-1', {
        format: 'epub',
        href: 'chapter1.xhtml',
      });

      await expect(
        createBookmarkManaged(repo, 'book-1', {
          format: 'epub',
          href: 'chapter1.xhtml',
        }),
      ).rejects.toBeInstanceOf(DuplicateLocatorError);
    });

    it('allows different locators', async () => {
      const repo = createRepo();
      await setupBook(repo);

      const bm1 = await createBookmarkManaged(repo, 'book-1', {
        format: 'epub',
        href: 'chapter1.xhtml',
      });
      const bm2 = await createBookmarkManaged(repo, 'book-1', {
        format: 'epub',
        href: 'chapter2.xhtml',
      });

      expect(bm1.id).not.toBe(bm2.id);
    });

    it('rejects empty bookId', async () => {
      const repo = createRepo();

      await expect(
        createBookmarkManaged(repo, '', {
          format: 'epub',
          href: 'chapter1.xhtml',
        }),
      ).rejects.toThrow();
    });
  });

  describe('listBookmarksManaged', () => {
    it('returns empty array when no bookmarks exist', async () => {
      const repo = createRepo();
      await setupBook(repo);

      const bookmarks = await listBookmarksManaged(repo, 'book-1');
      expect(bookmarks).toEqual([]);
    });

    it('returns all bookmarks', async () => {
      const repo = createRepo();
      await setupBook(repo);

      await createBookmarkManaged(repo, 'book-1', { format: 'epub', href: 'ch1' });
      await createBookmarkManaged(repo, 'book-1', { format: 'epub', href: 'ch2' });

      const bookmarks = await listBookmarksManaged(repo, 'book-1');
      expect(bookmarks).toHaveLength(2);
    });

    it('filters by date range', async () => {
      const repo = createRepo();
      await setupBook(repo);

      await createBookmarkManaged(repo, 'book-1', { format: 'epub', href: 'ch1' });
      await createBookmarkManaged(repo, 'book-1', { format: 'epub', href: 'ch2' });

      const now = Date.now();
      const bookmarks = await listBookmarksManaged(repo, 'book-1', {
        filter: { dateRange: { start: now - 1000 } },
      });
      expect(bookmarks).toHaveLength(2);
    });

    it('sorts by date ascending', async () => {
      const repo = createRepo();
      await setupBook(repo);

      await createBookmarkManaged(repo, 'book-1', { format: 'epub', href: 'ch1' });
      await createBookmarkManaged(repo, 'book-1', { format: 'epub', href: 'ch2' });

      const bookmarks = await listBookmarksManaged(repo, 'book-1', {
        sort: { field: 'date', order: 'asc' },
      });
      expect(bookmarks).toHaveLength(2);
    });
  });

  describe('removeBookmarkManaged', () => {
    it('removes a bookmark', async () => {
      const repo = createRepo();
      await setupBook(repo);

      const bookmark = await createBookmarkManaged(repo, 'book-1', {
        format: 'epub',
        href: 'ch1',
      });
      await removeBookmarkManaged(repo, bookmark.id, 'book-1');

      const bookmarks = await listBookmarksManaged(repo, 'book-1');
      expect(bookmarks).toHaveLength(0);
    });
  });

  describe('getBookmarkById', () => {
    it('returns the bookmark when it exists', async () => {
      const repo = createRepo();
      await setupBook(repo);

      const created = await createBookmarkManaged(repo, 'book-1', {
        format: 'epub',
        href: 'ch1',
      });
      const found = await getBookmarkById(repo, created.id, 'book-1');
      expect(found.id).toBe(created.id);
    });

    it('throws when bookmark does not exist', async () => {
      const repo = createRepo();
      await setupBook(repo);

      await expect(getBookmarkById(repo, 'nonexistent', 'book-1')).rejects.toThrow();
    });
  });

  describe('hasBookmarkAtLocator', () => {
    it('returns true when bookmark exists at locator', async () => {
      const repo = createRepo();
      await setupBook(repo);

      await createBookmarkManaged(repo, 'book-1', {
        format: 'epub',
        href: 'ch1',
      });

      const has = await hasBookmarkAtLocator(repo, 'book-1', {
        format: 'epub',
        href: 'ch1',
      });
      expect(has).toBe(true);
    });

    it('returns false when no bookmark at locator', async () => {
      const repo = createRepo();
      await setupBook(repo);

      const has = await hasBookmarkAtLocator(repo, 'book-1', {
        format: 'epub',
        href: 'ch1',
      });
      expect(has).toBe(false);
    });
  });

  describe('locatorsEqual', () => {
    it('returns true for identical epub locators', () => {
      const a = { format: 'epub' as const, href: 'ch1' };
      const b = { format: 'epub' as const, href: 'ch1' };
      expect(locatorsEqual(a, b)).toBe(true);
    });

    it('returns false for different epub locators', () => {
      const a = { format: 'epub' as const, href: 'ch1' };
      const b = { format: 'epub' as const, href: 'ch2' };
      expect(locatorsEqual(a, b)).toBe(false);
    });

    it('returns false for different formats', () => {
      const a = { format: 'epub' as const, href: 'ch1' };
      const b = { format: 'pdf' as const, page: 1 };
      expect(locatorsEqual(a, b)).toBe(false);
    });

    it('returns true for identical pdf locators', () => {
      const a = { format: 'pdf' as const, page: 5 };
      const b = { format: 'pdf' as const, page: 5 };
      expect(locatorsEqual(a, b)).toBe(true);
    });
  });
});
