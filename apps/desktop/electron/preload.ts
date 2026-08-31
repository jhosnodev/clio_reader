import { contextBridge, ipcRenderer } from 'electron';

const electronAPI = {
  pickFile: (): Promise<Array<{ uri: string; name: string; filePath: string }> | null> => {
    return ipcRenderer.invoke('pick-file');
  },

  readFile: (uri: string): Promise<ArrayBuffer> => {
    return ipcRenderer.invoke('read-file', uri);
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
