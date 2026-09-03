import type { BookFormat, ReaderLocator, ReaderPreferences } from '@echo-reader/domain';

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
  getCurrentChapterContent?(): Promise<string>;
  getChapterCount?(): Promise<number>;
  getCurrentChapterIndex?(): Promise<number>;
  applyPreferences?(prefs: ReaderPreferences): Promise<string>;
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

export class UnsupportedBookFormatError extends Error {
  constructor(fileName: string) {
    super(`Unsupported book format: ${fileName}`);
    this.name = 'UnsupportedBookFormatError';
  }
}

const FORMAT_BY_EXTENSION: Record<string, BookFormat> = {
  epub: 'epub',
  pdf: 'pdf',
  cbz: 'cbz',
  md: 'md',
};

const FORMAT_BY_MIME: Record<string, BookFormat> = {
  'application/epub+zip': 'epub',
  'application/pdf': 'pdf',
  'application/x-cbz': 'cbz',
  'text/markdown': 'md',
};

export function detectBookFormat(fileName: string, mimeType?: string): BookFormat {
  const extension = fileName.split('.').pop()?.toLowerCase();
  const format = extension ? FORMAT_BY_EXTENSION[extension] : undefined;
  if (format) {
    return format;
  }

  const mimeFormat = mimeType ? FORMAT_BY_MIME[mimeType.toLowerCase()] : undefined;
  if (mimeFormat) {
    return mimeFormat;
  }

  throw new UnsupportedBookFormatError(fileName);
}

export type ReaderSessionStatus = 'idle' | 'opening' | 'ready' | 'navigating' | 'error' | 'closed';

export interface ReaderSessionState {
  readonly status: ReaderSessionStatus;
  readonly source?: FileSource;
  readonly format?: BookFormat;
  readonly locator?: ReaderLocator;
  readonly error?: string;
}

export type ReaderSessionEvent =
  | { readonly type: 'openRequested'; readonly source: FileSource; readonly format: BookFormat }
  | { readonly type: 'opened'; readonly locator: ReaderLocator }
  | { readonly type: 'navigationStarted' }
  | { readonly type: 'locatorChanged'; readonly locator: ReaderLocator }
  | { readonly type: 'closeRequested' }
  | { readonly type: 'failed'; readonly message: string };

export const INITIAL_READER_SESSION: ReaderSessionState = { status: 'idle' };

export class InvalidSessionTransitionError extends Error {
  constructor(status: ReaderSessionStatus, event: ReaderSessionEvent['type']) {
    super(`Cannot apply ${event} while reader session is ${status}`);
    this.name = 'InvalidSessionTransitionError';
  }
}

export function transitionReaderSession(
  state: ReaderSessionState,
  event: ReaderSessionEvent,
): ReaderSessionState {
  switch (event.type) {
    case 'openRequested':
      if (!['idle', 'closed', 'error'].includes(state.status)) {
        throw new InvalidSessionTransitionError(state.status, event.type);
      }
      return {
        status: 'opening',
        source: event.source,
        format: event.format,
      };
    case 'opened': {
      if (state.status !== 'opening') {
        throw new InvalidSessionTransitionError(state.status, event.type);
      }
      const { error: discardedError, ...stateWithoutError } = state;
      void discardedError;
      return { ...stateWithoutError, status: 'ready', locator: event.locator };
    }
    case 'navigationStarted':
      if (state.status !== 'ready') {
        throw new InvalidSessionTransitionError(state.status, event.type);
      }
      return { ...state, status: 'navigating' };
    case 'locatorChanged':
      if (!['ready', 'navigating'].includes(state.status)) {
        throw new InvalidSessionTransitionError(state.status, event.type);
      }
      return { ...state, status: 'ready', locator: event.locator };
    case 'failed':
      if (!['opening', 'navigating', 'ready'].includes(state.status)) {
        throw new InvalidSessionTransitionError(state.status, event.type);
      }
      return { ...state, status: 'error', error: event.message };
    case 'closeRequested':
      if (state.status === 'idle' || state.status === 'closed') {
        throw new InvalidSessionTransitionError(state.status, event.type);
      }
      return { status: 'closed' };
  }
}
