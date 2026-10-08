import type { MarkdownLocator, ReaderLocator, ReaderPreferences } from '@clio-reader/domain';
import type {
  FileSource,
  ReaderCapabilities,
  ReaderDocument,
  TocNavEntry,
  TocTree,
} from '@clio-reader/reader-core';

import { parseMarkdown, type ParsedMarkdown } from './markdown-parser.js';
import { generateReaderStyle } from './markdown-themes.js';

export class MarkdownDocumentClosedError extends Error {
  constructor() {
    super('Cannot operate on a closed Markdown document');
    this.name = 'MarkdownDocumentClosedError';
  }
}

export class MarkdownDocumentNotOpenError extends Error {
  constructor() {
    super('Markdown document has not been opened');
    this.name = 'MarkdownDocumentNotOpenError';
  }
}

export class MarkdownNavigationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MarkdownNavigationError';
  }
}

const MARKDOWN_CAPABILITIES: ReaderCapabilities = {
  reflowable: true,
  supportsFontScale: true,
  supportsZoom: false,
  supportsAnnotations: false,
  supportsTOC: true,
};

function decodeUtf8(data: Uint8Array): string {
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder('utf-8').decode(data);
  }
  let binary = '';
  for (let i = 0; i < data.byteLength; i++) {
    binary += String.fromCharCode(data[i]!);
  }
  return binary;
}

const IMAGE_MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  avif: 'image/avif',
};

export class MarkdownReaderDocument implements ReaderDocument {
  readonly format = 'md' as const;
  readonly capabilities = MARKDOWN_CAPABILITIES;

  private readonly source: FileSource;
  private parsed: ParsedMarkdown | null = null;
  private currentSectionIndex = 0;
  private closed = false;

  constructor(source: FileSource) {
    this.source = source;
  }

  get isOpen(): boolean {
    return this.parsed !== null && !this.closed;
  }

  async open(preloadedData?: Uint8Array): Promise<void> {
    if (this.closed) throw new MarkdownDocumentClosedError();
    if (this.parsed !== null) return;

    let data: Uint8Array;
    if (preloadedData) {
      data = preloadedData;
    } else {
      const arrayBuffer = await fetch(this.source.uri).then((res) => res.arrayBuffer());
      data = new Uint8Array(arrayBuffer);
    }

    const text = decodeUtf8(data);
    const parsed = parseMarkdown(text);

    if (parsed.sections.length === 0) {
      this.parsed = {
        sections: [{ index: 0, level: 0, title: '', slug: '', offset: 0, html: '<p></p>' }],
        toc: [],
      };
    } else {
      this.parsed = parsed;
    }

    this.currentSectionIndex = 0;
  }

  async close(): Promise<void> {
    this.parsed = null;
    this.currentSectionIndex = 0;
    this.closed = true;
  }

  async getLocator(): Promise<ReaderLocator> {
    this.assertOpen();
    const sections = this.parsed!.sections;
    const total = sections.length;
    const current = sections[this.currentSectionIndex];
    const progression = total > 1 ? this.currentSectionIndex / (total - 1) : 0;

    const locator: MarkdownLocator = {
      format: 'md',
      progression,
      positionOrder: this.currentSectionIndex,
      ...(current && current.slug ? { href: `#${current.slug}` } : {}),
      ...(current ? { offset: current.offset } : {}),
    };

    return locator;
  }

  async goNext(): Promise<ReaderLocator> {
    this.assertOpen();
    const total = this.parsed!.sections.length;
    if (this.currentSectionIndex >= total - 1) {
      throw new MarkdownNavigationError(`Cannot go next: at last section (${total}/${total})`);
    }
    this.currentSectionIndex++;
    return this.getLocator();
  }

  async goPrevious(): Promise<ReaderLocator> {
    this.assertOpen();
    if (this.currentSectionIndex <= 0) {
      throw new MarkdownNavigationError('Cannot go previous: at first section');
    }
    this.currentSectionIndex--;
    return this.getLocator();
  }

  async goToChapter(idx: number): Promise<ReaderLocator> {
    this.assertOpen();
    const total = this.parsed!.sections.length;
    if (idx < 0 || idx >= total) {
      throw new MarkdownNavigationError(
        `Cannot go to section ${idx}: out of range (0-${total - 1})`,
      );
    }
    this.currentSectionIndex = idx;
    return this.getLocator();
  }

  async goToTocHref(href: string): Promise<ReaderLocator> {
    this.assertOpen();
    const slug = href.startsWith('#') ? href.slice(1) : href;
    const index = this.parsed!.sections.findIndex((section) => section.slug === slug);
    if (index < 0) {
      throw new MarkdownNavigationError(`Section not found for href: ${href}`);
    }
    return this.goToChapter(index);
  }

  async getCurrentChapterContent(): Promise<string> {
    this.assertOpen();
    const section = this.parsed!.sections[this.currentSectionIndex];
    if (!section) {
      throw new MarkdownNavigationError('No section at current index');
    }
    return `<div class="md-content">${section.html}</div>`;
  }

  async getChapterCount(): Promise<number> {
    this.assertOpen();
    return this.parsed!.sections.length;
  }

  async getCurrentChapterIndex(): Promise<number> {
    this.assertOpen();
    return this.currentSectionIndex;
  }

  async getToc(): Promise<TocTree> {
    this.assertOpen();
    return this.parsed!.toc as TocNavEntry[];
  }

  async applyPreferences(prefs: ReaderPreferences): Promise<string> {
    this.assertOpen();
    return generateReaderStyle(prefs);
  }

  async getImageData(href: string): Promise<{ data: Uint8Array; mimeType: string } | null> {
    this.assertOpen();
    const cleanHref = href.includes('#') ? href.substring(0, href.indexOf('#')) : href;
    if (cleanHref.length === 0) return null;

    try {
      const resolved = new URL(cleanHref, this.source.uri).toString();
      const response = await fetch(resolved);
      if (!response.ok) return null;
      const buffer = new Uint8Array(await response.arrayBuffer());
      const headerType = response.headers.get('content-type')?.split(';')[0]?.trim();
      const ext = cleanHref.split('.').pop()?.toLowerCase() ?? '';
      const mimeType = headerType || IMAGE_MIME_BY_EXTENSION[ext] || 'application/octet-stream';
      return { data: buffer, mimeType };
    } catch {
      return null;
    }
  }

  async getTitle(): Promise<string | undefined> {
    this.assertOpen();
    return this.parsed!.title ?? this.source.name.replace(/\.[^.]+$/, '');
  }

  private assertOpen(): void {
    if (this.closed) throw new MarkdownDocumentClosedError();
    if (this.parsed === null) throw new MarkdownDocumentNotOpenError();
  }
}
