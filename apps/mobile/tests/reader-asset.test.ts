import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAsset = {
  downloadAsync: vi.fn(),
  localUri: 'file:///cache/ExponentAsset-abc.dat' as string | null,
  uri: 'file:///cache/ExponentAsset-abc.dat',
};

vi.mock('expo-asset', () => ({
  Asset: {
    fromModule: vi.fn(() => mockAsset),
  },
}));

vi.mock('expo-file-system', () => ({
  documentDirectory: 'file:///mock-documents/',
  getInfoAsync: vi.fn(),
  makeDirectoryAsync: vi.fn(),
  copyAsync: vi.fn(),
}));

const mockFileSystem = await import('expo-file-system');

describe('resolveReaderHtmlUri', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAsset.localUri = 'file:///cache/ExponentAsset-abc.dat';
    mockAsset.uri = 'file:///cache/ExponentAsset-abc.dat';
    vi.mocked(mockAsset.downloadAsync).mockResolvedValue(undefined as never);
    vi.mocked(mockFileSystem.getInfoAsync).mockResolvedValue({ exists: true } as never);
    vi.mocked(mockFileSystem.copyAsync).mockResolvedValue(undefined as never);
  });

  it('returns the local uri directly when it already ends with .html', async () => {
    mockAsset.localUri = 'file:///cache/reader.html';

    const { resolveReaderHtmlUri } = await import('../src/reader/reader-asset');
    expect(await resolveReaderHtmlUri(1)).toBe('file:///cache/reader.html');
    expect(mockFileSystem.copyAsync).not.toHaveBeenCalled();
  });

  it('copies to a .html path when the extension is missing', async () => {
    const { resolveReaderHtmlUri } = await import('../src/reader/reader-asset');
    const result = await resolveReaderHtmlUri(1);

    expect(result).toBe('file:///mock-documents/clio-reader/reader.html');
    expect(mockFileSystem.copyAsync).toHaveBeenCalledWith({
      from: 'file:///cache/ExponentAsset-abc.dat',
      to: 'file:///mock-documents/clio-reader/reader.html',
    });
  });

  it('creates the target directory when it does not exist', async () => {
    vi.mocked(mockFileSystem.getInfoAsync).mockResolvedValue({ exists: false } as never);

    const { resolveReaderHtmlUri } = await import('../src/reader/reader-asset');
    await resolveReaderHtmlUri(1);

    expect(mockFileSystem.makeDirectoryAsync).toHaveBeenCalledWith(
      'file:///mock-documents/clio-reader/',
      { intermediates: true },
    );
  });
});
