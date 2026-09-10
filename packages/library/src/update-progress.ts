import {
  createReadingProgress,
  type ReadingProgress,
  type ReaderLocator,
} from '@clio-reader/domain';

import { BookNotFoundError } from './errors.js';
import type { LibraryRepository } from './repository.js';

export interface UpdateProgressInput {
  readonly bookId: string;
  readonly locator: ReaderLocator;
  readonly percent: number;
}

/**
 * Updates reading progress for a book.
 *
 * Debounce strategy: This use case does not implement debounce internally.
 * The caller (typically the reader UI) is responsible for debouncing calls
 * to avoid excessive persistence writes during rapid page turns.
 * A recommended debounce interval is 500–1000ms for locator changes,
 * with an immediate save on session pause or book close.
 */
export async function updateProgress(
  repo: LibraryRepository,
  input: UpdateProgressInput,
): Promise<ReadingProgress> {
  const books = await repo.listBooks();
  const book = books.find((b) => b.id === input.bookId);

  if (!book) {
    throw new BookNotFoundError(input.bookId);
  }

  const progress = createReadingProgress(input);
  await repo.saveProgress(progress);

  await repo.upsertBook({
    ...book,
    lastOpenedAt: Date.now(),
  });

  return progress;
}
