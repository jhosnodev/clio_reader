import type { PdfLocator, ReaderLocator } from '@echo-reader/domain';
import type { FileSource, ReaderCapabilities, ReaderDocument } from '@echo-reader/reader-core';
import type { PDFDocumentProxy } from 'pdfjs-dist';

import { renderPageToCanvas } from './pdf-renderer.js';

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

const PDF_CAPABILITIES: ReaderCapabilities = {
  reflowable: false,
  supportsFontScale: false,
  supportsZoom: true,
  supportsAnnotations: false,
};

export class PdfReaderDocument implements ReaderDocument {
  readonly format = 'pdf' as const;
  readonly capabilities = PDF_CAPABILITIES;

  private readonly source: FileSource;
  private pdfDocument: PDFDocumentProxy | null = null;
  private currentPageIndex = 0;
  private currentScale = 1;
  private closed = false;

  constructor(source: FileSource) {
    this.source = source;
  }

  get isOpen(): boolean {
    return this.pdfDocument !== null && !this.closed;
  }

  async open(): Promise<void> {
    if (this.closed) throw new PdfDocumentClosedError();
    if (this.pdfDocument !== null) return;

    const pdfjsLib = await import('pdfjs-dist');

    pdfjsLib.GlobalWorkerOptions.workerSrc = '';

    const arrayBuffer = await fetch(this.source.uri).then((res) => res.arrayBuffer());
    const data = new Uint8Array(arrayBuffer);

    const loadingTask = pdfjsLib.getDocument({ data });
    this.pdfDocument = await loadingTask.promise;
    this.currentPageIndex = 0;
    this.currentScale = 1;
  }

  async close(): Promise<void> {
    if (this.pdfDocument !== null) {
      this.pdfDocument.destroy();
      this.pdfDocument = null;
    }
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
    if (scale <= 0) {
      throw new Error('Zoom scale must be positive');
    }
    this.currentScale = scale;
  }

  async getZoom(): Promise<number> {
    this.assertOpen();
    return this.currentScale;
  }

  private assertOpen(): void {
    if (this.closed) throw new PdfDocumentClosedError();
    if (this.pdfDocument === null) throw new PdfDocumentNotOpenError();
  }
}
