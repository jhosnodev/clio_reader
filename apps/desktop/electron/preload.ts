import { contextBridge, ipcRenderer } from 'electron';

const electronAPI = {
  pickFile: (): Promise<Array<{ uri: string; name: string; filePath: string }> | null> => {
    return ipcRenderer.invoke('pick-file');
  },

  pickFolder: (): Promise<string | null> => {
    return ipcRenderer.invoke('pick-folder');
  },

  readFolderBooks: (folderPath: string): Promise<Array<{ uri: string; name: string; filePath: string }>> => {
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
};

export type ElectronAPI = typeof electronAPI;

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
