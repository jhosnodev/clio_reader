import type { CbzLocator, ReaderLocator } from '@clio-reader/domain';
import type {
  FileSource,
  ReaderCapabilities,
  ReaderDocument,
  TocNavEntry,
  TocTree,
} from '@clio-reader/reader-core';

import { getImageMimeType, sortImageFiles } from './image-sort.js';
import {
  extractComicInfoFromZip,
  extractImagesFromZip,
  type ExtractedImage,
} from './zip-extractor.js';
import type { ComicInfo } from './comic-info.js';

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
  supportsTOC: true,
};

export class CbzReaderDocument implements ReaderDocument {
  readonly format = 'cbz' as const;
  readonly capabilities = CBZ_CAPABILITIES;

  private readonly source: FileSource;
  private images: ExtractedImage[] | null = null;
  private sortedFileNames: string[] | null = null;
  private comicInfo: ComicInfo | null = null;
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

    const [extracted, comicInfo] = await Promise.all([
      extractImagesFromZip(rawData),
      extractComicInfoFromZip(rawData),
    ]);

    if (extracted.length === 0) {
      throw new CbzEmptyArchiveError();
    }

    this.comicInfo = comicInfo;

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
    this.comicInfo = null;
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
    series?: string | undefined;
    language?: string | undefined;
  }> {
    this.assertOpen();
    const info = this.comicInfo;
    if (!info) return {};
    const author = [info.Writer, info.Penciller, info.Inker, info.CoverArtist, info.Editor]
      .filter(Boolean)
      .join(', ');
    const title = info.Title ?? info.Series ?? undefined;
    return {
      title,
      author: author || undefined,
      series: info.Series ?? undefined,
      language: info.LanguageISO ?? undefined,
    };
  }

  async getToc(): Promise<TocTree> {
    this.assertOpen();
    const total = this.images!.length;
    if (total === 0) return [];
    const toc: TocNavEntry[] = [];
    for (let i = 0; i < total; i++) {
      const name = this.sortedFileNames![i]!;
      const base = name.split('/').pop() ?? name;
      toc.push({
        title: `Página ${i + 1}${base !== `${i + 1}` ? ` — ${base}` : ''}`,
        href: `page:${i}`,
        chapterIndex: i,
      });
    }
    return toc;
  }

  async getCoverImageDataUrl(maxWidth = 400): Promise<string | null> {
    this.assertOpen();
    if (this.images!.length === 0) return null;
    try {
      let idx = 0;
      if (this.comicInfo?.Cover) {
        const coverNum = parseInt(this.comicInfo.Cover, 10);
        if (!isNaN(coverNum) && coverNum >= 1 && coverNum <= this.images!.length) {
          idx = coverNum - 1;
        }
      }
      const data = this.images![idx]!.data;
      const mime = getImageMimeType(this.sortedFileNames![idx]!);

      if (typeof createImageBitmap === 'function' && typeof document !== 'undefined') {
        try {
          const blob = new Blob([data as BlobPart], { type: mime });
          const bitmap = await createImageBitmap(blob);
          const scale = Math.min(1, maxWidth / bitmap.width);
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(bitmap.width * scale));
          canvas.height = Math.max(1, Math.round(bitmap.height * scale));
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            bitmap.close?.();
            return canvas.toDataURL('image/jpeg', 0.8);
          }
        } catch {
          // fall through to raw base64
        }
      }

      let binary = '';
      const bytes = data;
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]!);
      }
      const base64 =
        typeof btoa !== 'undefined'
          ? btoa(binary)
          : Buffer.from(binary, 'binary').toString('base64');
      return `data:${mime};base64,${base64}`;
    } catch (error) {
      return null;
    }
  }

  private assertOpen(): void {
    if (this.closed) throw new CbzDocumentClosedError();
    if (this.images === null) throw new CbzDocumentNotOpenError();
  }
}
