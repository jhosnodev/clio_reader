import { BookNotFoundError } from './errors.js';
import type { LibraryRepository } from './repository.js';

export async function removeBook(repo: LibraryRepository, bookId: string): Promise<void> {
  const books = await repo.listBooks();
  const exists = books.some((b) => b.id === bookId);

  if (!exists) {
    throw new BookNotFoundError(bookId);
  }

  await repo.removeBook(bookId);
}
