import { describe, expect, it } from 'vitest';

import type { FileSource } from '@clio-reader/reader-core';

import { CbzReaderAdapter } from '../src/cbz-reader.js';
import { CbzReaderDocument } from '../src/cbz-document.js';

describe('CbzReaderAdapter', () => {
  it('has cbz format', () => {
    const adapter = new CbzReaderAdapter();
    expect(adapter.format).toBe('cbz');
  });

  it('creates a CbzReaderDocument', () => {
    const adapter = new CbzReaderAdapter();
    const source: FileSource = {
      uri: 'file:///test.cbz',
      name: 'test.cbz',
    };

    const doc = adapter.createDocument(source);

    expect(doc).toBeInstanceOf(CbzReaderDocument);
    expect(doc.format).toBe('cbz');
  });

  it('document has correct capabilities', () => {
    const adapter = new CbzReaderAdapter();
    const source: FileSource = {
      uri: 'file:///test.cbz',
      name: 'test.cbz',
    };

    const doc = adapter.createDocument(source);

    expect(doc.capabilities).toEqual({
      reflowable: false,
      supportsFontScale: false,
      supportsZoom: true,
      supportsAnnotations: false,
      supportsTOC: true,
    });
  });
});
