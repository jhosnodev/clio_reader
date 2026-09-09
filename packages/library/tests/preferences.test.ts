import { describe, expect, it } from 'vitest';

import { createDefaultPreferences, DomainValidationError } from '@clio-reader/domain';
import { InMemoryKeyValueStore, LocalRepository } from '@clio-reader/storage';

import {
  getGlobalPreferences,
  saveGlobalPreferences,
  getBookPreferences,
  saveBookPreferences,
} from '../src/preferences.js';

function createRepo(): LocalRepository {
  return new LocalRepository(new InMemoryKeyValueStore());
}

describe('preferences', () => {
  describe('global preferences', () => {
    it('returns default preferences initially', async () => {
      const repo = createRepo();
      const prefs = await getGlobalPreferences(repo);
      expect(prefs).toEqual(createDefaultPreferences());
    });

    it('saves and retrieves global preferences', async () => {
      const repo = createRepo();
      const updated = { ...createDefaultPreferences(), theme: 'dark' as const };

      await saveGlobalPreferences(repo, updated);
      const result = await getGlobalPreferences(repo);

      expect(result.theme).toBe('dark');
    });

    it('rejects invalid preferences', async () => {
      const repo = createRepo();
      const invalid = { ...createDefaultPreferences(), fontScale: 5 };

      await expect(saveGlobalPreferences(repo, invalid)).rejects.toBeInstanceOf(
        DomainValidationError,
      );
    });
  });

  describe('per-book preferences', () => {
    it('returns empty object when no per-book prefs exist', async () => {
      const repo = createRepo();
      const prefs = await getBookPreferences(repo, 'book-1');
      expect(prefs).toEqual({});
    });

    it('saves and retrieves per-book preferences', async () => {
      const repo = createRepo();

      await saveBookPreferences(repo, 'book-1', { fontScale: 1.5 });
      const prefs = await getBookPreferences(repo, 'book-1');

      expect(prefs.fontScale).toBe(1.5);
    });

    it('isolates per-book preferences between books', async () => {
      const repo = createRepo();

      await saveBookPreferences(repo, 'book-1', { fontScale: 1.5 });
      await saveBookPreferences(repo, 'book-2', { lineHeight: 2 });

      const prefs1 = await getBookPreferences(repo, 'book-1');
      const prefs2 = await getBookPreferences(repo, 'book-2');

      expect(prefs1.fontScale).toBe(1.5);
      expect(prefs1.lineHeight).toBeUndefined();
      expect(prefs2.lineHeight).toBe(2);
      expect(prefs2.fontScale).toBeUndefined();
    });

    it('rejects invalid per-book preferences', async () => {
      const repo = createRepo();

      await expect(saveBookPreferences(repo, 'book-1', { fontScale: 5 })).rejects.toBeInstanceOf(
        DomainValidationError,
      );
    });

    it('overrides previously saved per-book preferences', async () => {
      const repo = createRepo();

      await saveBookPreferences(repo, 'book-1', { fontScale: 1.5 });
      await saveBookPreferences(repo, 'book-1', { fontScale: 1.2 });

      const prefs = await getBookPreferences(repo, 'book-1');
      expect(prefs.fontScale).toBe(1.2);
    });
  });
});
