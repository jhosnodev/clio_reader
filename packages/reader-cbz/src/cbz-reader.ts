import type { BookFormat } from '@clio-reader/domain';
import type { FileSource, ReaderAdapter, ReaderDocument } from '@clio-reader/reader-core';

import { CbzReaderDocument } from './cbz-document.js';

export class CbzReaderAdapter implements ReaderAdapter {
  readonly format: BookFormat = 'cbz';

  createDocument(source: FileSource): ReaderDocument {
    return new CbzReaderDocument(source);
  }
}
