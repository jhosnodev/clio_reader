import { createBook, type Book, type BookFormat } from '@clio-reader/domain';

import { DuplicateBookError } from './errors.js';
import type { LibraryRepository } from './repository.js';

export interface ImportBookInput {
  readonly id: string;
  readonly title: string;
  readonly author?: string;
  readonly format: BookFormat;
  readonly uri: string;
  readonly addedAt?: number;
}

export async function importBook(repo: LibraryRepository, input: ImportBookInput): Promise<Book> {
  const existingBooks = await repo.listBooks();
  const isDuplicate = existingBooks.some((book) => book.id === input.id);
  if (isDuplicate) {
    throw new DuplicateBookError(input.id);
  }

  const book = createBook(input);
  await repo.upsertBook(book);
  return book;
}
