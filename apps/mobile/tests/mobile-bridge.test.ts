import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('expo-document-picker', () => ({
  getDocumentAsync: vi.fn(),
}));

const mockDocumentPicker = await import('expo-document-picker');

interface PickerAsset {
  readonly uri: string;
  readonly name: string;
  readonly mimeType?: string;
}

type PickerResult =
  | { readonly canceled: false; readonly assets: PickerAsset[] }
  | { readonly canceled: true; readonly assets: never[] };

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
      const pickerResult: PickerResult = {
        canceled: false,
        assets: [
          {
            uri: 'file:///mock-documents/book.epub',
            name: 'book.epub',
            mimeType: 'application/epub+zip',
          },
        ],
      };
      vi.mocked(mockDocumentPicker.getDocumentAsync).mockResolvedValue(pickerResult);

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
      const pickerResult: PickerResult = {
        canceled: true,
        assets: [],
      };
      vi.mocked(mockDocumentPicker.getDocumentAsync).mockResolvedValue(pickerResult);

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
