import type { ReaderLocator } from '@clio-reader/domain';

/**
 * Given a note/bookmark locator and a saved progress locator, returns the
 * position order to resume. Note locator takes priority over saved progress.
 */
export function getResumePositionOrder(
  noteLocator?: ReaderLocator,
  savedLocator?: ReaderLocator,
): number | undefined {
  if (noteLocator && 'positionOrder' in noteLocator && typeof noteLocator.positionOrder === 'number') {
    return noteLocator.positionOrder;
  }
  if (savedLocator && 'positionOrder' in savedLocator && typeof savedLocator.positionOrder === 'number') {
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
