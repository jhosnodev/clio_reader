import type { Note, ReaderLocator } from '@clio-reader/domain';

import { BookNotFoundError, NoteNotFoundError } from './errors.js';
import { generateId } from './id.js';
import type { LibraryRepository } from './repository.js';

export interface CreateNoteInput {
  readonly bookId: string;
  readonly locator: ReaderLocator;
  readonly body: string;
  readonly selectedText?: string;
}

export interface UpdateNoteInput {
  readonly noteId: string;
  readonly bookId: string;
  readonly body?: string;
  readonly locator?: ReaderLocator;
  readonly selectedText?: string;
}

export async function createNote(repo: LibraryRepository, input: CreateNoteInput): Promise<Note> {
  const books = await repo.listBooks();
  const exists = books.some((b) => b.id === input.bookId);

  if (!exists) {
    throw new BookNotFoundError(input.bookId);
  }

  const now = Date.now();
  const note: Note = {
    id: generateId(),
    bookId: input.bookId,
    locator: input.locator,
    body: input.body,
    createdAt: now,
    updatedAt: now,
    ...(input.selectedText !== undefined ? { selectedText: input.selectedText } : {}),
  };

  await repo.saveNote(note);
  return note;
}

export async function listNotes(repo: LibraryRepository, bookId: string): Promise<readonly Note[]> {
  return repo.listNotes(bookId);
}

export async function updateNote(repo: LibraryRepository, input: UpdateNoteInput): Promise<Note> {
  const notes = await repo.listNotes(input.bookId);
  const existing = notes.find((n) => n.id === input.noteId);

  if (!existing) {
    throw new NoteNotFoundError(input.noteId);
  }

  const updated: Note = {
    ...existing,
    body: input.body ?? existing.body,
    locator: input.locator ?? existing.locator,
    updatedAt: Date.now(),
    ...(input.selectedText !== undefined
      ? { selectedText: input.selectedText }
      : existing.selectedText !== undefined
        ? { selectedText: existing.selectedText }
        : {}),
  };

  await repo.saveNote(updated);
  return updated;
}

export async function removeNote(
  repo: LibraryRepository,
  noteId: string,
  bookId: string,
): Promise<void> {
  const notes = await repo.listNotes(bookId);
  const exists = notes.some((n) => n.id === noteId);

  if (!exists) {
    throw new NoteNotFoundError(noteId);
  }

  await repo.removeNote(noteId);
}
