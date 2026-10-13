import { describe, expect, it } from 'vitest';

import type { Bookmark, Highlight, Note } from '@clio-reader/domain';

import {
  exportAnnotationsToMarkdown,
  importAnnotationsFromMarkdown,
  readAnnotationMarkdownMeta,
} from '../src/annotation-markdown.js';

const TS = 1_700_000_000_000;

function buildData(bookId: string): {
  bookId: string;
  bookmarks: Bookmark[];
  notes: Note[];
  highlights: Highlight[];
  exportedAt: number;
} {
  const bookmarks: Bookmark[] = [
    {
      id: 'bm-1',
      bookId,
      locator: { format: 'epub', href: 'ch1', progression: 0.1 },
      label: 'Inicio',
      createdAt: TS,
    },
  ];
  const notes: Note[] = [
    {
      id: 'note-1',
      bookId,
      locator: { format: 'epub', href: 'ch1', progression: 0.2, anchor: { start: 10, end: 20 } },
      selectedText: 'texto seleccionado',
      body: 'Mi nota',
      createdAt: TS,
      updatedAt: TS,
    },
  ];
  const highlights: Highlight[] = [
    {
      id: 'hl-1',
      bookId,
      locatorStart: { format: 'epub', href: 'ch1', progression: 0.3, anchor: { start: 30, end: 40 } },
      locatorEnd: { format: 'epub', href: 'ch1', progression: 0.3, anchor: { start: 30, end: 40 } },
      selectedText: 'fragmento resaltado',
      color: '#facc15',
      style: 'highlight',
      createdAt: TS,
      updatedAt: TS,
    },
  ];
  return { bookId, bookmarks, notes, highlights, exportedAt: TS };
}

describe('AnnotationMarkdown', () => {
  describe('readAnnotationMarkdownMeta', () => {
    it('parses frontmatter metadata', () => {
      const md = exportAnnotationsToMarkdown(buildData('book-1'), {
        bookTitle: 'Mi "Libro"',
        bookFormat: 'epub',
        fileHash: 'hash-abc',
      });

      const meta = readAnnotationMarkdownMeta(md);
      expect(meta.version).toBe(1);
      expect(meta.bookId).toBe('book-1');
      expect(meta.bookTitle).toBe('Mi "Libro"');
      expect(meta.bookFormat).toBe('epub');
      expect(meta.fileHash).toBe('hash-abc');
    });

    it('returns nulls when there is no frontmatter', () => {
      const meta = readAnnotationMarkdownMeta('# Notas sueltas\n\nSin frontmatter.');
      expect(meta.version).toBeNull();
      expect(meta.bookId).toBeNull();
      expect(meta.fileHash).toBeNull();
    });
  });

  describe('round-trip', () => {
    it('exports and reimports all annotation kinds into the same book', () => {
      const md = exportAnnotationsToMarkdown(buildData('book-1'), { bookTitle: 'Libro' });
      const { data, result, meta } = importAnnotationsFromMarkdown(md, 'book-1');

      expect(meta.bookId).toBe('book-1');
      expect(result.bookmarksImported).toBe(1);
      expect(result.notesImported).toBe(1);
      expect(result.highlightsImported).toBe(1);

      const d = data as { bookmarks: Bookmark[]; notes: Note[]; highlights: Highlight[] };
      expect(d.bookmarks).toHaveLength(1);
      expect(d.notes).toHaveLength(1);
      expect(d.highlights).toHaveLength(1);
      for (const item of [...d.bookmarks, ...d.notes, ...d.highlights]) {
        expect(item.bookId).toBe('book-1');
      }
    });
  });

  describe('mismatched file fallback', () => {
    it('remaps every annotation to the target book when file bookId differs', () => {
      const md = exportAnnotationsToMarkdown(buildData('other-book'), {
        bookTitle: 'Otro',
        fileHash: 'hash-xyz',
      });

      const { data, result, meta } = importAnnotationsFromMarkdown(md, 'target-book');

      expect(meta.bookId).toBe('other-book');
      expect(result.notesImported).toBe(1);
      expect(result.highlightsImported).toBe(1);
      expect(result.bookmarksImported).toBe(1);

      const d = data as { bookId: string; bookmarks: Bookmark[]; notes: Note[]; highlights: Highlight[] };
      expect(d.bookId).toBe('target-book');
      for (const item of [...d.bookmarks, ...d.notes, ...d.highlights]) {
        expect(item.bookId).toBe('target-book');
      }
    });

    it('returns an empty result for a file without clio blocks', () => {
      const { result, meta } = importAnnotationsFromMarkdown('# Nada\n\nTexto plano.', 'book-1');
      expect(result.bookmarksImported).toBe(0);
      expect(result.notesImported).toBe(0);
      expect(result.highlightsImported).toBe(0);
      expect(meta.version).toBeNull();
    });
  });
});
