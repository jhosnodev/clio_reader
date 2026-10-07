export type { LibraryRepository } from './repository.js';
export type { ImportBookInput } from './import-book.js';
export type { ListBooksOptions, SortField } from './list-books.js';
export type { BookDetails } from './get-book.js';
export type { UpdateProgressInput } from './update-progress.js';
export type { CreateBookmarkInput } from './bookmarks.js';
export type { CreateNoteInput, UpdateNoteInput } from './notes.js';
export type { CreateHighlightInput } from './highlights.js';

export { importBook } from './import-book.js';
export { listBooks } from './list-books.js';
export { getBook } from './get-book.js';
export { removeBook } from './remove-book.js';
export { updateProgress } from './update-progress.js';
export { generateId } from './id.js';
export {
  getGlobalPreferences,
  saveGlobalPreferences,
  getBookPreferences,
  saveBookPreferences,
} from './preferences.js';
export { createBookmark, listBookmarks, removeBookmark } from './bookmarks.js';
export { createNote, listNotes, updateNote, removeNote } from './notes.js';
export {
  createHighlight_ as createHighlight,
  listHighlights,
  removeHighlight,
} from './highlights.js';

export {
  BookNotFoundError,
  DuplicateBookError,
  BookmarkNotFoundError,
  NoteNotFoundError,
  HighlightNotFoundError,
} from './errors.js';
