import {
  createDefaultPreferences,
  validateReaderPreferences,
  type ReaderPreferences,
} from '@echo-reader/domain';

import type { SessionRepository } from './session-repository.js';

export interface ResolvedSettings {
  readonly global: ReaderPreferences;
  readonly bookOverrides: Partial<ReaderPreferences>;
  readonly merged: ReaderPreferences;
}

export class SettingsManager {
  async loadSettings(bookId: string, repository: SessionRepository): Promise<ResolvedSettings> {
    const [global, bookOverrides] = await Promise.all([
      repository.getGlobalPreferences(),
      repository.getBookPreferences(bookId),
    ]);

    const merged: ReaderPreferences = { ...global, ...bookOverrides };

    return { global, bookOverrides, merged };
  }

  async saveBookSettings(
    bookId: string,
    preferences: Partial<ReaderPreferences>,
    repository: SessionRepository,
  ): Promise<void> {
    const global = await repository.getGlobalPreferences();
    const merged = { ...global, ...preferences };
    validateReaderPreferences(merged);
    await repository.saveBookPreferences(bookId, preferences);
  }

  async saveGlobalSettings(
    preferences: ReaderPreferences,
    repository: SessionRepository,
  ): Promise<void> {
    validateReaderPreferences(preferences);
    await repository.saveGlobalPreferences(preferences);
  }

  applySettings(prefs: ReaderPreferences): Record<string, string | number> {
    return {
      backgroundColor: prefs.backgroundColor,
      foregroundColor: prefs.foregroundColor,
      accentColor: prefs.accentColor,
      fontFamily: prefs.fontFamily,
      fontScale: prefs.fontScale,
      lineHeight: prefs.lineHeight,
      margin: prefs.margin,
      readingDirection: prefs.readingDirection,
    };
  }
}
