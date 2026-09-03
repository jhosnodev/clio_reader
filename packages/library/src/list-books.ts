import type { Book, BookFormat } from '@clio-reader/domain';

import type { LibraryRepository } from './repository.js';

export type SortField = 'title' | 'addedAt';

export interface ListBooksOptions {
  readonly format?: BookFormat;
  readonly sortBy?: SortField;
  readonly sortDirection?: 'asc' | 'desc';
}

export async function listBooks(
  repo: LibraryRepository,
  options?: ListBooksOptions,
): Promise<readonly Book[]> {
  let books = await repo.listBooks();

  if (options?.format) {
    books = books.filter((book) => book.format === options.format);
  }

  if (options?.sortBy) {
    const direction = options.sortDirection ?? 'asc';
    books = [...books].sort((a, b) => {
      const aVal = a[options.sortBy!];
      const bVal = b[options.sortBy!];
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return direction === 'desc' ? -cmp : cmp;
    });
  }

  return books;
}
