import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';

import type { OpfPackage } from '../src/epub-parser.js';
import { extractToc } from '../src/epub-toc.js';

async function createEpubWithToc(
  tocContent: string,
  opf?: Partial<OpfPackage>,
): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip');

  const defaultOpf: OpfPackage = {
    metadata: { title: 'Test', language: 'en' },
    manifest: [
      { id: 'nav', href: 'nav.xhtml', mediaType: 'application/xhtml+xml', properties: 'nav' },
      { id: 'ncx', href: 'toc.ncx', mediaType: 'application/x-dtbncx+xml' },
    ],
    spine: [],
    basePath: '',
  };

  const mergedOpf = { ...defaultOpf, ...opf };
  const manifestJson = JSON.stringify(mergedOpf.manifest);

  zip.file(
    'content.opf',
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Test</dc:title>
    <dc:language>en</dc:language>
    <dc:identifier id="uid">test</dc:identifier>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
  </manifest>
  <spine/>
</package>`,
  );

  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
  <rootfiles>
    <rootfile full-path="content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
  );

  zip.file('nav.xhtml', tocContent);

  return zip.generateAsync({ type: 'uint8array' });
}

describe('extractToc', () => {
  it('extracts TOC from EPUB 3 nav document', async () => {
    const navHtml = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Table of Contents</title></head>
<body>
  <nav epub:type="toc">
    <ol>
      <li><a href="chapter1.xhtml">Chapter 1</a></li>
      <li><a href="chapter2.xhtml">Chapter 2</a></li>
      <li><a href="chapter3.xhtml">Chapter 3</a></li>
    </ol>
  </nav>
</body>
</html>`;

    const data = await createEpubWithToc(navHtml);
    const opf: OpfPackage = {
      metadata: {},
      manifest: [
        { id: 'nav', href: 'nav.xhtml', mediaType: 'application/xhtml+xml', properties: 'nav' },
      ],
      spine: [],
      basePath: '',
    };

    const toc = await extractToc(data, opf);

    expect(toc.length).toBe(3);
    expect(toc[0]!.title).toBe('Chapter 1');
    expect(toc[0]!.href).toBe('chapter1.xhtml');
    expect(toc[1]!.title).toBe('Chapter 2');
    expect(toc[2]!.title).toBe('Chapter 3');
  });

  it('extracts nested TOC entries', async () => {
    const navHtml = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<body>
  <nav epub:type="toc">
    <ol>
      <li>
        <a href="part1.xhtml">Part 1</a>
        <ol>
          <li><a href="ch1.xhtml">Chapter 1</a></li>
          <li><a href="ch2.xhtml">Chapter 2</a></li>
        </ol>
      </li>
      <li><a href="part2.xhtml">Part 2</a></li>
    </ol>
  </nav>
</body>
</html>`;

    const data = await createEpubWithToc(navHtml);
    const opf: OpfPackage = {
      metadata: {},
      manifest: [
        { id: 'nav', href: 'nav.xhtml', mediaType: 'application/xhtml+xml', properties: 'nav' },
      ],
      spine: [],
      basePath: '',
    };

    const toc = await extractToc(data, opf);

    expect(toc.length).toBe(2);
    expect(toc[0]!.title).toBe('Part 1');
    expect(toc[0]!.children.length).toBe(2);
    expect(toc[0]!.children[0]!.title).toBe('Chapter 1');
    expect(toc[0]!.children[1]!.title).toBe('Chapter 2');
    expect(toc[1]!.title).toBe('Part 2');
    expect(toc[1]!.children.length).toBe(0);
  });

  it('returns empty array when no TOC item found', async () => {
    const zip = new JSZip();
    zip.file('mimetype', 'application/epub+zip');
    zip.file(
      'META-INF/container.xml',
      `<?xml version="1.0" encoding="UTF-8"?>
<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
  <rootfiles>
    <rootfile full-path="content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
    );
    zip.file(
      'content.opf',
      `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Test</dc:title>
    <dc:language>en</dc:language>
    <dc:identifier id="uid">test</dc:identifier>
  </metadata>
  <manifest>
    <item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="ch1"/>
  </spine>
</package>`,
    );

    const data = await zip.generateAsync({ type: 'uint8array' });
    const opf: OpfPackage = {
      metadata: {},
      manifest: [{ id: 'ch1', href: 'ch1.xhtml', mediaType: 'application/xhtml+xml' }],
      spine: [],
      basePath: '',
    };

    const toc = await extractToc(data, opf);

    expect(toc).toEqual([]);
  });
});
