import {
  Bookmark,
  Book,
  createDefaultPreferences,
  createDefaultUserSettings,
  DomainValidationError,
  Highlight,
  normalizeReaderMargin,
  Note,
  ReaderPreferences,
  ReadingProgress,
  UserSettings,
  validateReaderPreferences,
} from '@clio-reader/domain';

export const CURRENT_SCHEMA_VERSION = 3;
const DEFAULT_STATE_KEY = 'clio-reader.state';

type StoredPreferences = {
  global: ReaderPreferences;
  byBook: Record<string, Partial<ReaderPreferences>>;
};

export interface PersistenceState {
  schemaVersion: number;
  books: Book[];
  progress: ReadingProgress[];
  preferences: StoredPreferences;
  bookmarks: Bookmark[];
  notes: Note[];
  highlights: Highlight[];
  userSettings: UserSettings;
}

export interface KeyValueStore {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export class InMemoryKeyValueStore implements KeyValueStore {
  private readonly values = new Map<string, string>();

  async get(key: string): Promise<string | undefined> {
    return this.values.get(key);
  }

  async set(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async remove(key: string): Promise<void> {
    this.values.delete(key);
  }
}

export class PersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PersistenceError';
  }
}

export class LocalRepository {
  constructor(
    private readonly store: KeyValueStore,
    private readonly stateKey = DEFAULT_STATE_KEY,
  ) {}

  async getState(): Promise<PersistenceState> {
    const serialized = await this.store.get(this.stateKey);
    if (!serialized) {
      return createInitialState();
    }

    try {
      return migrateState(JSON.parse(serialized) as unknown);
    } catch (error) {
      if (error instanceof PersistenceError) {
        throw error;
      }
      throw new PersistenceError('Stored state is not valid JSON');
    }
  }

  async saveState(state: PersistenceState): Promise<void> {
    await this.store.set(this.stateKey, JSON.stringify(migrateState(state)));
  }

  async listBooks(): Promise<readonly Book[]> {
    return (await this.getState()).books;
  }

  async getBook(bookId: string): Promise<Book | undefined> {
    return (await this.getState()).books.find((b) => b.id === bookId);
  }

  async upsertBook(book: Book): Promise<void> {
    const state = await this.getState();
    const index = state.books.findIndex((item) => item.id === book.id);
    if (index === -1) {
      state.books.push(book);
    } else {
      state.books[index] = book;
    }
    await this.saveState(state);
  }

  async removeBook(bookId: string): Promise<void> {
    const state = await this.getState();
    state.books = state.books.filter((book) => book.id !== bookId);
    state.progress = state.progress.filter((item) => item.bookId !== bookId);
    state.bookmarks = state.bookmarks.filter((item) => item.bookId !== bookId);
    state.notes = state.notes.filter((item) => item.bookId !== bookId);
    state.highlights = state.highlights.filter((item) => item.bookId !== bookId);
    delete state.preferences.byBook[bookId];
    await this.saveState(state);
  }

  async getProgress(bookId: string): Promise<ReadingProgress | undefined> {
    return (await this.getState()).progress.find((item) => item.bookId === bookId);
  }

  async saveProgress(progress: ReadingProgress): Promise<void> {
    const state = await this.getState();
    const index = state.progress.findIndex((item) => item.bookId === progress.bookId);
    if (index === -1) {
      state.progress.push(progress);
    } else {
      state.progress[index] = progress;
    }
    await this.saveState(state);
  }

  async getGlobalPreferences(): Promise<ReaderPreferences> {
    return (await this.getState()).preferences.global;
  }

  async saveGlobalPreferences(preferences: ReaderPreferences): Promise<void> {
    validateReaderPreferences(preferences);
    const state = await this.getState();
    state.preferences.global = { ...preferences };
    await this.saveState(state);
  }

  async getBookPreferences(bookId: string): Promise<Partial<ReaderPreferences>> {
    return (await this.getState()).preferences.byBook[bookId] ?? {};
  }

  async saveBookPreferences(
    bookId: string,
    preferences: Partial<ReaderPreferences>,
  ): Promise<void> {
    const state = await this.getState();
    const merged = { ...state.preferences.global, ...preferences };
    validateReaderPreferences(merged);
    state.preferences.byBook[bookId] = { ...preferences };
    await this.saveState(state);
  }

  async listAllBookmarks(): Promise<readonly Bookmark[]> {
    return (await this.getState()).bookmarks;
  }

  async listBookmarks(bookId: string): Promise<readonly Bookmark[]> {
    return (await this.getState()).bookmarks.filter((item) => item.bookId === bookId);
  }

  async saveBookmark(bookmark: Bookmark): Promise<void> {
    const state = await this.getState();
    const index = state.bookmarks.findIndex((item) => item.id === bookmark.id);
    if (index === -1) {
      state.bookmarks.push(bookmark);
    } else {
      state.bookmarks[index] = bookmark;
    }
    await this.saveState(state);
  }

  async removeBookmark(bookmarkId: string): Promise<void> {
    const state = await this.getState();
    state.bookmarks = state.bookmarks.filter((item) => item.id !== bookmarkId);
    await this.saveState(state);
  }

  async listAllProgress(): Promise<readonly ReadingProgress[]> {
    return (await this.getState()).progress;
  }

  async listNotes(bookId: string): Promise<readonly Note[]> {
    return (await this.getState()).notes.filter((item) => item.bookId === bookId);
  }

  async saveNote(note: Note): Promise<void> {
    if (note.body.trim().length === 0) {
      throw new DomainValidationError('Note body must not be empty');
    }
    const state = await this.getState();
    const index = state.notes.findIndex((item) => item.id === note.id);
    if (index === -1) {
      state.notes.push(note);
    } else {
      state.notes[index] = note;
    }
    await this.saveState(state);
  }

  async removeNote(noteId: string): Promise<void> {
    const state = await this.getState();
    state.notes = state.notes.filter((item) => item.id !== noteId);
    await this.saveState(state);
  }

  async listHighlights(bookId: string): Promise<readonly Highlight[]> {
    return (await this.getState()).highlights.filter((item) => item.bookId === bookId);
  }

  async saveHighlight(highlight: Highlight): Promise<void> {
    const state = await this.getState();
    const index = state.highlights.findIndex((item) => item.id === highlight.id);
    if (index === -1) {
      state.highlights.push(highlight);
    } else {
      state.highlights[index] = highlight;
    }
    await this.saveState(state);
  }

  async removeHighlight(highlightId: string): Promise<void> {
    const state = await this.getState();
    state.highlights = state.highlights.filter((item) => item.id !== highlightId);
    await this.saveState(state);
  }

  async getUserSettings(): Promise<UserSettings> {
    return (await this.getState()).userSettings;
  }

  async saveUserSettings(settings: UserSettings): Promise<void> {
    const state = await this.getState();
    state.userSettings = { ...settings };
    await this.saveState(state);
  }
}

export function createInitialState(): PersistenceState {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    books: [],
    progress: [],
    preferences: {
      global: createDefaultPreferences(),
      byBook: {},
    },
    bookmarks: [],
    notes: [],
    highlights: [],
    userSettings: createDefaultUserSettings(),
  };
}

function normalizeStoredPreferences(preferences: ReaderPreferences): ReaderPreferences {
  return { ...preferences, margin: normalizeReaderMargin(preferences.margin) };
}

function normalizeStoredBookPreferences(
  raw: Record<string, unknown>,
): Record<string, Partial<ReaderPreferences>> {
  const result: Record<string, Partial<ReaderPreferences>> = {};
  for (const [bookId, value] of Object.entries(raw)) {
    if (!isRecord(value)) continue;
    const preferences = { ...(value as Partial<ReaderPreferences>) };
    if (preferences.margin !== undefined) {
      preferences.margin = normalizeReaderMargin(preferences.margin);
    }
    result[bookId] = preferences;
  }
  return result;
}

export function migrateState(input: unknown): PersistenceState {
  if (!isRecord(input)) {
    throw new PersistenceError('Stored state must be an object');
  }

  const initial = createInitialState();
  const candidate = input as Partial<PersistenceState>;
  const rawPreferences: Record<string, unknown> = isRecord(candidate.preferences)
    ? candidate.preferences
    : {};
  const global = isRecord(rawPreferences.global)
    ? normalizeStoredPreferences({
        ...initial.preferences.global,
        ...rawPreferences.global,
      } as ReaderPreferences)
    : initial.preferences.global;
  validateReaderPreferences(global);

  const rawUserSettings: Record<string, unknown> = isRecord(candidate.userSettings)
    ? candidate.userSettings
    : {};

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    books: Array.isArray(candidate.books) ? candidate.books : [],
    progress: Array.isArray(candidate.progress) ? candidate.progress : [],
    preferences: {
      global,
      byBook: isRecord(rawPreferences.byBook)
        ? normalizeStoredBookPreferences(rawPreferences.byBook)
        : {},
    },
    bookmarks: Array.isArray(candidate.bookmarks) ? candidate.bookmarks : [],
    notes: Array.isArray(candidate.notes) ? candidate.notes : [],
    highlights: Array.isArray(candidate.highlights) ? candidate.highlights : [],
    userSettings: {
      paletteId:
        typeof rawUserSettings.paletteId === 'string'
          ? rawUserSettings.paletteId
          : initial.userSettings.paletteId,
      mode:
        rawUserSettings.mode === 'dark' || rawUserSettings.mode === 'light'
          ? rawUserSettings.mode
          : initial.userSettings.mode,
      ...(typeof rawUserSettings.locale === 'string' &&
        rawUserSettings.locale.length > 0 && {
          locale: rawUserSettings.locale,
        }),
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
