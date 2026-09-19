import type { EpubLocator, ReaderPreferences, ReaderLocator } from '@clio-reader/domain';
import type { FileSource, ReaderCapabilities, ReaderDocument } from '@clio-reader/reader-core';

import JSZip from 'jszip';
import {
  parseEpub,
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
  private zipArchive: JSZip | null = null;
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

    this.zipArchive = await JSZip.loadAsync(this.rawData);
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
    this.zipArchive = null;
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
    const zip = this.zipArchive!;
    const entry = zip.file(chapter.fullPath);
    if (!entry) {
      throw new EpubNavigationError(`Chapter file not found: ${chapter.fullPath}`);
    }
    const content = await entry.async('string');
    epubLog('getCurrentChapterContent() HTML length:', content.length);

    const imgCount = (content.match(/<img\b/gi) ?? []).length;
    const svgImageCount = (content.match(/<image\b/gi) ?? []).length;
    epubLog('getCurrentChapterContent() <img> tags:', imgCount, '| <image> SVG tags:', svgImageCount);

    if (imgCount > 0) {
      const srcMatches = content.match(/src\s*=\s*["']([^"']+)["']/gi) ?? [];
      epubLog('getCurrentChapterContent() img srcs:', srcMatches.slice(0, 10));
    }

    if (svgImageCount > 0) {
      const hrefMatches = content.match(/(?:xlink:)?href\s*=\s*["']([^"']+)["']/gi) ?? [];
      epubLog('getCurrentChapterContent() svg image hrefs:', hrefMatches.slice(0, 10));
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

  async goToChapter(idx: number): Promise<ReaderLocator> {
    this.assertOpen();
    const chapters = this.parsedEpub!.chapters;
    if (idx < 0 || idx >= chapters.length) {
      throw new EpubNavigationError(`Cannot go to chapter ${idx}: out of range (0-${chapters.length - 1})`);
    }
    this.currentChapterIndex = idx;
    return this.getLocator();
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

    const cleanHref = href.includes('#') ? href.substring(0, href.indexOf('#')) : href;
    epubLog('getImageData() href:', JSON.stringify(href), 'cleanHref:', JSON.stringify(cleanHref));

    const chapter = this.parsedEpub!.chapters[this.currentChapterIndex];
    if (!chapter) {
      epubLog('getImageData() NO hay capítulo en índice', this.currentChapterIndex);
      return null;
    }

    const chapterDir = chapter.fullPath.includes('/')
      ? chapter.fullPath.substring(0, chapter.fullPath.lastIndexOf('/') + 1)
      : '';

    epubLog('getImageData() chapter.fullPath:', JSON.stringify(chapter.fullPath), 'chapterDir:', JSON.stringify(chapterDir));

    const zip = this.zipArchive!;
    const basePath = this.parsedEpub!.opf.basePath;

    epubLog('getImageData() opf.basePath:', JSON.stringify(basePath));

    const resolvedPath = this.resolveHref(chapterDir, cleanHref);
    epubLog('getImageData() intento 1 — resolveHref(chapterDir, href):', JSON.stringify(resolvedPath));

    let entry = zip.file(resolvedPath) ?? null;

    if (!entry) {
      const directPath = cleanHref;
      epubLog('getImageData() intento 2 — cleanHref directo:', JSON.stringify(directPath));
      entry = zip.file(directPath) ?? null;
    }

    if (!entry) {
      const opfResolved = this.resolveHref(basePath, cleanHref);
      epubLog('getImageData() intento 3 — resolveHref(basePath, href):', JSON.stringify(opfResolved));
      entry = zip.file(opfResolved) ?? null;
    }

    if (!entry) {
      const fileName = cleanHref.split('/').pop() ?? cleanHref;
      const allFiles = Object.keys(zip.files);
      const matchingFile = allFiles.find((f) => f.endsWith(fileName));
      epubLog('getImageData() intento 4 — filename match:', JSON.stringify(fileName), 'found:', JSON.stringify(matchingFile ?? null));
      if (matchingFile) {
        entry = zip.file(matchingFile) ?? null;
      }
    }

    if (!entry) {
      const rootResolved = this.resolveHref('/', cleanHref);
      epubLog('getImageData() intento 5 — resolveHref("/", href):', JSON.stringify(rootResolved));
      entry = zip.file(rootResolved) ?? null;
    }

    if (!entry) {
      const allFiles = Object.keys(zip.files);
      epubLog('getImageData() TODOS los archivos del ZIP (' + allFiles.length + '):');
      allFiles.forEach((f, i) => epubLog('  [' + i + '] ' + f));
      return null;
    }

    epubLog('getImageData() ENCONTRADO:', entry.name);

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
