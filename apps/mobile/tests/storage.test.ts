import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('expo-file-system', () => ({
  documentDirectory: 'file:///mock-documents/',
  getInfoAsync: vi.fn(),
  makeDirectoryAsync: vi.fn(),
  readAsStringAsync: vi.fn(),
  writeAsStringAsync: vi.fn(),
  deleteAsync: vi.fn(),
  EncodingType: { Base64: 'base64' },
}));

vi.mock('expo-document-picker', () => ({
  getDocumentAsync: vi.fn(),
}));

const mockFileSystem = await import('expo-file-system');

interface FileInfoResult {
  readonly exists: boolean;
}

const fileInfo = (exists: boolean): FileInfoResult => ({ exists });

describe('Mobile Storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mockFileSystem.getInfoAsync).mockResolvedValue(fileInfo(false));
    vi.mocked(mockFileSystem.makeDirectoryAsync).mockResolvedValue(undefined);
  });

  describe('createExpoKVStore', () => {
    it('should create a KeyValueStore', async () => {
      const { createExpoKVStore } = await import('../src/bridges/storage');
      const store = createExpoKVStore();
      expect(store).toBeDefined();
      expect(typeof store.get).toBe('function');
      expect(typeof store.set).toBe('function');
      expect(typeof store.remove).toBe('function');
    });

    it('should get value from storage', async () => {
      vi.mocked(mockFileSystem.getInfoAsync).mockResolvedValue(fileInfo(true));
      vi.mocked(mockFileSystem.readAsStringAsync).mockResolvedValue('{"test":"value"}');

      const { createExpoKVStore } = await import('../src/bridges/storage');
      const store = createExpoKVStore();
      const result = await store.get('test-key');

      expect(result).toBe('{"test":"value"}');
    });

    it('should return undefined for non-existent key', async () => {
      vi.mocked(mockFileSystem.getInfoAsync).mockResolvedValue(fileInfo(false));

      const { createExpoKVStore } = await import('../src/bridges/storage');
      const store = createExpoKVStore();
      const result = await store.get('non-existent');

      expect(result).toBeUndefined();
    });

    it('should set value in storage', async () => {
      vi.mocked(mockFileSystem.writeAsStringAsync).mockResolvedValue(undefined);

      const { createExpoKVStore } = await import('../src/bridges/storage');
      const store = createExpoKVStore();
      await store.set('test-key', '{"test":"value"}');

      expect(mockFileSystem.writeAsStringAsync).toHaveBeenCalledWith(
        'file:///mock-documents/clio-reader/test-key.json',
        '{"test":"value"}',
      );
    });

    it('should remove value from storage', async () => {
      vi.mocked(mockFileSystem.getInfoAsync).mockResolvedValue(fileInfo(true));
      vi.mocked(mockFileSystem.deleteAsync).mockResolvedValue(undefined);

      const { createExpoKVStore } = await import('../src/bridges/storage');
      const store = createExpoKVStore();
      await store.remove('test-key');

      expect(mockFileSystem.deleteAsync).toHaveBeenCalledWith(
        'file:///mock-documents/clio-reader/test-key.json',
      );
    });
  });
});
