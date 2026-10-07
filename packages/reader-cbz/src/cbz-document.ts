import type { CbzLocator, ReaderLocator } from '@clio-reader/domain';
import type { FileSource, ReaderCapabilities, ReaderDocument } from '@clio-reader/reader-core';

import { getImageMimeType, sortImageFiles } from './image-sort.js';
import { extractImagesFromZip, type ExtractedImage } from './zip-extractor.js';

export class CbzDocumentClosedError extends Error {
  constructor() {
    super('Cannot operate on a closed CBZ document');
    this.name = 'CbzDocumentClosedError';
  }
}

export class CbzDocumentNotOpenError extends Error {
  constructor() {
    super('CBZ document has not been opened');
    this.name = 'CbzDocumentNotOpenError';
  }
}

export class CbzPageOutOfBoundsError extends Error {
  constructor(pageIndex: number, totalPages: number) {
    super(`Page index ${pageIndex} is out of bounds (total: ${totalPages})`);
    this.name = 'CbzPageOutOfBoundsError';
  }
}

export class CbzEmptyArchiveError extends Error {
  constructor() {
    super('CBZ archive contains no images');
    this.name = 'CbzEmptyArchiveError';
  }
}

const CBZ_CAPABILITIES: ReaderCapabilities = {
  reflowable: false,
  supportsFontScale: false,
  supportsZoom: true,
  supportsAnnotations: false,
};

export class CbzReaderDocument implements ReaderDocument {
  readonly format = 'cbz' as const;
  readonly capabilities = CBZ_CAPABILITIES;

  private readonly source: FileSource;
  private images: ExtractedImage[] | null = null;
  private sortedFileNames: string[] | null = null;
  private currentPageIndex = 0;
  private closed = false;

  constructor(source: FileSource) {
    this.source = source;
  }

  get isOpen(): boolean {
    return this.images !== null && !this.closed;
  }

  async open(preloadedData?: Uint8Array): Promise<void> {
    if (this.closed) throw new CbzDocumentClosedError();
    if (this.images !== null) return;

    let rawData: Uint8Array;
    if (preloadedData) {
      rawData = preloadedData;
    } else {
      const arrayBuffer = await fetch(this.source.uri).then((res) => res.arrayBuffer());
      rawData = new Uint8Array(arrayBuffer);
    }

    const extracted = await extractImagesFromZip(rawData);

    if (extracted.length === 0) {
      throw new CbzEmptyArchiveError();
    }

    const fileNames = extracted.map((e) => e.fileName);
    const sorted = sortImageFiles(fileNames);

    const sortedImages: ExtractedImage[] = [];
    for (const name of sorted) {
      const entry = extracted.find((e) => e.fileName === name);
      if (entry) {
        sortedImages.push(entry);
      }
    }

    this.images = sortedImages;
    this.sortedFileNames = sorted;
    this.currentPageIndex = 0;
  }

  async close(): Promise<void> {
    this.images = null;
    this.sortedFileNames = null;
    this.currentPageIndex = 0;
    this.closed = true;
  }

  async getLocator(): Promise<ReaderLocator> {
    this.assertOpen();

    const totalPages = this.images!.length;
    const page = this.currentPageIndex + 1;
    const progression = totalPages > 1 ? this.currentPageIndex / (totalPages - 1) : 0;

    const locator: CbzLocator = {
      format: 'cbz',
      page,
      progression,
    };

    return locator;
  }

  async goNext(): Promise<ReaderLocator> {
    this.assertOpen();

    if (this.currentPageIndex >= this.images!.length - 1) {
      throw new CbzPageOutOfBoundsError(this.currentPageIndex + 1, this.images!.length);
    }

    this.currentPageIndex++;
    return this.getLocator();
  }

  async goPrevious(): Promise<ReaderLocator> {
    this.assertOpen();

    if (this.currentPageIndex <= 0) {
      throw new CbzPageOutOfBoundsError(-1, this.images!.length);
    }

    this.currentPageIndex--;
    return this.getLocator();
  }

  async goToPage(pageIndex: number): Promise<ReaderLocator> {
    this.assertOpen();

    const totalPages = this.images!.length;
    if (pageIndex < 0 || pageIndex >= totalPages) {
      throw new CbzPageOutOfBoundsError(pageIndex, totalPages);
    }

    this.currentPageIndex = pageIndex;
    return this.getLocator();
  }

  async getCurrentImage(): Promise<Uint8Array> {
    this.assertOpen();
    return this.images![this.currentPageIndex]!.data;
  }

  async getImageMimeType(): Promise<string> {
    this.assertOpen();
    const fileName = this.sortedFileNames![this.currentPageIndex]!;
    return getImageMimeType(fileName);
  }

  async getTotalPages(): Promise<number> {
    this.assertOpen();
    return this.images!.length;
  }

  async getCurrentPageIndex(): Promise<number> {
    this.assertOpen();
    return this.currentPageIndex;
  }

  private assertOpen(): void {
    if (this.closed) throw new CbzDocumentClosedError();
    if (this.images === null) throw new CbzDocumentNotOpenError();
  }
}
