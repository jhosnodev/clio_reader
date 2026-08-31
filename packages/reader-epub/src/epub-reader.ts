import type { BookFormat } from '@echo-reader/domain';
import type { FileSource, ReaderAdapter, ReaderDocument } from '@echo-reader/reader-core';

import { EpubReaderDocument } from './epub-document.js';

export class EpubReaderAdapter implements ReaderAdapter {
  readonly format: BookFormat = 'epub';

  createDocument(source: FileSource): ReaderDocument {
    return new EpubReaderDocument(source);
  }
}
