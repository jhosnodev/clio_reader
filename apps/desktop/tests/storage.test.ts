import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockElectronAPI = {
  readStorage: vi.fn(),
  writeStorage: vi.fn(),
  deleteStorage: vi.fn(),
};

vi.stubGlobal('window', {
  electronAPI: mockElectronAPI,
});

describe('Desktop Storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createElectronKVStore', () => {
    it('should create a KeyValueStore', async () => {
      const { createElectronKVStore } = await import('../src/bridges/storage');
      const store = createElectronKVStore();
      expect(store).toBeDefined();
      expect(typeof store.get).toBe('function');
      expect(typeof store.set).toBe('function');
      expect(typeof store.remove).toBe('function');
    });

    it('should get value from storage', async () => {
      mockElectronAPI.readStorage.mockResolvedValue('{"test":"value"}');

      const { createElectronKVStore } = await import('../src/bridges/storage');
      const store = createElectronKVStore();
      const result = await store.get('test-key');

      expect(result).toBe('{"test":"value"}');
      expect(mockElectronAPI.readStorage).toHaveBeenCalledWith('test-key');
    });

    it('should set value in storage', async () => {
      mockElectronAPI.writeStorage.mockResolvedValue(undefined);

      const { createElectronKVStore } = await import('../src/bridges/storage');
      const store = createElectronKVStore();
      await store.set('test-key', '{"test":"value"}');

      expect(mockElectronAPI.writeStorage).toHaveBeenCalledWith('test-key', '{"test":"value"}');
    });

    it('should remove value from storage', async () => {
      mockElectronAPI.deleteStorage.mockResolvedValue(undefined);

      const { createElectronKVStore } = await import('../src/bridges/storage');
      const store = createElectronKVStore();
      await store.remove('test-key');

      expect(mockElectronAPI.deleteStorage).toHaveBeenCalledWith('test-key');
    });
  });
});
