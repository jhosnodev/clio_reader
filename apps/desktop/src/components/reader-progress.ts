import type { ReaderLocator } from '@clio-reader/domain';

import { clamp01 } from '../reader-progress-bar';

/**
 * Given a note/bookmark locator and a saved progress locator, returns the
 * position order to resume. Note locator takes priority over saved progress.
 */
export function getResumePositionOrder(
  noteLocator?: ReaderLocator,
  savedLocator?: ReaderLocator,
): number | undefined {
  if (
    noteLocator &&
    'positionOrder' in noteLocator &&
    typeof noteLocator.positionOrder === 'number'
  ) {
    return noteLocator.positionOrder;
  }
  if (
    savedLocator &&
    'positionOrder' in savedLocator &&
    typeof savedLocator.positionOrder === 'number'
  ) {
    return savedLocator.positionOrder;
  }
  return undefined;
}

/**
 * Extracts a 0..1 percent from a ReaderLocator using its progression field.
 * Returns 0 if progression is undefined or missing.
 */
export function locatorToPercent(locator: ReaderLocator): number {
  if ('progression' in locator && typeof locator.progression === 'number') {
    return locator.progression;
  }
  return 0;
}

/**
 * Devuelve la posición vertical dentro del documento guardada en el locator.
 * Solo los formatos reflowable (EPUB, Markdown) la registran.
 */
export function getResumeScrollRatio(locator?: ReaderLocator): number | undefined {
  if (!locator) return undefined;
  if (locator.format !== 'epub' && locator.format !== 'md') return undefined;
  if (typeof locator.scrollRatio !== 'number' || !Number.isFinite(locator.scrollRatio)) {
    return undefined;
  }
  return clamp01(locator.scrollRatio);
}

/**
 * Añade la posición vertical actual al locator de formatos reflowable.
 * El resto de formatos se devuelve sin tocar.
 */
export function withScrollRatio(locator: ReaderLocator, ratio: number): ReaderLocator {
  if (locator.format !== 'epub' && locator.format !== 'md') return locator;
  if (!Number.isFinite(ratio)) return locator;
  return { ...locator, scrollRatio: clamp01(ratio) };
}

/**
 * Compara dos locators ignorando la posición dentro del documento.
 * Dos notas del mismo capítulo siguen considerándose la misma "página".
 */
export function isSameDocumentPosition(a: ReaderLocator, b: ReaderLocator): boolean {
  if (a.format !== b.format) return false;
  if (a.format === 'pdf' && b.format === 'pdf') return a.page === b.page;
  if (a.format === 'cbz' && b.format === 'cbz') return a.page === b.page;
  if (a.format === 'epub' && b.format === 'epub') {
    return chapterKeyOf(a.positionOrder, a.href) === chapterKeyOf(b.positionOrder, b.href);
  }
  if (a.format === 'md' && b.format === 'md') {
    return chapterKeyOf(a.positionOrder, a.href) === chapterKeyOf(b.positionOrder, b.href);
  }
  return false;
}

function chapterKeyOf(positionOrder: number | undefined, href: string | undefined): string {
  if (typeof positionOrder === 'number') return `#${positionOrder}`;
  return href ?? '';
}

/**
 * Parsea un locator serializado. Devuelve null si el JSON no es un locator válido.
 */
export function parseLocator(raw: string | undefined): ReaderLocator | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    if (typeof (parsed as { format?: unknown }).format !== 'string') return null;
    return parsed as ReaderLocator;
  } catch {
    return null;
  }
}
