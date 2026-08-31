import { describe, expect, it } from 'vitest';

import { createDefaultPreferences } from '@echo-reader/domain';
import { InMemoryKeyValueStore, LocalRepository } from '@echo-reader/storage';

import { SettingsManager } from '../src/settings-manager.js';

function createRepo(): LocalRepository {
  return new LocalRepository(new InMemoryKeyValueStore());
}

describe('SettingsManager', () => {
  describe('loadSettings', () => {
    it('returns default preferences when no overrides exist', async () => {
      const repo = createRepo();
      const manager = new SettingsManager();

      const resolved = await manager.loadSettings('book-1', repo);

      expect(resolved.global).toEqual(createDefaultPreferences());
      expect(resolved.bookOverrides).toEqual({});
      expect(resolved.merged).toEqual(createDefaultPreferences());
    });

    it('merges per-book overrides with global preferences', async () => {
      const repo = createRepo();
      const manager = new SettingsManager();
      const darkGlobal = { ...createDefaultPreferences(), theme: 'dark' as const };

      await repo.saveGlobalPreferences(darkGlobal);
      await repo.saveBookPreferences('book-1', { fontScale: 1.5 });

      const resolved = await manager.loadSettings('book-1', repo);

      expect(resolved.global.theme).toBe('dark');
      expect(resolved.bookOverrides.fontScale).toBe(1.5);
      expect(resolved.merged.theme).toBe('dark');
      expect(resolved.merged.fontScale).toBe(1.5);
    });
  });

  describe('saveBookSettings', () => {
    it('saves partial per-book preferences', async () => {
      const repo = createRepo();
      const manager = new SettingsManager();

      await manager.saveBookSettings('book-1', { lineHeight: 2 }, repo);

      const prefs = await repo.getBookPreferences('book-1');
      expect(prefs.lineHeight).toBe(2);
    });
  });

  describe('saveGlobalSettings', () => {
    it('saves complete global preferences', async () => {
      const repo = createRepo();
      const manager = new SettingsManager();
      const dark = { ...createDefaultPreferences(), theme: 'dark' as const };

      await manager.saveGlobalSettings(dark, repo);

      const prefs = await repo.getGlobalPreferences();
      expect(prefs.theme).toBe('dark');
    });
  });

  describe('applySettings', () => {
    it('returns a flat record of setting values', async () => {
      const manager = new SettingsManager();
      const prefs = createDefaultPreferences();

      const result = manager.applySettings(prefs);

      expect(result.backgroundColor).toBe('#ffffff');
      expect(result.fontFamily).toBe('system');
      expect(result.fontScale).toBe(1);
      expect(result.readingDirection).toBe('ltr');
    });
  });
});
