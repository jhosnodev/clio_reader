import type {
  Bookmark,
  Book,
  Highlight,
  Note,
  ReaderPreferences,
  ReadingProgress,
  UserSettings,
} from '@clio-reader/domain';

export interface LibraryRepository {
  listBooks(): Promise<readonly Book[]>;
  getBook(bookId: string): Promise<Book | undefined>;
  upsertBook(book: Book): Promise<void>;
  removeBook(bookId: string): Promise<void>;
  getProgress(bookId: string): Promise<ReadingProgress | undefined>;
  saveProgress(progress: ReadingProgress): Promise<void>;
  getGlobalPreferences(): Promise<ReaderPreferences>;
  saveGlobalPreferences(preferences: ReaderPreferences): Promise<void>;
  getBookPreferences(bookId: string): Promise<Partial<ReaderPreferences>>;
  saveBookPreferences(bookId: string, preferences: Partial<ReaderPreferences>): Promise<void>;
  listAllBookmarks(): Promise<readonly Bookmark[]>;
  listBookmarks(bookId: string): Promise<readonly Bookmark[]>;
  saveBookmark(bookmark: Bookmark): Promise<void>;
  removeBookmark(bookmarkId: string): Promise<void>;
  listAllProgress(): Promise<readonly ReadingProgress[]>;
  listNotes(bookId: string): Promise<readonly Note[]>;
  saveNote(note: Note): Promise<void>;
  removeNote(noteId: string): Promise<void>;
  listHighlights(bookId: string): Promise<readonly Highlight[]>;
  saveHighlight(highlight: Highlight): Promise<void>;
  removeHighlight(highlightId: string): Promise<void>;
  getUserSettings(): Promise<UserSettings>;
  saveUserSettings(settings: UserSettings): Promise<void>;
}
