import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { join, dirname, extname } from 'path';
import { readFile, writeFile, mkdir, access, constants, readdir } from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import { tmpdir, release } from 'os';
import { randomUUID } from 'crypto';
import type { FeedbackStatus } from '@clio-reader/domain';
import {
  createDatabase,
  DrizzleRepository,
  migrateJsonToSqlite,
} from '@clio-reader/storage/drizzle';
import Database from 'better-sqlite3';

const __dirname = globalThis.__dirname ?? dirname(process.argv[1] ?? '');
const isDev = !app.isPackaged;

app.setName('clio-reader');

if (isDev) {
  app.setPath('userData', `${app.getPath('userData')}-dev`);
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  let mainWindow: BrowserWindow | null = null;
  let repository: DrizzleRepository | null = null;

  function getDataPath(): string {
    const userDataPath = app.getPath('userData');
    return join(userDataPath, 'clio-reader');
  }

  function getStoragePath(): string {
    return getDataPath();
  }

  function getDbPath(): string {
    return join(getDataPath(), 'clio.db');
  }

  function getJsonStatePath(): string {
    return join(getDataPath(), 'clio-reader.state.json');
  }

  function getJsonBackupPath(): string {
    return join(getDataPath(), 'clio-reader.state.backup.json');
  }

  async function ensureDataDir(): Promise<void> {
    const dataPath = getDataPath();
    if (!existsSync(dataPath)) {
      await mkdir(dataPath, { recursive: true });
    }
  }

  function initDatabase(): DrizzleRepository {
    const dbPath = getDbPath();

    const migrationPath = join(__dirname, '0000_initial.sql');
    if (existsSync(migrationPath)) {
      const sqlite = new Database(dbPath);
      sqlite.pragma('journal_mode = WAL');
      sqlite.pragma('foreign_keys = ON');
      const migrationSQL = readFileSync(migrationPath, 'utf-8');
      sqlite.exec(migrationSQL);
      sqlite.close();
    }

    const db = createDatabase(dbPath);
    return new DrizzleRepository(db);
  }

  async function migrateExistingJson(): Promise<void> {
    if (!repository) return;

    const jsonPath = getJsonStatePath();
    const backupPath = getJsonBackupPath();

    if (existsSync(jsonPath)) {
      console.log('[main] Found existing JSON state, migrating to SQLite...');

      try {
        const result = await migrateJsonToSqlite(repository.rawDb, {
          jsonPath,
          backupPath,
        });

        if (result.migrated) {
          console.log(
            `[main] Migration complete: ${result.booksCount} books, ${result.notesCount} notes, ${result.bookmarksCount} bookmarks, ${result.highlightsCount} highlights`,
          );
        }
      } catch (err) {
        console.error('[main] Migration failed:', err);
      }
    }
  }

  function createWindow(): void {
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      title: 'Clio Reader',
      show: false,
      ...(isDev ? { icon: join(__dirname, '../resources/icon.png') } : {}),
      webPreferences: {
        preload: join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        webviewTag: true,
      },
    });

    if (isDev) {
      mainWindow.loadURL('http://localhost:5173');
      mainWindow.webContents.openDevTools();
    } else {
      mainWindow.loadFile(join(__dirname, '../dist/index.html'));
    }

    mainWindow.once('ready-to-show', () => {
      mainWindow?.show();
    });

    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  }

  function setupIpcHandlers(): void {
    ipcMain.handle('pick-file', async () => {
      console.log('[main] pick-file handler invoked');
      try {
        if (!mainWindow) {
          console.error('[main] mainWindow is null');
          return null;
        }
        const result = await dialog.showOpenDialog(mainWindow, {
          title: 'Select a book',
          filters: [
            { name: 'Books', extensions: ['epub', 'pdf', 'cbz', 'md'] },
            { name: 'EPUB', extensions: ['epub'] },
            { name: 'PDF', extensions: ['pdf'] },
            { name: 'CBZ', extensions: ['cbz'] },
            { name: 'Markdown', extensions: ['md'] },
          ],
          properties: ['openFile', 'multiSelections'],
        });

        console.log('[main] dialog result:', result);

        if (result.canceled || result.filePaths.length === 0) {
          return null;
        }

        return result.filePaths.map((filePath) => ({
          uri: `file://${filePath}`,
          name: filePath.split(/[\\/]/).pop() ?? 'unknown',
          filePath,
        }));
      } catch (err) {
        console.error('[main] pick-file error:', err);
        return null;
      }
    });

    ipcMain.handle('pick-folder', async () => {
      console.log('[main] pick-folder handler invoked');
      try {
        if (!mainWindow) {
          console.error('[main] mainWindow is null');
          return null;
        }
        const result = await dialog.showOpenDialog(mainWindow, {
          title: 'Select a folder with books',
          properties: ['openDirectory'],
        });

        console.log('[main] folder dialog result:', result);

        if (result.canceled || result.filePaths.length === 0) {
          return null;
        }

        return result.filePaths[0] ?? null;
      } catch (err) {
        console.error('[main] pick-folder error:', err);
        return null;
      }
    });

    ipcMain.handle('read-folder-books', async (_event, folderPath: string) => {
      console.log('[main] read-folder-books handler invoked for:', folderPath);
      try {
        const supportedExtensions = new Set(['.epub', '.pdf', '.cbz', '.md']);
        const entries = await readdir(folderPath, { withFileTypes: true });
        const files: { uri: string; name: string; filePath: string }[] = [];

        for (const entry of entries) {
          if (entry.isFile()) {
            const ext = extname(entry.name).toLowerCase();
            if (supportedExtensions.has(ext)) {
              const filePath = join(folderPath, entry.name);
              files.push({
                uri: `file://${filePath}`,
                name: entry.name,
                filePath,
              });
            }
          }
        }

        console.log('[main] found', files.length, 'supported books in folder');
        return files;
      } catch (err) {
        console.error('[main] read-folder-books error:', err);
        return [];
      }
    });

    ipcMain.handle('read-file', async (_event, uri: string) => {
      const filePath = uri.startsWith('file://') ? uri.slice(7) : uri;
      const buffer = await readFile(filePath);
      return buffer;
    });

    ipcMain.handle('write-file-temp', async (_event, buffer: ArrayBuffer, ext: string) => {
      const tempDir = join(tmpdir(), 'clio-reader');
      if (!existsSync(tempDir)) {
        await mkdir(tempDir, { recursive: true });
      }
      const fileName = `${randomUUID()}.${ext}`;
      const tempPath = join(tempDir, fileName);
      await writeFile(tempPath, Buffer.from(buffer));
      return tempPath;
    });

    ipcMain.handle('read-storage', async (_event, key: string) => {
      await ensureDataDir();
      const filePath = join(getDataPath(), `${key}.json`);
      if (!existsSync(filePath)) {
        return undefined;
      }
      const content = await readFile(filePath, 'utf-8');
      return content;
    });

    ipcMain.handle('write-storage', async (_event, key: string, value: string) => {
      await ensureDataDir();
      const filePath = join(getDataPath(), `${key}.json`);
      await writeFile(filePath, value, 'utf-8');
    });

    ipcMain.handle('delete-storage', async (_event, key: string) => {
      await ensureDataDir();
      const filePath = join(getDataPath(), `${key}.json`);
      if (existsSync(filePath)) {
        await import('fs/promises').then((fs) => fs.unlink(filePath));
      }
    });

    ipcMain.handle('get-storage-path', () => {
      return getStoragePath();
    });

    ipcMain.handle('check-file-exists', async (_event, uri: string) => {
      try {
        const filePath = uri.startsWith('file://') ? uri.slice(7) : uri;
        const normalizedPath =
          process.platform === 'win32' && filePath.startsWith('/') ? filePath.slice(1) : filePath;
        await access(normalizedPath, constants.F_OK);
        return { exists: true };
      } catch {
        return { exists: false };
      }
    });
    ipcMain.handle('save-file', async (_event, data: { defaultPath: string; content: string }) => {
      if (!mainWindow) return null;
      const result = await dialog.showSaveDialog(mainWindow, {
        defaultPath: data.defaultPath,
        filters: [
          { name: 'Markdown', extensions: ['md'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });
      if (result.canceled || !result.filePath) return null;
      await writeFile(result.filePath, data.content, 'utf-8');
      return result.filePath;
    });

    ipcMain.handle(
      'open-file',
      async (_event, data?: { filters?: Array<{ name: string; extensions: string[] }> }) => {
        if (!mainWindow) return null;
        const result = await dialog.showOpenDialog(mainWindow, {
          filters: data?.filters ?? [{ name: 'Markdown', extensions: ['md'] }],
          properties: ['openFile'],
        });
        if (result.canceled || result.filePaths.length === 0) return null;
        const filePath = result.filePaths[0]!;
        const content = await readFile(filePath, 'utf-8');
        return { filePath, content };
      },
    );

    ipcMain.handle('repo:list-books', async () => {
      if (!repository) throw new Error('Database not initialized');
      return repository.listBooks();
    });

    ipcMain.handle('repo:get-book', async (_event, bookId: string) => {
      if (!repository) throw new Error('Database not initialized');
      return repository.getBook(bookId);
    });

    ipcMain.handle('repo:upsert-book', async (_event, book) => {
      if (!repository) throw new Error('Database not initialized');
      await repository.upsertBook(book);
    });

    ipcMain.handle('repo:remove-book', async (_event, bookId: string) => {
      if (!repository) throw new Error('Database not initialized');
      await repository.removeBook(bookId);
    });

    ipcMain.handle('repo:get-progress', async (_event, bookId: string) => {
      if (!repository) throw new Error('Database not initialized');
      return repository.getProgress(bookId);
    });

    ipcMain.handle('repo:save-progress', async (_event, progress) => {
      if (!repository) throw new Error('Database not initialized');
      await repository.saveProgress(progress);
    });

    ipcMain.handle('repo:list-all-progress', async () => {
      if (!repository) throw new Error('Database not initialized');
      return repository.listAllProgress();
    });

    ipcMain.handle('repo:get-global-preferences', async () => {
      if (!repository) throw new Error('Database not initialized');
      return repository.getGlobalPreferences();
    });

    ipcMain.handle('repo:save-global-preferences', async (_event, preferences) => {
      if (!repository) throw new Error('Database not initialized');
      await repository.saveGlobalPreferences(preferences);
    });

    ipcMain.handle('repo:get-book-preferences', async (_event, bookId: string) => {
      if (!repository) throw new Error('Database not initialized');
      return repository.getBookPreferences(bookId);
    });

    ipcMain.handle('repo:save-book-preferences', async (_event, bookId: string, preferences) => {
      if (!repository) throw new Error('Database not initialized');
      await repository.saveBookPreferences(bookId, preferences);
    });

    ipcMain.handle('repo:list-all-bookmarks', async () => {
      if (!repository) throw new Error('Database not initialized');
      return repository.listAllBookmarks();
    });

    ipcMain.handle('repo:list-bookmarks', async (_event, bookId: string) => {
      if (!repository) throw new Error('Database not initialized');
      return repository.listBookmarks(bookId);
    });

    ipcMain.handle('repo:save-bookmark', async (_event, bookmark) => {
      if (!repository) throw new Error('Database not initialized');
      await repository.saveBookmark(bookmark);
    });

    ipcMain.handle('repo:remove-bookmark', async (_event, bookmarkId: string) => {
      if (!repository) throw new Error('Database not initialized');
      await repository.removeBookmark(bookmarkId);
    });

    ipcMain.handle('repo:list-notes', async (_event, bookId: string) => {
      if (!repository) throw new Error('Database not initialized');
      return repository.listNotes(bookId);
    });

    ipcMain.handle('repo:save-note', async (_event, note) => {
      if (!repository) throw new Error('Database not initialized');
      await repository.saveNote(note);
    });

    ipcMain.handle('repo:remove-note', async (_event, noteId: string) => {
      if (!repository) throw new Error('Database not initialized');
      await repository.removeNote(noteId);
    });

    ipcMain.handle('repo:list-highlights', async (_event, bookId: string) => {
      if (!repository) throw new Error('Database not initialized');
      return repository.listHighlights(bookId);
    });

    ipcMain.handle('repo:save-highlight', async (_event, highlight) => {
      if (!repository) throw new Error('Database not initialized');
      await repository.saveHighlight(highlight);
    });

    ipcMain.handle('repo:remove-highlight', async (_event, highlightId: string) => {
      if (!repository) throw new Error('Database not initialized');
      await repository.removeHighlight(highlightId);
    });

    ipcMain.handle('repo:get-user-settings', async () => {
      if (!repository) throw new Error('Database not initialized');
      return repository.getUserSettings();
    });

    ipcMain.handle('repo:save-user-settings', async (_event, settings) => {
      if (!repository) throw new Error('Database not initialized');
      await repository.saveUserSettings(settings);
    });

    ipcMain.handle('repo:save-feedback', async (_event, feedback) => {
      if (!repository) throw new Error('Database not initialized');
      await repository.saveFeedback(feedback);
    });

    ipcMain.handle('repo:list-feedback', async () => {
      if (!repository) throw new Error('Database not initialized');
      return repository.listFeedback();
    });

    ipcMain.handle('repo:count-feedback-by-status', async (_event, status: FeedbackStatus) => {
      if (!repository) throw new Error('Database not initialized');
      return repository.countFeedbackByStatus(status);
    });

    ipcMain.handle(
      'repo:update-feedback-status',
      async (_event, feedbackId: string, status: FeedbackStatus, githubIssueUrl?: string) => {
        if (!repository) throw new Error('Database not initialized');
        await repository.updateFeedbackStatus(feedbackId, status, githubIssueUrl);
      },
    );

    ipcMain.handle('repo:delete-feedback', async (_event, feedbackId: string) => {
      if (!repository) throw new Error('Database not initialized');
      await repository.removeFeedback(feedbackId);
    });

    ipcMain.handle('get-app-info', () => {
      return {
        version: app.getVersion(),
        platform: process.platform,
        osVersion: release(),
      };
    });
  }

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    await ensureDataDir();
    repository = initDatabase();

    // Reenvía la consola de cualquier webContents (incluido el <webview> del lector)
    // al proceso principal para ver los errores del lector en la terminal.
    app.on('web-contents-created', (_event, contents) => {
      contents.on('console-message', (_e, _level, message, line, sourceId) => {
        const tag = contents.getType() === 'webview' ? '[reader-webview]' : '[contents]';
        console.log(tag, message, `${sourceId}:${line}`);
      });
    });

    await migrateExistingJson().catch((err) => {
      console.error('[main] Migration failed:', err);
    });
    setupIpcHandlers();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      } else if (mainWindow) {
        mainWindow.webContents.send('app-resume');
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('before-quit', () => {
    if (mainWindow) {
      mainWindow.webContents.send('app-suspend');
    }
  });
}
