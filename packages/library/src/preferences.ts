import type { ReaderPreferences } from '@clio-reader/domain';

import type { LibraryRepository } from './repository.js';

export async function getGlobalPreferences(repo: LibraryRepository): Promise<ReaderPreferences> {
  return repo.getGlobalPreferences();
}

export async function saveGlobalPreferences(
  repo: LibraryRepository,
  preferences: ReaderPreferences,
): Promise<void> {
  await repo.saveGlobalPreferences(preferences);
}

export async function getBookPreferences(
  repo: LibraryRepository,
  bookId: string,
): Promise<Partial<ReaderPreferences>> {
  return repo.getBookPreferences(bookId);
}

export async function saveBookPreferences(
  repo: LibraryRepository,
  bookId: string,
  preferences: Partial<ReaderPreferences>,
): Promise<void> {
  await repo.saveBookPreferences(bookId, preferences);
}
