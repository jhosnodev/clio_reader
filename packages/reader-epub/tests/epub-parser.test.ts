import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';

import { parseEpub, readChapterContent, EpubParseError } from '../src/epub-parser.js';

async function createTestEpub(
  containerXml?: string,
  opfContent?: string,
  files?: Record<string, string>,
): Promise<Uint8Array> {
  const zip = new JSZip();

  zip.file('mimetype', 'application/epub+zip');

  zip.file(
    'META-INF/container.xml',
    containerXml ??
      `<?xml version="1.0" encoding="UTF-8"?>
<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
  <rootfiles>
    <rootfile full-path="content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
  );

  zip.file(
    'content.opf',
    opfContent ??
      `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Test Book</dc:title>
    <dc:creator>Author</dc:creator>
    <dc:language>en</dc:language>
    <dc:identifier id="uid">test-123</dc:identifier>
  </metadata>
  <manifest>
    <item id="ch1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch2" href="chapter2.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="ch1"/>
    <itemref idref="ch2"/>
  </spine>
</package>`,
  );

  if (files) {
    for (const [name, content] of Object.entries(files)) {
      zip.file(name, content);
    }
  }

  return zip.generateAsync({ type: 'uint8array' });
}

describe('parseEpub', () => {
  it('parses a valid EPUB structure', async () => {
    const data = await createTestEpub(undefined, undefined, {
      'chapter1.xhtml': '<html><body>Ch1</body></html>',
      'chapter2.xhtml': '<html><body>Ch2</body></html>',
    });

    const result = await parseEpub(data);

    expect(result.opf.metadata.title).toBe('Test Book');
    expect(result.opf.metadata.creator).toBe('Author');
    expect(result.opf.metadata.language).toBe('en');
    expect(result.chapters.length).toBe(2);
    expect(result.chapters[0]!.href).toBe('chapter1.xhtml');
    expect(result.chapters[1]!.href).toBe('chapter2.xhtml');
  });

  it('throws EpubParseError when container.xml is missing', async () => {
    const zip = new JSZip();
    zip.file('mimetype', 'application/epub+zip');
    const data = await zip.generateAsync({ type: 'uint8array' });

    await expect(parseEpub(data)).rejects.toThrow(EpubParseError);
  });

  it('throws EpubParseError when rootfile is missing', async () => {
    const data = await createTestEpub(
      `<?xml version="1.0" encoding="UTF-8"?>
<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
  <rootfiles></rootfiles>
</container>`,
    );

    await expect(parseEpub(data)).rejects.toThrow(EpubParseError);
  });

  it('resolves chapter paths in subdirectories', async () => {
    const zip = new JSZip();
    zip.file('mimetype', 'application/epub+zip');
    zip.file(
      'META-INF/container.xml',
      `<?xml version="1.0" encoding="UTF-8"?>
<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
    );
    zip.file(
      'OEBPS/content.opf',
      `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Subdir Book</dc:title>
    <dc:language>en</dc:language>
    <dc:identifier id="uid">test-456</dc:identifier>
  </metadata>
  <manifest>
    <item id="ch1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="ch1"/>
  </spine>
</package>`,
    );
    zip.file('OEBPS/chapter1.xhtml', '<html><body>Ch1</html>');

    const data = await zip.generateAsync({ type: 'uint8array' });
    const result = await parseEpub(data);

    expect(result.chapters[0]!.fullPath).toBe('OEBPS/chapter1.xhtml');
  });

  it('skips non-linear spine items', async () => {
    const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Book</dc:title>
    <dc:language>en</dc:language>
    <dc:identifier id="uid">test-789</dc:identifier>
  </metadata>
  <manifest>
    <item id="ch1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch2" href="chapter2.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="ch1"/>
    <itemref idref="cover" linear="no"/>
    <itemref idref="ch2"/>
  </spine>
</package>`;

    const data = await createTestEpub(undefined, opf, {
      'chapter1.xhtml': '<html><body>Ch1</body></html>',
      'cover.xhtml': '<html><body>Cover</body></html>',
      'chapter2.xhtml': '<html><body>Ch2</body></html>',
    });

    const result = await parseEpub(data);

    expect(result.chapters.length).toBe(2);
    expect(result.chapters[0]!.href).toBe('chapter1.xhtml');
    expect(result.chapters[1]!.href).toBe('chapter2.xhtml');
  });
});

describe('readChapterContent', () => {
  it('reads XHTML content from EPUB', async () => {
    const data = await createTestEpub(undefined, undefined, {
      'chapter1.xhtml': '<html><body><h1>Hello</h1></body></html>',
    });

    const content = await readChapterContent(data, 'chapter1.xhtml');

    expect(content).toContain('<h1>Hello</h1>');
  });

  it('throws EpubParseError for missing file', async () => {
    const data = await createTestEpub();

    await expect(readChapterContent(data, 'nonexistent.xhtml')).rejects.toThrow(EpubParseError);
  });
});
