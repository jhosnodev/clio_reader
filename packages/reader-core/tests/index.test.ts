import { describe, expect, it } from 'vitest';

import type { FileSource, ReaderAdapter, ReaderDocument } from '../src/index.js';
import { ReaderFactory, UnsupportedFormatError } from '../src/index.js';

const source: FileSource = {
  uri: 'file:///example.epub',
  name: 'example.epub',
};

function fakeDocument(): ReaderDocument {
  return {
    format: 'epub',
    capabilities: {
      reflowable: true,
      supportsFontScale: true,
      supportsZoom: false,
      supportsAnnotations: true,
    },
    open: async () => undefined,
    close: async () => undefined,
    getLocator: async () => ({ format: 'epub', href: 'chapter.xhtml' }),
    goNext: async () => ({ format: 'epub', href: 'chapter.xhtml' }),
    goPrevious: async () => ({ format: 'epub', href: 'chapter.xhtml' }),
  };
}

describe('ReaderFactory', () => {
  it('creates a document from the registered adapter', () => {
    const factory = new ReaderFactory();
    const adapter: ReaderAdapter = {
      format: 'epub',
      createDocument: () => fakeDocument(),
    };

    factory.register(adapter);

    expect(factory.create(source, 'epub').format).toBe('epub');
  });

  it('rejects an unregistered format', () => {
    const factory = new ReaderFactory();

    expect(() => factory.create(source, 'pdf')).toThrow(UnsupportedFormatError);
  });
});

describe('detectBookFormat', () => {
  it('detects supported formats case-insensitively', async () => {
    const { detectBookFormat } = await import('../src/index.js');

    expect(detectBookFormat('Novel.EPUB')).toBe('epub');
    expect(detectBookFormat('manual.pdf')).toBe('pdf');
    expect(detectBookFormat('comic.cbz')).toBe('cbz');
    expect(detectBookFormat('notes.md')).toBe('md');
  });

  it('falls back to a supported MIME type', async () => {
    const { detectBookFormat } = await import('../src/index.js');

    expect(detectBookFormat('book', 'application/pdf')).toBe('pdf');
  });
});

describe('transitionReaderSession', () => {
  it('moves from opening to ready and then closed', async () => {
    const { INITIAL_READER_SESSION, transitionReaderSession } = await import('../src/index.js');
    const opening = transitionReaderSession(INITIAL_READER_SESSION, {
      type: 'openRequested',
      source,
      format: 'epub',
    });
    const ready = transitionReaderSession(opening, {
      type: 'opened',
      locator: { format: 'epub', href: 'chapter.xhtml' },
    });
    const closed = transitionReaderSession(ready, { type: 'closeRequested' });

    expect(opening.status).toBe('opening');
    expect(ready.status).toBe('ready');
    expect(closed).toEqual({ status: 'closed' });
  });

  it('rejects navigation before a document is ready', async () => {
    const { INITIAL_READER_SESSION, transitionReaderSession } = await import('../src/index.js');

    expect(() =>
      transitionReaderSession(INITIAL_READER_SESSION, { type: 'navigationStarted' }),
    ).toThrow('Cannot apply navigationStarted while reader session is idle');
  });
});
