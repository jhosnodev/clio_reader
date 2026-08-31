export type { LibraryRepository } from './repository.js';
export type { ImportBookInput } from './import-book.js';
export type { ListBooksOptions, SortField } from './list-books.js';
export type { BookDetails } from './get-book.js';
export type { UpdateProgressInput } from './update-progress.js';
export type { CreateBookmarkInput } from './bookmarks.js';
export type { CreateNoteInput, UpdateNoteInput } from './notes.js';

export { importBook } from './import-book.js';
export { listBooks } from './list-books.js';
export { getBook } from './get-book.js';
export { removeBook } from './remove-book.js';
export { updateProgress } from './update-progress.js';
export {
  getGlobalPreferences,
  saveGlobalPreferences,
  getBookPreferences,
  saveBookPreferences,
} from './preferences.js';
export { createBookmark, listBookmarks, removeBookmark } from './bookmarks.js';
export { createNote, listNotes, updateNote, removeNote } from './notes.js';

export {
  BookNotFoundError,
  DuplicateBookError,
  BookmarkNotFoundError,
  NoteNotFoundError,
} from './errors.js';
