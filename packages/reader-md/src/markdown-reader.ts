import type { BookFormat } from '@clio-reader/domain';
import type { FileSource, ReaderAdapter, ReaderDocument } from '@clio-reader/reader-core';

import { MarkdownReaderDocument } from './markdown-document.js';

export class MarkdownReaderAdapter implements ReaderAdapter {
  readonly format: BookFormat = 'md';

  createDocument(source: FileSource): ReaderDocument {
    return new MarkdownReaderDocument(source);
  }
}
