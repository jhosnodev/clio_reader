export class BookNotFoundError extends Error {
  constructor(bookId: string) {
    super(`Book not found: ${bookId}`);
    this.name = 'BookNotFoundError';
  }
}

export class DuplicateBookError extends Error {
  constructor(bookId: string) {
    super(`Book already exists: ${bookId}`);
    this.name = 'DuplicateBookError';
  }
}

export class BookmarkNotFoundError extends Error {
  constructor(bookmarkId: string) {
    super(`Bookmark not found: ${bookmarkId}`);
    this.name = 'BookmarkNotFoundError';
  }
}

export class NoteNotFoundError extends Error {
  constructor(noteId: string) {
    super(`Note not found: ${noteId}`);
    this.name = 'NoteNotFoundError';
  }
}
