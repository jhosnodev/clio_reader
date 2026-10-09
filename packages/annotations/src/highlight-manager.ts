import type { Highlight, ReaderLocator } from '@clio-reader/domain';
import type { LibraryRepository } from '@clio-reader/library';
import { createHighlight, listHighlights, removeHighlight } from '@clio-reader/library';

import { throwIfInvalid, validateHighlightInput } from './annotation-validator.js';
import { AnnotationValidationError } from './errors.js';
import { HIGHLIGHT_COLORS, highlightColorKey } from './highlight-colors.js';

export interface CreateHighlightOptions {
  readonly selectedText?: string;
  readonly style?: 'highlight' | 'underline';
}

export async function createHighlightManaged(
  repo: LibraryRepository,
  bookId: string,
  locator: ReaderLocator,
  color: string,
  options?: CreateHighlightOptions,
): Promise<Highlight> {
  const validation = validateHighlightInput({
    bookId,
    locator,
    color,
    ...(options?.style !== undefined ? { style: options.style } : {}),
    ...(options?.selectedText !== undefined ? { selectedText: options.selectedText } : {}),
  });
  throwIfInvalid(validation);

  const key = highlightColorKey(color);
  if (!key) {
    throw new AnnotationValidationError('color must be one of the highlight palette colors');
  }

  return createHighlight(repo, {
    bookId,
    locatorStart: locator,
    locatorEnd: locator,
    color: HIGHLIGHT_COLORS[key],
    style: options?.style ?? 'highlight',
    ...(options?.selectedText !== undefined ? { selectedText: options.selectedText } : {}),
  });
}

export async function listHighlightsManaged(
  repo: LibraryRepository,
  bookId: string,
): Promise<readonly Highlight[]> {
  return listHighlights(repo, bookId);
}

export async function removeHighlightManaged(
  repo: LibraryRepository,
  highlightId: string,
  bookId: string,
): Promise<void> {
  return removeHighlight(repo, highlightId, bookId);
}
