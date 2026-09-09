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
   Sanitización de HTML
   ========================================================================== */

const BLOCKED_TAGS = ['script', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'button', 'link'];
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
    try { URL.revokeObjectURL(url); } catch { /* ignore */ }
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
    if (m[2]) { const src = stripFragment(m[2]); allSrcs.push(src); srcTypes.set(src, 'img'); }
  }
  const svgRegex = new RegExp(SVG_IMAGE_HREF_RE.source, 'gi');
  while ((m = svgRegex.exec(html)) !== null) {
    if (m[2]) { const src = stripFragment(m[2]); allSrcs.push(src); srcTypes.set(src, 'svg'); }
  }

  if (allSrcs.length === 0) return html;
  if (!readerDoc.getImageData) return html;

  revokePreviousBlobUrls();
  const newBlobUrls: string[] = [];
  const blobUrlCache = new Map<string, string>();

  const srcsToResolve = [...new Set(allSrcs.filter((s) => !s.startsWith('data:') && !s.startsWith('blob:')))];
  for (const src of srcsToResolve) {
    try {
      const result = await readerDoc.getImageData(src);
      if (result) {
        const buf = result.data.buffer as ArrayBuffer;
        const blob = new Blob([buf.slice(result.data.byteOffset, result.data.byteOffset + result.data.byteLength)], { type: result.mimeType });
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
      resultHtml = resultHtml.replace(new RegExp(`(<img\\b[^>]*?src\\s*=\\s*["']${safeSrc}["'][^>]*?>)`, 'gi'), addFailedImgClass);
      resultHtml = resultHtml.replace(new RegExp(`(<image\\b[^>]*?(?:xlink:)?href\\s*=\\s*["']${safeSrc}["'][^>]*?>)`, 'gi'), addFailedImgClass);
      continue;
    }
    resultHtml = resultHtml.replace(new RegExp(`(<img\\b[^>]*?)src\\s*=\\s*["']${safeSrc}["']([^>]*?>)`, 'gi'), `$1src="${blobUrl}"$2`);
    resultHtml = resultHtml.replace(new RegExp(`(<image\\b[^>]*?)(xlink:)?href\\s*=\\s*["']${safeSrc}["']([^>]*?>)`, 'gi'), (_match, pre, xlinkPrefix, post) => {
      return `${pre}${xlinkPrefix ? 'xlink:' : ''}href="${blobUrl}"${post}`;
    });
  }
  return resultHtml;
}

function escapeRegExp(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function stripFragment(href: string): string { const i = href.indexOf('#'); return i >= 0 ? href.substring(0, i) : href; }

/* ==========================================================================
   Query params
   ========================================================================== */

interface QueryParams { readonly uri: string; readonly format: SupportedFormat; }

function parseQueryParams(): QueryParams {
  const params = new URLSearchParams(window.location.search);
  const uri = params.get('uri');
  const format = params.get('format')?.toLowerCase();
  if (!uri) throw new ReaderError('Falta el parámetro "uri" en la URL');
  if (!format || !isSupportedFormat(format)) throw new ReaderError(`Formato no soportado: "${format ?? 'desconocido'}"`);
  return { uri, format };
}

function isSupportedFormat(value: string): value is SupportedFormat {
  return (SUPPORTED_FORMATS as readonly string[]).includes(value);
}

class ReaderError extends Error {
  constructor(message: string) { super(message); this.name = 'ReaderError'; }
}

/* ==========================================================================
   UI State
   ========================================================================== */

type UIState = { readonly type: 'loading' } | { readonly type: 'error'; readonly message: string } | { readonly type: 'content' };

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

async function renderChapter(readerDoc: ReaderDocument, preferences: ReaderPreferences): Promise<void> {
  const contentEl = document.getElementById('page');
  if (!contentEl) return;
  if (!readerDoc.getCurrentChapterContent) throw new ReaderError('El formato no soporta renderizado de contenido');

  const htmlContent = await readerDoc.getCurrentChapterContent();
  const resolvedHtml = await resolveImagesInHtml(readerDoc, htmlContent);
  contentEl.innerHTML = sanitizeHtml(resolvedHtml);

  if (readerDoc.applyPreferences) {
    const existingStyle = contentEl.querySelector('style');
    if (existingStyle) existingStyle.remove();
    const styleEl = document.createElement('style');
    const css = await readerDoc.applyPreferences(preferences);
    styleEl.textContent = css;
    contentEl.prepend(styleEl);
  }

  updateChapterInfo(readerDoc);

  const scroll = document.getElementById('r-scroll');
  if (scroll) scroll.scrollTop = 0;
}

async function updateChapterInfo(readerDoc: ReaderDocument): Promise<void> {
  const pct = document.getElementById('pct');
  const btnPrev = document.getElementById('prev-page') as HTMLButtonElement | null;
  const btnNext = document.getElementById('next-page') as HTMLButtonElement | null;

  if (readerDoc.getCurrentChapterIndex && readerDoc.getChapterCount) {
    const currentIndex = await readerDoc.getCurrentChapterIndex();
    const totalChapters = await readerDoc.getChapterCount();
    if (pct) pct.textContent = `Cap. ${currentIndex + 1} de ${totalChapters}`;
    if (btnPrev) btnPrev.disabled = currentIndex <= 0;
    if (btnNext) btnNext.disabled = currentIndex >= totalChapters - 1;
  }
}

/* ==========================================================================
   Navegación
   ========================================================================== */

function setupNavigation(readerDoc: ReaderDocument, preferences: ReaderPreferences): void {
  const btnPrev = document.getElementById('prev-page');
  const btnNext = document.getElementById('next-page');
  if (btnPrev) btnPrev.addEventListener('click', () => navigateChapter(readerDoc, preferences, 'previous'));
  if (btnNext) btnNext.addEventListener('click', () => navigateChapter(readerDoc, preferences, 'next'));
}

async function navigateChapter(readerDoc: ReaderDocument, preferences: ReaderPreferences, direction: 'next' | 'previous'): Promise<void> {
  try {
    if (direction === 'next') await readerDoc.goNext();
    else await readerDoc.goPrevious();
    await renderChapter(readerDoc, preferences);
  } catch (error) {
    if (error instanceof Error && error.name === 'EpubNavigationError') return;
    throw error;
  }
}

/* ==========================================================================
   Drawer system
   ========================================================================== */

let currentPanel: string | null = null;

function openDrawer(panelId: string, title: string): void {
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

  scrim.classList.add('show');
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
      if (currentPanel === panelId) { closeDrawer(); return; }
      const titles: Record<string, string> = {
        info: 'Información', toc: 'Índice', search: 'Buscar', notes: 'Notas', settings: 'Ajustes de lectura',
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

function setupSettings(preferences: ReaderPreferences): void {
  const reader = document.getElementById('reader');
  const page = document.getElementById('page');
  if (!reader || !page) return;

  let currentSize = 19;
  let currentLh = 1.75;

  // Theme swatches
  document.querySelectorAll('.sw[data-t]').forEach((sw) => {
    sw.addEventListener('click', () => {
      document.querySelectorAll('.sw[data-t]').forEach((s) => s.classList.remove('sel'));
      sw.classList.add('sel');
      reader.setAttribute('data-theme', (sw as HTMLElement).dataset.t ?? 'paper');
    });
  });

  // Font segmented
  document.querySelectorAll('#sw-font button[data-f]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#sw-font button').forEach((b) => b.classList.remove('sel'));
      btn.classList.add('sel');
      reader.setAttribute('data-font', (btn as HTMLElement).dataset.f ?? 'serif');
    });
  });

  // Size stepper
  const sizeVal = document.getElementById('size-val');
  const sizeDown = document.getElementById('size-down');
  const sizeUp = document.getElementById('size-up');
  const updateSize = (delta: number) => {
    currentSize = Math.max(14, Math.min(28, currentSize + delta));
    if (sizeVal) sizeVal.textContent = `${currentSize} px`;
    page.style.setProperty('--read-size', `${currentSize}px`);
  };
  if (sizeDown) sizeDown.addEventListener('click', () => updateSize(-1));
  if (sizeUp) sizeUp.addEventListener('click', () => updateSize(1));

  // Line height segmented
  document.querySelectorAll('#sw-lh button[data-lh]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#sw-lh button').forEach((b) => b.classList.remove('sel'));
      btn.classList.add('sel');
      currentLh = parseFloat((btn as HTMLElement).dataset.lh ?? '1.75');
      page.style.setProperty('--read-lh', String(currentLh));
    });
  });
}

/* ==========================================================================
   TOC rendering
   ========================================================================== */

async function renderTOC(readerDoc: ReaderDocument): Promise<void> {
  const tocPanel = document.getElementById('panel-toc');
  if (!tocPanel) return;

  // Check if the document supports TOC via capabilities or optional methods
  const doc = readerDoc as unknown as Record<string, unknown>;
  const getTOC = doc.getTOC as (() => Promise<Array<{ title: string; href?: string }>>) | undefined;
  if (!getTOC) {
    tocPanel.innerHTML = '<p style="color:var(--read-tx-lo);font-size:14px">No hay índice disponible.</p>';
    return;
  }

  try {
    const toc = await getTOC();
    if (!toc || toc.length === 0) {
      tocPanel.innerHTML = '<p style="color:var(--read-tx-lo);font-size:14px">No hay índice disponible.</p>';
      return;
    }

    const getCurrentIdx = doc.getCurrentChapterIndex as (() => Promise<number>) | undefined;
    const currentIndex = getCurrentIdx ? await getCurrentIdx() : -1;

    tocPanel.innerHTML = toc.map((item: { title: string; href?: string }, i: number) => {
      const isCurrent = i === currentIndex;
      return `<button class="toc-item${isCurrent ? ' current' : ''}" data-chapter="${i}">
        <span class="n">${i + 1}</span>
        <span class="t">${item.title}</span>
      </button>`;
    }).join('');

    const goToChapter = doc.goToChapter as ((idx: number) => Promise<void>) | undefined;
    tocPanel.querySelectorAll('.toc-item').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const idx = parseInt((btn as HTMLElement).dataset.chapter ?? '0', 10);
        if (goToChapter) {
          await goToChapter(idx);
          await renderChapter(readerDoc, currentPreferences);
          closeDrawer();
        }
      });
    });
  } catch {
    tocPanel.innerHTML = '<p style="color:var(--read-tx-lo);font-size:14px">Error al cargar el índice.</p>';
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

function setupBack(): void {
  const backBtn = document.getElementById('r-back');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      window.location.href = '/';
    });
  }
}

/* ==========================================================================
   Carga de documento
   ========================================================================== */

async function loadDocument(uri: string, format: SupportedFormat, preloadedData?: Uint8Array): Promise<ReaderDocument> {
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

function log(...args: unknown[]): void { console.log('[reader-entry]', ...args); }

async function main(): Promise<void> {
  setUIState({ type: 'loading' });

  try {
    const { uri, format } = parseQueryParams();

    (window as unknown as Record<string, unknown>).__initFromHost = async (data: {
      preferences: ReaderPreferences;
      fileDataB64: string;
    }) => {
      try {
        const binary = atob(data.fileDataB64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }

        currentPreferences = data.preferences;
        currentReaderDoc = await loadDocument(uri, format, bytes);

        setUIState({ type: 'content' });
        await renderChapter(currentReaderDoc, currentPreferences);
        setupNavigation(currentReaderDoc, currentPreferences);
        setupDrawer();
        setupZen();
        setupSettings(currentPreferences);
        setupBookmark();
        setupBack();
        await renderTOC(currentReaderDoc);

        // Apply initial theme from preferences
        const reader = document.getElementById('reader');
        if (reader) {
          const themeMap: Record<string, string> = { light: 'paper', dark: 'night' };
          const theme = themeMap[currentPreferences.theme] ?? 'paper';
          reader.setAttribute('data-theme', theme);
          document.querySelectorAll('.sw[data-t]').forEach((sw) => {
            sw.classList.toggle('sel', (sw as HTMLElement).dataset.t === theme);
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Error al abrir el libro';
        setUIState({ type: 'error', message });
      }
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
