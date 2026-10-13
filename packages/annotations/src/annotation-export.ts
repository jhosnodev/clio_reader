import type { Bookmark, Highlight, Note } from '@clio-reader/domain';

import { AnnotationValidationError } from './errors.js';
import {
  validateBookmarkForExport,
  validateHighlightForExport,
  validateNoteForExport,
} from './annotation-validator.js';

export interface AnnotationExportData {
  readonly version: 1;
  readonly bookId: string;
  readonly bookmarks: readonly Bookmark[];
  readonly notes: readonly Note[];
  readonly highlights: readonly Highlight[];
  readonly exportedAt: number;
}

export async function exportAnnotations(
  repo: {
    listBookmarks(bookId: string): Promise<readonly Bookmark[]>;
    listNotes(bookId: string): Promise<readonly Note[]>;
    listHighlights(bookId: string): Promise<readonly Highlight[]>;
  },
  bookId: string,
): Promise<AnnotationExportData> {
  const [bookmarks, notes, highlights] = await Promise.all([
    repo.listBookmarks(bookId),
    repo.listNotes(bookId),
    repo.listHighlights(bookId),
  ]);

  return {
    version: 1,
    bookId,
    bookmarks,
    notes,
    highlights,
    exportedAt: Date.now(),
  };
}

export async function importAnnotations(
  repo: {
    listBookmarks(bookId: string): Promise<readonly Bookmark[]>;
    saveBookmark(bookmark: Bookmark): Promise<void>;
    listNotes(bookId: string): Promise<readonly Note[]>;
    saveNote(note: Note): Promise<void>;
    listHighlights(bookId: string): Promise<readonly Highlight[]>;
    saveHighlight(highlight: Highlight): Promise<void>;
  },
  bookId: string,
  data: unknown,
): Promise<{ bookmarksImported: number; notesImported: number; highlightsImported: number }> {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new AnnotationValidationError('Import data must be an object');
  }

  const obj = data as Record<string, unknown>;

  if (obj['version'] !== 1) {
    throw new AnnotationValidationError('Unsupported import version. Expected version: 1');
  }

  if (typeof obj['bookId'] !== 'string' || obj['bookId'].trim().length === 0) {
    throw new AnnotationValidationError('Import data must have a valid bookId');
  }

  if (obj['bookId'] !== bookId) {
    throw new AnnotationValidationError(
      `Import data bookId (${obj['bookId']}) does not match target bookId (${bookId})`,
    );
  }

  const bookmarks = obj['bookmarks'];
  const notes = obj['notes'];
  const highlights = obj['highlights'];

  if (!Array.isArray(bookmarks)) {
    throw new AnnotationValidationError('Import data must have a bookmarks array');
  }

  if (!Array.isArray(notes)) {
    throw new AnnotationValidationError('Import data must have a notes array');
  }

  if (!Array.isArray(highlights)) {
    throw new AnnotationValidationError('Import data must have a highlights array');
  }

  for (const [index, bookmark] of bookmarks.entries()) {
    const result = validateBookmarkForExport(bookmark);
    if (!result.valid) {
      const messages = result.errors.map((e) => `${e.field}: ${e.message}`).join('; ');
      throw new AnnotationValidationError(`Invalid bookmark at index ${index}: ${messages}`);
    }
  }

  for (const [index, note] of notes.entries()) {
    const result = validateNoteForExport(note);
    if (!result.valid) {
      const messages = result.errors.map((e) => `${e.field}: ${e.message}`).join('; ');
      throw new AnnotationValidationError(`Invalid note at index ${index}: ${messages}`);
    }
  }

  for (const [index, highlight] of highlights.entries()) {
    const result = validateHighlightForExport(highlight);
    if (!result.valid) {
      const messages = result.errors.map((e) => `${e.field}: ${e.message}`).join('; ');
      throw new AnnotationValidationError(`Invalid highlight at index ${index}: ${messages}`);
    }
  }
  const [existingBookmarks, existingNotes, existingHighlights] = await Promise.all([
    repo.listBookmarks(bookId),
    repo.listNotes(bookId),
    repo.listHighlights(bookId),
  ]);

  let bookmarksImported = 0;
  for (const bookmark of bookmarks) {
    const exists = existingBookmarks.some((b) => b.id === bookmark.id);
    if (!exists) {
      await repo.saveBookmark(bookmark as Bookmark);
      bookmarksImported++;
    }
  }

  let notesImported = 0;
  for (const note of notes) {
    const exists = existingNotes.some((n) => n.id === note.id);
    if (!exists) {
      await repo.saveNote(note as Note);
      notesImported++;
    }
  }

  let highlightsImported = 0;
  for (const highlight of highlights) {
    const exists = existingHighlights.some((h) => h.id === highlight.id);
    if (!exists) {
      await repo.saveHighlight(highlight as Highlight);
      highlightsImported++;
    }
  }

  return { bookmarksImported, notesImported, highlightsImported };
}
