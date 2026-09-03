import { describe, expect, it } from 'vitest';

import { InMemoryKeyValueStore, LocalRepository } from '@clio-reader/storage';
import { importBook } from '@clio-reader/library';

import { exportAnnotations, importAnnotations } from '../src/annotation-export.js';
import { createBookmarkManaged } from '../src/bookmark-manager.js';
import { createNoteManaged } from '../src/note-manager.js';
import { AnnotationValidationError } from '../src/errors.js';

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

describe('AnnotationExport', () => {
  describe('exportAnnotations', () => {
    it('exports empty data when no annotations exist', async () => {
      const repo = createRepo();
      await setupBook(repo);

      const data = await exportAnnotations(repo, 'book-1');
      expect(data.version).toBe(1);
      expect(data.bookId).toBe('book-1');
      expect(data.bookmarks).toHaveLength(0);
      expect(data.notes).toHaveLength(0);
      expect(data.exportedAt).toBeTypeOf('number');
    });

    it('exports bookmarks and notes', async () => {
      const repo = createRepo();
      await setupBook(repo);

      await createBookmarkManaged(repo, 'book-1', { format: 'epub', href: 'ch1' });
      await createNoteManaged(repo, 'book-1', { format: 'epub', href: 'ch1' }, 'Note text');

      const data = await exportAnnotations(repo, 'book-1');
      expect(data.bookmarks).toHaveLength(1);
      expect(data.notes).toHaveLength(1);
    });
  });

  describe('importAnnotations', () => {
    it('imports annotations successfully', async () => {
      const repo = createRepo();
      await setupBook(repo);

      const importData = {
        version: 1,
        bookId: 'book-1',
        bookmarks: [
          {
            id: 'bm-import',
            bookId: 'book-1',
            locator: { format: 'epub', href: 'ch1' },
            createdAt: Date.now(),
          },
        ],
        notes: [
          {
            id: 'note-import',
            bookId: 'book-1',
            locator: { format: 'epub', href: 'ch1' },
            body: 'Imported note',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ],
        exportedAt: Date.now(),
      };

      const result = await importAnnotations(repo, 'book-1', importData);
      expect(result.bookmarksImported).toBe(1);
      expect(result.notesImported).toBe(1);
    });

    it('skips existing annotations', async () => {
      const repo = createRepo();
      await setupBook(repo);

      const bm = await createBookmarkManaged(repo, 'book-1', { format: 'epub', href: 'ch1' });

      const importData = {
        version: 1,
        bookId: 'book-1',
        bookmarks: [bm],
        notes: [],
        exportedAt: Date.now(),
      };

      const result = await importAnnotations(repo, 'book-1', importData);
      expect(result.bookmarksImported).toBe(0);
    });

    it('rejects invalid version', async () => {
      const repo = createRepo();
      await setupBook(repo);

      const importData = {
        version: 2,
        bookId: 'book-1',
        bookmarks: [],
        notes: [],
        exportedAt: Date.now(),
      };

      await expect(importAnnotations(repo, 'book-1', importData)).rejects.toThrow(
        AnnotationValidationError,
      );
    });

    it('rejects mismatched bookId', async () => {
      const repo = createRepo();
      await setupBook(repo);

      const importData = {
        version: 1,
        bookId: 'wrong-book',
        bookmarks: [],
        notes: [],
        exportedAt: Date.now(),
      };

      await expect(importAnnotations(repo, 'book-1', importData)).rejects.toThrow(
        AnnotationValidationError,
      );
    });

    it('rejects invalid bookmark data', async () => {
      const repo = createRepo();
      await setupBook(repo);

      const importData = {
        version: 1,
        bookId: 'book-1',
        bookmarks: [
          {
            id: '',
            bookId: 'book-1',
            locator: { format: 'epub', href: 'ch1' },
            createdAt: Date.now(),
          },
        ],
        notes: [],
        exportedAt: Date.now(),
      };

      await expect(importAnnotations(repo, 'book-1', importData)).rejects.toThrow(
        AnnotationValidationError,
      );
    });

    it('rejects non-object input', async () => {
      const repo = createRepo();
      await setupBook(repo);

      await expect(importAnnotations(repo, 'book-1', 'not an object')).rejects.toThrow(
        AnnotationValidationError,
      );
    });

    it('rejects missing bookmarks array', async () => {
      const repo = createRepo();
      await setupBook(repo);

      const importData = {
        version: 1,
        bookId: 'book-1',
        notes: [],
        exportedAt: Date.now(),
      };

      await expect(importAnnotations(repo, 'book-1', importData)).rejects.toThrow(
        AnnotationValidationError,
      );
    });

    it('rejects missing notes array', async () => {
      const repo = createRepo();
      await setupBook(repo);

      const importData = {
        version: 1,
        bookId: 'book-1',
        bookmarks: [],
        exportedAt: Date.now(),
      };

      await expect(importAnnotations(repo, 'book-1', importData)).rejects.toThrow(
        AnnotationValidationError,
      );
    });
  });

  describe('round-trip export/import', () => {
    it('exports and reimports annotations', async () => {
      const repo = createRepo();
      await setupBook(repo);

      await createBookmarkManaged(repo, 'book-1', { format: 'epub', href: 'ch1' });
      await createNoteManaged(repo, 'book-1', { format: 'epub', href: 'ch1' }, 'Note text');

      const exported = await exportAnnotations(repo, 'book-1');
      const result = await importAnnotations(repo, 'book-1', exported);
      expect(result.bookmarksImported).toBe(0);
      expect(result.notesImported).toBe(0);
    });
  });
});
