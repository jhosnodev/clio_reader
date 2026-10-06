/**
 * reader-entry.ts — Entry point del lector de libros (webview)
 *
 * Comunicación con el host: el host usa webview.executeJavaScript() para
 * llamar a window.__initFromHost(data) una vez que lee el archivo.
 */

window.addEventListener('error', (e) => {
  console.error('[reader-entry] UNCAUGHT ERROR:', e.message, e.filename, e.lineno, e.error);
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[reader-entry] UNHANDLED REJECTION:', e.reason);
});

import type { ReaderDocument, TocNavEntry, TocTree } from '@clio-reader/reader-core';
import { hasTextAnchor, withTextAnchor } from '@clio-reader/reader-core';
import type { ReaderPreferences, ReaderLocator, TextAnchor } from '@clio-reader/domain';
import { EpubReaderDocument } from '@clio-reader/reader-epub';
import {
  PREFERENCES_SENTINEL,
  lineHeightToButton,
  pixelSizeFor,
  stepFontScale,
  themeFromWebview,
  webviewFontFor,
  webviewThemeFor,
} from './reader-prefs';
import { createProgressBar } from './reader-progress-controller';
import type { ProgressBarController } from './reader-progress-controller';
import { createSelectionGate } from './reader-selection-gate';
import type { SelectionGate } from './reader-selection-gate';
import { scrollRatio, scrollTopForRatio } from './reader-progress-bar';
import {
  isSameDocumentPosition,
  parseLocator,
  withScrollRatio,
} from './components/reader-progress';
import type { WebviewTheme } from './reader-prefs';
import {
  clearNoteHighlights,
  captureSelection,
  indexChapterText,
  paintActiveNoteHighlight,
  paintNoteHighlights,
  resolveAnchorRange,
} from './reader-text-anchor';

/* ==========================================================================
   Constantes
   ========================================================================== */

const SUPPORTED_FORMATS = ['epub', 'pdf', 'cbz', 'md'] as const;
type SupportedFormat = (typeof SUPPORTED_FORMATS)[number];

const SCROLL_SETTLE_MS = 300;
const SELECTION_SETTLE_MS = 250;
const LOCATOR_REFRESH_MS = 250;
const SCROLL_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'PageUp',
  'PageDown',
  'Home',
  'End',
  ' ',
]);

let scrollSettleTimer: ReturnType<typeof setTimeout> | null = null;

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
   Sanitización de HTML
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
    result = result.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`, 'gi'), '');
    result = result.replace(new RegExp(`<${tag}\\b[^>]*/>`, 'gi'), '');
  }
  for (const attr of DANGEROUS_ATTRS) {
    result = result.replace(new RegExp(`\\s${attr}\\s*=\\s*["'][^"']*["']`, 'gi'), '');
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
      /* ignore */
    }
  }
  previousBlobUrls = [];
}

function addFailedImgClass(match: string): string {
  if (match.includes('class=')) {
    return match.replace(/class\s*=\s*["']([^"']*)["']/, `class="$1 ${FAILED_IMG_CLASS}"`);
  }
  if (match.charAt(4) === ' ' || match.charAt(4) === '>') {
    return match.replace(/<img\b/, `<img class="${FAILED_IMG_CLASS}"`);
  }
  return match.replace(/<image\b/, `<image class="${FAILED_IMG_CLASS}"`);
}

async function resolveImagesInHtml(readerDoc: ReaderDocument, html: string): Promise<string> {
  const allSrcs: string[] = [];
  const srcTypes: Map<string, 'img' | 'svg'> = new Map();
  let m: RegExpExecArray | null;

  const srcRegex = new RegExp(IMG_SRC_REGEX.source, 'gi');
  while ((m = srcRegex.exec(html)) !== null) {
    if (m[2]) {
      const src = stripFragment(m[2]);
      allSrcs.push(src);
      srcTypes.set(src, 'img');
    }
  }
  const svgRegex = new RegExp(SVG_IMAGE_HREF_RE.source, 'gi');
  while ((m = svgRegex.exec(html)) !== null) {
    if (m[2]) {
      const src = stripFragment(m[2]);
      allSrcs.push(src);
      srcTypes.set(src, 'svg');
    }
  }

  if (allSrcs.length === 0) return html;
  if (!readerDoc.getImageData) return html;

  revokePreviousBlobUrls();
  const newBlobUrls: string[] = [];
  const blobUrlCache = new Map<string, string>();

  const srcsToResolve = [
    ...new Set(allSrcs.filter((s) => !s.startsWith('data:') && !s.startsWith('blob:'))),
  ];
  for (const src of srcsToResolve) {
    try {
      const result = await readerDoc.getImageData(src);
      if (result) {
        const buf = result.data.buffer as ArrayBuffer;
        const blob = new Blob(
          [buf.slice(result.data.byteOffset, result.data.byteOffset + result.data.byteLength)],
          { type: result.mimeType },
        );
        const blobUrl = URL.createObjectURL(blob);
        blobUrlCache.set(src, blobUrl);
        newBlobUrls.push(blobUrl);
      } else {
        blobUrlCache.set(src, '');
      }
    } catch {
      blobUrlCache.set(src, '');
    }
  }

  previousBlobUrls = newBlobUrls;
  let resultHtml = html;
  for (const [src, blobUrl] of blobUrlCache) {
    const safeSrc = escapeRegExp(src);
    if (!blobUrl) {
      resultHtml = resultHtml.replace(
        new RegExp(`(<img\\b[^>]*?src\\s*=\\s*["']${safeSrc}["'][^>]*?>)`, 'gi'),
        addFailedImgClass,
      );
      resultHtml = resultHtml.replace(
        new RegExp(`(<image\\b[^>]*?(?:xlink:)?href\\s*=\\s*["']${safeSrc}["'][^>]*?>)`, 'gi'),
        addFailedImgClass,
      );
      continue;
    }
    resultHtml = resultHtml.replace(
      new RegExp(`(<img\\b[^>]*?)src\\s*=\\s*["']${safeSrc}["']([^>]*?>)`, 'gi'),
      `$1src="${blobUrl}"$2`,
    );
    resultHtml = resultHtml.replace(
      new RegExp(`(<image\\b[^>]*?)(xlink:)?href\\s*=\\s*["']${safeSrc}["']([^>]*?>)`, 'gi'),
      (_match, pre, xlinkPrefix, post) => {
        return `${pre}${xlinkPrefix ? 'xlink:' : ''}href="${blobUrl}"${post}`;
      },
    );
  }
  return resultHtml;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function stripFragment(href: string): string {
  const i = href.indexOf('#');
  return i >= 0 ? href.substring(0, i) : href;
}

/* ==========================================================================
   Query params
   ========================================================================== */

interface QueryParams {
  readonly uri: string;
  readonly format: SupportedFormat;
}

function parseQueryParams(): QueryParams {
  const params = new URLSearchParams(window.location.search);
  const uri = params.get('uri');
  const format = params.get('format')?.toLowerCase();
  if (!uri) throw new ReaderError('Falta el parámetro "uri" en la URL');
  if (!format || !isSupportedFormat(format))
    throw new ReaderError(`Formato no soportado: "${format ?? 'desconocido'}"`);
  return { uri, format };
}

function isSupportedFormat(value: string): value is SupportedFormat {
  return (SUPPORTED_FORMATS as readonly string[]).includes(value);
}

class ReaderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReaderError';
  }
}

/* ==========================================================================
   UI State
   ========================================================================== */

type UIState =
  | { readonly type: 'loading' }
  | { readonly type: 'error'; readonly message: string }
  | { readonly type: 'content' };

function setUIState(state: UIState): void {
  const reader = document.getElementById('reader');
  const loading = document.getElementById('reader-loading');
  const error = document.getElementById('reader-error');
  const page = document.getElementById('page');
  const bar = document.getElementById('r-bar');
  const foot = document.getElementById('r-foot');

  // Show/hide the reader container (adds .open to slide it in)
  if (reader) {
    if (state.type === 'content') {
      reader.classList.add('open');
      reader.removeAttribute('aria-hidden');
    } else {
      reader.classList.remove('open');
      reader.setAttribute('aria-hidden', 'true');
    }
  }

  if (loading) loading.style.display = state.type === 'loading' ? 'flex' : 'none';
  if (error) error.style.display = state.type === 'error' ? 'flex' : 'none';
  if (page) page.style.display = state.type === 'content' ? 'block' : 'none';
  if (bar) bar.style.display = state.type === 'content' ? 'flex' : 'none';
  if (foot) foot.style.display = state.type === 'content' ? 'flex' : 'none';

  if (state.type === 'error') {
    const msg = document.getElementById('reader-error-message');
    if (msg) msg.textContent = state.message;
  }
}

/* ==========================================================================
   Renderizado de capítulo
   ========================================================================== */

async function renderChapter(
  readerDoc: ReaderDocument,
  preferences: ReaderPreferences,
  restoreRatio?: number,
): Promise<void> {
  const contentEl = document.getElementById('page');
  if (!contentEl) return;
  if (!readerDoc.getCurrentChapterContent)
    throw new ReaderError('El formato no soporta renderizado de contenido');

  const htmlContent = await readerDoc.getCurrentChapterContent();
  const resolvedHtml = await resolveImagesInHtml(readerDoc, htmlContent);
  contentEl.innerHTML = sanitizeHtml(resolvedHtml);
  clearNoteHighlights();

  if (readerDoc.applyPreferences) {
    const existingStyle = contentEl.querySelector('style');
    if (existingStyle) existingStyle.remove();
    const styleEl = document.createElement('style');
    const css = await readerDoc.applyPreferences(preferences);
    styleEl.textContent = css;
    // Append (no prepend) para que el tema del lector gane sobre los <style> del EPUB
    contentEl.append(styleEl);
  }

  await updateChapterInfo(readerDoc);

  const scroll = document.getElementById('r-scroll');
  if (scroll) {
    cancelScrollSettle();
    applyScrollRatio(scroll, restoreRatio);
    refreshProgressFromScroll();
    if (typeof restoreRatio === 'number') scheduleScrollSettle(scroll, restoreRatio);
  }
}

function applyScrollRatio(scroll: HTMLElement, ratio?: number): void {
  scroll.scrollTop =
    typeof ratio === 'number'
      ? scrollTopForRatio(ratio, scroll.scrollHeight, scroll.clientHeight)
      : 0;
}

/** Las imágenes del EPUB se decodifican tras el render y desplazan el texto: reaplicamos la
 *  posición restaurada cuando el layout asienta, salvo que el usuario ya se haya movido. */
function scheduleScrollSettle(scroll: HTMLElement, ratio: number): void {
  let interacted = false;
  const stopListening = (): void => {
    scroll.removeEventListener('wheel', markInteraction);
    scroll.removeEventListener('touchstart', markInteraction);
    window.removeEventListener('keydown', markKeyboardInteraction);
  };
  const markInteraction = (): void => {
    interacted = true;
    stopListening();
  };
  // El teclado no pasa por #r-scroll (no es focusable), así que se escucha en window.
  const markKeyboardInteraction = (event: KeyboardEvent): void => {
    if (SCROLL_KEYS.has(event.key)) markInteraction();
  };

  scroll.addEventListener('wheel', markInteraction, { passive: true });
  scroll.addEventListener('touchstart', markInteraction, { passive: true });
  window.addEventListener('keydown', markKeyboardInteraction);

  scrollSettleTimer = setTimeout(() => {
    scrollSettleTimer = null;
    stopListening();
    if (interacted) return;
    applyScrollRatio(scroll, ratio);
    refreshProgressFromScroll();
  }, SCROLL_SETTLE_MS);
}

function cancelScrollSettle(): void {
  if (scrollSettleTimer === null) return;
  clearTimeout(scrollSettleTimer);
  scrollSettleTimer = null;
}

async function updateChapterInfo(readerDoc: ReaderDocument): Promise<void> {
  const btnPrev = document.getElementById('prev-page') as HTMLButtonElement | null;
  const btnNext = document.getElementById('next-page') as HTMLButtonElement | null;

  const canNavigateByChapter = Boolean(
    readerDoc.getCurrentChapterIndex && readerDoc.getChapterCount,
  );
  if (!canNavigateByChapter) {
    paintProgressBar(0, 0);
    if (btnPrev) btnPrev.disabled = true;
    if (btnNext) btnNext.disabled = true;
    return;
  }

  const currentIndex = await readerDoc.getCurrentChapterIndex!();
  const totalChapters = await readerDoc.getChapterCount!();
  paintProgressBar(currentIndex, totalChapters);
  if (btnPrev) btnPrev.disabled = currentIndex <= 0;
  if (btnNext) btnNext.disabled = currentIndex >= totalChapters - 1;
}

async function refreshReaderStyle(
  readerDoc: ReaderDocument,
  preferences: ReaderPreferences,
): Promise<void> {
  const contentEl = document.getElementById('page');
  if (!contentEl || !readerDoc.applyPreferences) return;
  const existingStyle = contentEl.querySelector('style');
  if (existingStyle) existingStyle.remove();
  const styleEl = document.createElement('style');
  styleEl.textContent = await readerDoc.applyPreferences(preferences);
  contentEl.append(styleEl);
}

/* ==========================================================================
   Barra de progreso
   ========================================================================== */

let progressBar: ProgressBarController | null = null;

function readScrollRatio(): number {
  const scroll = document.getElementById('r-scroll');
  if (!scroll) return 0;
  return scrollRatio(scroll.scrollTop, scroll.scrollHeight, scroll.clientHeight);
}

function paintProgressBar(currentIndex: number, totalCount: number): void {
  progressBar?.setPosition(currentIndex, totalCount);
  progressBar?.paint();
}

function refreshProgressFromScroll(): void {
  progressBar?.notify();
}

function setupProgressBar(readerDoc: ReaderDocument, preferences: ReaderPreferences): void {
  const track = document.getElementById('track');
  const fill = document.getElementById('track-fill');
  const label = document.getElementById('pct');
  if (!track || !fill || !label) return;

  progressBar = createProgressBar({
    elements: { track, fill, label },
    getScrollRatio: readScrollRatio,
    onSeek: (idx) => {
      if (!readerDoc.goToChapter) return;
      void seekChapter(readerDoc, preferences, idx);
    },
  });

  const scroll = document.getElementById('r-scroll');
  if (!scroll) return;
  scroll.addEventListener(
    'scroll',
    () => {
      progressBar?.notify();
      scheduleLocatorRefresh();
    },
    { passive: true },
  );

  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(() => progressBar?.notify());
    observer.observe(scroll);
    const content = document.getElementById('page');
    if (content) observer.observe(content);
  }
}

async function seekChapter(
  readerDoc: ReaderDocument,
  preferences: ReaderPreferences,
  idx: number,
): Promise<void> {
  try {
    await readerDoc.goToChapter?.(idx);
    await renderChapter(readerDoc, preferences);
    await syncLocator();
    await updateTocCurrent(readerDoc);
  } catch (error) {
    if (error instanceof Error && error.name === 'EpubNavigationError') return;
    throw error;
  }
}

/* ==========================================================================
   Navegación
   ========================================================================== */

function setupNavigation(readerDoc: ReaderDocument, preferences: ReaderPreferences): void {
  const btnPrev = document.getElementById('prev-page');
  const btnNext = document.getElementById('next-page');
  if (btnPrev)
    btnPrev.addEventListener('click', () => navigateChapter(readerDoc, preferences, 'previous'));
  if (btnNext)
    btnNext.addEventListener('click', () => navigateChapter(readerDoc, preferences, 'next'));
}

async function syncLocator(): Promise<void> {
  if (!currentReaderDoc) return;
  const locator = await currentReaderDoc.getLocator();
  currentLocator = JSON.stringify(composeCurrentLocator(locator));
  renderNotesList(currentNotes);
  refreshNoteHighlights();
}

/** Añade la posición vertical al locator cuando el formato es reflowable. */
function composeCurrentLocator(locator: ReaderLocator): ReaderLocator {
  if (!currentReaderDoc?.capabilities.reflowable) return locator;
  return withScrollRatio(locator, readScrollRatio());
}

let locatorRefreshTimer: ReturnType<typeof setTimeout> | null = null;

/** Mantiene el locator al día mientras el usuario scrollea, para que el progreso
 *  guardado por el host incluya la posición exacta y no solo el capítulo. */
function scheduleLocatorRefresh(): void {
  if (locatorRefreshTimer !== null) return;
  locatorRefreshTimer = setTimeout(() => {
    locatorRefreshTimer = null;
    void refreshLocatorPosition();
  }, LOCATOR_REFRESH_MS);
}

async function refreshLocatorPosition(): Promise<void> {
  if (!currentReaderDoc?.capabilities.reflowable) return;
  currentLocator = JSON.stringify(composeCurrentLocator(await currentReaderDoc.getLocator()));
}

async function navigateChapter(
  readerDoc: ReaderDocument,
  preferences: ReaderPreferences,
  direction: 'next' | 'previous',
): Promise<void> {
  try {
    if (direction === 'next') await readerDoc.goNext();
    else await readerDoc.goPrevious();
    await renderChapter(readerDoc, preferences);
    await syncLocator();
    await updateTocCurrent(readerDoc);
  } catch (error) {
    if (error instanceof Error && error.name === 'EpubNavigationError') return;
    throw error;
  }
}

/* ==========================================================================
   Drawer system
   ========================================================================== */

let currentPanel: string | null = null;

function openDrawer(panelId: string, title: string, options?: { scrim?: boolean }): void {
  const scrim = document.getElementById('scrim');
  const drawer = document.getElementById('drawer');
  const drawerTitle = document.getElementById('drawer-title');
  if (!scrim || !drawer) return;

  if (drawerTitle) drawerTitle.textContent = title;
  currentPanel = panelId;

  document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
  const panel = document.getElementById(`panel-${panelId}`);
  if (panel) panel.classList.add('active');

  document.querySelectorAll('.r-btn[data-panel]').forEach((btn) => {
    btn.classList.toggle('on', (btn as HTMLElement).dataset.panel === panelId);
  });

  // El scrim bloquea el texto: los paneles auxiliares (notas) se abren sin él
  // para poder seguir seleccionando en la página.
  scrim.classList.toggle('show', options?.scrim !== false);
  drawer.classList.add('show');
}

function closeDrawer(): void {
  const scrim = document.getElementById('scrim');
  const drawer = document.getElementById('drawer');
  if (scrim) scrim.classList.remove('show');
  if (drawer) drawer.classList.remove('show');
  document.querySelectorAll('.r-btn[data-panel]').forEach((btn) => btn.classList.remove('on'));
  currentPanel = null;
}

function setupDrawer(): void {
  const scrim = document.getElementById('scrim');
  const drawerX = document.getElementById('drawer-x');
  if (scrim) scrim.addEventListener('click', closeDrawer);
  if (drawerX) drawerX.addEventListener('click', closeDrawer);

  document.querySelectorAll('.r-btn[data-panel]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const panelId = (btn as HTMLElement).dataset.panel;
      if (!panelId) return;
      if (currentPanel === panelId) {
        closeDrawer();
        return;
      }
      const titles: Record<string, string> = {
        info: 'Información',
        toc: 'Índice',
        search: 'Buscar',
        notes: 'Notas',
        settings: 'Ajustes de lectura',
      };
      openDrawer(panelId, titles[panelId] ?? panelId);
    });
  });
}

/* ==========================================================================
   Zen mode
   ========================================================================== */

function setupZen(): void {
  const zenBtn = document.getElementById('r-zen');
  const zenExit = document.getElementById('zen-exit');
  const reader = document.getElementById('reader');
  if (!reader) return;

  const toggleZen = () => reader.classList.toggle('zen');
  if (zenBtn) zenBtn.addEventListener('click', toggleZen);
  if (zenExit) zenExit.addEventListener('click', toggleZen);
}

/* ==========================================================================
   Settings: theme, font, size, line-height
   ========================================================================== */

function applySettingsToDom(): void {
  const reader = document.getElementById('reader');
  const page = document.getElementById('page');
  if (!reader || !page) return;

  const theme = webviewThemeFor(currentPreferences.theme);
  const font = webviewFontFor(currentPreferences.fontFamily);
  const sizePx = pixelSizeFor(currentPreferences.fontScale);

  reader.setAttribute('data-theme', theme);
  reader.setAttribute('data-font', font);
  page.style.setProperty('--read-size', `${sizePx}px`);
  page.style.setProperty('--read-lh', String(currentPreferences.lineHeight));

  document.querySelectorAll('.sw[data-t]').forEach((sw) => {
    sw.classList.toggle('sel', (sw as HTMLElement).dataset.t === theme);
  });

  document.querySelectorAll('#sw-font button[data-f]').forEach((btn) => {
    btn.classList.toggle('sel', (btn as HTMLElement).dataset.f === font);
  });

  const sizeVal = document.getElementById('size-val');
  if (sizeVal) sizeVal.textContent = `${sizePx} px`;

  const lhButton = lineHeightToButton(currentPreferences.lineHeight);
  document.querySelectorAll('#sw-lh button[data-lh]').forEach((btn) => {
    btn.classList.toggle('sel', (btn as HTMLElement).dataset.lh === lhButton);
  });
}

function sendPreferencesToHost(): void {
  console.log(PREFERENCES_SENTINEL + JSON.stringify(currentPreferences));
}

function setupSettings(): void {
  const sizeDown = document.getElementById('size-down');
  const sizeUp = document.getElementById('size-up');

  // Theme swatches
  document.querySelectorAll('.sw[data-t]').forEach((sw) => {
    sw.addEventListener('click', () => {
      const theme = themeFromWebview((sw as HTMLElement).dataset.t as WebviewTheme);
      currentPreferences = { ...currentPreferences, theme };
      applySettingsToDom();
      sendPreferencesToHost();
    });
  });

  // Font segmented
  document.querySelectorAll('#sw-font button[data-f]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const fontFamily = (btn as HTMLElement).dataset.f === 'serif' ? 'serif' : 'sans';
      currentPreferences = { ...currentPreferences, fontFamily };
      applySettingsToDom();
      if (currentReaderDoc) {
        void refreshReaderStyle(currentReaderDoc, currentPreferences);
      }
      sendPreferencesToHost();
    });
  });

  // Size stepper
  if (sizeDown) {
    sizeDown.addEventListener('click', () => {
      currentPreferences = {
        ...currentPreferences,
        fontScale: stepFontScale(currentPreferences.fontScale, -1),
      };
      applySettingsToDom();
      sendPreferencesToHost();
    });
  }
  if (sizeUp) {
    sizeUp.addEventListener('click', () => {
      currentPreferences = {
        ...currentPreferences,
        fontScale: stepFontScale(currentPreferences.fontScale, 1),
      };
      applySettingsToDom();
      sendPreferencesToHost();
    });
  }

  // Line height segmented
  document.querySelectorAll('#sw-lh button[data-lh]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const lineHeight = parseFloat((btn as HTMLElement).dataset.lh ?? '1.75');
      currentPreferences = { ...currentPreferences, lineHeight };
      applySettingsToDom();
      sendPreferencesToHost();
    });
  });

  applySettingsToDom();
}

/* ==========================================================================
   TOC rendering
   ========================================================================== */

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function renderTOC(readerDoc: ReaderDocument): Promise<void> {
  console.log(
    '[renderTOC] renderTOC() inició — doc:',
    (readerDoc as { constructor?: { name?: string } }).constructor?.name,
  );
  const tocPanel = document.getElementById('panel-toc');
  if (!tocPanel) {
    console.log('[renderTOC] panel-toc NO encontrado — abortando.');
    return;
  }

  // Check if the document supports TOC via capabilities or optional methods
  const doc = readerDoc as unknown as Record<string, unknown>;
  const getTocFn = (doc.getToc ?? doc.getTOC) as (() => Promise<TocTree>) | undefined;
  if (!getTocFn) {
    console.log('[renderTOC] getTocFn undefined — mostrando "No hay índice disponible."');
    tocPanel.innerHTML =
      '<p style="color:var(--chrome-fg-lo);font-size:14px">No hay índice disponible.</p>';
    return;
  }
  const getToc = (): Promise<TocTree> => getTocFn.call(doc);

  try {
    const toc = await getToc();
    // Diagnóstico: siempre visible en la terminal del main (reenvía el webview)
    console.log(
      `[renderTOC] getToc() → ${toc.length} entradas` +
        (toc.length > 0
          ? ` | primera: "${toc[0]?.title}"`
          : ` (epub sin nav/ncx → spine fallback)`),
    );
    if (!toc || toc.length === 0) {
      tocPanel.innerHTML =
        '<p style="color:var(--chrome-fg-lo);font-size:14px">No hay índice disponible.</p>';
      return;
    }

    let currentIndex = -1;
    const getCurrentIdxFn = doc.getCurrentChapterIndex as (() => Promise<number>) | undefined;
    const getCurrentIdx = getCurrentIdxFn
      ? (): Promise<number> => getCurrentIdxFn.call(doc)
      : undefined;
    if (getCurrentIdx) {
      try {
        currentIndex = await getCurrentIdx();
      } catch (error) {
        console.warn('[reader-entry] getCurrentChapterIndex falló:', error);
      }
    }

    const renderEntries = (entries: readonly TocNavEntry[], depth = 0): string => {
      if (depth > 48) return '';
      return entries
        .map((item: TocNavEntry, i: number) => {
          const isCurrent = item.chapterIndex !== undefined && item.chapterIndex === currentIndex;
          const pad = depth * 16;
          const safeTitle = escapeHtml(item.title ?? '');
          const hrefAttr = item.href != null ? ` data-href="${escapeHtml(String(item.href))}"` : '';
          const indexAttr =
            item.chapterIndex !== undefined ? ` data-index="${item.chapterIndex}"` : '';
          const childrenHtml =
            item.children && item.children.length > 0
              ? renderEntries(item.children, depth + 1)
              : '';
          return `<button class="toc-item${isCurrent ? ' current' : ''}" data-chapter="${i}"${indexAttr}${hrefAttr} style="padding-left:${pad}px">
              <span class="n">${i + 1}</span>
              <span class="t">${safeTitle}</span>
            </button>${childrenHtml}`;
        })
        .join('');
    };

    tocPanel.innerHTML = renderEntries(toc);

    tocPanel.querySelectorAll('.toc-item').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const el = btn as HTMLElement;
        try {
          const navigated = await navigateToTocEntry(readerDoc, el);
          if (!navigated) return;
          await renderChapter(readerDoc, currentPreferences);
          await syncLocator();
          await updateTocCurrent(readerDoc);
          closeDrawer();
        } catch (error) {
          console.error('[reader-entry] navegación por índice falló:', error);
          showToast('No se pudo abrir ese capítulo');
        }
      });
    });
  } catch (error) {
    console.error('[reader-entry] renderTOC falló:', error);
    const message = error instanceof Error ? error.message : String(error);
    tocPanel.innerHTML =
      `<p style="color:var(--chrome-fg-lo);font-size:14px">Error al cargar el índice.</p>` +
      `<p style="color:var(--chrome-fg-lo);font-size:12px;opacity:0.7">${escapeHtml(message)}</p>`;
  }
}

async function navigateToTocEntry(readerDoc: ReaderDocument, el: HTMLElement): Promise<boolean> {
  const doc = readerDoc as unknown as Record<string, unknown>;
  const href = el.getAttribute('data-href');
  const goToTocHref = doc.goToTocHref as ((h: string) => Promise<unknown>) | undefined;

  if (href && goToTocHref) {
    try {
      await goToTocHref.call(doc, href);
      return true;
    } catch (error) {
      console.warn('[reader-entry] goToTocHref falló, reintento por índice:', href, error);
    }
  }

  const rawIndex = el.getAttribute('data-index');
  const idx = rawIndex !== null ? Number(rawIndex) : Number(el.dataset.chapter ?? '0');
  const goToChapter = doc.goToChapter as ((i: number) => Promise<unknown>) | undefined;
  if (!goToChapter || !Number.isFinite(idx)) return false;

  await goToChapter.call(doc, idx);
  return true;
}

async function updateTocCurrent(readerDoc: ReaderDocument): Promise<void> {
  const tocPanel = document.getElementById('panel-toc');
  if (!tocPanel) return;
  const doc = readerDoc as unknown as Record<string, unknown>;
  const getCurrentIdx = doc.getCurrentChapterIndex as (() => Promise<number>) | undefined;
  if (!getCurrentIdx) return;
  try {
    const currentIndex = await getCurrentIdx.call(doc);
    tocPanel.querySelectorAll('.toc-item').forEach((el) => {
      const c = el.getAttribute('data-index');
      el.classList.toggle('current', c !== null && Number(c) === currentIndex);
    });
  } catch {
    // ignore
  }
}

/* ==========================================================================
   Toast
   ========================================================================== */

function showToast(message: string): void {
  const toast = document.getElementById('toast');
  const toastTx = document.getElementById('toast-tx');
  if (!toast || !toastTx) return;
  toastTx.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}

/* ==========================================================================
   Bookmark
   ========================================================================== */

function setupBookmark(): void {
  const markBtn = document.getElementById('r-mark');
  if (markBtn) {
    markBtn.addEventListener('click', () => {
      markBtn.classList.toggle('on');
      const isOn = markBtn.classList.contains('on');
      showToast(isOn ? 'Marcador añadido' : 'Marcador eliminado');
    });
  }
}

/* ==========================================================================
   Back button
   ========================================================================== */

const CLOSE_SENTINEL = '__clio_back__';

function setupBack(): void {
  const backBtn = document.getElementById('r-back');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      console.log(CLOSE_SENTINEL);
    });
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
   Entry point
   ========================================================================== */

let currentReaderDoc: ReaderDocument | null = null;
let currentPreferences: ReaderPreferences = DEFAULT_PREFERENCES;
let currentNotes: readonly ReaderNoteView[] = [];
let currentLocator: string = '';
let editingNoteId: string | null = null;
let activeNoteId: string | null = null;

interface ReaderNoteView {
  readonly id: string;
  readonly body: string;
  readonly createdAt: number;
  readonly locator: string;
  readonly selectedText?: string;
}

interface PendingNoteItem {
  readonly key: string;
  readonly body: string;
  readonly locator: string;
  readonly selectedText?: string;
}

interface PendingNoteUpdateItem {
  readonly key: string;
  readonly noteId: string;
  readonly body: string;
}

declare global {
  interface Window {
    __pendingNotes?: PendingNoteItem[];
    __pendingNoteUpdates?: PendingNoteUpdateItem[];
    __pendingNoteDelete?: string | null;
    __updateNotes?: (notes: readonly ReaderNoteView[]) => void;
    __noteSaved?: () => void;
    __noteError?: (message: string) => void;
    __goToChapter?: (idx: number, restoreRatio?: number, locatorJson?: string) => Promise<void>;
    __getCurrentLocator?: () => string | undefined;
    __updateRank?: (rank: number) => void;
  }
}

function renderInfoPanel(metadata: {
  title: string;
  author?: string;
  coverImage?: string;
  format: string;
  rank: number;
}): void {
  const panel = document.getElementById('panel-info');
  if (!panel) return;

  const rankValue = metadata.rank ?? 0;
  const gradId = `reader-half-star`;

  const authorLast = metadata.author ? (metadata.author.split(' ').pop() ?? '') : '';
  const glyphs = ['Η', 'Θ', 'Β', 'Α', 'C', '∞', 'H', '⁂', 'Μ', '❦', 'G', 'B', 'Σ', 'Ω', 'Δ', 'Φ'];
  let hash = 0;
  const idStr = metadata.title;
  for (let i = 0; i < idStr.length; i++) {
    hash = ((hash << 5) - hash + idStr.charCodeAt(i)) | 0;
  }
  const glyph = glyphs[Math.abs(hash) % glyphs.length];

  const palettes: [string, string][] = [
    ['#3a2e5c', '#6b4ea3'],
    ['#173a34', '#2f6d61'],
    ['#4a2b2b', '#8a3f3f'],
    ['#2c3a52', '#4a6a8a'],
    ['#453520', '#8a6a34'],
    ['#3a1f2e', '#7a3a55'],
  ];
  const palette = palettes[Math.abs(hash) % palettes.length]!;
  const pc1 = palette[0];
  const pc2 = palette[1];

  panel.innerHTML = `
    <div class="info-content">
      ${
        metadata.coverImage
          ? `<img src="${metadata.coverImage}" class="info-cover" alt="Portada" />`
          : `<div class="info-cover-placeholder" style="background:linear-gradient(150deg,${pc1},${pc2})">
            <div class="info-cover-author">${authorLast}</div>
            <div class="info-cover-title">${metadata.title}</div>
            <div class="info-cover-glyph">${glyph}</div>
          </div>`
      }
      <h3 class="info-title">${metadata.title}</h3>
      ${metadata.author ? `<p class="info-author">${metadata.author}</p>` : ''}
      <p class="info-format">Formato: ${metadata.format.toUpperCase()}</p>
      <div class="info-rating">
        <svg width="0" height="0" style="position:absolute">
          <defs>
            <linearGradient id="${gradId}">
              <stop offset="50%" stop-color="var(--gold)" />
              <stop offset="50%" stop-color="var(--line)" />
            </linearGradient>
          </defs>
        </svg>
        <div class="info-stars" role="radiogroup" aria-label="Rating del libro" data-rank="${rankValue}">
          ${[1, 2, 3, 4, 5]
            .map((s) => {
              const isHalf = rankValue >= s - 0.5 && rankValue < s;
              const isFull = rankValue >= s;
              const fillClass = isFull ? 'star-full' : isHalf ? 'star-half' : 'star-empty';
              return `<span class="star-btn ${fillClass}" data-star="${s}" role="radio" aria-checked="${isFull || isHalf}" aria-label="${s} estrella${s > 1 ? 's' : ''}">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="${isFull ? 'var(--gold)' : isHalf ? `url(#${gradId})` : 'var(--line)'}" stroke="none">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
            </span>`;
            })
            .join('')}
        </div>
        <span class="info-rank-value">${rankValue > 0 ? rankValue : ''}</span>
      </div>
    </div>
  `;

  const starsContainer = panel.querySelector('.info-stars');
  if (!starsContainer) return;

  const sendRankToHost = (newRank: number): void => {
    console.log('__clio_rank__' + JSON.stringify({ rank: newRank }));
  };

  const paintStars = (displayRank: number): void => {
    starsContainer.querySelectorAll('.star-btn').forEach((btn) => {
      const s = Number((btn as HTMLElement).dataset.star);
      const isHalf = displayRank >= s - 0.5 && displayRank < s;
      const isFull = displayRank >= s;
      btn.classList.toggle('star-full', isFull);
      btn.classList.toggle('star-half', isHalf && !isFull);
      btn.classList.toggle('star-empty', !isFull && !isHalf);
      const svg = btn.querySelector('svg');
      if (svg) {
        svg.setAttribute(
          'fill',
          isFull ? 'var(--gold)' : isHalf ? `url(#${gradId})` : 'var(--line)',
        );
      }
      btn.setAttribute('aria-checked', String(isFull || isHalf));
    });
    const rankValueEl = panel.querySelector('.info-rank-value');
    if (rankValueEl) rankValueEl.textContent = displayRank > 0 ? String(displayRank) : '';
  };

  const commitRank = (newRank: number): void => {
    starsContainer.setAttribute('data-rank', String(newRank));
    paintStars(newRank);
    sendRankToHost(newRank);
  };

  starsContainer.addEventListener('mousemove', (e: Event) => {
    const me = e as MouseEvent;
    const target = (me.target as HTMLElement).closest('.star-btn');
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const x = me.clientX - rect.left;
    const starIndex = Number((target as HTMLElement).dataset.star);
    const hoverRank = x < rect.width / 2 ? starIndex - 0.5 : starIndex;
    paintStars(hoverRank);
  });

  starsContainer.addEventListener('mouseleave', () => {
    const current = Number(starsContainer.getAttribute('data-rank')) || 0;
    paintStars(current);
  });

  starsContainer.addEventListener('click', (e: Event) => {
    const me = e as MouseEvent;
    const target = (me.target as HTMLElement).closest('.star-btn');
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const x = me.clientX - rect.left;
    const starIndex = Number((target as HTMLElement).dataset.star);
    const clickedRank = x < rect.width / 2 ? starIndex - 0.5 : starIndex;
    const currentRank = Number(starsContainer.getAttribute('data-rank')) || 0;
    const newRank = clickedRank === currentRank ? 0 : clickedRank;
    commitRank(newRank);
  });
}

function renderNotesList(notes: readonly ReaderNoteView[]): void {
  const list = document.getElementById('notes-list');
  if (!list) return;

  // El locator lleva la posición vertical, así que comparamos por documento (capítulo).
  const activeLocator = parseLocator(currentLocator);
  const pageNotes = activeLocator
    ? notes.filter((n) => {
        const noteLocator = parseLocator(n.locator);
        return noteLocator !== null && isSameDocumentPosition(noteLocator, activeLocator);
      })
    : [];

  if (pageNotes.length === 0) {
    list.innerHTML = '<p class="notes-empty">No hay notas en esta página.</p>';
    return;
  }

  list.innerHTML = pageNotes
    .map(
      (n) => `
    <div class="note${n.id === activeNoteId ? ' active' : ''}" data-note-id="${n.id}">
      ${n.selectedText ? `<div class="nquote">“${escapeHtml(n.selectedText)}”</div>` : ''}
      <div class="ntx">${escapeHtml(n.body)}</div>
      <div class="note-actions">
        <button class="note-edit" data-note-id="${n.id}" data-note-body="${escapeHtml(n.body)}" title="Editar nota">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="note-delete" data-note-id="${n.id}" title="Eliminar nota">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
    </div>
  `,
    )
    .join('');

  list.querySelectorAll('.note').forEach((card) => {
    card.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (target.closest('.note-actions')) return;
      const noteId = (card as HTMLElement).dataset.noteId;
      if (noteId) void jumpToNote(noteId);
    });
  });

  list.querySelectorAll('.note-delete').forEach((btn) => {
    btn.addEventListener('click', () => {
      const noteId = (btn as HTMLElement).dataset.noteId;
      if (noteId) {
        window.__pendingNoteDelete = noteId;
      }
    });
  });

  list.querySelectorAll('.note-edit').forEach((btn) => {
    btn.addEventListener('click', () => {
      const noteId = (btn as HTMLElement).dataset.noteId;
      const noteBody = (btn as HTMLElement).dataset.noteBody ?? '';
      if (noteId) {
        editingNoteId = noteId;
        resetPendingSelection();
        const input = document.getElementById('note-input') as HTMLTextAreaElement | null;
        const saveBtn = document.getElementById('note-save');
        if (input) input.value = noteBody;
        if (saveBtn) saveBtn.textContent = 'Actualizar';
        void jumpToNote(noteId);
      }
    });
  });
}

/* --- Anclaje de notas al texto seleccionado --- */

let pendingSelection: { quote: string; anchor: TextAnchor; locator: ReaderLocator } | null = null;
let ignoreSelectionEvents = false;
let pendingSelectionSeq = 0;
let selectionGate: SelectionGate | null = null;

/** Resuelve el rango del capítulo que cubre una nota y lo trae a la vista. */
function scrollToAnchorRange(range: Range, recovered: boolean): void {
  const rect = range.getBoundingClientRect();
  const scroll = document.getElementById('r-scroll');
  if (scroll) {
    scroll.scrollTop += rect.top - scroll.clientHeight / 3;
  }
  paintActiveNoteHighlight(range);
  showToast(recovered ? 'Nota reubicada: el texto se movió' : 'Nota localizada');
}

/** Lleva la vista al texto anclado en el locator, si el capítulo ya está cargado. */
function revealLocator(locator: ReaderLocator, selectedText?: string): void {
  const content = document.getElementById('page');
  if (!content || !hasTextAnchor(locator)) return;

  const found = resolveAnchorRange(indexChapterText(content), locator, selectedText);
  if (!found) {
    paintActiveNoteHighlight(null);
    showToast('No se encontró el texto de la nota');
    return;
  }
  scrollToAnchorRange(found.range, found.recovered);
}

async function jumpToNote(noteId: string): Promise<void> {
  const note = currentNotes.find((n) => n.id === noteId);
  const locator = note ? parseLocator(note.locator) : null;
  if (!note || !locator || !currentReaderDoc) return;

  activeNoteId = noteId;
  const current = parseLocator(currentLocator);
  if (current && isSameDocumentPosition(current, locator)) {
    revealLocator(locator, note.selectedText);
    renderNotesList(currentNotes);
    return;
  }

  const order = 'positionOrder' in locator ? locator.positionOrder : undefined;
  if (typeof order !== 'number' || !currentReaderDoc.goToChapter) {
    showToast('La nota está en otro capítulo no disponible');
    return;
  }

  try {
    await currentReaderDoc.goToChapter(order);
    await renderChapter(currentReaderDoc, currentPreferences);
    await syncLocator();
    revealLocator(locator, note.selectedText);
    renderNotesList(currentNotes);
  } catch (error) {
    if (error instanceof Error && error.name === 'EpubNavigationError') return;
    throw error;
  }
}

/** Resalta en el capítulo todas las notas ancladas a texto de esta página. */
function refreshNoteHighlights(): void {
  const content = document.getElementById('page');
  if (!content) return;

  const active = parseLocator(currentLocator);
  if (!active) {
    paintNoteHighlights([]);
    return;
  }

  const index = indexChapterText(content);
  const ranges: Range[] = [];
  for (const note of currentNotes) {
    const locator = parseLocator(note.locator);
    if (!locator || !isSameDocumentPosition(locator, active)) continue;
    const found = resolveAnchorRange(index, locator, note.selectedText);
    if (found) ranges.push(found.range);
  }
  paintNoteHighlights(ranges);
}

function setupNoteSelection(): void {
  const content = document.getElementById('page');
  if (!content) return;

  // El panel de notas espera a que el gesto termine: reaccionar a media
  // selección la corta y no permite seleccionar un párrafo.
  const gate = createSelectionGate(SELECTION_SETTLE_MS, () => applyPendingSelection(content));

  window.addEventListener('pointerdown', () => gate.pointerDown());
  window.addEventListener('pointerup', () => gate.pointerUp());
  window.addEventListener('pointercancel', () => gate.pointerCancel());

  document.addEventListener('selectionchange', () => {
    if (ignoreSelectionEvents) return;
    gate.request();
  });

  selectionGate = gate;
}

function applyPendingSelection(content: HTMLElement): void {
  const selection = captureSelection(content);
  if (!selection) return;

  const seq = ++pendingSelectionSeq;
  void currentReaderDoc?.getLocator().then((locator) => {
    if (seq !== pendingSelectionSeq) return;
    if (currentPanel === 'notes' && pendingSelection?.quote === selection.quote) return;
    pendingSelection = {
      quote: selection.quote,
      anchor: selection.anchor,
      locator: withTextAnchor(locator, selection.anchor),
    };
    editingNoteId = null;
    const saveBtn = document.getElementById('note-save');
    if (saveBtn) saveBtn.textContent = 'Guardar nota';
    renderSelectionPreview();
    // Sin scrim: el texto sigue siendo seleccionable con el panel abierto.
    openDrawer('notes', 'Notas', { scrim: false });
  });
}

function renderSelectionPreview(): void {
  const preview = document.getElementById('note-quote');
  if (!preview) return;

  if (!pendingSelection) {
    preview.classList.remove('show');
    preview.innerHTML = '';
    return;
  }

  preview.innerHTML = `
    <span class="nquote-text">“${escapeHtml(pendingSelection.quote)}”</span>
    <button class="nquote-clear" id="note-quote-clear" title="Quitar texto seleccionado">×</button>
  `;
  preview.classList.add('show');

  document.getElementById('note-quote-clear')?.addEventListener('click', () => {
    clearSelection();
  });
}

function resetPendingSelection(): void {
  pendingSelection = null;
  renderSelectionPreview();
}

function clearSelection(): void {
  pendingSelectionSeq++;
  selectionGate?.cancel();
  resetPendingSelection();
  ignoreSelectionEvents = true;
  window.getSelection()?.removeAllRanges();
  setTimeout(() => {
    ignoreSelectionEvents = false;
  }, 0);
  renderNotesList(currentNotes);
  refreshNoteHighlights();
  paintActiveNoteHighlight(null);
  activeNoteId = null;
}

function enqueueNote(payload: { body: string; locator: string; selectedText?: string }): void {
  const queue = window.__pendingNotes ?? [];
  if (!window.__pendingNotes) window.__pendingNotes = queue;
  queue.push({
    key: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    body: payload.body,
    locator: payload.locator,
    ...(payload.selectedText !== undefined ? { selectedText: payload.selectedText } : {}),
  });
}

function enqueueNoteUpdate(payload: { noteId: string; body: string }): void {
  const queue = window.__pendingNoteUpdates ?? [];
  if (!window.__pendingNoteUpdates) window.__pendingNoteUpdates = queue;
  queue.push({
    key: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    noteId: payload.noteId,
    body: payload.body,
  });
}

function setupNotes(): void {
  const saveBtn = document.getElementById('note-save');
  const input = document.getElementById('note-input') as HTMLTextAreaElement | null;

  if (saveBtn && input) {
    saveBtn.addEventListener('click', () => {
      const body = input.value.trim();
      if (!body) return;
      if (editingNoteId) {
        enqueueNoteUpdate({ noteId: editingNoteId, body });
        editingNoteId = null;
        saveBtn.textContent = 'Guardar nota';
        showToast('Actualización en cola');
      } else if (pendingSelection) {
        enqueueNote({
          body,
          locator: JSON.stringify(pendingSelection.locator),
          selectedText: pendingSelection.quote,
        });
        showToast('Nota anclada al texto en cola');
      } else {
        enqueueNote({ body, locator: currentLocator });
        showToast('Nota en cola');
      }
      input.value = '';
      clearSelection();
    });

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        saveBtn.click();
      }
    });
  }

  renderSelectionPreview();
  renderNotesList(currentNotes);
  refreshNoteHighlights();
}

async function main(): Promise<void> {
  setUIState({ type: 'loading' });

  try {
    const { uri, format } = parseQueryParams();

    (window as unknown as Record<string, unknown>).__initFromHost = async (data: {
      preferences: ReaderPreferences;
      fileDataB64: string;
      metadata: {
        bookId: string;
        title: string;
        author?: string;
        coverImage?: string;
        format: string;
        rank: number;
      };
      notes: readonly ReaderNoteView[];
    }) => {
      try {
        const binary = atob(data.fileDataB64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }

        currentPreferences = data.preferences;
        currentNotes = data.notes ?? [];
        currentReaderDoc = await loadDocument(uri, format, bytes);

        // Populate toolbar with real metadata
        const titleEl = document.getElementById('r-title');
        const authorEl = document.getElementById('r-author');
        if (titleEl && titleEl.childNodes[0]) {
          titleEl.childNodes[0].textContent = data.metadata.title;
        }
        if (authorEl) authorEl.textContent = data.metadata.author ?? '';

        setUIState({ type: 'content' });
        setupNavigation(currentReaderDoc, currentPreferences);
        setupProgressBar(currentReaderDoc, currentPreferences);
        await renderChapter(currentReaderDoc, currentPreferences);
        await syncLocator();
        setupDrawer();
        setupZen();
        setupSettings();
        setupBookmark();
        setupBack();
        await renderTOC(currentReaderDoc);
        renderInfoPanel(data.metadata);
        setupNoteSelection();
        setupNotes();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Error al abrir el libro';
        setUIState({ type: 'error', message });
      }
    };

    /* --- Palette injection from host --- */
    (window as unknown as Record<string, unknown>).__applyPalette = (cssVars: string) => {
      let style = document.getElementById('palette-injected') as HTMLStyleElement | null;
      if (!style) {
        style = document.createElement('style');
        style.id = 'palette-injected';
        document.head.appendChild(style);
      }
      style.textContent = `:root { ${cssVars} }`;
    };

    /* --- Notes update from host --- */
    window.__updateNotes = (notes: readonly ReaderNoteView[]) => {
      currentNotes = notes;
      renderNotesList(currentNotes);
      refreshNoteHighlights();
    };

    /* --- Rank update from host --- */
    window.__updateRank = (newRank: number) => {
      const panel = document.getElementById('panel-info');
      if (!panel) return;
      const starsContainer = panel.querySelector('.info-stars');
      if (!starsContainer) return;
      starsContainer.setAttribute('data-rank', String(newRank));
      const gradId = 'reader-half-star';
      starsContainer.querySelectorAll('.star-btn').forEach((btn) => {
        const s = Number((btn as HTMLElement).dataset.star);
        const isHalf = newRank >= s - 0.5 && newRank < s;
        const isFull = newRank >= s;
        btn.classList.toggle('star-full', isFull);
        btn.classList.toggle('star-half', isHalf && !isFull);
        btn.classList.toggle('star-empty', !isFull && !isHalf);
        const svg = btn.querySelector('svg');
        if (svg) {
          svg.setAttribute(
            'fill',
            isFull ? 'var(--gold)' : isHalf ? `url(#${gradId})` : 'var(--line)',
          );
        }
        btn.setAttribute('aria-checked', String(isFull || isHalf));
      });
      const rankValueEl = panel.querySelector('.info-rank-value');
      if (rankValueEl) rankValueEl.textContent = newRank > 0 ? String(newRank) : '';
    };

    /* --- Notes save/error feedback from host --- */
    window.__noteSaved = () => {
      showToast('Nota guardada');
    };
    window.__noteError = (message: string) => {
      showToast(message);
    };

    /* --- Go to chapter by index + position within it (for initial locator from host) --- */
    window.__goToChapter = async (idx: number, restoreRatio?: number, locatorJson?: string) => {
      if (!currentReaderDoc) return;
      await currentReaderDoc.goToChapter?.(idx);
      await renderChapter(currentReaderDoc, currentPreferences, restoreRatio);
      await syncLocator();

      const target = parseLocator(locatorJson);
      if (target) revealLocator(target);
    };

    /* --- Get current locator (for host progress sync) --- */
    window.__getCurrentLocator = (): string | undefined => {
      return currentLocator || undefined;
    };

    const retryBtn = document.getElementById('reader-error-retry');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        currentReaderDoc = null;
        main();
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido al abrir el libro';
    setUIState({ type: 'error', message });
  }
}

main();
