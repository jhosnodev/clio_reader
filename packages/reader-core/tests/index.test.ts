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
