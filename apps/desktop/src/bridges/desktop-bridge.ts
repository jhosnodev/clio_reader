import type { FileSource } from '@echo-reader/reader-core';

export interface DesktopBridge {
  readonly platform: 'desktop';
  pickFile(): Promise<FileSource | null>;
  readFile(uri: string): Promise<Uint8Array>;
  getStoragePath(): string;
  onSuspend(callback: () => void): void;
  onResume(callback: () => void): void;
}

export function createDesktopBridge(): DesktopBridge {
  const api = window.electronAPI;

  return {
    platform: 'desktop',

    async pickFile(): Promise<FileSource | null> {
      const result = await api.pickFile();
      if (!result || result.length === 0) {
        return null;
      }
      const file = result[0]!;
      return {
        uri: file.uri,
        name: file.name,
      };
    },

    async readFile(uri: string): Promise<Uint8Array> {
      const buffer = await api.readFile(uri);
      return new Uint8Array(buffer);
    },

    getStoragePath(): string {
      return 'electron-storage';
    },

    onSuspend(callback: () => void): void {
      api.onSuspend(callback);
    },

    onResume(callback: () => void): void {
      api.onResume(callback);
    },
  };
}
