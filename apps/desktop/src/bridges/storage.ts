import type { KeyValueStore } from '@clio-reader/storage';

export function createElectronKVStore(): KeyValueStore {
  const api = window.electronAPI;

  return {
    async get(key: string): Promise<string | undefined> {
      return api.readStorage(key);
    },

    async set(key: string, value: string): Promise<void> {
      await api.writeStorage(key, value);
    },

    async remove(key: string): Promise<void> {
      await api.deleteStorage(key);
    },
  };
}
