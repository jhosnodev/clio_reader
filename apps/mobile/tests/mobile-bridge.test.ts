import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('expo-document-picker', () => ({
  getDocumentAsync: vi.fn(),
}));

vi.mock('expo-file-system', () => ({
  documentDirectory: 'file:///mock-documents/',
  getInfoAsync: vi.fn(),
  makeDirectoryAsync: vi.fn(),
  readAsStringAsync: vi.fn(),
  writeAsStringAsync: vi.fn(),
  copyAsync: vi.fn(),
  deleteAsync: vi.fn(),
  EncodingType: { Base64: 'base64' },
}));

const mockDocumentPicker = await import('expo-document-picker');
const mockFileSystem = await import('expo-file-system');

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

    it('should delete a file idempotently', async () => {
      vi.mocked(mockFileSystem.deleteAsync).mockResolvedValue(undefined);

      const { createMobileBridge } = await import('../src/bridges/mobile-bridge');
      const bridge = createMobileBridge();
      await bridge.deleteFile('file:///mock-documents/clio-reader/books/1-book.epub');

      expect(mockFileSystem.deleteAsync).toHaveBeenCalledWith(
        'file:///mock-documents/clio-reader/books/1-book.epub',
        { idempotent: true },
      );
    });

    it('should read a file as base64', async () => {
      vi.mocked(mockFileSystem.readAsStringAsync).mockResolvedValue('TWFu');

      const { createMobileBridge } = await import('../src/bridges/mobile-bridge');
      const bridge = createMobileBridge();

      expect(await bridge.readFileBase64('file:///mock-documents/book.epub')).toBe('TWFu');
    });

    it('should decode a file into bytes', async () => {
      vi.mocked(mockFileSystem.readAsStringAsync).mockResolvedValue('TWFu');

      const { createMobileBridge } = await import('../src/bridges/mobile-bridge');
      const bridge = createMobileBridge();

      expect(Array.from(await bridge.readFile('file:///mock-documents/book.epub'))).toEqual([
        77, 97, 110,
      ]);
    });

    it('should copy a file into the app storage directory', async () => {
      vi.mocked(mockFileSystem.getInfoAsync).mockResolvedValue({ exists: false });
      vi.mocked(mockFileSystem.makeDirectoryAsync).mockResolvedValue(undefined);
      vi.mocked(mockFileSystem.copyAsync).mockResolvedValue(undefined);

      const { createMobileBridge } = await import('../src/bridges/mobile-bridge');
      const bridge = createMobileBridge();
      const target = await bridge.copyToStorage('file:///mock-documents/book.epub', 'book.epub');

      expect(mockFileSystem.makeDirectoryAsync).toHaveBeenCalledWith(
        'file:///mock-documents/clio-reader/books/',
        { intermediates: true },
      );
      expect(target).toMatch(/^file:\/\/\/mock-documents\/clio-reader\/books\/\d+-book\.epub$/);
      expect(mockFileSystem.copyAsync).toHaveBeenCalledWith({
        from: 'file:///mock-documents/book.epub',
        to: target,
      });
    });
  });
});
