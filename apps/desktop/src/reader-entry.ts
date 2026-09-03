/**
 * reader-entry.ts — Entry point del lector de libros (webview)
 *
 * Comunicación con el host: el host usa webview.executeJavaScript() para
 * llamar a window.__initFromHost(data) una vez que lee el archivo.
 * No se usa postMessage porque <webview> no es un iframe.
 */

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
  const doc = new DOMParser().parseFromString(html, 'text/html');

  for (const tag of BLOCKED_TAGS) {
    const elements = doc.querySelectorAll(tag);
    elements.forEach((el) => el.remove());
  }

  const allElements = doc.querySelectorAll('*');
  for (const el of allElements) {
    const attrs = Array.from(el.attributes);
    for (const attr of attrs) {
      if (EVENT_HANDLER_REGEX.test(attr.name)) {
        el.removeAttribute(attr.name);
      }
      if (DANGEROUS_ATTRS.includes(attr.name.toLowerCase())) {
        el.removeAttribute(attr.name);
      }
    }
  }

  return doc.body.innerHTML;
}

/* ==========================================================================
   Funciones puras — Query params
   ========================================================================== */

interface QueryParams {
  readonly uri: string;
  readonly format: SupportedFormat;
}

function parseQueryParams(): QueryParams {
  const params = new URLSearchParams(window.location.search);
  const uri = params.get('uri');
  const format = params.get('format')?.toLowerCase();

  if (!uri) {
    throw new ReaderError('Falta el parámetro "uri" en la URL');
  }

  if (!format || !isSupportedFormat(format)) {
    throw new ReaderError(
      `Formato no soportado: "${format ?? 'desconocido'}". Formatos válidos: ${SUPPORTED_FORMATS.join(', ')}`,
    );
  }

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
  const contentEl = document.getElementById('reader-content');
  const chapterInfo = document.getElementById('chapter-info');
  const btnPrev = document.getElementById('btn-prev') as HTMLButtonElement | null;
  const btnNext = document.getElementById('btn-next') as HTMLButtonElement | null;

  if (!contentEl) return;

  if (!readerDoc.getCurrentChapterContent) {
    throw new ReaderError('El formato no soporta renderizado de contenido');
  }

  const htmlContent = await readerDoc.getCurrentChapterContent();
  contentEl.innerHTML = sanitizeHtml(htmlContent);

  if (readerDoc.applyPreferences) {
    const existingStyle = contentEl.querySelector('style');
    if (existingStyle) existingStyle.remove();

    const styleEl = document.createElement('style');
    const css = await readerDoc.applyPreferences(preferences);
    styleEl.textContent = css;
    contentEl.prepend(styleEl);
  }

  if (readerDoc.getCurrentChapterIndex && readerDoc.getChapterCount) {
    const currentIndex = await readerDoc.getCurrentChapterIndex();
    const totalChapters = await readerDoc.getChapterCount();
    if (chapterInfo) {
      chapterInfo.textContent = `Capítulo ${currentIndex + 1} de ${totalChapters}`;
    }

    if (btnPrev) btnPrev.disabled = currentIndex <= 0;
    if (btnNext) btnNext.disabled = currentIndex >= totalChapters - 1;
  }

  contentEl.scrollTop = 0;
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
  switch (format) {
    case 'epub': {
      const doc = new EpubReaderDocument({ uri, name: '' });
      await doc.open(preloadedData);
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

async function main(): Promise<void> {
  setUIState({ type: 'loading' });

  try {
    const { uri, format } = parseQueryParams();

    // Exponer función global para que el host pueda enviar datos
    (window as Record<string, unknown>).__initFromHost = async (data: {
      preferences: ReaderPreferences;
      fileData: Uint8Array;
    }) => {
      try {
        currentPreferences = data.preferences;
        currentReaderDoc = await loadDocument(uri, format, data.fileData);
        setUIState({ type: 'content' });
        await renderChapter(currentReaderDoc, currentPreferences);
        setupNavigation(currentReaderDoc, currentPreferences);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Error al abrir el libro';
        setUIState({ type: 'error', message });
      }
    };

    // Retry
    const retryBtn = document.getElementById('reader-error-retry');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        currentReaderDoc = null;
        main();
      });
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error desconocido al abrir el libro';
    setUIState({ type: 'error', message });
  }
}

main();
