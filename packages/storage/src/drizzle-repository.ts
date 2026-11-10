import { eq, and, isNull, sql } from 'drizzle-orm';
import {
  Bookmark,
  Book,
  createDefaultPreferences,
  createDefaultUserSettings,
  DomainValidationError,
  Feedback,
  FeedbackStatus,
  Highlight,
  Note,
  normalizeReaderMargin,
  ReaderPreferences,
  ReadingProgress,
  UserSettings,
  validateReaderPreferences,
} from '@clio-reader/domain';
import type { BetterSqlite3Connection } from './db-better-sqlite3.js';
import {
  books,
  readingProgress,
  readerPreferences as readerPreferencesTable,
  bookPreferences as bookPreferencesTable,
  bookmarks as bookmarksTable,
  notes as notesTable,
  highlights as highlightsTable,
  userSettings as userSettingsTable,
  feedback as feedbackTable,
} from './schema.js';

export class DrizzleRepository {
  constructor(private readonly db: BetterSqlite3Connection) {}

  get rawDb(): BetterSqlite3Connection {
    return this.db;
  }

  // ==================== BOOKS ====================
  async listBooks(): Promise<readonly Book[]> {
    return this.db
      .select()
      .from(books)
      .where(isNull(books.deletedAt))
      .all()
      .map(this.mapBookFromDb);
  }

  async getBook(bookId: string): Promise<Book | undefined> {
    const result = this.db.select().from(books).where(eq(books.id, bookId)).get();

    return result ? this.mapBookFromDb(result) : undefined;
  }

  async upsertBook(book: Book): Promise<void> {
    const existing = await this.getBook(book.id);

    if (existing) {
      this.db
        .update(books)
        .set({
          ...this.mapBookToDb(book),
          updatedAt: Math.floor(Date.now() / 1000),
        })
        .where(eq(books.id, book.id))
        .run();
    } else {
      this.db.insert(books).values(this.mapBookToDb(book)).run();
    }
  }

  async removeBook(bookId: string): Promise<void> {
    const now = Math.floor(Date.now() / 1000);

    this.db.update(books).set({ deletedAt: now, updatedAt: now }).where(eq(books.id, bookId)).run();

    this.db.delete(readingProgress).where(eq(readingProgress.bookId, bookId)).run();
    this.db.delete(bookmarksTable).where(eq(bookmarksTable.bookId, bookId)).run();
    this.db.delete(notesTable).where(eq(notesTable.bookId, bookId)).run();
    this.db.delete(highlightsTable).where(eq(highlightsTable.bookId, bookId)).run();
    this.db.delete(bookPreferencesTable).where(eq(bookPreferencesTable.bookId, bookId)).run();
  }

  // ==================== READING PROGRESS ====================
  async getProgress(bookId: string): Promise<ReadingProgress | undefined> {
    const result = this.db
      .select()
      .from(readingProgress)
      .where(eq(readingProgress.bookId, bookId))
      .get();

    return result ? this.mapProgressFromDb(result) : undefined;
  }

  async saveProgress(progress: ReadingProgress): Promise<void> {
    const existing = await this.getProgress(progress.bookId);

    if (existing) {
      this.db
        .update(readingProgress)
        .set({
          locatorFormat: progress.locator.format,
          locatorData: JSON.stringify(progress.locator),
          percent: progress.percent,
          updatedAt: Math.floor(Date.now() / 1000),
        })
        .where(eq(readingProgress.bookId, progress.bookId))
        .run();
    } else {
      this.db
        .insert(readingProgress)
        .values({
          bookId: progress.bookId,
          locatorFormat: progress.locator.format,
          locatorData: JSON.stringify(progress.locator),
          percent: progress.percent,
          updatedAt: Math.floor(Date.now() / 1000),
        })
        .run();
    }
  }

  async listAllProgress(): Promise<readonly ReadingProgress[]> {
    return this.db.select().from(readingProgress).all().map(this.mapProgressFromDb);
  }

  // ==================== PREFERENCES ====================
  async getGlobalPreferences(): Promise<ReaderPreferences> {
    const result = this.db
      .select()
      .from(readerPreferencesTable)
      .where(eq(readerPreferencesTable.id, 1))
      .get();

    if (!result) {
      return createDefaultPreferences();
    }

    return this.mapPreferencesFromDb(result);
  }

  async saveGlobalPreferences(preferences: ReaderPreferences): Promise<void> {
    validateReaderPreferences(preferences);

    const existing = this.db
      .select()
      .from(readerPreferencesTable)
      .where(eq(readerPreferencesTable.id, 1))
      .get();

    const now = Math.floor(Date.now() / 1000);

    if (existing) {
      this.db
        .update(readerPreferencesTable)
        .set({
          ...this.mapPreferencesToDb(preferences),
          updatedAt: now,
        })
        .where(eq(readerPreferencesTable.id, 1))
        .run();
    } else {
      this.db
        .insert(readerPreferencesTable)
        .values({
          id: 1,
          ...this.mapPreferencesToDb(preferences),
          updatedAt: now,
        })
        .run();
    }
  }

  async getBookPreferences(bookId: string): Promise<Partial<ReaderPreferences>> {
    const result = this.db
      .select()
      .from(bookPreferencesTable)
      .where(eq(bookPreferencesTable.bookId, bookId))
      .get();

    if (!result) {
      return {};
    }

    return this.mapBookPreferencesFromDb(result);
  }

  async saveBookPreferences(
    bookId: string,
    preferences: Partial<ReaderPreferences>,
  ): Promise<void> {
    const global = await this.getGlobalPreferences();
    const merged = { ...global, ...preferences };
    validateReaderPreferences(merged);

    const existing = this.db
      .select()
      .from(bookPreferencesTable)
      .where(eq(bookPreferencesTable.bookId, bookId))
      .get();

    const now = Math.floor(Date.now() / 1000);

    if (existing) {
      this.db
        .update(bookPreferencesTable)
        .set({
          ...this.mapBookPreferencesToDb(preferences),
          updatedAt: now,
        })
        .where(eq(bookPreferencesTable.bookId, bookId))
        .run();
    } else {
      this.db
        .insert(bookPreferencesTable)
        .values({
          bookId,
          ...this.mapBookPreferencesToDb(preferences),
          updatedAt: now,
        })
        .run();
    }
  }

  // ==================== BOOKMARKS ====================
  async listAllBookmarks(): Promise<readonly Bookmark[]> {
    return this.db
      .select()
      .from(bookmarksTable)
      .where(isNull(bookmarksTable.deletedAt))
      .all()
      .map(this.mapBookmarkFromDb);
  }

  async listBookmarks(bookId: string): Promise<readonly Bookmark[]> {
    return this.db
      .select()
      .from(bookmarksTable)
      .where(and(eq(bookmarksTable.bookId, bookId), isNull(bookmarksTable.deletedAt)))
      .all()
      .map(this.mapBookmarkFromDb);
  }

  async saveBookmark(bookmark: Bookmark): Promise<void> {
    const existing = this.db
      .select()
      .from(bookmarksTable)
      .where(eq(bookmarksTable.id, bookmark.id))
      .get();

    const now = Math.floor(Date.now() / 1000);

    if (existing) {
      this.db
        .update(bookmarksTable)
        .set({
          locatorFormat: bookmark.locator.format,
          locatorData: JSON.stringify(bookmark.locator),
          label: bookmark.label,
          updatedAt: now,
        })
        .where(eq(bookmarksTable.id, bookmark.id))
        .run();
    } else {
      this.db
        .insert(bookmarksTable)
        .values({
          id: bookmark.id,
          bookId: bookmark.bookId,
          locatorFormat: bookmark.locator.format,
          locatorData: JSON.stringify(bookmark.locator),
          label: bookmark.label,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }
  }

  async removeBookmark(bookmarkId: string): Promise<void> {
    const now = Math.floor(Date.now() / 1000);

    this.db
      .update(bookmarksTable)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(bookmarksTable.id, bookmarkId))
      .run();
  }

  // ==================== NOTES ====================
  async listNotes(bookId: string): Promise<readonly Note[]> {
    return this.db
      .select()
      .from(notesTable)
      .where(and(eq(notesTable.bookId, bookId), isNull(notesTable.deletedAt)))
      .all()
      .map(this.mapNoteFromDb);
  }

  async saveNote(note: Note): Promise<void> {
    if (note.body.trim().length === 0) {
      throw new DomainValidationError('Note body must not be empty');
    }

    const existing = this.db.select().from(notesTable).where(eq(notesTable.id, note.id)).get();

    const now = Math.floor(Date.now() / 1000);

    if (existing) {
      this.db
        .update(notesTable)
        .set({
          locatorFormat: note.locator.format,
          locatorData: JSON.stringify(note.locator),
          selectedText: note.selectedText,
          body: note.body,
          updatedAt: now,
        })
        .where(eq(notesTable.id, note.id))
        .run();
    } else {
      this.db
        .insert(notesTable)
        .values({
          id: note.id,
          bookId: note.bookId,
          locatorFormat: note.locator.format,
          locatorData: JSON.stringify(note.locator),
          selectedText: note.selectedText,
          body: note.body,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }
  }

  async removeNote(noteId: string): Promise<void> {
    const now = Math.floor(Date.now() / 1000);

    this.db
      .update(notesTable)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(notesTable.id, noteId))
      .run();
  }

  // ==================== HIGHLIGHTS ====================
  async listHighlights(bookId: string): Promise<readonly Highlight[]> {
    return this.db
      .select()
      .from(highlightsTable)
      .where(and(eq(highlightsTable.bookId, bookId), isNull(highlightsTable.deletedAt)))
      .all()
      .map(this.mapHighlightFromDb);
  }

  async saveHighlight(highlight: Highlight): Promise<void> {
    const existing = this.db
      .select()
      .from(highlightsTable)
      .where(eq(highlightsTable.id, highlight.id))
      .get();

    const now = Math.floor(Date.now() / 1000);

    if (existing) {
      this.db
        .update(highlightsTable)
        .set({
          locatorFormat: highlight.locatorStart.format,
          locatorStart: JSON.stringify(highlight.locatorStart),
          locatorEnd: JSON.stringify(highlight.locatorEnd),
          selectedText: highlight.selectedText,
          color: highlight.color,
          style: highlight.style,
          note: highlight.note,
          updatedAt: now,
        })
        .where(eq(highlightsTable.id, highlight.id))
        .run();
    } else {
      this.db
        .insert(highlightsTable)
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
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }
  }

  async removeHighlight(highlightId: string): Promise<void> {
    const now = Math.floor(Date.now() / 1000);

    this.db
      .update(highlightsTable)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(highlightsTable.id, highlightId))
      .run();
  }

  // ==================== USER SETTINGS ====================
  async getUserSettings(): Promise<UserSettings> {
    const result = this.db
      .select()
      .from(userSettingsTable)
      .where(eq(userSettingsTable.id, 1))
      .get();

    if (!result) {
      return createDefaultUserSettings();
    }

    return {
      paletteId: result.paletteId,
      mode: result.mode as UserSettings['mode'],
    };
  }

  async saveUserSettings(settings: UserSettings): Promise<void> {
    const existing = this.db
      .select()
      .from(userSettingsTable)
      .where(eq(userSettingsTable.id, 1))
      .get();

    const now = Math.floor(Date.now() / 1000);

    if (existing) {
      this.db
        .update(userSettingsTable)
        .set({
          paletteId: settings.paletteId,
          mode: settings.mode,
          updatedAt: now,
        })
        .where(eq(userSettingsTable.id, 1))
        .run();
    } else {
      this.db
        .insert(userSettingsTable)
        .values({
          id: 1,
          paletteId: settings.paletteId,
          mode: settings.mode,
          updatedAt: now,
        })
        .run();
    }
  }

  // ==================== FEEDBACK ====================
  async saveFeedback(item: Feedback): Promise<void> {
    const existing = this.db
      .select()
      .from(feedbackTable)
      .where(eq(feedbackTable.id, item.id))
      .get();

    if (existing) {
      this.db
        .update(feedbackTable)
        .set({
          reaction: item.reaction ?? null,
          category: item.category ?? null,
          message: item.message ?? null,
          status: item.status,
          githubIssueUrl: item.githubIssueUrl ?? null,
        })
        .where(eq(feedbackTable.id, item.id))
        .run();
      return;
    }

    this.db
      .insert(feedbackTable)
      .values({
        id: item.id,
        installationId: item.installationId ?? null,
        reaction: item.reaction ?? null,
        category: item.category ?? null,
        message: item.message ?? null,
        appVersion: item.context.appVersion,
        platform: item.context.platform,
        osVersion: item.context.osVersion ?? null,
        area: item.context.area ?? null,
        documentFormat: item.context.documentFormat ?? null,
        eventName: item.context.eventName ?? null,
        locale: item.context.locale ?? null,
        diagnosticsConsent: item.diagnosticsConsent,
        followUpConsent: item.followUpConsent,
        status: item.status,
        githubIssueUrl: item.githubIssueUrl ?? null,
        createdAt: Math.floor(item.createdAt / 1000),
      })
      .run();
  }

  async listFeedback(): Promise<readonly Feedback[]> {
    return this.db.select().from(feedbackTable).all().map(this.mapFeedbackFromDb);
  }

  async countFeedbackByStatus(status: FeedbackStatus): Promise<number> {
    const result = this.db
      .select({ total: sql<number>`count(*)` })
      .from(feedbackTable)
      .where(eq(feedbackTable.status, status))
      .get();

    return result?.total ?? 0;
  }

  async updateFeedbackStatus(
    feedbackId: string,
    status: FeedbackStatus,
    githubIssueUrl?: string,
  ): Promise<void> {
    this.db
      .update(feedbackTable)
      .set({
        status,
        ...(githubIssueUrl !== undefined ? { githubIssueUrl } : {}),
      })
      .where(eq(feedbackTable.id, feedbackId))
      .run();
  }

  async removeFeedback(feedbackId: string): Promise<void> {
    this.db.delete(feedbackTable).where(eq(feedbackTable.id, feedbackId)).run();
  }

  // ==================== MAPPING FUNCTIONS ====================
  private mapBookFromDb(row: typeof books.$inferSelect): Book {
    return {
      id: row.id,
      title: row.title,
      author: row.author ?? undefined,
      format: row.format as Book['format'],
      uri: row.uri,
      fileHash: row.fileHash ?? undefined,
      addedAt: row.addedAt,
      lastOpenedAt: row.lastOpenedAt ?? undefined,
      readingStatus: row.readingStatus as Book['readingStatus'],
      language: row.language ?? undefined,
      status: row.status as Book['status'],
      rank: row.rank as Book['rank'],
      coverImage: row.coverImage ?? undefined,
    };
  }

  private mapBookToDb(book: Book) {
    return {
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
      createdAt: Math.floor(Date.now() / 1000),
      updatedAt: Math.floor(Date.now() / 1000),
    };
  }

  private mapProgressFromDb(row: typeof readingProgress.$inferSelect): ReadingProgress {
    return {
      bookId: row.bookId,
      locator: JSON.parse(row.locatorData) as ReadingProgress['locator'],
      percent: row.percent,
      updatedAt: row.updatedAt,
    };
  }

  private mapPreferencesFromDb(row: typeof readerPreferencesTable.$inferSelect): ReaderPreferences {
    return {
      theme: row.theme as ReaderPreferences['theme'],
      backgroundColor: row.backgroundColor,
      foregroundColor: row.foregroundColor,
      accentColor: row.accentColor,
      fontFamily: row.fontFamily as ReaderPreferences['fontFamily'],
      fontScale: row.fontScale,
      lineHeight: row.lineHeight,
      margin: normalizeReaderMargin(row.margin),
      readingDirection: row.readingDirection as ReaderPreferences['readingDirection'],
    };
  }

  private mapPreferencesToDb(preferences: ReaderPreferences) {
    return {
      theme: preferences.theme,
      backgroundColor: preferences.backgroundColor,
      foregroundColor: preferences.foregroundColor,
      accentColor: preferences.accentColor,
      fontFamily: preferences.fontFamily,
      fontScale: preferences.fontScale,
      lineHeight: preferences.lineHeight,
      margin: String(preferences.margin),
      readingDirection: preferences.readingDirection,
    };
  }

  private mapBookPreferencesFromDb(
    row: typeof bookPreferencesTable.$inferSelect,
  ): Partial<ReaderPreferences> {
    const result: {
      theme?: ReaderPreferences['theme'];
      backgroundColor?: string;
      foregroundColor?: string;
      accentColor?: string;
      fontFamily?: ReaderPreferences['fontFamily'];
      fontScale?: number;
      lineHeight?: number;
      margin?: ReaderPreferences['margin'];
      readingDirection?: ReaderPreferences['readingDirection'];
    } = {};

    if (row.theme) result.theme = row.theme as ReaderPreferences['theme'];
    if (row.backgroundColor) result.backgroundColor = row.backgroundColor;
    if (row.foregroundColor) result.foregroundColor = row.foregroundColor;
    if (row.accentColor) result.accentColor = row.accentColor;
    if (row.fontFamily) result.fontFamily = row.fontFamily as ReaderPreferences['fontFamily'];
    if (row.fontScale) result.fontScale = row.fontScale;
    if (row.lineHeight) result.lineHeight = row.lineHeight;
    if (row.margin) result.margin = normalizeReaderMargin(row.margin);
    if (row.readingDirection)
      result.readingDirection = row.readingDirection as ReaderPreferences['readingDirection'];

    return result;
  }

  private mapBookPreferencesToDb(preferences: Partial<ReaderPreferences>) {
    return {
      theme: preferences.theme,
      backgroundColor: preferences.backgroundColor,
      foregroundColor: preferences.foregroundColor,
      accentColor: preferences.accentColor,
      fontFamily: preferences.fontFamily,
      fontScale: preferences.fontScale,
      lineHeight: preferences.lineHeight,
      margin: preferences.margin === undefined ? undefined : String(preferences.margin),
      readingDirection: preferences.readingDirection,
    };
  }

  private mapBookmarkFromDb(row: typeof bookmarksTable.$inferSelect): Bookmark {
    const bookmark: Bookmark = {
      id: row.id,
      bookId: row.bookId,
      locator: JSON.parse(row.locatorData) as Bookmark['locator'],
      createdAt: row.createdAt,
    };
    if (row.label != null) (bookmark as { label?: string }).label = row.label;
    if (row.updatedAt != null) (bookmark as { updatedAt?: number }).updatedAt = row.updatedAt;
    return bookmark;
  }

  private mapNoteFromDb(row: typeof notesTable.$inferSelect): Note {
    const note: Note = {
      id: row.id,
      bookId: row.bookId,
      locator: JSON.parse(row.locatorData) as Note['locator'],
      body: row.body,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
    if (row.selectedText != null)
      (note as { selectedText?: string }).selectedText = row.selectedText;
    return note;
  }

  private mapHighlightFromDb(row: typeof highlightsTable.$inferSelect): Highlight {
    const highlight: Highlight = {
      id: row.id,
      bookId: row.bookId,
      locatorStart: JSON.parse(row.locatorStart) as Highlight['locatorStart'],
      locatorEnd: JSON.parse(row.locatorEnd) as Highlight['locatorEnd'],
      color: row.color,
      style: row.style as Highlight['style'],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
    if (row.selectedText != null)
      (highlight as { selectedText?: string }).selectedText = row.selectedText;
    if (row.note != null) (highlight as { note?: string }).note = row.note;
    return highlight;
  }

  private mapFeedbackFromDb(row: typeof feedbackTable.$inferSelect): Feedback {
    const feedback: Feedback = {
      id: row.id,
      installationId: row.installationId ?? undefined,
      reaction: (row.reaction as Feedback['reaction']) ?? undefined,
      category: (row.category as Feedback['category']) ?? undefined,
      message: row.message ?? undefined,
      context: {
        appVersion: row.appVersion,
        platform: row.platform as Feedback['context']['platform'],
        osVersion: row.osVersion ?? undefined,
        area: (row.area as Feedback['context']['area']) ?? undefined,
        documentFormat: (row.documentFormat as Feedback['context']['documentFormat']) ?? undefined,
        eventName: row.eventName ?? undefined,
        locale: row.locale ?? undefined,
      },
      diagnosticsConsent: row.diagnosticsConsent,
      followUpConsent: row.followUpConsent,
      status: row.status as FeedbackStatus,
      githubIssueUrl: row.githubIssueUrl ?? undefined,
      createdAt: row.createdAt * 1000,
    };
    return feedback;
  }
}
