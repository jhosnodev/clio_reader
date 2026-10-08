import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import type { PdfLocator } from '@clio-reader/domain';
import type { FileSource } from '@clio-reader/reader-core';

import {
  PdfReaderDocument,
  PdfDocumentClosedError,
  PdfPageOutOfBoundsError,
} from '../src/pdf-document.js';

function toPdfLocator(locator: {
  format: string;
  page?: number;
  progression?: number;
  zoom?: number;
}): PdfLocator {
  return locator as PdfLocator;
}

const mockPdfDocument = {
  numPages: 3,
  getPage: vi.fn(),
  destroy: vi.fn(),
  getOutline: vi.fn().mockResolvedValue(null),
  getMetadata: vi.fn().mockResolvedValue({ info: {} }),
  getDestination: vi.fn(),
  getPageIndex: vi.fn(),
};

const mockPage = {
  getViewport: vi.fn().mockReturnValue({ width: 800, height: 600 }),
  render: vi.fn().mockReturnValue({ promise: Promise.resolve() }),
  cleanup: vi.fn(),
};

vi.mock('pdfjs-dist', () => ({
  getDocument: vi.fn().mockReturnValue({
    promise: Promise.resolve(mockPdfDocument),
  }),
  GlobalWorkerOptions: { workerSrc: '' },
}));

describe('PdfReaderDocument', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch' as Parameters<typeof vi.spyOn>[1]);
    fetchSpy.mockResolvedValue(new Response(new ArrayBuffer(100)));
    mockPdfDocument.getPage.mockResolvedValue(mockPage);
    mockPdfDocument.destroy.mockClear();
    mockPdfDocument.getOutline.mockReset();
    mockPdfDocument.getOutline.mockResolvedValue(null);
    mockPdfDocument.getMetadata.mockReset();
    mockPdfDocument.getMetadata.mockResolvedValue({ info: {} });
    mockPage.getViewport.mockClear();
    mockPage.render.mockClear();
    mockPage.cleanup.mockClear();
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  async function setupDocument(numPages = 3): Promise<PdfReaderDocument> {
    mockPdfDocument.numPages = numPages;
    const source: FileSource = {
      uri: 'file:///test.pdf',
      name: 'test.pdf',
    };
    const doc = new PdfReaderDocument(source);
    await doc.open();
    return doc;
  }

  describe('open', () => {
    it('opens a valid PDF', async () => {
      const doc = await setupDocument();

      expect(doc.isOpen).toBe(true);
      expect(doc.format).toBe('pdf');

      await doc.close();
    });

    it('can be opened multiple times (idempotent)', async () => {
      const doc = await setupDocument();
      await doc.open();

      expect(doc.isOpen).toBe(true);

      await doc.close();
    });
  });

  describe('close', () => {
    it('releases resources', async () => {
      const doc = await setupDocument();
      await doc.close();

      expect(doc.isOpen).toBe(false);
      expect(mockPdfDocument.destroy).toHaveBeenCalled();
    });

    it('throws PdfDocumentClosedError after close', async () => {
      const doc = await setupDocument();
      await doc.close();

      await expect(doc.getLocator()).rejects.toThrow(PdfDocumentClosedError);
    });
  });

  describe('getLocator', () => {
    it('returns correct locator for first page', async () => {
      const doc = await setupDocument(5);

      const locator = toPdfLocator(await doc.getLocator());

      expect(locator).toEqual({
        format: 'pdf',
        page: 1,
        progression: 0,
        zoom: 1,
      });

      await doc.close();
    });

    it('returns correct progression for middle page', async () => {
      const doc = await setupDocument(5);

      await doc.goNext();
      await doc.goNext();
      const locator = toPdfLocator(await doc.getLocator());

      expect(locator.page).toBe(3);
      expect(locator.progression).toBe(0.5);

      await doc.close();
    });

    it('returns correct progression for last page', async () => {
      const doc = await setupDocument(3);

      await doc.goNext();
      await doc.goNext();
      const locator = toPdfLocator(await doc.getLocator());

      expect(locator.page).toBe(3);
      expect(locator.progression).toBe(1);

      await doc.close();
    });

    it('returns 0% progression for single page', async () => {
      const doc = await setupDocument(1);

      const locator = toPdfLocator(await doc.getLocator());

      expect(locator.progression).toBe(0);

      await doc.close();
    });
  });

  describe('goNext', () => {
    it('advances to next page', async () => {
      const doc = await setupDocument(3);

      const locator = toPdfLocator(await doc.goNext());

      expect(locator.page).toBe(2);

      await doc.close();
    });

    it('throws PdfPageOutOfBoundsError at end', async () => {
      const doc = await setupDocument(1);

      await expect(doc.goNext()).rejects.toThrow(PdfPageOutOfBoundsError);

      await doc.close();
    });
  });

  describe('goPrevious', () => {
    it('goes back to previous page', async () => {
      const doc = await setupDocument(3);

      await doc.goNext();
      const locator = toPdfLocator(await doc.goPrevious());

      expect(locator.page).toBe(1);

      await doc.close();
    });

    it('throws PdfPageOutOfBoundsError at start', async () => {
      const doc = await setupDocument(1);

      await doc.goPrevious().catch(() => {});

      await expect(doc.goPrevious()).rejects.toThrow(PdfPageOutOfBoundsError);

      await doc.close();
    });
  });

  describe('zoom', () => {
    it('defaults to scale 1', async () => {
      const doc = await setupDocument();

      expect(await doc.getZoom()).toBe(1);

      await doc.close();
    });

    it('sets zoom level', async () => {
      const doc = await setupDocument();

      await doc.setZoom(1.5);
      expect(await doc.getZoom()).toBe(1.5);

      await doc.close();
    });

    it('reflects zoom in locator', async () => {
      const doc = await setupDocument();

      await doc.setZoom(2);
      const locator = toPdfLocator(await doc.getLocator());

      expect(locator.zoom).toBe(2);

      await doc.close();
    });

    it('rejects non-positive zoom', async () => {
      const doc = await setupDocument();

      await expect(doc.setZoom(0)).rejects.toThrow('Zoom scale must be positive');
      await expect(doc.setZoom(-1)).rejects.toThrow('Zoom scale must be positive');

      await doc.close();
    });
  });

  describe('navigation', () => {
    it('supports multi-page navigation', async () => {
      const doc = await setupDocument(5);

      expect(toPdfLocator(await doc.getLocator()).page).toBe(1);

      await doc.goNext();
      expect(toPdfLocator(await doc.getLocator()).page).toBe(2);

      await doc.goNext();
      expect(toPdfLocator(await doc.getLocator()).page).toBe(3);

      await doc.goNext();
      expect(toPdfLocator(await doc.getLocator()).page).toBe(4);

      await doc.goNext();
      expect(toPdfLocator(await doc.getLocator()).page).toBe(5);

      await doc.goPrevious();
      expect(toPdfLocator(await doc.getLocator()).page).toBe(4);

      await doc.close();
    });
  });

  describe('getTotalPages', () => {
    it('returns total page count', async () => {
      const doc = await setupDocument(7);

      expect(await doc.getTotalPages()).toBe(7);

      await doc.close();
    });
  });

  describe('getMetadata', () => {
    it('maps PDF info to title/author', async () => {
      mockPdfDocument.getMetadata.mockResolvedValue({
        info: { Title: 'Mi PDF', Author: 'Autora', Creator: 'Word' },
      });
      const doc = await setupDocument();

      const meta = await doc.getMetadata();
      expect(meta.title).toBe('Mi PDF');
      expect(meta.author).toBe('Autora');
      expect(meta.creator).toBe('Word');

      await doc.close();
    });

    it('returns empty object when info is missing', async () => {
      const doc = await setupDocument();
      expect(await doc.getMetadata()).toEqual({
        title: undefined,
        author: undefined,
        creator: undefined,
        producer: undefined,
      });
      await doc.close();
    });
  });

  describe('getToc', () => {
    it('maps outline destinations to page links', async () => {
      mockPdfDocument.getOutline.mockResolvedValue([
        { title: 'Capítulo 1', dest: [2, { name: 'XYZ' }], items: [] },
        { title: 'Capítulo 2', dest: [4, { name: 'XYZ' }], items: [] },
      ]);
      mockPdfDocument.getPageIndex.mockImplementation((ref: unknown) =>
        Promise.resolve(ref === 2 ? 1 : 3),
      );

      const doc = await setupDocument(10);
      const toc = await doc.getToc();

      expect(toc).toHaveLength(2);
      expect(toc[0]).toMatchObject({ title: 'Capítulo 1', href: 'page:1', chapterIndex: 1 });
      expect(toc[1]).toMatchObject({ title: 'Capítulo 2', href: 'page:3', chapterIndex: 3 });

      await doc.close();
    });

    it('returns empty array when there is no outline', async () => {
      const doc = await setupDocument();
      expect(await doc.getToc()).toEqual([]);
      await doc.close();
    });

    it('navigates using goToTocHref', async () => {
      const doc = await setupDocument(10);
      await doc.goToTocHref('page:4');
      expect(toPdfLocator(await doc.getLocator()).page).toBe(5);
      await doc.close();
    });
  });

  describe('getCurrentChapterIndex', () => {
    it('returns the current page index', async () => {
      const doc = await setupDocument(10);
      await doc.goToPage(3);
      expect(await doc.getCurrentChapterIndex()).toBe(3);
      await doc.close();
    });
  });
});
