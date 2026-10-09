import { describe, expect, it } from 'vitest';

import { InMemoryKeyValueStore, LocalRepository } from '@clio-reader/storage';
import { importBook } from '@clio-reader/library';

import {
  createHighlightManaged,
  listHighlightsManaged,
  removeHighlightManaged,
} from '../src/highlight-manager.js';
import { HIGHLIGHT_COLORS } from '../src/highlight-colors.js';
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

const locator = {
  format: 'epub',
  href: 'chapter1.xhtml',
  anchor: { start: 10, end: 30, prefix: 'before ', suffix: ' after' },
} as const;

describe('HighlightManager', () => {
  describe('createHighlightManaged', () => {
    it('creates a highlight with a palette color', async () => {
      const repo = createRepo();
      await setupBook(repo);

      const highlight = await createHighlightManaged(
        repo,
        'book-1',
        locator,
        HIGHLIGHT_COLORS.blue,
        {
          selectedText: 'selected words',
        },
      );

      expect(highlight.id).toBeTypeOf('string');
      expect(highlight.bookId).toBe('book-1');
      expect(highlight.color).toBe(HIGHLIGHT_COLORS.blue);
      expect(highlight.style).toBe('highlight');
      expect(highlight.selectedText).toBe('selected words');
      expect(highlight.locatorStart).toEqual(locator);
      expect(highlight.locatorEnd).toEqual(locator);
    });

    it('creates an underline highlight', async () => {
      const repo = createRepo();
      await setupBook(repo);

      const highlight = await createHighlightManaged(
        repo,
        'book-1',
        locator,
        HIGHLIGHT_COLORS.pink,
        { style: 'underline' },
      );

      expect(highlight.style).toBe('underline');
    });

    it('works without selectedText', async () => {
      const repo = createRepo();
      await setupBook(repo);

      const highlight = await createHighlightManaged(
        repo,
        'book-1',
        { format: 'epub', href: 'chapter1.xhtml' },
        HIGHLIGHT_COLORS.green,
      );

      expect(highlight.selectedText).toBeUndefined();
    });

    it('rejects color outside the palette', async () => {
      const repo = createRepo();
      await setupBook(repo);

      await expect(createHighlightManaged(repo, 'book-1', locator, '#123456')).rejects.toThrow(
        AnnotationValidationError,
      );
    });

    it('rejects unknown book', async () => {
      const repo = createRepo();

      await expect(
        createHighlightManaged(repo, 'missing', locator, HIGHLIGHT_COLORS.yellow),
      ).rejects.toThrow('Book not found');
    });
  });

  describe('listHighlightsManaged', () => {
    it('returns saved highlights for the book', async () => {
      const repo = createRepo();
      await setupBook(repo);
      await createHighlightManaged(repo, 'book-1', locator, HIGHLIGHT_COLORS.orange);

      const highlights = await listHighlightsManaged(repo, 'book-1');
      expect(highlights).toHaveLength(1);
      expect(highlights[0]?.color).toBe(HIGHLIGHT_COLORS.orange);
    });

    it('returns empty list when there are none', async () => {
      const repo = createRepo();
      await setupBook(repo);

      expect(await listHighlightsManaged(repo, 'book-1')).toHaveLength(0);
    });
  });

  describe('removeHighlightManaged', () => {
    it('removes an existing highlight', async () => {
      const repo = createRepo();
      await setupBook(repo);
      const highlight = await createHighlightManaged(
        repo,
        'book-1',
        locator,
        HIGHLIGHT_COLORS.purple,
      );

      await removeHighlightManaged(repo, highlight.id, 'book-1');

      expect(await listHighlightsManaged(repo, 'book-1')).toHaveLength(0);
    });

    it('throws when highlight does not exist', async () => {
      const repo = createRepo();
      await setupBook(repo);

      await expect(removeHighlightManaged(repo, 'nope', 'book-1')).rejects.toThrow(
        'Highlight not found',
      );
    });
  });
});
