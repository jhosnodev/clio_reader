import type { BookFormat } from '@echo-reader/domain';
import type { FileSource, ReaderAdapter, ReaderDocument } from '@echo-reader/reader-core';

import { PdfReaderDocument } from './pdf-document.js';

export class PdfReaderAdapter implements ReaderAdapter {
  readonly format: BookFormat = 'pdf';

  createDocument(source: FileSource): ReaderDocument {
    return new PdfReaderDocument(source);
  }
}
