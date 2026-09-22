import type { Highlight, ReaderLocator } from '@clio-reader/domain';
import { createHighlight, validateHighlightStyle } from '@clio-reader/domain';

import { BookNotFoundError, HighlightNotFoundError } from './errors.js';
import { generateId } from './id.js';
import type { LibraryRepository } from './repository.js';

export interface CreateHighlightInput {
  readonly bookId: string;
  readonly locatorStart: ReaderLocator;
  readonly locatorEnd: ReaderLocator;
  readonly selectedText?: string;
  readonly color: string;
  readonly style: 'highlight' | 'underline';
  readonly note?: string;
}

export async function createHighlight_(
  repo: LibraryRepository,
  input: CreateHighlightInput,
): Promise<Highlight> {
  const books = await repo.listBooks();
  const exists = books.some((b) => b.id === input.bookId);

  if (!exists) {
    throw new BookNotFoundError(input.bookId);
  }

  validateHighlightStyle(input.style);

  const highlight = createHighlight({
    id: generateId(),
    bookId: input.bookId,
    locatorStart: input.locatorStart,
    locatorEnd: input.locatorEnd,
    color: input.color,
    style: input.style,
    ...(input.selectedText !== undefined ? { selectedText: input.selectedText } : {}),
    ...(input.note !== undefined ? { note: input.note } : {}),
  });

  await repo.saveHighlight(highlight);
  return highlight;
}

export async function listHighlights(
  repo: LibraryRepository,
  bookId: string,
): Promise<readonly Highlight[]> {
  return repo.listHighlights(bookId);
}

export async function removeHighlight(
  repo: LibraryRepository,
  highlightId: string,
  bookId: string,
): Promise<void> {
  const highlights = await repo.listHighlights(bookId);
  const exists = highlights.some((h) => h.id === highlightId);

  if (!exists) {
    throw new HighlightNotFoundError(highlightId);
  }

  await repo.removeHighlight(highlightId);
}
