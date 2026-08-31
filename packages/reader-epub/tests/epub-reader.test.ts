import { describe, expect, it } from 'vitest';

import type { FileSource } from '@echo-reader/reader-core';

import { EpubReaderAdapter } from '../src/epub-reader.js';
import { EpubReaderDocument } from '../src/epub-document.js';

describe('EpubReaderAdapter', () => {
  it('has epub format', () => {
    const adapter = new EpubReaderAdapter();
    expect(adapter.format).toBe('epub');
  });

  it('creates an EpubReaderDocument', () => {
    const adapter = new EpubReaderAdapter();
    const source: FileSource = {
      uri: 'file:///test.epub',
      name: 'test.epub',
    };

    const doc = adapter.createDocument(source);

    expect(doc).toBeInstanceOf(EpubReaderDocument);
    expect(doc.format).toBe('epub');
  });

  it('document has correct capabilities', () => {
    const adapter = new EpubReaderAdapter();
    const source: FileSource = {
      uri: 'file:///test.epub',
      name: 'test.epub',
    };

    const doc = adapter.createDocument(source);

    expect(doc.capabilities).toEqual({
      reflowable: true,
      supportsFontScale: true,
      supportsZoom: false,
      supportsAnnotations: false,
    });
  });
});
