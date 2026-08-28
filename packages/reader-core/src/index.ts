import type { BookFormat, ReaderLocator } from '@echo-reader/domain';

export interface FileSource {
  readonly uri: string;
  readonly name: string;
  readonly mimeType?: string;
}

export interface ReaderCapabilities {
  readonly reflowable: boolean;
  readonly supportsFontScale: boolean;
  readonly supportsZoom: boolean;
  readonly supportsAnnotations: boolean;
}

export interface ReaderDocument {
  readonly format: BookFormat;
  readonly capabilities: ReaderCapabilities;
  open(): Promise<void>;
  close(): Promise<void>;
  getLocator(): Promise<ReaderLocator>;
  goNext(): Promise<ReaderLocator>;
  goPrevious(): Promise<ReaderLocator>;
}

export interface ReaderAdapter {
  readonly format: BookFormat;
  createDocument(source: FileSource): ReaderDocument;
}

export class ReaderFactory {
  private readonly adapters = new Map<BookFormat, ReaderAdapter>();

  register(adapter: ReaderAdapter): void {
    this.adapters.set(adapter.format, adapter);
  }

  create(source: FileSource, format: BookFormat): ReaderDocument {
    const adapter = this.adapters.get(format);
    if (!adapter) {
      throw new UnsupportedFormatError(format);
    }
    return adapter.createDocument(source);
  }
}

export class UnsupportedFormatError extends Error {
  constructor(format: BookFormat) {
    super(`No reader adapter registered for format: ${format}`);
    this.name = 'UnsupportedFormatError';
  }
}
