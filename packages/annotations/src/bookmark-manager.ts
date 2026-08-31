import type { Bookmark, ReaderLocator } from '@echo-reader/domain';
import type { LibraryRepository } from '@echo-reader/library';
import { createBookmark, listBookmarks, removeBookmark } from '@echo-reader/library';
import { BookmarkNotFoundError } from '@echo-reader/library';

import { applyFilter, applySort, type FilterOptions, type SortOptions } from './annotation-filter.js';
import { throwIfInvalid, validateBookmarkInput } from './annotation-validator.js';
import { DuplicateLocatorError } from './errors.js';

export interface CreateBookmarkOptions {
  readonly label?: string;
}

export interface ListBookmarksOptions {
  readonly filter?: FilterOptions;
  readonly sort?: SortOptions;
}

export function locatorsEqual(a: ReaderLocator, b: ReaderLocator): boolean {
  if (a.format !== b.format) return false;
  switch (a.format) {
    case 'epub':
      if (b.format !== 'epub') return false;
      return (
        a.href === b.href &&
        a.cfi === b.cfi &&
        a.progression === b.progression &&
        a.positionOrder === b.positionOrder
      );
    case 'pdf':
      if (b.format !== 'pdf') return false;
      return (
        a.page === b.page &&
        a.progression === b.progression &&
        a.zoom === b.zoom &&
        a.scrollX === b.scrollX &&
        a.scrollY === b.scrollY
      );
    case 'cbz':
      if (b.format !== 'cbz') return false;
      return (
        a.page === b.page &&
        a.progression === b.progression &&
        a.scale === b.scale &&
        a.scrollX === b.scrollX &&
        a.scrollY === b.scrollY
      );
    case 'md':
      if (b.format !== 'md') return false;
      return (
        a.href === b.href &&
        a.offset === b.offset &&
        a.progression === b.progression &&
        a.positionOrder === b.positionOrder
      );
  }
}

export async function createBookmarkManaged(
  repo: LibraryRepository,
  bookId: string,
  locator: ReaderLocator,
  options?: CreateBookmarkOptions,
): Promise<Bookmark> {
  const validation = validateBookmarkInput({
    bookId,
    locator,
    label: options?.label,
  });
  throwIfInvalid(validation);

  const existing = await listBookmarks(repo, bookId);
  const duplicate = existing.some((b) => locatorsEqual(b.locator, locator));
  if (duplicate) {
    throw new DuplicateLocatorError(JSON.stringify(locator));
  }

  return createBookmark(repo, {
    bookId,
    locator,
    label: options?.label,
  });
}

export async function listBookmarksManaged(
  repo: LibraryRepository,
  bookId: string,
  options?: ListBookmarksOptions,
): Promise<readonly Bookmark[]> {
  const bookmarks = await listBookmarks(repo, bookId);
  const filtered = applyFilter(bookmarks, options?.filter);
  return applySort(filtered, options?.sort);
}

export async function removeBookmarkManaged(
  repo: LibraryRepository,
  bookmarkId: string,
  bookId: string,
): Promise<void> {
  return removeBookmark(repo, bookmarkId, bookId);
}

export async function getBookmarkById(
  repo: LibraryRepository,
  bookmarkId: string,
  bookId: string,
): Promise<Bookmark> {
  const bookmarks = await listBookmarks(repo, bookId);
  const found = bookmarks.find((b) => b.id === bookmarkId);
  if (!found) {
    throw new BookmarkNotFoundError(bookmarkId);
  }
  return found;
}

export async function hasBookmarkAtLocator(
  repo: LibraryRepository,
  bookId: string,
  locator: ReaderLocator,
): Promise<boolean> {
  const bookmarks = await listBookmarks(repo, bookId);
  return bookmarks.some((b) => locatorsEqual(b.locator, locator));
}