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
import { ReaderFactory, hasTextAnchor, withTextAnchor } from '@clio-reader/reader-core';
import {
  DEFAULT_READER_MARGIN,
  type ReaderPreferences,
  type ReaderLocator,
  type TextAnchor,
} from '@clio-reader/domain';
import { highlightRegistryName } from '@clio-reader/annotations';
import { EpubReaderAdapter } from '@clio-reader/reader-epub';
import { PdfReaderAdapter } from '@clio-reader/reader-pdf';
import { CbzReaderAdapter } from '@clio-reader/reader-cbz';
import { MarkdownReaderAdapter } from '@clio-reader/reader-md';
import {
  PREFERENCES_SENTINEL,
  lineHeightToButton,
  marginToPx,
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
  applyStaticTranslations,
  coerceLocale,
  detectLocale,
  setLocale,
  t,
  tp,
} from '@clio-reader/i18n';
import {
  isSameDocumentPosition,
  parseLocator,
  withScrollRatio,
} from './components/reader-progress';
import type { WebviewTheme } from './reader-prefs';
import {
  clearHighlightRanges,
  clearNoteHighlights,
  captureSelection,
  indexChapterText,
  paintActiveNoteHighlight,
  paintHighlightRanges,
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
  margin: DEFAULT_READER_MARGIN,
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

interface HostParams {
  readonly uri?: string;
  readonly format?: string;
}

function readHostParams(): HostParams {
  const hostParams = (window as unknown as { __clioHostParams?: HostParams }).__clioHostParams;
  return hostParams ?? {};
}

function parseQueryParams(): QueryParams {
  const params = new URLSearchParams(window.location.search);
  const hostParams = readHostParams();
  const uri = params.get('uri') ?? hostParams.uri;
  const format = (params.get('format') ?? hostParams.format)?.toLowerCase();
  if (!uri) throw new ReaderError(t('reader.error.missingUri'));
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
    if (state.type === 'content' || state.type === 'error') {
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
  clearNoteHighlights();
  clearHighlightRanges();

  if (!readerDoc.getCurrentChapterContent) {
    await renderFixedLayoutPage(readerDoc, contentEl);
    return;
  }

  const htmlContent = await readerDoc.getCurrentChapterContent();
  const resolvedHtml = await resolveImagesInHtml(readerDoc, htmlContent);
  contentEl.innerHTML = sanitizeHtml(resolvedHtml);

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

let fixedPageBlobUrls: string[] = [];

function revokeFixedPageBlobUrls(): void {
  for (const url of fixedPageBlobUrls) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  }
  fixedPageBlobUrls = [];
}

/** Renderiza formatos de página fija (PDF en canvas, CBZ como imagen). */
async function renderFixedLayoutPage(
  readerDoc: ReaderDocument,
  contentEl: HTMLElement,
): Promise<void> {
  const doc = readerDoc as unknown as Record<string, unknown>;
  const renderPage = doc.renderPage as
    ((canvas: HTMLCanvasElement) => Promise<unknown>) | undefined;
  const getCurrentImage = doc.getCurrentImage as (() => Promise<Uint8Array>) | undefined;
  const getImageMimeType = doc.getImageMimeType as (() => Promise<string>) | undefined;

  const scroll = document.getElementById('r-scroll');
  if (scroll) {
    cancelScrollSettle();
    scroll.scrollTop = 0;
  }

  if (typeof renderPage === 'function') {
    revokeFixedPageBlobUrls();
    contentEl.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.className = 'reader-fixed-canvas';
    contentEl.append(canvas);
    await renderPage.call(doc, canvas);
  } else if (typeof getCurrentImage === 'function' && typeof getImageMimeType === 'function') {
    revokeFixedPageBlobUrls();
    contentEl.innerHTML = '';
    const [bytes, mimeType] = await Promise.all([
      getCurrentImage.call(doc),
      getImageMimeType.call(doc),
    ]);
    const blob = new Blob([bytes.slice()], { type: mimeType });
    const blobUrl = URL.createObjectURL(blob);
    fixedPageBlobUrls.push(blobUrl);
    const img = document.createElement('img');
    img.className = 'reader-fixed-image';
    img.alt = t('reader.pageAlt');
    img.src = blobUrl;
    contentEl.append(img);
  } else {
    throw new ReaderError(t('reader.error.noRender'));
  }

  await updateChapterInfo(readerDoc);
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

  if (readerDoc.getCurrentPageIndex && readerDoc.getTotalPages) {
    const currentIndex = await readerDoc.getCurrentPageIndex!();
    const totalPages = await readerDoc.getTotalPages!();
    paintProgressBar(currentIndex, totalPages);
    if (btnPrev) btnPrev.disabled = currentIndex <= 0;
    if (btnNext) btnNext.disabled = currentIndex >= totalPages - 1;
    return;
  }

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
  if (!currentReaderDoc?.capabilities.reflowable) return 0;
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

  const fixedLayout = !readerDoc.capabilities.reflowable;
  progressBar = createProgressBar({
    elements: { track, fill, label },
    getScrollRatio: readScrollRatio,
    formatLabel: (positionIndex: number, positionCount: number, percent: number): string => {
      const rounded = Math.round(percent);
      if (positionCount <= 0) return t('reader.progress.percentOnly', { percent: rounded });
      const current = positionIndex + 1;
      return fixedLayout
        ? t('reader.progress.pages', { current, total: positionCount, percent: rounded })
        : t('reader.progress.chapter', { current, total: positionCount, percent: rounded });
    },
    onSeek: (idx) => {
      if (readerDoc.goToChapter) {
        void seekChapter(readerDoc, preferences, idx);
        return;
      }
      const goToPage = (readerDoc as unknown as Record<string, unknown>).goToPage as
        ((i: number) => Promise<ReaderLocator>) | undefined;
      if (goToPage) {
        void seekPage(readerDoc, preferences, idx);
      }
    },
  });

  const scroll = document.getElementById('r-scroll');
  if (!scroll) return;
  scroll.addEventListener(
    'scroll',
    () => {
      progressBar?.notify();
      scheduleLocatorRefresh();
      hideSelectionWidget();
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

async function seekPage(
  readerDoc: ReaderDocument,
  preferences: ReaderPreferences,
  pageIndex: number,
): Promise<void> {
  const goToPage = (readerDoc as unknown as Record<string, unknown>).goToPage as
    ((i: number) => Promise<ReaderLocator>) | undefined;
  if (!goToPage) return;
  await goToPage.call(readerDoc, pageIndex);
  await renderChapter(readerDoc, preferences);
  await syncLocator();
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
  refreshHighlightHighlights();
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
    if (error instanceof Error && error.name === 'PdfPageOutOfBoundsError') return;
    if (error instanceof Error && error.name === 'CbzPageOutOfBoundsError') return;
    throw error;
  }
}

/* ==========================================================================
   Navegación por teclado
   ========================================================================== */

const KEY_SCROLL_RATIO = 0.9;
let keyboardNavBusy = false;

function setupKeyboardNavigation(): void {
  window.removeEventListener('keydown', handleKeyboardNavigation);
  window.addEventListener('keydown', handleKeyboardNavigation);
}

type KeyboardDirection = 'up' | 'down' | 'left' | 'right';

function keyboardDirectionForKey(key: string): KeyboardDirection | null {
  switch (key) {
    case 'ArrowUp':
      return 'up';
    case 'ArrowDown':
      return 'down';
    case 'ArrowLeft':
      return 'left';
    case 'ArrowRight':
      return 'right';
    default:
      return null;
  }
}

function handleKeyboardNavigation(event: KeyboardEvent): void {
  if (event.defaultPrevented) return;
  if (event.ctrlKey || event.metaKey || event.altKey) return;

  const readerDoc = currentReaderDoc;
  if (!readerDoc || keyboardNavBusy) return;

  const target = event.target;
  if (
    target instanceof HTMLElement &&
    target.closest('input, textarea, select, [contenteditable="true"]')
  ) {
    return;
  }

  const direction = keyboardDirectionForKey(event.key);
  if (!direction) return;

  event.preventDefault();

  if (direction === 'up' || direction === 'down') {
    const forward = direction === 'down';
    if (scrollWithinChapter(forward ? 1 : -1) || readerDoc.capabilities.reflowable) return;
    void runKeyboardNavigation(readerDoc, forward ? 'next' : 'previous');
    return;
  }

  const rtl = currentPreferences.readingDirection === 'rtl';
  const forward = direction === 'right' ? !rtl : rtl;
  void runKeyboardNavigation(readerDoc, forward ? 'next' : 'previous');
}

function scrollWithinChapter(delta: 1 | -1): boolean {
  const scroll = document.getElementById('r-scroll');
  if (!scroll) return false;
  const maxScroll = scroll.scrollHeight - scroll.clientHeight;
  if (maxScroll <= 0) return false;
  const step = Math.max(Math.round(scroll.clientHeight * KEY_SCROLL_RATIO), 1);
  const nextTop = Math.min(Math.max(scroll.scrollTop + delta * step, 0), maxScroll);
  if (nextTop === scroll.scrollTop) return false;
  scroll.scrollTop = nextTop;
  return true;
}

async function runKeyboardNavigation(
  readerDoc: ReaderDocument,
  direction: 'next' | 'previous',
): Promise<void> {
  keyboardNavBusy = true;
  try {
    await navigateChapter(readerDoc, currentPreferences, direction);
  } finally {
    keyboardNavBusy = false;
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
  hideSelectionWidget();

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
        info: t('reader.panel.info'),
        toc: t('reader.panel.toc'),
        search: t('reader.panel.search'),
        notes: t('reader.panel.notes'),
        settings: t('reader.panel.settings'),
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
  const marginPx = marginToPx(currentPreferences.margin);

  reader.setAttribute('data-theme', theme);
  reader.setAttribute('data-font', font);
  page.style.setProperty('--read-size', `${sizePx}px`);
  page.style.setProperty('--read-lh', String(currentPreferences.lineHeight));
  page.style.setProperty('--read-margin', `${marginPx}px`);

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

  const marginInput = document.getElementById('margin-range') as HTMLInputElement | null;
  if (marginInput) {
    const value = String(marginPx);
    if (marginInput.value !== value) marginInput.value = value;
  }

  const marginVal = document.getElementById('margin-val');
  if (marginVal) marginVal.textContent = `${marginPx} px`;
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

  // Margin slider
  const marginInput = document.getElementById('margin-range') as HTMLInputElement | null;
  if (marginInput) {
    const applyMargin = (persist: boolean) => {
      const margin = marginToPx(Number(marginInput.value));
      currentPreferences = { ...currentPreferences, margin };
      applySettingsToDom();
      if (currentReaderDoc) {
        void refreshReaderStyle(currentReaderDoc, currentPreferences);
      }
      if (persist) sendPreferencesToHost();
    };

    marginInput.addEventListener('input', () => applyMargin(false));
    marginInput.addEventListener('change', () => applyMargin(true));
  }

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
    tocPanel.innerHTML = `<p style="color:var(--chrome-fg-lo);font-size:14px">${t('reader.toc.empty')}</p>`;
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
      tocPanel.innerHTML = `<p style="color:var(--chrome-fg-lo);font-size:14px">${t('reader.toc.empty')}</p>`;
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
          showToast(t('reader.toc.openFailed'));
        }
      });
    });
  } catch (error) {
    console.error('[reader-entry] renderTOC falló:', error);
    const message = error instanceof Error ? error.message : String(error);
    tocPanel.innerHTML =
      `<p style="color:var(--chrome-fg-lo);font-size:14px">${t('reader.toc.loadError')}</p>` +
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
      showToast(isOn ? t('reader.bookmark.added') : t('reader.bookmark.removed'));
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

let readerAdapterFactory: ReaderFactory | null = null;

function getReaderAdapterFactory(): ReaderFactory {
  if (readerAdapterFactory) return readerAdapterFactory;
  const factory = new ReaderFactory();
  factory.register(new EpubReaderAdapter());
  factory.register(new PdfReaderAdapter());
  factory.register(new CbzReaderAdapter());
  factory.register(new MarkdownReaderAdapter());
  readerAdapterFactory = factory;
  return factory;
}

async function loadDocument(
  uri: string,
  format: SupportedFormat,
  preloadedData?: Uint8Array,
): Promise<ReaderDocument> {
  const doc = getReaderAdapterFactory().create({ uri, name: '' }, format);
  await doc.open(preloadedData);
  return doc;
}

/* ==========================================================================
   Entry point
   ========================================================================== */

let currentReaderDoc: ReaderDocument | null = null;
let currentPreferences: ReaderPreferences = DEFAULT_PREFERENCES;
let currentNotes: readonly ReaderNoteView[] = [];
let currentHighlights: readonly ReaderHighlightView[] = [];
let currentLocator: string = '';
let editingNoteId: string | null = null;
let activeNoteId: string | null = null;
let lastInitData: HostInitData | null = null;

interface HostInitData {
  readonly locale?: string;
  readonly preferences: ReaderPreferences;
  readonly fileDataB64: string;
  readonly metadata: {
    readonly bookId: string;
    readonly title: string;
    readonly author?: string;
    readonly coverImage?: string;
    readonly format: string;
    readonly rank: number;
  };
  readonly notes: readonly ReaderNoteView[];
  readonly highlights: readonly ReaderHighlightView[];
}

interface ReaderNoteView {
  readonly id: string;
  readonly body: string;
  readonly createdAt: number;
  readonly locator: string;
  readonly selectedText?: string;
}

interface ReaderHighlightView {
  readonly id: string;
  readonly color: string;
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

interface PendingHighlightItem {
  readonly key: string;
  readonly color: string;
  readonly locator: string;
  readonly selectedText?: string;
}

declare global {
  interface Window {
    __pendingNotes?: PendingNoteItem[];
    __pendingNoteUpdates?: PendingNoteUpdateItem[];
    __pendingNoteDelete?: string | null;
    __pendingHighlights?: PendingHighlightItem[];
    __pendingHighlightDeletes?: string[];
    __updateNotes?: (notes: readonly ReaderNoteView[]) => void;
    __updateHighlights?: (highlights: readonly ReaderHighlightView[]) => void;
    __noteSaved?: () => void;
    __noteError?: (message: string) => void;
    __highlightSaved?: () => void;
    __highlightError?: (message: string) => void;
    __goToChapter?: (idx: number, restoreRatio?: number, locatorJson?: string) => Promise<void>;
    __goToPage?: (page: number) => Promise<void>;
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
          ? `<img src="${metadata.coverImage}" class="info-cover" alt="${t('reader.info.cover')}" />`
          : `<div class="info-cover-placeholder" style="background:linear-gradient(150deg,${pc1},${pc2})">
            <div class="info-cover-author">${authorLast}</div>
            <div class="info-cover-title">${metadata.title}</div>
            <div class="info-cover-glyph">${glyph}</div>
          </div>`
      }
      <h3 class="info-title">${metadata.title}</h3>
      ${metadata.author ? `<p class="info-author">${metadata.author}</p>` : ''}
      <p class="info-format">${t('reader.info.format', { format: metadata.format.toUpperCase() })}</p>
      <div class="info-rating">
        <svg width="0" height="0" style="position:absolute">
          <defs>
            <linearGradient id="${gradId}">
              <stop offset="50%" stop-color="var(--gold)" />
              <stop offset="50%" stop-color="var(--line)" />
            </linearGradient>
          </defs>
        </svg>
        <div class="info-stars" role="radiogroup" aria-label="${t('reader.info.ratingAria')}" data-rank="${rankValue}">
          ${[1, 2, 3, 4, 5]
            .map((s) => {
              const isHalf = rankValue >= s - 0.5 && rankValue < s;
              const isFull = rankValue >= s;
              const fillClass = isFull ? 'star-full' : isHalf ? 'star-half' : 'star-empty';
              return `<span class="star-btn ${fillClass}" data-star="${s}" role="radio" aria-checked="${isFull || isHalf}" aria-label="${tp('reader.info.star', s, { count: s })}">
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

type NotesDrawerEntry =
  | { kind: 'note'; note: ReaderNoteView; anchorStart: number }
  | { kind: 'highlight'; highlight: ReaderHighlightView; anchorStart: number };

function anchorStartOf(locator: ReaderLocator): number {
  return 'anchor' in locator && locator.anchor !== undefined
    ? locator.anchor.start
    : Number.MAX_SAFE_INTEGER;
}

function renderNotesList(notes: readonly ReaderNoteView[]): void {
  const list = document.getElementById('notes-list');
  if (!list) return;

  // El locator lleva la posición vertical, así que comparamos por documento (capítulo).
  const activeLocator = parseLocator(currentLocator);
  if (!activeLocator) {
    list.innerHTML = `<p class="notes-empty">${t('reader.notes.empty')}</p>`;
    return;
  }

  const entries: NotesDrawerEntry[] = [];
  for (const note of notes) {
    const noteLocator = parseLocator(note.locator);
    if (noteLocator && isSameDocumentPosition(noteLocator, activeLocator)) {
      entries.push({ kind: 'note', note, anchorStart: anchorStartOf(noteLocator) });
    }
  }
  for (const highlight of currentHighlights) {
    const hiLocator = parseLocator(highlight.locator);
    if (hiLocator && isSameDocumentPosition(hiLocator, activeLocator)) {
      entries.push({
        kind: 'highlight',
        highlight,
        anchorStart: anchorStartOf(hiLocator),
      });
    }
  }
  entries.sort((a, b) => a.anchorStart - b.anchorStart);

  if (entries.length === 0) {
    list.innerHTML = `<p class="notes-empty">${t('reader.notes.empty')}</p>`;
    return;
  }

  list.innerHTML = entries
    .map((entry) => {
      if (entry.kind === 'note') {
        const n = entry.note;
        return `
    <div class="note${n.id === activeNoteId ? ' active' : ''}" data-note-id="${n.id}">
      ${n.selectedText ? `<div class="nquote">“${escapeHtml(n.selectedText)}”</div>` : ''}
      <div class="ntx">${escapeHtml(n.body)}</div>
      <div class="note-actions">
        <button class="note-edit" data-note-id="${n.id}" data-note-body="${escapeHtml(n.body)}" title="${t('reader.note.edit')}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="note-delete" data-note-id="${n.id}" title="${t('reader.note.delete')}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
    </div>
  `;
      }
      const h = entry.highlight;
      return `
    <div class="note hl" data-hl-id="${h.id}" style="--hl-color:${h.color}">
      <div class="hl-label">
        <span class="hl-swatch" style="background:${h.color}"></span>${t('reader.highlight.label')}
      </div>
      ${h.selectedText ? `<div class="nquote">“${escapeHtml(h.selectedText)}”</div>` : ''}
      <div class="note-actions">
        <button class="hl-delete" data-hl-id="${h.id}" title="${t('reader.highlight.delete')}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
    </div>
  `;
    })
    .join('');

  list.querySelectorAll('.note').forEach((card) => {
    card.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (target.closest('.note-actions')) return;
      const noteId = (card as HTMLElement).dataset.noteId;
      const highlightId = (card as HTMLElement).dataset.hlId;
      if (noteId) void jumpToNote(noteId);
      else if (highlightId) void jumpToHighlight(highlightId);
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
        if (saveBtn) saveBtn.textContent = t('reader.update');
        void jumpToNote(noteId);
      }
    });
  });

  list.querySelectorAll('.hl-delete').forEach((btn) => {
    btn.addEventListener('click', () => {
      const highlightId = (btn as HTMLElement).dataset.hlId;
      if (highlightId) deleteHighlightFromDrawer(highlightId);
    });
  });
}

/* ==========================================================================
   Anclaje de notas al texto seleccionado
   ========================================================================== */

let pendingSelection: {
  quote: string;
  anchor: TextAnchor;
  locator: ReaderLocator;
  rect: DOMRect | null;
} | null = null;
let ignoreSelectionEvents = false;
let pendingSelectionSeq = 0;
let selectionGate: SelectionGate | null = null;

/** Resuelve el rango del capítulo que cubre una nota y lo trae a la vista. */
function scrollToAnchorRange(range: Range, recovered: boolean, kind: 'nota' | 'resaltado'): void {
  const rect = range.getBoundingClientRect();
  const scroll = document.getElementById('r-scroll');
  if (scroll) {
    scroll.scrollTop += rect.top - scroll.clientHeight / 3;
  }
  paintActiveNoteHighlight(range);
  if (recovered) {
    showToast(
      kind === 'nota' ? t('reader.anchor.noteRelocated') : t('reader.anchor.highlightRelocated'),
    );
  } else {
    showToast(kind === 'nota' ? t('reader.anchor.noteFound') : t('reader.anchor.highlightFound'));
  }
}

/** Lleva la vista al texto anclado en el locator, si el capítulo ya está cargado. */
function revealLocator(
  locator: ReaderLocator,
  selectedText?: string,
  kind: 'nota' | 'resaltado' = 'nota',
): void {
  const content = document.getElementById('page');
  if (!content || !hasTextAnchor(locator)) return;

  const found = resolveAnchorRange(indexChapterText(content), locator, selectedText);
  if (!found) {
    paintActiveNoteHighlight(null);
    showToast(
      kind === 'nota' ? t('reader.anchor.noteMissing') : t('reader.anchor.highlightMissing'),
    );
    return;
  }
  scrollToAnchorRange(found.range, found.recovered, kind);
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
  if (typeof order === 'number' && currentReaderDoc.goToChapter) {
    try {
      await currentReaderDoc.goToChapter(order);
      await renderChapter(currentReaderDoc, currentPreferences);
      await syncLocator();
      revealLocator(locator, note.selectedText);
      renderNotesList(currentNotes);
      return;
    } catch (error) {
      if (error instanceof Error && error.name === 'EpubNavigationError') return;
      throw error;
    }
  }

  if (locator.format === 'pdf' || locator.format === 'cbz') {
    const goToPage = (currentReaderDoc as unknown as Record<string, unknown>).goToPage as
      ((i: number) => Promise<ReaderLocator>) | undefined;
    if (typeof goToPage === 'function') {
      await goToPage.call(currentReaderDoc, locator.page - 1);
      await renderChapter(currentReaderDoc, currentPreferences);
      await syncLocator();
      renderNotesList(currentNotes);
      return;
    }
  }

  showToast(t('reader.note.otherChapter'));
}

async function jumpToHighlight(highlightId: string): Promise<void> {
  const highlight = currentHighlights.find((h) => h.id === highlightId);
  const locator = highlight ? parseLocator(highlight.locator) : null;
  if (!highlight || !locator || !currentReaderDoc) return;

  const current = parseLocator(currentLocator);
  if (current && isSameDocumentPosition(current, locator)) {
    revealLocator(locator, highlight.selectedText, 'resaltado');
    renderNotesList(currentNotes);
    return;
  }

  const order = 'positionOrder' in locator ? locator.positionOrder : undefined;
  if (typeof order === 'number' && currentReaderDoc.goToChapter) {
    try {
      await currentReaderDoc.goToChapter(order);
      await renderChapter(currentReaderDoc, currentPreferences);
      await syncLocator();
      revealLocator(locator, highlight.selectedText, 'resaltado');
      renderNotesList(currentNotes);
      return;
    } catch (error) {
      if (error instanceof Error && error.name === 'EpubNavigationError') return;
      throw error;
    }
  }

  showToast(t('reader.highlight.otherChapter'));
}

function deleteHighlightFromDrawer(highlightId: string): void {
  enqueueHighlightDelete(highlightId);
  currentHighlights = currentHighlights.filter((h) => h.id !== highlightId);
  refreshHighlightHighlights();
  renderNotesList(currentNotes);
  showToast(t('reader.highlight.queuedDelete'));
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

/** Pinta en el capítulo los resaltados de usuario del color de cada uno. */
function refreshHighlightHighlights(): void {
  const content = document.getElementById('page');
  if (!content) return;

  const active = parseLocator(currentLocator);
  if (!active) {
    clearHighlightRanges();
    return;
  }

  const index = indexChapterText(content);
  const byName: Record<string, Range[]> = {};
  for (const highlight of currentHighlights) {
    const locator = parseLocator(highlight.locator);
    if (!locator || !isSameDocumentPosition(locator, active)) continue;
    const name = highlightRegistryName(highlight.color);
    if (!name) continue;
    const found = resolveAnchorRange(index, locator, highlight.selectedText);
    if (!found) continue;
    if (!byName[name]) byName[name] = [];
    byName[name]!.push(found.range);
  }
  paintHighlightRanges(byName);
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
  if (!selection) {
    // La selección volvió a colapsar (clic en blanco): quitar el widget.
    hideSelectionWidget();
    return;
  }

  const seq = ++pendingSelectionSeq;
  const visibleSelection = window.getSelection();
  const rect =
    visibleSelection && !visibleSelection.isCollapsed && visibleSelection.rangeCount > 0
      ? visibleSelection.getRangeAt(0).getBoundingClientRect()
      : null;

  void currentReaderDoc?.getLocator().then((locator) => {
    if (seq !== pendingSelectionSeq) return;
    if (currentPanel === 'notes' && pendingSelection?.quote === selection.quote) return;
    pendingSelection = {
      quote: selection.quote,
      anchor: selection.anchor,
      locator: withTextAnchor(locator, selection.anchor),
      rect,
    };
    editingNoteId = null;
    const saveBtn = document.getElementById('note-save');
    if (saveBtn) saveBtn.textContent = t('reader.saveNote');
    renderSelectionPreview();
    if (currentPanel === 'notes') return;
    showSelectionWidget();
  });
}

/* --- Widget flotante de selección (resaltar / nota) --- */

function hideSelectionWidget(): void {
  const widget = document.getElementById('sel-widget');
  if (widget) widget.hidden = true;
}

function clampWidget(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function selectionRect(): DOMRect | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
  return selection.getRangeAt(0).getBoundingClientRect();
}

/** Highlight persistido cuyo ancla cubre el ancla seleccionada (mismo capítulo). */
function findHighlightForAnchor(anchor: TextAnchor): ReaderHighlightView | null {
  const active = parseLocator(currentLocator);
  for (const highlight of currentHighlights) {
    const locator = parseLocator(highlight.locator);
    if (!locator || (locator.format !== 'epub' && locator.format !== 'md')) continue;
    const hlAnchor = locator.anchor;
    if (!hlAnchor) continue;
    if (active && !isSameDocumentPosition(locator, active)) continue;
    if (hlAnchor.start <= anchor.start && hlAnchor.end >= anchor.end) return highlight;
  }
  return null;
}

function showSelectionWidget(): void {
  const widget = document.getElementById('sel-widget');
  if (!widget) return;
  if (!pendingSelection) {
    widget.hidden = true;
    return;
  }

  const existing = findHighlightForAnchor(pendingSelection.anchor);
  const locator = parseLocator(JSON.stringify(pendingSelection.locator));
  const supportsHighlight = locator?.format === 'epub' || locator?.format === 'md';

  const colorsRow = document.getElementById('sel-colors');
  const deleteBtn = document.getElementById('sel-delete');
  if (colorsRow) colorsRow.hidden = !supportsHighlight;
  if (deleteBtn) deleteBtn.hidden = !existing;

  widget.querySelectorAll('.sel-color').forEach((btn) => {
    btn.classList.toggle('sel', (btn as HTMLElement).dataset.color === existing?.color);
  });

  const rect = pendingSelection.rect ?? selectionRect();
  if (!rect) {
    widget.hidden = true;
    return;
  }

  const bounds = widget.getBoundingClientRect();
  const gap = 10;
  const left = clampWidget(
    rect.left + rect.width / 2 - bounds.width / 2,
    gap,
    Math.max(gap, window.innerWidth - bounds.width - gap),
  );
  let top = rect.top - bounds.height - gap;
  if (top < gap) top = rect.bottom + gap;
  widget.style.left = `${left}px`;
  widget.style.top = `${top}px`;
  widget.hidden = false;
}

function enqueueHighlight(payload: {
  color: string;
  locator: string;
  selectedText?: string;
}): void {
  const key = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const queue = window.__pendingHighlights ?? [];
  if (!window.__pendingHighlights) window.__pendingHighlights = queue;
  const item: PendingHighlightItem = {
    key,
    color: payload.color,
    locator: payload.locator,
    ...(payload.selectedText !== undefined ? { selectedText: payload.selectedText } : {}),
  };
  queue.push(item);

  // Pintado optimista: el host reconcilia con el ID real al drenar la cola.
  const optimistic: ReaderHighlightView = {
    id: `local-${key}`,
    color: payload.color,
    locator: payload.locator,
    ...(payload.selectedText !== undefined ? { selectedText: payload.selectedText } : {}),
  };
  currentHighlights = [...currentHighlights, optimistic];
  refreshHighlightHighlights();
}

function enqueueHighlightDelete(id: string): void {
  const deletes = window.__pendingHighlightDeletes ?? [];
  if (!window.__pendingHighlightDeletes) window.__pendingHighlightDeletes = deletes;
  deletes.push(id);
}

function createHighlightFromSelection(color: string): void {
  if (!pendingSelection || !highlightRegistryName(color)) return;
  const existing = findHighlightForAnchor(pendingSelection.anchor);
  if (existing) {
    enqueueHighlightDelete(existing.id);
    currentHighlights = currentHighlights.filter((h) => h.id !== existing.id);
  }
  enqueueHighlight({
    color,
    locator: JSON.stringify(pendingSelection.locator),
    selectedText: pendingSelection.quote,
  });
  showToast(existing ? t('reader.highlight.queuedUpdate') : t('reader.highlight.queued'));
  clearSelection();
}

function deleteHighlightFromSelection(): void {
  if (!pendingSelection) return;
  const existing = findHighlightForAnchor(pendingSelection.anchor);
  if (!existing) {
    hideSelectionWidget();
    return;
  }
  enqueueHighlightDelete(existing.id);
  currentHighlights = currentHighlights.filter((h) => h.id !== existing.id);
  refreshHighlightHighlights();
  showToast(t('reader.highlight.deletedQueued'));
  clearSelection();
}

function setupSelectionWidget(): void {
  const widget = document.getElementById('sel-widget');
  if (!widget) return;

  widget.querySelectorAll('.sel-color').forEach((btn) => {
    const color = (btn as HTMLElement).dataset.color;
    if (!color) return;
    (btn as HTMLButtonElement).style.backgroundColor = color;
    (btn as HTMLButtonElement).onclick = () => createHighlightFromSelection(color);
  });

  const noteBtn = document.getElementById('sel-note');
  if (noteBtn) {
    noteBtn.onclick = () => {
      if (!pendingSelection) return;
      renderSelectionPreview();
      hideSelectionWidget();
      // Sin scrim: el texto sigue siendo seleccionable con el panel abierto.
      openDrawer('notes', 'Notas', { scrim: false });
    };
  }

  const deleteBtn = document.getElementById('sel-delete');
  if (deleteBtn) deleteBtn.onclick = () => deleteHighlightFromSelection();
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
    <button class="nquote-clear" id="note-quote-clear" title="${t('reader.note.quoteClear')}">×</button>
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
  hideSelectionWidget();
  ignoreSelectionEvents = true;
  window.getSelection()?.removeAllRanges();
  setTimeout(() => {
    ignoreSelectionEvents = false;
  }, 0);
  renderNotesList(currentNotes);
  refreshNoteHighlights();
  refreshHighlightHighlights();
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
        saveBtn.textContent = t('reader.saveNote');
        showToast(t('reader.note.updateQueued'));
      } else if (pendingSelection) {
        enqueueNote({
          body,
          locator: JSON.stringify(pendingSelection.locator),
          selectedText: pendingSelection.quote,
        });
        showToast(t('reader.note.queuedAnchored'));
      } else {
        enqueueNote({ body, locator: currentLocator });
        showToast(t('reader.note.queued'));
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
  refreshHighlightHighlights();
}

async function main(): Promise<void> {
  setLocale(detectLocale(navigator.language));
  applyStaticTranslations(document);
  setUIState({ type: 'loading' });

  try {
    const { uri, format } = parseQueryParams();

    (window as unknown as Record<string, unknown>).__initFromHost = async (data: HostInitData) => {
      lastInitData = data;
      const hostLocale = coerceLocale(data.locale);
      if (hostLocale) {
        setLocale(hostLocale);
        applyStaticTranslations(document);
      }
      try {
        const binary = atob(data.fileDataB64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }

        currentPreferences = data.preferences;
        currentNotes = data.notes ?? [];
        currentHighlights = data.highlights ?? [];
        currentReaderDoc = await loadDocument(uri, format, bytes);

        const readerEl = document.getElementById('reader');
        if (readerEl) {
          readerEl.classList.toggle('fixed-layout', !currentReaderDoc.capabilities.reflowable);
        }

        // Populate toolbar with real metadata
        const titleEl = document.getElementById('r-title');
        const authorEl = document.getElementById('r-author');
        if (titleEl && titleEl.childNodes[0]) {
          titleEl.childNodes[0].textContent = data.metadata.title;
        }
        if (authorEl) authorEl.textContent = data.metadata.author ?? '';

        setUIState({ type: 'content' });
        setupNavigation(currentReaderDoc, currentPreferences);
        setupKeyboardNavigation();
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
        setupSelectionWidget();
        setupNotes();
      } catch (error) {
        const message = error instanceof Error ? error.message : t('reader.error.open');
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
      refreshHighlightHighlights();
    };

    /* --- Highlights update from host --- */
    window.__updateHighlights = (highlights: readonly ReaderHighlightView[]) => {
      currentHighlights = highlights;
      refreshHighlightHighlights();
      renderNotesList(currentNotes);
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
      showToast(t('reader.note.saved'));
    };
    window.__noteError = (message: string) => {
      showToast(message);
    };

    /* --- Highlights save/error feedback from host --- */
    window.__highlightSaved = () => {
      showToast(t('reader.highlight.saved'));
    };
    window.__highlightError = (message: string) => {
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

    /* --- Go to page (PDF/CBZ resume from host) --- */
    window.__goToPage = async (page: number) => {
      if (!currentReaderDoc) return;
      const goToPage = (currentReaderDoc as unknown as Record<string, unknown>).goToPage as
        ((i: number) => Promise<ReaderLocator>) | undefined;
      if (typeof goToPage !== 'function') return;
      await goToPage.call(currentReaderDoc, page - 1);
      await renderChapter(currentReaderDoc, currentPreferences);
      await syncLocator();
    };

    /* --- Get current locator (for host progress sync) --- */
    window.__getCurrentLocator = (): string | undefined => {
      return currentLocator || undefined;
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : t('reader.error.openUnknown');
    setUIState({ type: 'error', message });
  }
}

/* --- Overlay de error: reintentar / volver (fuera de main() para que
       funcionen también cuando main() falla) --- */
function setupErrorActions(): void {
  const retryBtn = document.getElementById('reader-error-retry');
  if (retryBtn) {
    retryBtn.onclick = () => {
      const init = (window as unknown as Record<string, unknown>).__initFromHost as
        ((data: HostInitData) => Promise<void>) | undefined;
      if (lastInitData && typeof init === 'function') {
        setUIState({ type: 'loading' });
        void init(lastInitData);
        return;
      }
      currentReaderDoc = null;
      void main();
    };
  }

  const backBtn = document.getElementById('reader-error-back');
  if (backBtn) {
    backBtn.onclick = () => {
      console.log(CLOSE_SENTINEL);
    };
  }
}

setupErrorActions();
main();
