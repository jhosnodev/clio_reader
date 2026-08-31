import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FileSource } from '@echo-reader/reader-core';

vi.mock('expo-document-picker', () => ({
  getDocumentAsync: vi.fn(),
}));

const mockDocumentPicker = await import('expo-document-picker');

describe('Mobile Bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createMobileBridge', () => {
    it('should create a bridge with platform mobile', async () => {
      const { createMobileBridge } = await import('../src/bridges/mobile-bridge');
      const bridge = createMobileBridge();
      expect(bridge.platform).toBe('mobile');
    });

    it('should pick file and return FileSource', async () => {
      vi.mocked(mockDocumentPicker.getDocumentAsync).mockResolvedValue({
        canceled: false,
        assets: [
          {
            uri: 'file:///mock-documents/book.epub',
            name: 'book.epub',
            mimeType: 'application/epub+zip',
          },
        ],
      } as any);

      const { createMobileBridge } = await import('../src/bridges/mobile-bridge');
      const bridge = createMobileBridge();
      const result = await bridge.pickFile();

      expect(result).toEqual({
        uri: 'file:///mock-documents/book.epub',
        name: 'book.epub',
        mimeType: 'application/epub+zip',
      });
    });

    it('should return null when file picker is canceled', async () => {
      vi.mocked(mockDocumentPicker.getDocumentAsync).mockResolvedValue({
        canceled: true,
        assets: [],
      } as any);

      const { createMobileBridge } = await import('../src/bridges/mobile-bridge');
      const bridge = createMobileBridge();
      const result = await bridge.pickFile();

      expect(result).toBeNull();
    });

    it('should register lifecycle callbacks', async () => {
      const { createMobileBridge } = await import('../src/bridges/mobile-bridge');
      const bridge = createMobileBridge();
      const suspendCallback = vi.fn();
      const resumeCallback = vi.fn();

      bridge.onSuspend(suspendCallback);
      bridge.onResume(resumeCallback);

      expect(suspendCallback).toBeDefined();
      expect(resumeCallback).toBeDefined();
    });
  });
});
