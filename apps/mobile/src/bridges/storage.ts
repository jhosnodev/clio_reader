import * as FileSystem from 'expo-file-system';
import type { KeyValueStore } from '@echo-reader/storage';

function getStorageDir(): string {
  return `${FileSystem.documentDirectory}echo-reader/`;
}

async function ensureDir(): Promise<void> {
  const dir = getStorageDir();
  const dirInfo = await FileSystem.getInfoAsync(dir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
}

export function createExpoKVStore(): KeyValueStore {
  return {
    async get(key: string): Promise<string | undefined> {
      await ensureDir();
      const filePath = `${getStorageDir()}${key}.json`;
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (!fileInfo.exists) {
        return undefined;
      }
      return FileSystem.readAsStringAsync(filePath);
    },

    async set(key: string, value: string): Promise<void> {
      await ensureDir();
      const filePath = `${getStorageDir()}${key}.json`;
      await FileSystem.writeAsStringAsync(filePath, value);
    },

    async remove(key: string): Promise<void> {
      await ensureDir();
      const filePath = `${getStorageDir()}${key}.json`;
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(filePath);
      }
    },
  };
}
