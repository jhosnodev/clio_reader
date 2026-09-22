/// <reference types="vite/client" />

interface ElectronAPI {
  pickFile(): Promise<Array<{ uri: string; name: string; filePath: string }> | null>;
  pickFolder(): Promise<string | null>;
  readFolderBooks(
    folderPath: string,
  ): Promise<Array<{ uri: string; name: string; filePath: string }>>;
  readFile(uri: string): Promise<ArrayBuffer>;
  writeFileTemp(buffer: ArrayBuffer, ext: string): Promise<string>;
  readStorage(key: string): Promise<string | undefined>;
  writeStorage(key: string, value: string): Promise<void>;
  deleteStorage(key: string): Promise<void>;
  getStoragePath(): Promise<string>;
  checkFileExists(uri: string): Promise<{ exists: boolean }>;
  onSuspend(callback: () => void): void;
  onResume(callback: () => void): void;
  removeAllListeners(channel: string): void;
  repo: {
    listBooks(): Promise<readonly unknown[]>;
    getBook(bookId: string): Promise<unknown | undefined>;
    upsertBook(book: unknown): Promise<void>;
    removeBook(bookId: string): Promise<void>;
    getProgress(bookId: string): Promise<unknown | undefined>;
    saveProgress(progress: unknown): Promise<void>;
    listAllProgress(): Promise<readonly unknown[]>;
    getGlobalPreferences(): Promise<unknown>;
    saveGlobalPreferences(preferences: unknown): Promise<void>;
    getBookPreferences(bookId: string): Promise<unknown>;
    saveBookPreferences(bookId: string, preferences: unknown): Promise<void>;
    listAllBookmarks(): Promise<readonly unknown[]>;
    listBookmarks(bookId: string): Promise<readonly unknown[]>;
    saveBookmark(bookmark: unknown): Promise<void>;
    removeBookmark(bookmarkId: string): Promise<void>;
    listNotes(bookId: string): Promise<readonly unknown[]>;
    saveNote(note: unknown): Promise<void>;
    removeNote(noteId: string): Promise<void>;
    listHighlights(bookId: string): Promise<readonly unknown[]>;
    saveHighlight(highlight: unknown): Promise<void>;
    removeHighlight(highlightId: string): Promise<void>;
    getUserSettings(): Promise<unknown>;
    saveUserSettings(settings: unknown): Promise<void>;
  };
}

interface Window {
  electronAPI: ElectronAPI;
}
