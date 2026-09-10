/// <reference types="vite/client" />

interface ElectronAPI {
  pickFile(): Promise<Array<{ uri: string; name: string; filePath: string }> | null>;
  pickFolder(): Promise<string | null>;
  readFolderBooks(folderPath: string): Promise<Array<{ uri: string; name: string; filePath: string }>>;
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
}

interface Window {
  electronAPI: ElectronAPI;
}
