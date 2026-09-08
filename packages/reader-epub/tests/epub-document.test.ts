import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import JSZip from 'jszip';

import type { FileSource } from '@clio-reader/reader-core';

import {
  EpubReaderDocument,
  EpubDocumentClosedError,
  EpubDocumentNotOpenError,
  EpubNavigationError,
} from '../src/epub-document.js';
import type { EpubLocator } from '@clio-reader/domain';

async function createMinimalEpub(
  files: Record<string, string>,
  opfContent?: string,
  spineItems?: string[],
): Promise<Uint8Array> {
  const zip = new JSZip();

  zip.file('mimetype', 'application/epub+zip');

  const manifestItems = Object.keys(files)
    .filter((f) => f.endsWith('.xhtml') || f.endsWith('.html') || f.endsWith('.htm'))
    .map((f, i) => `<item id="ch${i + 1}" href="${f}" media-type="application/xhtml+xml"/>`)
    .join('\n');

  const spineRefs = (
    spineItems ??
    Object.keys(files).filter(
      (f) => f.endsWith('.xhtml') || f.endsWith('.html') || f.endsWith('.htm'),
    )
  )
    .map((f, i) => `<itemref idref="ch${i + 1}"/>`)
    .join('\n');

  const defaultOpf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Test Book</dc:title>
    <dc:creator>Test Author</dc:creator>
    <dc:language>en</dc:language>
    <dc:identifier id="uid">test-epub-123</dc:identifier>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    ${manifestItems}
  </manifest>
  <spine toc="ncx">
    ${spineRefs}
  </spine>
</package>`;

  zip.file('content.opf', opfContent ?? defaultOpf);

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
    'toc.ncx',
    `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <navMap>
    ${Object.keys(files)
      .filter((f) => f.endsWith('.xhtml') || f.endsWith('.html') || f.endsWith('.htm'))
      .map(
        (f, i) =>
          `<navPoint id="np${i + 1}"><navLabel><text>Chapter ${i + 1}</text></navLabel><content src="${f}"/></navPoint>`,
      )
      .join('\n')}
  </navMap>
</ncx>`,
  );

  for (const [name, content] of Object.entries(files)) {
    zip.file(name, content);
  }

  return zip.generateAsync({ type: 'uint8array' });
}

function toEpubLocator(locator: {
  format: string;
  href?: string;
  progression?: number;
}): EpubLocator {
  return locator as EpubLocator;
}

describe('EpubReaderDocument', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch' as Parameters<typeof vi.spyOn>[1]);
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  async function setupDocument(
    files: Record<string, string>,
    opfContent?: string,
    spineItems?: string[],
  ): Promise<EpubReaderDocument> {
    const epubData = await createMinimalEpub(files, opfContent, spineItems);
    fetchSpy.mockResolvedValue(new Response(new Blob([epubData.buffer as ArrayBuffer])));

    const source: FileSource = { uri: 'file:///test.epub', name: 'test.epub' };
    const doc = new EpubReaderDocument(source);
    await doc.open();
    return doc;
  }

  describe('open', () => {
    it('opens a valid EPUB', async () => {
      const doc = await setupDocument({
        'ch1.xhtml': '<html><body><h1>Chapter 1</h1></body></html>',
        'ch2.xhtml': '<html><body><h1>Chapter 2</h1></body></html>',
      });

      expect(doc.isOpen).toBe(true);
      expect(doc.format).toBe('epub');

      await doc.close();
    });

    it('can be opened multiple times (idempotent)', async () => {
      const doc = await setupDocument({
        'ch1.xhtml': '<html><body>Content</body></html>',
      });

      await doc.open();
      const count = await doc.getChapterCount();
      expect(count).toBe(1);

      await doc.close();
    });
  });

  describe('close', () => {
    it('releases resources', async () => {
      const doc = await setupDocument({
        'ch1.xhtml': '<html><body>Content</body></html>',
      });

      await doc.close();

      expect(doc.isOpen).toBe(false);
    });

    it('throws EpubDocumentClosedError after close', async () => {
      const doc = await setupDocument({
        'ch1.xhtml': '<html><body>Content</body></html>',
      });
      await doc.close();

      await expect(doc.getLocator()).rejects.toThrow(EpubDocumentClosedError);
    });
  });

  describe('getLocator', () => {
    it('returns correct locator for first chapter', async () => {
      const doc = await setupDocument({
        'ch1.xhtml': '<html><body>Ch1</body></html>',
        'ch2.xhtml': '<html><body>Ch2</body></html>',
        'ch3.xhtml': '<html><body>Ch3</body></html>',
      });

      const locator = toEpubLocator(await doc.getLocator());

      expect(locator.format).toBe('epub');
      expect(locator.href).toBe('ch1.xhtml');
      expect(locator.progression).toBe(0);
      expect(locator.positionOrder).toBe(0);
      expect(locator.cfi).toBeDefined();

      await doc.close();
    });

    it('returns correct progression for middle chapter', async () => {
      const doc = await setupDocument({
        'ch1.xhtml': '<html><body>Ch1</body></html>',
        'ch2.xhtml': '<html><body>Ch2</body></html>',
        'ch3.xhtml': '<html><body>Ch3</body></html>',
      });

      await doc.goNext();
      const locator = toEpubLocator(await doc.getLocator());

      expect(locator.href).toBe('ch2.xhtml');
      expect(locator.progression).toBe(0.5);
      expect(locator.positionOrder).toBe(1);

      await doc.close();
    });

    it('returns correct progression for last chapter', async () => {
      const doc = await setupDocument({
        'ch1.xhtml': '<html><body>Ch1</body></html>',
        'ch2.xhtml': '<html><body>Ch2</body></html>',
      });

      await doc.goNext();
      const locator = toEpubLocator(await doc.getLocator());

      expect(locator.href).toBe('ch2.xhtml');
      expect(locator.progression).toBe(1);
      expect(locator.positionOrder).toBe(1);

      await doc.close();
    });

    it('returns 0% progression for single chapter', async () => {
      const doc = await setupDocument({
        'ch1.xhtml': '<html><body>Ch1</body></html>',
      });

      const locator = toEpubLocator(await doc.getLocator());

      expect(locator.progression).toBe(0);

      await doc.close();
    });
  });

  describe('goNext', () => {
    it('advances to next chapter', async () => {
      const doc = await setupDocument({
        'ch1.xhtml': '<html><body>Ch1</body></html>',
        'ch2.xhtml': '<html><body>Ch2</body></html>',
      });

      const locator = toEpubLocator(await doc.goNext());

      expect(locator.href).toBe('ch2.xhtml');

      await doc.close();
    });

    it('throws EpubNavigationError at end', async () => {
      const doc = await setupDocument({
        'ch1.xhtml': '<html><body>Ch1</body></html>',
      });

      await expect(doc.goNext()).rejects.toThrow(EpubNavigationError);

      await doc.close();
    });
  });

  describe('goPrevious', () => {
    it('goes back to previous chapter', async () => {
      const doc = await setupDocument({
        'ch1.xhtml': '<html><body>Ch1</body></html>',
        'ch2.xhtml': '<html><body>Ch2</body></html>',
      });

      await doc.goNext();
      const locator = toEpubLocator(await doc.goPrevious());

      expect(locator.href).toBe('ch1.xhtml');

      await doc.close();
    });

    it('throws EpubNavigationError at start', async () => {
      const doc = await setupDocument({
        'ch1.xhtml': '<html><body>Ch1</body></html>',
      });

      await expect(doc.goPrevious()).rejects.toThrow(EpubNavigationError);

      await doc.close();
    });
  });

  describe('getCurrentChapterContent', () => {
    it('returns XHTML content of current chapter', async () => {
      const doc = await setupDocument({
        'ch1.xhtml': '<html><body><h1>Chapter 1</h1><p>Hello</p></body></html>',
      });

      const content = await doc.getCurrentChapterContent();

      expect(content).toContain('<h1>Chapter 1</h1>');
      expect(content).toContain('<p>Hello</p>');

      await doc.close();
    });

    it('returns different content after navigation', async () => {
      const doc = await setupDocument({
        'ch1.xhtml': '<html><body>First</body></html>',
        'ch2.xhtml': '<html><body>Second</body></html>',
      });

      const content1 = await doc.getCurrentChapterContent();
      expect(content1).toContain('First');

      await doc.goNext();
      const content2 = await doc.getCurrentChapterContent();
      expect(content2).toContain('Second');

      await doc.close();
    });
  });

  describe('getChapterCount', () => {
    it('returns correct chapter count', async () => {
      const doc = await setupDocument({
        'ch1.xhtml': '<html><body>Ch1</body></html>',
        'ch2.xhtml': '<html><body>Ch2</body></html>',
        'ch3.xhtml': '<html><body>Ch3</body></html>',
      });

      expect(await doc.getChapterCount()).toBe(3);

      await doc.close();
    });
  });

  describe('getToc', () => {
    it('returns table of contents from NCX', async () => {
      const doc = await setupDocument({
        'ch1.xhtml': '<html><body>Ch1</body></html>',
        'ch2.xhtml': '<html><body>Ch2</body></html>',
      });

      const toc = await doc.getToc();

      expect(toc.length).toBe(2);
      expect(toc[0]!.title).toBe('Chapter 1');
      expect(toc[0]!.href).toBe('ch1.xhtml');
      expect(toc[1]!.title).toBe('Chapter 2');
      expect(toc[1]!.href).toBe('ch2.xhtml');

      await doc.close();
    });
  });

  describe('applyPreferences', () => {
    it('generates CSS for light theme', async () => {
      const doc = await setupDocument({
        'ch1.xhtml': '<html><body>Content</body></html>',
      });

      const css = await doc.applyPreferences({
        theme: 'light',
        backgroundColor: '#ffffff',
        foregroundColor: '#1f2937',
        accentColor: '#2563eb',
        fontFamily: 'system',
        fontScale: 1,
        lineHeight: 1.5,
        margin: 'comfortable',
        readingDirection: 'ltr',
      });

      expect(css).toContain('#ffffff');
      expect(css).toContain('#1f2937');
      expect(css).toContain('font-size: 1rem');
      expect(css).toContain('line-height: 1.5');

      await doc.close();
    });

    it('generates CSS for dark theme', async () => {
      const doc = await setupDocument({
        'ch1.xhtml': '<html><body>Content</body></html>',
      });

      const css = await doc.applyPreferences({
        theme: 'dark',
        backgroundColor: '#1a1a2e',
        foregroundColor: '#e0e0e0',
        accentColor: '#4fc3f7',
        fontFamily: 'serif',
        fontScale: 1.2,
        lineHeight: 1.8,
        margin: 'wide',
        readingDirection: 'rtl',
      });

      expect(css).toContain('#1a1a2e');
      expect(css).toContain('direction: rtl');
      expect(css).toContain('font-size: 1.2rem');
      expect(css).toContain('padding: 24px 96px');

      await doc.close();
    });

    it('generates CSS for sepia theme', async () => {
      const doc = await setupDocument({
        'ch1.xhtml': '<html><body>Content</body></html>',
      });

      const css = await doc.applyPreferences({
        theme: 'sepia',
        backgroundColor: '#f4ecd8',
        foregroundColor: '#5c4b37',
        accentColor: '#8b6914',
        fontFamily: 'dyslexic',
        fontScale: 1.5,
        lineHeight: 2.0,
        margin: 'compact',
        readingDirection: 'ltr',
      });

      expect(css).toContain('#f4ecd8');
      expect(css).toContain('font-size: 1.5rem');
      expect(css).toContain('padding: 24px 16px');

      await doc.close();
    });
  });

  describe('getTitle and getAuthor', () => {
    it('returns metadata from OPF', async () => {
      const doc = await setupDocument({
        'ch1.xhtml': '<html><body>Content</body></html>',
      });

      expect(await doc.getTitle()).toBe('Test Book');
      expect(await doc.getAuthor()).toBe('Test Author');

      await doc.close();
    });
  });

  describe('navigation', () => {
    it('supports multi-chapter navigation', async () => {
      const doc = await setupDocument({
        'ch1.xhtml': '<html><body>Ch1</body></html>',
        'ch2.xhtml': '<html><body>Ch2</body></html>',
        'ch3.xhtml': '<html><body>Ch3</body></html>',
        'ch4.xhtml': '<html><body>Ch4</body></html>',
      });

      expect(toEpubLocator(await doc.getLocator()).href).toBe('ch1.xhtml');

      await doc.goNext();
      expect(toEpubLocator(await doc.getLocator()).href).toBe('ch2.xhtml');

      await doc.goNext();
      expect(toEpubLocator(await doc.getLocator()).href).toBe('ch3.xhtml');

      await doc.goNext();
      expect(toEpubLocator(await doc.getLocator()).href).toBe('ch4.xhtml');

      await doc.goPrevious();
      expect(toEpubLocator(await doc.getLocator()).href).toBe('ch3.xhtml');

      await doc.close();
    });
  });

  describe('capabilities', () => {
    it('has correct EPUB capabilities', () => {
      const doc = new EpubReaderDocument({ uri: 'file:///test.epub', name: 'test.epub' });

      expect(doc.capabilities).toEqual({
        reflowable: true,
        supportsFontScale: true,
        supportsZoom: false,
        supportsAnnotations: false,
      });
    });
  });

  describe('error handling', () => {
    it('throws EpubDocumentNotOpenError when not opened', async () => {
      const doc = new EpubReaderDocument({ uri: 'file:///test.epub', name: 'test.epub' });

      await expect(doc.getLocator()).rejects.toThrow(EpubDocumentNotOpenError);
    });

    it('handles nested chapter directories', async () => {
      const epubData = await createMinimalEpub({
        'OEBPS/chapter1.xhtml': '<html><body>Ch1</body></html>',
        'OEBPS/chapter2.xhtml': '<html><body>Ch2</body></html>',
      });
      fetchSpy.mockResolvedValue(new Response(new Blob([epubData.buffer as ArrayBuffer])));

      const doc = new EpubReaderDocument({ uri: 'file:///test.epub', name: 'test.epub' });
      await doc.open();

      const count = await doc.getChapterCount();
      expect(count).toBe(2);

      await doc.close();
    });
  });

  describe('getImageData', () => {
    it('returns image data for a valid image path', async () => {
      const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const zip = new JSZip();
      zip.file('mimetype', 'application/epub+zip');
      zip.file('META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
  <rootfiles>
    <rootfile full-path="content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`);
      zip.file('content.opf', `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Test</dc:title><dc:language>en</dc:language><dc:identifier id="uid">test</dc:identifier>
  </metadata>
  <manifest>
    <item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/>
    <item id="img1" href="images/figure1.png" media-type="image/png"/>
  </manifest>
  <spine><itemref idref="ch1"/></spine>
</package>`);
      zip.file('toc.ncx', `<?xml version="1.0"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><navMap></navMap></ncx>`);
      zip.file('ch1.xhtml', '<html><body><img src="images/figure1.png"/></body></html>');
      zip.file('images/figure1.png', pngBytes);

      const epubData = await zip.generateAsync({ type: 'uint8array' });
      fetchSpy.mockResolvedValue(new Response(new Blob([epubData.buffer as ArrayBuffer])));

      const doc = new EpubReaderDocument({ uri: 'file:///test.epub', name: 'test.epub' });
      await doc.open();

      const result = await doc.getImageData('images/figure1.png');

      expect(result).not.toBeNull();
      expect(result!.mimeType).toBe('image/png');
      expect(result!.data).toBeInstanceOf(Uint8Array);
      expect(result!.data.byteLength).toBe(pngBytes.byteLength);
      expect(Array.from(result!.data)).toEqual(Array.from(pngBytes));

      await doc.close();
    });

    it('returns null for a missing image', async () => {
      const doc = await setupDocument({
        'ch1.xhtml': '<html><body><img src="nonexistent.png"/></body></html>',
      });

      const result = await doc.getImageData('nonexistent.png');

      expect(result).toBeNull();

      await doc.close();
    });

    it('resolves image path relative to chapter directory', async () => {
      const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
      const zip = new JSZip();
      zip.file('mimetype', 'application/epub+zip');
      zip.file('META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`);
      zip.file('OEBPS/content.opf', `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Test</dc:title><dc:language>en</dc:language><dc:identifier id="uid">test</dc:identifier>
  </metadata>
  <manifest>
    <item id="ch1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="img1" href="images/fig1.png" media-type="image/png"/>
  </manifest>
  <spine><itemref idref="ch1"/></spine>
</package>`);
      zip.file('toc.ncx', `<?xml version="1.0"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><navMap></navMap></ncx>`);
      zip.file('OEBPS/chapter1.xhtml', '<html><body><img src="images/fig1.png"/></body></html>');
      zip.file('OEBPS/images/fig1.png', pngBytes);

      const epubData = await zip.generateAsync({ type: 'uint8array' });
      fetchSpy.mockResolvedValue(new Response(new Blob([epubData.buffer as ArrayBuffer])));

      const doc = new EpubReaderDocument({ uri: 'file:///test.epub', name: 'test.epub' });
      await doc.open();

      const result = await doc.getImageData('images/fig1.png');

      expect(result).not.toBeNull();
      expect(result!.mimeType).toBe('image/png');
      expect(result!.data.byteLength).toBe(pngBytes.byteLength);

      await doc.close();
    });

    it('returns correct MIME type for JPEG images', async () => {
      const jpgBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
      const zip = new JSZip();
      zip.file('mimetype', 'application/epub+zip');
      zip.file('META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
  <rootfiles>
    <rootfile full-path="content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`);
      zip.file('content.opf', `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Test</dc:title><dc:language>en</dc:language><dc:identifier id="uid">test</dc:identifier>
  </metadata>
  <manifest>
    <item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/>
    <item id="img1" href="photo.jpg" media-type="image/jpeg"/>
  </manifest>
  <spine><itemref idref="ch1"/></spine>
</package>`);
      zip.file('toc.ncx', `<?xml version="1.0"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><navMap></navMap></ncx>`);
      zip.file('ch1.xhtml', '<html><body><img src="photo.jpg"/></body></html>');
      zip.file('photo.jpg', jpgBytes);

      const epubData = await zip.generateAsync({ type: 'uint8array' });
      fetchSpy.mockResolvedValue(new Response(new Blob([epubData.buffer as ArrayBuffer])));

      const doc = new EpubReaderDocument({ uri: 'file:///test.epub', name: 'test.epub' });
      await doc.open();

      const result = await doc.getImageData('photo.jpg');

      expect(result).not.toBeNull();
      expect(result!.mimeType).toBe('image/jpeg');

      await doc.close();
    });

    it('does not re-parse ZIP on multiple getImageData calls', async () => {
      const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
      const zip = new JSZip();
      zip.file('mimetype', 'application/epub+zip');
      zip.file('META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
  <rootfiles>
    <rootfile full-path="content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`);
      zip.file('content.opf', `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Test</dc:title><dc:language>en</dc:language><dc:identifier id="uid">test</dc:identifier>
  </metadata>
  <manifest>
    <item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/>
    <item id="img1" href="a.png" media-type="image/png"/>
    <item id="img2" href="b.png" media-type="image/png"/>
  </manifest>
  <spine><itemref idref="ch1"/></spine>
</package>`);
      zip.file('toc.ncx', `<?xml version="1.0"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><navMap></navMap></ncx>`);
      zip.file('ch1.xhtml', '<html><body></body></html>');
      zip.file('a.png', pngBytes);
      zip.file('b.png', new Uint8Array([0x89, 0x50, 0x4e, 0x48]));

      const epubData = await zip.generateAsync({ type: 'uint8array' });
      fetchSpy.mockResolvedValue(new Response(new Blob([epubData.buffer as ArrayBuffer])));

      const loadAsyncSpy = vi.spyOn(JSZip, 'loadAsync');

      const doc = new EpubReaderDocument({ uri: 'file:///test.epub', name: 'test.epub' });
      await doc.open();

      const callsAfterOpen = loadAsyncSpy.mock.calls.length;

      await doc.getImageData('a.png');
      await doc.getImageData('b.png');

      expect(loadAsyncSpy.mock.calls.length).toBe(callsAfterOpen);

      loadAsyncSpy.mockRestore();
      await doc.close();
    });

    it('falls back to filename-only match when path resolution fails', async () => {
      const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
      const zip = new JSZip();
      zip.file('mimetype', 'application/epub+zip');
      zip.file('META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
  <rootfiles>
    <rootfile full-path="content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`);
      zip.file('content.opf', `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Test</dc:title><dc:language>en</dc:language><dc:identifier id="uid">test</dc:identifier>
  </metadata>
  <manifest>
    <item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/>
    <item id="img1" href="deep/nested/path/figure.png" media-type="image/png"/>
  </manifest>
  <spine><itemref idref="ch1"/></spine>
</package>`);
      zip.file('toc.ncx', `<?xml version="1.0"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><navMap></navMap></ncx>`);
      zip.file('ch1.xhtml', '<html><body><img src="wrong/path/figure.png"/></body></html>');
      zip.file('deep/nested/path/figure.png', pngBytes);

      const epubData = await zip.generateAsync({ type: 'uint8array' });
      fetchSpy.mockResolvedValue(new Response(new Blob([epubData.buffer as ArrayBuffer])));

      const doc = new EpubReaderDocument({ uri: 'file:///test.epub', name: 'test.epub' });
      await doc.open();

      const result = await doc.getImageData('wrong/path/figure.png');

      expect(result).not.toBeNull();
      expect(result!.data.byteLength).toBe(pngBytes.byteLength);

      await doc.close();
    });
  });
});
