import type { EpubLocator, ReaderPreferences, ReaderLocator } from '@clio-reader/domain';
import type { FileSource, ReaderCapabilities, ReaderDocument } from '@clio-reader/reader-core';

import JSZip from 'jszip';
import {
  parseEpub,
  readChapterContent,
  type ChapterEntry,
  type ParsedEpub,
} from './epub-parser.js';
import { extractToc, type TocEntry } from './epub-toc.js';
import { generateReaderStyle } from './epub-themes.js';

export class EpubDocumentClosedError extends Error {
  constructor() {
    super('Cannot operate on a closed EPUB document');
    this.name = 'EpubDocumentClosedError';
  }
}

export class EpubDocumentNotOpenError extends Error {
  constructor() {
    super('EPUB document has not been opened');
    this.name = 'EpubDocumentNotOpenError';
  }
}

export class EpubNavigationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EpubNavigationError';
  }
}

const EPUB_CAPABILITIES: ReaderCapabilities = {
  reflowable: true,
  supportsFontScale: true,
  supportsZoom: false,
  supportsAnnotations: false,
};

function epubLog(...args: unknown[]): void {
  console.log('[epub-doc]', ...args);
}

export class EpubReaderDocument implements ReaderDocument {
  readonly format = 'epub' as const;
  readonly capabilities = EPUB_CAPABILITIES;

  private readonly source: FileSource;
  private rawData: Uint8Array | null = null;
  private parsedEpub: ParsedEpub | null = null;
  private toc: TocEntry[] = [];
  private currentChapterIndex = 0;
  private closed = false;

  constructor(source: FileSource) {
    this.source = source;
  }

  get isOpen(): boolean {
    return this.rawData !== null && !this.closed;
  }

  async open(preloadedData?: Uint8Array): Promise<void> {
    if (this.closed) throw new EpubDocumentClosedError();
    if (this.rawData !== null) return;

    if (preloadedData) {
      this.rawData = preloadedData;
    } else {
      const arrayBuffer = await fetch(this.source.uri).then((res) => res.arrayBuffer());
      this.rawData = new Uint8Array(arrayBuffer);
    }

    epubLog('open() rawData tamaño:', this.rawData.byteLength);

    this.parsedEpub = await parseEpub(this.rawData);
    epubLog('open() EPUB parseado OK');
    epubLog('open() OPF basePath:', this.parsedEpub.opf.basePath);
    epubLog('open() manifest items:', this.parsedEpub.opf.manifest.length);
    epubLog('open() spine items:', this.parsedEpub.opf.spine.length);
    epubLog('open() chapters:', this.parsedEpub.chapters.length);

    this.parsedEpub.chapters.forEach((ch, i) => {
      epubLog(`open() chapter[${i}]: id=${ch.id} href=${ch.href} fullPath=${ch.fullPath} mediaType=${ch.mediaType}`);
    });

    const imageItems = this.parsedEpub.opf.manifest.filter((item) =>
      item.mediaType.startsWith('image/'),
    );
    epubLog('open() manifest image items:', imageItems.length);
    imageItems.forEach((item) => {
      epubLog(`open() image manifest: id=${item.id} href=${item.href} mediaType=${item.mediaType}`);
    });

    this.toc = await extractToc(this.rawData, this.parsedEpub.opf);
    this.currentChapterIndex = 0;
  }

  async close(): Promise<void> {
    this.rawData = null;
    this.parsedEpub = null;
    this.toc = [];
    this.currentChapterIndex = 0;
    this.closed = true;
  }

  async getLocator(): Promise<ReaderLocator> {
    this.assertOpen();

    const chapters = this.parsedEpub!.chapters;
    const totalChapters = chapters.length;
    const progression = totalChapters > 1 ? this.currentChapterIndex / (totalChapters - 1) : 0;

    const currentChapter = chapters[this.currentChapterIndex];
    const cfi = this.generateCfi(this.currentChapterIndex);

    const locator: EpubLocator = {
      format: 'epub',
      href: currentChapter?.href ?? '',
      cfi,
      progression,
      positionOrder: this.currentChapterIndex,
    };

    return locator;
  }

  async goNext(): Promise<ReaderLocator> {
    this.assertOpen();

    const chapters = this.parsedEpub!.chapters;
    if (this.currentChapterIndex >= chapters.length - 1) {
      throw new EpubNavigationError(
        `Cannot go next: at last chapter (${chapters.length}/${chapters.length})`,
      );
    }

    this.currentChapterIndex++;
    return this.getLocator();
  }

  async goPrevious(): Promise<ReaderLocator> {
    this.assertOpen();

    if (this.currentChapterIndex <= 0) {
      throw new EpubNavigationError(
        `Cannot go previous: at first chapter (1/${this.parsedEpub!.chapters.length})`,
      );
    }

    this.currentChapterIndex--;
    return this.getLocator();
  }

  async getCurrentChapterContent(): Promise<string> {
    this.assertOpen();

    const chapter = this.parsedEpub!.chapters[this.currentChapterIndex];
    if (!chapter) {
      throw new EpubNavigationError('No chapter at current index');
    }

    epubLog('getCurrentChapterContent() chapter:', chapter.fullPath);
    const content = await readChapterContent(this.rawData!, chapter.fullPath);
    epubLog('getCurrentChapterContent() HTML length:', content.length);
    epubLog('getCurrentChapterContent() HTML COMPLETO:', content);

    const imgCount = (content.match(/<img/gi) ?? []).length;
    epubLog('getCurrentChapterContent() <img> tags en HTML:', imgCount);

    if (imgCount > 0) {
      const srcMatches = content.match(/src\s*=\s*["']([^"']+)["']/gi) ?? [];
      epubLog('getCurrentChapterContent() srcs encontrados:', srcMatches.slice(0, 10));
    }

    return content;
  }

  async getChapterCount(): Promise<number> {
    this.assertOpen();
    return this.parsedEpub!.chapters.length;
  }

  async getCurrentChapterIndex(): Promise<number> {
    this.assertOpen();
    return this.currentChapterIndex;
  }

  async getToc(): Promise<readonly TocEntry[]> {
    this.assertOpen();
    return this.toc;
  }

  async applyPreferences(prefs: ReaderPreferences): Promise<string> {
    this.assertOpen();
    return generateReaderStyle(prefs);
  }

  async getImageData(href: string): Promise<{ data: Uint8Array; mimeType: string } | null> {
    this.assertOpen();

    epubLog('getImageData() href:', href);

    const chapter = this.parsedEpub!.chapters[this.currentChapterIndex];
    if (!chapter) {
      epubLog('getImageData() NO hay capítulo en índice', this.currentChapterIndex);
      return null;
    }

    epubLog('getImageData() chapter.fullPath:', chapter.fullPath);

    const chapterDir = chapter.fullPath.includes('/')
      ? chapter.fullPath.substring(0, chapter.fullPath.lastIndexOf('/') + 1)
      : '';

    epubLog('getImageData() chapterDir:', chapterDir);

    const resolvedPath = this.resolveHref(chapterDir, href);
    epubLog('getImageData() resolvedPath:', resolvedPath);

    const zip = await JSZip.loadAsync(this.rawData!);
    const entry = zip.file(resolvedPath);
    epubLog('getImageData() ZIP entry encontrado:', !!entry);

    if (!entry) {
      epubLog('getImageData() ARCHIVO NO ENCONTRADO en ZIP:', resolvedPath);
      const allFiles = Object.keys(zip.files);
      epubLog('getImageData() archivos en ZIP (primeros 20):', allFiles.slice(0, 20));
      return null;
    }

    const data = new Uint8Array(await entry.async('arraybuffer'));
    epubLog('getImageData() datos extraídos, tamaño:', data.byteLength);

    const ext = resolvedPath.split('.').pop()?.toLowerCase() ?? '';
    const mimeMap: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      bmp: 'image/bmp',
    };
    const mimeType = mimeMap[ext] ?? 'application/octet-stream';
    epubLog('getImageData() ext:', ext, 'mimeType:', mimeType);

    return { data, mimeType };
  }

  private resolveHref(basePath: string, href: string): string {
    if (href.startsWith('/')) return href.substring(1);
    if (!basePath) return href;

    const baseParts = basePath.split('/').filter(Boolean);
    const hrefParts = href.split('/');

    const resolved: string[] = [...baseParts];
    for (const part of hrefParts) {
      if (part === '..') {
        resolved.pop();
      } else if (part !== '.') {
        resolved.push(part);
      }
    }

    return resolved.join('/');
  }

  async getTitle(): Promise<string | undefined> {
    this.assertOpen();
    return this.parsedEpub!.opf.metadata.title;
  }

  async getAuthor(): Promise<string | undefined> {
    this.assertOpen();
    return this.parsedEpub!.opf.metadata.creator;
  }

  private generateCfi(chapterIndex: number): string {
    return `epubcfi(/6/${chapterIndex * 2 + 2})`;
  }

  private assertOpen(): void {
    if (this.closed) throw new EpubDocumentClosedError();
    if (this.rawData === null) throw new EpubDocumentNotOpenError();
  }
}
