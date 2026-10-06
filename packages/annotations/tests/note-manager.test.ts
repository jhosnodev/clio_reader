import { describe, expect, it } from 'vitest';

import { InMemoryKeyValueStore, LocalRepository } from '@clio-reader/storage';
import { importBook } from '@clio-reader/library';

import {
  createNoteManaged,
  listNotesManaged,
  updateNoteManaged,
  removeNoteManaged,
  searchNotes,
  hasNoteAtLocator,
} from '../src/note-manager.js';
import { AnnotationValidationError } from '../src/errors.js';

function anchorOf(locator: unknown): unknown {
  const loc = locator as { format?: string; anchor?: unknown };
  return loc.format === 'epub' ? loc.anchor : undefined;
}

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

describe('NoteManager', () => {
  describe('createNoteManaged', () => {
    it('creates a note with validation', async () => {
      const repo = createRepo();
      await setupBook(repo);

      const note = await createNoteManaged(
        repo,
        'book-1',
        {
          format: 'epub',
          href: 'chapter1.xhtml',
        },
        'This is a note',
      );

      expect(note.id).toBeTypeOf('string');
      expect(note.bookId).toBe('book-1');
      expect(note.body).toBe('This is a note');
      expect(note.createdAt).toBeTypeOf('number');
    });

    it('creates a note with selectedText', async () => {
      const repo = createRepo();
      await setupBook(repo);

      const note = await createNoteManaged(
        repo,
        'book-1',
        {
          format: 'epub',
          href: 'chapter1.xhtml',
        },
        'My note',
        { selectedText: 'Selected text' },
      );

      expect(note.selectedText).toBe('Selected text');
    });

    it('creates a note anchored to selected text', async () => {
      const repo = createRepo();
      await setupBook(repo);

      const note = await createNoteManaged(
        repo,
        'book-1',
        {
          format: 'epub',
          href: 'chapter1.xhtml',
          anchor: { start: 120, end: 134, prefix: 'digo que ', suffix: ' y luego' },
        },
        'My note',
        { selectedText: 'texto anudado' },
      );

      expect(note.selectedText).toBe('texto anudado');
      expect(anchorOf(note.locator)).toEqual({
        start: 120,
        end: 134,
        prefix: 'digo que ',
        suffix: ' y luego',
      });
    });

    it('rejects an anchor with end before start', async () => {
      const repo = createRepo();
      await setupBook(repo);

      await expect(
        createNoteManaged(
          repo,
          'book-1',
          {
            format: 'epub',
            href: 'chapter1.xhtml',
            anchor: { start: 40, end: 10 },
          },
          'My note',
          { selectedText: 'texto' },
        ),
      ).rejects.toThrow(AnnotationValidationError);
    });

    it('rejects an anchor with negative offsets', async () => {
      const repo = createRepo();
      await setupBook(repo);

      await expect(
        createNoteManaged(
          repo,
          'book-1',
          {
            format: 'epub',
            href: 'chapter1.xhtml',
            anchor: { start: -5, end: 10 },
          },
          'My note',
          { selectedText: 'texto' },
        ),
      ).rejects.toThrow(/locator\.anchor\.start/);
    });

    it('rejects empty body', async () => {
      const repo = createRepo();
      await setupBook(repo);

      await expect(
        createNoteManaged(
          repo,
          'book-1',
          {
            format: 'epub',
            href: 'chapter1.xhtml',
          },
          '',
        ),
      ).rejects.toThrow();
    });

    it('rejects empty bookId', async () => {
      const repo = createRepo();

      await expect(
        createNoteManaged(
          repo,
          '',
          {
            format: 'epub',
            href: 'chapter1.xhtml',
          },
          'Note text',
        ),
      ).rejects.toThrow();
    });
  });

  describe('listNotesManaged', () => {
    it('returns empty array when no notes exist', async () => {
      const repo = createRepo();
      await setupBook(repo);

      const notes = await listNotesManaged(repo, 'book-1');
      expect(notes).toEqual([]);
    });

    it('returns all notes', async () => {
      const repo = createRepo();
      await setupBook(repo);

      await createNoteManaged(repo, 'book-1', { format: 'epub', href: 'ch1' }, 'Note 1');
      await createNoteManaged(repo, 'book-1', { format: 'epub', href: 'ch2' }, 'Note 2');

      const notes = await listNotesManaged(repo, 'book-1');
      expect(notes).toHaveLength(2);
    });

    it('filters by date range', async () => {
      const repo = createRepo();
      await setupBook(repo);

      await createNoteManaged(repo, 'book-1', { format: 'epub', href: 'ch1' }, 'Note 1');
      await createNoteManaged(repo, 'book-1', { format: 'epub', href: 'ch2' }, 'Note 2');

      const now = Date.now();
      const notes = await listNotesManaged(repo, 'book-1', {
        filter: { dateRange: { start: now - 1000 } },
      });
      expect(notes).toHaveLength(2);
    });
  });

  describe('updateNoteManaged', () => {
    it('updates the note body', async () => {
      const repo = createRepo();
      await setupBook(repo);

      const note = await createNoteManaged(
        repo,
        'book-1',
        {
          format: 'epub',
          href: 'ch1',
        },
        'Original',
      );

      const updated = await updateNoteManaged(repo, note.id, 'book-1', 'Updated');
      expect(updated.body).toBe('Updated');
      expect(updated.updatedAt).toBeGreaterThanOrEqual(note.updatedAt);
    });

    it('throws for nonexistent note', async () => {
      const repo = createRepo();
      await setupBook(repo);

      await expect(updateNoteManaged(repo, 'nonexistent', 'book-1', 'Updated')).rejects.toThrow();
    });

    it('rejects empty body with typed error', async () => {
      const repo = createRepo();
      await setupBook(repo);

      const note = await createNoteManaged(
        repo,
        'book-1',
        {
          format: 'epub',
          href: 'ch1',
        },
        'Original',
      );

      const promise = updateNoteManaged(repo, note.id, 'book-1', '');
      await expect(promise).rejects.toMatchObject({
        name: 'AnnotationValidationError',
        field: 'body',
      });
    });
  });

  describe('removeNoteManaged', () => {
    it('removes a note', async () => {
      const repo = createRepo();
      await setupBook(repo);

      const note = await createNoteManaged(
        repo,
        'book-1',
        {
          format: 'epub',
          href: 'ch1',
        },
        'Note to remove',
      );
      await removeNoteManaged(repo, note.id, 'book-1');

      const notes = await listNotesManaged(repo, 'book-1');
      expect(notes).toHaveLength(0);
    });
  });

  describe('searchNotes', () => {
    it('finds notes by body text', async () => {
      const repo = createRepo();
      await setupBook(repo);

      await createNoteManaged(repo, 'book-1', { format: 'epub', href: 'ch1' }, 'Important note');
      await createNoteManaged(repo, 'book-1', { format: 'epub', href: 'ch2' }, 'Other note');

      const results = await searchNotes(repo, 'book-1', 'Important');
      expect(results).toHaveLength(1);
      expect(results[0]!.body).toBe('Important note');
    });

    it('finds notes by selectedText', async () => {
      const repo = createRepo();
      await setupBook(repo);

      await createNoteManaged(repo, 'book-1', { format: 'epub', href: 'ch1' }, 'Note text', {
        selectedText: 'Selected passage',
      });

      const results = await searchNotes(repo, 'book-1', 'Selected');
      expect(results).toHaveLength(1);
    });

    it('returns empty for no matches', async () => {
      const repo = createRepo();
      await setupBook(repo);

      await createNoteManaged(repo, 'book-1', { format: 'epub', href: 'ch1' }, 'Note text');

      const results = await searchNotes(repo, 'book-1', 'Nonexistent');
      expect(results).toEqual([]);
    });

    it('is case-insensitive', async () => {
      const repo = createRepo();
      await setupBook(repo);

      await createNoteManaged(repo, 'book-1', { format: 'epub', href: 'ch1' }, 'Important Note');

      const results = await searchNotes(repo, 'book-1', 'important');
      expect(results).toHaveLength(1);
    });

    it('returns empty for empty query', async () => {
      const repo = createRepo();
      await setupBook(repo);

      await createNoteManaged(repo, 'book-1', { format: 'epub', href: 'ch1' }, 'Note text');

      const results = await searchNotes(repo, 'book-1', '');
      expect(results).toEqual([]);
    });
  });

  describe('hasNoteAtLocator', () => {
    it('returns true when note exists at locator', async () => {
      const repo = createRepo();
      await setupBook(repo);

      await createNoteManaged(repo, 'book-1', { format: 'epub', href: 'ch1' }, 'Note');

      const has = await hasNoteAtLocator(repo, 'book-1', {
        format: 'epub',
        href: 'ch1',
      });
      expect(has).toBe(true);
    });

    it('returns false when no note at locator', async () => {
      const repo = createRepo();
      await setupBook(repo);

      const has = await hasNoteAtLocator(repo, 'book-1', {
        format: 'epub',
        href: 'ch1',
      });
      expect(has).toBe(false);
    });
  });
});
