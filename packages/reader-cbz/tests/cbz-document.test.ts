import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import JSZip from 'jszip';

import type { CbzLocator } from '@clio-reader/domain';
import type { FileSource } from '@clio-reader/reader-core';

import {
  CbzReaderDocument,
  CbzDocumentClosedError,
  CbzDocumentNotOpenError,
  CbzPageOutOfBoundsError,
  CbzEmptyArchiveError,
} from '../src/cbz-document.js';

async function createCbzZip(files: Record<string, string>): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) {
    zip.file(name, content);
  }
  return zip.generateAsync({ type: 'uint8array' });
}

function toCbzLocator(locator: {
  format: string;
  page?: number;
  progression?: number;
}): CbzLocator {
  return locator as CbzLocator;
}

describe('CbzReaderDocument', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch' as Parameters<typeof vi.spyOn>[1]);
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  async function setupDocument(files: Record<string, string>): Promise<CbzReaderDocument> {
    const zipData = await createCbzZip(files);

    fetchSpy.mockResolvedValue(new Response(new Blob([zipData.buffer as ArrayBuffer])));

    const source: FileSource = {
      uri: 'file:///test.cbz',
      name: 'test.cbz',
    };

    const doc = new CbzReaderDocument(source);
    await doc.open();
    return doc;
  }

  describe('open', () => {
    it('opens a valid CBZ with images', async () => {
      const doc = await setupDocument({
        'page1.jpg': 'data1',
        'page2.png': 'data2',
      });

      expect(doc.isOpen).toBe(true);
      expect(doc.format).toBe('cbz');

      await doc.close();
    });

    it('throws CbzEmptyArchiveError for ZIP with no images', async () => {
      const zipData = await createCbzZip({ 'readme.txt': 'text' });
      fetchSpy.mockResolvedValue(new Response(new Blob([zipData.buffer as ArrayBuffer])));

      const source: FileSource = { uri: 'file:///test.cbz', name: 'test.cbz' };
      const doc = new CbzReaderDocument(source);

      await expect(doc.open()).rejects.toThrow(CbzEmptyArchiveError);
    });

    it('filters hidden and macOS files', async () => {
      const doc = await setupDocument({
        'page1.jpg': 'data',
        '.DS_Store': 'hidden',
        '__MACOSX/info.plist': 'metadata',
      });

      const totalPages = await doc.getTotalPages();
      expect(totalPages).toBe(1);

      await doc.close();
    });

    it('can be opened multiple times (idempotent)', async () => {
      const doc = await setupDocument({ 'page1.jpg': 'data' });

      await doc.open();
      const totalPages = await doc.getTotalPages();
      expect(totalPages).toBe(1);

      await doc.close();
    });
  });

  describe('close', () => {
    it('releases resources', async () => {
      const doc = await setupDocument({ 'page1.jpg': 'data' });

      await doc.close();

      expect(doc.isOpen).toBe(false);
    });

    it('throws CbzDocumentClosedError after close', async () => {
      const doc = await setupDocument({ 'page1.jpg': 'data' });
      await doc.close();

      await expect(doc.getLocator()).rejects.toThrow(CbzDocumentClosedError);
    });
  });

  describe('getLocator', () => {
    it('returns correct locator for first page', async () => {
      const doc = await setupDocument({
        'page1.jpg': 'data',
        'page2.png': 'data',
        'page3.gif': 'data',
      });

      const locator = toCbzLocator(await doc.getLocator());

      expect(locator).toEqual({
        format: 'cbz',
        page: 1,
        progression: 0,
      });

      await doc.close();
    });

    it('returns correct progression for middle page', async () => {
      const doc = await setupDocument({
        'page1.jpg': 'data',
        'page2.png': 'data',
        'page3.gif': 'data',
      });

      await doc.goNext();
      const locator = toCbzLocator(await doc.getLocator());

      expect(locator).toEqual({
        format: 'cbz',
        page: 2,
        progression: 0.5,
      });

      await doc.close();
    });

    it('returns correct progression for last page', async () => {
      const doc = await setupDocument({
        'page1.jpg': 'data',
        'page2.png': 'data',
      });

      await doc.goNext();
      const locator = toCbzLocator(await doc.getLocator());

      expect(locator).toEqual({
        format: 'cbz',
        page: 2,
        progression: 1,
      });

      await doc.close();
    });

    it('returns 0% progression for single page', async () => {
      const doc = await setupDocument({ 'page1.jpg': 'data' });

      const locator = await doc.getLocator();

      expect(locator.progression).toBe(0);

      await doc.close();
    });
  });

  describe('goNext', () => {
    it('advances to next page', async () => {
      const doc = await setupDocument({
        'page1.jpg': 'data',
        'page2.png': 'data',
      });

      const locator = toCbzLocator(await doc.goNext());

      expect(locator.page).toBe(2);

      await doc.close();
    });

    it('throws CbzPageOutOfBoundsError at end', async () => {
      const doc = await setupDocument({ 'page1.jpg': 'data' });

      await expect(doc.goNext()).rejects.toThrow(CbzPageOutOfBoundsError);

      await doc.close();
    });
  });

  describe('goPrevious', () => {
    it('goes back to previous page', async () => {
      const doc = await setupDocument({
        'page1.jpg': 'data',
        'page2.png': 'data',
      });

      await doc.goNext();
      const locator = toCbzLocator(await doc.goPrevious());

      expect(locator.page).toBe(1);

      await doc.close();
    });

    it('throws CbzPageOutOfBoundsError at start', async () => {
      const doc = await setupDocument({ 'page1.jpg': 'data' });

      await expect(doc.goPrevious()).rejects.toThrow(CbzPageOutOfBoundsError);

      await doc.close();
    });
  });

  describe('getCurrentImage', () => {
    it('returns current image data', async () => {
      const doc = await setupDocument({ 'page1.jpg': 'data1' });

      const image = await doc.getCurrentImage();

      expect(image).toBeInstanceOf(Uint8Array);

      await doc.close();
    });
  });

  describe('getImageMimeType', () => {
    it('returns correct MIME type for current image', async () => {
      const doc = await setupDocument({
        'page1.jpg': 'data',
        'page2.png': 'data',
      });

      expect(await doc.getImageMimeType()).toBe('image/jpeg');

      await doc.goNext();
      expect(await doc.getImageMimeType()).toBe('image/png');

      await doc.close();
    });
  });

  describe('navigation', () => {
    it('supports multi-page navigation', async () => {
      const doc = await setupDocument({
        'page1.jpg': 'data',
        'page2.png': 'data',
        'page3.gif': 'data',
        'page4.bmp': 'data',
      });

      expect(toCbzLocator(await doc.getLocator()).page).toBe(1);

      await doc.goNext();
      expect(toCbzLocator(await doc.getLocator()).page).toBe(2);

      await doc.goNext();
      expect(toCbzLocator(await doc.getLocator()).page).toBe(3);

      await doc.goNext();
      expect(toCbzLocator(await doc.getLocator()).page).toBe(4);

      await doc.goPrevious();
      expect(toCbzLocator(await doc.getLocator()).page).toBe(3);

      await doc.close();
    });
  });

  describe('natural sort ordering', () => {
    it('navigates in natural sort order', async () => {
      const doc = await setupDocument({
        'page10.jpg': 'data',
        'page2.jpg': 'data',
        'page1.jpg': 'data',
        'page20.jpg': 'data',
      });

      expect(toCbzLocator(await doc.getLocator()).page).toBe(1);

      await doc.goNext();
      expect(toCbzLocator(await doc.getLocator()).page).toBe(2);

      await doc.goNext();
      expect(toCbzLocator(await doc.getLocator()).page).toBe(3);

      await doc.goNext();
      expect(toCbzLocator(await doc.getLocator()).page).toBe(4);

      await doc.close();
    });
  });
});
