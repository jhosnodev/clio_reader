/**
 * reader-entry.ts — Entry point del lector de libros (webview)
 *
 * Comunicación con el host: el host usa webview.executeJavaScript() para
 * llamar a window.__initFromHost(data) una vez que lee el archivo.
 * No se usa postMessage porque <webview> no es un iframe.
 */

window.addEventListener('error', (e) => {
  console.error('[reader-entry] UNCAUGHT ERROR:', e.message, e.filename, e.lineno, e.error);
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[reader-entry] UNHANDLED REJECTION:', e.reason);
});

import type { ReaderDocument } from '@clio-reader/reader-core';
import type { ReaderPreferences } from '@clio-reader/domain';
import { EpubReaderDocument } from '@clio-reader/reader-epub';

/* ==========================================================================
   Constantes
   ========================================================================== */

const SUPPORTED_FORMATS = ['epub'] as const;
type SupportedFormat = (typeof SUPPORTED_FORMATS)[number];

const DEFAULT_PREFERENCES: ReaderPreferences = {
  theme: 'light',
  backgroundColor: '#ffffff',
  foregroundColor: '#1f2937',
  accentColor: '#2563eb',
  fontFamily: 'system',
  fontScale: 1,
  lineHeight: 1.5,
  margin: 'comfortable',
  readingDirection: 'ltr',
};

/* ==========================================================================
   Sanitización de HTML (Seguridad: previene XSS desde contenido EPUB)
   ========================================================================== */

const BLOCKED_TAGS = [
  'script',
  'iframe',
  'object',
  'embed',
  'form',
  'input',
  'textarea',
  'button',
  'link',
];
const EVENT_HANDLER_REGEX = /\bon\w+\s*=/gi;
const DANGEROUS_ATTRS = ['srcdoc', 'data', 'codebase', 'formaction'];

function sanitizeHtml(html: string): string {
  let result = html;

  for (const tag of BLOCKED_TAGS) {
    const re = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`, 'gi');
    result = result.replace(re, '');
    const selfCloseRe = new RegExp(`<${tag}\\b[^>]*/>`, 'gi');
    result = result.replace(selfCloseRe, '');
  }

  for (const attr of DANGEROUS_ATTRS) {
    const re = new RegExp(`\\s${attr}\\s*=\\s*["'][^"']*["']`, 'gi');
    result = result.replace(re, '');
  }

  result = result.replace(EVENT_HANDLER_REGEX, '');

  return result;
}

/* ==========================================================================
   Resolución de imágenes embebidas en EPUB
   ========================================================================== */

const IMG_SRC_REGEX = /<img\b([^>]*?)src\s*=\s*["']([^"']+)["']([^>]*?)>/gi;
const SVG_IMAGE_HREF_RE = /<image\b([^>]*?)(?:xlink:)?href\s*=\s*["']([^"']+)["']([^>]*?)>/gi;
const FAILED_IMG_CLASS = 'epub-img-failed';

let previousBlobUrls: string[] = [];

function revokePreviousBlobUrls(): void {
  for (const url of previousBlobUrls) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  }
  previousBlobUrls = [];
}

function addFailedImgClass(match: string): string {
  if (match.includes('class=')) {
    return match.replace(/class\s*=\s*["']([^"']*)["']/, `class="$1 ${FAILED_IMG_CLASS}"`);
  }
  const isImgTag = match.charAt(4) === ' ' || match.charAt(4) === '>';
  if (isImgTag) {
    return match.replace(/<img\b/, `<img class="${FAILED_IMG_CLASS}"`);
  }
  return match.replace(/<image\b/, `<image class="${FAILED_IMG_CLASS}"`);
}

async function resolveImagesInHtml(
  readerDoc: ReaderDocument,
  html: string,
): Promise<string> {
  log('[imgs] resolveImagesInHtml() — HTML length:', html.length);

  const allSrcs: string[] = [];
  const srcTypes: Map<string, 'img' | 'svg'> = new Map();
  let m: RegExpExecArray | null;

  const srcRegex = new RegExp(IMG_SRC_REGEX.source, 'gi');
  while ((m = srcRegex.exec(html)) !== null) {
    if (m[2]) {
      const src = stripFragment(m[2]);
      allSrcs.push(src);
      srcTypes.set(src, 'img');
      log('[imgs] <img> tag encontrado:', m[0].substring(0, 150));
    }
  }

  const svgRegex = new RegExp(SVG_IMAGE_HREF_RE.source, 'gi');
  while ((m = svgRegex.exec(html)) !== null) {
    if (m[2]) {
      const src = stripFragment(m[2]);
      allSrcs.push(src);
      srcTypes.set(src, 'svg');
      log('[imgs] <image> SVG tag encontrado:', m[0].substring(0, 150));
    }
  }

  log('[imgs] tags de imagen encontrados:', allSrcs.length, '(img:', [...srcTypes.values()].filter(t => t === 'img').length, 'svg:', [...srcTypes.values()].filter(t => t === 'svg').length, ')');

  if (allSrcs.length === 0) return html;

  log('[imgs] srcs únicos:', [...new Set(allSrcs)]);

  if (!readerDoc.getImageData) return html;

  revokePreviousBlobUrls();
  const newBlobUrls: string[] = [];
  const blobUrlCache = new Map<string, string>();
  let resolvedCount = 0;
  let failedCount = 0;

  const srcsToResolve = [...new Set(allSrcs.filter((s) => !s.startsWith('data:') && !s.startsWith('blob:')))];
  log('[imgs] srcs a resolver (sin data:/blob:):', srcsToResolve);

  for (const src of srcsToResolve) {
    try {
      log('[imgs] → llamando getImageData para:', JSON.stringify(src));
      const result = await readerDoc.getImageData(src);
      if (result) {
        log('[imgs] ← getImageData OK — tamaño:', result.data.byteLength, 'mimeType:', result.mimeType);
        const buf = result.data.buffer as ArrayBuffer;
        const blob = new Blob(
          [buf.slice(result.data.byteOffset, result.data.byteOffset + result.data.byteLength)],
          { type: result.mimeType },
        );
        const blobUrl = URL.createObjectURL(blob);
        log('[imgs] blob URL creada:', blobUrl);
        blobUrlCache.set(src, blobUrl);
        newBlobUrls.push(blobUrl);
        resolvedCount++;
      } else {
        log('[imgs] ← getImageData retornó NULL para:', JSON.stringify(src));
        blobUrlCache.set(src, '');
        failedCount++;
      }
    } catch (err) {
      log('[imgs] ← getImageData LANZÓ EXCEPCIÓN para:', JSON.stringify(src), 'error:', err);
      blobUrlCache.set(src, '');
      failedCount++;
    }
  }

  log('[imgs] === RESUMEN: resolved=', resolvedCount, 'failed=', failedCount, 'total=', allSrcs.length, '===');

  previousBlobUrls = newBlobUrls;

  let resultHtml = html;
  for (const [src, blobUrl] of blobUrlCache) {
    const safeSrc = escapeRegExp(src);
    if (!blobUrl) {
      const imgFailRe = new RegExp(
        `(<img\\b[^>]*?src\\s*=\\s*["']${safeSrc}["'][^>]*?>)`,
        'gi',
      );
      resultHtml = resultHtml.replace(imgFailRe, addFailedImgClass);
      const svgFailRe = new RegExp(
        `(<image\\b[^>]*?(?:xlink:)?href\\s*=\\s*["']${safeSrc}["'][^>]*?>)`,
        'gi',
      );
      resultHtml = resultHtml.replace(svgFailRe, addFailedImgClass);
      log('[imgs] FAILED — clase epub-img-failed agregada para:', JSON.stringify(src));
      continue;
    }
    const imgRe = new RegExp(
      `(<img\\b[^>]*?)src\\s*=\\s*["']${safeSrc}["']([^>]*?>)`,
      'gi',
    );
    resultHtml = resultHtml.replace(imgRe, `$1src="${blobUrl}"$2`);
    const svgRe = new RegExp(
      `(<image\\b[^>]*?)(xlink:)?href\\s*=\\s*["']${safeSrc}["']([^>]*?>)`,
      'gi',
    );
    resultHtml = resultHtml.replace(svgRe, (_match, pre, xlinkPrefix, post) => {
      const prefix = xlinkPrefix ? 'xlink:' : '';
      return `${pre}${prefix}href="${blobUrl}"${post}`;
    });
    log('[imgs] REemplazado — src/href de', JSON.stringify(src), '→', blobUrl.substring(0, 40) + '...');
  }

  log('[imgs] HTML resultante (primeros 500 chars):', resultHtml.substring(0, 500));
  return resultHtml;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripFragment(href: string): string {
  const hashIndex = href.indexOf('#');
  return hashIndex >= 0 ? href.substring(0, hashIndex) : href;
}

/* ==========================================================================
   Funciones puras — Query params
   ========================================================================== */

interface QueryParams {
  readonly uri: string;
  readonly format: SupportedFormat;
}

function parseQueryParams(): QueryParams {
  log('parseQueryParams()');
  const params = new URLSearchParams(window.location.search);
  const uri = params.get('uri');
  const format = params.get('format')?.toLowerCase();
  log('params extraídos:', { uri, format });

  if (!uri) {
    throw new ReaderError('Falta el parámetro "uri" en la URL');
  }

  if (!format || !isSupportedFormat(format)) {
    throw new ReaderError(
      `Formato no soportado: "${format ?? 'desconocido'}". Formatos válidos: ${SUPPORTED_FORMATS.join(', ')}`,
    );
  }

  log('parseQueryParams() OK:', { uri, format });
  return { uri, format };
}

function isSupportedFormat(value: string): value is SupportedFormat {
  return (SUPPORTED_FORMATS as readonly string[]).includes(value);
}

/* ==========================================================================
   Errores personalizados
   ========================================================================== */

class ReaderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReaderError';
  }
}

/* ==========================================================================
   Gestión de estado de UI
   ========================================================================== */

type UIState =
  | { readonly type: 'loading' }
  | { readonly type: 'error'; readonly message: string }
  | { readonly type: 'content' };

const ELEMENT_IDS = [
  'reader-loading',
  'reader-error',
  'reader-content',
  'reader-controls',
] as const;

function setUIState(state: UIState): void {
  const visibility: Record<string, boolean> = {
    'reader-loading': false,
    'reader-error': false,
    'reader-content': false,
    'reader-controls': false,
  };

  switch (state.type) {
    case 'loading':
      visibility['reader-loading'] = true;
      break;
    case 'error':
      visibility['reader-error'] = true;
      break;
    case 'content':
      visibility['reader-content'] = true;
      visibility['reader-controls'] = true;
      break;
  }

  for (const id of ELEMENT_IDS) {
    const el = document.getElementById(id);
    if (el) {
      el.style.display = visibility[id] ? (id === 'reader-controls' ? 'flex' : 'block') : 'none';
    }
  }

  if (state.type === 'error') {
    const errorMessage = document.getElementById('reader-error-message');
    if (errorMessage) errorMessage.textContent = state.message;
  }
}

/* ==========================================================================
   Renderizado de capítulo
   ========================================================================== */

async function renderChapter(
  readerDoc: ReaderDocument,
  preferences: ReaderPreferences,
): Promise<void> {
  log('renderChapter()');
  const contentEl = document.getElementById('reader-content');
  const chapterInfo = document.getElementById('chapter-info');
  const btnPrev = document.getElementById('btn-prev') as HTMLButtonElement | null;
  const btnNext = document.getElementById('btn-next') as HTMLButtonElement | null;

  if (!contentEl) {
    log('ERROR: reader-content element no encontrado');
    return;
  }

  if (!readerDoc.getCurrentChapterContent) {
    throw new ReaderError('El formato no soporta renderizado de contenido');
  }

  log('obteniendo contenido del capítulo...');
  const htmlContent = await readerDoc.getCurrentChapterContent();
  log('contenido obtenido, tamaño:', htmlContent.length, 'caracteres');

  log('resolviendo recursos (imágenes)...');
  const resolvedHtml = await resolveImagesInHtml(readerDoc, htmlContent);

  log('sanitizando HTML...');
  contentEl.innerHTML = sanitizeHtml(resolvedHtml);
  log('HTML sanitizado e inyectado');

  const injectedImages = contentEl.querySelectorAll('img');
  log('[imgs] <img> en DOM después de inyección:', injectedImages.length);
  injectedImages.forEach((img, i) => {
    const src = img.getAttribute('src') ?? '(sin src)';
    const isBlob = src.startsWith('blob:');
    log(`[imgs] img[${i}] src:`, src.substring(0, 100), '| isBlob:', isBlob);

    img.addEventListener('load', () => {
      log(`[imgs] img[${i}] ONLOAD — naturalWidth:`, img.naturalWidth, 'naturalHeight:', img.naturalHeight);
    });
    img.addEventListener('error', () => {
      log(`[imgs] img[${i}] ONERROR — src:`, src.substring(0, 100));
      if (!img.classList.contains(FAILED_IMG_CLASS)) {
        img.classList.add(FAILED_IMG_CLASS);
      }
    });
  });

  const svgImages = contentEl.querySelectorAll('image');
  log('[imgs] <image> SVG en DOM después de inyección:', svgImages.length);
  svgImages.forEach((svgImg, i) => {
    const href = svgImg.getAttribute('href') ?? svgImg.getAttributeNS('http://www.w3.org/1999/xlink', 'href') ?? '(sin href)';
    const isBlob = href.startsWith('blob:');
    log(`[imgs] svg-image[${i}] href:`, href.substring(0, 100), '| isBlob:', isBlob);

    svgImg.addEventListener('load', () => {
      log(`[imgs] svg-image[${i}] ONLOAD`);
    });
    svgImg.addEventListener('error', () => {
      log(`[imgs] svg-image[${i}] ONERROR — href:`, href.substring(0, 100));
      if (!svgImg.classList.contains(FAILED_IMG_CLASS)) {
        svgImg.classList.add(FAILED_IMG_CLASS);
      }
    });
  });

  if (readerDoc.applyPreferences) {
    const existingStyle = contentEl.querySelector('style');
    if (existingStyle) existingStyle.remove();

    const styleEl = document.createElement('style');
    log('aplicando preferencias/tema...');
    const css = await readerDoc.applyPreferences(preferences);
    styleEl.textContent = css;
    contentEl.prepend(styleEl);
    log('tema aplicado');
  }

  if (readerDoc.getCurrentChapterIndex && readerDoc.getChapterCount) {
    const currentIndex = await readerDoc.getCurrentChapterIndex();
    const totalChapters = await readerDoc.getChapterCount();
    log('capítulo:', currentIndex + 1, 'de', totalChapters);

    if (chapterInfo) {
      chapterInfo.textContent = `Capítulo ${currentIndex + 1} de ${totalChapters}`;
    }

    if (btnPrev) btnPrev.disabled = currentIndex <= 0;
    if (btnNext) btnNext.disabled = currentIndex >= totalChapters - 1;
  }

  contentEl.scrollTop = 0;
  log('renderChapter() completado');
}

/* ==========================================================================
   Navegación
   ========================================================================== */

function setupNavigation(readerDoc: ReaderDocument, preferences: ReaderPreferences): void {
  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('btn-next');

  if (btnPrev) {
    btnPrev.addEventListener('click', () => navigateChapter(readerDoc, preferences, 'previous'));
  }

  if (btnNext) {
    btnNext.addEventListener('click', () => navigateChapter(readerDoc, preferences, 'next'));
  }
}

async function navigateChapter(
  readerDoc: ReaderDocument,
  preferences: ReaderPreferences,
  direction: 'next' | 'previous',
): Promise<void> {
  try {
    if (direction === 'next') {
      await readerDoc.goNext();
    } else {
      await readerDoc.goPrevious();
    }
    await renderChapter(readerDoc, preferences);
  } catch (error) {
    if (error instanceof Error && error.name === 'EpubNavigationError') {
      return;
    }
    throw error;
  }
}

/* ==========================================================================
   Carga de documento
   ========================================================================== */

async function loadDocument(
  uri: string,
  format: SupportedFormat,
  preloadedData?: Uint8Array,
): Promise<ReaderDocument> {
  log('loadDocument() format:', format, 'preloadedData:', preloadedData ? `${preloadedData.byteLength} bytes` : 'undefined');
  switch (format) {
    case 'epub': {
      log('creando EpubReaderDocument...');
      const doc = new EpubReaderDocument({ uri, name: '' });
      log('abriendo documento EPUB...');
      await doc.open(preloadedData);
      log('documento EPUB abierto exitosamente');
      return doc;
    }
    default:
      throw new ReaderError(`Formato no implementado: ${format}`);
  }
}

/* ==========================================================================
   Punto de entrada principal
   ========================================================================== */

let currentReaderDoc: ReaderDocument | null = null;
let currentPreferences: ReaderPreferences = DEFAULT_PREFERENCES;

function log(...args: unknown[]): void {
  console.log('[reader-entry]', ...args);
}

async function main(): Promise<void> {
  log('main() iniciado');
  setUIState({ type: 'loading' });

  try {
    const { uri, format } = parseQueryParams();
    log('query params parseados:', { uri, format });

    // Exponer función global para que el host pueda enviar datos
    (window as unknown as Record<string, unknown>).__initFromHost = async (data: {
      preferences: ReaderPreferences;
      fileData: Array<number> | Uint8Array;
    }) => {
      log('__initFromHost() llamado');
      try {
        // Convertir Array a Uint8Array si es necesario
        const fileData = data.fileData instanceof Uint8Array
          ? data.fileData
          : new Uint8Array(data.fileData);
        log('fileData convertido, tamaño:', fileData.byteLength);

        currentPreferences = data.preferences;
        log('preferences cargadas, tema:', currentPreferences.theme);

        log('iniciando loadDocument()...');
        currentReaderDoc = await loadDocument(uri, format, fileData);
        log('loadDocument() completado');

        setUIState({ type: 'content' });
        log('estado UI cambiado a content');

        log('iniciando renderChapter()...');
        await renderChapter(currentReaderDoc, currentPreferences);
        log('renderChapter() completado');

        setupNavigation(currentReaderDoc, currentPreferences);
        log('navegación configurada');

        log('=== LIBRO CARGADO EXITOSAMENTE ===');
      } catch (error) {
        log('ERROR en __initFromHost:', error);
        const message = error instanceof Error ? error.message : 'Error al abrir el libro';
        setUIState({ type: 'error', message });
      }
    };

    log('__initFromHost expuesto en window, esperando datos del host...');

    // Retry
    const retryBtn = document.getElementById('reader-error-retry');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        log('botón reintentar presionado');
        currentReaderDoc = null;
        main();
      });
    }
  } catch (error) {
    log('ERROR en main():', error);
    const message =
      error instanceof Error ? error.message : 'Error desconocido al abrir el libro';
    setUIState({ type: 'error', message });
  }
}

main();
