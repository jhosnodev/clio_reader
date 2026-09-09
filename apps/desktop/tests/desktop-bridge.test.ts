import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FileSource } from '@clio-reader/reader-core';

const mockElectronAPI = {
  pickFile: vi.fn(),
  readFile: vi.fn(),
  readStorage: vi.fn(),
  writeStorage: vi.fn(),
  deleteStorage: vi.fn(),
  getStoragePath: vi.fn(),
  onSuspend: vi.fn(),
  onResume: vi.fn(),
  removeAllListeners: vi.fn(),
};

vi.stubGlobal('window', {
  electronAPI: mockElectronAPI,
});

describe('Desktop Bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createDesktopBridge', () => {
    it('should create a bridge with platform desktop', async () => {
      const { createDesktopBridge } = await import('../src/bridges/desktop-bridge');
      const bridge = createDesktopBridge();
      expect(bridge.platform).toBe('desktop');
    });

    it('should pick file and return FileSource', async () => {
      const mockResult = [
        { uri: 'file:///path/to/book.epub', name: 'book.epub', filePath: '/path/to/book.epub' },
      ];
      mockElectronAPI.pickFile.mockResolvedValue(mockResult);

      const { createDesktopBridge } = await import('../src/bridges/desktop-bridge');
      const bridge = createDesktopBridge();
      const result = await bridge.pickFile();

      expect(result).toEqual({
        uri: 'file:///path/to/book.epub',
        name: 'book.epub',
      });
    });

    it('should return null when file picker is canceled', async () => {
      mockElectronAPI.pickFile.mockResolvedValue(null);

      const { createDesktopBridge } = await import('../src/bridges/desktop-bridge');
      const bridge = createDesktopBridge();
      const result = await bridge.pickFile();

      expect(result).toBeNull();
    });

    it('should read file as Uint8Array', async () => {
      const mockBuffer = new ArrayBuffer(8);
      mockElectronAPI.readFile.mockResolvedValue(mockBuffer);

      const { createDesktopBridge } = await import('../src/bridges/desktop-bridge');
      const bridge = createDesktopBridge();
      const result = await bridge.readFile('file:///path/to/book.epub');

      expect(result).toBeInstanceOf(Uint8Array);
    });

    it('should register suspend callback', async () => {
      const { createDesktopBridge } = await import('../src/bridges/desktop-bridge');
      const bridge = createDesktopBridge();
      const callback = vi.fn();

      bridge.onSuspend(callback);

      expect(mockElectronAPI.onSuspend).toHaveBeenCalledWith(callback);
    });

    it('should register resume callback', async () => {
      const { createDesktopBridge } = await import('../src/bridges/desktop-bridge');
      const bridge = createDesktopBridge();
      const callback = vi.fn();

      bridge.onResume(callback);

      expect(mockElectronAPI.onResume).toHaveBeenCalledWith(callback);
    });
  });
});
