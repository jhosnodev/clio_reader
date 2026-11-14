import { readFileSync, renameSync, existsSync } from 'fs';
import type { BetterSqlite3Connection } from './db-better-sqlite3.js';
import {
  books,
  readingProgress,
  readerPreferences,
  bookPreferences,
  bookmarks,
  notes,
  highlights,
  userSettings,
} from './schema.js';
import type { PersistenceState } from './index.js';
import {
  DEFAULT_READER_MARGIN,
  normalizeReaderMargin,
  type ReaderPreferences as DomainReaderPreferences,
} from '@clio-reader/domain';

export interface MigrateJsonToSqliteOptions {
  readonly jsonPath: string;
  readonly backupPath?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseJsonState(jsonPath: string): PersistenceState | null {
  if (!existsSync(jsonPath)) {
    return null;
  }

  try {
    const raw = readFileSync(jsonPath, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return null;

    const candidate = parsed as Partial<PersistenceState>;
    return {
      schemaVersion: typeof candidate.schemaVersion === 'number' ? candidate.schemaVersion : 1,
      books: Array.isArray(candidate.books) ? candidate.books : [],
      progress: Array.isArray(candidate.progress) ? candidate.progress : [],
      preferences: isRecord(candidate.preferences)
        ? {
            global: isRecord((candidate.preferences as Record<string, unknown>).global)
              ? ((candidate.preferences as Record<string, unknown>)
                  .global as DomainReaderPreferences)
              : {
                  theme: 'light',
                  backgroundColor: '#ffffff',
                  foregroundColor: '#1f2937',
                  accentColor: '#2563eb',
                  fontFamily: 'system',
                  fontScale: 1,
                  lineHeight: 1.5,
                  margin: DEFAULT_READER_MARGIN,
                  readingDirection: 'ltr',
                },
            byBook: isRecord((candidate.preferences as Record<string, unknown>).byBook)
              ? ((candidate.preferences as Record<string, unknown>).byBook as Record<
                  string,
                  Partial<DomainReaderPreferences>
                >)
              : {},
          }
        : {
            global: {
              theme: 'light',
              backgroundColor: '#ffffff',
              foregroundColor: '#1f2937',
              accentColor: '#2563eb',
              fontFamily: 'system',
              fontScale: 1,
              lineHeight: 1.5,
              margin: DEFAULT_READER_MARGIN,
              readingDirection: 'ltr',
            },
            byBook: {},
          },
      bookmarks: Array.isArray(candidate.bookmarks) ? candidate.bookmarks : [],
      notes: Array.isArray(candidate.notes) ? candidate.notes : [],
      highlights: Array.isArray(candidate.highlights) ? candidate.highlights : [],
      userSettings: isRecord(candidate.userSettings)
        ? {
            paletteId:
              typeof (candidate.userSettings as Record<string, unknown>).paletteId === 'string'
                ? ((candidate.userSettings as Record<string, unknown>).paletteId as string)
                : 'clio-3',
            mode:
              (candidate.userSettings as Record<string, unknown>).mode === 'dark' ||
              (candidate.userSettings as Record<string, unknown>).mode === 'light'
                ? ((candidate.userSettings as Record<string, unknown>).mode as 'dark' | 'light')
                : 'dark',
            ...(typeof (candidate.userSettings as Record<string, unknown>).locale === 'string' &&
              ((candidate.userSettings as Record<string, unknown>).locale as string).length > 0 && {
                locale: (candidate.userSettings as Record<string, unknown>).locale as string,
              }),
          }
        : { paletteId: 'clio-3', mode: 'dark' as const },
    };
  } catch {
    return null;
  }
}

export async function migrateJsonToSqlite(
  db: BetterSqlite3Connection,
  options: MigrateJsonToSqliteOptions,
): Promise<{
  migrated: boolean;
  booksCount: number;
  notesCount: number;
  bookmarksCount: number;
  highlightsCount: number;
}> {
  const state = parseJsonState(options.jsonPath);

  if (!state) {
    return { migrated: false, booksCount: 0, notesCount: 0, bookmarksCount: 0, highlightsCount: 0 };
  }

  const now = Math.floor(Date.now() / 1000);

  db.transaction(() => {
    for (const book of state.books) {
      db.insert(books)
        .values({
          id: book.id,
          title: book.title,
          author: book.author,
          format: book.format,
          uri: book.uri,
          fileHash: book.fileHash,
          addedAt: book.addedAt,
          lastOpenedAt: book.lastOpenedAt,
          readingStatus: book.readingStatus,
          language: book.language,
          status: book.status,
          rank: book.rank,
          coverImage: book.coverImage,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }

    for (const progress of state.progress) {
      db.insert(readingProgress)
        .values({
          bookId: progress.bookId,
          locatorFormat: progress.locator.format,
          locatorData: JSON.stringify(progress.locator),
          percent: progress.percent,
          updatedAt: now,
        })
        .run();
    }

    const globalPrefs = state.preferences.global;
    db.insert(readerPreferences)
      .values({
        id: 1,
        theme: globalPrefs.theme,
        backgroundColor: globalPrefs.backgroundColor,
        foregroundColor: globalPrefs.foregroundColor,
        accentColor: globalPrefs.accentColor,
        fontFamily: globalPrefs.fontFamily,
        fontScale: globalPrefs.fontScale,
        lineHeight: globalPrefs.lineHeight,
        margin: String(normalizeReaderMargin(globalPrefs.margin)),
        readingDirection: globalPrefs.readingDirection,
        updatedAt: now,
      })
      .run();

    for (const [bookId, prefs] of Object.entries(state.preferences.byBook)) {
      db.insert(bookPreferences)
        .values({
          bookId,
          theme: prefs.theme,
          backgroundColor: prefs.backgroundColor,
          foregroundColor: prefs.foregroundColor,
          accentColor: prefs.accentColor,
          fontFamily: prefs.fontFamily,
          fontScale: prefs.fontScale,
          lineHeight: prefs.lineHeight,
          margin:
            prefs.margin === undefined ? undefined : String(normalizeReaderMargin(prefs.margin)),
          readingDirection: prefs.readingDirection,
          updatedAt: now,
        })
        .run();
    }

    for (const bookmark of state.bookmarks) {
      db.insert(bookmarks)
        .values({
          id: bookmark.id,
          bookId: bookmark.bookId,
          locatorFormat: bookmark.locator.format,
          locatorData: JSON.stringify(bookmark.locator),
          label: bookmark.label,
          createdAt: bookmark.createdAt,
          updatedAt: now,
        })
        .run();
    }

    for (const note of state.notes) {
      db.insert(notes)
        .values({
          id: note.id,
          bookId: note.bookId,
          locatorFormat: note.locator.format,
          locatorData: JSON.stringify(note.locator),
          selectedText: note.selectedText,
          body: note.body,
          createdAt: note.createdAt,
          updatedAt: note.updatedAt,
        })
        .run();
    }

    for (const highlight of state.highlights) {
      db.insert(highlights)
        .values({
          id: highlight.id,
          bookId: highlight.bookId,
          locatorFormat: highlight.locatorStart.format,
          locatorStart: JSON.stringify(highlight.locatorStart),
          locatorEnd: JSON.stringify(highlight.locatorEnd),
          selectedText: highlight.selectedText,
          color: highlight.color,
          style: highlight.style,
          note: highlight.note,
          createdAt: highlight.createdAt,
          updatedAt: highlight.updatedAt,
        })
        .run();
    }

    db.insert(userSettings)
      .values({
        id: 1,
        paletteId: state.userSettings.paletteId,
        mode: state.userSettings.mode,
        locale: state.userSettings.locale ?? null,
        updatedAt: now,
      })
      .run();
  });

  if (options.backupPath) {
    renameSync(options.jsonPath, options.backupPath);
  }

  return {
    migrated: true,
    booksCount: state.books.length,
    notesCount: state.notes.length,
    bookmarksCount: state.bookmarks.length,
    highlightsCount: state.highlights.length,
  };
}
