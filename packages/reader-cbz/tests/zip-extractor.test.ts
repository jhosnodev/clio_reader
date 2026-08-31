import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';

import { extractImagesFromZip } from '../src/zip-extractor.js';

async function createZip(files: Record<string, string | Uint8Array>): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) {
    if (typeof content === 'string') {
      zip.file(name, content);
    } else {
      zip.file(name, content);
    }
  }
  return zip.generateAsync({ type: 'uint8array' });
}

describe('extractImagesFromZip', () => {
  it('extracts image files from a valid ZIP', async () => {
    const zipData = await createZip({
      'page1.jpg': 'fake-jpg-data-1',
      'page2.png': 'fake-png-data-2',
      'readme.txt': 'not an image',
    });

    const images = await extractImagesFromZip(zipData);

    expect(images).toHaveLength(2);
    expect(images[0]!.fileName).toBe('page1.jpg');
    expect(images[1]!.fileName).toBe('page2.png');
    expect(images[0]!.data).toBeInstanceOf(Uint8Array);
  });

  it('filters out hidden files starting with .', async () => {
    const zipData = await createZip({
      'page1.jpg': 'data',
      '.DS_Store': 'hidden',
    });

    const images = await extractImagesFromZip(zipData);

    expect(images).toHaveLength(1);
    expect(images[0]!.fileName).toBe('page1.jpg');
  });

  it('filters out __MACOSX metadata', async () => {
    const zipData = await createZip({
      'page1.jpg': 'data',
      '__MACOSX/info.plist': 'metadata',
    });

    const images = await extractImagesFromZip(zipData);

    expect(images).toHaveLength(1);
    expect(images[0]!.fileName).toBe('page1.jpg');
  });

  it('filters out non-image files', async () => {
    const zipData = await createZip({
      'page1.jpg': 'data',
      'readme.txt': 'text',
      'data.csv': 'csv',
      'archive.zip': 'zip',
    });

    const images = await extractImagesFromZip(zipData);

    expect(images).toHaveLength(1);
    expect(images[0]!.fileName).toBe('page1.jpg');
  });

  it('returns empty array for ZIP with no images', async () => {
    const zipData = await createZip({
      'readme.txt': 'text',
      'data.csv': 'csv',
    });

    const images = await extractImagesFromZip(zipData);

    expect(images).toHaveLength(0);
  });

  it('handles empty ZIP', async () => {
    const zipData = await createZip({});

    const images = await extractImagesFromZip(zipData);

    expect(images).toHaveLength(0);
  });

  it('handles all supported image formats', async () => {
    const zipData = await createZip({
      'a.jpg': 'data',
      'b.jpeg': 'data',
      'c.png': 'data',
      'd.webp': 'data',
      'e.gif': 'data',
      'f.bmp': 'data',
    });

    const images = await extractImagesFromZip(zipData);

    expect(images).toHaveLength(6);
  });

  it('throws on corrupt ZIP data', async () => {
    const corruptData = new Uint8Array([1, 2, 3, 4, 5]);

    await expect(extractImagesFromZip(corruptData)).rejects.toThrow();
  });
});
