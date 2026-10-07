import { contextBridge, ipcRenderer } from 'electron';

const electronAPI = {
  pickFile: (): Promise<Array<{ uri: string; name: string; filePath: string }> | null> => {
    return ipcRenderer.invoke('pick-file');
  },

  pickFolder: (): Promise<string | null> => {
    return ipcRenderer.invoke('pick-folder');
  },

  readFolderBooks: (
    folderPath: string,
  ): Promise<Array<{ uri: string; name: string; filePath: string }>> => {
    return ipcRenderer.invoke('read-folder-books', folderPath);
  },

  readFile: (uri: string): Promise<ArrayBuffer> => {
    return ipcRenderer.invoke('read-file', uri);
  },

  writeFileTemp: (buffer: ArrayBuffer, ext: string): Promise<string> => {
    return ipcRenderer.invoke('write-file-temp', buffer, ext);
  },

  readStorage: (key: string): Promise<string | undefined> => {
    return ipcRenderer.invoke('read-storage', key);
  },

  writeStorage: (key: string, value: string): Promise<void> => {
    return ipcRenderer.invoke('write-storage', key, value);
  },

  deleteStorage: (key: string): Promise<void> => {
    return ipcRenderer.invoke('delete-storage', key);
  },

  getStoragePath: (): Promise<string> => {
    return ipcRenderer.invoke('get-storage-path');
  },

  checkFileExists: (uri: string): Promise<{ exists: boolean }> => {
    return ipcRenderer.invoke('check-file-exists', uri);
  },

  onSuspend: (callback: () => void): void => {
    ipcRenderer.on('app-suspend', () => callback());
  },

  onResume: (callback: () => void): void => {
    ipcRenderer.on('app-resume', () => callback());
  },

  removeAllListeners: (channel: string): void => {
    ipcRenderer.removeAllListeners(channel);
  },

  repo: {
    listBooks: (): Promise<readonly unknown[]> => {
      return ipcRenderer.invoke('repo:list-books');
    },

    getBook: (bookId: string): Promise<unknown | undefined> => {
      return ipcRenderer.invoke('repo:get-book', bookId);
    },

    upsertBook: (book: unknown): Promise<void> => {
      return ipcRenderer.invoke('repo:upsert-book', book);
    },

    removeBook: (bookId: string): Promise<void> => {
      return ipcRenderer.invoke('repo:remove-book', bookId);
    },

    getProgress: (bookId: string): Promise<unknown | undefined> => {
      return ipcRenderer.invoke('repo:get-progress', bookId);
    },

    saveProgress: (progress: unknown): Promise<void> => {
      return ipcRenderer.invoke('repo:save-progress', progress);
    },

    listAllProgress: (): Promise<readonly unknown[]> => {
      return ipcRenderer.invoke('repo:list-all-progress');
    },

    getGlobalPreferences: (): Promise<unknown> => {
      return ipcRenderer.invoke('repo:get-global-preferences');
    },

    saveGlobalPreferences: (preferences: unknown): Promise<void> => {
      return ipcRenderer.invoke('repo:save-global-preferences', preferences);
    },

    getBookPreferences: (bookId: string): Promise<unknown> => {
      return ipcRenderer.invoke('repo:get-book-preferences', bookId);
    },

    saveBookPreferences: (bookId: string, preferences: unknown): Promise<void> => {
      return ipcRenderer.invoke('repo:save-book-preferences', bookId, preferences);
    },

    listAllBookmarks: (): Promise<readonly unknown[]> => {
      return ipcRenderer.invoke('repo:list-all-bookmarks');
    },

    listBookmarks: (bookId: string): Promise<readonly unknown[]> => {
      return ipcRenderer.invoke('repo:list-bookmarks', bookId);
    },

    saveBookmark: (bookmark: unknown): Promise<void> => {
      return ipcRenderer.invoke('repo:save-bookmark', bookmark);
    },

    removeBookmark: (bookmarkId: string): Promise<void> => {
      return ipcRenderer.invoke('repo:remove-bookmark', bookmarkId);
    },

    listNotes: (bookId: string): Promise<readonly unknown[]> => {
      return ipcRenderer.invoke('repo:list-notes', bookId);
    },

    saveNote: (note: unknown): Promise<void> => {
      return ipcRenderer.invoke('repo:save-note', note);
    },

    removeNote: (noteId: string): Promise<void> => {
      return ipcRenderer.invoke('repo:remove-note', noteId);
    },

    listHighlights: (bookId: string): Promise<readonly unknown[]> => {
      return ipcRenderer.invoke('repo:list-highlights', bookId);
    },

    saveHighlight: (highlight: unknown): Promise<void> => {
      return ipcRenderer.invoke('repo:save-highlight', highlight);
    },

    removeHighlight: (highlightId: string): Promise<void> => {
      return ipcRenderer.invoke('repo:remove-highlight', highlightId);
    },

    getUserSettings: (): Promise<unknown> => {
      return ipcRenderer.invoke('repo:get-user-settings');
    },

    saveUserSettings: (settings: unknown): Promise<void> => {
      return ipcRenderer.invoke('repo:save-user-settings', settings);
    },
  },
};

export type ElectronAPI = typeof electronAPI;
contextBridge.exposeInMainWorld('electronAPI', electronAPI);
