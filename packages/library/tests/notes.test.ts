import { describe, expect, it } from 'vitest';

import { InMemoryKeyValueStore, LocalRepository } from '@clio-reader/storage';

import { BookNotFoundError, NoteNotFoundError } from '../src/errors.js';
import { importBook } from '../src/import-book.js';
import { createNote, listNotes, updateNote, removeNote } from '../src/notes.js';

function createRepo(): LocalRepository {
  return new LocalRepository(new InMemoryKeyValueStore());
}

describe('notes', () => {
  describe('createNote', () => {
    it('creates a note with generated id and timestamps', async () => {
      const repo = createRepo();
      await importBook(repo, {
        id: 'book-1',
        title: 'My Book',
        format: 'epub',
        uri: 'file:///book.epub',
      });

      const note = await createNote(repo, {
        bookId: 'book-1',
        locator: { format: 'epub', href: 'chapter1.xhtml' },
        body: 'Important passage',
        selectedText: 'some text',
      });

      expect(note.id).toBeTypeOf('string');
      expect(note.id.length).toBeGreaterThan(0);
      expect(note.bookId).toBe('book-1');
      expect(note.body).toBe('Important passage');
      expect(note.selectedText).toBe('some text');
      expect(note.createdAt).toBeTypeOf('number');
      expect(note.updatedAt).toBe(note.createdAt);
    });

    it('persists the note in the repository', async () => {
      const repo = createRepo();
      await importBook(repo, {
        id: 'book-1',
        title: 'My Book',
        format: 'epub',
        uri: 'file:///book.epub',
      });

      const created = await createNote(repo, {
        bookId: 'book-1',
        locator: { format: 'epub', href: 'ch1' },
        body: 'My note',
      });

      const notes = await listNotes(repo, 'book-1');
      expect(notes).toHaveLength(1);
      expect(notes[0]!.id).toBe(created.id);
    });

    it('throws BookNotFoundError for nonexistent book', async () => {
      const repo = createRepo();

      await expect(
        createNote(repo, {
          bookId: 'nonexistent',
          locator: { format: 'epub', href: 'ch1' },
          body: 'My note',
        }),
      ).rejects.toBeInstanceOf(BookNotFoundError);
    });

    it('rejects empty body via storage validation', async () => {
      const repo = createRepo();
      await importBook(repo, {
        id: 'book-1',
        title: 'My Book',
        format: 'epub',
        uri: 'file:///book.epub',
      });

      await expect(
        createNote(repo, {
          bookId: 'book-1',
          locator: { format: 'epub', href: 'ch1' },
          body: '',
        }),
      ).rejects.toThrow();
    });
  });

  describe('listNotes', () => {
    it('returns empty array when no notes exist', async () => {
      const repo = createRepo();
      const notes = await listNotes(repo, 'book-1');
      expect(notes).toEqual([]);
    });

    it('returns only notes for the specified book', async () => {
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

      await createNote(repo, {
        bookId: 'book-1',
        locator: { format: 'epub', href: 'ch1' },
        body: 'Note 1',
      });
      await createNote(repo, {
        bookId: 'book-2',
        locator: { format: 'epub', href: 'ch1' },
        body: 'Note 2',
      });

      const notes1 = await listNotes(repo, 'book-1');
      const notes2 = await listNotes(repo, 'book-2');

      expect(notes1).toHaveLength(1);
      expect(notes1[0]!.bookId).toBe('book-1');
      expect(notes2).toHaveLength(1);
      expect(notes2[0]!.bookId).toBe('book-2');
    });

    it('returns multiple notes per book', async () => {
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
        body: 'First note',
      });
      await createNote(repo, {
        bookId: 'book-1',
        locator: { format: 'epub', href: 'ch2' },
        body: 'Second note',
      });

      const notes = await listNotes(repo, 'book-1');
      expect(notes).toHaveLength(2);
    });
  });

  describe('updateNote', () => {
    it('updates the note body and updatedAt', async () => {
      const repo = createRepo();
      await importBook(repo, {
        id: 'book-1',
        title: 'My Book',
        format: 'epub',
        uri: 'file:///book.epub',
      });

      const created = await createNote(repo, {
        bookId: 'book-1',
        locator: { format: 'epub', href: 'ch1' },
        body: 'Original',
      });

      const updated = await updateNote(repo, {
        noteId: created.id,
        bookId: 'book-1',
        body: 'Updated',
      });

      expect(updated.body).toBe('Updated');
      expect(updated.updatedAt).toBeGreaterThanOrEqual(created.updatedAt);
      expect(updated.createdAt).toBe(created.createdAt);
    });

    it('updates the locator when provided', async () => {
      const repo = createRepo();
      await importBook(repo, {
        id: 'book-1',
        title: 'My Book',
        format: 'epub',
        uri: 'file:///book.epub',
      });

      const created = await createNote(repo, {
        bookId: 'book-1',
        locator: { format: 'epub', href: 'ch1' },
        body: 'My note',
      });

      const updated = await updateNote(repo, {
        noteId: created.id,
        bookId: 'book-1',
        locator: { format: 'epub', href: 'ch2' },
      });

      expect(updated.locator).toEqual({ format: 'epub', href: 'ch2' });
    });

    it('preserves unchanged fields', async () => {
      const repo = createRepo();
      await importBook(repo, {
        id: 'book-1',
        title: 'My Book',
        format: 'epub',
        uri: 'file:///book.epub',
      });

      const created = await createNote(repo, {
        bookId: 'book-1',
        locator: { format: 'epub', href: 'ch1' },
        body: 'Original',
        selectedText: 'selected',
      });

      const updated = await updateNote(repo, {
        noteId: created.id,
        bookId: 'book-1',
        body: 'Updated',
      });

      expect(updated.selectedText).toBe('selected');
      expect(updated.bookId).toBe('book-1');
    });

    it('throws NoteNotFoundError for nonexistent note', async () => {
      const repo = createRepo();
      await importBook(repo, {
        id: 'book-1',
        title: 'My Book',
        format: 'epub',
        uri: 'file:///book.epub',
      });

      await expect(
        updateNote(repo, {
          noteId: 'nonexistent',
          bookId: 'book-1',
          body: 'Updated',
        }),
      ).rejects.toBeInstanceOf(NoteNotFoundError);
    });
  });

  describe('removeNote', () => {
    it('removes the note', async () => {
      const repo = createRepo();
      await importBook(repo, {
        id: 'book-1',
        title: 'My Book',
        format: 'epub',
        uri: 'file:///book.epub',
      });

      const note = await createNote(repo, {
        bookId: 'book-1',
        locator: { format: 'epub', href: 'ch1' },
        body: 'My note',
      });

      await removeNote(repo, note.id, 'book-1');

      const notes = await listNotes(repo, 'book-1');
      expect(notes).toHaveLength(0);
    });

    it('does not affect other books notes', async () => {
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

      const n1 = await createNote(repo, {
        bookId: 'book-1',
        locator: { format: 'epub', href: 'ch1' },
        body: 'Note 1',
      });
      await createNote(repo, {
        bookId: 'book-2',
        locator: { format: 'epub', href: 'ch1' },
        body: 'Note 2',
      });

      await removeNote(repo, n1.id, 'book-1');

      const notes2 = await listNotes(repo, 'book-2');
      expect(notes2).toHaveLength(1);
    });

    it('throws NoteNotFoundError for nonexistent note', async () => {
      const repo = createRepo();
      await importBook(repo, {
        id: 'book-1',
        title: 'My Book',
        format: 'epub',
        uri: 'file:///book.epub',
      });

      await expect(removeNote(repo, 'nonexistent', 'book-1')).rejects.toBeInstanceOf(
        NoteNotFoundError,
      );
    });
  });
});
