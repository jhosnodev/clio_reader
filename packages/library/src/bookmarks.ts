import type { Bookmark, ReaderLocator } from '@clio-reader/domain';

import { BookmarkNotFoundError, BookNotFoundError } from './errors.js';
import { generateId } from './id.js';
import type { LibraryRepository } from './repository.js';

export interface CreateBookmarkInput {
  readonly bookId: string;
  readonly locator: ReaderLocator;
  readonly label?: string;
}

export async function createBookmark(
  repo: LibraryRepository,
  input: CreateBookmarkInput,
): Promise<Bookmark> {
  const books = await repo.listBooks();
  const exists = books.some((b) => b.id === input.bookId);

  if (!exists) {
    throw new BookNotFoundError(input.bookId);
  }

  const bookmark: Bookmark = {
    id: generateId(),
    bookId: input.bookId,
    locator: input.locator,
    createdAt: Date.now(),
    ...(input.label !== undefined ? { label: input.label } : {}),
  };

  await repo.saveBookmark(bookmark);
  return bookmark;
}

export async function listBookmarks(
  repo: LibraryRepository,
  bookId: string,
): Promise<readonly Bookmark[]> {
  return repo.listBookmarks(bookId);
}

export async function removeBookmark(
  repo: LibraryRepository,
  bookmarkId: string,
  bookId: string,
): Promise<void> {
  const bookmarks = await repo.listBookmarks(bookId);
  const exists = bookmarks.some((b) => b.id === bookmarkId);

  if (!exists) {
    throw new BookmarkNotFoundError(bookmarkId);
  }

  await repo.removeBookmark(bookmarkId);
}
