import { describe, expect, it } from 'vitest';

import type { FileSource } from '@clio-reader/reader-core';

import { PdfReaderAdapter } from '../src/pdf-reader.js';
import { PdfReaderDocument } from '../src/pdf-document.js';

describe('PdfReaderAdapter', () => {
  const source: FileSource = {
    uri: 'file:///test.pdf',
    name: 'test.pdf',
  };

  it('has pdf format', () => {
    const adapter = new PdfReaderAdapter();
    expect(adapter.format).toBe('pdf');
  });

  it('creates a PdfReaderDocument', () => {
    const adapter = new PdfReaderAdapter();
    const doc = adapter.createDocument(source);

    expect(doc).toBeInstanceOf(PdfReaderDocument);
    expect(doc.format).toBe('pdf');
  });

  it('creates independent documents', () => {
    const adapter = new PdfReaderAdapter();
    const doc1 = adapter.createDocument(source);
    const doc2 = adapter.createDocument(source);

    expect(doc1).not.toBe(doc2);
  });
});
