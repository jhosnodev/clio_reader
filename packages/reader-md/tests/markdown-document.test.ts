import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MarkdownLocator, ReaderPreferences } from '@clio-reader/domain';
import type { FileSource } from '@clio-reader/reader-core';

import {
  MarkdownReaderDocument,
  MarkdownDocumentClosedError,
  MarkdownDocumentNotOpenError,
  MarkdownNavigationError,
} from '../src/markdown-document.js';
import { MarkdownReaderAdapter } from '../src/markdown-reader.js';

const PREFS: ReaderPreferences = {
  theme: 'dark',
  backgroundColor: '#000000',
  foregroundColor: '#ffffff',
  accentColor: '#ffcc00',
  fontFamily: 'serif',
  fontScale: 1.2,
  lineHeight: 1.6,
  margin: 'wide',
  readingDirection: 'ltr',
};

const SOURCE: FileSource = { uri: 'file:///docs/guia.md', name: 'guia.md' };

const SAMPLE = '# Uno\n\ntexto uno\n\n## Seccion\n\nmas texto\n\n# Dos\n\nfinal\n';

function encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

async function openedDoc(): Promise<MarkdownReaderDocument> {
  const doc = new MarkdownReaderDocument(SOURCE);
  await doc.open(encode(SAMPLE));
  return doc;
}

function asMdLocator(locator: unknown): MarkdownLocator {
  return locator as MarkdownLocator;
}

describe('MarkdownReaderDocument', () => {
  it('abre con datos precargados y expone capacidades', async () => {
    const doc = await openedDoc();
    expect(doc.isOpen).toBe(true);
    expect(doc.format).toBe('md');
    expect(doc.capabilities.reflowable).toBe(true);
    expect(doc.capabilities.supportsTOC).toBe(true);
  });

  it('lanza si se usa antes de abrir', async () => {
    const doc = new MarkdownReaderDocument(SOURCE);
    await expect(doc.getLocator()).rejects.toBeInstanceOf(MarkdownDocumentNotOpenError);
  });

  it('lanza tras cerrar', async () => {
    const doc = await openedDoc();
    await doc.close();
    await expect(doc.getLocator()).rejects.toBeInstanceOf(MarkdownDocumentClosedError);
  });

  it('crea una sección vacía para documentos sin headings', async () => {
    const doc = new MarkdownReaderDocument(SOURCE);
    await doc.open(encode('solo texto'));
    expect(await doc.getChapterCount()).toBe(1);
  });

  it('reporta locator con href, offset y positionOrder', async () => {
    const doc = await openedDoc();
    const locator = asMdLocator(await doc.getLocator());
    expect(locator.format).toBe('md');
    expect(locator.href).toBe('#uno');
    expect(locator.positionOrder).toBe(0);
    expect(locator.offset).toBe(0);
  });

  it('navega con goNext/goPrevious respetando límites', async () => {
    const doc = await openedDoc();
    await doc.goNext();
    expect(await doc.getCurrentChapterIndex()).toBe(1);
    expect(asMdLocator(await doc.getLocator()).href).toBe('#seccion');
    await doc.goPrevious();
    expect(await doc.getCurrentChapterIndex()).toBe(0);
    await expect(doc.goPrevious()).rejects.toBeInstanceOf(MarkdownNavigationError);
  });

  it('salta a capítulo y a href de TOC', async () => {
    const doc = await openedDoc();
    await doc.goToChapter(2);
    expect(asMdLocator(await doc.getLocator()).href).toBe('#dos');
    await doc.goToTocHref('#seccion');
    expect(await doc.getCurrentChapterIndex()).toBe(1);
    await doc.goToTocHref('seccion');
    expect(await doc.getCurrentChapterIndex()).toBe(1);
    await expect(doc.goToTocHref('#nope')).rejects.toBeInstanceOf(MarkdownNavigationError);
  });

  it('devuelve el contenido envuelto en md-content', async () => {
    const doc = await openedDoc();
    const html = await doc.getCurrentChapterContent();
    expect(html).toContain('<div class="md-content">');
    expect(html).toContain('<h1 id="uno">Uno</h1>');
  });

  it('expone el TOC anidado', async () => {
    const doc = await openedDoc();
    const toc = await doc.getToc();
    expect(toc).toHaveLength(2);
    expect(toc[0]!.chapterIndex).toBe(0);
    expect(toc[0]!.children![0]!.chapterIndex).toBe(1);
  });

  it('genera CSS de preferencias', async () => {
    const doc = await openedDoc();
    const css = await doc.applyPreferences(PREFS);
    expect(css).toContain('serif');
    expect(css).toContain('22.80px');
    expect(css).toContain('padding-left: 96px');
  });

  it('deriva el título del primer H1', async () => {
    const doc = await openedDoc();
    expect(await doc.getTitle()).toBe('Uno');
  });

  it('usa el nombre del archivo como título si no hay H1', async () => {
    const doc = new MarkdownReaderDocument(SOURCE);
    await doc.open(encode('## solo h2\n'));
    expect(await doc.getTitle()).toBe('guia');
  });

  describe('getImageData', () => {
    let fetchSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      fetchSpy = vi.spyOn(globalThis, 'fetch' as Parameters<typeof vi.spyOn>[1]);
    });

    afterEach(() => {
      fetchSpy.mockRestore();
    });

    it('resuelve imágenes relativas al documento', async () => {
      fetchSpy.mockResolvedValue(
        new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { 'content-type': 'image/png' },
        }),
      );
      const doc = await openedDoc();
      const image = await doc.getImageData('img/foto.png');
      expect(fetchSpy).toHaveBeenCalledWith('file:///docs/img/foto.png');
      expect(image?.mimeType).toBe('image/png');
      expect(image?.data).toEqual(new Uint8Array([1, 2, 3]));
    });

    it('devuelve null ante errores de red', async () => {
      fetchSpy.mockRejectedValue(new Error('offline'));
      const doc = await openedDoc();
      expect(await doc.getImageData('img/foto.png')).toBeNull();
    });

    it('devuelve null si la respuesta no es ok', async () => {
      fetchSpy.mockResolvedValue(new Response(null, { status: 404 }));
      const doc = await openedDoc();
      expect(await doc.getImageData('img/foto.png')).toBeNull();
    });
  });
});

describe('MarkdownReaderAdapter', () => {
  it('crea documentos md', () => {
    const adapter = new MarkdownReaderAdapter();
    expect(adapter.format).toBe('md');
    expect(adapter.createDocument(SOURCE)).toBeInstanceOf(MarkdownReaderDocument);
  });
});
