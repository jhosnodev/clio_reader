import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { readFile, writeFile, mkdir, access, constants, unlink, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const isDev = !app.isPackaged;

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  let mainWindow: BrowserWindow | null = null;

  function getDataPath(): string {
    const userDataPath = app.getPath('userData');
    return join(userDataPath, 'clio-reader');
  }

  function getStoragePath(): string {
    return getDataPath();
  }

  async function ensureDataDir(): Promise<void> {
    const dataPath = getDataPath();
    if (!existsSync(dataPath)) {
      await mkdir(dataPath, { recursive: true });
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
            { name: 'Books', extensions: ['epub', 'pdf', 'cbz'] },
            { name: 'EPUB', extensions: ['epub'] },
            { name: 'PDF', extensions: ['pdf'] },
            { name: 'CBZ', extensions: ['cbz'] },
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
        await unlink(filePath);
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
  }

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
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
