import type { Book, ReadingProgress, ReaderPreferences } from '@clio-reader/domain';

import { BookNotFoundError } from './errors.js';
import type { LibraryRepository } from './repository.js';

export interface BookDetails {
  readonly book: Book;
  readonly progress: ReadingProgress | undefined;
  readonly preferences: Partial<ReaderPreferences>;
}

export async function getBook(repo: LibraryRepository, bookId: string): Promise<BookDetails> {
  const books = await repo.listBooks();
  const book = books.find((b) => b.id === bookId);

  if (!book) {
    throw new BookNotFoundError(bookId);
  }

  const [progress, preferences] = await Promise.all([
    repo.getProgress(bookId),
    repo.getBookPreferences(bookId),
  ]);

  return { book, progress, preferences };
}
