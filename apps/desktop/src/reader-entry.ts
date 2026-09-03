/**
 * reader-entry.ts — Entry point del lector de libros (webview)
 *
 * Principios aplicados:
 * - SRP: Cada función tiene una única responsabilidad
 * - OCP: Abierto a extensión (nuevos formatos) sin modificar este archivo
 * - DIP: Depende de abstractions (EpubReaderDocument)
 * - Funciones puras donde es posible
 * - Manejo de errores en los límites
 */

import { EpubReaderDocument } from '@echo-reader/reader-epub';
import type { ReaderDocument } from '@echo-reader/reader-core';
import type { ReaderPreferences } from '@echo-reader/domain';

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
   Gestión de estado de UI (SRP: cada función controla un solo estado)
   ========================================================================== */

function showLoading(): void {
  const loading = document.getElementById('reader-loading');
  const error = document.getElementById('reader-error');
  const content = document.getElementById('reader-content');
  const controls = document.getElementById('reader-controls');

  if (loading) loading.style.display = 'flex';
  if (error) error.style.display = 'none';
  if (content) content.style.display = 'none';
  if (controls) controls.style.display = 'none';
}

function showError(message: string): void {
  const loading = document.getElementById('reader-loading');
  const error = document.getElementById('reader-error');
  const errorMessage = document.getElementById('reader-error-message');
  const content = document.getElementById('reader-content');
  const controls = document.getElementById('reader-controls');

  if (loading) loading.style.display = 'none';
  if (error) error.style.display = 'flex';
  if (errorMessage) errorMessage.textContent = message;
  if (content) content.style.display = 'none';
  if (controls) controls.style.display = 'none';
}

function showContent(): void {
  const loading = document.getElementById('reader-loading');
  const error = document.getElementById('reader-error');
  const content = document.getElementById('reader-content');
  const controls = document.getElementById('reader-controls');

  if (loading) loading.style.display = 'none';
  if (error) error.style.display = 'none';
  if (content) content.style.display = 'block';
  if (controls) controls.style.display = 'flex';
}

/* ==========================================================================
   Renderizado de capítulo (SRP: solo renderiza contenido)
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

  // Obtener contenido del capítulo actual
  const epubDoc = readerDoc as EpubReaderDocument;
  const htmlContent = await epubDoc.getCurrentChapterContent();
  contentEl.innerHTML = htmlContent;

  // Aplicar estilos del tema
  const existingStyle = contentEl.querySelector('style');
  if (existingStyle) existingStyle.remove();

  const styleEl = document.createElement('style');
  const css = await epubDoc.applyPreferences(preferences);
  styleEl.textContent = css;
  contentEl.prepend(styleEl);

  // Actualizar información del capítulo
  const currentIndex = await epubDoc.getCurrentChapterIndex();
  const totalChapters = await epubDoc.getChapterCount();
  if (chapterInfo) {
    chapterInfo.textContent = `Capítulo ${currentIndex + 1} de ${totalChapters}`;
  }

  // Actualizar estado de botones de navegación
  if (btnPrev) {
    btnPrev.disabled = currentIndex <= 0;
  }
  if (btnNext) {
    btnNext.disabled = currentIndex >= totalChapters - 1;
  }

  // Notificar al host que el capítulo está listo
  communicateToHost({ type: 'chapter-changed' });

  // Scroll al inicio
  contentEl.scrollTop = 0;
}

/* ==========================================================================
   Comunicación con el host (SRP: solo maneja mensajes postMessage)
   ========================================================================== */

function communicateToHost(message: unknown): void {
  window.parent.postMessage(message, '*');
}

/* ==========================================================================
   Navegación (SRP: solo maneja prev/next)
   ========================================================================== */

function setupNavigation(readerDoc: ReaderDocument, preferences: ReaderPreferences): void {
  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('btn-next');

  if (btnPrev) {
    btnPrev.addEventListener('click', async () => {
      try {
        await readerDoc.goPrevious();
        await renderChapter(readerDoc, preferences);
      } catch (error) {
        if (error instanceof Error && error.name === 'EpubNavigationError') {
          return;
        }
        throw error;
      }
    });
  }

  if (btnNext) {
    btnNext.addEventListener('click', async () => {
      try {
        await readerDoc.goNext();
        await renderChapter(readerDoc, preferences);
      } catch (error) {
        if (error instanceof Error && error.name === 'EpubNavigationError') {
          return;
        }
        throw error;
      }
    });
  }
}

/* ==========================================================================
   Carga de documento (SRP: solo crea y abre el documento)
   ========================================================================== */

async function loadDocument(uri: string, format: SupportedFormat): Promise<ReaderDocument> {
  switch (format) {
    case 'epub': {
      const doc = new EpubReaderDocument({ uri, name: '' });
      await doc.open();
      return doc;
    }
    default:
      throw new ReaderError(`Formato no implementado: ${format}`);
  }
}

/* ==========================================================================
   Punto de entrada principal (Orquestador)
   ========================================================================== */

async function main(): Promise<void> {
  showLoading();

  try {
    const { uri, format } = parseQueryParams();
    const readerDoc = await loadDocument(uri, format);

    const preferences = DEFAULT_PREFERENCES;

    await renderChapter(readerDoc, preferences);
    setupNavigation(readerDoc, preferences);

    showContent();
    communicateToHost({ type: 'ready' });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error desconocido al abrir el libro';
    showError(message);
    communicateToHost({ type: 'error', message });
  }
}

main();
