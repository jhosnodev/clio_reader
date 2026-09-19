import type { Note, ReaderLocator } from '@clio-reader/domain';
import type { LibraryRepository } from '@clio-reader/library';
import { createNote, listNotes, updateNote, removeNote } from '@clio-reader/library';
import { NoteNotFoundError } from '@clio-reader/library';

import {
  applyFilter,
  applySort,
  type FilterOptions,
  type SortOptions,
} from './annotation-filter.js';
import { throwIfInvalid, validateNoteInput } from './annotation-validator.js';
import { AnnotationValidationError } from './errors.js';
import { locatorsEqual } from './bookmark-manager.js';

export interface CreateNoteOptions {
  readonly selectedText?: string;
}

export interface ListNotesOptions {
  readonly filter?: FilterOptions;
  readonly sort?: SortOptions;
}

export async function createNoteManaged(
  repo: LibraryRepository,
  bookId: string,
  locator: ReaderLocator,
  body: string,
  options?: CreateNoteOptions,
): Promise<Note> {
  const validation = validateNoteInput({
    bookId,
    locator,
    body,
    selectedText: options?.selectedText,
  });
  throwIfInvalid(validation);

  return createNote(repo, {
    bookId,
    locator,
    body,
    ...(options?.selectedText !== undefined ? { selectedText: options.selectedText } : {}),
  });
}

export async function listNotesManaged(
  repo: LibraryRepository,
  bookId: string,
  options?: ListNotesOptions,
): Promise<readonly Note[]> {
  const notes = await listNotes(repo, bookId);
  const filtered = applyFilter(notes, options?.filter);
  return applySort(filtered, options?.sort);
}

export async function updateNoteManaged(
  repo: LibraryRepository,
  noteId: string,
  bookId: string,
  text: string,
): Promise<Note> {
  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new AnnotationValidationError('Note body must not be empty', 'body');
  }

  const existing = await listNotes(repo, bookId);
  const found = existing.find((n) => n.id === noteId);
  if (!found) {
    throw new NoteNotFoundError(noteId);
  }

  return updateNote(repo, {
    noteId,
    bookId,
    body: text,
  });
}

export async function removeNoteManaged(
  repo: LibraryRepository,
  noteId: string,
  bookId: string,
): Promise<void> {
  return removeNote(repo, noteId, bookId);
}

export async function searchNotes(
  repo: LibraryRepository,
  bookId: string,
  query: string,
): Promise<readonly Note[]> {
  if (typeof query !== 'string' || query.trim().length === 0) {
    return [];
  }

  const notes = await listNotes(repo, bookId);
  const lowerQuery = query.toLowerCase();
  return notes.filter((note) => {
    const bodyMatch = note.body.toLowerCase().includes(lowerQuery);
    const selectedTextMatch =
      note.selectedText !== undefined && note.selectedText.toLowerCase().includes(lowerQuery);
    return bodyMatch || selectedTextMatch;
  });
}

export async function hasNoteAtLocator(
  repo: LibraryRepository,
  bookId: string,
  locator: ReaderLocator,
): Promise<boolean> {
  const notes = await listNotes(repo, bookId);
  return notes.some((n) => locatorsEqual(n.locator, locator));
}
