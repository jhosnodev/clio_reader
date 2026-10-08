import type { PdfLocator, ReaderLocator } from '@clio-reader/domain';
import type {
  FileSource,
  ReaderCapabilities,
  ReaderDocument,
  TocNavEntry,
  TocTree,
} from '@clio-reader/reader-core';
import type { PDFDocumentProxy } from 'pdfjs-dist';

import { renderPageToCanvas } from './pdf-renderer.js';

import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

export class PdfDocumentClosedError extends Error {
  constructor() {
    super('Cannot operate on a closed PDF document');
    this.name = 'PdfDocumentClosedError';
  }
}

export class PdfDocumentNotOpenError extends Error {
  constructor() {
    super('PDF document has not been opened');
    this.name = 'PdfDocumentNotOpenError';
  }
}

export class PdfPageOutOfBoundsError extends Error {
  constructor(pageIndex: number, totalPages: number) {
    super(`Page index ${pageIndex} is out of bounds (total: ${totalPages})`);
    this.name = 'PdfPageOutOfBoundsError';
  }
}

interface PdfOutlineItem {
  title?: string;
  dest?: unknown;
  items?: PdfOutlineItem[];
}

function toOutlineItems(value: unknown): PdfOutlineItem[] | null {
  return Array.isArray(value) ? (value as PdfOutlineItem[]) : null;
}

const PDF_CAPABILITIES: ReaderCapabilities = {
  reflowable: false,
  supportsFontScale: false,
  supportsZoom: true,
  supportsAnnotations: false,
  supportsTOC: true,
};

export class PdfReaderDocument implements ReaderDocument {
  readonly format = 'pdf' as const;
  readonly capabilities = PDF_CAPABILITIES;

  private readonly source: FileSource;
  private pdfDocument: PDFDocumentProxy | null = null;
  private outline: PdfOutlineItem[] | null = null;
  private currentPageIndex = 0;
  private currentScale = 1;
  private closed = false;

  constructor(source: FileSource) {
    this.source = source;
  }

  get isOpen(): boolean {
    return this.pdfDocument !== null && !this.closed;
  }

  async open(preloadedData?: Uint8Array): Promise<void> {
    if (this.closed) throw new PdfDocumentClosedError();
    if (this.pdfDocument !== null) return;

    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

    let data: Uint8Array;
    if (preloadedData) {
      data = preloadedData;
    } else {
      const arrayBuffer = await fetch(this.source.uri).then((res) => res.arrayBuffer());
      data = new Uint8Array(arrayBuffer);
    }

    const loadingTask = pdfjsLib.getDocument({ data });
    this.pdfDocument = await loadingTask.promise;
    this.currentPageIndex = 0;
    this.currentScale = 1;
    try {
      this.outline = toOutlineItems(await this.pdfDocument.getOutline());
    } catch (error) {
      this.outline = null;
    }
  }

  async close(): Promise<void> {
    if (this.pdfDocument !== null) {
      this.pdfDocument.destroy();
      this.pdfDocument = null;
    }
    this.outline = null;
    this.currentPageIndex = 0;
    this.currentScale = 1;
    this.closed = true;
  }

  async getLocator(): Promise<ReaderLocator> {
    this.assertOpen();
    const totalPages = this.pdfDocument!.numPages;
    const page = this.currentPageIndex + 1;
    const progression = totalPages > 1 ? this.currentPageIndex / (totalPages - 1) : 0;
    const locator: PdfLocator = {
      format: 'pdf',
      page,
      progression,
      zoom: this.currentScale,
    };
    return locator;
  }

  async goNext(): Promise<ReaderLocator> {
    this.assertOpen();
    const totalPages = this.pdfDocument!.numPages;
    if (this.currentPageIndex >= totalPages - 1) {
      throw new PdfPageOutOfBoundsError(this.currentPageIndex + 1, totalPages);
    }
    this.currentPageIndex++;
    return this.getLocator();
  }

  async goPrevious(): Promise<ReaderLocator> {
    this.assertOpen();
    if (this.currentPageIndex <= 0) {
      throw new PdfPageOutOfBoundsError(-1, this.pdfDocument!.numPages);
    }
    this.currentPageIndex--;
    return this.getLocator();
  }

  async goToPage(pageIndex: number): Promise<ReaderLocator> {
    this.assertOpen();
    const totalPages = this.pdfDocument!.numPages;
    if (pageIndex < 0 || pageIndex >= totalPages) {
      throw new PdfPageOutOfBoundsError(pageIndex, totalPages);
    }
    this.currentPageIndex = pageIndex;
    return this.getLocator();
  }

  async renderPage(canvas: HTMLCanvasElement, scale?: number): Promise<void> {
    this.assertOpen();
    const effectiveScale = scale ?? this.currentScale;
    await renderPageToCanvas(this.pdfDocument!, this.currentPageIndex, canvas, effectiveScale);
  }

  async getTotalPages(): Promise<number> {
    this.assertOpen();
    return this.pdfDocument!.numPages;
  }

  async getCurrentPageIndex(): Promise<number> {
    this.assertOpen();
    return this.currentPageIndex;
  }

  async setZoom(scale: number): Promise<void> {
    this.assertOpen();
    if (scale <= 0) throw new Error('Zoom scale must be positive');
    this.currentScale = scale;
  }

  async getZoom(): Promise<number> {
    this.assertOpen();
    return this.currentScale;
  }

  async goToTocHref(href: string): Promise<ReaderLocator> {
    const match = /^page:(\d+)$/.exec(href);
    if (!match) throw new Error(`Invalid TOC href: ${href}`);
    return this.goToPage(Number(match[1]));
  }

  async getCurrentChapterIndex(): Promise<number> {
    this.assertOpen();
    return this.currentPageIndex;
  }

  async getMetadata(): Promise<{
    title?: string | undefined;
    author?: string | undefined;
    creator?: string | undefined;
    producer?: string | undefined;
  }> {
    this.assertOpen();
    try {
      const meta = await this.pdfDocument!.getMetadata();
      const info = (meta.info ?? {}) as Record<string, unknown>;
      return {
        title: typeof info.Title === 'string' ? info.Title : undefined,
        author: typeof info.Author === 'string' ? info.Author : undefined,
        creator: typeof info.Creator === 'string' ? info.Creator : undefined,
        producer: typeof info.Producer === 'string' ? info.Producer : undefined,
      };
    } catch (error) {
      return {};
    }
  }

  async getToc(): Promise<TocTree> {
    this.assertOpen();
    if (!this.outline || this.outline.length === 0) return [];
    const toc: TocNavEntry[] = [];
    for (const item of this.outline) {
      toc.push(await this.convertOutlineItem(item));
    }
    return toc;
  }

  async getCoverImageDataUrl(scale = 0.4): Promise<string | null> {
    this.assertOpen();
    try {
      const page = await this.pdfDocument!.getPage(1);
      const viewport = page.getViewport({ scale });
      const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
      if (!canvas) return null;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      await page.render({ canvasContext: ctx, viewport }).promise;
      return canvas.toDataURL('image/jpeg', 0.7);
    } catch (error) {
      return null;
    }
  }

  private async convertOutlineItem(item: PdfOutlineItem): Promise<TocNavEntry> {
    const title = item.title ?? '';
    let href: string | undefined;
    let chapterIndex: number | undefined;
    if (item.dest) {
      try {
        const dest =
          typeof item.dest === 'string'
            ? await this.pdfDocument!.getDestination(item.dest)
            : item.dest;
        const destArray = Array.isArray(dest) ? (dest as unknown[]) : null;
        if (destArray && destArray[0] !== undefined) {
          const pageIndex = await this.pdfDocument!.getPageIndex(
            destArray[0] as Parameters<PDFDocumentProxy['getPageIndex']>[0],
          );
          href = `page:${pageIndex}`;
          chapterIndex = pageIndex;
        }
      } catch (error) {
        href = undefined;
      }
    }
    const children: TocNavEntry[] = [];
    if (item.items && item.items.length > 0) {
      for (const child of item.items) {
        children.push(await this.convertOutlineItem(child));
      }
    }
    return {
      title,
      href,
      ...(chapterIndex !== undefined ? { chapterIndex } : {}),
      children: children.length > 0 ? children : undefined,
    };
  }

  private assertOpen(): void {
    if (this.closed) throw new PdfDocumentClosedError();
    if (this.pdfDocument === null) throw new PdfDocumentNotOpenError();
  }
}
