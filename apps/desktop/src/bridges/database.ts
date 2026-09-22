import type { LibraryRepository } from '@clio-reader/library';
import type {
  Bookmark,
  Book,
  Highlight,
  Note,
  ReaderPreferences,
  ReadingProgress,
  UserSettings,
} from '@clio-reader/domain';

export function createDatabaseBridge(): LibraryRepository {
  const api = window.electronAPI;

  return {
    listBooks: () => api.repo.listBooks() as Promise<readonly Book[]>,
    getBook: (bookId) => api.repo.getBook(bookId) as Promise<Book | undefined>,
    upsertBook: (book) => api.repo.upsertBook(book),
    removeBook: (bookId) => api.repo.removeBook(bookId),
    getProgress: (bookId) => api.repo.getProgress(bookId) as Promise<ReadingProgress | undefined>,
    saveProgress: (progress) => api.repo.saveProgress(progress),
    listAllProgress: () => api.repo.listAllProgress() as Promise<readonly ReadingProgress[]>,
    getGlobalPreferences: () => api.repo.getGlobalPreferences() as Promise<ReaderPreferences>,
    saveGlobalPreferences: (preferences) => api.repo.saveGlobalPreferences(preferences),
    getBookPreferences: (bookId) =>
      api.repo.getBookPreferences(bookId) as Promise<Partial<ReaderPreferences>>,
    saveBookPreferences: (bookId, preferences) => api.repo.saveBookPreferences(bookId, preferences),
    listAllBookmarks: () => api.repo.listAllBookmarks() as Promise<readonly Bookmark[]>,
    listBookmarks: (bookId) => api.repo.listBookmarks(bookId) as Promise<readonly Bookmark[]>,
    saveBookmark: (bookmark) => api.repo.saveBookmark(bookmark),
    removeBookmark: (bookmarkId) => api.repo.removeBookmark(bookmarkId),
    listNotes: (bookId) => api.repo.listNotes(bookId) as Promise<readonly Note[]>,
    saveNote: (note) => api.repo.saveNote(note),
    removeNote: (noteId) => api.repo.removeNote(noteId),
    listHighlights: (bookId) => api.repo.listHighlights(bookId) as Promise<readonly Highlight[]>,
    saveHighlight: (highlight) => api.repo.saveHighlight(highlight),
    removeHighlight: (highlightId) => api.repo.removeHighlight(highlightId),
    getUserSettings: () => api.repo.getUserSettings() as Promise<UserSettings>,
    saveUserSettings: (settings) => api.repo.saveUserSettings(settings),
  };
}
