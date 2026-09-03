import type { EpubLocator, ReaderPreferences, ReaderLocator } from '@clio-reader/domain';
import type { FileSource, ReaderCapabilities, ReaderDocument } from '@clio-reader/reader-core';

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

    this.parsedEpub = await parseEpub(this.rawData);
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

    return readChapterContent(this.rawData!, chapter.fullPath);
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
