// CommonJS preload script - must be .cjs because package.json has "type": "module"
// Electron loads preload scripts via require(), which cannot load ES modules.
const { contextBridge, ipcRenderer } = require('electron');

const electronAPI = {
  pickFile: () => {
    return ipcRenderer.invoke('pick-file');
  },

  pickFolder: () => {
    return ipcRenderer.invoke('pick-folder');
  },

  readFolderBooks: (folderPath) => {
    return ipcRenderer.invoke('read-folder-books', folderPath);
  },

  readFile: (uri) => {
    return ipcRenderer.invoke('read-file', uri);
  },

  writeFileTemp: (buffer, ext) => {
    return ipcRenderer.invoke('write-file-temp', buffer, ext);
  },

  readStorage: (key) => {
    return ipcRenderer.invoke('read-storage', key);
  },

  writeStorage: (key, value) => {
    return ipcRenderer.invoke('write-storage', key, value);
  },

  deleteStorage: (key) => {
    return ipcRenderer.invoke('delete-storage', key);
  },

  getStoragePath: () => {
    return ipcRenderer.invoke('get-storage-path');
  },

  checkFileExists: (uri) => {
    return ipcRenderer.invoke('check-file-exists', uri);
  },

  onSuspend: (callback) => {
    ipcRenderer.on('app-suspend', () => callback());
  },

  onResume: (callback) => {
    ipcRenderer.on('app-resume', () => callback());
  },

  saveFile: (data) => {
    return ipcRenderer.invoke('save-file', data);
  },
  openFile: (data) => {
    return ipcRenderer.invoke('open-file', data);
  },
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },

  getAppInfo: () => {
    return ipcRenderer.invoke('get-app-info');
  },

  repo: {
    listBooks: () => {
      return ipcRenderer.invoke('repo:list-books');
    },

    getBook: (bookId) => {
      return ipcRenderer.invoke('repo:get-book', bookId);
    },

    upsertBook: (book) => {
      return ipcRenderer.invoke('repo:upsert-book', book);
    },

    removeBook: (bookId) => {
      return ipcRenderer.invoke('repo:remove-book', bookId);
    },

    getProgress: (bookId) => {
      return ipcRenderer.invoke('repo:get-progress', bookId);
    },

    saveProgress: (progress) => {
      return ipcRenderer.invoke('repo:save-progress', progress);
    },

    listAllProgress: () => {
      return ipcRenderer.invoke('repo:list-all-progress');
    },

    getGlobalPreferences: () => {
      return ipcRenderer.invoke('repo:get-global-preferences');
    },

    saveGlobalPreferences: (preferences) => {
      return ipcRenderer.invoke('repo:save-global-preferences', preferences);
    },

    getBookPreferences: (bookId) => {
      return ipcRenderer.invoke('repo:get-book-preferences', bookId);
    },

    saveBookPreferences: (bookId, preferences) => {
      return ipcRenderer.invoke('repo:save-book-preferences', bookId, preferences);
    },

    listAllBookmarks: () => {
      return ipcRenderer.invoke('repo:list-all-bookmarks');
    },

    listBookmarks: (bookId) => {
      return ipcRenderer.invoke('repo:list-bookmarks', bookId);
    },

    saveBookmark: (bookmark) => {
      return ipcRenderer.invoke('repo:save-bookmark', bookmark);
    },

    removeBookmark: (bookmarkId) => {
      return ipcRenderer.invoke('repo:remove-bookmark', bookmarkId);
    },

    listNotes: (bookId) => {
      return ipcRenderer.invoke('repo:list-notes', bookId);
    },

    saveNote: (note) => {
      return ipcRenderer.invoke('repo:save-note', note);
    },

    removeNote: (noteId) => {
      return ipcRenderer.invoke('repo:remove-note', noteId);
    },

    listHighlights: (bookId) => {
      return ipcRenderer.invoke('repo:list-highlights', bookId);
    },

    saveHighlight: (highlight) => {
      return ipcRenderer.invoke('repo:save-highlight', highlight);
    },

    removeHighlight: (highlightId) => {
      return ipcRenderer.invoke('repo:remove-highlight', highlightId);
    },

    getUserSettings: () => {
      return ipcRenderer.invoke('repo:get-user-settings');
    },

    saveUserSettings: (settings) => {
      return ipcRenderer.invoke('repo:save-user-settings', settings);
    },

    saveFeedback: (feedback) => {
      return ipcRenderer.invoke('repo:save-feedback', feedback);
    },

    listFeedback: () => {
      return ipcRenderer.invoke('repo:list-feedback');
    },

    countFeedbackByStatus: (status) => {
      return ipcRenderer.invoke('repo:count-feedback-by-status', status);
    },

    updateFeedbackStatus: (feedbackId, status, githubIssueUrl) => {
      return ipcRenderer.invoke('repo:update-feedback-status', feedbackId, status, githubIssueUrl);
    },

    deleteFeedback: (feedbackId) => {
      return ipcRenderer.invoke('repo:delete-feedback', feedbackId);
    },
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
