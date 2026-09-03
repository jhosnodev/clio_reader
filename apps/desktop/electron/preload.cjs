// CommonJS preload script - must be .cjs because package.json has "type": "module"
// Electron loads preload scripts via require(), which cannot load ES modules.
const { contextBridge, ipcRenderer } = require('electron');

const electronAPI = {
  pickFile: () => {
    return ipcRenderer.invoke('pick-file');
  },

  readFile: (uri) => {
    return ipcRenderer.invoke('read-file', uri);
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

  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
